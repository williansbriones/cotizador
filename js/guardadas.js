// guardadas.js
// -----------------------------------------------------------------------------
// Gestión de cotizaciones guardadas (guardar/listar/cargar/duplicar/eliminar)
// y respaldo completo de la configuración (catálogo + cotizaciones) como JSON.
// -----------------------------------------------------------------------------

import { CLAVES, guardar, leer, exportarTodo, importarTodo } from './storage.js';
import { getEstado, setEstado } from './cotizacion.js';
import { calcularTotales } from './calculos.js';
import { formatoCLP, fechaChile } from './formato.js';
import { toast, confirmar, pedirDatos } from './ui.js';

/** Devuelve la lista de cotizaciones guardadas. */
export function listarGuardadas() {
  return leer(CLAVES.cotizacionesGuardadas, []);
}

function persistirLista(lista) {
  guardar(CLAVES.cotizacionesGuardadas, lista);
}

/** Copia profunda simple vía JSON. */
function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Guarda la cotización actual con un nombre. */
export function guardarActual(nombre) {
  const lista = listarGuardadas();
  const estado = clonar(getEstado());
  lista.push({
    id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nombre: nombre || `Cotización N° ${estado.cabecera.numero}`,
    guardadoEn: new Date().toISOString(),
    estado,
  });
  persistirLista(lista);
  return lista;
}

export function eliminarGuardada(id) {
  persistirLista(listarGuardadas().filter((g) => g.id !== id));
}

export function duplicarGuardada(id) {
  const lista = listarGuardadas();
  const orig = lista.find((g) => g.id === id);
  if (!orig) return;
  lista.push({
    ...clonar(orig),
    id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nombre: orig.nombre + ' (copia)',
    guardadoEn: new Date().toISOString(),
  });
  persistirLista(lista);
}

export function cargarGuardada(id) {
  const g = listarGuardadas().find((x) => x.id === id);
  if (!g) return false;
  setEstado(clonar(g.estado));
  return true;
}

// =============================================================================
// RENDER de la vista de guardadas.
// =============================================================================

/**
 * @param {HTMLElement} contenedor
 * @param {(vista:string)=>void} navegar  callback para cambiar de pestaña
 */
