// cotizacion.js
// -----------------------------------------------------------------------------
// Estado y lógica de la COTIZACIÓN ACTUAL + render del constructor y el panel
// de totales. La cotización en curso se persiste en localStorage para no
// perderla al recargar.
// -----------------------------------------------------------------------------

import { CLAVES, guardar, leer } from './storage.js';
import { calcularTotales, subtotalLinea, validarParametros } from './calculos.js';
import { getItems, getItem, CATEGORIAS } from './catalogo.js';
import { formatoCLP, formatoMiles, parseNumero, hoyISO } from './formato.js';
import { toast, confirmar, pedirDatos } from './ui.js';
import { PLANTILLAS, getPlantilla } from './plantillas.js';
import { exportarExcel, exportarCSV, imprimir } from './exportar.js';

// Estado en memoria de la cotización actual.
let estado = null;

/** Genera un id corto para una línea. */
function nuevoIdLinea() {
  return 'l' + Math.random().toString(36).slice(2, 9);
}

/** Devuelve el siguiente número de cotización (autoincremental persistido). */
function siguienteNumero() {
  const actual = Number(leer(CLAVES.contador, 0)) || 0;
  return actual + 1;
}

/** Reserva/consume el número actual, incrementando el contador. */
function consumirNumero() {
  const n = siguienteNumero();
  guardar(CLAVES.contador, n);
  return n;
}

/** Estructura de una cotización nueva y vacía. */
export function cotizacionVacia() {
  return {
    cabecera: {
      numero: siguienteNumero(),
      fecha: hoyISO(),
      validezDias: 30,
      cliente: '',
      rut: '',
      direccion: '',
      contacto: '',
      emisor: '',
      condicionesPago: '50% anticipo, 50% contra entrega',
      plazoEjecucion: '',
      observaciones: '',
    },
    lineas: [],
    parametros: {
      descuentoGlobal: 0,
      margen: 20,
      imprevistos: 10,
      iva: 19,
      exentoIva: false,
    },
  };
}

/** Carga la cotización actual desde storage o crea una vacía. */
export function cargarCotizacion() {
  const guardada = leer(CLAVES.cotizacionActual, null);
  estado = guardada && guardada.cabecera ? guardada : cotizacionVacia();
  return estado;
}

/** Devuelve el estado actual (cargándolo si hace falta). */
export function getEstado() {
  if (!estado) cargarCotizacion();
  return estado;
}

/** Reemplaza el estado completo (usado por plantillas / cargar guardadas). */
export function setEstado(nuevo) {
  estado = nuevo;
  persistir();
}

/** Persiste la cotización actual. */
function persistir() {
  guardar(CLAVES.cotizacionActual, estado);
}

/** Inicia una cotización nueva, consumiendo el número autoincremental. */
export function nuevaCotizacion() {
  estado = cotizacionVacia();
  estado.cabecera.numero = consumirNumero();
  persistir();
  return estado;
}

// ---------- Operaciones sobre líneas ----------

/** Agrega una línea a partir de un ítem del catálogo. */
export function agregarLineaCatalogo(itemId) {
  const item = getItem(itemId);
  if (!item) return null;
  const linea = {
    id: nuevoIdLinea(),
    itemId: item.id,
    descripcion: item.descripcion,
    unidad: item.unidad,
    cantidad: 1,
    precioUnitario: item.precioUnitario,
    descuento: 0,
  };
  estado.lineas.push(linea);
  persistir();
  return linea;
}

/** Agrega una línea libre (escrita a mano). */
export function agregarLineaLibre() {
  const linea = {
    id: nuevoIdLinea(),
    itemId: null,
    descripcion: '',
    unidad: 'global',
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
  };
  estado.lineas.push(linea);
  persistir();
  return linea;
}

export function actualizarLinea(id, cambios) {
  const l = estado.lineas.find((x) => x.id === id);
  if (!l) return false;
  Object.assign(l, cambios);
  persistir();
  return true;
}

export function eliminarLinea(id) {
  estado.lineas = estado.lineas.filter((x) => x.id !== id);
  persistir();
}

/**
 * Reemplaza TODAS las líneas por las dadas (usado por las plantillas).
 * Recibe líneas parciales y les asigna un id nuevo y valores por defecto.
 * @param {Array} lineasParciales
 */
