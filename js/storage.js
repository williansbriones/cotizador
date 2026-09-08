// storage.js
// -----------------------------------------------------------------------------
// Wrapper de localStorage con prefijo único para evitar colisiones en
// github.io (donde el storage se comparte entre todos los proyectos del mismo
// usuario). Todas las claves usan el prefijo "calcelec_".
// -----------------------------------------------------------------------------

const PREFIJO = 'calcelec_';

/**
 * Claves usadas por la aplicación (centralizadas para no repetir strings).
 */
export const CLAVES = {
  catalogo: 'catalogo',
  cotizacionActual: 'cotizacion_actual',
  cotizacionesGuardadas: 'cotizaciones_guardadas',
  contador: 'contador_cotizacion',
  tema: 'tema',
};

/**
 * Guarda un valor (se serializa a JSON) bajo la clave dada.
 * @param {string} clave
 * @param {*} valor
 * @returns {boolean} true si se guardó
 */
export function guardar(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    console.error('[storage] No se pudo guardar', clave, e);
    return false;
  }
}

/**
 * Lee un valor y lo deserializa. Devuelve `porDefecto` si no existe o falla.
 * @param {string} clave
 * @param {*} porDefecto
 * @returns {*}
 */
export function leer(clave, porDefecto = null) {
  try {
    const raw = localStorage.getItem(PREFIJO + clave);
    if (raw == null) return porDefecto;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[storage] No se pudo leer', clave, e);
    return porDefecto;
  }
}

/**
 * Elimina una clave.
 * @param {string} clave
 */
export function borrar(clave) {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch (e) {
    console.error('[storage] No se pudo borrar', clave, e);
  }
}

/**
 * Devuelve true si la clave existe en storage.
 * @param {string} clave
 * @returns {boolean}
 */
export function existe(clave) {
  return localStorage.getItem(PREFIJO + clave) != null;
}

/**
 * Exporta TODA la configuración de la app (claves con el prefijo) como objeto,
 * para respaldo / traspaso a otro computador.
 * @returns {object}
 */
export function exportarTodo() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIJO)) {
      try {
        data[key.slice(PREFIJO.length)] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key.slice(PREFIJO.length)] = localStorage.getItem(key);
      }
    }
  }
  return data;
}

/**
 * Importa un objeto de configuración (el generado por exportarTodo).
 * @param {object} data
 * @returns {number} cantidad de claves importadas
 */
export function importarTodo(data) {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  for (const [clave, valor] of Object.entries(data)) {
    if (guardar(clave, valor)) n++;
  }
  return n;
}
