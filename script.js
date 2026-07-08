/*
  CHANGELOG
  - Implementé la calculadora completa en JavaScript vanilla.
  - Corregí formato argentino, porciones coherentes, factor térmico para carbón/leña,
    invitados sin pago, validación de precios, debounce, historial, WhatsApp,
    lista imprimible, pronóstico y service worker.
*/
const FORMATO_AR = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

const PESOS_AR = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

const STORAGE_HISTORIAL = 'asadoProHistorialVanilla';
const PORCION_ESTANDAR_GRAMOS = 450;
const DEBOUNCE_MS = 300;

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

function formatearDecimal(valor, maximos = 1) {
  return Number(valor).toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(Number(valor)) ? 0 : 1,
    maximumFractionDigits: maximos,
  });
}

function formatearKg(valor) {
  return `${formatearDecimal(valor)} kg`;
}

function formatearMoneda(valor) {
  return `$${PESOS_AR.format(Math.max(0, Number(valor) || 0))}`;
}

function enteroPositivoDesdeInput(input, permiteSeparadorMiles = false) {
  const patronLimpieza = permiteSeparadorMiles ? /[^\d.]/g : /[^\d]/g;
  const visible = String(input.value || '').replace(patronLimpieza, '');
  const limpio = visible.replace(/\./g, '');
  if (input.value !== visible) input.value = visible;
  return limpio === '' ? 0 : Math.max(0, Number.parseInt(limpio, 10));
}

function numeroClimaticoDesdeInput(input, minimo, maximo) {
  const valor = Number.parseFloat(String(input.value).replace(',', '.'));
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}

function debounceRender() {
  window.clearTimeout(temporizadorRender);
  temporizadorRender = window.setTimeout(actualizarTodo, DEBOUNCE_MS);
}

function obtenerEstado() {
  const modo = $('input[name="modoCompra"]:checked')?.value || 'premium';
  const entorno = $('input[name="entorno"]:checked')?.value || 'chulengo';

  return {
    pagadores: enteroPositivoDesdeInput(elementos.personasPagas),
    gratis: enteroPositivoDesdeInput(elementos.invitadosGratis),
    modo,
    entorno,
    temperatura: numeroClimaticoDesdeInput(elementos.temperatura, -15, 35),
    viento: numeroClimaticoDesdeInput(elementos.viento, 0, 120),
    precioCarne: enteroPositivoDesdeInput(elementos.precioCarne, true),
    precioCarbon: enteroPositivoDesdeInput(elementos.precioCarbon, true),
    extras: enteroPositivoDesdeInput(elementos.extras, true),
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
  const modo = MODOS_COMPRA[estado.modo];
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

function crearCard({ emoji, alt, titulo, valor, detalle }) {
  return `
    <article class="card-resultado">
      <div class="card-resultado__arriba">
        <div class="card-resultado__titulo">${titulo}</div>
        <span class="card-resultado__emoji" aria-hidden="true">${emoji}</span>
        <span class="sr-only">${alt}</span>
      </div>
      <div class="card-resultado__valor">${valor}</div>
      <div class="card-resultado__detalle">${detalle}</div>
    </article>
  `;
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
      detalle: `${formatearMoneda(calculo.costoPorCabeza)} por persona que paga`,
    }),
  ];

  if (calculo.kgPollo > 0) {
    cards.splice(
      3,
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

  elementos.resultadoCards.innerHTML = cards.join('');
}

function renderizarComensales(calculo) {
  elementos.resumenComensales.innerHTML = `
    <strong>${FORMATO_AR.format(calculo.totalPersonas)} personas comen</strong><br />
    ${FORMATO_AR.format(calculo.pagadores)} pagan ·
    ${FORMATO_AR.format(calculo.gratis)} invitados sin pago ·
    modo ${MODOS_COMPRA[calculo.modo].etiqueta.toLowerCase()}
  `;

  const cantidadEmojis = Math.min(calculo.pagadores, 24);
  elementos.emojisPersonas.textContent =
    cantidadEmojis > 0 ? '👤'.repeat(cantidadEmojis) : 'Sin pagadores';
  elementos.textoPersonas.textContent = `${calculo.pagadores} personas que pagan seleccionadas`;
}

function renderizarIndicadores(calculo) {
  if (calculo.kgCarneTotal > 10) {
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
  const pagadores = enteroPositivoDesdeInput(elementos.personasPagas);
  elementos.sliderPersonas.value = Math.min(Number(elementos.sliderPersonas.max), pagadores);
}

function prepararInputs() {
  [elementos.personasPagas, elementos.invitadosGratis].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      if (input.value === '') input.value = '0';
      actualizarTodo();
    });
  });

  [elementos.precioCarne, elementos.precioCarbon, elementos.extras].forEach((input) => {
    input.addEventListener('input', debounceRender);
    input.addEventListener('blur', () => {
      const valor = enteroPositivoDesdeInput(input, true);
      input.value = PESOS_AR.format(valor);
      actualizarTodo();
    });
  });

  [elementos.temperatura, elementos.viento].forEach((input) => {
    input.addEventListener('input', debounceRender);
  });

  elementos.sliderPersonas.addEventListener('input', () => {
    elementos.personasPagas.value = elementos.sliderPersonas.value;
    debounceRender();
  });

  $$('input[name="modoCompra"], input[name="entorno"]').forEach((input) => {
    input.addEventListener('change', actualizarTodo);
  });
}

