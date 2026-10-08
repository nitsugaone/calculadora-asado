/*
  CHANGELOG
  - Recuperé perfiles de carne cruda, independientes del modo de compra y del reparto de gastos.
  - Moví ajustes e historial a un diálogo y reorganicé clima/pronóstico al elegir Quincho.
  - Corregí compras con cero personas y el redondeo del desglose de cortes.
  - Separé precios por categoría e identifiqué presupuestos incompletos.
  - Validé datos guardados, protegí el almacenamiento y sincronicé acciones pendientes.
  - Agregué estado offline verificado y actualización del service worker bajo confirmación.
  - Agregué card de morcillas, penalización por calor extremo y kg siempre con 1 decimal.
  - Reemplacé renderizados masivos de HTML crudo por creación segura de nodos DOM.
  - Corregí inputs de precio type=number, cursor jumping, persistencia de formulario,
    historial completo con Cargar/Borrar, copiar con feedback y pronóstico solo bajo demanda.
*/
const FORMATO_AR = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const PESOS_AR = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

const STORAGE_HISTORIAL = 'asadoProHistorialVanilla';
const STORAGE_ESTADO = 'asadoProEstado';
const PORCION_ESTANDAR_GRAMOS = 450;
const DEBOUNCE_MS = 300;
const GRAMOS_POR_PERFIL = { hombres: 750, mujeres: 500, ninos: 250 };
const GRAMOS_SIN_PERFIL = 500;
const CLAVES_PERFILES = Object.keys(GRAMOS_POR_PERFIL);

const ESTADO_INICIAL = {
  pagadores: 12,
  gratis: 0,
  hombres: 0,
  mujeres: 0,
  ninos: 0,
  modo: 'premium',
  entorno: 'chulengo',
  temperatura: 8,
  viento: 25,
  precioCarne: '',
  precioCarbon: '',
  precioPollo: '',
  precioChorizo: '',
  precioMorcilla: '',
  precioLena: '',
  extras: '',
};

const CLAVES_PRECIOS = [
  'precioCarne', 'precioCarbon', 'precioPollo', 'precioChorizo',
  'precioMorcilla', 'precioLena', 'extras',
];

const MODOS_COMPRA = {
  premium: {
    etiqueta: 'Premium',
    vacio: 0.7,
    tira: 0.3,
    pollo: 0,
    chorizosPorPersona: 0.65,
  },
  economico: {
    etiqueta: 'Económico',
    vacio: 0.45,
    tira: 0.25,
    pollo: 0.3,
    chorizosPorPersona: 1.1,
  },
};

const COEFICIENTE_ENTORNO = {
  quincho: 0,
  chulengo: 0.45,
  intemperie: 1,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elementos = {
  formulario: $('#formularioAsado'),
  personasPagas: $('#personasPagas'),
  sliderPersonas: $('#sliderPersonas'),
  invitadosGratis: $('#invitadosGratis'),
  hombres: $('#hombres'),
  mujeres: $('#mujeres'),
  ninos: $('#ninos'),
  resumenPerfiles: $('#resumenPerfiles'),
  camposClima: $('#camposClima'),
  panelPronostico: $('#panelPronostico'),
  modalAjustes: $('#modalAjustes'),
  abrirAjustes: $('#abrirAjustes'),
  cerrarAjustes: $('#cerrarAjustes'),
  temperatura: $('#temperatura'),
  viento: $('#viento'),
  precioCarne: $('#precioCarne'),
  precioCarbon: $('#precioCarbon'),
  extras: $('#extras'),
  precioPollo: $('#precioPollo'),
  precioChorizo: $('#precioChorizo'),
  precioMorcilla: $('#precioMorcilla'),
  precioLena: $('#precioLena'),
  detallePresupuesto: $('#detallePresupuesto'),
  totalPresupuesto: $('#totalPresupuesto'),
  presupuestoAsado: $('#presupuestoAsado'),
  presupuestoQuincho: $('#presupuestoQuincho'),
  estadoGuardado: $('#estadoGuardado'),
  actualizarApp: $('#actualizarApp'),
  btnReset: $('#btnReset'),
  emojisPersonas: $('#emojisPersonas'),
  textoPersonas: $('#textoPersonas'),
  resumenComensales: $('#resumenComensales'),
  resultadoCards: $('#resultadoCards'),
  indicadorContextual: $('#indicadorContextual'),
  mensajeClima: $('#mensajeClima'),
  guardarAsado: $('#guardarAsado'),
  compartirWhatsapp: $('#compartirWhatsapp'),
  generarLista: $('#generarLista'),
  historialAsados: $('#historialAsados'),
  actualizarPronostico: $('#actualizarPronostico'),
  resumenPronostico: $('#resumenPronostico'),
  tablaPronostico: $('#tablaPronostico'),
  modalLista: $('#modalLista'),
  contenidoLista: $('#contenidoLista'),
  cerrarLista: $('#cerrarLista'),
  imprimirLista: $('#imprimirLista'),
  copiarLista: $('#copiarLista'),
  estadoConexion: $('#estadoConexion'),
};

let calculoActual = null;
let temporizadorRender = null;
let restaurandoEstado = false;
let offlinePreparado = false;

function formatearKg(valor) {
  return `${Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kg`;
}

function formatearDecimal(valor, maximos = 1) {
  return Number(valor || 0).toLocaleString('es-AR', {
    maximumFractionDigits: maximos,
  });
}

function formatearMoneda(valor) {
  return `$${PESOS_AR.format(Math.max(0, Number(valor) || 0))}`;
}

function parsearEnteroPositivo(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return 0;
  const numero = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isSafeInteger(Math.floor(numero)) || numero <= 0) return 0;
  return Math.floor(numero);
}

