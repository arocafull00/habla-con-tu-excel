"use client";

import { useEffect, useState } from "react";
import type { Respuesta } from "@/lib/preguntar";
import { formatearCelda } from "@/lib/formato";
import { Grafico } from "./Grafico";

export type Turno = {
  id: number;
  pregunta: string;
  estado: "pensando" | "listo" | "error";
  respuesta?: Respuesta;
  error?: string;
};

const PASOS = ["Leyendo tu Excel…", "Buscando la respuesta…", "Haciendo las cuentas…", "Preparando el resultado…"];

function Pensando() {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const intervalo = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 1700);
    return () => clearInterval(intervalo);
  }, []);
  return (
    <div role="status" className="mt-5">
      <p key={paso} className="aparecer text-texto-suave">{PASOS[paso]}</p>
      <div className="mt-4 space-y-3" aria-hidden>
        <div className="esqueleto h-11 w-56 rounded-lg" />
        <div className="esqueleto h-4 w-full max-w-xl rounded" />
        <div className="esqueleto h-4 w-4/5 max-w-md rounded" />
      </div>
    </div>
  );
}

function Tabla({ respuesta }: { respuesta: Respuesta }) {
  const numericas = new Set(
    respuesta.columnas.filter((c) => respuesta.filas.some((f) => typeof f[c] === "number")),
  );
  return (
    <div className="overflow-hidden rounded-lg border border-borde bg-superficie">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-left text-[15px]">
          <thead className="sticky top-0 bg-hundido">
            <tr>
              {respuesta.columnas.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={`whitespace-nowrap border-b border-borde px-4 py-2.5 text-sm font-medium text-texto-suave first-letter:uppercase ${numericas.has(c) ? "text-right" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {respuesta.filas.map((fila, i) => (
              <tr key={i} className="border-b border-borde last:border-b-0 hover:bg-hundido/60">
                {respuesta.columnas.map((c, j) => (
                  <td
                    key={c}
                    className={`whitespace-nowrap px-4 py-2.5 ${numericas.has(c) ? "text-right tabular-nums" : ""} ${j === 0 ? "font-medium" : ""}`}
                  >
                    {formatearCelda(fila[c], c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {respuesta.total > respuesta.filas.length && (
        <p className="border-t border-borde bg-hundido px-4 py-2 text-sm text-texto-suave">
          Mostrando {respuesta.filas.length} de {respuesta.total.toLocaleString("es-ES")} filas
        </p>
      )}
    </div>
  );
}

function Resultado({ respuesta }: { respuesta: Respuesta }) {
  const { visualizacion, ejeX, ejeY, filas, columnas } = respuesta;
  const puedeGraficar =
    (visualizacion === "barras" || visualizacion === "lineas") &&
    ejeX && ejeY && columnas.includes(ejeX) && columnas.includes(ejeY) && filas.length > 0;

  if (puedeGraficar) return <Grafico tipo={visualizacion} filas={filas} ejeX={ejeX} ejeY={ejeY} />;
  if (visualizacion === "tabla" || (visualizacion !== "numero" && filas.length > 1)) return <Tabla respuesta={respuesta} />;
  return null;
}

function Destacado({ texto }: { texto: string }) {
  const partes = texto.match(/^(.+?)\s*\(([^()]+)\)$/);
  const cifra = partes ? partes[1] : texto;
  const etiqueta = partes?.[2];
  return (
    <div className="aparecer">
      <p className="break-words text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-acento-fuerte tabular-nums sm:text-[3.5rem]">
        {cifra}
      </p>
      {etiqueta && <p className="mt-2 text-lg font-medium sm:text-xl">{etiqueta}</p>}
    </div>
  );
}

function IconoPregunta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-[3px] h-4 w-4 shrink-0" aria-hidden>
      <path d="M4 5v6a4 4 0 0 0 4 4h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TarjetaRespuesta({ turno }: { turno: Turno }) {
  const [verConsulta, setVerConsulta] = useState(false);
  const respuesta = turno.respuesta;

  return (
    <article className="aparecer border-b border-borde py-9 last:border-b-0 sm:py-12">
      <h2 className="flex gap-2 text-[15px] font-medium text-texto-suave">
        <IconoPregunta />
        {turno.pregunta}
      </h2>

      {turno.estado === "pensando" && <Pensando />}

      {turno.estado === "error" && (
        <p role="alert" className="mt-5 rounded-lg bg-error-suave px-4 py-3 text-error">{turno.error}</p>
      )}

      {turno.estado === "listo" && respuesta && (
        <div className="mt-5 space-y-6">
          {respuesta.destacado && <Destacado texto={respuesta.destacado} />}
          <p className="aparecer max-w-[62ch] text-lg leading-relaxed text-pretty [animation-delay:60ms]">{respuesta.respuesta}</p>
          <div className="aparecer [animation-delay:120ms]">
            <Resultado respuesta={respuesta} />
          </div>
          {respuesta.sql && (
            <div>
              <button
                type="button"
                aria-expanded={verConsulta}
                onClick={() => setVerConsulta((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-medium text-texto-suave transition-colors hover:text-texto"
              >
                <span aria-hidden className={`inline-block transition-transform duration-200 ${verConsulta ? "rotate-90" : ""}`}>›</span>
                {verConsulta ? "Ocultar cómo lo he calculado" : "Ver cómo lo he calculado"}
              </button>
              {verConsulta && (
                <pre className="aparecer mt-3 overflow-x-auto rounded-lg border border-borde bg-hundido p-4 font-mono text-[13px] leading-relaxed text-texto">
                  {respuesta.sql}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