export function reemplazarLineas(lineasParciales) {
  estado.lineas = (lineasParciales || []).map((l) => ({
    id: nuevoIdLinea(),
    itemId: l.itemId ?? null,
    descripcion: l.descripcion ?? '',
    unidad: l.unidad ?? 'unidad',
    cantidad: Number(l.cantidad) || 0,
    precioUnitario: Number(l.precioUnitario) || 0,
    descuento: Number(l.descuento) || 0,
  }));
  persistir();
}

/** Mueve una línea hacia arriba (-1) o abajo (+1). */
export function moverLinea(id, dir) {
  const i = estado.lineas.findIndex((x) => x.id === id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= estado.lineas.length) return;
  [estado.lineas[i], estado.lineas[j]] = [estado.lineas[j], estado.lineas[i]];
  persistir();
}

export function setCabecera(campo, valor) {
  estado.cabecera[campo] = valor;
  persistir();
}

export function setParametro(campo, valor) {
  estado.parametros[campo] = valor;
  persistir();
}

/** Calcula los totales actuales (para exportar/mostrar). */
export function totalesActuales() {
  return calcularTotales(estado.lineas, estado.parametros);
}

// =============================================================================
// RENDER de la vista de cotización.
// =============================================================================

export function renderVistaCotizacion(contenedor) {
  if (!estado) cargarCotizacion();

  contenedor.innerHTML = `
    <div class="cotiz-layout">
      <div class="cotiz-main">
        ${bloquePlantillasHTML()}
        ${bloqueCabeceraHTML()}
        ${bloqueLineasHTML()}
      </div>
      <aside class="cotiz-panel" id="panel-totales"></aside>
    </div>
  `;

  wirePlantillas(contenedor);
  wireCabecera(contenedor);
  wireSelectorItems(contenedor);
  dibujarLineas(contenedor);
  dibujarTotales(contenedor);
}

// ---------- Plantillas ----------