// Distingue un precio sin cargar de un precio explícito de cero pesos.
function leerPrecio(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';
  const texto = String(valor ?? '').trim();
  if (!/^\d+$/.test(texto)) return '';
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : '';
}

// Normaliza datos del formulario y del almacenamiento sin confiar en su estructura.
function normalizarEstado(datos) {
  const estado = datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
  const clima = (clave, minimo, maximo) => {
    const valor = estado[clave];
    const numero = valor !== '' && (typeof valor === 'string' || typeof valor === 'number')
      ? Number(valor) : NaN;
    return Number.isFinite(numero)
      ? Math.min(maximo, Math.max(minimo, numero)) : ESTADO_INICIAL[clave];
  };
  return {
    pagadores: parsearEnteroPositivo(estado.pagadores ?? ESTADO_INICIAL.pagadores),
    gratis: parsearEnteroPositivo(estado.gratis),
    ...Object.fromEntries(CLAVES_PERFILES.map((clave) => [clave, parsearEnteroPositivo(estado[clave])])),
    modo: Object.hasOwn(MODOS_COMPRA, estado.modo) ? estado.modo : ESTADO_INICIAL.modo,
    entorno: Object.hasOwn(COEFICIENTE_ENTORNO, estado.entorno) ? estado.entorno : ESTADO_INICIAL.entorno,
    temperatura: clima('temperatura', -15, 35),
    viento: clima('viento', 0, 120),
    ...Object.fromEntries(CLAVES_PRECIOS.map((clave) => [clave, leerPrecio(estado[clave])])),
  };
}

function leerEnteroInput(input) {
  return parsearEnteroPositivo(input.value);
}

