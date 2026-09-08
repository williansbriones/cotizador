// formato.js
// -----------------------------------------------------------------------------
// Utilidades de formateo para Chile: moneda CLP, fechas y RUT.
// Funciones puras, sin dependencias del DOM.
// -----------------------------------------------------------------------------

/**
 * Formatea un monto como pesos chilenos: $1.234.567 (punto como separador de miles).
 * @param {number} monto
 * @param {boolean} conSimbolo  si false, devuelve sólo el número formateado
 * @returns {string}
 */
export function formatoCLP(monto, conSimbolo = true) {
  const n = Number(monto);
  const valido = Number.isFinite(n) ? Math.round(n) : 0;
  const str = valido.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  return conSimbolo ? `$${str}` : str;
}

/**
 * Convierte texto escrito por el usuario a número, quitando puntos de miles,
 * símbolos de moneda y espacios. Acepta coma o punto decimal.
 * Ej: "$1.234.567" -> 1234567 ; "1.800" -> 1800 ; "12,5" -> 12.5
 * @param {string|number} texto
 * @returns {number} NaN si no se puede parsear
 */
export function parseNumero(texto) {
  if (typeof texto === 'number') return texto;
  if (texto == null) return NaN;
  let s = String(texto).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (s === '') return NaN;
  // Si tiene coma decimal (y no como separador de miles), la tratamos como punto.
  // Estrategia: quitar todos los puntos (miles) y cambiar la última coma por punto.
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Sólo puntos: si hay más de uno, o el último grupo no tiene 3 dígitos exactos,
    // asumimos que son separadores de miles y los quitamos.
    const partes = s.split('.');
    if (partes.length > 1) {
      const ultimo = partes[partes.length - 1];
      // Heurística: en CLP no hay decimales, así que los puntos son de miles.
      if (ultimo.length === 3 || partes.length > 2) {
        s = s.replace(/\./g, '');
      }
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Formatea un número para mostrarlo con separador de miles chileno (sin símbolo).
 * Usado en inputs al perder el foco. Devuelve '' si no es número válido.
 * @param {number} n
 * @returns {string}
 */
export function formatoMiles(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return Math.round(num).toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/**
 * Fecha ISO (YYYY-MM-DD) a formato chileno DD-MM-YYYY.
 * @param {string} iso
 * @returns {string}
 */
export function fechaChile(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-');
  if (!a || !m || !d) return iso;
  return `${d}-${m}-${a}`;
}

/**
 * Devuelve la fecha de hoy en formato ISO (YYYY-MM-DD), hora local.
 * @returns {string}
 */
export function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Formatea un RUT chileno: 12345678-9 -> 12.345.678-9
 * Acepta con o sin puntos/guion. No valida el dígito verificador, sólo formatea.
 * @param {string} rut
 * @returns {string}
 */
export function formatoRUT(rut) {
  if (!rut) return '';
  const limpio = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFmt}-${dv}`;
}

/**
 * Valida el dígito verificador de un RUT chileno (módulo 11).
 * @param {string} rut
 * @returns {boolean}
 */
export function validarRUT(rut) {
  if (!rut) return false;
  const limpio = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === dvEsperado;
}
