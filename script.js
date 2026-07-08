/*
  CHANGELOG
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

const ESTADO_INICIAL = {
  pagadores: 12,
  gratis: 0,
  modo: 'premium',
  entorno: 'chulengo',
  temperatura: 8,
  viento: 25,
  precioCarne: '',
  precioCarbon: '',
  extras: '',
};

const MODOS_COMPRA = {
  premium: {
    etiqueta: 'Premium',
    kgCarnePorPersona: 0.57,
    vacio: 0.7,
    tira: 0.3,
    pollo: 0,
    chorizosPorPersona: 0.65,
  },
  economico: {
    etiqueta: 'Económico',
    kgCarnePorPersona: 0.48,
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
  temperatura: $('#temperatura'),
  viento: $('#viento'),
  precioCarne: $('#precioCarne'),
  precioCarbon: $('#precioCarbon'),
  extras: $('#extras'),
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
  const numero = Number(String(valor ?? '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.floor(numero);
}

function leerEnteroInput(input) {
  return parsearEnteroPositivo(input.value);
}

function leerNumeroClimatico(input, minimo, maximo) {
  const valor = Number.parseFloat(String(input.value).replace(',', '.'));
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

function debounceRender() {
  window.clearTimeout(temporizadorRender);
  temporizadorRender = window.setTimeout(() => {
    actualizarTodo();
    guardarEstadoFormulario();
  }, DEBOUNCE_MS);
}

function obtenerEstado() {
  const modo = $('input[name="modoCompra"]:checked')?.value || ESTADO_INICIAL.modo;
  const entorno = $('input[name="entorno"]:checked')?.value || ESTADO_INICIAL.entorno;

  return {
    pagadores: leerEnteroInput(elementos.personasPagas),
    gratis: leerEnteroInput(elementos.invitadosGratis),
    modo,
    entorno,
    temperatura: leerNumeroClimatico(elementos.temperatura, -15, 35),
    viento: leerNumeroClimatico(elementos.viento, 0, 120),
    precioCarne: leerEnteroInput(elementos.precioCarne),
    precioCarbon: leerEnteroInput(elementos.precioCarbon),
    extras: leerEnteroInput(elementos.extras),
  };
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
  const totalPersonas = estado.pagadores + estado.gratis;
  const modo = MODOS_COMPRA[estado.modo] || MODOS_COMPRA.premium;
  const kgCarneTotal = redondear(totalPersonas * modo.kgCarnePorPersona, 1);
  const kgVacio = redondear(kgCarneTotal * modo.vacio, 1);
  const kgTira = redondear(kgCarneTotal * modo.tira, 1);
  const kgPollo = redondear(kgCarneTotal * modo.pollo, 1);
  const chorizos = Math.ceil(totalPersonas * modo.chorizosPorPersona);
  const morcillas = Math.ceil(totalPersonas * 0.35);
  const factorTermico = calcularFactorTermico(estado.temperatura, estado.viento, estado.entorno);
  const carbonBaseKg = Math.max(3, kgCarneTotal * 0.95 + chorizos * 0.06);
  const lenaBaseKg = Math.max(2, kgCarneTotal * 0.48);
  const carbonKg = redondear(carbonBaseKg * factorTermico, 1);
  const lenaKg = redondear(lenaBaseKg * factorTermico, 1);
  const bolsasCarbon = Math.ceil(carbonKg / 4);
  const porciones = Math.max(0, Math.round((kgCarneTotal * 1000) / PORCION_ESTANDAR_GRAMOS));
  const totalEstimado =
    kgCarneTotal * estado.precioCarne + bolsasCarbon * estado.precioCarbon + estado.extras;
  const costoPorCabeza = estado.pagadores > 0 ? Math.ceil(totalEstimado / estado.pagadores) : 0;

  return {
    ...estado,
    totalPersonas,
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
  };
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
  const cards = [
    crearCard({
      emoji: '🥩',
      alt: 'Carne',
      titulo: 'Carne total',
      valor: formatearKg(calculo.kgCarneTotal),
      detalle: `${calculo.porciones} porciones aprox. de ${PORCION_ESTANDAR_GRAMOS} g`,
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
    crearCard({
      emoji: '💰',
      alt: 'Presupuesto',
      titulo: 'Total estimado',
      valor: formatearMoneda(calculo.totalEstimado),
      detalle: `${formatearMoneda(calculo.costoPorCabeza)} por persona (redondeado ↑)`,
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
}

function renderizarIndicadores(calculo) {
  if (calculo.totalPersonas === 0) {
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
}

function sincronizarSlider() {
  const pagadores = leerEnteroInput(elementos.personasPagas);
  elementos.sliderPersonas.value = Math.min(Number(elementos.sliderPersonas.max), pagadores);
}

function guardarEstadoFormulario() {
  if (restaurandoEstado) return;

  const estado = {
    ...obtenerEstado(),
    precioCarne: elementos.precioCarne.value,
    precioCarbon: elementos.precioCarbon.value,
    extras: elementos.extras.value,
  };
  window.localStorage.setItem(STORAGE_ESTADO, JSON.stringify(estado));
}

function aplicarEstadoFormulario(estado) {
  restaurandoEstado = true;
  elementos.personasPagas.value = String(parsearEnteroPositivo(estado.pagadores));
  elementos.invitadosGratis.value = String(parsearEnteroPositivo(estado.gratis));
  elementos.temperatura.value = String(estado.temperatura ?? ESTADO_INICIAL.temperatura);
  elementos.viento.value = String(estado.viento ?? ESTADO_INICIAL.viento);
  elementos.precioCarne.value = estado.precioCarne === 0 ? '' : String(estado.precioCarne ?? '');
  elementos.precioCarbon.value = estado.precioCarbon === 0 ? '' : String(estado.precioCarbon ?? '');
  elementos.extras.value = estado.extras === 0 ? '' : String(estado.extras ?? '');

  marcarRadio('modoCompra', estado.modo || ESTADO_INICIAL.modo);
  marcarRadio('entorno', estado.entorno || ESTADO_INICIAL.entorno);
  restaurandoEstado = false;
  actualizarTodo();
}

function marcarRadio(nombre, valor) {
  const radio = $(`input[name="${nombre}"][value="${valor}"]`);
  if (radio) radio.checked = true;
}

function restaurarEstadoFormulario() {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(STORAGE_ESTADO) || 'null');
    aplicarEstadoFormulario(guardado || ESTADO_INICIAL);
  } catch {
    window.localStorage.removeItem(STORAGE_ESTADO);
    aplicarEstadoFormulario(ESTADO_INICIAL);
  }
}

function normalizarCampoEntero(input) {
  input.value = String(leerEnteroInput(input));
}

function normalizarCampoPrecio(input) {
  const valor = leerEnteroInput(input);
  input.value = valor > 0 ? String(valor) : '';
  input.dataset.formateado = valor > 0 ? valor.toLocaleString('es-AR') : '';
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
  [elementos.personasPagas, elementos.invitadosGratis].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      normalizarCampoEntero(input);
      actualizarTodo();
      guardarEstadoFormulario();
    });
  });

  [elementos.precioCarne, elementos.precioCarbon, elementos.extras].forEach((input) => {
    input.addEventListener('keydown', bloquearDecimalPrecio);
    input.addEventListener('paste', bloquearPegadoNoEntero);
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      normalizarCampoPrecio(input);
      actualizarTodo();
      guardarEstadoFormulario();
    });
  });

  [elementos.temperatura, elementos.viento].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', guardarEstadoFormulario);
  });

  elementos.sliderPersonas.addEventListener('input', () => {
    elementos.personasPagas.value = elementos.sliderPersonas.value;
    debounceRender();
  });
  elementos.sliderPersonas.addEventListener('change', guardarEstadoFormulario);

  $$('input[name="modoCompra"], input[name="entorno"]').forEach((input) => {
    input.addEventListener('change', () => {
      actualizarTodo();
      guardarEstadoFormulario();
    });
  });
}

function guardarAsado() {
  if (!calculoActual) return;

  const historial = leerHistorial();
  historial.unshift({
    fecha: new Date().toISOString(),
    calculo: { ...calculoActual },
  });
  window.localStorage.setItem(STORAGE_HISTORIAL, JSON.stringify(historial.slice(0, 10)));
  renderizarHistorial();
}

function leerHistorial() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_HISTORIAL) || '[]');
  } catch {
    window.localStorage.removeItem(STORAGE_HISTORIAL);
    return [];
  }
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
    `Total ${formatearMoneda(calculo.totalEstimado || item.total || 0)} · Por cabeza ${formatearMoneda(
      calculo.costoPorCabeza || item.porCabeza || 0
    )}`
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
    modo: calculo.modo,
    entorno: calculo.entorno,
    temperatura: calculo.temperatura,
    viento: calculo.viento,
    precioCarne: calculo.precioCarne || '',
    precioCarbon: calculo.precioCarbon || '',
    extras: calculo.extras || '',
  });
  guardarEstadoFormulario();
}

function borrarHistorial() {
  if (!window.confirm('¿Borrar todo el historial de asados?')) return;
  window.localStorage.removeItem(STORAGE_HISTORIAL);
  renderizarHistorial();
}

function textoResumen(calculo) {
  return [
    'Asado Pro Río Gallegos',
    `Personas: ${FORMATO_AR.format(calculo.totalPersonas)} (${FORMATO_AR.format(
      calculo.pagadores
    )} pagan, ${FORMATO_AR.format(calculo.gratis)} sin pago)`,
    `Modo: ${MODOS_COMPRA[calculo.modo].etiqueta}`,
    `Carne total: ${formatearKg(calculo.kgCarneTotal)} (${calculo.porciones} porciones)`,
    `Vacío: ${formatearKg(calculo.kgVacio)}`,
    `Tira/costilla: ${formatearKg(calculo.kgTira)}`,
    calculo.kgPollo > 0 ? `Pollo: ${formatearKg(calculo.kgPollo)}` : null,
    `Chorizos: ${FORMATO_AR.format(calculo.chorizos)} unidades`,
    `Morcillas: ${FORMATO_AR.format(calculo.morcillas)} unidades`,
    `Carbón: ${formatearKg(calculo.carbonKg)} (${FORMATO_AR.format(calculo.bolsasCarbon)} bolsas)`,
    `Leña: ${formatearKg(calculo.lenaKg)}`,
    `Costo total: ${formatearMoneda(calculo.totalEstimado)}`,
    `Por cabeza: ${formatearMoneda(calculo.costoPorCabeza)} (redondeado ↑)`,
  ]
    .filter(Boolean)
    .join('\n');
}

function compartirPorWhatsapp() {
  if (!calculoActual) return;
  const url = `https://wa.me/?text=${encodeURIComponent(textoResumen(calculoActual))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function abrirListaCompras() {
  if (!calculoActual) return;
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
  window.localStorage.removeItem(STORAGE_ESTADO);
  aplicarEstadoFormulario(ESTADO_INICIAL);
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => {
        elementos.estadoConexion.textContent = navigator.onLine ? 'Online + offline' : 'Modo offline';
      })
      .catch(() => {
        elementos.estadoConexion.textContent = 'Sin service worker';
      });
  });
}

function configurarEventos() {
  prepararInputs();
  elementos.guardarAsado.addEventListener('click', guardarAsado);
  elementos.compartirWhatsapp.addEventListener('click', compartirPorWhatsapp);
  elementos.generarLista.addEventListener('click', abrirListaCompras);
  elementos.btnReset.addEventListener('click', resetearFormulario);
  elementos.cerrarLista.addEventListener('click', cerrarLista);
  elementos.imprimirLista.addEventListener('click', () => window.print());
  elementos.copiarLista.addEventListener('click', copiarLista);
  elementos.actualizarPronostico.addEventListener('click', cargarPronostico);

  window.addEventListener('online', () => {
    elementos.estadoConexion.textContent = 'Online + offline';
  });
  window.addEventListener('offline', () => {
    elementos.estadoConexion.textContent = 'Modo offline';
  });
}

configurarEventos();
restaurarEstadoFormulario();
renderizarHistorial();
registrarServiceWorker();