function leerNumeroClimatico(input, minimo, maximo) {
  const valor = Number.parseFloat(String(input.value).replace(',', '.'));
  if (!Number.isFinite(valor)) return ESTADO_INICIAL[input.id] ?? minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

function debounceRender() {
  window.clearTimeout(temporizadorRender);
  temporizadorRender = window.setTimeout(() => {
    temporizadorRender = null;
    actualizarTodo();
    guardarEstadoFormulario();
  }, DEBOUNCE_MS);
}

// Las acciones usan siempre el formulario actual, incluso dentro de los 300 ms de espera.
function confirmarCambios() {
  window.clearTimeout(temporizadorRender);
  temporizadorRender = null;
  actualizarTodo();
  guardarEstadoFormulario();
}

function obtenerEstado() {
  const modo = $('input[name="modoCompra"]:checked')?.value || ESTADO_INICIAL.modo;
  const entorno = $('input[name="entorno"]:checked')?.value || ESTADO_INICIAL.entorno;

  return normalizarEstado({
    pagadores: leerEnteroInput(elementos.personasPagas),
    gratis: leerEnteroInput(elementos.invitadosGratis),
    ...Object.fromEntries(CLAVES_PERFILES.map((clave) => [clave, leerEnteroInput(elementos[clave])])),
    modo,
    entorno,
    temperatura: leerNumeroClimatico(elementos.temperatura, -15, 35),
    viento: leerNumeroClimatico(elementos.viento, 0, 120),
    ...Object.fromEntries(CLAVES_PRECIOS.map((clave) => [clave, elementos[clave].value])),
  });
}

// Calcula el factor térmico completo:
// 1 + ((0.02 × grados bajo 15°C) + (0.015 × viento km/h)) × entorno.
function calcularFactorTermico(temperatura, viento, entorno) {
  const gradosBajo15 = Math.max(0, 15 - temperatura);
  const perdidaFrio = 0.02 * gradosBajo15;
  const perdidaViento = 0.015 * Math.max(0, viento);
  return 1 + (perdidaFrio + perdidaViento) * COEFICIENTE_ENTORNO[entorno];
}

// Calcula comida, combustible y presupuesto usando invitados totales para comida
// y solo pagadores para dividir el costo.
function calcularAsado(estado) {
  estado = normalizarEstado(estado);
  const totalPersonas = estado.pagadores + estado.gratis;
  const modo = MODOS_COMPRA[estado.modo] || MODOS_COMPRA.premium;
  const totalPerfiles = CLAVES_PERFILES.reduce((suma, clave) => suma + estado[clave], 0);
  const perfilesValidos = totalPerfiles <= totalPersonas;
  const sinPerfil = Math.max(0, totalPersonas - totalPerfiles);
  // Carne cruda: hombres × 750 + mujeres × 500 + niños × 250 + sin perfil × 500 g.
  // La compra se redondea hacia arriba a 100 g, sin reducir la base solicitada.
  const gramosCarneTotal = perfilesValidos ? CLAVES_PERFILES.reduce(
    (suma, clave) => suma + estado[clave] * GRAMOS_POR_PERFIL[clave], sinPerfil * GRAMOS_SIN_PERFIL
  ) : 0;
  const kgCarneTotal = Math.ceil(gramosCarneTotal / 100) / 10;
  const hayComensales = perfilesValidos && totalPersonas > 0;
  const [kgVacio, kgTira, kgPollo] = repartirCortes(kgCarneTotal, modo);
  const chorizos = hayComensales ? Math.ceil(totalPersonas * modo.chorizosPorPersona) : 0;
  const morcillas = hayComensales ? Math.ceil(totalPersonas * 0.35) : 0;
  const factorTermico = calcularFactorTermico(estado.temperatura, estado.viento, estado.entorno);
  const carbonBaseKg = hayComensales ? Math.max(3, kgCarneTotal * 0.95 + chorizos * 0.06) : 0;
  const lenaBaseKg = hayComensales ? Math.max(2, kgCarneTotal * 0.48) : 0;
  const carbonKg = redondear(carbonBaseKg * factorTermico, 1);
  const lenaKg = redondear(lenaBaseKg * factorTermico, 1);
  const bolsasCarbon = Math.ceil(carbonKg / 4);
  const porciones = Math.max(0, Math.round((kgCarneTotal * 1000) / PORCION_ESTANDAR_GRAMOS));
  const rubros = [
    ['Vacuno', redondear(kgVacio + kgTira, 1), 'precioCarne'],
    ['Pollo', kgPollo, 'precioPollo'],
    ['Chorizos', chorizos, 'precioChorizo'],
    ['Morcillas', morcillas, 'precioMorcilla'],
    ['Carbón', bolsasCarbon, 'precioCarbon'],
    ['Leña', lenaKg, 'precioLena'],
  ];
  const detallePresupuesto = rubros.filter(([, cantidad]) => cantidad > 0)
    .map(([nombre, cantidad, clave]) => ({
      nombre, cantidad, precio: estado[clave],
      subtotal: estado[clave] === '' ? null : Math.round(cantidad * estado[clave]),
    }));
  if (hayComensales && estado.extras !== '') {
    detallePresupuesto.push({ nombre: 'Extras', cantidad: 1, precio: estado.extras, subtotal: estado.extras });
  }
  const preciosFaltantes = detallePresupuesto.filter((rubro) => rubro.subtotal === null)
    .map((rubro) => rubro.nombre);
  const presupuestoCompleto = perfilesValidos && preciosFaltantes.length === 0;
  const totalEstimado = detallePresupuesto.reduce((suma, rubro) => suma + (rubro.subtotal ?? 0), 0);
  const costoPorCabeza = estado.pagadores > 0 ? Math.ceil(totalEstimado / estado.pagadores) : null;

  return {
    ...estado,
    totalPersonas,
    totalPerfiles,
    sinPerfil,
    perfilesValidos,
    gramosCarneTotal,
    kgCarneTotal,
    kgVacio,
    kgTira,
    kgPollo,
    chorizos,
    morcillas,
    factorTermico: redondear(factorTermico, 2),
    carbonKg,
    lenaKg,
    bolsasCarbon,
    porciones,
    totalEstimado,
    costoPorCabeza,
    detallePresupuesto,
    preciosFaltantes,
    presupuestoCompleto,
  };
}

// Reparte unidades de 100 g por mayor resto: los cortes siempre suman el total mostrado.
function repartirCortes(kgTotal, modo) {
  const unidades = Math.round(kgTotal * 10);
  const cortes = [modo.vacio, modo.tira, modo.pollo].map((proporcion, indice) => {
    const exacto = unidades * proporcion;
    return { indice, unidades: Math.floor(exacto), resto: exacto - Math.floor(exacto) };
  });
  const pendientes = unidades - cortes.reduce((suma, corte) => suma + corte.unidades, 0);
  const orden = [...cortes].sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  for (let i = 0; i < pendientes; i += 1) orden[i % orden.length].unidades += 1;
  return cortes.map((corte) => corte.unidades / 10);
}

function redondear(valor, decimales) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function crearNodo(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function crearCard({ emoji, alt, titulo, valor, detalle }) {
  const card = crearNodo('article', 'card-resultado');
  const arriba = crearNodo('div', 'card-resultado__arriba');
  const tituloNodo = crearNodo('div', 'card-resultado__titulo', titulo);
  const emojiNodo = crearNodo('span', 'card-resultado__emoji', emoji);
  const altNodo = crearNodo('span', 'sr-only', alt);
  const valorNodo = crearNodo('div', 'card-resultado__valor', valor);
  const detalleNodo = crearNodo('div', 'card-resultado__detalle', detalle);

  emojiNodo.setAttribute('aria-hidden', 'true');
  arriba.append(tituloNodo, emojiNodo, altNodo);
  card.append(arriba, valorNodo, detalleNodo);
  return card;
}

function renderizarResultados(calculo) {
  $('#campoPrecioPollo').hidden = calculo.modo !== 'economico';
  const deshabilitar = calculo.totalPersonas === 0 || !calculo.perfilesValidos;
  elementos.guardarAsado.disabled = deshabilitar;
  elementos.compartirWhatsapp.disabled = deshabilitar;
  elementos.generarLista.disabled = deshabilitar;
  elementos.detallePresupuesto.replaceChildren();
  elementos.totalPresupuesto.replaceChildren();
  elementos.presupuestoAsado.hidden = deshabilitar;
  if (!calculo.perfilesValidos) {
    elementos.resultadoCards.replaceChildren(crearNodo('p', 'estado-vacio',
      'Revisá los perfiles: suman más personas que el total de comensales.'));
    return;
  }
  if (calculo.totalPersonas === 0) {
    elementos.resultadoCards.replaceChildren(crearNodo('p', 'estado-vacio',
      'Ingresá la cantidad de personas para ver las cantidades 🔥'));
    return;
  }
  const cards = [
    crearCard({
      emoji: '🥩',
      alt: 'Carne',
      titulo: 'Carne total',
      valor: formatearKg(calculo.kgCarneTotal),
      detalle: `Carne cruda · ${calculo.porciones} porciones aprox. de ${PORCION_ESTANDAR_GRAMOS} g · compra en múltiplos de 100 g`,
    }),
    crearCard({
      emoji: '🔪',
      alt: 'Vacío',
      titulo: 'Vacío',
      valor: formatearKg(calculo.kgVacio),
      detalle: calculo.modo === 'premium' ? 'corte principal premium' : 'proporción económica',
    }),
    crearCard({
      emoji: '🍖',
      alt: 'Tira',
      titulo: 'Tira / costilla',
      valor: formatearKg(calculo.kgTira),
      detalle: 'corte con hueso sugerido',
    }),
    crearCard({
      emoji: '🌭',
      alt: 'Chorizos',
      titulo: 'Chorizos',
      valor: FORMATO_AR.format(calculo.chorizos),
      detalle: 'unidades sugeridas',
    }),
    crearCard({
      emoji: '🩸',
      alt: 'Morcillas',
      titulo: 'Morcillas',
      valor: FORMATO_AR.format(calculo.morcillas),
      detalle: 'unidades sugeridas',
    }),
    crearCard({
      emoji: '🔥',
      alt: 'Carbón',
      titulo: 'Carbón',
      valor: formatearKg(calculo.carbonKg),
      detalle: `${FORMATO_AR.format(calculo.bolsasCarbon)} bolsas de 4 kg`,
    }),
    crearCard({
      emoji: '🪵',
      alt: 'Leña',
      titulo: 'Leña',
      valor: formatearKg(calculo.lenaKg),
      detalle: `factor térmico ${formatearDecimal(calculo.factorTermico, 2)}x`,
    }),
  ];

  if (calculo.kgPollo > 0) {
    cards.splice(
      5,
      0,
      crearCard({
        emoji: '🍗',
        alt: 'Pollo',
        titulo: 'Pollo',
        valor: formatearKg(calculo.kgPollo),
        detalle: 'refuerzo del modo económico',
      })
    );
  }

  elementos.resultadoCards.replaceChildren(...cards);
  elementos.totalPresupuesto.replaceChildren(crearCard({
    emoji: '💰',
    alt: 'Presupuesto',
    titulo: calculo.presupuestoCompleto ? 'Total estimado' : 'Subtotal cargado',
    valor: formatearMoneda(calculo.totalEstimado),
    detalle: calculo.pagadores === 0 ? 'Sin pagadores: no se puede dividir el costo.'
      : `${formatearMoneda(calculo.costoPorCabeza)} por persona (redondeado ↑)${calculo.presupuestoCompleto ? '' : ' · Provisorio'}`,
  }));
  const aviso = calculo.presupuestoCompleto ? 'Presupuesto completo'
    : `Presupuesto incompleto. Falta precio de: ${calculo.preciosFaltantes.join(', ')}.`;
  elementos.detallePresupuesto.append(crearNodo('p', 'ayuda', aviso));
  const desglose = crearNodo('dl', 'desglose-presupuesto');
  calculo.detallePresupuesto.forEach((rubro) => {
    const fila = crearNodo('div');
    fila.append(crearNodo('dt', '', rubro.nombre), crearNodo('dd', '',
      rubro.subtotal === null ? 'Sin precio' : formatearMoneda(rubro.subtotal)));
    desglose.append(fila);
  });
  elementos.detallePresupuesto.append(desglose);
}

function renderizarComensales(calculo) {
  const fuerte = crearNodo(
    'strong',
    '',
    `${FORMATO_AR.format(calculo.totalPersonas)} personas comen`
  );
  const detalle = document.createTextNode(
    `${FORMATO_AR.format(calculo.pagadores)} pagan · ${FORMATO_AR.format(
      calculo.gratis
    )} invitados sin pago · modo ${MODOS_COMPRA[calculo.modo].etiqueta.toLowerCase()}`
  );

  elementos.resumenComensales.replaceChildren(fuerte, document.createElement('br'), detalle);

  const cantidadEmojis = Math.min(calculo.pagadores, 24);
  elementos.emojisPersonas.textContent =
    cantidadEmojis > 0 ? '👤'.repeat(cantidadEmojis) : 'Sin pagadores';
  elementos.textoPersonas.textContent = `${calculo.pagadores} personas que pagan seleccionadas`;
  elementos.resumenPerfiles.textContent = calculo.perfilesValidos
    ? `${calculo.sinPerfil} sin perfil · ${GRAMOS_SIN_PERFIL} g de carne cruda por persona.`
    : `Los perfiles suman ${calculo.totalPerfiles}, pero hay ${calculo.totalPersonas} comensales.`;
  CLAVES_PERFILES.forEach((clave) => {
    elementos[clave].setAttribute('aria-invalid', String(!calculo.perfilesValidos));
  });
}

function renderizarIndicadores(calculo) {
  if (!calculo.perfilesValidos) {
    elementos.indicadorContextual.textContent = 'Los perfiles deben sumar como máximo el total de comensales.';
    elementos.indicadorContextual.hidden = false;
  } else if (calculo.totalPersonas === 0) {
    elementos.indicadorContextual.textContent = '⚠️ Nadie está invitado al asado.';
    elementos.indicadorContextual.hidden = false;
  } else if (calculo.pagadores === 0) {
    elementos.indicadorContextual.textContent = '⚠️ Nadie está pagando el asado.';
    elementos.indicadorContextual.hidden = false;
  } else if (calculo.kgCarneTotal > 10) {
    elementos.indicadorContextual.textContent = '¡Esto es un asado bailable! 🎉';
    elementos.indicadorContextual.hidden = false;
  } else if (calculo.totalPersonas > 8 && calculo.kgCarneTotal < 3) {
    elementos.indicadorContextual.textContent = '¿Seguro que alcanza? Revisá modo y cantidad.';
    elementos.indicadorContextual.hidden = false;
  } else {
    elementos.indicadorContextual.hidden = true;
  }

  const entornoTexto = {
    quincho: 'Quincho: el clima no penaliza el combustible.',
    chulengo: 'Chulengo: toma el 45% del impacto de frío y viento.',
    intemperie: 'Intemperie: toma el 100% del impacto de frío y viento.',
  };

  elementos.mensajeClima.textContent = `${entornoTexto[calculo.entorno]} Factor térmico ${formatearDecimal(
    calculo.factorTermico,
    2
  )}x.`;
  elementos.mensajeClima.classList.toggle(
    'aviso--riesgo',
    calculo.entorno === 'intemperie' && calculo.viento > 50
  );
}

function actualizarTodo() {
  sincronizarSlider();
  const estado = obtenerEstado();
  calculoActual = calcularAsado(estado);
  renderizarComensales(calculoActual);
  renderizarResultados(calculoActual);
  renderizarIndicadores(calculoActual);
  actualizarEntorno(calculoActual.entorno);
}

// hidden retira los bloques del flujo: no quedan huecos ni controles de clima enfocables.
function actualizarEntorno(entorno) {
  const bajoTecho = entorno === 'quincho';
  elementos.camposClima.hidden = bajoTecho;
  elementos.panelPronostico.hidden = bajoTecho;
  elementos.mensajeClima.hidden = bajoTecho;
  elementos.presupuestoQuincho.hidden = !bajoTecho;
  const destino = bajoTecho ? elementos.presupuestoQuincho : $('.panel--resultados');
  if (elementos.presupuestoAsado.parentElement !== destino) {
    if (bajoTecho) destino.append(elementos.presupuestoAsado);
    else destino.insertBefore(elementos.presupuestoAsado, elementos.indicadorContextual);
  }
}

function sincronizarSlider() {
  const pagadores = leerEnteroInput(elementos.personasPagas);
  elementos.sliderPersonas.value = Math.min(Number(elementos.sliderPersonas.max), pagadores);
}

function guardarEstadoFormulario() {
  if (restaurandoEstado) return;

  escribirAlmacenamiento(STORAGE_ESTADO, obtenerEstado());
}

// El cálculo sigue funcionando si el navegador bloquea o llena el almacenamiento local.
function escribirAlmacenamiento(clave, valor) {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, JSON.stringify(valor));
    elementos.estadoGuardado.textContent = '';
    return true;
  } catch {
    elementos.estadoGuardado.textContent = 'No se pudo guardar en este dispositivo. Podés seguir calculando.';
    return false;
  }
}

