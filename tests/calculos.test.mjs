// Tests de calculos.js — runner minimalista sin dependencias.
// Ejecutar con:  node tests/calculos.test.mjs
import {
  redondearPeso,
  fraccionPorcentaje,
  subtotalLinea,
  subtotalNeto,
  calcularTotales,
  validarLinea,
  validarParametros,
} from '../js/calculos.js';

let pasados = 0;
let fallidos = 0;

function assert(nombre, condicion, extra = '') {
  if (condicion) {
    pasados++;
    console.log(`  \x1b[32m✓\x1b[0m ${nombre}`);
  } else {
    fallidos++;
    console.log(`  \x1b[31m✗\x1b[0m ${nombre}  ${extra}`);
  }
}
function eq(nombre, a, b) {
  assert(nombre, a === b, `esperado ${b}, obtuvo ${a}`);
}

console.log('\n== redondearPeso ==');
eq('redondea 100.4 -> 100', redondearPeso(100.4), 100);
eq('redondea 100.5 -> 101', redondearPeso(100.5), 101);
eq('NaN -> 0', redondearPeso(NaN), 0);

console.log('\n== fraccionPorcentaje ==');
eq('20 -> 0.2', fraccionPorcentaje(20), 0.2);
eq('recorta 150 -> 1', fraccionPorcentaje(150), 1);
eq('recorta -5 -> 0', fraccionPorcentaje(-5), 0);

console.log('\n== subtotalLinea ==');
eq('2 × 25000 sin desc', subtotalLinea({ cantidad: 2, precioUnitario: 25000 }), 50000);
eq('2 × 25000 con 10% desc', subtotalLinea({ cantidad: 2, precioUnitario: 25000, descuento: 10 }), 45000);
eq('cantidad negativa -> 0', subtotalLinea({ cantidad: -3, precioUnitario: 100 }), 0);

console.log('\n== subtotalNeto ==');
eq('suma dos líneas', subtotalNeto([
  { cantidad: 1, precioUnitario: 60000 },
  { cantidad: 2, precioUnitario: 8000 },
]), 76000);
eq('array vacío -> 0', subtotalNeto([]), 0);
eq('no-array -> 0', subtotalNeto(null), 0);

console.log('\n== calcularTotales (caso completo) ==');
// neto = 100.000; desc global 10% -> 90.000; margen 20% -> 108.000;
// imprevistos 10% -> 118.800; IVA 19% -> 22.572; total -> 141.372
const t = calcularTotales([{ cantidad: 1, precioUnitario: 100000 }], {
  descuentoGlobal: 10, margen: 20, imprevistos: 10, iva: 19,
});
eq('neto', t.neto, 100000);
eq('descuentoGlobal', t.descuentoGlobal, 10000);
eq('netoConDescuento', t.netoConDescuento, 90000);
eq('margen', t.margen, 18000);
eq('baseConMargen', t.baseConMargen, 108000);
eq('imprevistos', t.imprevistos, 10800);
eq('baseImponible', t.baseImponible, 118800);
eq('iva', t.iva, 22572);
eq('total', t.total, 141372);

console.log('\n== calcularTotales (exento de IVA) ==');
const te = calcularTotales([{ cantidad: 1, precioUnitario: 100000 }], {
  descuentoGlobal: 0, margen: 0, imprevistos: 0, exentoIva: true,
});
eq('iva exento = 0', te.iva, 0);
eq('total sin iva', te.total, 100000);

console.log('\n== calcularTotales (defaults margen 20 / imprev 10 / iva 19) ==');
// neto 100.000 -> margen 20% 120.000 -> imprev 10% 132.000 -> IVA 19% 25.080 -> 157.080
const td = calcularTotales([{ cantidad: 1, precioUnitario: 100000 }], {});
eq('total con defaults', td.total, 157080);

console.log('\n== redondeo sólo al final (no intermedio) ==');
// 3 × 333.33... nunca ocurre acá, probamos que fracciones no se pierden a mitad
// neto = 3 líneas de 1 × 33.333 = 99.999 exacto; con IVA 19% = 118.998.81 -> 118.999
const tr = calcularTotales([
  { cantidad: 1, precioUnitario: 33333 },
  { cantidad: 1, precioUnitario: 33333 },
  { cantidad: 1, precioUnitario: 33333 },
], { descuentoGlobal: 0, margen: 0, imprevistos: 0, iva: 19 });
eq('neto 99.999', tr.neto, 99999);
eq('total redondeado al final', tr.total, 118999);

console.log('\n== validarLinea ==');
assert('línea válida sin errores', validarLinea({ cantidad: 2, precioUnitario: 100, descuento: 0 }).length === 0);
assert('cantidad negativa detectada', validarLinea({ cantidad: -1, precioUnitario: 100 }).length > 0);
assert('precio negativo detectado', validarLinea({ cantidad: 1, precioUnitario: -5 }).length > 0);
assert('descuento >100 detectado', validarLinea({ cantidad: 1, precioUnitario: 5, descuento: 150 }).length > 0);

console.log('\n== validarParametros ==');
assert('margen 0 avisa', validarParametros({ margen: 0 }).some((m) => m.includes('margen')));
assert('porcentaje fuera de rango avisa', validarParametros({ iva: 200 }).length > 0);

console.log(`\n${'='.repeat(40)}`);
console.log(`Resultado: \x1b[32m${pasados} pasados\x1b[0m, ${fallidos ? '\x1b[31m' : ''}${fallidos} fallidos\x1b[0m`);
console.log('='.repeat(40));
process.exit(fallidos ? 1 : 0);
