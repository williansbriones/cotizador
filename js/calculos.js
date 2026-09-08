// calculos.js
// -----------------------------------------------------------------------------
// Funciones PURAS de cálculo para la cotización.
// No dependen del DOM ni de localStorage: reciben datos, devuelven datos.
// Esto las hace fáciles de testear (ver tests/calculos.test.mjs).
//
// Regla de redondeo: se trabaja con números en punto flotante durante todo el
// cálculo y sólo se redondea a PESO ENTERO al final (o cuando se necesita
// mostrar un valor). Nunca se redondea en pasos intermedios, para evitar la
// acumulación de errores de redondeo.
// -----------------------------------------------------------------------------

/**
 * Redondea un monto a peso entero (CLP no admite decimales).
 * @param {number} monto
 * @returns {number} entero
 */
export function redondearPeso(monto) {
  if (!Number.isFinite(monto)) return 0;
  return Math.round(monto);
}

/**
 * Normaliza un porcentaje a la fracción [0..1] que se usa para multiplicar.
 * Acepta valores fuera de rango y los recorta a [0, 100] por seguridad.
 * @param {number} porcentaje  ej: 20 -> 0.20
 * @returns {number} fracción entre 0 y 1
 */
export function fraccionPorcentaje(porcentaje) {
  const p = Number(porcentaje);
  if (!Number.isFinite(p)) return 0;
  const recortado = Math.min(100, Math.max(0, p));
  return recortado / 100;
}

/**
 * Subtotal de una línea, SIN redondear.
 * subtotal = cantidad × precioUnitario × (1 − descuentoLinea%)
 * @param {{cantidad:number, precioUnitario:number, descuento?:number}} linea
 * @returns {number} subtotal en punto flotante
 */
export function subtotalLinea(linea) {
  const cantidad = Math.max(0, Number(linea?.cantidad) || 0);
  const precio = Math.max(0, Number(linea?.precioUnitario) || 0);
  const descFrac = fraccionPorcentaje(linea?.descuento || 0);
  return cantidad * precio * (1 - descFrac);
}

/**
 * Suma de todos los subtotales de línea (neto), SIN redondear.
 * @param {Array} lineas
 * @returns {number} neto en punto flotante
 */
export function subtotalNeto(lineas) {
  if (!Array.isArray(lineas)) return 0;
  return lineas.reduce((acc, l) => acc + subtotalLinea(l), 0);
}

/**
 * Calcula el desglose COMPLETO de totales de la cotización.
 *
 * Orden de aplicación (todo sobre valores sin redondear):
 *   1. neto            = Σ subtotales de línea
 *   2. descuentoGlobal = neto × descGlobal%
 *      netoConDescuento = neto − descuentoGlobal
 *   3. margen          = netoConDescuento × margen%
 *      baseConMargen    = netoConDescuento + margen
 *   4. imprevistos     = baseConMargen × imprevistos%
 *      baseImponible    = baseConMargen + imprevistos
 *   5. iva             = baseImponible × iva%   (0 si exento)
 *   6. total           = baseImponible + iva
 *
 * @param {Array} lineas
 * @param {object} params
 * @param {number} params.descuentoGlobal  % (0-100)
 * @param {number} params.margen           % (0-100), default 20
 * @param {number} params.imprevistos      % (0-100), default 10
 * @param {number} params.iva              % (default 19)
 * @param {boolean} params.exentoIva        si true, IVA = 0
 * @returns {object} desglose con todos los montos redondeados a peso entero
 */
export function calcularTotales(lineas, params = {}) {
  const descGlobalFrac = fraccionPorcentaje(params.descuentoGlobal ?? 0);
  const margenFrac = fraccionPorcentaje(params.margen ?? 20);
  const imprevFrac = fraccionPorcentaje(params.imprevistos ?? 10);
  const ivaFrac = params.exentoIva ? 0 : fraccionPorcentaje(params.iva ?? 19);

  // Cálculo en punto flotante (sin redondear intermedio)
  const neto = subtotalNeto(lineas);
  const descuentoGlobal = neto * descGlobalFrac;
  const netoConDescuento = neto - descuentoGlobal;
  const margen = netoConDescuento * margenFrac;
  const baseConMargen = netoConDescuento + margen;
  const imprevistos = baseConMargen * imprevFrac;
  const baseImponible = baseConMargen + imprevistos;
  const iva = baseImponible * ivaFrac;
  const total = baseImponible + iva;

  // Redondeo a peso entero SÓLO al final, para cada valor que se mostrará
  return {
    neto: redondearPeso(neto),
    descuentoGlobal: redondearPeso(descuentoGlobal),
    netoConDescuento: redondearPeso(netoConDescuento),
    margen: redondearPeso(margen),
    baseConMargen: redondearPeso(baseConMargen),
    imprevistos: redondearPeso(imprevistos),
    baseImponible: redondearPeso(baseImponible),
    iva: redondearPeso(iva),
    total: redondearPeso(total),
    // Porcentajes efectivamente usados (para trazabilidad / hoja de detalle)
    parametros: {
      descuentoGlobal: descGlobalFrac * 100,
      margen: margenFrac * 100,
      imprevistos: imprevFrac * 100,
      iva: ivaFrac * 100,
      exentoIva: !!params.exentoIva,
    },
  };
}

/**
 * Valida una línea de cotización. Devuelve lista de mensajes de error (vacía si OK).
 * @param {object} linea
 * @returns {string[]}
 */
export function validarLinea(linea) {
  const errores = [];
  const cantidad = Number(linea?.cantidad);
  const precio = Number(linea?.precioUnitario);
  const desc = Number(linea?.descuento || 0);

  if (!Number.isFinite(cantidad) || cantidad < 0) errores.push('La cantidad no puede ser negativa.');
  if (cantidad === 0) errores.push('La línea tiene cantidad 0.');
  if (!Number.isFinite(precio) || precio < 0) errores.push('El precio no puede ser negativo.');
  if (!Number.isFinite(desc) || desc < 0 || desc > 100) errores.push('El descuento de línea debe estar entre 0 y 100%.');
  return errores;
}

/**
 * Valida los parámetros globales de la cotización.
 * @param {object} params
 * @returns {string[]} avisos (no bloqueantes) y errores
 */
export function validarParametros(params = {}) {
  const avisos = [];
  const pct = (v) => Number(v);
  for (const [nombre, valor] of Object.entries({
    'descuento global': params.descuentoGlobal,
    margen: params.margen,
    imprevistos: params.imprevistos,
    IVA: params.iva,
  })) {
    const v = pct(valor);
    if (valor != null && (!Number.isFinite(v) || v < 0 || v > 100)) {
      avisos.push(`El porcentaje de ${nombre} debe estar entre 0 y 100.`);
    }
  }
  if (Number(params.margen) === 0) avisos.push('El margen/utilidad está en 0%: no habría ganancia.');
  return avisos;
}
