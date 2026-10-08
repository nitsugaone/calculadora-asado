# Asado Pro

Calculadora de asado para Río Gallegos. Esta versión utiliza HTML, CSS y
JavaScript vanilla; no requiere instalación de paquetes ni compilación.

## Funciones actuales

- Comensales separados en pagadores e invitados sin pago; todos suman comida.
- Perfiles de carne cruda: hombres 750 g, mujeres 500 g y niños 250 g.
  Personas sin perfil asignado: 500 g. Los perfiles incluyen también a los invitados
  sin pago y no cambian el divisor de gastos.
- Modos Premium y Económico cambian el reparto de cortes y los chorizos, no los
  gramajes por perfil. La compra se redondea hacia arriba a múltiplos de 100 g.
- Validación si los perfiles superan el total: no se comparten ni guardan compras inválidas.
- Desglose de vacío, tira y pollo con redondeos que suman el total mostrado.
- Chorizos, morcillas, carbón y leña; con cero personas no se generan compras.
- Factor térmico aplicado a ambos combustibles:
  `1 + (0,02 × max(0, 15 - temperatura) + 0,015 × viento) × entorno`.
- Entornos: quincho 0%, chulengo 45% e intemperie 100% del impacto climático.
- Quincho retira clima y pronóstico del layout y mueve el presupuesto bajo los
  comensales. Al volver a otro entorno se recuperan los bloques y valores anteriores.
- Ajustes e historial desde la tuerca del encabezado, con acordeones para modo de
  compra, precios y asados guardados; navegación por teclado y cierre con Escape.
- Precios separados para vacuno/kg, pollo/kg, chorizo/unidad, morcilla/unidad,
  carbón/bolsa de 4 kg, leña/kg y otros gastos.
- Presupuesto desglosado: un campo vacío significa precio faltante; cero es un
  precio válido. Los extras son opcionales. Si faltan precios se muestra un
  subtotal provisorio, también al compartir la lista.
- Costo dividido solo entre quienes pagan; sin pagadores no se muestra un costo
  por persona de cero.
- Historial de hasta 10 asados, con cargar y borrar; persistencia del formulario.
- WhatsApp, copia y lista imprimible.
- Pronóstico Open-Meteo de temperatura y viento, consultado solo bajo demanda.
- PWA offline después de la primera carga completa por HTTPS o localhost.
  Las actualizaciones se activan desde el botón que aparece cuando hay una nueva versión.

## Archivos activos

`index.html`, `style.css`, `script.js`, `sw.js`, `public/manifest.json` y `public/icon.svg`.
GitHub Pages publica únicamente estos archivos, después de ejecutar las pruebas.
Al modificar los archivos offline, incrementar la versión de `CACHE_NAME` en `sw.js`.

Los archivos React/TypeScript de `src/` y la configuración Vite se conservan sin
modificar; no forman parte de la entrada estática vanilla de esta propuesta.

## Diferencias con la versión React de GitHub

Esta migración todavía no tiene paridad funcional con el sitio React. No incluye
el ajuste de carne por rendimiento de cada corte, cordero por medias reses, cerdo,
achuras, bebidas y acompañamientos, lista editable con progreso, calibración por
feedback ni enlaces con precios congelados. Los gramajes de esta propuesta son
750/500/250 g crudos por perfil, no los gramajes diferenciados por corte de React.

Se propone revisar estas diferencias antes de reemplazar la versión pública.
Las pruebas se ejecutan también en pull requests; el despliegue de Pages solo se
realiza desde `main` o desde una ejecución manual, no al abrir una propuesta.

## Validación

Pruebas sin dependencias externas:

```sh
node --test tests/calculos.test.cjs
```

Verificación opcional con Playwright y Microsoft Edge disponibles en el equipo:

```sh
node tests/navegador.cjs
```

La prueba de navegador abre un servidor local temporal, verifica formularios,
historial, perfiles, ajustes, reflujo de Quincho, impresión, cuatro tamaños de pantalla y recarga offline; cierra el servidor
al finalizar. Las capturas se guardan en `.qa/`, fuera de la publicación.
