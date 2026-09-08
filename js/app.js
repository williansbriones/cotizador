// app.js — punto de entrada: inicialización, routing de vistas y tema.
import { cargarCatalogo, renderVistaCatalogo } from './catalogo.js';
import { cargarCotizacion, renderVistaCotizacion } from './cotizacion.js';
import { renderVistaGuardadas } from './guardadas.js';
import { CLAVES, guardar, leer } from './storage.js';

// Registro de vistas. En etapas siguientes se agregan cotización, guardadas, etc.
const VISTAS = {
  catalogo: {
    titulo: 'Catálogo de precios',
    render: (cont) => renderVistaCatalogo(cont),
  },
  cotizacion: {
    titulo: 'Cotización',
    render: (cont) => renderVistaCotizacion(cont),
  },
  guardadas: {
    titulo: 'Guardadas',
    render: (cont) => renderVistaGuardadas(cont, irA),
  },
};

let vistaActual = 'catalogo';

function irA(vista) {
  if (!VISTAS[vista]) return;
  vistaActual = vista;
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.classList.toggle('activo', t.dataset.vista === vista);
    t.setAttribute('aria-selected', t.dataset.vista === vista ? 'true' : 'false');
  });
  const cont = document.getElementById('vista');
  cont.innerHTML = '';
  VISTAS[vista].render(cont);
}

// --- Tema claro/oscuro ---
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = tema === 'oscuro' ? '☀️' : '🌙';
  guardar(CLAVES.tema, tema);
}
function alternarTema() {
  const actual = document.documentElement.getAttribute('data-tema') || 'claro';
  aplicarTema(actual === 'claro' ? 'oscuro' : 'claro');
}

async function init() {
  // Tema guardado o preferencia del sistema
  const temaGuardado = leer(CLAVES.tema, null);
  const prefiereOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  aplicarTema(temaGuardado || (prefiereOscuro ? 'oscuro' : 'claro'));

  document.getElementById('btn-tema').addEventListener('click', alternarTema);
  document.querySelectorAll('.nav-tab').forEach((t) => {
    t.addEventListener('click', () => irA(t.dataset.vista));
  });

  await cargarCatalogo();
  cargarCotizacion();
  irA('catalogo');
  console.log('[calcelec] Aplicación iniciada.');
}

document.addEventListener('DOMContentLoaded', init);
