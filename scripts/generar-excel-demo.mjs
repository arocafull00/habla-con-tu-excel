import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

const SALIDA_DIR = "public/demo";
const SALIDA = `${SALIDA_DIR}/Facturacion_Instalaciones_Turia.xlsx`;
const HOY = new Date(Date.UTC(2026, 9, 19));
const INICIO = new Date(Date.UTC(2025, 0, 2));

let semilla = 20261019;
function azar() {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
}
const entre = (min, max) => min + azar() * (max - min);
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
function elegirPonderado(lista, pesos) {
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = azar() * total;
  for (let i = 0; i < lista.length; i++) {
    r -= pesos[i];
    if (r <= 0) return lista[i];
  }
  return lista[lista.length - 1];
}
const redondear = (n) => Math.round(n * 100) / 100;
const sumarDias = (fecha, dias) => new Date(fecha.getTime() + dias * 86400000);

const CLIENTES = [
  ["Hotel Marina Sol", "Hostelería", "Valencia"],
  ["Clínica Dental Ruzafa", "Salud", "Valencia"],
  ["Colegio Sant Vicent", "Educación", "Paterna"],
  ["Supermercados La Huerta", "Retail", "Torrent"],
  ["Estudio Arquitectura Cabanyal", "Servicios profesionales", "Valencia"],
  ["Residencia Los Naranjos", "Salud", "Alzira"],
  ["Gimnasio Turia Fit", "Deporte", "Valencia"],
  ["Logística Puerto Sur", "Logística", "Sagunto"],
  ["Restaurante El Palmar", "Hostelería", "Valencia"],
  ["Centro Médico Benimaclet", "Salud", "Valencia"],
  ["Academia Idiomas Albufera", "Educación", "Catarroja"],
  ["Talleres Mecánicos Ribera", "Industria", "Alzira"],
  ["Óptica Visión Clara", "Retail", "Gandia"],
  ["Hotel Playa Gandia", "Hostelería", "Gandia"],
  ["Coworking Ensanche", "Servicios profesionales", "Valencia"],
  ["Panadería Horno de Campanar", "Retail", "Valencia"],
  ["Clínica Fisio Mestalla", "Salud", "Valencia"],
  ["Asesoría Martí & Asociados", "Servicios profesionales", "Valencia"],
  ["Bodegas Requena Alta", "Industria", "Requena"],
  ["Farmacia Russafa 24h", "Salud", "Valencia"],
  ["Concesionario Motor Levante", "Retail", "Paterna"],
  ["Escuela Infantil Petits", "Educación", "Burjassot"],
  ["Cárnicas del Mediterráneo", "Industria", "Xàtiva"],
  ["Inmobiliaria Puerta del Mar", "Servicios profesionales", "Valencia"],
  ["Centro Comercial Arena Norte", "Retail", "Alboraia"],
  ["Hostal Ciutat Vella", "Hostelería", "Valencia"],
  ["Laboratorio Análisis Nou", "Salud", "Mislata"],
  ["Imprenta Gráficas Turia", "Industria", "Quart de Poblet"],
  ["Peluquería Studio Nueve", "Servicios profesionales", "Valencia"],
  ["Club de Tenis Valterna", "Deporte", "Paterna"],
  ["Distribuciones Agrícolas Sueca", "Logística", "Sueca"],
  ["Despacho Abogados Colón", "Servicios profesionales", "Valencia"],
  ["Heladería La Alquería", "Hostelería", "Alboraia"],
  ["Veterinaria Patitas", "Salud", "Torrent"],
  ["Colegio Mayor Blasco", "Educación", "Valencia"],
  ["Muebles Ebanistas Manises", "Industria", "Manises"],
  ["Tienda Deportes Cumbre", "Retail", "Valencia"],
  ["Cafetería La Lonja", "Hostelería", "Valencia"],
  ["Psicología Espacio Calma", "Salud", "Valencia"],
  ["Autoescuela Vía Verde", "Educación", "Torrent"],
  ["Frutas Hermanos Ferrer", "Logística", "Mercavalencia"],
  ["Spa Termal Bétera", "Deporte", "Bétera"],
  ["Ingeniería Proyectos Delta", "Servicios profesionales", "Paterna"],
  ["Pastelería Dulce Albaida", "Retail", "Ontinyent"],
  ["Residencia Universitaria Tarongers", "Educación", "Valencia"],
  ["Textil Llevant", "Industria", "Ontinyent"],
  ["Bar Restaurante Les Arts", "Hostelería", "Valencia"],
  ["Clínica Estética Lumen", "Salud", "Valencia"],
  ["Almacenes Frigoríficos Cullera", "Logística", "Cullera"],
  ["Librería Papel y Tinta", "Retail", "Valencia"],
];

