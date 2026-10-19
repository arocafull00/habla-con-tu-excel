"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
      cursor={tipo === "barras" ? { fill: "var(--acento-suave)" } : { stroke: "var(--borde-fuerte)" }}
      contentStyle={{ borderRadius: 8, border: "1px solid var(--borde-fuerte)", boxShadow: "0 4px 8px oklch(0 0 0 / 0.06)", padding: "8px 12px" }}
      labelStyle={{ color: "var(--texto-suave)", fontSize: 13, marginBottom: 2 }}
      itemStyle={{ color: "var(--texto)", fontWeight: 600, padding: 0 }}
      formatter={(valor) => [formatearNumero(Number(valor), dinero), ejeY]}
    />
  );

  if (tipo === "barras") {
    const maximo = Math.max(...datos.map((d) => d.y));
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
              radius={[0, 4, 4, 0]}
              barSize={movil ? 20 : 24}
              animationDuration={600}
              label={{
                position: "right",
                fill: "var(--texto)",
                fontSize: movil ? 12 : 14,
                fontWeight: 600,
                formatter: (valor: unknown) => formatearNumero(Number(valor), dinero),
              }}
            >
              {datos.map((d, i) => (
                <Cell key={i} fill={d.y === maximo ? "var(--acento)" : "var(--acento-tenue)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 12, right: movil ? 12 : 24, bottom: 4, left: movil ? 0 : 8 }}>
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
          <defs>
            <linearGradient id="relleno-linea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--acento)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--acento)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="y"
            stroke="var(--acento)"
            strokeWidth={2.5}
            fill="url(#relleno-linea)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--superficie)" }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
