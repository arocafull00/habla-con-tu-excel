import { z } from "zod";
import { type Dataset, describirDataset, ejecutarConsulta } from "./dataset";

const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const MODELOS_POR_DEFECTO = "minimax/minimax-m3.1-flash:free,nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free";
const MAX_VUELTAS = 8;

export type Visualizacion = "numero" | "barras" | "lineas" | "tabla";

export type Respuesta = {
  respuesta: string;
  destacado: string | null;
  visualizacion: Visualizacion;
  ejeX: string | null;
  ejeY: string | null;
  columnas: string[];
  filas: Record<string, string | number | null>[];
  total: number;
  sql: string | null;
};

export class ErrorOpenRouter extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

type LlamadaHerramienta = { id: string; type: "function"; function: { name: string; arguments: string } };
type MensajeAsistente = { role: "assistant"; content: string | null; tool_calls?: LlamadaHerramienta[] };
type Mensaje =
  | { role: "system" | "user"; content: string }
  | MensajeAsistente
  | { role: "tool"; tool_call_id: string; content: string };

const entradaRunSql = z.object({ sql: z.string().describe("Consulta SELECT de SQLite") });

const entradaShowAnswer = z.object({
  respuesta: z.string().describe("1–2 frases en español con la conclusión y la cifra clave"),
  destacado: z.string().nullable().describe("Cifra principal ya formateada, o null"),
  sql: z.string().nullable().describe("Consulta SELECT cuyo resultado se enseña, o null si no aplica"),
  visualizacion: z.enum(["numero", "barras", "lineas", "tabla"]),
  eje_x: z.string().nullable().describe("Columna del resultado para el eje X (barras/lineas), o null"),
  eje_y: z.string().nullable().describe("Columna numérica del resultado para el eje Y (barras/lineas), o null"),
});

const HERRAMIENTAS = [
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Ejecuta una consulta SELECT de SQLite sobre los datos del Excel y devuelve hasta 50 filas. Úsala para explorar y comprobar antes de responder.",
      parameters: z.toJSONSchema(entradaRunSql),
    },
  },
  {
    type: "function",
    function: {
      name: "show_answer",
      description: "Muestra la respuesta final al usuario. Llámala una sola vez, al final.",
      parameters: z.toJSONSchema(entradaShowAnswer),
    },
  },
];

function hoy() {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeZone: "Europe/Madrid" }).format(new Date());
}

function instrucciones(dataset: Dataset) {
  return `Eres un analista de datos que responde preguntas sobre el Excel de una empresa. Quien pregunta es el dueño o alguien del equipo, no un técnico: responde en español, claro y directo, como lo haría un buen controller.

Hoy es ${hoy()}. "Este año", "este mes" o "el año pasado" se refieren a esa fecha.

El Excel "${dataset.archivo}" está cargado en SQLite. Cada hoja es una tabla:

${describirDataset(dataset)}

Cómo trabajar:
- Usa run_sql para explorar o comprobar lo que necesites (solo SELECT; las fechas están como texto 'YYYY-MM-DD', usa strftime).
- Termina SIEMPRE llamando a show_answer una sola vez, con la consulta cuyo resultado se va a enseñar.
- En la consulta final, pon alias legibles en español entre comillas dobles ("Cliente", "Facturado", "Mes"...). Redondea los importes a 2 decimales. Para meses usa strftime('%Y-%m', ...) y ordena cronológicamente.
- Elige la visualización:
  · "numero": la respuesta es una sola cifra.
  · "barras": comparar categorías (máximo ~12 filas, ordenadas de mayor a menor).
  · "lineas": evolución en el tiempo.
  · "tabla": un listado de registros (facturas, clientes...). Ordénalo por lo más relevante.
- En "barras" y "lineas", eje_x es la columna de categorías o meses y eje_y la columna numérica.
- "respuesta": 1–2 frases con la conclusión y la cifra clave, con formato español (1.234,56 €). Sin tecnicismos, sin mencionar SQL ni tablas.
- "destacado": la cifra principal ya formateada (p. ej. "793.616 €" o "106 facturas"), o null si no hay una.
- Si la pregunta no se puede responder con estos datos, dilo en "respuesta" con visualizacion "numero", destacado null y sql null.`;
}

