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
    <div className="flex items-center gap-3 py-2 text-lg text-texto-suave">
      <span className="flex gap-1">
        <span className="pulso h-2 w-2 rounded-full bg-acento" />
        <span className="pulso h-2 w-2 rounded-full bg-acento [animation-delay:0.2s]" />
        <span className="pulso h-2 w-2 rounded-full bg-acento [animation-delay:0.4s]" />
      </span>
      <span key={paso} className="aparecer">
        {PASOS[paso]}
      </span>
    </div>
  );
}

function Tabla({ respuesta }: { respuesta: Respuesta }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-borde">
      <table className="w-full border-collapse text-left text-sm sm:text-[15px]">
        <thead className="sticky top-0 bg-[#f1efe9]">
          <tr>
            {respuesta.columnas.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2.5 font-semibold sm:px-4 sm:py-3 text-texto">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {respuesta.filas.map((fila, i) => (
            <tr key={i} className="border-t border-borde odd:bg-white even:bg-[#fbfaf7]">
              {respuesta.columnas.map((c) => (
                <td
                  key={c}
                  className={`whitespace-nowrap px-3 py-2 sm:px-4 sm:py-2.5 ${typeof fila[c] === "number" ? "text-right tabular-nums" : ""}`}
                >
                  {formatearCelda(fila[c], c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {respuesta.total > respuesta.filas.length && (
        <p className="border-t border-borde px-4 py-2 text-sm text-texto-suave">
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

export function TarjetaRespuesta({ turno }: { turno: Turno }) {
  const [verConsulta, setVerConsulta] = useState(false);
  const respuesta = turno.respuesta;

  return (
    <article className="aparecer rounded-2xl border border-borde bg-superficie p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.08)] sm:rounded-3xl sm:p-9">
      <p className="text-sm font-medium text-texto-suave sm:text-[15px]">{turno.pregunta}</p>

      {turno.estado === "pensando" && (
        <div className="mt-4">
          <Pensando />
        </div>
      )}

      {turno.estado === "error" && <p className="mt-4 text-lg text-[#b4361f]">{turno.error}</p>}

      {turno.estado === "listo" && respuesta && (
        <div className="mt-3 space-y-5 sm:mt-4 sm:space-y-6">
          {respuesta.destacado && (
            <p className="aparecer break-words text-[2rem] font-semibold leading-tight tracking-tight text-acento-fuerte sm:text-6xl">
              {respuesta.destacado}
            </p>
          )}
          <p className="aparecer text-[17px] leading-relaxed text-texto sm:text-xl [animation-delay:0.08s]">{respuesta.respuesta}</p>
          <div className="aparecer [animation-delay:0.16s]">
            <Resultado respuesta={respuesta} />
          </div>
          {respuesta.sql && (
            <div>
              <button
                type="button"
                onClick={() => setVerConsulta((v) => !v)}
                className="text-sm text-texto-suave underline-offset-4 hover:underline"
              >
                {verConsulta ? "Ocultar cómo lo he calculado" : "Ver cómo lo he calculado"}
              </button>
              {verConsulta && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-[#1e1e1c] p-4 font-mono text-[13px] leading-relaxed text-[#e9e6dd]">
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
