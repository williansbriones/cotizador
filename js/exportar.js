// exportar.js
// -----------------------------------------------------------------------------
// Exportación de la cotización a Excel (.xlsx con estilos), CSV e impresión/PDF.
// Usa el global XLSX provisto por xlsx-js-style (cargado por CDN en index.html).
// Recibe el estado y los totales ya calculados; no depende del estado interno
// de cotizacion.js (evita imports circulares).
// -----------------------------------------------------------------------------

import { subtotalLinea } from './calculos.js';
import { formatoCLP, formatoMiles, fechaChile } from './formato.js';
import { toast } from './ui.js';

// --- Paleta y estilos para el Excel ---
const AZUL = '2563EB';
const GRIS_CLARO = 'F1F5F9';
const GRIS_BORDE = 'CBD5E1';
const NUM_FMT = '#,##0';

const bordeFino = { style: 'thin', color: { rgb: GRIS_BORDE } };
const bordesCaja = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };

const estiloTitulo = { font: { bold: true, sz: 16, color: { rgb: '0F172A' } } };
const estiloEtiqueta = { font: { bold: true, sz: 10, color: { rgb: '475569' } } };
const estiloValor = { font: { sz: 10 } };
const estiloTh = {
  font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: AZUL } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: bordesCaja,
};
const estiloCelda = { font: { sz: 10 }, border: bordesCaja, alignment: { vertical: 'center' } };
const estiloNum = { ...estiloCelda, numFmt: NUM_FMT, alignment: { horizontal: 'right', vertical: 'center' } };
const estiloTotalLbl = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right' } };
const estiloTotalNum = { font: { bold: true, sz: 10 }, numFmt: NUM_FMT, alignment: { horizontal: 'right' } };
const estiloTotalFinal = {
  font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: AZUL } },
  numFmt: NUM_FMT,
  alignment: { horizontal: 'right' },
};

/** Genera el nombre de archivo: Cotizacion_{n}_{cliente}_{YYYY-MM-DD}. */
export function nombreArchivo(estado, extension) {
  const n = estado.cabecera.numero || 0;
  const cliente = (estado.cabecera.cliente || 'SinCliente')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'SinCliente';
  const fecha = estado.cabecera.fecha || new Date().toISOString().slice(0, 10);
  return `Cotizacion_${n}_${cliente}_${fecha}.${extension}`;
}

// =============================================================================
// EXCEL
// =============================================================================

export function exportarExcel(estado, totales) {
  if (typeof XLSX === 'undefined') {
    toast('No se pudo cargar la librería de Excel (sin conexión al CDN).', 'error');
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaCotizacion(estado, totales), 'Cotización');
  XLSX.utils.book_append_sheet(wb, hojaDetalle(estado, totales), 'Detalle de cálculo');
  XLSX.writeFile(wb, nombreArchivo(estado, 'xlsx'));
  toast('Excel generado.', 'exito');
}

