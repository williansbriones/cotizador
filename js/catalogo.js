// catalogo.js
// -----------------------------------------------------------------------------
// CRUD del catálogo de precios base. El seed inicial vive en data/precios.json,
// pero una vez que el usuario edita algo, el catálogo se persiste en localStorage
// y esa versión guardada tiene prioridad sobre el seed.
// -----------------------------------------------------------------------------

import { CLAVES, guardar, leer, existe } from './storage.js';
import { formatoCLP, formatoMiles, parseNumero } from './formato.js';
import { toast, confirmar } from './ui.js';

// Categorías y unidades permitidas (fuente única de verdad para los <select>).
export const CATEGORIAS = ['Mano de obra', 'Materiales', 'Servicios/Trámites', 'Traslados', 'Otros'];
export const UNIDADES = ['hora', 'jornada', 'unidad', 'global', 'metro', 'km', 'visita'];

// Estado en memoria del catálogo.
let items = [];

/**
 * Carga el catálogo: usa la versión de localStorage si existe; si no, hace fetch
 * del seed data/precios.json, lo guarda y lo devuelve.
 * @returns {Promise<Array>}
 */
export async function cargarCatalogo() {
  if (existe(CLAVES.catalogo)) {
    items = leer(CLAVES.catalogo, []);
    return items;
  }
  try {
    const resp = await fetch('./data/precios.json');
    const seed = await resp.json();
    items = Array.isArray(seed.items) ? seed.items : [];
  } catch (e) {
    console.error('[catalogo] No se pudo cargar el seed', e);
    items = [];
  }
  persistir();
  return items;
}

/** Devuelve una copia del arreglo de ítems. */
export function getItems() {
  return items.slice();
}

/** Busca un ítem por id. */
export function getItem(id) {
  return items.find((i) => i.id === id) || null;
}

/** Guarda el estado actual del catálogo en localStorage. */
function persistir() {
  guardar(CLAVES.catalogo, items);
}

/**
 * Genera un id único a partir de una descripción (slug + sufijo si colisiona).
 */
function generarId(descripcion) {
  const base = String(descripcion || 'item')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita tildes/diacríticos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'item';
  let id = base;
  let n = 1;
  while (items.some((i) => i.id === id)) id = `${base}-${n++}`;
  return id;
}

/**
 * Agrega un nuevo ítem al catálogo.
 * @param {object} datos  { categoria, descripcion, unidad, precioUnitario, notas }
 * @returns {object} el ítem creado
 */
export function agregarItem(datos) {
  const item = {
    id: generarId(datos.descripcion),
    categoria: CATEGORIAS.includes(datos.categoria) ? datos.categoria : 'Otros',
    descripcion: String(datos.descripcion || '').trim() || 'Sin descripción',
    unidad: UNIDADES.includes(datos.unidad) ? datos.unidad : 'unidad',
    precioUnitario: Math.max(0, Number(datos.precioUnitario) || 0),
    notas: String(datos.notas || '').trim(),
  };
  items.push(item);
  persistir();
  return item;
}

/**
 * Actualiza campos de un ítem existente.
 * @param {string} id
 * @param {object} cambios
 * @returns {boolean}
 */
export function actualizarItem(id, cambios) {
  const item = items.find((i) => i.id === id);
  if (!item) return false;
  if (cambios.categoria != null && CATEGORIAS.includes(cambios.categoria)) item.categoria = cambios.categoria;
  if (cambios.unidad != null && UNIDADES.includes(cambios.unidad)) item.unidad = cambios.unidad;
  if (cambios.descripcion != null) item.descripcion = String(cambios.descripcion).trim() || item.descripcion;
  if (cambios.precioUnitario != null) item.precioUnitario = Math.max(0, Number(cambios.precioUnitario) || 0);
  if (cambios.notas != null) item.notas = String(cambios.notas).trim();
  persistir();
  return true;
}

/** Elimina un ítem por id. */
export function eliminarItem(id) {
  const antes = items.length;
  items = items.filter((i) => i.id !== id);
  if (items.length !== antes) {
    persistir();
    return true;
  }
  return false;
}

/**
 * Restaura el catálogo al seed original (data/precios.json), descartando ediciones.
 * @returns {Promise<Array>}
 */
export async function restaurarSeed() {
  try {
    const resp = await fetch('./data/precios.json');
    const seed = await resp.json();
    items = Array.isArray(seed.items) ? seed.items : [];
    persistir();
    return items;
  } catch (e) {
    console.error('[catalogo] No se pudo restaurar el seed', e);
    return items;
  }
}

/** Reemplaza el catálogo completo (usado por el importador de JSON). */
export function reemplazarCatalogo(nuevosItems) {
  if (!Array.isArray(nuevosItems)) return false;
  items = nuevosItems;
  persistir();
  return true;
}

// -----------------------------------------------------------------------------
// RENDER de la vista de catálogo (tabla editable inline).
// -----------------------------------------------------------------------------

/**
 * Dibuja la vista del catálogo dentro del contenedor dado.
 * @param {HTMLElement} contenedor
 */
