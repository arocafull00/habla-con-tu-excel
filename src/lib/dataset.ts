import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";

type Valor = string | number | null;
type TipoColumna = "numero" | "fecha" | "texto";

export type Columna = {
  nombre: string;
  etiqueta: string;
  tipo: TipoColumna;
  ejemplos: Valor[];
  minimo?: Valor;
  maximo?: Valor;
};

export type Tabla = {
  nombre: string;
  hoja: string;
  filas: number;
  columnas: Columna[];
};

export type Dataset = {
  id: string;
  archivo: string;
  tablas: Tabla[];
  db: DatabaseSync;
};

const globalConDatasets = globalThis as typeof globalThis & {
  __datasets?: Map<string, Dataset>;
};
const datasets = (globalConDatasets.__datasets ??= new Map<string, Dataset>());

export function obtenerDataset(id: string) {
  return datasets.get(id);
}

function normalizarNombre(texto: string) {
  const limpio = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/º/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(limpio) ? limpio : `c_${limpio}`;
}

function nombreUnico(base: string, usados: Set<string>) {
  let nombre = base || "columna";
  for (let i = 2; usados.has(nombre); i++) nombre = `${base}_${i}`;
  usados.add(nombre);
  return nombre;
}

function aFecha(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

function valorDeCelda(valor: ExcelJS.CellValue): Valor | Date {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === "number") return valor;
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "string") return valor.trim() === "" ? null : valor.trim();
  if (typeof valor === "object") {
    if ("formula" in valor || "sharedFormula" in valor || "result" in valor) {
      const resultado = (valor as { result?: ExcelJS.CellValue }).result;
      return resultado === undefined ? null : valorDeCelda(resultado);
    }
    if ("richText" in valor) return valor.richText.map((t) => t.text).join("").trim() || null;
    if ("text" in valor) return String(valor.text).trim() || null;
    if ("error" in valor) return null;
  }
  return String(valor);
}

function leerHoja(hoja: ExcelJS.Worksheet) {
  const filas: (Valor | Date)[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: (Valor | Date)[] = [];
    for (let c = 1; c <= hoja.columnCount; c++) valores.push(valorDeCelda(fila.getCell(c).value));
    if (valores.some((v) => v !== null)) filas.push(valores);
  });
  return filas;
}

function leerCsv(texto: string) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const separador = (lineas[0]?.match(/;/g)?.length ?? 0) > (lineas[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lineas.map((linea) => {
    const celdas: string[] = [];
    let actual = "";
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else entreComillas = !entreComillas;
      } else if (ch === separador && !entreComillas) {
        celdas.push(actual);
        actual = "";
      } else actual += ch;
    }
    celdas.push(actual);
    return celdas.map((c): Valor => {
      const t = c.trim();
      if (t === "") return null;
      const numero = Number(separador === ";" ? t.replace(/\./g, "").replace(",", ".") : t);
      return Number.isFinite(numero) && /^-?[\d.,]+$/.test(t) ? numero : t;
    });
  });
}

