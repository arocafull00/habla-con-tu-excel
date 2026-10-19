# Habla con tu Excel

Arrastra un Excel y pregúntale en lenguaje natural: "¿Qué cliente nos ha dejado más dinero este año?", "¿Qué meses vendemos menos?", "¿Qué facturas siguen sin cobrar?". Responde con la cifra, una frase y un gráfico o una tabla.

## Cómo funciona

1. El Excel (`.xlsx` o `.csv`) se lee en el servidor y cada hoja se carga como una tabla en una base SQLite en memoria (`node:sqlite`).
2. Al modelo de IA (vía [OpenRouter](https://openrouter.ai)) solo se le envía la estructura: nombres de columnas, tipos, rangos y algunos valores de ejemplo, nunca el Excel completo. Sí ve los resultados de las consultas que hace.
3. El modelo escribe consultas SQL de solo lectura, las comprueba y elige cómo mostrar el resultado (cifra, barras, líneas o tabla).
4. La consulta final se ejecuta en local y el resultado se pinta en la interfaz.

## Puesta en marcha

Requiere Node.js 22.13 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local   # y pon tu OPENROUTER_API_KEY
pnpm dev
```

El modelo se elige con `OPENROUTER_MODEL`. Por defecto usa uno gratuito (`:free`), que tiene límite de peticiones diarias y cuyos proveedores pueden usar los datos para entrenar. Para datos reales de clientes, usa un modelo de pago.

Abre http://localhost:3000 y pulsa "Prueba con un Excel de ejemplo".

## Excel de demo

`public/demo/Facturacion_Instalaciones_Turia.xlsx` es una empresa ficticia de instalaciones de Valencia: 2.631 facturas, 2.840 gastos, 50 clientes y una hoja de resumen con fórmulas `SUMIFS`. Los datos son inventados y se regeneran con:

```bash
node scripts/generar-excel-demo.mjs
```
