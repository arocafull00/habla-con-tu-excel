const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PALABRAS_DINERO = /(importe|total|factur|base|gasto|margen|pendiente|venta|ingreso|cobr|deuda|precio|coste|€|euros|dinero|beneficio)/i;

export function esDinero(columna: string) {
  return PALABRAS_DINERO.test(columna) && !/(n[uú]mero|nº|cantidad|facturas$|n$)/i.test(columna);
}

export function formatearNumero(valor: number, dinero: boolean) {
  const texto = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: dinero ? (Math.abs(valor) >= 1000 ? 0 : 2) : 2,
    minimumFractionDigits: 0,
  }).format(valor);
  return dinero ? `${texto} €` : texto;
}

export function formatearEje(valor: number, dinero: boolean) {
  const abreviado =
    Math.abs(valor) >= 1_000_000
      ? `${(valor / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`
      : Math.abs(valor) >= 1000
        ? `${(valor / 1000).toLocaleString("es-ES", { maximumFractionDigits: 0 })} mil`
        : valor.toLocaleString("es-ES");
  return dinero ? `${abreviado} €` : abreviado;
}

export function formatearTexto(valor: string) {
  const mes = valor.match(/^(\d{4})-(\d{2})$/);
  if (mes) return `${MESES[Number(mes[2]) - 1]} ${mes[1]}`;
  const fecha = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fecha) return `${fecha[3]}/${fecha[2]}/${fecha[1]}`;
  return valor;
}

export function formatearCelda(valor: string | number | null, columna: string) {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "number") return formatearNumero(valor, esDinero(columna));
  return formatearTexto(valor);
}