function guardarAsado() {
  if (!calculoActual) return;

  const historial = leerHistorial();
  historial.unshift({
    fecha: new Date().toISOString(),
    personas: calculoActual.totalPersonas,
    total: calculoActual.totalEstimado,
    porCabeza: calculoActual.costoPorCabeza,
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
  if (historial.length === 0) {
    elementos.historialAsados.innerHTML = '<p class="ayuda">Todavía no hay asados guardados.</p>';
    return;
  }

  elementos.historialAsados.innerHTML = historial
    .map((item) => {
      const fecha = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(item.fecha));
      return `
        <div class="historial-item">
          <strong>${fecha} · ${FORMATO_AR.format(item.personas)} personas</strong>
          <span>Total ${formatearMoneda(item.total)} · Por cabeza ${formatearMoneda(item.porCabeza)}</span>
        </div>
      `;
    })
    .join('');
}

function textoResumen(calculo) {
  return [
    'Asado Pro Río Gallegos',
    `Personas: ${FORMATO_AR.format(calculo.totalPersonas)} (${FORMATO_AR.format(calculo.pagadores)} pagan, ${FORMATO_AR.format(calculo.gratis)} sin pago)`,
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
    `Por cabeza: ${formatearMoneda(calculo.costoPorCabeza)}`,
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
  await navigator.clipboard.writeText(elementos.contenidoLista.textContent);
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
  return Math.max(0, Math.round(score));
}

// Consulta Open-Meteo y muestra las 3 mejores ventanas próximas para encender el fuego.
async function cargarPronostico() {
  elementos.resumenPronostico.textContent = 'Consultando Open-Meteo...';
  elementos.tablaPronostico.innerHTML = '';

  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=-51.623&longitude=-69.2168&hourly=temperature_2m,wind_speed_10m&forecast_days=2&timezone=America%2FArgentina%2FBuenos_Aires&wind_speed_unit=kmh';
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error('Sin respuesta de Open-Meteo');

    const datos = await respuesta.json();
    const ventanas = datos.hourly.time
      .map((hora, indice) => ({
        hora,
        temperatura: Math.round(datos.hourly.temperature_2m[indice]),
        viento: Math.round(datos.hourly.wind_speed_10m[indice]),
      }))
      .filter((slot) => {
        const hora = new Date(slot.hora).getHours();
        return hora >= 11 && hora <= 23 && new Date(slot.hora) > new Date();
      })
      .map((slot) => ({ ...slot, score: puntuarVentana(slot) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (ventanas.length === 0) throw new Error('No hay ventanas útiles');

    elementos.resumenPronostico.textContent = `Mejor horario sugerido: ${formatearHora(
      ventanas[0].hora
    )}.`;
    elementos.tablaPronostico.innerHTML = ventanas.map(renderizarVentana).join('');
  } catch {
    elementos.resumenPronostico.textContent =
      'Sin conexión con Open-Meteo. Usá la temperatura y el viento manuales.';
  }
}

function renderizarVentana(slot) {
  return `
    <article class="fila-pronostico">
      <div>
        <strong>${formatearHora(slot.hora)}</strong>
        <span>${FORMATO_AR.format(slot.temperatura)} °C · viento ${FORMATO_AR.format(slot.viento)} km/h</span>
      </div>
      <span class="badge">${FORMATO_AR.format(slot.score)} pts</span>
    </article>
  `;
}

function formatearHora(fechaIso) {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(fechaIso));
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

function formatearPreciosIniciales() {
  [elementos.precioCarne, elementos.precioCarbon, elementos.extras].forEach((input) => {
    input.value = PESOS_AR.format(enteroPositivoDesdeInput(input, true));
  });
}

configurarEventos();
formatearPreciosIniciales();
actualizarTodo();
renderizarHistorial();
cargarPronostico();
registrarServiceWorker();
