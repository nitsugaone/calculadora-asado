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
- Selección de vacuno con/sin hueso, cerdo, pollo y mezclas. Conserva por defecto
  750/500/250 g crudos; el ajuste por rendimiento es optativo y muestra los gramajes
  diferenciados. Los rendimientos son orientativos, no garantías de porción cocida.
- Cordero por medias reses estimadas de 6,25 kg, conservando ese peso exacto para
  presupuesto y lista. Confirmar el peso real con la carnicería.
- Bebidas y acompañamientos optativos: agua, gaseosa, hielo, pan, ensalada, papas,
  provoleta y chimichurri. Alcohol solo para los adultos declarados como bebedores.
- Lista editable con progreso de compra, productos propios y eliminación de ítems;
  comparte e imprime las ediciones, sin alterar el presupuesto calculado.
- Chorizos, morcillas, carbón y leña; con cero personas no se generan compras.
- Achuras optativas: 120 g crudos adicionales por consumidor explícito, redondeados
  hacia arriba a 100 g. Se limitan al total de comensales, tienen precio propio y
  suman peso al combustible sin reducir la carne principal.
- Factor térmico aplicado a ambos combustibles:
  `1 + (0,02 × max(0, 15 - temperatura) + 0,015 × viento) × entorno`.
- Entornos: quincho 0%, chulengo 45% e intemperie 100% del impacto climático.
- Quincho retira clima y pronóstico del layout y mueve el presupuesto bajo los
  comensales. Al volver a otro entorno se recuperan los bloques y valores anteriores.
- Ajustes e historial desde la tuerca del encabezado, con acordeones para modo de
  compra, precios y asados guardados; navegación por teclado y cierre con Escape.
- Precios separados para vacuno/kg, pollo/kg, chorizo/unidad, morcilla/unidad,
  cerdo/kg, cordero/kg, achuras/kg, carbón/bolsa de 4 kg, leña/kg y otros gastos.
- Presupuesto desglosado: un campo vacío significa precio faltante; cero es un
  precio válido. Bebidas y acompañamientos se cargan en Otros gastos; al activarlos
  sin cargar ese monto se señala el faltante. Si faltan precios se muestra un
  subtotal provisorio, también al compartir la lista.
- Costo dividido solo entre quienes pagan; sin pagadores no se muestra un costo
  por persona de cero.
- Historial de hasta 10 asados, con cargar y borrar; persistencia del formulario.
- Evaluación de carne por asado guardado: Justo, Sobró o Faltó. Registrar o corregir
  la evaluación no cambia las compras ni acumula ajustes. Aplicar la sugerencia es
  una acción independiente con confirmación, que conserva el resto del formulario.
- Calibración optativa de la carne principal: factor de 0,60 a 1,50 en pasos de 0,01.
  Sugerencias desde el factor del asado evaluado: Faltó +0,12; Sobró -0,05; Justo sin
  cambios. Son orientativas y dependen del grupo, corte y acompañamientos, no son
  garantías de porción. El ajuste no altera los gramajes base ni embutidos, achuras
  o bebidas; combustible y presupuesto acompañan la cantidad de carne resultante.
  Resetear vuelve a 1x; borrar historial no cambia el factor ya aplicado.
- WhatsApp, copia y lista imprimible.
- Enlaces versionados con configuración y precios guardados. Al abrirlos se muestra
  una vista previa; solo confirmar reemplaza el formulario. Cancelar o Escape
  conserva el estado actual. El historial y los textos de la lista no se comparten.
  La lista sugerida se restablece al aceptar; no se importan ediciones personales.
- Los enlaces usan el fragmento `#asado=` (no enviado al servidor HTTP), no son
  cifrados ni firmados, y requieren HTTP/HTTPS; nunca exponen rutas de archivos locales.
  Admiten hasta 10.000 comensales y precios enteros de hasta $1.000.000.000 por campo.
  Los precios quedan guardados en ese enlace, pero el destinatario puede editarlos.
  Los enlaces v2 guardan también el factor de carne; los vanilla v1 siguen admitidos
  y mantienen 1x. Las evaluaciones del historial no se comparten.
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

Esta migración recupera tipos de carne, rendimiento optativo, cordero, bebidas y
lista editable, achuras, calibración optativa y enlaces con precios guardados.
La calibración no se aplica automáticamente ni modifica el antiguo ajuste global
de React. Tampoco migra el historial antiguo de React ni interpreta
los enlaces antiguos `?state=`; los nuevos usan `#asado=` y requieren esta versión vanilla.
Los gramajes iniciales son 750/500/250 g crudos por perfil; se puede activar el
ajuste por corte. Los precios de bebidas y acompañamientos se cargan como un monto
global en Otros gastos, no como precios unitarios.

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
historial, perfiles, cortes, bebidas, lista editable, ajustes, reflujo de Quincho,
achuras, calibración, evaluaciones, enlaces v1/v2, confirmación/cancelación, impresión, cuatro tamaños de pantalla
y recarga offline; cierra el servidor
al finalizar. Las capturas se guardan en `.qa/`, fuera de la publicación.