/** Construye la hoja 1 "Cotización". */
function hojaCotizacion(estado, t) {
  const c = estado.cabecera;
  const filas = [];
  const estilos = {}; // "R,C" -> estilo

  const set = (r, col, v, estilo) => {
    if (!filas[r]) filas[r] = [];
    filas[r][col] = v;
    if (estilo) estilos[`${r},${col}`] = estilo;
  };

  let r = 0;
  set(r, 0, `COTIZACIÓN N° ${c.numero}`, estiloTitulo); r += 2;

  // Bloque de datos (dos columnas de pares etiqueta/valor)
  const pares = [
    ['Cliente', c.cliente], ['Fecha', fechaChile(c.fecha)],
    ['RUT', c.rut], ['Validez', `${c.validezDias} días`],
    ['Dirección / faena', c.direccion], ['Contacto', c.contacto],
    ['Emisor', c.emisor], ['Plazo de ejecución', c.plazoEjecucion],
    ['Condiciones de pago', c.condicionesPago], ['', ''],
  ];
  for (let i = 0; i < pares.length; i += 2) {
    set(r, 0, pares[i][0], estiloEtiqueta);
    set(r, 1, pares[i][1] || '', estiloValor);
    if (pares[i + 1] && pares[i + 1][0]) {
      set(r, 4, pares[i + 1][0], estiloEtiqueta);
      set(r, 5, pares[i + 1][1] || '', estiloValor);
    }
    r++;
  }
  r++;

  // Encabezado de la tabla
  const encabezados = ['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'P. Unitario', 'Desc %', 'Subtotal'];
  encabezados.forEach((h, col) => set(r, col, h, estiloTh));
  const filaEncabezado = r;
  r++;

  // Líneas
  estado.lineas.forEach((l, idx) => {
    set(r, 0, idx + 1, { ...estiloCelda, alignment: { horizontal: 'center' } });
    set(r, 1, l.descripcion, estiloCelda);
    set(r, 2, l.unidad, { ...estiloCelda, alignment: { horizontal: 'center' } });
    set(r, 3, Number(l.cantidad) || 0, estiloNum);
    set(r, 4, Number(l.precioUnitario) || 0, estiloNum);
    set(r, 5, Number(l.descuento) || 0, { ...estiloNum });
    set(r, 6, Math.round(subtotalLinea(l)), estiloNum);
    r++;
  });
  r++;

  // Bloque de totales (etiqueta en col 5, valor en col 6)
  const totFilas = [['Neto', t.neto]];
  if (estado.parametros.descuentoGlobal > 0) {
    totFilas.push([`Descuento global (${t.parametros.descuentoGlobal}%)`, -t.descuentoGlobal]);
    totFilas.push(['Neto con descuento', t.netoConDescuento]);
  }
  totFilas.push([`Margen (${t.parametros.margen}%)`, t.margen]);
  totFilas.push([`Imprevistos (${t.parametros.imprevistos}%)`, t.imprevistos]);
  totFilas.push(['Base imponible', t.baseImponible]);
  totFilas.push([estado.parametros.exentoIva ? 'IVA (exento)' : `IVA (${t.parametros.iva}%)`, t.iva]);

  totFilas.forEach(([lbl, val]) => {
    set(r, 5, lbl, estiloTotalLbl);
    set(r, 6, val, estiloTotalNum);
    r++;
  });
  set(r, 5, 'TOTAL', estiloTotalFinal);
  set(r, 6, t.total, estiloTotalFinal);

  // Construir la hoja
  const ws = XLSX.utils.aoa_to_sheet(filas);
  Object.entries(estilos).forEach(([rc, estilo]) => {
    const [rr, cc] = rc.split(',').map(Number);
    const ref = XLSX.utils.encode_cell({ r: rr, c: cc });
    if (ws[ref]) ws[ref].s = estilo;
  });

  // Anchos de columna
  ws['!cols'] = [
    { wch: 6 }, { wch: 42 }, { wch: 10 }, { wch: 10 }, { wch: 13 }, { wch: 8 }, { wch: 14 },
  ];
  // Combinar el título
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  // Congelar encabezado de tabla
  ws['!freeze'] = { xSplit: 0, ySplit: filaEncabezado + 1 };

  return ws;
}

/** Construye la hoja 2 "Detalle de cálculo" para trazabilidad. */
function hojaDetalle(estado, t) {
  const p = estado.parametros;
  const filas = [
    ['DETALLE DE CÁLCULO'],
    [],
    ['Parámetro', 'Valor'],
    ['Descuento global (%)', t.parametros.descuentoGlobal],
    ['Margen / utilidad (%)', t.parametros.margen],
    ['Imprevistos / contingencia (%)', t.parametros.imprevistos],
    ['IVA (%)', p.exentoIva ? 'Exento' : t.parametros.iva],
    [],
    ['Paso', 'Monto (CLP)'],
    ['1. Neto (suma de líneas)', t.neto],
    ['2. Descuento global', -t.descuentoGlobal],
    ['3. Neto con descuento', t.netoConDescuento],
    ['4. Margen', t.margen],
    ['5. Base con margen', t.baseConMargen],
    ['6. Imprevistos', t.imprevistos],
    ['7. Base imponible', t.baseImponible],
    ['8. IVA', t.iva],
    ['9. TOTAL', t.total],
    [],
    ['Nota', 'Redondeo a peso entero aplicado sólo al final del cálculo.'],
    ['Aviso', 'Precios referenciales del mercado chileno; validar con proveedor.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws['!cols'] = [{ wch: 34 }, { wch: 44 }];

  // Estilos: título, encabezados de sección y formato numérico
  const estilar = (ref, s) => { if (ws[ref]) ws[ref].s = s; };
  estilar('A1', estiloTitulo);
  ['A3', 'B3', 'A9', 'B9'].forEach((ref) => estilar(ref, estiloTh));
  // Formato numérico a la columna B de los pasos (filas 10-18, índice 9..17)
  for (let rr = 9; rr <= 17; rr++) {
    const ref = XLSX.utils.encode_cell({ r: rr, c: 1 });
    if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].s = { numFmt: NUM_FMT, alignment: { horizontal: 'right' } };
  }
  return ws;
}

// =============================================================================
// CSV
// =============================================================================

export function exportarCSV(estado, totales) {
  const sep = ';'; // Chile: separador de campos ';' (la coma es decimal)
  const filas = [];
  const c = estado.cabecera;

  filas.push([`Cotización N°`, c.numero]);
  filas.push(['Cliente', c.cliente]);
  filas.push(['RUT', c.rut]);
  filas.push(['Fecha', fechaChile(c.fecha)]);
  filas.push(['Validez (días)', c.validezDias]);
  filas.push(['Emisor', c.emisor]);
  filas.push([]);
  filas.push(['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'P. Unitario', 'Desc %', 'Subtotal']);

  estado.lineas.forEach((l, i) => {
    filas.push([
      i + 1, l.descripcion, l.unidad,
      Number(l.cantidad) || 0, Number(l.precioUnitario) || 0,
      Number(l.descuento) || 0, Math.round(subtotalLinea(l)),
    ]);
  });

  filas.push([]);
  filas.push(['', '', '', '', '', 'Neto', totales.neto]);
  if (estado.parametros.descuentoGlobal > 0) filas.push(['', '', '', '', '', 'Descuento global', -totales.descuentoGlobal]);
  filas.push(['', '', '', '', '', `Margen ${totales.parametros.margen}%`, totales.margen]);
  filas.push(['', '', '', '', '', `Imprevistos ${totales.parametros.imprevistos}%`, totales.imprevistos]);
  filas.push(['', '', '', '', '', 'Base imponible', totales.baseImponible]);
  filas.push(['', '', '', '', '', estado.parametros.exentoIva ? 'IVA exento' : `IVA ${totales.parametros.iva}%`, totales.iva]);
  filas.push(['', '', '', '', '', 'TOTAL', totales.total]);

  // Escapar campos (comillas si contienen separador, comillas o salto de línea)
  const escaparCampo = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = filas.map((f) => f.map(escaparCampo).join(sep)).join('\r\n');
  // BOM para que Excel reconozca UTF-8
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, nombreArchivo(estado, 'csv'));
  toast('CSV generado.', 'exito');
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============================================================================
// IMPRESIÓN / PDF
// =============================================================================

export function imprimir(estado, totales) {
  const area = document.getElementById('area-impresion');
  if (!area) { window.print(); return; }
  area.innerHTML = htmlImpresion(estado, totales);
  window.print();
}

function htmlImpresion(estado, t) {
  const c = estado.cabecera;
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lineasHTML = estado.lineas.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(l.descripcion)}</td>
      <td class="c">${esc(l.unidad)}</td>
      <td class="r">${formatoMiles(l.cantidad)}</td>
      <td class="r">${formatoCLP(l.precioUnitario)}</td>
      <td class="r">${Number(l.descuento) || 0}%</td>
      <td class="r">${formatoCLP(Math.round(subtotalLinea(l)))}</td>
    </tr>`).join('');

  const filaTot = (lbl, val, fuerte = false) =>
    `<tr class="${fuerte ? 'tot-final' : ''}"><td colspan="5"></td><td class="r">${lbl}</td><td class="r">${formatoCLP(val)}</td></tr>`;

  return `
    <div class="print-doc">
      <div class="print-head">
        <div>
          <h1>COTIZACIÓN N° ${esc(c.numero)}</h1>
          <p class="print-sub">${esc(c.emisor || '')}</p>
        </div>
        <div class="print-fecha">
          <div><strong>Fecha:</strong> ${esc(fechaChile(c.fecha))}</div>
          <div><strong>Validez:</strong> ${esc(c.validezDias)} días</div>
        </div>
      </div>

      <div class="print-cliente">
        <div><strong>Cliente:</strong> ${esc(c.cliente)}</div>
        <div><strong>RUT:</strong> ${esc(c.rut)}</div>
        <div><strong>Dirección/faena:</strong> ${esc(c.direccion)}</div>
        <div><strong>Contacto:</strong> ${esc(c.contacto)}</div>
      </div>

      <table class="print-tabla">
        <thead>
          <tr><th>#</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th>P. Unitario</th><th>Desc</th><th>Subtotal</th></tr>
        </thead>
        <tbody>${lineasHTML}</tbody>
        <tfoot>
          ${filaTot('Neto', t.neto)}
          ${estado.parametros.descuentoGlobal > 0 ? filaTot(`Descuento global (${t.parametros.descuentoGlobal}%)`, -t.descuentoGlobal) : ''}
          ${filaTot(`Margen (${t.parametros.margen}%)`, t.margen)}
          ${filaTot(`Imprevistos (${t.parametros.imprevistos}%)`, t.imprevistos)}
          ${filaTot('Base imponible', t.baseImponible)}
          ${filaTot(estado.parametros.exentoIva ? 'IVA (exento)' : `IVA (${t.parametros.iva}%)`, t.iva)}
          ${filaTot('TOTAL', t.total, true)}
        </tfoot>
      </table>

      <div class="print-cond">
        <p><strong>Condiciones de pago:</strong> ${esc(c.condicionesPago)}</p>
        <p><strong>Plazo de ejecución:</strong> ${esc(c.plazoEjecucion)}</p>
        ${c.observaciones ? `<p><strong>Observaciones:</strong> ${esc(c.observaciones)}</p>` : ''}
      </div>

      <p class="print-pie">Valores en pesos chilenos. Precios referenciales sujetos a validación.</p>
    </div>`;
}
