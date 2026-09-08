// plantillas.js
// -----------------------------------------------------------------------------
// Plantillas de trabajo predefinidas. Cada plantilla es un constructor PURO que
// devuelve un arreglo de líneas parciales a partir del catálogo actual. No toca
// el DOM ni el estado de la cotización: quien la invoca decide cómo aplicarla.
// -----------------------------------------------------------------------------

import { getItem } from './catalogo.js';

/**
 * Construye una línea a partir de un id del catálogo. Si el ítem ya no existe
 * (el usuario lo editó/eliminó), usa el fallback para no romper la plantilla.
 * @param {string} itemId
 * @param {number} cantidad
 * @param {{descripcion?:string, unidad?:string, precio?:number}} fallback
 */
function L(itemId, cantidad, fallback = {}) {
  const it = getItem(itemId);
  if (it) {
    return { itemId: it.id, descripcion: it.descripcion, unidad: it.unidad, cantidad, precioUnitario: it.precioUnitario, descuento: 0 };
  }
  return {
    itemId: null,
    descripcion: fallback.descripcion || itemId,
    unidad: fallback.unidad || 'unidad',
    cantidad,
    precioUnitario: fallback.precio || 0,
    descuento: 0,
  };
}

/** Elige el condensador de catálogo cuyo kVAR se acerca más al pedido por paso. */
function condensadorParaKvar(kvarPorPaso) {
  const opciones = [
    { kvar: 7.5, id: 'mat-cond-7.5', desc: 'Condensador trifásico 7,5 kVAR 400V', precio: 38000 },
    { kvar: 15, id: 'mat-cond-15', desc: 'Condensador trifásico 15 kVAR 400V', precio: 62000 },
    { kvar: 25, id: 'mat-cond-25', desc: 'Condensador trifásico 25 kVAR 400V', precio: 95000 },
  ];
  return opciones.reduce((mejor, o) =>
    Math.abs(o.kvar - kvarPorPaso) < Math.abs(mejor.kvar - kvarPorPaso) ? o : mejor
  );
}

// -----------------------------------------------------------------------------
// Definición de plantillas.
// Cada una: { id, nombre, descripcion, requiere?: [campos], construir(params) }
// -----------------------------------------------------------------------------