function leerAlmacenamiento(clave, defecto) {
  try {
    return JSON.parse(window.localStorage.getItem(clave) || 'null') ?? defecto;
  } catch {
    return defecto;
  }
}

function aplicarEstadoFormulario(estado) {
  window.clearTimeout(temporizadorRender);
  temporizadorRender = null;
  estado = normalizarEstado(estado);
  restaurandoEstado = true;
  elementos.personasPagas.value = String(parsearEnteroPositivo(estado.pagadores));
  elementos.invitadosGratis.value = String(parsearEnteroPositivo(estado.gratis));
  CLAVES_PERFILES.forEach((clave) => { elementos[clave].value = String(estado[clave]); });
  elementos.temperatura.value = String(estado.temperatura ?? ESTADO_INICIAL.temperatura);
  elementos.viento.value = String(estado.viento ?? ESTADO_INICIAL.viento);
  CLAVES_PRECIOS.forEach((clave) => { elementos[clave].value = String(estado[clave]); });

  marcarRadio('modoCompra', estado.modo || ESTADO_INICIAL.modo);
  marcarRadio('entorno', estado.entorno || ESTADO_INICIAL.entorno);
  restaurandoEstado = false;
  actualizarTodo();
}

function marcarRadio(nombre, valor) {
  const radio = $$(`input[name="${nombre}"]`).find((input) => input.value === valor);
  if (radio) radio.checked = true;
}