const SERVICIOS = [
  { nombre: "Mantenimiento climatización", min: 180, max: 950, peso: 30 },
  { nombre: "Instalación aire acondicionado", min: 1800, max: 9500, peso: 12 },
  { nombre: "Instalación eléctrica", min: 900, max: 7800, peso: 14 },
  { nombre: "Reforma de local", min: 6500, max: 38000, peso: 4 },
  { nombre: "Contrato mantenimiento anual", min: 2400, max: 8600, peso: 6 },
  { nombre: "Revisión eficiencia energética", min: 450, max: 1900, peso: 9 },
  { nombre: "Reparación urgente", min: 120, max: 780, peso: 18 },
  { nombre: "Instalación placas solares", min: 7200, max: 26000, peso: 3 },
  { nombre: "Fontanería", min: 150, max: 2200, peso: 12 },
];

const COMERCIALES = ["Laura Gómez", "Marcos Ibáñez", "Sara Peris", "Javier Climent"];
const PESO_COMERCIAL = [34, 27, 24, 15];

const ESTACIONALIDAD = [0.85, 0.95, 1.05, 1.0, 1.1, 1.25, 1.15, 0.45, 1.05, 1.15, 1.1, 0.75];

const pesosCliente = CLIENTES.map((_, i) => 1 / Math.pow(i + 1, 0.9));

const facturas = [];
let numeroPorAño = { 2025: 0, 2026: 0 };
for (let dia = INICIO; dia <= HOY; dia = sumarDias(dia, 1)) {
  const diaSemana = dia.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) continue;
  const mes = dia.getUTCMonth();
  const año = dia.getUTCFullYear();
  const crecimiento = año === 2026 ? 1.18 : 1;
  const media = 5.2 * ESTACIONALIDAD[mes] * crecimiento;
  const cantidad = Math.max(0, Math.round(media + entre(-2.5, 2.5)));
  for (let k = 0; k < cantidad; k++) {
    const [cliente] = elegirPonderado(CLIENTES, pesosCliente);
    const servicio = elegirPonderado(SERVICIOS, SERVICIOS.map((s) => s.peso));
    const comercial = elegirPonderado(COMERCIALES, PESO_COMERCIAL);
    const base = redondear(entre(servicio.min, servicio.max) * (año === 2026 ? 1.04 : 1));
    const iva = redondear(base * 0.21);
    const total = redondear(base + iva);
    const vencimiento = sumarDias(dia, 30);
    const diasDesdeEmision = (HOY - dia) / 86400000;

    let estado = "Cobrada";
    let fechaCobro = sumarDias(dia, Math.round(entre(5, 40)));
    if (diasDesdeEmision < 30) {
      if (azar() < 0.55) {
        estado = "Pendiente";
        fechaCobro = null;
      }
    } else if (diasDesdeEmision < 75) {
      if (azar() < 0.12) {
        estado = "Vencida";
        fechaCobro = null;
      }
    } else if (azar() < 0.006) {
      estado = "Vencida";
      fechaCobro = null;
    }
    if (fechaCobro && fechaCobro > HOY) fechaCobro = sumarDias(HOY, -1);

    numeroPorAño[año] += 1;
    facturas.push({
      numero: `F-${año}-${String(numeroPorAño[año]).padStart(4, "0")}`,
      fecha: dia,
      cliente,
      comercial,
      servicio: servicio.nombre,
      base,
      iva,
      total,
      vencimiento,
      estado,
      fechaCobro,
    });
  }
}