async function llamarOpenRouter(mensajes: Mensaje[]): Promise<MensajeAsistente> {
  const respuesta = await fetch(URL_OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Habla con tu Excel",
    },
    body: JSON.stringify({
      models: (process.env.OPENROUTER_MODEL || MODELOS_POR_DEFECTO).split(",").map((m) => m.trim()).filter(Boolean),
      messages: mensajes,
      tools: HERRAMIENTAS,
      tool_choice: "auto",
      reasoning: { effort: "low" },
      max_tokens: 16000,
    }),
  });

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.choices?.[0]?.message) {
    throw new ErrorOpenRouter(respuesta.ok ? 502 : respuesta.status, datos?.error?.message ?? "Respuesta vacía de OpenRouter.");
  }
  console.info(`[OpenRouter] ${datos.model}`);
  return datos.choices[0].message as MensajeAsistente;
}

export async function preguntar(dataset: Dataset, pregunta: string): Promise<Respuesta> {
  const mensajes: Mensaje[] = [
    { role: "system", content: instrucciones(dataset) },
    { role: "user", content: pregunta },
  ];

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const mensaje = await llamarOpenRouter(mensajes);
    mensajes.push(mensaje);

    const llamadas = mensaje.tool_calls ?? [];
    if (llamadas.length === 0) {
      return respuestaDeTexto(mensaje.content);
    }

    for (const llamada of llamadas) {
      let argumentos: unknown;
      try {
        argumentos = JSON.parse(llamada.function.arguments || "{}");
      } catch {
        mensajes.push({ role: "tool", tool_call_id: llamada.id, content: "Error: los argumentos no son JSON válido." });
        continue;
      }

      if (llamada.function.name === "run_sql") {
        const entrada = entradaRunSql.safeParse(argumentos);
        let contenido: string;
        if (!entrada.success) contenido = `Error: ${entrada.error.message}`;
        else {
          try {
            const { columnas, filas, total } = ejecutarConsulta(dataset, entrada.data.sql, 50);
            contenido = JSON.stringify({ columnas, filas, total_filas: total });
          } catch (error) {
            contenido = `Error: ${(error as Error).message}`;
          }
        }
        mensajes.push({ role: "tool", tool_call_id: llamada.id, content: contenido });
      } else if (llamada.function.name === "show_answer") {
        const entrada = entradaShowAnswer.safeParse(argumentos);
        if (!entrada.success) {
          mensajes.push({ role: "tool", tool_call_id: llamada.id, content: `Error: ${entrada.error.message}` });
          continue;
        }
        try {
          const resultado = entrada.data.sql
            ? ejecutarConsulta(dataset, entrada.data.sql, 500)
            : { columnas: [], filas: [], total: 0 };
          return {
            respuesta: entrada.data.respuesta,
            destacado: entrada.data.destacado,
            visualizacion: entrada.data.visualizacion,
            ejeX: entrada.data.eje_x,
            ejeY: entrada.data.eje_y,
            columnas: resultado.columnas,
            filas: resultado.filas.map((f) => ({ ...f })),
            total: resultado.total,
            sql: entrada.data.sql,
          };
        } catch (error) {
          mensajes.push({
            role: "tool",
            tool_call_id: llamada.id,
            content: `Error: ${(error as Error).message}. Corrige la consulta y vuelve a llamar a show_answer.`,
          });
        }
      } else {
        mensajes.push({ role: "tool", tool_call_id: llamada.id, content: `Error: la herramienta ${llamada.function.name} no existe.` });
      }
    }
  }

  return respuestaDeTexto(null);
}

function respuestaDeTexto(texto: string | null): Respuesta {
  return {
    respuesta: texto?.trim() || "No he podido encontrar una respuesta. Prueba a preguntarlo de otra forma.",
    destacado: null,
    visualizacion: "numero",
    ejeX: null,
    ejeY: null,
    columnas: [],
    filas: [],
    total: 0,
    sql: null,
  };
}
