import { z } from "zod";

const cargadoSchema = z.object({
  id: z.string(),
  archivo: z.string(),
  hojas: z.array(z.object({ nombre: z.string(), filas: z.number(), columnas: z.number() })),
});

const respuestaSchema = z.object({
  respuesta: z.string(),
  destacado: z.string().nullable(),
  visualizacion: z.enum(["numero", "barras", "lineas", "tabla"]),
  ejeX: z.string().nullable(),
  ejeY: z.string().nullable(),
  columnas: z.array(z.string()),
  filas: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  total: z.number(),
  sql: z.string().nullable(),
});

const sesionSchema = z.object({
  cargado: cargadoSchema,
  archivo: z.custom<File>((valor) => valor instanceof File),
  pregunta: z.string(),
  turnos: z.array(z.object({
    id: z.number(),
    pregunta: z.string(),
    estado: z.enum(["pensando", "listo", "error"]),
    respuesta: respuestaSchema.optional(),
    error: z.string().optional(),
  })),
});

export type Cargado = z.infer<typeof cargadoSchema>;
export type Sesion = z.infer<typeof sesionSchema>;

// IndexedDB conserva el archivo binario sin convertirlo a base64 ni usar la cuota de localStorage.
function abrirBase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open("habla-con-tu-excel", 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore("sesiones");
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const db = await abrirBase();
  try {
    const guardado = await new Promise<unknown>((resolve, reject) => {
      const transaccion = db.transaction("sesiones", "readonly");
      const peticion = transaccion.objectStore("sesiones").get("actual:v1");
      transaccion.oncomplete = () => resolve(peticion.result);
      transaccion.onabort = () => reject(transaccion.error);
    });
    if (guardado === undefined) return null;
    const sesion = sesionSchema.parse(guardado);
    return {
      ...sesion,
      turnos: sesion.turnos.map((turno) => turno.estado === "pensando"
        ? { ...turno, estado: "error", error: "La recarga interrumpió esta pregunta. Vuelve a enviarla." }
        : turno),
    };
  } finally {
    db.close();
  }
}

export async function guardarSesion(sesion: Sesion | null): Promise<void> {
  const db = await abrirBase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaccion = db.transaction("sesiones", "readwrite");
      const almacen = transaccion.objectStore("sesiones");
      if (sesion) almacen.put(sesion, "actual:v1");
      else almacen.delete("actual:v1");
      transaccion.oncomplete = () => resolve();
      transaccion.onabort = () => reject(transaccion.error);
    });
  } finally {
    db.close();
  }
}

export async function subirArchivo(archivo: File): Promise<Cargado> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  const respuesta = await fetch("/api/subir", { method: "POST", body: formulario });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || "No he podido leer el archivo.");
  return cargadoSchema.parse(datos);
}
