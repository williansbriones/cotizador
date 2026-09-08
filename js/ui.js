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

/**
 * Modal para pedir uno o más datos al usuario (reemplaza a window.prompt).
 * @param {object} opts
 * @param {string} opts.titulo
 * @param {string} opts.mensaje
 * @param {Array<{nombre:string,label:string,tipo?:string,valor?:any,min?:number,max?:number,step?:number}>} opts.campos
 * @param {string} opts.textoConfirmar
 * @returns {Promise<object|null>} objeto con los valores, o null si cancela
 */
export function pedirDatos({ titulo = 'Datos', mensaje = '', campos = [], textoConfirmar = 'Aceptar' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const camposHTML = campos.map((c) => `
      <label class="pedir-campo">
        <span>${c.label}</span>
        <input class="input" name="${c.nombre}" type="${c.tipo || 'number'}"
          value="${c.valor ?? ''}" ${c.min != null ? `min="${c.min}"` : ''}
          ${c.max != null ? `max="${c.max}"` : ''} ${c.step != null ? `step="${c.step}"` : ''} />
      </label>`).join('');

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal-titulo">${titulo}</h3>
        ${mensaje ? `<p class="modal-mensaje">${mensaje}</p>` : ''}
        <div class="pedir-campos">${camposHTML}</div>
        <div class="modal-acciones">
          <button class="btn btn-secundario" data-accion="cancelar">Cancelar</button>
          <button class="btn btn-primario" data-accion="confirmar">${textoConfirmar}</button>
        </div>
      </div>`;

    const cerrar = (valor) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(valor);
    };
    const recolectar = () => {
      const datos = {};
      campos.forEach((c) => {
        const el = overlay.querySelector(`[name="${c.nombre}"]`);
        datos[c.nombre] = c.tipo === 'text' ? el.value : Number(el.value);
      });
      return datos;
    };
    const onKey = (e) => {
      if (e.key === 'Escape') cerrar(null);
      if (e.key === 'Enter') cerrar(recolectar());
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(null);
      const accion = e.target.getAttribute?.('data-accion');
      if (accion === 'cancelar') cerrar(null);
      if (accion === 'confirmar') cerrar(recolectar());
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('input')?.focus();
  });
}
