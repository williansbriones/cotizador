# ⚡ Calculadora de Cotizaciones Eléctricas

Herramienta web **interna** para armar presupuestos de trabajos eléctricos
industriales (mercado chileno, pesos chilenos) y exportarlos a Excel para
enviárselos al cliente.

100% estática: **vanilla JS + HTML + CSS**, sin backend ni build. La única
dependencia de red en runtime es el CDN de SheetJS para exportar a Excel.

---

## 🚀 Uso rápido (local)

Como usa módulos ES (`type="module"`) y `fetch`, **no** basta con abrir
`index.html` con doble clic (el navegador bloquea `fetch` sobre `file://`).
Levanta un servidor local:

```bash
# Con Python
python -m http.server 8777
# o con Node
npx serve .
```

Luego abre <http://localhost:8777>.

### Flujo de trabajo

1. **📋 Catálogo** — revisa/edita los precios base. Todo cambio se guarda solo.
2. **🧾 Cotización** — aplica una **plantilla** o agrega ítems del catálogo /
   líneas libres. Ajusta cantidades, precios, descuentos, margen, imprevistos
   e IVA en el panel de la derecha (desglose en vivo).
3. Exporta a **Excel**, **CSV** o **Imprimir / PDF**.
4. **💾 Guardadas** — guarda la cotización con un nombre, cárgala o duplícala
   después, y exporta/importa un **respaldo JSON** de toda tu configuración.

---

## 🧮 Cómo se calculan los totales

En este orden, todo en punto flotante y **redondeando a peso entero sólo al
final** (nunca en pasos intermedios):

1. Subtotal por línea = `cantidad × precio × (1 − descuento_línea%)`
2. **Neto** = suma de subtotales
3. − **Descuento global** (%)
4. + **Margen / utilidad** (%, default 20%)
5. + **Imprevistos / contingencia** (%, default 10%)
6. + **IVA** (19%, editable o exento)
7. = **Total**

La lógica vive en `js/calculos.js` (funciones puras, sin DOM).

---

## ✅ Tests

```bash
# En Node (runner sin dependencias)
node tests/calculos.test.mjs
# o
npm test
```

También puedes abrir `tests/tests.html` en el navegador para verlos correr en
consola.

---

## 📁 Estructura

```
/
├── index.html            # shell de la app
├── 404.html              # redirige al index (para Pages)
├── .nojekyll             # evita que Pages ignore carpetas con guion bajo
├── css/styles.css
├── js/
│   ├── app.js            # init, routing de vistas, tema claro/oscuro
│   ├── catalogo.js       # CRUD del catálogo de precios
│   ├── cotizacion.js     # estado y lógica de la cotización actual
│   ├── calculos.js       # funciones puras de cálculo (testeables)
│   ├── plantillas.js     # plantillas de trabajo predefinidas
│   ├── exportar.js       # Excel (xlsx), CSV, impresión
│   ├── guardadas.js      # cotizaciones guardadas + respaldo JSON
│   ├── storage.js        # wrapper de localStorage (prefijo calcelec_)
│   ├── formato.js        # formateo CLP, fechas, RUT
│   └── ui.js             # toasts y modales (sin alert/confirm)
├── data/precios.json     # seed del catálogo
├── tests/                # tests de cálculos
└── .github/workflows/deploy.yml
```

---

## 💾 Persistencia

Todo se guarda en `localStorage` bajo el prefijo **`calcelec_`** (catálogo,
cotización en curso, guardadas y contador). El prefijo evita colisiones en
`usuario.github.io`, donde el almacenamiento se comparte entre todos tus
proyectos de ese dominio.

Para respaldar o mover la configuración a otro computador, usa
**💾 Guardadas → Exportar todo (JSON)** e **Importar JSON**.

---

## 🌐 Despliegue en GitHub Pages

El proyecto es 100% estático y usa **rutas relativas**, así que funciona servido
desde un subdirectorio (`https://usuario.github.io/nombre-repo/`).

### Pasos

1. Crea un repositorio en GitHub y sube estos archivos a la rama **`main`**:
   ```bash
   git init
   git add .
   git commit -m "Calculadora de cotizaciones eléctricas"
   git branch -M main
   git remote add origin https://github.com/USUARIO/NOMBRE-REPO.git
   git push -u origin main
   ```
2. En GitHub: **Settings → Pages → Build and deployment → Source →
   “GitHub Actions”**.
3. El workflow `.github/workflows/deploy.yml` se ejecuta en cada push a `main`
   y publica el sitio. Míralo en la pestaña **Actions**.
4. Cuando termine, tu URL será:

   ```
   https://USUARIO.github.io/NOMBRE-REPO/
   ```

No hay build ni variables de entorno: se sirve la raíz del repositorio tal cual.

---

## ⚠️ Advertencias importantes

### Precios referenciales
Los precios cargados en `data/precios.json` son **valores referenciales** del
mercado eléctrico industrial chileno 2026 (sin IVA salvo indicación). **Deben
validarse con cotización de proveedor antes de enviar cualquier presupuesto al
cliente.** Puedes editarlos libremente en la pestaña Catálogo.

### 🔒 Privacidad — GitHub Pages es PÚBLICO
**Cualquiera con la URL puede ver la calculadora y los precios del catálogo.**
Como esto contiene tu estructura de costos y márgenes, tienes tres opciones:

1. **Repositorio privado con Pages** (requiere plan pago de GitHub) — la opción
   más segura si quieres publicarla online con tus precios reales.
2. **Publicar con precios genéricos**: deja el seed `data/precios.json` con
   valores de referencia (o en cero) y carga tus precios reales sólo en tu
   navegador vía **Importar JSON**. Ese archivo local **nunca se sube al repo**
   (está en `.gitignore` como `precios.local.json` / `config.local.json`).
3. **No publicar**: úsala sólo en local con `python -m http.server`.

> El margen, los imprevistos y demás parámetros viven en tu `localStorage`, no
> en el repositorio, así que esos no se publican aunque el sitio sea público.
> Lo que sí queda visible es el **seed** `data/precios.json` versionado en Git.