export const PLANTILLAS = [
  {
    id: 'blanco',
    nombre: 'Cotización en blanco',
    descripcion: 'Parte desde cero, sin líneas.',
    construir: () => [],
  },
  {
    id: 'diagnostico',
    nombre: 'Diagnóstico de banco de condensadores',
    descripcion: 'Visita + medición por unidad + informe técnico.',
    requiere: [
      { nombre: 'pasos', label: 'N° de condensadores a medir', tipo: 'number', valor: 6, min: 1 },
    ],
    construir: ({ pasos = 6 } = {}) => [
      L('srv-visita', 1, { descripcion: 'Visita de diagnóstico / inspección', unidad: 'visita', precio: 60000 }),
      L('srv-medicion-cap', pasos, { descripcion: 'Medición y ensayo de capacitancia por unidad', unidad: 'unidad', precio: 8000 }),
      L('srv-informe', 1, { descripcion: 'Informe técnico de mediciones', unidad: 'global', precio: 80000 }),
    ],
  },
  {
    id: 'mantenimiento',
    nombre: 'Mantenimiento preventivo de banco',
    descripcion: 'Jornada técnico + ayudante + insumos + traslado.',
    construir: () => [
      L('mo-mt-jornada', 1, { descripcion: 'Técnico especialista media tensión — jornada', unidad: 'jornada', precio: 250000 }),
      L('mo-ayudante-jornada', 1, { descripcion: 'Ayudante eléctrico — jornada', unidad: 'jornada', precio: 70000 }),
      L('mat-fusible-nh', 3, { descripcion: 'Fusible NH + base portafusible', unidad: 'unidad', precio: 18000 }),
      L('srv-informe', 1, { descripcion: 'Informe técnico de mediciones', unidad: 'global', precio: 80000 }),
      L('tras-rm', 1, { descripcion: 'Traslado dentro de RM', unidad: 'global', precio: 35000 }),
    ],
  },
  {
    id: 'reemplazo',
    nombre: 'Reemplazo de condensadores',
    descripcion: 'Indica la cantidad de unidades a reemplazar.',
    requiere: [
      { nombre: 'unidades', label: 'Cantidad de condensadores a reemplazar', tipo: 'number', valor: 3, min: 1 },
    ],
    construir: ({ unidades = 3 } = {}) => [
      L('mat-cond-15', unidades, { descripcion: 'Condensador trifásico 15 kVAR 400V', unidad: 'unidad', precio: 62000 }),
      L('mat-fusible-nh', unidades, { descripcion: 'Fusible NH + base portafusible', unidad: 'unidad', precio: 18000 }),
      L('srv-medicion-cap', unidades, { descripcion: 'Medición y ensayo de capacitancia por unidad', unidad: 'unidad', precio: 8000 }),
      L('mo-elec-jornada', Math.max(1, Math.ceil(unidades / 6)), { descripcion: 'Electricista certificado SEC — jornada (8h)', unidad: 'jornada', precio: 180000 }),
      L('tras-rm', 1, { descripcion: 'Traslado dentro de RM', unidad: 'global', precio: 35000 }),
    ],
  },
  {
    id: 'instalacion',
    nombre: 'Instalación de banco nuevo',
    descripcion: 'Indica kVAR totales y N° de pasos; arma el listado completo.',
    requiere: [
      { nombre: 'kvar', label: 'Potencia reactiva total (kVAR)', tipo: 'number', valor: 100, min: 1 },
      { nombre: 'pasos', label: 'N° de pasos (escalones)', tipo: 'number', valor: 6, min: 1 },
    ],
    construir: ({ kvar = 100, pasos = 6 } = {}) => {
      const p = Math.max(1, Math.round(pasos));
      const cond = condensadorParaKvar(kvar / p);
      return [
        L(cond.id, p, { descripcion: cond.desc, unidad: 'unidad', precio: cond.precio }),
        L('mat-contactor-25', p, { descripcion: 'Contactor para condensadores 25A', unidad: 'unidad', precio: 45000 }),
        L('mat-fusible-nh', p, { descripcion: 'Fusible NH + base portafusible', unidad: 'unidad', precio: 18000 }),
        L('mat-reactor-7', p, { descripcion: 'Reactor de desintonización 7% (por paso)', unidad: 'unidad', precio: 180000 }),
        L('mat-regulador-fp', 1, { descripcion: 'Regulador automático de factor de potencia (6-12 pasos)', unidad: 'unidad', precio: 320000 }),
        L('mat-gabinete-ip54', 1, { descripcion: 'Gabinete metálico IP54 para banco', unidad: 'unidad', precio: 450000 }),
        L('mat-cable-thhn-6', 40, { descripcion: 'Cable THHN 6 AWG', unidad: 'metro', precio: 1800 }),
        L('mo-mt-jornada', 2, { descripcion: 'Técnico especialista media tensión — jornada', unidad: 'jornada', precio: 250000 }),
        L('mo-ayudante-jornada', 2, { descripcion: 'Ayudante eléctrico — jornada', unidad: 'jornada', precio: 70000 }),
        L('srv-te1', 1, { descripcion: 'Certificado TE1 (declaración SEC)', unidad: 'global', precio: 120000 }),
        L('tras-rm', 1, { descripcion: 'Traslado dentro de RM', unidad: 'global', precio: 35000 }),
      ];
    },
  },
];

/** Devuelve una plantilla por id. */
export function getPlantilla(id) {
  return PLANTILLAS.find((p) => p.id === id) || null;
}
