"use client";

import { useRef, useState } from "react";
import { TarjetaRespuesta } from "@/components/TarjetaRespuesta";
import { useSesion } from "@/hooks/useSesion";
import { subirArchivo, type Cargado } from "@/lib/sesion";

const SUGERENCIAS = [
  "¿Qué cliente nos ha dejado más dinero este año?",
  "¿Qué meses vendemos menos?",
  "¿Qué facturas siguen sin cobrar?",
];

const ARCHIVO_DEMO = "/demo/Facturacion_Instalaciones_Turia.xlsx";

function IconoHoja({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconoEnviar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
      <rect x="5" y="10.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Pagina() {
  const { sesion, setSesion, preparada, errorPersistencia } = useSesion();
  const cargado = sesion?.cargado ?? null;
  const pregunta = sesion?.pregunta ?? "";
  const turnos = sesion?.turnos ?? [];
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const contador = useRef(0);
  const recuperacion = useRef<{ archivo: File; promesa: Promise<Cargado> } | null>(null);

  async function subir(archivo: File) {
    if (!preparada || subiendo) return;
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const datos = await subirArchivo(archivo);
      setSesion({ cargado: datos, archivo, pregunta: "", turnos: [] });
    } catch (error) {
      setErrorSubida((error as Error).message || "No he podido leer el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function usarDemo() {
    try {
      const respuesta = await fetch(ARCHIVO_DEMO);
      if (!respuesta.ok) throw new Error("No he podido descargar el Excel de ejemplo.");
      const blob = await respuesta.blob();
      await subir(new File([blob], ARCHIVO_DEMO.split("/").pop()!, { type: blob.type }));
    } catch (error) {
      setErrorSubida((error as Error).message || "No he podido cargar el ejemplo.");
    }
  }

  async function preguntar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || !sesion) return;
    const { archivo } = sesion;
    const id = contador.current = sesion.turnos.reduce((maximo, turno) => Math.max(maximo, turno.id), contador.current) + 1;
    setSesion((s) => s && s.archivo === archivo ? {
      ...s, pregunta: "", turnos: [{ id, pregunta: limpio, estado: "pensando" }, ...s.turnos],
    } : s);
    try {
      const enviar = (datasetId: string) => fetch("/api/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: datasetId, pregunta: limpio }),
      });
      let respuesta = await enviar(sesion.cargado.id);
      // El servidor puede haber reiniciado o estar atendiendo desde otra instancia.
      if (respuesta.status === 404) {
        if (recuperacion.current?.archivo !== archivo) {
          recuperacion.current = { archivo, promesa: subirArchivo(archivo) };
        }
        const { promesa } = recuperacion.current;
        const datos = await promesa.finally(() => {
          if (recuperacion.current?.promesa === promesa) recuperacion.current = null;
        });
        setSesion((s) => s?.archivo === archivo ? { ...s, cargado: datos } : s);
        respuesta = await enviar(datos.id);
      }
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error);
      setSesion((s) => s?.archivo === archivo ? {
        ...s, turnos: s.turnos.map((x) => x.id === id ? { ...x, estado: "listo", respuesta: datos } : x),
      } : s);
    } catch (error) {
      setSesion((s) => s?.archivo === archivo ? {
        ...s, turnos: s.turnos.map((x) => x.id === id ? { ...x, estado: "error", error: (error as Error).message || "Algo ha fallado." } : x),
      } : s);
    }
  }

  const totalFilas = cargado?.hojas.reduce((a, h) => a + h.filas, 0) ?? 0;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-borde bg-fondo/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-4 px-4 sm:px-6">
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-acento text-white">
              <IconoHoja className="h-5 w-5" />
            </span>
            <span className={`font-semibold tracking-tight ${cargado ? "hidden sm:inline" : ""}`}>Habla con tu Excel</span>
          </span>

          {cargado && (
            <div className="ml-auto flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-medium" title={cargado.archivo}>{cargado.archivo}</p>
                <p className="truncate text-xs text-texto-suave">
                  {cargado.hojas.length} {cargado.hojas.length === 1 ? "hoja" : "hojas"} ·{" "}
                  {totalFilas.toLocaleString("es-ES")} filas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSesion(null)}
                className="h-9 shrink-0 rounded-lg border border-borde bg-superficie px-3 text-sm font-medium text-texto transition-colors hover:border-borde-fuerte hover:bg-hundido active:bg-borde"
              >
                Cambiar archivo
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-20 sm:px-6 sm:pb-28">
        {errorPersistencia && (
          <p role="alert" className="mt-6 rounded-lg bg-error-suave px-4 py-3 text-error">
            {errorPersistencia}
          </p>
        )}

        {!preparada ? (
          <div role="status" aria-label="Recuperando tu sesión" className="mt-12 space-y-4">
            <div className="esqueleto h-14 rounded-xl" />
            <div className="esqueleto h-5 w-2/3 rounded" />
          </div>
        ) : !cargado ? (
          <section className="flex flex-1 flex-col justify-center py-10 sm:py-16">
            <h1 className="max-w-[18ch] text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-balance sm:text-[3.5rem]">
              Pregúntale a tu Excel como se lo preguntarías a una persona.
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg text-texto-suave text-pretty sm:text-xl">
              Sin fórmulas ni tablas dinámicas. Sube el archivo, escribe tu pregunta y te contesta con la cifra y un gráfico.
            </p>

            <div
              role="button"
              tabIndex={0}
              aria-busy={subiendo}
              onClick={() => !subiendo && entradaArchivo.current?.click()}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (!subiendo) entradaArchivo.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                const archivo = e.dataTransfer.files[0];
                if (archivo) subir(archivo);
              }}
              className={`group mt-10 flex items-center gap-5 rounded-xl border-[1.5px] border-dashed px-5 py-8 transition-colors duration-200 sm:px-8 sm:py-10 ${
                arrastrando
                  ? "border-acento bg-acento-suave"
                  : "border-borde-fuerte bg-superficie hover:border-acento hover:bg-acento-suave/40"
              } ${subiendo ? "cursor-progress" : "cursor-pointer"}`}
            >
              <span
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl transition-colors ${
                  arrastrando || subiendo ? "bg-acento text-white" : "bg-acento-suave text-acento group-hover:bg-acento group-hover:text-white"
                }`}
              >
                <IconoHoja className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                {subiendo ? (
                  <p role="status" className="text-lg font-medium sm:text-xl">Leyendo tu Excel…</p>
                ) : (
                  <>
                    <p className="text-lg font-medium sm:text-xl">{arrastrando ? "Suéltalo aquí" : "Arrastra tu Excel aquí"}</p>
                    <p className="mt-0.5 text-texto-suave">o haz clic para elegirlo. Archivos .xlsx o .csv</p>
                  </>
                )}
              </div>
              <input
                ref={entradaArchivo}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  if (archivo) subir(archivo);
                  e.target.value = "";
                }}
              />
            </div>

            {errorSubida && (
              <p role="alert" className="mt-4 rounded-lg bg-error-suave px-4 py-3 text-error">
                {errorSubida}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={usarDemo}
                disabled={subiendo}
                className="h-11 shrink-0 self-start whitespace-nowrap rounded-lg border border-borde bg-superficie px-4 font-medium transition-colors hover:border-borde-fuerte hover:bg-hundido active:bg-borde disabled:opacity-50 sm:self-auto"
              >
                Probar con un Excel de ejemplo
              </button>
              <p className="flex items-center gap-2 text-sm text-texto-suave">
                <IconoCandado />
                A la IA solo le llegan los nombres de las columnas, nunca el archivo entero.
              </p>
            </div>
          </section>
        ) : (
          <section className="flex flex-col pt-8 sm:pt-12">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                preguntar(pregunta);
              }}
              className="aparecer flex items-center gap-2 rounded-xl border border-borde-fuerte bg-superficie p-1.5 pl-4 transition-[border-color,box-shadow] focus-within:border-acento focus-within:ring-4 focus-within:ring-acento/15"
            >
              <label htmlFor="pregunta" className="sr-only">Tu pregunta</label>
              <input
                id="pregunta"
                autoFocus
                autoComplete="off"
                value={pregunta}
                onChange={(e) => {
                  const texto = e.target.value;
                  setSesion((s) => s ? { ...s, pregunta: texto } : s);
                }}
                placeholder="Pregunta lo que quieras…"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-lg outline-none placeholder:text-texto-suave focus-visible:outline-none sm:py-3"
              />
              <button
                type="submit"
                disabled={!pregunta.trim()}
                aria-label="Preguntar"
                className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-acento px-3.5 font-medium text-white transition-colors hover:bg-acento-fuerte disabled:bg-hundido disabled:text-texto-suave sm:h-12 sm:px-5"
              >
                <span className="hidden sm:inline">Preguntar</span>
                <IconoEnviar />
              </button>
            </form>

            {turnos.length === 0 && (
              <div className="aparecer mt-8">
                <p className="text-sm text-texto-suave">Para empezar, prueba con:</p>
                <ul className="mt-1">
                  {SUGERENCIAS.map((s) => (
                    <li key={s} className="border-b border-borde last:border-b-0">
                      <button
                        type="button"
                        onClick={() => preguntar(s)}
                        className="group flex w-full items-center justify-between gap-4 py-3.5 text-left text-lg transition-colors hover:text-acento-fuerte"
                      >
                        {s}
                        <span aria-hidden className="text-texto-suave transition-transform duration-200 group-hover:translate-x-1 group-hover:text-acento">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-2 flex flex-col">
              {turnos.map((turno) => (
                <TarjetaRespuesta key={turno.id} turno={turno} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