export function renderVistaGuardadas(contenedor, navegar) {
  function dibujar() {
    const lista = listarGuardadas();
    contenedor.innerHTML = `
      <div class="tarjeta">
        <div class="tarjeta-titulo estatico">💾 Guardar cotización actual</div>
        <p class="plantillas-ayuda">Guarda una copia de la cotización que tienes abierta para reutilizarla o duplicarla después.</p>
        <button class="btn btn-primario" id="btn-guardar-actual">💾 Guardar cotización actual</button>
      </div>

      <div class="tarjeta">
        <div class="tarjeta-titulo estatico">📁 Cotizaciones guardadas (${lista.length})</div>
        ${lista.length === 0
          ? `<p class="tabla-vacia">Aún no has guardado cotizaciones.</p>`
          : `<div class="tabla-scroll"><table class="tabla-catalogo tabla-guardadas">
              <thead><tr><th>Nombre</th><th>Cliente</th><th class="col-num">Total</th><th>Guardada</th><th class="col-acc-3"></th></tr></thead>
              <tbody>${lista.map(filaGuardadaHTML).join('')}</tbody>
            </table></div>`}
      </div>

      <div class="tarjeta">
        <div class="tarjeta-titulo estatico">🗄 Respaldo completo (catálogo + cotizaciones)</div>
        <p class="plantillas-ayuda">Exporta toda tu configuración a un archivo JSON para respaldo o para pasarla a otro computador. La importación reemplaza la configuración actual.</p>
        <div class="respaldo-botones">
          <button class="btn btn-secundario" id="btn-exp-json">⬇ Exportar todo (JSON)</button>
          <label class="btn btn-secundario btn-importar">⬆ Importar JSON
            <input type="file" id="file-import" accept="application/json,.json" hidden />
          </label>
        </div>
      </div>
    `;

    // --- Guardar actual ---
    contenedor.querySelector('#btn-guardar-actual').addEventListener('click', async () => {
      const est = getEstado();
      const datos = await pedirDatos({
        titulo: 'Guardar cotización',
        campos: [{ nombre: 'nombre', label: 'Nombre para identificarla', tipo: 'text',
          valor: est.cabecera.cliente ? `${est.cabecera.cliente} — N° ${est.cabecera.numero}` : `Cotización N° ${est.cabecera.numero}` }],
        textoConfirmar: 'Guardar',
      });
      if (datos == null) return;
      guardarActual(datos.nombre?.trim());
      dibujar();
      toast('Cotización guardada.', 'exito');
    });

    // --- Acciones por fila ---
    contenedor.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.getAttribute('data-id');
      tr.querySelector('[data-accion="cargar"]').addEventListener('click', () => {
        cargarGuardada(id);
        toast('Cotización cargada.', 'exito');
        navegar?.('cotizacion');
      });
      tr.querySelector('[data-accion="duplicar"]').addEventListener('click', () => {
        duplicarGuardada(id);
        dibujar();
        toast('Cotización duplicada.', 'info');
      });
      tr.querySelector('[data-accion="eliminar"]').addEventListener('click', async () => {
        const g = listarGuardadas().find((x) => x.id === id);
        const ok = await confirmar({
          titulo: 'Eliminar cotización guardada',
          mensaje: `¿Eliminar "${g?.nombre}"? Esto no afecta a la cotización que tienes abierta.`,
          textoConfirmar: 'Eliminar', peligro: true,
        });
        if (ok) { eliminarGuardada(id); dibujar(); toast('Cotización eliminada.', 'info'); }
      });
    });

    // --- Respaldo JSON ---
    contenedor.querySelector('#btn-exp-json').addEventListener('click', exportarJSON);
    contenedor.querySelector('#file-import').addEventListener('change', (e) => importarJSON(e, dibujar));
  }

  function filaGuardadaHTML(g) {
    const total = calcularTotales(g.estado.lineas, g.estado.parametros).total;
    const cliente = g.estado.cabecera.cliente || '—';
    const fecha = new Date(g.guardadoEn).toLocaleDateString('es-CL');
    return `
      <tr data-id="${g.id}">
        <td>${esc(g.nombre)}</td>
        <td>${esc(cliente)}</td>
        <td class="col-num celda-subtotal">${formatoCLP(total)}</td>
        <td>${fecha}</td>
        <td class="col-acc-3">
          <button class="btn-icono" data-accion="cargar" title="Cargar">📂</button>
          <button class="btn-icono" data-accion="duplicar" title="Duplicar">⧉</button>
          <button class="btn-icono btn-icono-peligro" data-accion="eliminar" title="Eliminar">🗑</button>
        </td>
      </tr>`;
  }

  dibujar();
}

// ---------- Respaldo JSON ----------

function exportarJSON() {
  const data = {
    _app: 'calculadora-cotizaciones-electricas',
    _exportadoEn: new Date().toISOString(),
    config: exportarTodo(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo_cotizaciones_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Respaldo JSON exportado.', 'exito');
}

async function importarJSON(evento, onListo) {
  const file = evento.target.files?.[0];
  evento.target.value = ''; // permitir reimportar el mismo archivo
  if (!file) return;

  const ok = await confirmar({
    titulo: 'Importar configuración',
    mensaje: 'Esto REEMPLAZARÁ tu catálogo y cotizaciones actuales por los del archivo. Se recomienda exportar un respaldo antes. ¿Continuar?',
    textoConfirmar: 'Importar', peligro: true,
  });
  if (!ok) return;

  try {
    const texto = await file.text();
    const data = JSON.parse(texto);
    const config = data.config || data; // acepta el formato con envoltorio o plano
    const n = importarTodo(config);
    toast(`Importadas ${n} claves. Recargando…`, 'exito');
    setTimeout(() => location.reload(), 900);
  } catch (e) {
    console.error('[guardadas] Error al importar JSON', e);
    toast('El archivo no es un JSON válido de respaldo.', 'error');
  }
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