const PROVEEDORES = [
  ["Suministros Eléctricos Levante", "Material"],
  ["Climatización Distribución SL", "Material"],
  ["Fontanería Mayorista Turia", "Material"],
  ["Subcontratas Montajes Ribera", "Subcontratas"],
  ["Grúas y Elevación Puerto", "Subcontratas"],
  ["Renting Furgonetas Plus", "Vehículos"],
  ["Gasolinera Autovía Norte", "Vehículos"],
  ["Gestoría Laboral Centro", "Servicios externos"],
  ["Software Gestión Obras", "Software"],
  ["Telefonía Empresa Total", "Oficina"],
  ["Papelería Oficina Express", "Oficina"],
  ["Seguros Mutua Profesional", "Seguros"],
];
const IMPORTE_GASTO = {
  Material: [300, 6500],
  Subcontratas: [800, 9000],
  Vehículos: [90, 1400],
  "Servicios externos": [180, 650],
  Software: [60, 420],
  Oficina: [40, 380],
  Seguros: [350, 1600],
};
const gastos = [];
for (let dia = INICIO; dia <= HOY; dia = sumarDias(dia, 1)) {
  const diaSemana = dia.getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) continue;
  const cantidad = Math.round(entre(3, 9) * ESTACIONALIDAD[dia.getUTCMonth()]);
  for (let k = 0; k < cantidad; k++) {
    const [proveedor, categoria] = elegir(PROVEEDORES);
    const [min, max] = IMPORTE_GASTO[categoria];
    gastos.push({ fecha: dia, proveedor, categoria, concepto: `${categoria} ${proveedor.split(" ")[0].toLowerCase()}`, importe: redondear(entre(min, max)) });
  }
}

const libro = new ExcelJS.Workbook();
libro.creator = "Administración Instalaciones Turia";
libro.created = HOY;

const VERDE = "FF1D6F42";
const formatoEuros = '#,##0.00 "€"';
const formatoFecha = "dd/mm/yyyy";

function estilizarCabecera(hoja, color = VERDE) {
  const fila = hoja.getRow(1);
  fila.height = 22;
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    celda.alignment = { vertical: "middle" };
  });
  hoja.views = [{ state: "frozen", ySplit: 1 }];
}

const hojaFacturas = libro.addWorksheet("Facturas", { properties: { tabColor: { argb: VERDE } } });
hojaFacturas.columns = [
  { header: "Nº Factura", key: "numero", width: 13 },
  { header: "Fecha", key: "fecha", width: 12, style: { numFmt: formatoFecha } },
  { header: "Cliente", key: "cliente", width: 34 },
  { header: "Comercial", key: "comercial", width: 16 },
  { header: "Servicio", key: "servicio", width: 30 },
  { header: "Base imponible", key: "base", width: 15, style: { numFmt: formatoEuros } },
  { header: "IVA", key: "iva", width: 12, style: { numFmt: formatoEuros } },
  { header: "Total", key: "total", width: 14, style: { numFmt: formatoEuros } },
  { header: "Vencimiento", key: "vencimiento", width: 13, style: { numFmt: formatoFecha } },
  { header: "Estado", key: "estado", width: 12 },
  { header: "Fecha cobro", key: "fechaCobro", width: 13, style: { numFmt: formatoFecha } },
];
facturas.forEach((f) => {
  const fila = hojaFacturas.addRow(f);
  const celdaEstado = fila.getCell("estado");
  const color = f.estado === "Cobrada" ? "FFE2F0D9" : f.estado === "Pendiente" ? "FFFFF2CC" : "FFF8CBAD";
  celdaEstado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
});
estilizarCabecera(hojaFacturas);
hojaFacturas.autoFilter = "A1:K1";

const hojaClientes = libro.addWorksheet("Clientes", { properties: { tabColor: { argb: "FF2F5597" } } });
hojaClientes.columns = [
  { header: "Cliente", key: "cliente", width: 34 },
  { header: "CIF", key: "cif", width: 12 },
  { header: "Sector", key: "sector", width: 24 },
  { header: "Población", key: "poblacion", width: 18 },
  { header: "Cliente desde", key: "alta", width: 14, style: { numFmt: formatoFecha } },
];
CLIENTES.forEach(([cliente, sector, poblacion], i) => {
  const alta = new Date(Date.UTC(2016 + (i % 9), Math.floor(entre(0, 12)), Math.floor(entre(1, 28))));
  hojaClientes.addRow({ cliente, cif: `B${String(Math.floor(entre(10000000, 99999999)))}`, sector, poblacion, alta });
});
estilizarCabecera(hojaClientes, "FF2F5597");

