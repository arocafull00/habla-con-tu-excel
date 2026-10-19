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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-14">
      <header className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-acento text-white">
          <IconoHoja className="h-6 w-6" />
        </span>
        <span className="text-xl font-semibold tracking-tight">Habla con tu Excel</span>
      </header>

      {errorPersistencia && <p role="alert" className="mt-4 text-[#b4361f]">{errorPersistencia}</p>}

      {!preparada ? (
        <p role="status" className="py-12 text-lg text-texto-suave">Recuperando tu sesión…</p>
      ) : !cargado ? (
        <section className="flex flex-1 flex-col justify-center py-8 sm:py-12">
          <h1 className="max-w-2xl text-[2.1rem] font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Pregúntale a tu Excel como se lo preguntarías a una persona.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-texto-suave sm:text-xl">
            Sin fórmulas, sin tablas dinámicas. Arrastra el archivo y escribe tu pregunta.
          </p>

          <div
            role="button"
            tabIndex={0}
            onClick={() => entradaArchivo.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entradaArchivo.current?.click()}
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
            className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 sm:mt-10 sm:py-16 text-center transition-all duration-200 ${
              arrastrando
                ? "scale-[1.01] border-acento bg-acento-suave"
                : "border-[#d6d2c8] bg-superficie hover:border-acento/60 hover:bg-[#fbfaf6]"
            }`}
          >
            <span
              className={`grid h-16 w-16 place-items-center rounded-2xl transition-colors ${
                arrastrando ? "bg-acento text-white" : "bg-acento-suave text-acento"
              }`}
            >
              <IconoHoja className="h-9 w-9" />
            </span>
            {subiendo ? (
              <p className="mt-5 text-xl font-medium">Leyendo tu Excel…</p>
            ) : (
              <>
                <p className="mt-5 text-xl font-medium">{arrastrando ? "Suéltalo aquí" : "Arrastra tu Excel aquí"}</p>
                <p className="mt-1 text-texto-suave">o haz clic para elegirlo · .xlsx o .csv</p>
              </>
            )}
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

          {errorSubida && <p className="mt-4 text-[#b4361f]">{errorSubida}</p>}

          <button
            type="button"
            onClick={usarDemo}
            disabled={subiendo}
            className="mt-6 self-center text-texto-suave underline-offset-4 hover:text-texto hover:underline disabled:opacity-50"
          >
            ¿No tienes uno a mano? Prueba con un Excel de ejemplo
          </button>
        </section>
      ) : (
        <section className="mt-6 flex flex-col gap-4 sm:mt-10 sm:gap-6">
          <div className="aparecer flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-borde bg-superficie px-4 py-3 sm:px-5 sm:py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acento-suave text-acento">
              <IconoHoja className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{cargado.archivo}</p>
              <p className="text-sm text-texto-suave">
                {cargado.hojas.length} {cargado.hojas.length === 1 ? "hoja" : "hojas"} ·{" "}
                {totalFilas.toLocaleString("es-ES")} filas ·{" "}
                {cargado.hojas.map((h) => h.nombre).join(", ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSesion(null);
              }}
              className="text-sm text-texto-suave underline-offset-4 hover:text-texto hover:underline"
            >
              Cambiar archivo
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              preguntar(pregunta);
            }}
            className="aparecer flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-2 pl-4 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)] focus-within:border-acento [animation-delay:0.06s]"
          >
            <input
              autoFocus
              value={pregunta}
              onChange={(e) => {
                const texto = e.target.value;
                setSesion((s) => s ? { ...s, pregunta: texto } : s);
              }}
              placeholder="Pregúntale lo que quieras a tu Excel…"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-lg outline-none sm:py-3 sm:text-xl placeholder:text-[#a8a49a]"
            />
            <button
              type="submit"
              disabled={!pregunta.trim()}
              aria-label="Preguntar"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-acento sm:h-12 sm:w-12 text-white transition-colors hover:bg-acento-fuerte disabled:bg-[#d9d6ce]"
            >
              <IconoEnviar />
            </button>
          </form>

          {turnos.length === 0 && (
            <div className="aparecer flex flex-wrap gap-2 [animation-delay:0.12s]">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => preguntar(s)}
                  className="rounded-full border border-borde bg-superficie px-3.5 py-2 text-sm text-texto-suave transition-colors sm:px-4 sm:text-[15px] hover:border-acento hover:text-acento-fuerte"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4 sm:gap-6">
            {turnos.map((turno) => (
              <TarjetaRespuesta key={turno.id} turno={turno} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