export function renderVistaCatalogo(contenedor) {
  const filtro = { texto: '', categoria: '' };

  function filtrados() {
    return items.filter((i) => {
      const okCat = !filtro.categoria || i.categoria === filtro.categoria;
      const okTxt = !filtro.texto ||
        (i.descripcion + ' ' + i.notas).toLowerCase().includes(filtro.texto.toLowerCase());
      return okCat && okTxt;
    });
  }

  function dibujar() {
    const lista = filtrados();
    contenedor.innerHTML = `
      <div class="banner-aviso">
        ⚠️ <strong>Precios referenciales</strong> del mercado eléctrico chileno 2026.
        Valídalos con cotización de proveedor antes de enviar al cliente.
      </div>

      <div class="catalogo-toolbar">
        <input type="search" id="cat-buscar" class="input" placeholder="Buscar descripción…" value="${escapar(filtro.texto)}" />
        <select id="cat-filtro-cat" class="input">
          <option value="">Todas las categorías</option>
          ${CATEGORIAS.map((c) => `<option value="${c}" ${filtro.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <span class="catalogo-contador">${lista.length} de ${items.length} ítems</span>
        <div class="spacer"></div>
        <button class="btn btn-secundario" id="cat-restaurar" title="Volver a los precios del seed original">↺ Restaurar seed</button>
        <button class="btn btn-primario" id="cat-agregar">+ Nuevo ítem</button>
      </div>

      <div class="tabla-scroll">
        <table class="tabla-catalogo">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th class="col-num">Precio unitario (CLP)</th>
              <th>Notas</th>
              <th class="col-acc"></th>
            </tr>
          </thead>
          <tbody>
            ${lista.length === 0
              ? `<tr><td colspan="6" class="tabla-vacia">Sin ítems que coincidan.</td></tr>`
              : lista.map(filaHTML).join('')}
          </tbody>
        </table>
      </div>
    `;

    // --- Listeners de la toolbar ---
    contenedor.querySelector('#cat-buscar').addEventListener('input', (e) => {
      filtro.texto = e.target.value;
      dibujar();
      // reponer foco al campo de búsqueda
      const inp = contenedor.querySelector('#cat-buscar');
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    });
    contenedor.querySelector('#cat-filtro-cat').addEventListener('change', (e) => {
      filtro.categoria = e.target.value;
      dibujar();
    });
    contenedor.querySelector('#cat-agregar').addEventListener('click', abrirFilaNueva);
    contenedor.querySelector('#cat-restaurar').addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Restaurar catálogo',
        mensaje: 'Se descartarán TODAS tus ediciones y se volverá a los precios originales del seed. ¿Continuar?',
        textoConfirmar: 'Sí, restaurar',
        peligro: true,
      });
      if (ok) {
        await restaurarSeed();
        dibujar();
        toast('Catálogo restaurado al seed original.', 'exito');
      }
    });

    // --- Listeners de cada fila (edición inline) ---
    contenedor.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.getAttribute('data-id');

      tr.querySelectorAll('[data-campo]').forEach((campo) => {
        campo.addEventListener('change', () => guardarCampo(id, campo));
        if (campo.dataset.campo === 'precioUnitario') {
          // formatear miles al perder foco
          campo.addEventListener('focus', () => {
            campo.value = String(getItem(id)?.precioUnitario ?? '');
          });
          campo.addEventListener('blur', () => {
            campo.value = formatoMiles(getItem(id)?.precioUnitario);
          });
        }
      });

      tr.querySelector('[data-accion="eliminar"]').addEventListener('click', async () => {
        const item = getItem(id);
        const ok = await confirmar({
          titulo: 'Eliminar ítem',
          mensaje: `¿Eliminar "${item?.descripcion}" del catálogo?`,
          textoConfirmar: 'Eliminar',
          peligro: true,
        });
        if (ok) {
          eliminarItem(id);
          dibujar();
          toast('Ítem eliminado.', 'info');
        }
      });
    });
  }

  function filaHTML(i) {
    return `
      <tr data-id="${i.id}">
        <td>
          <select class="input input-sm" data-campo="categoria">
            ${CATEGORIAS.map((c) => `<option value="${c}" ${i.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td><input class="input input-sm" data-campo="descripcion" value="${escapar(i.descripcion)}" /></td>
        <td>
          <select class="input input-sm" data-campo="unidad">
            ${UNIDADES.map((u) => `<option value="${u}" ${i.unidad === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </td>
        <td class="col-num">
          <input class="input input-sm input-num" data-campo="precioUnitario" inputmode="numeric" value="${formatoMiles(i.precioUnitario)}" />
        </td>
        <td><input class="input input-sm" data-campo="notas" value="${escapar(i.notas)}" placeholder="—" /></td>
        <td class="col-acc">
          <button class="btn-icono btn-icono-peligro" data-accion="eliminar" title="Eliminar">🗑</button>
        </td>
      </tr>`;
  }

  function guardarCampo(id, campo) {
    const nombre = campo.dataset.campo;
    let valor = campo.value;
    if (nombre === 'precioUnitario') {
      const n = parseNumero(valor);
      if (!Number.isFinite(n) || n < 0) {
        toast('El precio debe ser un número no negativo.', 'error');
        campo.value = formatoMiles(getItem(id)?.precioUnitario);
        return;
      }
      valor = n;
    }
    actualizarItem(id, { [nombre]: valor });
    toast('Cambio guardado.', 'exito', 1500);
  }

  function abrirFilaNueva() {
    const nuevo = agregarItem({
      categoria: filtro.categoria || 'Materiales',
      descripcion: 'Nuevo ítem',
      unidad: 'unidad',
      precioUnitario: 0,
      notas: '',
    });
    filtro.texto = '';
    dibujar();
    // enfocar la descripción del nuevo ítem para editar de inmediato
    const fila = contenedor.querySelector(`tr[data-id="${nuevo.id}"]`);
    if (fila) {
      fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = fila.querySelector('[data-campo="descripcion"]');
      inp.focus();
      inp.select();
    }
    toast('Ítem agregado. Edítalo directamente en la tabla.', 'info');
  }

  dibujar();
}

/** Escapa texto para insertarlo en atributos HTML. */
function escapar(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Exporto formatoCLP re-exportado por conveniencia para otras vistas.
export { formatoCLP };