const hojaGastos = libro.addWorksheet("Gastos", { properties: { tabColor: { argb: "FFC55A11" } } });
hojaGastos.columns = [
  { header: "Fecha", key: "fecha", width: 12, style: { numFmt: formatoFecha } },
  { header: "Proveedor", key: "proveedor", width: 32 },
  { header: "Categoría", key: "categoria", width: 18 },
  { header: "Concepto", key: "concepto", width: 30 },
  { header: "Importe", key: "importe", width: 14, style: { numFmt: formatoEuros } },
];
gastos.forEach((g) => hojaGastos.addRow(g));
estilizarCabecera(hojaGastos, "FFC55A11");

const hojaResumen = libro.addWorksheet("Resumen", { properties: { tabColor: { argb: "FF7030A0" } } });
hojaResumen.columns = [
  { header: "Mes", key: "mes", width: 12, style: { numFmt: "mmm yyyy" } },
  { header: "Facturado (base)", key: "facturado", width: 18, style: { numFmt: formatoEuros } },
  { header: "Gastos", key: "gastos", width: 16, style: { numFmt: formatoEuros } },
  { header: "Margen", key: "margen", width: 16, style: { numFmt: formatoEuros } },
  { header: "Pendiente de cobro", key: "pendiente", width: 20, style: { numFmt: formatoEuros } },
];
const ultimaFactura = facturas.length + 1;
const ultimoGasto = gastos.length + 1;
for (let m = new Date(INICIO.getTime()); m <= HOY; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
  const inicioMes = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1));
  const finMes = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
  const delMes = (f) => f.fecha >= inicioMes && f.fecha < finMes;
  const facturado = redondear(facturas.filter(delMes).reduce((a, f) => a + f.base, 0));
  const gastado = redondear(gastos.filter(delMes).reduce((a, g) => a + g.importe, 0));
  const pendiente = redondear(facturas.filter((f) => delMes(f) && f.estado !== "Cobrada").reduce((a, f) => a + f.total, 0));
  const fila = hojaResumen.rowCount + 1;
  hojaResumen.addRow({
    mes: inicioMes,
    facturado: {
      formula: `SUMIFS(Facturas!$F$2:$F$${ultimaFactura},Facturas!$B$2:$B$${ultimaFactura},">="&A${fila},Facturas!$B$2:$B$${ultimaFactura},"<"&EDATE(A${fila},1))`,
      result: facturado,
    },
    gastos: {
      formula: `SUMIFS(Gastos!$E$2:$E$${ultimoGasto},Gastos!$A$2:$A$${ultimoGasto},">="&A${fila},Gastos!$A$2:$A$${ultimoGasto},"<"&EDATE(A${fila},1))`,
      result: gastado,
    },
    margen: { formula: `IFERROR(B${fila}-C${fila},0)`, result: redondear(facturado - gastado) },
    pendiente: pendiente === 0 ? 0 : {
      formula: `SUMIFS(Facturas!$H$2:$H$${ultimaFactura},Facturas!$B$2:$B$${ultimaFactura},">="&A${fila},Facturas!$B$2:$B$${ultimaFactura},"<"&EDATE(A${fila},1),Facturas!$J$2:$J$${ultimaFactura},"<>Cobrada")`,
      result: pendiente,
    },
  });
}
estilizarCabecera(hojaResumen, "FF7030A0");

mkdirSync(SALIDA_DIR, { recursive: true });
await libro.xlsx.writeFile(SALIDA);

const sinCobrar = facturas.filter((f) => f.estado !== "Cobrada");
console.log(`Facturas: ${facturas.length} · Gastos: ${gastos.length} · Clientes: ${CLIENTES.length}`);
console.log(`Sin cobrar: ${sinCobrar.length} (vencidas: ${sinCobrar.filter((f) => f.estado === "Vencida").length})`);
console.log(`Guardado en ${SALIDA}`);