function restaurarEstadoFormulario() {
  aplicarEstadoFormulario(leerAlmacenamiento(STORAGE_ESTADO, ESTADO_INICIAL));
}

function normalizarCampoEntero(input) {
  input.value = String(leerEnteroInput(input));
}

function normalizarCampoPrecio(input) {
  const valor = leerPrecio(input.value);
  input.value = String(valor);
  input.dataset.formateado = valor !== '' ? valor.toLocaleString('es-AR') : '';
  input.title = input.dataset.formateado ? `$${input.dataset.formateado}` : 'Precio sin cargar';
}

function bloquearDecimalPrecio(evento) {
  if (['.', ',', '-', '+', 'e', 'E'].includes(evento.key)) {
    evento.preventDefault();
  }
}

function bloquearPegadoNoEntero(evento) {
  const texto = evento.clipboardData?.getData('text') ?? '';
  if (!/^\d+$/.test(texto)) {
    evento.preventDefault();
  }
}

function prepararInputs() {
  [elementos.personasPagas, elementos.invitadosGratis,
    ...CLAVES_PERFILES.map((clave) => elementos[clave])].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      normalizarCampoEntero(input);
      confirmarCambios();
    });
  });

  CLAVES_PRECIOS.map((clave) => elementos[clave]).forEach((input) => {
    input.addEventListener('keydown', bloquearDecimalPrecio);
    input.addEventListener('paste', bloquearPegadoNoEntero);
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      normalizarCampoPrecio(input);
      confirmarCambios();
    });
  });

  [elementos.temperatura, elementos.viento].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      const estado = obtenerEstado();
      input.value = String(estado[input.id]);
      confirmarCambios();
    });
  });

  elementos.sliderPersonas.addEventListener('input', () => {
    elementos.personasPagas.value = elementos.sliderPersonas.value;
    debounceRender();
  });
  elementos.sliderPersonas.addEventListener('change', confirmarCambios);

  $$('input[name="modoCompra"], input[name="entorno"]').forEach((input) => {
    input.addEventListener('change', () => {
      confirmarCambios();
    });
  });
}

