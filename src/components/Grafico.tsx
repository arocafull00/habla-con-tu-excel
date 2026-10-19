"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { esDinero, formatearEje, formatearNumero, formatearTexto } from "@/lib/formato";

type Fila = Record<string, string | number | null>;

const CONSULTA_MOVIL = "(max-width: 639px)";

function suscribir(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIL);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

function useMovil() {
  return useSyncExternalStore(suscribir, () => window.matchMedia(CONSULTA_MOVIL).matches, () => false);
}

type Props = {
  tipo: "barras" | "lineas";
  filas: Fila[];
  ejeX: string;
  ejeY: string;
};

export function Grafico({ tipo, filas, ejeX, ejeY }: Props) {
  const movil = useMovil();
  const dinero = esDinero(ejeY);
  const datos = filas.map((f) => ({
    x: typeof f[ejeX] === "string" ? formatearTexto(f[ejeX] as string) : String(f[ejeX] ?? ""),
    y: Number(f[ejeY] ?? 0),
  }));

  const tooltip = (
    <Tooltip
      cursor={{ fill: "rgba(15, 122, 77, 0.06)" }}
      contentStyle={{ borderRadius: 12, border: "1px solid var(--borde)", boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
      formatter={(valor) => [formatearNumero(Number(valor), dinero), ejeY]}
    />
  );

  if (tipo === "barras") {
    const alto = Math.max(movil ? 180 : 220, datos.length * (movil ? 36 : 44));
    const caracteres = Math.max(...datos.map((d) => d.x.length));
    const anchoEtiquetas = movil ? Math.min(120, caracteres * 7.5 + 18) : Math.min(220, caracteres * 8.5 + 12);
    return (
      <div style={{ height: alto }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 4, right: movil ? 78 : 96, bottom: 4, left: movil ? 0 : 8 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="x"
              width={anchoEtiquetas}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--texto)", fontSize: movil ? 13 : 15 }}
            />
            {tooltip}
            <Bar
              dataKey="y"
              fill="var(--acento)"
              radius={[0, 8, 8, 0]}
              barSize={movil ? 20 : 26}
              animationDuration={900}
              label={{
                position: "right",
                fill: "var(--texto)",
                fontSize: movil ? 12 : 14,
                fontWeight: 600,
                formatter: (valor: unknown) => formatearNumero(Number(valor), dinero),
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 12, right: movil ? 12 : 24, bottom: 4, left: movil ? 0 : 8 }}>
          <CartesianGrid stroke="var(--borde)" vertical={false} />
          <XAxis
            dataKey="x"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--texto-suave)", fontSize: movil ? 11 : 13 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={movil ? 52 : 80}
            tick={{ fill: "var(--texto-suave)", fontSize: movil ? 11 : 13 }}
            tickFormatter={(valor: number) => formatearEje(valor, dinero)}
          />
          {tooltip}
          <Line
            type="monotone"
            dataKey="y"
            stroke="var(--acento)"
            strokeWidth={3}
            dot={{ r: 3, fill: "var(--acento)" }}
            activeDot={{ r: 6 }}
            animationDuration={1100}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
