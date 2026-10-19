import { obtenerDataset } from "@/lib/dataset";
import { ErrorOpenRouter, preguntar } from "@/lib/preguntar";

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "Falta la clave de OpenRouter: crea .env.local con OPENROUTER_API_KEY y reinicia el servidor." },
      { status: 500 },
    );
  }
  const { id, pregunta } = (await request.json()) as { id?: string; pregunta?: string };
  const dataset = id ? obtenerDataset(id) : undefined;
  if (!dataset) {
    return Response.json({ error: "El Excel ya no está cargado. Vuelve a subirlo." }, { status: 404 });
  }
  if (!pregunta?.trim()) {
    return Response.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  try {
    return Response.json(await preguntar(dataset, pregunta.trim()));
  } catch (error) {
    if (error instanceof ErrorOpenRouter) {
      const mensaje =
        error.estado === 401
          ? "La clave de OpenRouter no es válida."
          : error.estado === 402
            ? "No queda saldo en OpenRouter."
            : error.estado === 429
              ? "Demasiadas preguntas seguidas. Espera unos segundos."
              : `Error de OpenRouter (${error.estado}): ${error.message}`;
      return Response.json({ error: mensaje }, { status: 502 });
    }
    return Response.json({ error: (error as Error).message || "Algo ha fallado." }, { status: 500 });
  }
}