function guardarAsado() {
  confirmarCambios();
  if (!calculoActual.totalPersonas || !calculoActual.perfilesValidos) return;

  const historial = leerHistorial();
  historial.unshift({
    fecha: new Date().toISOString(),
    calculo: { ...calculoActual },
  });
  if (escribirAlmacenamiento(STORAGE_HISTORIAL, historial.slice(0, 10))) {
    elementos.estadoGuardado.textContent = 'Asado guardado en el historial.';
    window.setTimeout(() => {
      if (elementos.estadoGuardado.textContent === 'Asado guardado en el historial.') {
        elementos.estadoGuardado.textContent = '';
      }
    }, 2000);
  }
  renderizarHistorial();
}

function leerHistorial() {
  const datos = leerAlmacenamiento(STORAGE_HISTORIAL, []);
  if (!Array.isArray(datos)) return [];
  return datos.filter((item) => {
    if (!item || typeof item !== 'object' || typeof item.fecha !== 'string'
      || !Number.isFinite(Date.parse(item.fecha))) return false;
    const calculo = item.calculo ?? item;
    if (!calculo || typeof calculo !== 'object' || Array.isArray(calculo)) return false;
    const campos = ['totalPersonas', 'personas', 'totalEstimado', 'total', 'costoPorCabeza', 'porCabeza'];
    return campos.every((clave) => calculo[clave] == null
      || typeof calculo[clave] === 'number' && Number.isFinite(calculo[clave]) && calculo[clave] >= 0)
      && (Number.isFinite(calculo.totalPersonas) || Number.isFinite(calculo.personas));
  }).slice(0, 10);
}

function renderizarHistorial() {
  const historial = leerHistorial();
  elementos.historialAsados.replaceChildren();

  if (historial.length === 0) {
    elementos.historialAsados.append(crearNodo('p', 'ayuda', 'Todavía no hay asados guardados.'));
    return;
  }

  const borrar = crearNodo('button', 'btn-borrar-historial', 'Borrar historial');
  borrar.type = 'button';
  borrar.addEventListener('click', borrarHistorial);

  const lista = crearNodo('div', 'historial-lista');
  historial.forEach((item) => lista.append(crearItemHistorial(item)));
  elementos.historialAsados.append(borrar, lista);
}

