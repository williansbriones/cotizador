// ui.js
// -----------------------------------------------------------------------------
// Helpers de interfaz reutilizables: toasts y modal de confirmación.
// Evitan el uso de alert()/confirm() nativos (requisito del proyecto).
// -----------------------------------------------------------------------------

/**
 * Muestra un toast temporal.
 * @param {string} mensaje
 * @param {'info'|'exito'|'error'|'aviso'} tipo
 * @param {number} ms  duración
 */
export function toast(mensaje, tipo = 'info', ms = 3000) {
  let cont = document.getElementById('toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-container';
    cont.className = 'toast-container';
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.setAttribute('role', 'status');
  el.textContent = mensaje;
  cont.appendChild(el);
  // Forzar reflow para la animación de entrada
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/**
 * Modal de confirmación (reemplaza a window.confirm).
 * @param {object} opts
 * @param {string} opts.titulo
 * @param {string} opts.mensaje
 * @param {string} opts.textoConfirmar
 * @param {string} opts.textoCancelar
 * @param {boolean} opts.peligro  estilo rojo para acciones destructivas
 * @returns {Promise<boolean>} true si confirma
 */
export function confirmar({
  titulo = 'Confirmar',
  mensaje = '¿Estás seguro?',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligro = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-titulo"></h3>
        <p class="modal-mensaje"></p>
        <div class="modal-acciones">
          <button class="btn btn-secundario" data-accion="cancelar"></button>
          <button class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-accion="confirmar"></button>
        </div>
      </div>`;
    overlay.querySelector('.modal-titulo').textContent = titulo;
    overlay.querySelector('.modal-mensaje').textContent = mensaje;
    overlay.querySelector('[data-accion="cancelar"]').textContent = textoCancelar;
    overlay.querySelector('[data-accion="confirmar"]').textContent = textoConfirmar;

    const cerrar = (valor) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(valor);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cerrar(false);
      if (e.key === 'Enter') cerrar(true);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(false);
      const accion = e.target.getAttribute?.('data-accion');
      if (accion === 'cancelar') cerrar(false);
      if (accion === 'confirmar') cerrar(true);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-accion="confirmar"]').focus();
  });
}