function bloquePlantillasHTML() {
  return `
    <div class="tarjeta tarjeta-plantillas">
      <div class="tarjeta-titulo estatico">⚡ Plantillas de trabajo</div>
      <p class="plantillas-ayuda">Precargan una cotización tipo. Puedes editar todo después de aplicarla.</p>
      <div class="plantillas-botones">
        ${PLANTILLAS.map((p) => `
          <button class="btn btn-plantilla ${p.id === 'blanco' ? 'btn-secundario' : 'btn-primario'}"
            data-plantilla="${p.id}" title="${esc(p.descripcion)}">${esc(p.nombre)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function wirePlantillas(cont) {
  cont.querySelectorAll('[data-plantilla]').forEach((btn) => {
    btn.addEventListener('click', () => aplicarPlantilla(btn.dataset.plantilla, cont));
  });
}

async function aplicarPlantilla(id, cont) {
  const plantilla = getPlantilla(id);
  if (!plantilla) return;

  // Si hay líneas y no es la plantilla en blanco, confirmar reemplazo.
  if (estado.lineas.length > 0) {
    const ok = await confirmar({
      titulo: 'Aplicar plantilla',
      mensaje: `Se reemplazarán las ${estado.lineas.length} línea(s) actuales por la plantilla "${plantilla.nombre}". Los datos del cliente y los parámetros se conservan. ¿Continuar?`,
      textoConfirmar: 'Aplicar', peligro: true,
    });
    if (!ok) return;
  }

  // Pedir parámetros si la plantilla los requiere.
  let params = {};
  if (plantilla.requiere && plantilla.requiere.length) {
    const datos = await pedirDatos({
      titulo: plantilla.nombre,
      mensaje: 'Ingresa los datos para armar la cotización:',
      campos: plantilla.requiere,
      textoConfirmar: 'Generar',
    });
    if (datos == null) return; // canceló
    params = datos;
  }

  const lineas = plantilla.construir(params);
  reemplazarLineas(lineas);
  // Re-render completo de la vista (la tabla y totales cambian estructuralmente)
  renderVistaCotizacion(cont);
  toast(`Plantilla "${plantilla.nombre}" aplicada.`, 'exito');
}

// ---------- Cabecera ----------

function bloqueCabeceraHTML() {
  const c = estado.cabecera;
  return `
    <details class="tarjeta" open>
      <summary class="tarjeta-titulo">📄 Datos de la cotización</summary>
      <div class="grid-form">
        <label>N° cotización<input class="input" data-cab="numero" type="number" value="${c.numero}" /></label>
        <label>Fecha<input class="input" data-cab="fecha" type="date" value="${c.fecha}" /></label>
        <label>Validez (días)<input class="input" data-cab="validezDias" type="number" value="${c.validezDias}" /></label>
        <label>Cliente<input class="input" data-cab="cliente" value="${esc(c.cliente)}" placeholder="Nombre / razón social" /></label>
        <label>RUT<input class="input" data-cab="rut" value="${esc(c.rut)}" placeholder="12.345.678-9" /></label>
        <label>Contacto<input class="input" data-cab="contacto" value="${esc(c.contacto)}" placeholder="Nombre y teléfono" /></label>
        <label class="col-2">Dirección / faena<input class="input" data-cab="direccion" value="${esc(c.direccion)}" /></label>
        <label>Emisor<input class="input" data-cab="emisor" value="${esc(c.emisor)}" placeholder="Quien cotiza" /></label>
        <label>Plazo de ejecución<input class="input" data-cab="plazoEjecucion" value="${esc(c.plazoEjecucion)}" placeholder="ej: 5 días hábiles" /></label>
        <label class="col-2">Condiciones de pago<input class="input" data-cab="condicionesPago" value="${esc(c.condicionesPago)}" /></label>
        <label class="col-2">Observaciones<textarea class="input" data-cab="observaciones" rows="2">${esc(c.observaciones)}</textarea></label>
      </div>
    </details>
  `;
}

function wireCabecera(cont) {
  cont.querySelectorAll('[data-cab]').forEach((el) => {
    el.addEventListener('change', () => {
      const campo = el.dataset.cab;
      let v = el.value;
      if (campo === 'numero' || campo === 'validezDias') v = Number(v) || 0;
      setCabecera(campo, v);
    });
  });
}

// ---------- Selector de ítems + líneas ----------

function bloqueLineasHTML() {
  const items = getItems();
  const opciones = CATEGORIAS.map((cat) => {
    const delCat = items.filter((i) => i.categoria === cat);
    if (!delCat.length) return '';
    return `<optgroup label="${cat}">${delCat
      .map((i) => `<option value="${i.id}">${esc(i.descripcion)} — ${formatoCLP(i.precioUnitario)}/${i.unidad}</option>`)
      .join('')}</optgroup>`;
  }).join('');

  return `
    <div class="tarjeta">
      <div class="tarjeta-titulo estatico">🧾 Detalle de la cotización</div>
      <div class="selector-items">
        <select class="input" id="sel-item">
          <option value="">Selecciona un ítem del catálogo…</option>
          ${opciones}
        </select>
        <button class="btn btn-primario" id="btn-add-item">+ Agregar</button>
        <button class="btn btn-secundario" id="btn-add-libre">+ Línea libre</button>
      </div>
      <div class="tabla-scroll">
        <table class="tabla-lineas">
          <thead>
            <tr>
              <th class="col-ord"></th>
              <th>Descripción</th>
              <th>Unidad</th>
              <th class="col-num">Cant.</th>
              <th class="col-num">P. Unitario</th>
              <th class="col-num">Desc %</th>
              <th class="col-num">Subtotal</th>
              <th class="col-acc"></th>
            </tr>
          </thead>
          <tbody id="tbody-lineas"></tbody>
        </table>
      </div>
    </div>
  `;
}

function wireSelectorItems(cont) {
  cont.querySelector('#btn-add-item').addEventListener('click', () => {
    const sel = cont.querySelector('#sel-item');
    if (!sel.value) { toast('Selecciona un ítem primero.', 'aviso'); return; }
    agregarLineaCatalogo(sel.value);
    sel.value = '';
    dibujarLineas(cont);
    dibujarTotales(cont);
  });
  cont.querySelector('#btn-add-libre').addEventListener('click', () => {
    agregarLineaLibre();
    dibujarLineas(cont);
    dibujarTotales(cont);
    // enfocar la descripción de la nueva línea
    const filas = cont.querySelectorAll('#tbody-lineas tr');
    const ultima = filas[filas.length - 1];
    ultima?.querySelector('[data-linea="descripcion"]')?.focus();
  });
}

function dibujarLineas(cont) {
  const tbody = cont.querySelector('#tbody-lineas');
  if (!estado.lineas.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="tabla-vacia">Aún no hay líneas. Agrega ítems del catálogo o una línea libre.</td></tr>`;
    return;
  }
  tbody.innerHTML = estado.lineas.map((l, idx) => filaLineaHTML(l, idx)).join('');

  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = tr.getAttribute('data-id');

    tr.querySelectorAll('[data-linea]').forEach((el) => {
      const campo = el.dataset.linea;
      el.addEventListener('input', () => {
        let v = el.value;
        if (campo === 'cantidad' || campo === 'descuento') {
          v = parseNumero(v);
          if (!Number.isFinite(v)) v = 0;
        } else if (campo === 'precioUnitario') {
          v = parseNumero(v);
          if (!Number.isFinite(v)) v = 0;
        }
        actualizarLinea(id, { [campo]: v });
        actualizarSubtotalFila(tr, id);
        dibujarTotales(cont);
      });
    });

    // Formateo de miles del precio al perder foco
    const precioInp = tr.querySelector('[data-linea="precioUnitario"]');
    precioInp.addEventListener('focus', () => {
      const l = estado.lineas.find((x) => x.id === id);
      precioInp.value = String(l?.precioUnitario ?? '');
    });
    precioInp.addEventListener('blur', () => {
      const l = estado.lineas.find((x) => x.id === id);
      precioInp.value = formatoMiles(l?.precioUnitario);
    });

    tr.querySelector('[data-accion="subir"]').addEventListener('click', () => {
      moverLinea(id, -1); dibujarLineas(cont); dibujarTotales(cont);
    });
    tr.querySelector('[data-accion="bajar"]').addEventListener('click', () => {
      moverLinea(id, +1); dibujarLineas(cont); dibujarTotales(cont);
    });
    tr.querySelector('[data-accion="eliminar"]').addEventListener('click', () => {
      eliminarLinea(id); dibujarLineas(cont); dibujarTotales(cont);
    });
  });
}

function filaLineaHTML(l, idx) {
  const sub = subtotalLinea(l);
  const cantVacia = !l.cantidad || Number(l.cantidad) === 0;
  return `
    <tr data-id="${l.id}" class="${cantVacia ? 'fila-alerta' : ''}">
      <td class="col-ord">
        <button class="btn-icono btn-mini" data-accion="subir" title="Subir" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-icono btn-mini" data-accion="bajar" title="Bajar" ${idx === estado.lineas.length - 1 ? 'disabled' : ''}>▼</button>
      </td>
      <td><input class="input input-sm" data-linea="descripcion" value="${esc(l.descripcion)}" placeholder="Descripción" /></td>
      <td><input class="input input-sm input-unidad" data-linea="unidad" value="${esc(l.unidad)}" /></td>
      <td class="col-num"><input class="input input-sm input-num" data-linea="cantidad" inputmode="decimal" value="${l.cantidad}" /></td>
      <td class="col-num"><input class="input input-sm input-num" data-linea="precioUnitario" inputmode="numeric" value="${formatoMiles(l.precioUnitario)}" /></td>
      <td class="col-num"><input class="input input-sm input-num" data-linea="descuento" inputmode="numeric" value="${l.descuento || 0}" /></td>
      <td class="col-num celda-subtotal" data-subtotal>${formatoCLP(sub)}</td>
      <td class="col-acc"><button class="btn-icono btn-icono-peligro" data-accion="eliminar" title="Eliminar">🗑</button></td>
    </tr>`;
}

/** Actualiza sólo la celda de subtotal de una fila (sin redibujar toda la tabla). */
function actualizarSubtotalFila(tr, id) {
  const l = estado.lineas.find((x) => x.id === id);
  const celda = tr.querySelector('[data-subtotal]');
  if (celda && l) celda.textContent = formatoCLP(subtotalLinea(l));
  tr.classList.toggle('fila-alerta', !l.cantidad || Number(l.cantidad) === 0);
}

// ---------- Panel de totales ----------

function dibujarTotales(cont) {
  const panel = cont.querySelector('#panel-totales');
  const p = estado.parametros;
  const t = calcularTotales(estado.lineas, p);
  const avisos = validarParametros(p);

  panel.innerHTML = `
    <div class="panel-sticky">
      <h3 class="panel-titulo">Resumen</h3>

      <div class="panel-params">
        <label>Descuento global %
          <input class="input input-sm input-num" id="p-descGlobal" inputmode="numeric" value="${p.descuentoGlobal}" />
        </label>
        <label>Margen / utilidad %
          <input class="input input-sm input-num" id="p-margen" inputmode="numeric" value="${p.margen}" />
        </label>
        <label>Imprevistos %
          <input class="input input-sm input-num" id="p-imprev" inputmode="numeric" value="${p.imprevistos}" />
        </label>
        <label class="label-iva">IVA %
          <input class="input input-sm input-num" id="p-iva" inputmode="numeric" value="${p.iva}" ${p.exentoIva ? 'disabled' : ''} />
        </label>
        <label class="check-exento">
          <input type="checkbox" id="p-exento" ${p.exentoIva ? 'checked' : ''} /> Exento de IVA
        </label>
      </div>

      <div class="desglose">
        ${filaTotal('Neto', t.neto)}
        ${p.descuentoGlobal > 0 ? filaTotal(`− Descuento global (${t.parametros.descuentoGlobal}%)`, -t.descuentoGlobal, 'resta') : ''}
        ${p.descuentoGlobal > 0 ? filaTotal('Neto con descuento', t.netoConDescuento) : ''}
        ${filaTotal(`+ Margen (${t.parametros.margen}%)`, t.margen, 'suma')}
        ${filaTotal(`+ Imprevistos (${t.parametros.imprevistos}%)`, t.imprevistos, 'suma')}
        ${filaTotal('Base imponible', t.baseImponible, 'sub')}
        ${filaTotal(p.exentoIva ? 'IVA (exento)' : `+ IVA (${t.parametros.iva}%)`, t.iva, 'suma')}
        <div class="fila-total-final">
          <span>TOTAL</span><span>${formatoCLP(t.total)}</span>
        </div>
      </div>

      ${avisos.length ? `<div class="panel-avisos">${avisos.map((a) => `⚠️ ${esc(a)}`).join('<br>')}</div>` : ''}

      <div class="panel-exportar">
        <button class="btn btn-primario" id="btn-exp-excel">📊 Exportar a Excel</button>
        <div class="panel-exportar-fila">
          <button class="btn btn-secundario" id="btn-exp-csv">📄 CSV</button>
          <button class="btn btn-secundario" id="btn-imprimir">🖨 Imprimir / PDF</button>
        </div>
      </div>
      <div class="panel-acciones">
        <button class="btn btn-secundario" id="btn-nueva-cotiz">🗑 Vaciar</button>
      </div>
      <p class="panel-nota">Los montos se redondean a peso entero al final del cálculo.</p>
    </div>
  `;

  // Listeners de parámetros
  const bindParam = (sel, campo) => {
    const el = panel.querySelector(sel);
    el.addEventListener('input', () => {
      let v = parseNumero(el.value);
      if (!Number.isFinite(v)) v = 0;
      v = Math.min(100, Math.max(0, v));
      setParametro(campo, v);
      dibujarTotales(cont);
      panel.querySelector(sel)?.focus();
    });
  };
  bindParam('#p-descGlobal', 'descuentoGlobal');
  bindParam('#p-margen', 'margen');
  bindParam('#p-imprev', 'imprevistos');
  bindParam('#p-iva', 'iva');

  panel.querySelector('#p-exento').addEventListener('change', (e) => {
    setParametro('exentoIva', e.target.checked);
    dibujarTotales(cont);
  });

  // Exportaciones (validan que haya al menos una línea)
  const conLineas = (accion) => () => {
    if (!estado.lineas.length) { toast('Agrega al menos una línea antes de exportar.', 'aviso'); return; }
    accion(estado, calcularTotales(estado.lineas, estado.parametros));
  };
  panel.querySelector('#btn-exp-excel').addEventListener('click', conLineas(exportarExcel));
  panel.querySelector('#btn-exp-csv').addEventListener('click', conLineas(exportarCSV));
  panel.querySelector('#btn-imprimir').addEventListener('click', conLineas(imprimir));

  panel.querySelector('#btn-nueva-cotiz').addEventListener('click', () => {
    import('./ui.js').then(({ confirmar }) =>
      confirmar({
        titulo: 'Vaciar cotización',
        mensaje: 'Se limpiarán todas las líneas y datos de la cotización actual. ¿Continuar?',
        textoConfirmar: 'Vaciar', peligro: true,
      }).then((ok) => {
        if (ok) {
          nuevaCotizacion();
          renderVistaCotizacion(cont);
          toast('Cotización vaciada.', 'info');
        }
      })
    );
  });
}

function filaTotal(etiqueta, monto, clase = '') {
  return `<div class="fila-total ${clase}"><span>${etiqueta}</span><span>${formatoCLP(monto)}</span></div>`;
}

// Escapa texto para atributos/HTML.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