function crearItemHistorial(item) {
  const calculo = item.calculo || item;
  const fecha = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.fecha));
  const contenedor = crearNodo('div', 'historial-item');
  const titulo = crearNodo(
    'strong',
    '',
    `${fecha} · ${FORMATO_AR.format(calculo.totalPersonas || item.personas || 0)} personas`
  );
  const detalle = crearNodo(
    'span',
    '',
    `${calculo.presupuestoCompleto === false ? 'Subtotal' : 'Total'} ${formatearMoneda(calculo.totalEstimado || item.total || 0)} · ${calculo.pagadores === 0
      ? 'Sin pagadores' : `Por cabeza ${formatearMoneda(calculo.costoPorCabeza || item.porCabeza || 0)}`}`
  );
  const acciones = crearNodo('div', 'historial-acciones');
  const cargar = crearNodo('button', 'btn-cargar', 'Cargar');
  cargar.type = 'button';
  cargar.addEventListener('click', () => cargarAsadoHistorial(calculo));
  acciones.append(cargar);
  contenedor.append(titulo, detalle, acciones);
  return contenedor;
}

function cargarAsadoHistorial(calculo) {
  aplicarEstadoFormulario({
    pagadores: calculo.pagadores ?? calculo.totalPersonas ?? calculo.personas ?? ESTADO_INICIAL.pagadores,
    gratis: calculo.gratis ?? 0,
    ...Object.fromEntries(CLAVES_PERFILES.map((clave) => [clave, calculo[clave] ?? 0])),
    modo: calculo.modo,
    entorno: calculo.entorno,
    temperatura: calculo.temperatura,
    viento: calculo.viento,
    ...Object.fromEntries(CLAVES_PRECIOS.map((clave) => [clave, calculo[clave] ?? ''])),
  });
  guardarEstadoFormulario();
  if (elementos.modalAjustes.open) elementos.modalAjustes.close();
}

function borrarHistorial() {
  if (!window.confirm('¿Borrar todo el historial de asados?')) return;
  escribirAlmacenamiento(STORAGE_HISTORIAL, null);
  renderizarHistorial();
}

function textoResumen(calculo) {
  return [
    'Asado Pro Río Gallegos',
    `Personas: ${FORMATO_AR.format(calculo.totalPersonas)} (${FORMATO_AR.format(
      calculo.pagadores
    )} pagan, ${FORMATO_AR.format(calculo.gratis)} sin pago)`,
    `Modo: ${MODOS_COMPRA[calculo.modo].etiqueta}`,
    `Perfiles: ${calculo.hombres} hombres (750 g), ${calculo.mujeres} mujeres (500 g), ${calculo.ninos} niños (250 g), ${calculo.sinPerfil} sin perfil (500 g). Carne cruda.`,
    `Carne total: ${formatearKg(calculo.kgCarneTotal)} (${calculo.porciones} porciones)`,
    `Vacío: ${formatearKg(calculo.kgVacio)}`,
    `Tira/costilla: ${formatearKg(calculo.kgTira)}`,
    calculo.kgPollo > 0 ? `Pollo: ${formatearKg(calculo.kgPollo)}` : null,
    `Chorizos: ${FORMATO_AR.format(calculo.chorizos)} unidades`,
    `Morcillas: ${FORMATO_AR.format(calculo.morcillas)} unidades`,
    `Carbón: ${formatearKg(calculo.carbonKg)} (${FORMATO_AR.format(calculo.bolsasCarbon)} bolsas)`,
    `Leña: ${formatearKg(calculo.lenaKg)}`,
    `${calculo.presupuestoCompleto ? 'Costo total' : 'Subtotal cargado'}: ${formatearMoneda(calculo.totalEstimado)}`,
    calculo.pagadores > 0 ? `Por cabeza: ${formatearMoneda(calculo.costoPorCabeza)} (redondeado ↑)${calculo.presupuestoCompleto ? '' : ' · Provisorio'}` : 'Sin pagadores: costo por persona no disponible.',
    !calculo.presupuestoCompleto ? `Faltan precios: ${calculo.preciosFaltantes.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function compartirPorWhatsapp() {
  confirmarCambios();
  if (!calculoActual.totalPersonas || !calculoActual.perfilesValidos) return;
  const url = `https://wa.me/?text=${encodeURIComponent(textoResumen(calculoActual))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function abrirListaCompras() {
  confirmarCambios();
  if (!calculoActual.totalPersonas || !calculoActual.perfilesValidos) return;
  elementos.contenidoLista.textContent = textoResumen(calculoActual);
  if (typeof elementos.modalLista.showModal === 'function') {
    elementos.modalLista.showModal();
  } else {
    elementos.modalLista.setAttribute('open', 'open');
  }
}

async function copiarLista() {
  const textoOriginal = elementos.copiarLista.textContent;
  try {
    await navigator.clipboard.writeText(elementos.contenidoLista.textContent);
    elementos.copiarLista.textContent = '¡Copiado! ✅';
  } catch {
    elementos.copiarLista.textContent = 'No se pudo copiar';
  } finally {
    window.setTimeout(() => {
      elementos.copiarLista.textContent = textoOriginal;
    }, 2000);
  }
}

function cerrarLista() {
  if (typeof elementos.modalLista.close === 'function') {
    elementos.modalLista.close();
  } else {
    elementos.modalLista.removeAttribute('open');
  }
}

function puntuarVentana(slot) {
  let score = 100;
  score -= Math.max(0, slot.viento - 15) * 1.4;
  score -= Math.max(0, 8 - slot.temperatura) * 2;
  score -= Math.max(0, slot.temperatura - 22) * 1.5;
  return Math.max(0, Math.round(score));
}

// Consulta Open-Meteo y muestra las 3 mejores ventanas próximas para encender el fuego.
async function cargarPronostico() {
  elementos.resumenPronostico.textContent = 'Consultando Open-Meteo...';
  elementos.tablaPronostico.replaceChildren();

  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=-51.623&longitude=-69.2168&hourly=temperature_2m,wind_speed_10m&forecast_days=2&timezone=America%2FArgentina%2FBuenos_Aires&wind_speed_unit=kmh';
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error('Sin respuesta de Open-Meteo');

    const datos = await respuesta.json();
    const ahora = new Date();
    const ventanas = datos.hourly.time
      .map((hora, indice) => ({
        hora,
        temperatura: Math.round(datos.hourly.temperature_2m[indice]),
        viento: Math.round(datos.hourly.wind_speed_10m[indice]),
      }))
      .filter((slot) => {
        const fecha = new Date(slot.hora);
        const hora = fecha.getHours();
        return hora >= 11 && hora <= 23 && fecha > ahora;
      })
      .map((slot) => ({ ...slot, score: puntuarVentana(slot) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (ventanas.length === 0) throw new Error('No hay ventanas útiles');

    elementos.resumenPronostico.textContent = `Mejor horario sugerido: ${formatearHora(
      ventanas[0].hora
    )}.`;
    ventanas.forEach((ventana) => elementos.tablaPronostico.append(renderizarVentana(ventana)));
  } catch {
    elementos.resumenPronostico.textContent =
      'Sin conexión con Open-Meteo. Usá la temperatura y el viento manuales.';
  }
}

function renderizarVentana(slot) {
  const fila = crearNodo('article', 'fila-pronostico');
  const contenido = crearNodo('div');
  const hora = crearNodo('strong', '', formatearHora(slot.hora));
  const detalle = crearNodo(
    'span',
    '',
    `${FORMATO_AR.format(slot.temperatura)} °C · viento ${FORMATO_AR.format(slot.viento)} km/h`
  );
  const badge = crearNodo('span', 'badge', `${FORMATO_AR.format(slot.score)} pts`);

  contenido.append(hora, detalle);
  fila.append(contenido, badge);
  return fila;
}

function formatearHora(fechaIso) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fechaIso));
}

