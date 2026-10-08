/*
  CHANGELOG
  - Recuperé enlaces React y copias históricas sin inventar datos faltantes ni borrar originales.
  - Agregué evaluaciones idempotentes y ajuste explícito de carne, independiente de los gramajes base.
  - Versioné enlaces con el factor aplicado y mantuve lectura de enlaces vanilla anteriores.
  - Agregué achuras optativas y enlaces versionados con validación y confirmación de carga.
  - Recuperé cortes, rendimiento opcional, cordero por media res y bebidas.
  - Agregué lista editable persistente compartida con impresión e historial.
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
const STORAGE_ARCHIVO_REACT = 'asadoProArchivoReact';
const MAXIMO_ARCHIVO_REACT = 100;
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
  tipoCarne: 'automatico',
  ajustarPorCorte: false,
  factorCompra: 1,
  incluirExtras: false,
  panGeneroso: false,
  ensaladaAbundante: false,
  adultosBebedores: 0,
  personasAchuras: 0,
  listaEdiciones: {},
  listaPersonalizados: [],
  entorno: 'chulengo',
  temperatura: 8,
  viento: 25,
  precioCarne: '',
  precioCarbon: '',
  precioPollo: '',
  precioCerdo: '',
  precioCordero: '',
  precioChorizo: '',
  precioMorcilla: '',
  precioAchuras: '',
  precioLena: '',
  extras: '',
};

const CLAVES_PRECIOS = [
  'precioCarne', 'precioCarbon', 'precioPollo', 'precioChorizo',
  'precioMorcilla', 'precioAchuras', 'precioLena', 'precioCerdo', 'precioCordero', 'extras',
];

// Rendimientos orientativos y gramajes recuperados de la versión avanzada.
// El ajuste es optativo: por defecto se mantienen los 750/500/250 g crudos solicitados.
const TIPOS_CARNE = {
  automatico: { etiqueta: 'Según modo de compra' },
  premium: { etiqueta: 'Vacío y tira', mix: [0.5, 0.5, 0, 0], gramos: [720, 490, 250], rendimiento: 0.765 },
  con_hueso: { etiqueta: 'Vacuno con hueso', mix: [0, 1, 0, 0], gramos: [880, 590, 300], rendimiento: 0.6 },
  sin_hueso: { etiqueta: 'Vacuno sin hueso', mix: [1, 0, 0, 0], gramos: [600, 400, 200], rendimiento: 0.93 },
  cerdo: { etiqueta: 'Cerdo', mix: [0, 0, 0, 1], gramos: [620, 420, 210], rendimiento: 0.9 },
  pollo: { etiqueta: 'Pollo con hueso', mix: [0, 0, 1, 0], gramos: [820, 550, 280], rendimiento: 0.65 },
  mixto_cerdo: { etiqueta: 'Vacuno + cerdo', mix: [0.45, 0.25, 0, 0.3], gramos: [660, 450, 230], rendimiento: 0.8385 },
  mixto_pollo: { etiqueta: 'Vacuno + pollo', mix: [0.25, 0.35, 0.4, 0], gramos: [760, 520, 260], rendimiento: 0.7025 },
  cordero: { etiqueta: 'Cordero patagónico', mix: [0, 0, 0, 0], gramos: [950, 650, 330], rendimiento: 0.55 },
};
const CLAVES_OPCIONES = ['tipoCarne', 'ajustarPorCorte', 'factorCompra', 'incluirExtras', 'panGeneroso', 'ensaladaAbundante', 'adultosBebedores', 'personasAchuras'];
const CLAVES_CHECKS = ['ajustarPorCorte', 'incluirExtras', 'panGeneroso', 'ensaladaAbundante'];
let listaEdiciones = {};
let listaPersonalizados = [];
let asadoCompartidoPendiente = null;
const VERSION_ENLACE = 2;
const EVALUACIONES_CARNE = {
  perfecto: { etiqueta: 'Justo', delta: 0 },
  sobro: { etiqueta: 'Sobró', delta: -0.05 },
  falto: { etiqueta: 'Faltó', delta: 0.12 },
};
const MAXIMO_ENLACE = 12000;
const CLAVES_ENLACE = Object.keys(ESTADO_INICIAL).filter((clave) => !clave.startsWith('lista'));

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
  precioCerdo: $('#precioCerdo'),
  precioCordero: $('#precioCordero'),
  precioChorizo: $('#precioChorizo'),
  precioMorcilla: $('#precioMorcilla'),
  precioAchuras: $('#precioAchuras'),
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
  copiarEnlace: $('#copiarEnlace'),
  modalCompartido: $('#modalCompartido'),
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
  ...Object.fromEntries(CLAVES_OPCIONES.map((clave) => [clave, $(`#${clave}`)])),
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

// El factor es optativo y finito, entre 0,60 y 1,50, con pasos de un punto porcentual.
// Ante datos corruptos se conserva la base (1x), no una reducción automática.
function normalizarFactor(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number' || valor === '') return 1;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0.6 && numero <= 1.5 ? Math.round(numero * 100) / 100 : 1;
}

// Se calcula siempre desde el factor del asado evaluado, nunca por clics acumulados.
function sugerirFactor(calculo, evaluacion) {
  const base = normalizarFactor(calculo.factorCompra);
  if (!Object.hasOwn(EVALUACIONES_CARNE, evaluacion)) return base;
  return redondear(Math.min(1.5, Math.max(0.6, base + EVALUACIONES_CARNE[evaluacion].delta)), 2);
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
    factorCompra: normalizarFactor(estado.factorCompra),
    tipoCarne: Object.hasOwn(TIPOS_CARNE, estado.tipoCarne) ? estado.tipoCarne : 'automatico',
    ...Object.fromEntries(CLAVES_CHECKS.map((clave) => [clave, estado[clave] === true
      && (clave !== 'ajustarPorCorte' || Object.hasOwn(TIPOS_CARNE, estado.tipoCarne) && estado.tipoCarne !== 'automatico')])),
    adultosBebedores: parsearEnteroPositivo(estado.adultosBebedores),
    personasAchuras: parsearEnteroPositivo(estado.personasAchuras),
    ...normalizarLista(estado),
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
    tipoCarne: elementos.tipoCarne.value,
    factorCompra: elementos.factorCompra.value,
    ...Object.fromEntries(CLAVES_CHECKS.map((clave) => [clave, elementos[clave].checked])),
    adultosBebedores: elementos.adultosBebedores.value,
    personasAchuras: elementos.personasAchuras.value,
    listaEdiciones,
    listaPersonalizados,
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
  const corte = TIPOS_CARNE[estado.tipoCarne];
  const gramajes = estado.ajustarPorCorte && corte.gramos ? corte.gramos : Object.values(GRAMOS_POR_PERFIL);
  const gramosSinPerfil = estado.ajustarPorCorte && corte.gramos ? corte.gramos[1] : GRAMOS_SIN_PERFIL;
  const totalPerfiles = CLAVES_PERFILES.reduce((suma, clave) => suma + estado[clave], 0);
  const perfilesValidos = totalPerfiles <= totalPersonas;
  const sinPerfil = Math.max(0, totalPersonas - totalPerfiles);
  // Carne cruda: hombres × 750 + mujeres × 500 + niños × 250 + sin perfil × 500 g.
  // La compra se redondea hacia arriba a 100 g, sin reducir la base solicitada.
  const gramosCarneBase = perfilesValidos ? CLAVES_PERFILES.reduce(
    (suma, clave, indice) => suma + estado[clave] * gramajes[indice], sinPerfil * gramosSinPerfil
  ) : 0;
  // Porcentajes enteros evitan que el error binario de 1.12 eleve compras exactas a 100 g extra.
  const porcentajeCompra = Math.round(estado.factorCompra * 100);
  const gramosCarneTotal = gramosCarneBase * porcentajeCompra / 100;
  const mediasReses = estado.tipoCarne === 'cordero' ? Math.ceil(gramosCarneBase * porcentajeCompra / 625000) : 0;
  const kgCordero = mediasReses * 6.25;
  const kgCarneTotal = estado.tipoCarne === 'cordero' ? kgCordero : Math.ceil(gramosCarneBase * porcentajeCompra / 10000) / 10;
  const hayComensales = perfilesValidos && totalPersonas > 0;
  const mezcla = corte.mix ? { vacio: corte.mix[0], tira: corte.mix[1], pollo: corte.mix[2], cerdo: corte.mix[3] } : modo;
  const [kgVacio, kgTira, kgPollo, kgCerdo] = estado.tipoCarne === 'cordero'
    ? [0, 0, 0, 0] : repartirCortes(kgCarneTotal, mezcla);
  const rendimiento = kgCarneTotal === 0 ? 0 : kgCordero > 0 ? 0.55
    : (kgVacio * 0.93 + kgTira * 0.6 + kgPollo * 0.65 + kgCerdo * 0.9) / kgCarneTotal;
  const chorizos = hayComensales ? Math.ceil(totalPersonas * modo.chorizosPorPersona) : 0;
  const morcillas = hayComensales ? Math.ceil(totalPersonas * 0.35) : 0;
  // Achuras optativas: 120 g crudos adicionales por consumidor explícito,
  // limitados al total de comensales; compra redondeada hacia arriba a 100 g.
  const consumidoresAchuras = hayComensales ? Math.min(estado.personasAchuras, totalPersonas) : 0;
  const kgAchuras = Math.ceil(consumidoresAchuras * 120 / 100) / 10;
  const factorTermico = calcularFactorTermico(estado.temperatura, estado.viento, estado.entorno);
  const carbonBaseKg = hayComensales ? Math.max(3, (kgCarneTotal + kgAchuras) * 0.95 + chorizos * 0.06) : 0;
  const lenaBaseKg = hayComensales ? Math.max(2, (kgCarneTotal + kgAchuras) * 0.48) : 0;
  const carbonKg = redondear(carbonBaseKg * factorTermico, 1);
  const lenaKg = redondear(lenaBaseKg * factorTermico, 1);
  const bolsasCarbon = Math.ceil(carbonKg / 4);
  const porciones = Math.max(0, Math.round((kgCarneTotal * 1000) / PORCION_ESTANDAR_GRAMOS));
  const rubros = [
    ['Vacuno', redondear(kgVacio + kgTira, 1), 'precioCarne'],
    ['Pollo', kgPollo, 'precioPollo'],
    ['Cerdo', kgCerdo, 'precioCerdo'],
    ['Cordero', kgCordero, 'precioCordero'],
    ['Chorizos', chorizos, 'precioChorizo'],
    ['Morcillas', morcillas, 'precioMorcilla'],
    ['Achuras', kgAchuras, 'precioAchuras'],
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
  if (hayComensales && estado.incluirExtras && estado.extras === '') {
    detallePresupuesto.push({ nombre: 'Bebidas y acompañamientos', cantidad: 1, precio: '', subtotal: null });
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
    gramosCarneBase,
    kgCarneTotal,
    kgVacio,
    kgTira,
    kgPollo,
    kgCerdo,
    kgCordero,
    mediasReses,
    rendimiento,
    kgNetoEstimado: kgCarneTotal * rendimiento,
    gramajes,
    gramosSinPerfil,
    bebidas: calcularBebidas(estado, hayComensales ? totalPersonas : 0),
    chorizos,
    morcillas,
    consumidoresAchuras,
    kgAchuras,
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
  const cortes = [modo.vacio, modo.tira, modo.pollo, modo.cerdo || 0].map((proporcion, indice) => {
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

// Mantiene el peso exacto de medias reses (6,25 kg) al comprar y presupuestar.
function formatearCompraKg(valor) {
  return Number.isInteger(valor * 10) ? formatearKg(valor) : `${formatearDecimal(valor, 2)} kg`;
}

// Las bebidas son optativas; el alcohol requiere una cantidad explícita de adultos.
function calcularBebidas(estado, personas) {
  if (!estado.incluirExtras || personas === 0) return [];
  const ninos = estado.ninos;
  const bebedores = Math.min(estado.adultosBebedores, Math.max(0, personas - ninos));
  const agua = redondear(personas * 0.55 + ninos * 0.25, 1);
  const gaseosa = redondear(personas * 0.45 + ninos * 0.35, 1);
  const cerveza = redondear(bebedores * 1.1, 1);
  return [
    ['agua', 'Agua', agua, 'l', '💧'],
    ['gaseosa', 'Gaseosa / jugo', gaseosa, 'l', '🥤'],
    ['cerveza', 'Cerveza', cerveza, 'l', '🍺'],
    ['vino', 'Vino', Math.ceil(bebedores / 4), 'botellas de 750 ml', '🍷'],
    ['hielo', 'Hielo', Math.max(2, Math.ceil((agua + gaseosa + cerveza) * 0.45)), 'kg', '🧊'],
    ['pan', 'Pan', redondear(personas * (estado.panGeneroso ? 0.13 : 0.09), 1), 'kg', '🍞'],
    ['ensalada', 'Ensalada', redondear(personas * (estado.ensaladaAbundante ? 0.28 : 0.18), 1), 'kg', '🥗'],
    ['papas', 'Papas', redondear(personas * 0.22, 1), 'kg', '🥔'],
    ['provoleta', 'Provoleta', Math.ceil((personas - ninos) / 5), 'unidades', '🧀'],
    ['chimichurri', 'Chimichurri', Math.ceil(personas / 10), 'frascos', '🌿'],
  ].filter(([, , cantidad]) => cantidad > 0).map(([id, nombre, cantidad, unidad, emoji]) => ({
    id, nombre, cantidad, unidad, emoji,
  }));
}

// Limita y valida la lista guardada; ningún texto del usuario se interpreta como HTML.
function normalizarLista(estado) {
  const texto = (valor, limite) => typeof valor === 'string' ? valor.replace(/[\r\n]+/g, ' ').slice(0, limite) : '';
  const idValido = (id) => /^[a-z][a-z0-9_]{0,60}$/.test(id);
  const ediciones = estado.listaEdiciones;
  const entradas = ediciones && typeof ediciones === 'object' && !Array.isArray(ediciones) ? Object.entries(ediciones) : [];
  return {
    listaEdiciones: Object.fromEntries(entradas.filter(([id, item]) => idValido(id) && item && typeof item === 'object')
      .slice(0, 100).map(([id, item]) => [id, {
        nombre: texto(item.nombre, 80), cantidad: texto(item.cantidad, 60),
        comprado: item.comprado === true, excluido: item.excluido === true,
      }])),
    listaPersonalizados: (Array.isArray(estado.listaPersonalizados) ? estado.listaPersonalizados : [])
      .filter((item) => item && typeof item.id === 'string' && /^personal_[0-9_]+$/.test(item.id))
      .slice(0, 30).map((item) => ({ id: item.id, nombre: texto(item.nombre, 80), cantidad: texto(item.cantidad, 60) })),
  };
}

// Genera una única fuente para editar, compartir e imprimir las compras.
function itemsSugeridos(calculo) {
  if (!calculo.totalPersonas || !calculo.perfilesValidos) return [];
  const carnes = [
    ['vacio', 'Vacío', calculo.kgVacio], ['tira', 'Tira/costilla', calculo.kgTira],
    ['pollo', 'Pollo', calculo.kgPollo], ['cerdo', 'Cerdo', calculo.kgCerdo],
    ['cordero', `Cordero (${calculo.mediasReses} medias reses)`, calculo.kgCordero],
  ].filter(([, , cantidad]) => cantidad > 0).map(([id, nombre, cantidad]) => ({ id, nombre, cantidad: formatearCompraKg(cantidad) }));
  return [...carnes,
    { id: 'chorizos', nombre: 'Chorizos', cantidad: `${FORMATO_AR.format(calculo.chorizos)} unidades` },
    { id: 'morcillas', nombre: 'Morcillas', cantidad: `${FORMATO_AR.format(calculo.morcillas)} unidades` },
    ...(calculo.kgAchuras ? [{ id: 'achuras', nombre: 'Achuras', cantidad: formatearKg(calculo.kgAchuras) }] : []),
    { id: 'carbon', nombre: 'Carbón', cantidad: `${formatearKg(calculo.carbonKg)} (${FORMATO_AR.format(calculo.bolsasCarbon)} bolsas)` },
    { id: 'lena', nombre: 'Leña', cantidad: formatearKg(calculo.lenaKg) },
    ...calculo.bebidas.map((item) => ({ id: item.id, nombre: item.nombre, cantidad: `${formatearDecimal(item.cantidad)} ${item.unidad}` })),
  ];
}

function obtenerLista(calculo) {
  if (!calculo.totalPersonas || !calculo.perfilesValidos) return [];
  return [...itemsSugeridos(calculo), ...calculo.listaPersonalizados].map((item) => {
    const edicion = calculo.listaEdiciones[item.id];
    return { ...item, nombre: edicion?.nombre || item.nombre, cantidad: edicion?.cantidad || item.cantidad,
      comprado: edicion?.comprado === true, excluido: edicion?.excluido === true };
  }).filter((item) => !item.excluido);
}

function actualizarProgresoLista() {
  const lista = obtenerLista(calcularAsado(obtenerEstado()));
  $('#progresoLista').textContent = `${lista.filter((item) => item.comprado).length}/${lista.length}`;
}

// Editar no redibuja los inputs: conserva el cursor y la navegación con Tab.
function renderizarListaEditable(calculo) {
  const contenedor = $('#listaEditable');
  contenedor.replaceChildren();
  const lista = obtenerLista(calculo);
  if (!lista.length) contenedor.append(crearNodo('p', 'ayuda', 'Ingresá comensales para preparar las compras.'));
  lista.forEach((item) => {
    const fila = crearNodo('div', 'lista-editable__fila');
    fila.dataset.id = item.id;
    const check = crearNodo('input');
    check.type = 'checkbox';
    check.checked = item.comprado;
    check.setAttribute('aria-label', `Comprado: ${item.nombre}`);
    const campos = crearNodo('div', 'lista-editable__campos');
    const nombre = crearNodo('input');
    nombre.type = 'text'; nombre.value = item.nombre; nombre.maxLength = 80;
    nombre.setAttribute('aria-label', `Producto: ${item.nombre}`);
    const cantidad = crearNodo('input');
    cantidad.type = 'text'; cantidad.value = item.cantidad; cantidad.maxLength = 60;
    cantidad.setAttribute('aria-label', `Cantidad: ${item.nombre}`);
    const actualizar = () => {
      listaEdiciones[item.id] = { nombre: nombre.value, cantidad: cantidad.value, comprado: check.checked, excluido: false };
      guardarEstadoFormulario(); actualizarProgresoLista();
    };
    nombre.addEventListener('input', actualizar);
    cantidad.addEventListener('input', actualizar);
    check.addEventListener('change', actualizar);
    const borrar = crearNodo('button', 'boton-icono', '×');
    borrar.type = 'button'; borrar.title = `Quitar ${item.nombre}`;
    borrar.setAttribute('aria-label', borrar.title);
    borrar.addEventListener('click', () => {
      if (item.id.startsWith('personal_')) {
        listaPersonalizados = listaPersonalizados.filter((otro) => otro.id !== item.id);
        delete listaEdiciones[item.id];
      } else listaEdiciones[item.id] = { ...listaEdiciones[item.id], excluido: true };
      confirmarCambios();
    });
    campos.append(nombre, cantidad); fila.append(check, campos, borrar); contenedor.append(fila);
  });
  $('#agregarItemLista').disabled = !calculo.totalPersonas || !calculo.perfilesValidos || listaPersonalizados.length >= 30;
  actualizarProgresoLista();
}

function crearNodo(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function crearCard({ emoji, alt, titulo, valor, detalle }) {
  const card = crearNodo('article', 'card-resultado');
  card.dataset.rubro = titulo;
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
  $('#valorFactorCompra').textContent = `${formatearDecimal(calculo.factorCompra, 2)}x`;
  $('#resumenCalibracion').textContent = calculo.factorCompra === 1 ? 'Sin ajuste: se mantienen los gramajes base.'
    : `${calculo.factorCompra > 1 ? '+' : ''}${formatearDecimal((calculo.factorCompra - 1) * 100)}% de carne principal. Base: ${formatearKg(calculo.gramosCarneBase / 1000)}; objetivo: ${formatearKg(calculo.gramosCarneTotal / 1000)} antes del redondeo de compra.`;
  elementos.factorCompra.setAttribute('aria-valuetext', `${formatearDecimal(calculo.factorCompra, 2)} veces el gramaje base de carne`);
  $('#campoPrecioAchuras').hidden = calculo.kgAchuras === 0;
  elementos.personasAchuras.max = String(calculo.totalPersonas);
  $('#detalleAchuras').textContent = `120 g crudos por persona, adicionales a la carne principal. Se computan ${FORMATO_AR.format(calculo.consumidoresAchuras)} comensales${calculo.personasAchuras > calculo.totalPersonas ? ' (limitados al total del asado)' : ''}.`;
  $('#campoPrecioCarne').hidden = calculo.kgVacio + calculo.kgTira === 0;
  $('#campoPrecioPollo').hidden = calculo.kgPollo === 0;
  $('#campoPrecioCerdo').hidden = calculo.kgCerdo === 0;
  $('#campoPrecioCordero').hidden = calculo.kgCordero === 0;
  elementos.ajustarPorCorte.disabled = calculo.tipoCarne === 'automatico';
  elementos.ajustarPorCorte.checked = calculo.ajustarPorCorte;
  elementos.adultosBebedores.max = String(Math.max(0, calculo.totalPersonas - calculo.ninos));
  elementos.adultosBebedores.setAttribute('aria-description', `Se calculan como máximo ${elementos.adultosBebedores.max} adultos, excluyendo los niños declarados.`);
  $('#detalleCorte').textContent = `${TIPOS_CARNE[calculo.tipoCarne].etiqueta}. Carne cruda por perfil: ${calculo.gramajes.join(' / ')} g; sin perfil: ${calculo.gramosSinPerfil} g. Rendimiento comestible estimado: ${formatearDecimal(calculo.rendimiento * 100)}%.`;
  const deshabilitar = calculo.totalPersonas === 0 || !calculo.perfilesValidos;
  elementos.guardarAsado.disabled = deshabilitar;
  elementos.compartirWhatsapp.disabled = deshabilitar;
  elementos.generarLista.disabled = deshabilitar;
  elementos.copiarEnlace.disabled = deshabilitar;
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
      valor: formatearCompraKg(calculo.kgCarneTotal),
      detalle: `Carne cruda · ${calculo.porciones} porciones aprox. de ${PORCION_ESTANDAR_GRAMOS} g crudos · ${calculo.mediasReses ? `${calculo.mediasReses} medias reses` : 'compra en múltiplos de 100 g'} · neto comestible estimado ${formatearKg(calculo.kgNetoEstimado)}${calculo.factorCompra === 1 ? '' : ` · ajuste ${formatearDecimal(calculo.factorCompra, 2)}x`}`,
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

  if (!calculo.kgTira) cards.splice(2, 1);
  if (!calculo.kgVacio) cards.splice(1, 1);
  if (calculo.kgAchuras) {
    const indice = cards.findIndex((card) => card.dataset.rubro === 'Morcillas');
    cards.splice(indice + 1, 0, crearCard({ emoji: '🍢', alt: 'Achuras', titulo: 'Achuras', valor: formatearKg(calculo.kgAchuras), detalle: `${calculo.consumidoresAchuras} comensales · adicionales a la carne principal` }));
  }
  if (calculo.kgCerdo) cards.push(crearCard({ emoji: '🥩', alt: 'Cerdo', titulo: 'Cerdo', valor: formatearKg(calculo.kgCerdo), detalle: 'carne cruda sugerida' }));
  if (calculo.kgCordero) cards.push(crearCard({ emoji: '🍖', alt: 'Cordero', titulo: 'Cordero', valor: formatearCompraKg(calculo.kgCordero), detalle: `${calculo.mediasReses} medias reses estimadas de 6,25 kg` }));
  calculo.bebidas.forEach((item) => cards.push(crearCard({ emoji: item.emoji, alt: item.nombre, titulo: item.nombre,
    valor: `${formatearDecimal(item.cantidad)} ${item.unidad}`, detalle: 'incluido en Otros gastos, si cargaste su costo' })));

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
    ? `${calculo.sinPerfil} sin perfil · ${calculo.gramosSinPerfil} g de carne cruda por persona. Perfiles: ${calculo.gramajes.join(' / ')} g.`
    : `Los perfiles suman ${calculo.totalPerfiles}, pero hay ${calculo.totalPersonas} comensales.`;
  CLAVES_PERFILES.forEach((clave) => {
    elementos[clave].setAttribute('aria-invalid', String(!calculo.perfilesValidos));
    $(`label[for="${clave}"] .gramaje`).textContent = `${calculo.gramajes[CLAVES_PERFILES.indexOf(clave)]} g`;
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
  $('#salidaEnlace').hidden = true;
  $('#enlaceGenerado').value = '';
  sincronizarSlider();
  const estado = obtenerEstado();
  calculoActual = calcularAsado(estado);
  renderizarComensales(calculoActual);
  renderizarResultados(calculoActual);
  renderizarIndicadores(calculoActual);
  renderizarListaEditable(calculoActual);
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
  elementos.tipoCarne.value = estado.tipoCarne;
  elementos.adultosBebedores.value = String(estado.adultosBebedores);
  elementos.personasAchuras.value = String(estado.personasAchuras);
  elementos.factorCompra.value = String(estado.factorCompra);
  CLAVES_CHECKS.forEach((clave) => { elementos[clave].checked = estado[clave]; });
  listaEdiciones = estado.listaEdiciones;
  listaPersonalizados = estado.listaPersonalizados;

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
    elementos.adultosBebedores, elementos.personasAchuras, ...CLAVES_PERFILES.map((clave) => elementos[clave])].forEach((input) => {
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
  elementos.factorCompra.addEventListener('input', debounceRender);
  elementos.factorCompra.addEventListener('change', confirmarCambios);
  $('#restablecerFactor').addEventListener('click', () => {
    elementos.factorCompra.value = '1';
    confirmarCambios();
  });
  [elementos.tipoCarne, ...CLAVES_CHECKS.map((clave) => elementos[clave])].forEach((input) => {
    input.addEventListener('change', confirmarCambios);
  });
  $('#agregarItemLista').addEventListener('click', () => {
    if (listaPersonalizados.length >= 30) return;
    const id = `personal_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    listaPersonalizados.push({ id, nombre: 'Otro producto', cantidad: '1 unidad' });
    confirmarCambios();
    $(`[data-id="${id}"] input[type="text"]`)?.focus();
  });
  $('#restaurarLista').addEventListener('click', () => {
    if (!window.confirm('¿Restaurar la lista sugerida y borrar los productos personalizados?')) return;
    listaEdiciones = {}; listaPersonalizados = []; confirmarCambios();
  });

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
    id: `asado_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
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
  }).slice(0, 10).map((item, indice) => ({
    ...item,
    id: typeof item.id === 'string' && /^[a-z0-9_-]{1,80}$/.test(item.id)
      ? item.id : `asado_${Date.parse(item.fecha)}_${indice}`,
    evaluacion: Object.hasOwn(EVALUACIONES_CARNE, item.evaluacion) ? item.evaluacion : '',
  }));
}

// Guardar/corregir una evaluación nunca modifica el formulario ni el cálculo histórico.
function guardarEvaluacionAsado(id, evaluacion) {
  if (evaluacion !== '' && !Object.hasOwn(EVALUACIONES_CARNE, evaluacion)) return false;
  const historial = leerHistorial();
  const item = historial.find((asado) => asado.id === id);
  if (!item) return false;
  if (item.evaluacion === evaluacion) return true;
  item.evaluacion = evaluacion;
  return escribirAlmacenamiento(STORAGE_HISTORIAL, historial);
}

function aplicarSugerenciaAsado(id) {
  const item = leerHistorial().find((asado) => asado.id === id);
  if (!item?.evaluacion) return;
  const factor = sugerirFactor(item.calculo || item, item.evaluacion);
  if (!window.confirm(`¿Aplicar ${formatearDecimal(factor, 2)}x a la carne principal del asado actual? Los demás datos se conservan.`)) return;
  aplicarEstadoFormulario({ ...obtenerEstado(), factorCompra: factor });
  guardarEstadoFormulario();
  if (elementos.modalAjustes.open) elementos.modalAjustes.close();
}

function renderizarHistorial() {
  renderizarArchivoReact();
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
  const evaluacion = crearNodo('div', 'historial-evaluacion');
  const etiqueta = crearNodo('label', '', 'Resultado de la carne');
  const selector = crearNodo('select', 'evaluacion-asado');
  selector.id = `evaluacion_${item.id}`;
  etiqueta.setAttribute('for', selector.id);
  [['', 'Sin evaluar'], ...Object.entries(EVALUACIONES_CARNE).map(([valor, datos]) => [valor, datos.etiqueta])]
    .forEach(([valor, texto]) => {
      const opcion = crearNodo('option', '', texto); opcion.value = valor; selector.append(opcion);
    });
  selector.value = item.evaluacion;
  const sugerencia = crearNodo('p', 'ayuda sugerencia-factor');
  const aplicar = crearNodo('button', 'btn-ajuste');
  aplicar.type = 'button';
  const mostrarSugerencia = (valor) => {
    const factor = sugerirFactor(calculo, valor);
    sugerencia.textContent = valor
      ? `Referencia: ${TIPOS_CARNE[calculo.tipoCarne]?.etiqueta || 'carne principal'} · factor guardado ${formatearDecimal(normalizarFactor(calculo.factorCompra), 2)}x. Sugerencia orientativa, no aplicada.` : '';
    aplicar.textContent = `Usar ajuste ${formatearDecimal(factor, 2)}x`;
    aplicar.hidden = !valor;
  };
  let valorGuardado = item.evaluacion;
  selector.addEventListener('change', () => {
    if (guardarEvaluacionAsado(item.id, selector.value)) {
      valorGuardado = selector.value; mostrarSugerencia(valorGuardado);
    } else selector.value = valorGuardado;
  });
  aplicar.addEventListener('click', () => aplicarSugerenciaAsado(item.id));
  mostrarSugerencia(item.evaluacion);
  evaluacion.append(etiqueta, selector, sugerencia, aplicar);
  contenedor.append(evaluacion);
  return contenedor;
}

function cargarAsadoHistorial(calculo) {
  aplicarEstadoFormulario({
    ...calculo,
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

// Las fuentes originales se leen, nunca se migran destructivamente ni se recalculan.
function normalizarEntradaReact(datos, origen) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
  const id = datos.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return null;
  const esSesion = origen === 'sesion';
  const fecha = esSesion ? datos.date : datos.timestamp;
  if (esSesion ? typeof fecha !== 'string' || fecha.length > 40 : !Number.isSafeInteger(fecha) || fecha < 0) return null;
  const instante = new Date(fecha);
  if (!Number.isFinite(instante.getTime())) return null;
  const personas = esSesion ? datos.people : datos.comensalesCount;
  if (!Number.isSafeInteger(personas) || personas < 0 || personas > 10000) return null;
  const numero = (valor, maximo = 1000000000000000) => typeof valor === 'number' && Number.isFinite(valor)
    && valor >= 0 && valor <= maximo ? valor : null;
  const clima = (valor, min, max) => typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max ? valor : null;
  const entorno = esSesion ? datos.scenario : datos.entorno;
  const evaluacion = esSesion ? datos.feedback : datos.feedback?.estadoCarne;
  return {
    id: `react_${id}`, fecha: instante.toISOString(), origen, totalPersonas: personas,
    entorno: ['quincho', 'chulengo', 'afuera'].includes(entorno) ? (entorno === 'afuera' ? 'intemperie' : entorno) : null,
    tipoCarne: esSesion && typeof datos.cutType === 'string' && Object.hasOwn(TIPOS_CARNE, datos.cutType) ? datos.cutType : null,
    temperatura: clima(esSesion ? datos.temp : datos.clima?.temp, -15, 35),
    viento: clima(esSesion ? datos.wind : datos.clima?.viento, 0, 120),
    kgCarne: numero(esSesion ? datos.meatKg : datos.calculado?.carneKg, 1000000),
    carbonKg: numero(esSesion ? datos.carbonKg : datos.calculado?.carbonKg, 1000000),
    totalEstimado: numero(esSesion ? datos.totalARS : datos.precios?.totalARS),
    costoPorCabeza: numero(esSesion ? datos.costPerPerson : datos.precios?.porCabeza),
    evaluacion: typeof evaluacion === 'string' && Object.hasOwn(EVALUACIONES_CARNE, evaluacion) ? evaluacion : '',
  };
}

function leerCandidatosReact() {
  const entradas = new Map();
  [['asado-pro-history-v1', 'sesion'], ['asadoLogs', 'registro']].forEach(([clave, origen]) => {
    const datos = leerAlmacenamiento(clave, []);
    if (!Array.isArray(datos)) return;
    datos.slice(0, 100).forEach((dato) => {
      const entrada = normalizarEntradaReact(dato, origen);
      // Prevalece la sesión; un registro coincidente solo completa campos ausentes.
      if (!entrada) return;
      const anterior = entradas.get(entrada.id);
      if (!anterior) entradas.set(entrada.id, entrada);
      else if (anterior.totalPersonas === entrada.totalPersonas
        && Math.abs(Date.parse(anterior.fecha) - Date.parse(entrada.fecha)) < 60000) {
        ['totalEstimado', 'costoPorCabeza', 'kgCarne', 'carbonKg', 'temperatura', 'viento', 'tipoCarne', 'entorno'].forEach((clave) => {
          if (anterior[clave] === null && entrada[clave] !== null) anterior[clave] = entrada[clave];
        });
      }
    });
  });
  return [...entradas.values()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

// Valida también la copia importada, sin confiar en objetos escritos en localStorage.
function leerArchivoReact() {
  const datos = leerAlmacenamiento(STORAGE_ARCHIVO_REACT, []);
  if (!Array.isArray(datos)) return [];
  const entradas = new Map();
  datos.slice(0, MAXIMO_ARCHIVO_REACT).forEach((dato) => {
    if (!dato || typeof dato !== 'object' || typeof dato.id !== 'string' || !dato.id.startsWith('react_')) return;
    const entrada = normalizarEntradaReact({
      id: dato.id.slice(6), date: dato.fecha, people: dato.totalPersonas,
      scenario: dato.entorno === 'intemperie' ? 'afuera' : dato.entorno,
      cutType: dato.tipoCarne, temp: dato.temperatura, wind: dato.viento,
      meatKg: dato.kgCarne, carbonKg: dato.carbonKg, totalARS: dato.totalEstimado,
      costPerPerson: dato.costoPorCabeza, feedback: dato.evaluacion,
    }, 'sesion');
    if (entrada && !entradas.has(entrada.id)) entradas.set(entrada.id, {
      ...entrada, origen: dato.origen === 'registro' ? 'registro' : 'sesion',
    });
  });
  return [...entradas.values()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

function importarHistorialReact() {
  const archivo = leerArchivoReact();
  const existentes = new Set(archivo.map((item) => item.id));
  const nuevos = leerCandidatosReact().filter((item) => !existentes.has(item.id))
    .slice(0, Math.max(0, MAXIMO_ARCHIVO_REACT - archivo.length));
  if (!nuevos.length) return;
  if (!window.confirm(`¿Importar ${nuevos.length} asados al archivo anterior? El historial actual y los originales se conservan.`)) return;
  if (escribirAlmacenamiento(STORAGE_ARCHIVO_REACT, [...archivo, ...nuevos])) renderizarArchivoReact();
}

function renderizarArchivoReact() {
  const archivo = leerArchivoReact();
  const existentes = new Set(archivo.map((item) => item.id));
  const nuevos = leerCandidatosReact().filter((item) => !existentes.has(item.id)).length;
  $('#estadoImportacionReact').textContent = `${archivo.length} asados archivados · ${nuevos} nuevos disponibles${archivo.length >= MAXIMO_ARCHIVO_REACT ? ' · límite de 100 alcanzado' : ''}.`;
  $('#importarHistorialReact').disabled = !nuevos || archivo.length >= MAXIMO_ARCHIVO_REACT;
  const contenedor = $('#archivoReact');
  contenedor.replaceChildren();
  archivo.forEach((item) => {
    const fila = crearNodo('article', 'historial-item');
    fila.append(crearNodo('strong', '', `${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(item.fecha))} · ${item.totalPersonas} personas`));
    fila.append(crearNodo('span', '', `Carne: ${item.kgCarne === null ? 'sin registrar' : formatearCompraKg(item.kgCarne)} · carbón: ${item.carbonKg === null ? 'sin registrar' : formatearKg(item.carbonKg)}`));
    fila.append(crearNodo('span', '', `Total registrado: ${item.totalEstimado === null ? 'sin registrar' : formatearMoneda(item.totalEstimado)} · por cabeza registrado: ${item.costoPorCabeza === null ? 'sin registrar' : formatearMoneda(item.costoPorCabeza)}`));
    fila.append(crearNodo('p', 'ayuda', `Reparto de pagos y precios unitarios no registrados. Evaluación: ${EVALUACIONES_CARNE[item.evaluacion]?.etiqueta || 'sin registrar'}.`));
    const preparar = crearNodo('button', 'btn-cargar', 'Preparar nuevo asado');
    preparar.type = 'button';
    preparar.disabled = item.totalPersonas === 0;
    preparar.addEventListener('click', () => prepararDesdeArchivoReact(item.id));
    fila.append(preparar);
    contenedor.append(fila);
  });
}

// Un registro antiguo no permite deducir pagadores ni reproducir su presupuesto.
function prepararDesdeArchivoReact(id) {
  const item = leerArchivoReact().find((entrada) => entrada.id === id);
  if (!item || !item.totalPersonas) return;
  $('#tituloCompartido').textContent = 'Recuperar asado';
  $('#aceptarCompartido').textContent = 'Preparar nuevo asado';
  asadoCompartidoPendiente = {
    estado: normalizarEstado({ ...ESTADO_INICIAL, pagadores: 0, gratis: item.totalPersonas,
      tipoCarne: item.tipoCarne || ESTADO_INICIAL.tipoCarne, entorno: item.entorno || ESTADO_INICIAL.entorno,
      temperatura: item.temperatura ?? ESTADO_INICIAL.temperatura, viento: item.viento ?? ESTADO_INICIAL.viento }),
    requierePagadores: true,
  };
  $('#resumenCompartido').textContent = `${item.totalPersonas} comensales del historial anterior. Reparto de pagos sin registrar.`;
  $('#fechaCompartido').textContent = `Asado registrado el ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(item.fecha))}.`;
  $('#detalleCompatibilidad').hidden = false;
  $('#detalleCompatibilidad').textContent = 'Se usan las fórmulas actuales, perfiles sin completar, factor 1x y precios vacíos. El total histórico no se reutiliza como presupuesto. Los datos de clima o corte no registrados vuelven a los valores iniciales.';
  $('#campoPagadoresAnterior').hidden = false;
  $('#pagadoresAnterior').value = '';
  $('#pagadoresAnterior').setAttribute('aria-invalid', 'false');
  $('#pagadoresAnterior').max = String(item.totalPersonas);
  $('#ayudaPagadoresAnterior').textContent = `Entre 0 y ${item.totalPersonas}. Los restantes serán invitados sin pago.`;
  $('#aceptarCompartido').disabled = true;
  if (!elementos.modalCompartido.open) elementos.modalCompartido.showModal();
}

function validarPagadoresAnteriores() {
  const valor = leerPrecio($('#pagadoresAnterior').value);
  const maximo = asadoCompartidoPendiente?.estado.gratis ?? 0;
  const valido = valor !== '' && valor <= maximo;
  $('#pagadoresAnterior').setAttribute('aria-invalid', String(!valido));
  $('#aceptarCompartido').disabled = !valido;
  return valido ? valor : null;
}

function textoResumen(calculo) {
  return [
    'Asado Pro Río Gallegos',
    `Personas: ${FORMATO_AR.format(calculo.totalPersonas)} (${FORMATO_AR.format(
      calculo.pagadores
    )} pagan, ${FORMATO_AR.format(calculo.gratis)} sin pago)`,
    `Modo: ${MODOS_COMPRA[calculo.modo].etiqueta}`,
    `Corte: ${TIPOS_CARNE[calculo.tipoCarne].etiqueta}`,
    `Perfiles: ${calculo.hombres} hombres (${calculo.gramajes[0]} g), ${calculo.mujeres} mujeres (${calculo.gramajes[1]} g), ${calculo.ninos} niños (${calculo.gramajes[2]} g), ${calculo.sinPerfil} sin perfil (${calculo.gramosSinPerfil} g). Carne cruda.`,
    `Carne total sugerida: ${formatearCompraKg(calculo.kgCarneTotal)} (${calculo.porciones} porciones de carne cruda)`,
    calculo.factorCompra !== 1 ? `Ajuste de carne: ${formatearDecimal(calculo.factorCompra, 2)}x sobre ${formatearKg(calculo.gramosCarneBase / 1000)} de base.` : null,
    ...obtenerLista(calculo).map((item) => `${item.nombre}: ${item.cantidad}${item.comprado ? ' (comprado)' : ''}`),
    Object.keys(calculo.listaEdiciones).length || calculo.listaPersonalizados.length
      ? 'Lista personalizada: el presupuesto corresponde a las cantidades sugeridas, no a las editadas.' : null,
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
  let resumen = textoResumen(calculoActual);
  try {
    resumen += `\nConfiguración y precios guardados (sin ediciones de lista):\n${generarUrlCompartible(obtenerEstado())}`;
  } catch {
    // En archivos locales se conserva el resumen: no se comparten rutas del equipo.
  }
  const url = `https://wa.me/?text=${encodeURIComponent(resumen)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Un enlace es una instantánea editable, no un presupuesto firmado ni seguridad real.
// Se permiten solo campos del formulario: nunca historial ni textos personales de la lista.
function validarDatosCompartidos(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || ![1, VERSION_ENLACE].includes(datos.version)
    || typeof datos.fecha !== 'string' || datos.fecha.length > 30 || !Number.isFinite(Date.parse(datos.fecha))) return null;
  if (!datos.estado || typeof datos.estado !== 'object' || Array.isArray(datos.estado)) return null;
  // Los enlaces vanilla v1 anteriores no aplicaban calibración: conservan siempre 1x.
  const estado = datos.version === 1 ? { ...datos.estado, factorCompra: 1 } : datos.estado;
  if (!CLAVES_ENLACE.every((clave) => Object.hasOwn(estado, clave))) return null;
  if (typeof estado.factorCompra !== 'number' || !Number.isFinite(estado.factorCompra)
    || estado.factorCompra < 0.6 || estado.factorCompra > 1.5
    || Math.abs(estado.factorCompra * 100 - Math.round(estado.factorCompra * 100)) > 0.00000001) return null;
  const enteros = ['pagadores', 'gratis', ...CLAVES_PERFILES, 'adultosBebedores', 'personasAchuras'];
  if (!enteros.every((clave) => Number.isSafeInteger(estado[clave]) && estado[clave] >= 0 && estado[clave] <= 10000)
    || estado.pagadores + estado.gratis > 10000) return null;
  if (!CLAVES_CHECKS.every((clave) => typeof estado[clave] === 'boolean')
    || !Object.hasOwn(MODOS_COMPRA, estado.modo) || !Object.hasOwn(TIPOS_CARNE, estado.tipoCarne)
    || !Object.hasOwn(COEFICIENTE_ENTORNO, estado.entorno)) return null;
  if (!Number.isFinite(estado.temperatura) || estado.temperatura < -15 || estado.temperatura > 35
    || !Number.isFinite(estado.viento) || estado.viento < 0 || estado.viento > 120) return null;
  if (!CLAVES_PRECIOS.every((clave) => estado[clave] === ''
    || Number.isSafeInteger(estado[clave]) && estado[clave] >= 0 && estado[clave] <= 1000000000)) return null;
  const soloFormulario = Object.fromEntries(CLAVES_ENLACE.map((clave) => [clave, estado[clave]]));
  const normalizado = normalizarEstado(soloFormulario);
  const calculo = calcularAsado(normalizado);
  if (!calculo.totalPersonas || !calculo.perfilesValidos) return null;
  return { version: VERSION_ENLACE, fecha: datos.fecha, estado: normalizado };
}

// Base64url UTF-8 en el fragmento: no se envían los precios al servidor en la URL HTTP.
function codificarAsadoCompartido(estado, fecha = new Date().toISOString()) {
  const normalizado = normalizarEstado(estado);
  const soloFormulario = Object.fromEntries(CLAVES_ENLACE.map((clave) => [clave, normalizado[clave]]));
  const datos = { version: VERSION_ENLACE, fecha, estado: soloFormulario };
  if (!validarDatosCompartidos(datos)) throw new Error('Datos fuera del rango permitido para compartir.');
  const bytes = new TextEncoder().encode(JSON.stringify(datos));
  const texto = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (texto.length > MAXIMO_ENLACE) throw new Error('Enlace demasiado largo.');
  return texto;
}

function decodificarAsadoCompartido(texto) {
  try {
    if (typeof texto !== 'string' || !texto.length || texto.length > MAXIMO_ENLACE || !/^[A-Za-z0-9_-]+$/.test(texto)) return null;
    const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return validarDatosCompartidos(JSON.parse(json));
  } catch { return null; }
}

// Compatibilidad con ?state= de React: com era TOTAL, np eran invitados sin pago.
// Se recuperan solo datos presentes; tot/cab son referencias históricas, no precios.
function decodificarEnlaceReact(texto) {
  try {
    if (typeof texto !== 'string' || !texto.length || texto.length > MAXIMO_ENLACE
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(texto)) return null;
    const binario = atob(texto);
    const datos = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0))));
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null;
    if (!Number.isSafeInteger(datos.com) || datos.com <= 0 || datos.com > 10000
      || !Number.isSafeInteger(datos.np) || datos.np < 0 || datos.np > datos.com) return null;
    if (!['quincho', 'chulengo', 'afuera'].includes(datos.ent)
      || typeof datos.cut !== 'string' || datos.cut === 'automatico' || !Object.hasOwn(TIPOS_CARNE, datos.cut)) return null;
    if (!Number.isFinite(datos.tmp) || datos.tmp < -15 || datos.tmp > 35
      || !Number.isFinite(datos.wnd) || datos.wnd < 0 || datos.wnd > 120) return null;
    if (!['pKg', 'pCoal', 'ext'].every((clave) => Number.isSafeInteger(datos[clave]) && datos[clave] >= 0 && datos[clave] <= 1000000000)) return null;
    if (!['tot', 'cab'].every((clave) => datos[clave] == null || typeof datos[clave] === 'number'
      && Number.isFinite(datos[clave]) && datos[clave] >= 0 && datos[clave] <= 1000000000000000)) return null;
    return {
      origenReact: true,
      fecha: null,
      totalAnterior: datos.tot ?? null,
      porCabezaAnterior: datos.cab ?? null,
      estado: normalizarEstado({ ...ESTADO_INICIAL, pagadores: datos.com - datos.np, gratis: datos.np,
        tipoCarne: datos.cut, entorno: datos.ent === 'afuera' ? 'intemperie' : datos.ent,
        temperatura: datos.tmp, viento: datos.wnd, precioCarne: datos.pKg,
        precioPollo: datos.pKg, precioCerdo: datos.pKg, precioCordero: datos.pKg,
        precioCarbon: datos.pCoal, extras: datos.ext }),
    };
  } catch { return null; }
}

function generarUrlCompartible(estado) {
  const url = new URL(window.location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('El enlace requiere abrir la app mediante HTTP o HTTPS.');
  url.search = '';
  url.hash = `asado=${codificarAsadoCompartido(estado)}`;
  return url.href;
}

// El fallback visible permite recuperar el enlace si no existe permiso de portapapeles.
async function copiarEnlaceAsado() {
  confirmarCambios();
  if (!calculoActual.totalPersonas || !calculoActual.perfilesValidos) return;
  let enlace;
  try { enlace = generarUrlCompartible(obtenerEstado()); }
  catch (error) { elementos.estadoGuardado.textContent = error.message; return; }
  $('#enlaceGenerado').value = enlace;
  $('#salidaEnlace').hidden = false;
  const textoOriginal = 'Copiar enlace del asado';
  try {
    await navigator.clipboard.writeText(enlace);
    elementos.copiarEnlace.textContent = 'Enlace copiado';
  } catch {
    elementos.estadoGuardado.textContent = 'No se pudo copiar. Enlace disponible.';
    $('#enlaceGenerado').focus();
    $('#enlaceGenerado').select();
  }
  window.setTimeout(() => { elementos.copiarEnlace.textContent = textoOriginal; }, 2000);
}

// Se elimina el fragmento al decidir, evitando reimportaciones al recargar o resetear.
function limpiarEnlaceDeDireccion() {
  const url = new URL(window.location.href);
  const tieneFragmento = url.hash.startsWith('#asado=');
  if (!tieneFragmento && !url.searchParams.has('state')) return;
  if (tieneFragmento) url.hash = '';
  url.searchParams.delete('state');
  window.history.replaceState(window.history.state, '', url.href);
}

function ofrecerAsadoCompartido() {
  const fragmento = window.location.hash;
  const url = new URL(window.location.href);
  if (!fragmento.startsWith('#asado=') && !url.searchParams.has('state')) return;
  asadoCompartidoPendiente = fragmento.startsWith('#asado=')
    ? decodificarAsadoCompartido(fragmento.slice('#asado='.length))
    : decodificarEnlaceReact(url.searchParams.get('state'));
  if (!asadoCompartidoPendiente) {
    elementos.estadoGuardado.textContent = 'Enlace inválido o incompatible. Tu asado no se modificó.';
    limpiarEnlaceDeDireccion();
    if (elementos.modalCompartido.open) elementos.modalCompartido.close();
    return;
  }
  const calculo = calcularAsado(asadoCompartidoPendiente.estado);
  $('#tituloCompartido').textContent = 'Asado compartido';
  $('#aceptarCompartido').textContent = 'Cargar asado compartido';
  $('#campoPagadoresAnterior').hidden = true;
  $('#aceptarCompartido').disabled = false;
  $('#detalleCompatibilidad').hidden = !asadoCompartidoPendiente.origenReact;
  if (asadoCompartidoPendiente.origenReact) {
    const total = asadoCompartidoPendiente.totalAnterior;
    const porCabeza = asadoCompartidoPendiente.porCabezaAnterior;
    $('#detalleCompatibilidad').textContent = `Enlace anterior. Se recalcula con gramajes y fórmulas actuales, perfiles sin completar y factor 1x. Faltan precios unitarios de embutidos y leña. Total anterior: ${total === null ? 'sin registrar' : formatearMoneda(total)}; por cabeza anterior: ${porCabeza === null ? 'sin registrar' : formatearMoneda(porCabeza)}. Estos importes no se aplican como presupuesto nuevo.`;
  }
  $('#resumenCompartido').textContent = `${FORMATO_AR.format(calculo.totalPersonas)} comensales · ${calculo.pagadores} pagan · ${TIPOS_CARNE[calculo.tipoCarne].etiqueta} · ajuste ${formatearDecimal(calculo.factorCompra, 2)}x · ${calculo.presupuestoCompleto ? 'Total' : 'Subtotal'} ${formatearMoneda(calculo.totalEstimado)}${calculo.presupuestoCompleto ? '' : ' (faltan precios)'}.`;
  $('#fechaCompartido').textContent = asadoCompartidoPendiente.fecha
    ? `Precios guardados el ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(asadoCompartidoPendiente.fecha))}.`
    : 'Fecha de precios y calibración original no registradas.';
  if (!elementos.modalCompartido.open) elementos.modalCompartido.showModal();
}

function aceptarAsadoCompartido() {
  if (!asadoCompartidoPendiente) return;
  let estado = asadoCompartidoPendiente.estado;
  if (asadoCompartidoPendiente.requierePagadores) {
    const pagadores = validarPagadoresAnteriores();
    if (pagadores === null) return;
    estado = { ...estado, pagadores, gratis: estado.gratis - pagadores };
  }
  aplicarEstadoFormulario(estado);
  guardarEstadoFormulario();
  elementos.modalCompartido.close();
  if (elementos.modalAjustes.open) elementos.modalAjustes.close();
  asadoCompartidoPendiente = null;
  limpiarEnlaceDeDireccion();
}

function cancelarAsadoCompartido() {
  asadoCompartidoPendiente = null;
  limpiarEnlaceDeDireccion();
  if (elementos.modalCompartido.open) elementos.modalCompartido.close();
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
  elementos.copiarEnlace.addEventListener('click', copiarEnlaceAsado);
  $('#aceptarCompartido').addEventListener('click', aceptarAsadoCompartido);
  $('#pagadoresAnterior').addEventListener('input', validarPagadoresAnteriores);
  $('#importarHistorialReact').addEventListener('click', importarHistorialReact);
  $('#cancelarCompartido').addEventListener('click', cancelarAsadoCompartido);
  $('#cerrarCompartido').addEventListener('click', cancelarAsadoCompartido);
  elementos.modalCompartido.addEventListener('close', cancelarAsadoCompartido);
  window.addEventListener('hashchange', ofrecerAsadoCompartido);
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
ofrecerAsadoCompartido();
registrarServiceWorker();