function cargarTabla(db: DatabaseSync, hoja: string, filas: (Valor | Date)[][], usadas: Set<string>): Tabla | null {
  const indiceCabecera = filas.findIndex((f) => f.filter((v) => typeof v === "string").length >= 2);
  if (indiceCabecera === -1) return null;
  const cabecera = filas[indiceCabecera];
  const datos = filas.slice(indiceCabecera + 1);
  if (datos.length === 0) return null;

  const indices = cabecera.map((_, i) => i).filter((i) => cabecera[i] !== null || datos.some((f) => f[i] !== null));
  const nombresUsados = new Set<string>();
  const columnas: Columna[] = indices.map((i) => {
    const etiqueta = cabecera[i] === null ? `Columna ${i + 1}` : String(cabecera[i] instanceof Date ? aFecha(cabecera[i] as Date) : cabecera[i]);
    const valores = datos.map((f) => f[i]).filter((v) => v !== null && v !== undefined);
    const tipo: TipoColumna =
      valores.length > 0 && valores.every((v) => v instanceof Date)
        ? "fecha"
        : valores.length > 0 && valores.every((v) => typeof v === "number")
          ? "numero"
          : "texto";
    return { nombre: nombreUnico(normalizarNombre(etiqueta), nombresUsados), etiqueta, tipo, ejemplos: [] };
  });

  const nombre = nombreUnico(normalizarNombre(hoja), usadas);
  const definicion = columnas
    .map((c) => `"${c.nombre}" ${c.tipo === "numero" ? "REAL" : "TEXT"}`)
    .join(", ");
  db.exec(`CREATE TABLE "${nombre}" (${definicion})`);

  const insertar = db.prepare(
    `INSERT INTO "${nombre}" VALUES (${columnas.map(() => "?").join(", ")})`,
  );
  db.exec("BEGIN");
  for (const fila of datos) {
    insertar.run(
      ...indices.map((i, j) => {
        const v = fila[i];
        if (v === null || v === undefined) return null;
        if (v instanceof Date) return aFecha(v);
        if (columnas[j].tipo === "numero") return v;
        return String(v);
      }),
    );
  }
  db.exec("COMMIT");

  for (const columna of columnas) {
    const ejemplos = db
      .prepare(`SELECT DISTINCT "${columna.nombre}" AS v FROM "${nombre}" WHERE "${columna.nombre}" IS NOT NULL LIMIT 4`)
      .all()
      .map((r) => r.v as Valor);
    columna.ejemplos = ejemplos.map((v) => (typeof v === "string" && v.length > 40 ? `${v.slice(0, 40)}…` : v));
    if (columna.tipo !== "texto") {
      const rango = db
        .prepare(`SELECT MIN("${columna.nombre}") AS minimo, MAX("${columna.nombre}") AS maximo FROM "${nombre}"`)
        .get();
      columna.minimo = (rango?.minimo ?? null) as Valor;
      columna.maximo = (rango?.maximo ?? null) as Valor;
    }
  }

  return { nombre, hoja, filas: datos.length, columnas };
}

export async function crearDataset(archivo: string, contenido: ArrayBuffer): Promise<Dataset> {
  const db = new DatabaseSync(":memory:");
  const usadas = new Set<string>();
  const tablas: Tabla[] = [];

  if (archivo.toLowerCase().endsWith(".csv")) {
    const tabla = cargarTabla(db, archivo.replace(/\.csv$/i, ""), leerCsv(new TextDecoder().decode(contenido)), usadas);
    if (tabla) tablas.push(tabla);
  } else {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(contenido);
    for (const hoja of libro.worksheets) {
      const tabla = cargarTabla(db, hoja.name, leerHoja(hoja), usadas);
      if (tabla) tablas.push(tabla);
    }
  }

  if (tablas.length === 0) throw new Error("No he encontrado ninguna tabla con datos en el archivo.");

  const dataset: Dataset = { id: randomUUID(), archivo, tablas, db };
  datasets.set(dataset.id, dataset);
  return dataset;
}

const PALABRAS_PROHIBIDAS = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|replace|vacuum|reindex|analyze)\b/i;

export function ejecutarConsulta(dataset: Dataset, sql: string, limite: number) {
  const consulta = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(consulta) || consulta.includes(";") || PALABRAS_PROHIBIDAS.test(consulta)) {
    throw new Error("Solo se permiten consultas SELECT de solo lectura.");
  }
  const sentencia = dataset.db.prepare(consulta);
  const columnas = sentencia.columns().map((c) => c.name);
  const filas: Record<string, Valor>[] = [];
  let total = 0;
  for (const fila of sentencia.iterate()) {
    total++;
    if (filas.length < limite) filas.push(fila as Record<string, Valor>);
  }
  return { columnas, filas, total };
}

export function describirDataset(dataset: Dataset) {
  return dataset.tablas
    .map((t) => {
      const columnas = t.columnas
        .map((c) => {
          const rango = c.tipo !== "texto" ? ` · rango ${c.minimo} → ${c.maximo}` : "";
          return `  - "${c.nombre}" (${c.tipo}; en el Excel: "${c.etiqueta}")${rango} · ejemplos: ${JSON.stringify(c.ejemplos)}`;
        })
        .join("\n");
      return `Tabla "${t.nombre}" (hoja "${t.hoja}", ${t.filas} filas):\n${columnas}`;
    })
    .join("\n\n");
}