function resetearFormulario() {
  aplicarEstadoFormulario(ESTADO_INICIAL);
  escribirAlmacenamiento(STORAGE_ESTADO, null);
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    elementos.estadoConexion.textContent = 'Uso offline no disponible';
    return;
  }

  // No se recarga durante la edición: el usuario decide cuándo activar la versión nueva.
  let actualizarSolicitado = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (actualizarSolicitado) window.location.reload();
  });
  const iniciar = async () => {
    try {
      const registro = await navigator.serviceWorker.register('./sw.js');
      const ofrecerActualizacion = () => {
        if (!registro.waiting) return;
        elementos.actualizarApp.hidden = false;
        elementos.actualizarApp.onclick = () => {
          if (!registro.waiting) return;
          confirmarCambios();
          actualizarSolicitado = true;
          registro.waiting.postMessage({ tipo: 'ACTIVAR_ACTUALIZACION' });
        };
      };
      ofrecerActualizacion();
      registro.addEventListener('updatefound', () => {
        registro.installing?.addEventListener('statechange', ofrecerActualizacion);
      });
      await navigator.serviceWorker.ready;
      offlinePreparado = true;
      actualizarEstadoConexion();
    } catch {
      elementos.estadoConexion.textContent = 'Uso offline no disponible';
    }
  };
  if (document.readyState === 'complete') iniciar();
  else window.addEventListener('load', iniciar, { once: true });
}

function actualizarEstadoConexion() {
  elementos.estadoConexion.textContent = offlinePreparado
    ? navigator.onLine ? 'Disponible offline' : 'Modo offline'
    : navigator.onLine ? 'Preparando uso offline' : 'Sin conexión';
}

function configurarEventos() {
  elementos.formulario.addEventListener('submit', (evento) => evento.preventDefault());
  $('#formularioAjustes').addEventListener('submit', (evento) => evento.preventDefault());
  elementos.abrirAjustes.addEventListener('click', () => elementos.modalAjustes.showModal());
  elementos.cerrarAjustes.addEventListener('click', () => elementos.modalAjustes.close());
  prepararInputs();
  elementos.guardarAsado.addEventListener('click', guardarAsado);
  elementos.compartirWhatsapp.addEventListener('click', compartirPorWhatsapp);
  elementos.generarLista.addEventListener('click', abrirListaCompras);
  elementos.btnReset.addEventListener('click', resetearFormulario);
  elementos.cerrarLista.addEventListener('click', cerrarLista);
  elementos.imprimirLista.addEventListener('click', () => window.print());
  elementos.copiarLista.addEventListener('click', copiarLista);
  elementos.actualizarPronostico.addEventListener('click', cargarPronostico);

  window.addEventListener('online', actualizarEstadoConexion);
  window.addEventListener('offline', actualizarEstadoConexion);
}

configurarEventos();
restaurarEstadoFormulario();
renderizarHistorial();
registrarServiceWorker();
