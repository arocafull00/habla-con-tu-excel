import { crearDataset } from "@/lib/dataset";

export async function POST(request: Request) {
  const formulario = await request.formData();
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File)) {
    return Response.json({ error: "No se ha recibido ningún archivo." }, { status: 400 });
  }
  if (!/\.(xlsx|csv)$/i.test(archivo.name)) {
    return Response.json({ error: "Sube un archivo .xlsx o .csv." }, { status: 400 });
  }

  try {
    const dataset = await crearDataset(archivo.name, await archivo.arrayBuffer());
    return Response.json({
      id: dataset.id,
      archivo: dataset.archivo,
      hojas: dataset.tablas.map((t) => ({ nombre: t.hoja, filas: t.filas, columnas: t.columnas.length })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message || "No he podido leer el archivo." }, { status: 400 });
  }
}
