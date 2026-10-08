// Ejecutar con node --test tests/calculos.test.cjs. No requiere dependencias.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const raiz = path.resolve(__dirname, '..');
const fuente = fs.readFileSync(path.join(raiz, 'script.js'), 'utf8');

function crearApp() {
  const nodos = new Map();
  const memoria = new Map();
  const pendientes = new Map();
  let indice = 0;
  const nodo = () => ({
    value: '', textContent: '', max: '40', dataset: {}, hidden: false,
    children: [], classList: { toggle() {} },
    append(...hijos) { this.children.push(...hijos); },
    replaceChildren(...hijos) { this.children = hijos; },
    insertBefore(hijo) { this.children.push(hijo); },
    setAttribute() {}, addEventListener() {},
    focus() {}, select() {},
    showModal() { this.open = true; }, close() { this.open = false; },
  });
  const radios = {
    modoCompra: ['premium', 'economico'].map((value, i) => ({ value, checked: i === 0 })),
    entorno: ['quincho', 'chulengo', 'intemperie'].map((value, i) => ({ value, checked: i === 1 })),
  };
  Object.values(radios).forEach((lista) => lista.forEach((radio) => {
    radio._checked = radio.checked;
    Object.defineProperty(radio, 'checked', {
      get() { return this._checked; },
      set(valor) {
        if (valor) lista.forEach((otro) => { otro._checked = false; });
        this._checked = Boolean(valor);
      },
    });
  }));
  const document = {
    querySelector(selector) {
      const radio = selector.match(/name="(.*?)"/);
      if (radio) return radios[radio[1]].find((r) => r.checked);
      if (!nodos.has(selector)) nodos.set(selector, nodo());
      return nodos.get(selector);
    },
    querySelectorAll(selector) {
      return Object.entries(radios).filter(([nombre]) => selector.includes(nombre)).flatMap(([, lista]) => lista);
    },
    createElement: nodo,
    createTextNode: (texto) => ({ textContent: texto }),
  };
  const window = {
    location: new URL('https://ejemplo.test/calculadora-asado/'),
    localStorage: {
      getItem: (clave) => memoria.get(clave) ?? null,
      setItem: (clave, valor) => memoria.set(clave, valor),
      removeItem: (clave) => memoria.delete(clave),
    },
    clearTimeout: (id) => pendientes.delete(id),
    setTimeout: (accion) => { pendientes.set(++indice, accion); return indice; },
    open: (url) => { window.ultimaUrl = url; },
    confirm: () => true,
  };
  window.history = { state: null, replaceState(_estado, _titulo, url) { window.location = new URL(url); } };
  const navigator = { clipboard: { async writeText(texto) { window.ultimoTexto = texto; } } };
  const contexto = vm.createContext({ document, window, navigator, Intl, URL, TextEncoder, TextDecoder, btoa, atob });
  vm.runInContext(fuente.slice(0, fuente.lastIndexOf('\nconfigurarEventos();')), contexto);
  const evaluar = (codigo) => vm.runInContext(codigo, contexto);
  evaluar('aplicarEstadoFormulario(ESTADO_INICIAL)');
  return { evaluar, nodos, memoria, pendientes, window };
}

test('factor optativo mantiene gramajes base y evita redondeos binarios de compra', () => {
  const { evaluar } = crearApp();
  const base = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:10})');
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:10,factorCompra:1.12})');
  assert.equal(base.kgCarneTotal, 5);
  assert.equal(c.gramosCarneBase, 5000);
  assert.equal(c.gramosCarneTotal, 5600);
  assert.equal(c.kgCarneTotal, 5.6);
  assert.deepEqual(Array.from(c.gramajes), [750, 500, 250]);
  for (const valor of ['null', '{}', 'NaN', 'Infinity', "''", '0', '10']) {
    assert.equal(evaluar(`normalizarFactor(${valor})`), 1);
  }
});

test('calibrar carne no altera achuras, embutidos ni bebidas, pero si combustible y presupuesto', () => {
  const { evaluar } = crearApp();
  const datos = '{...ESTADO_INICIAL,personasAchuras:6,incluirExtras:true,adultosBebedores:4,precioCarne:10000}';
  const base = evaluar(`calcularAsado(${datos})`);
  const c = evaluar(`calcularAsado({...${datos},factorCompra:1.5})`);
  for (const clave of ['kgAchuras', 'chorizos', 'morcillas']) assert.equal(c[clave], base[clave]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.bebidas)), JSON.parse(JSON.stringify(base.bebidas)));
  assert.ok(c.kgCarneTotal > base.kgCarneTotal && c.carbonKg > base.carbonKg && c.lenaKg > base.lenaKg);
  assert.ok(c.totalEstimado > base.totalEstimado);
  assert.match(evaluar(`textoResumen(calcularAsado({...${datos},factorCompra:1.5}))`), /Ajuste de carne: 1,5x/);
});

test('cortes ajustados suman compras y cordero conserva medias reses exactas', () => {
  const { evaluar } = crearApp();
  for (const factor of [0.6, 0.95, 1, 1.12, 1.5]) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,tipoCarne:'mixto_cerdo',factorCompra:${factor}})`);
    assert.equal(Math.round((c.kgVacio + c.kgTira + c.kgPollo + c.kgCerdo) * 10), Math.round(c.kgCarneTotal * 10));
  }
  const cordero = evaluar("calcularAsado({...ESTADO_INICIAL,tipoCarne:'cordero',factorCompra:1.12})");
  assert.equal(cordero.mediasReses, 2);
  assert.equal(cordero.kgCordero, 12.5);
  assert.equal(evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:0,factorCompra:1.5}).kgCarneTotal'), 0);
});

test('sugerencias se basan en el asado guardado y respetan limites', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('sugerirFactor({factorCompra:1},"falto")'), 1.12);
  assert.equal(evaluar('sugerirFactor({factorCompra:1},"sobro")'), 0.95);
  assert.equal(evaluar('sugerirFactor({factorCompra:1.12},"perfecto")'), 1.12);
  assert.equal(evaluar('sugerirFactor({factorCompra:1.5},"falto")'), 1.5);
  assert.equal(evaluar('sugerirFactor({factorCompra:0.6},"sobro")'), 0.6);
});

test('evaluar y corregir son idempotentes y nunca cambian el calculo guardado o actual', () => {
  const { evaluar, memoria } = crearApp();
  evaluar('guardarAsado()');
  const id = evaluar('leerHistorial()[0].id');
  const original = JSON.parse(memoria.get('asadoProHistorialVanilla'))[0].calculo;
  evaluar(`guardarEvaluacionAsado('${id}','falto'); guardarEvaluacionAsado('${id}','falto')`);
  assert.equal(evaluar('leerHistorial().length'), 1);
  assert.equal(evaluar('calculoActual.factorCompra'), 1);
  assert.deepEqual(JSON.parse(memoria.get('asadoProHistorialVanilla'))[0].calculo, original);
  evaluar(`guardarEvaluacionAsado('${id}','sobro')`);
  assert.equal(evaluar('sugerirFactor(leerHistorial()[0].calculo,leerHistorial()[0].evaluacion)'), 0.95);
  evaluar(`guardarEvaluacionAsado('${id}','')`);
  assert.equal(evaluar('leerHistorial()[0].evaluacion'), '');
});

test('aplicar sugerencia requiere confirmacion y conserva el resto del formulario', () => {
  const { evaluar, window } = crearApp();
  evaluar('guardarAsado(); guardarEvaluacionAsado(leerHistorial()[0].id,"falto"); aplicarEstadoFormulario({...ESTADO_INICIAL,pagadores:20,gratis:1,precioCarne:12000,personasAchuras:5})');
  window.confirm = () => false;
  evaluar('aplicarSugerenciaAsado(leerHistorial()[0].id)');
  assert.equal(evaluar('calculoActual.factorCompra'), 1);
  window.confirm = () => true;
  evaluar('aplicarSugerenciaAsado(leerHistorial()[0].id); aplicarSugerenciaAsado(leerHistorial()[0].id)');
  assert.equal(evaluar('calculoActual.factorCompra'), 1.12);
  assert.equal(evaluar('calculoActual.pagadores'), 20);
  assert.equal(evaluar('calculoActual.gratis'), 1);
  assert.equal(evaluar('calculoActual.precioCarne'), 12000);
  assert.equal(evaluar('calculoActual.personasAchuras'), 5);
  assert.equal(evaluar('leerHistorial()[0].calculo.factorCompra'), 1);
});

test('factor persiste, historial lo restaura y reset vuelve a uno sin borrar evaluaciones', () => {
  const { evaluar } = crearApp();
  evaluar('aplicarEstadoFormulario({...ESTADO_INICIAL,factorCompra:1.12}); guardarAsado(); guardarEvaluacionAsado(leerHistorial()[0].id,"perfecto"); guardarEstadoFormulario(); aplicarEstadoFormulario(ESTADO_INICIAL); restaurarEstadoFormulario()');
  assert.equal(evaluar('calculoActual.factorCompra'), 1.12);
  evaluar('resetearFormulario()');
  assert.equal(evaluar('calculoActual.factorCompra'), 1);
  assert.equal(evaluar('leerHistorial()[0].evaluacion'), 'perfecto');
  evaluar('cargarAsadoHistorial(leerHistorial()[0].calculo)');
  assert.equal(evaluar('calculoActual.factorCompra'), 1.12);
});

test('historial antiguo obtiene identificador estable y error al guardar no aplica sugerencias', () => {
  const { evaluar, memoria, window } = crearApp();
  memoria.set('asadoProHistorialVanilla', JSON.stringify([{fecha:'2026-10-08T15:00:00.000Z',evaluacion:'inventada',calculo:{totalPersonas:12,pagadores:12}}]));
  const id = evaluar('leerHistorial()[0].id');
  assert.equal(evaluar('leerHistorial()[0].id'), id);
  assert.equal(evaluar('leerHistorial()[0].evaluacion'), '');
  window.localStorage.setItem = () => { throw new Error('Sin espacio'); };
  assert.equal(evaluar(`guardarEvaluacionAsado('${id}','falto')`), false);
  assert.equal(evaluar('leerHistorial()[0].evaluacion'), '');
  assert.equal(evaluar('calculoActual.factorCompra'), 1);
});

test('enlaces v2 guardan el factor y enlaces vanilla v1 mantienen uno', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('decodificarAsadoCompartido(codificarAsadoCompartido({...ESTADO_INICIAL,factorCompra:1.12})).estado.factorCompra'), 1.12);
  const anterior = evaluar(`(() => { const estado = {...ESTADO_INICIAL}; delete estado.factorCompra;
    return validarDatosCompartidos({version:1,fecha:'2026-10-08T15:00:00.000Z',estado}); })()`);
  assert.equal(anterior.estado.factorCompra, 1);
  assert.equal(evaluar(`validarDatosCompartidos({version:2,fecha:'2026-10-08T15:00:00.000Z',estado:{...ESTADO_INICIAL,factorCompra:1.123}})`), null);
  assert.equal(evaluar(`validarDatosCompartidos({version:2,fecha:'2026-10-08T15:00:00.000Z',estado:{...ESTADO_INICIAL,factorCompra:5}})`), null);
});

test('achuras son optativas, adicionales y presupuestadas por su propio precio', () => {
  const { evaluar } = crearApp();
  const base = evaluar('calcularAsado(ESTADO_INICIAL)');
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,personasAchuras:8,precioAchuras:7000})');
  assert.equal(base.kgAchuras, 0);
  assert.equal(c.kgAchuras, 1);
  assert.equal(c.kgCarneTotal, base.kgCarneTotal);
  assert.ok(c.carbonKg >= base.carbonKg && c.lenaKg >= base.lenaKg);
  assert.equal(c.detallePresupuesto.find((item) => item.nombre === 'Achuras').subtotal, 7000);
  assert.match(evaluar('textoResumen(calcularAsado({...ESTADO_INICIAL,personasAchuras:8}))'), /Achuras: 1,0 kg/);
  assert.ok(evaluar('calcularAsado({...ESTADO_INICIAL,personasAchuras:8}).preciosFaltantes.includes("Achuras")'));
});

test('achuras no superan comensales ni generan compras con perfiles invalidos o cero personas', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('calcularAsado({...ESTADO_INICIAL,personasAchuras:30}).consumidoresAchuras'), 12);
  assert.equal(evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:0,personasAchuras:12}).kgAchuras'), 0);
  assert.equal(evaluar('calcularAsado({...ESTADO_INICIAL,hombres:20,personasAchuras:12}).kgAchuras'), 0);
});

test('enlaces conservan configuracion y precios exactos, pero excluyen lista e historial', () => {
  const { evaluar } = crearApp();
  const datos = evaluar(`decodificarAsadoCompartido(codificarAsadoCompartido({...ESTADO_INICIAL,pagadores:8,gratis:4,precioCarne:12345,precioCarbon:0,personasAchuras:5,precioAchuras:6000,listaPersonalizados:[{id:'personal_1',nombre:'Texto privado',cantidad:'1'}]}))`);
  assert.equal(datos.estado.precioCarne, 12345);
  assert.equal(datos.estado.precioCarbon, 0);
  assert.equal(datos.estado.precioPollo, '');
  assert.equal(datos.estado.personasAchuras, 5);
  assert.equal(datos.estado.listaPersonalizados.length, 0);
  const url = evaluar('generarUrlCompartible(ESTADO_INICIAL)');
  assert.match(url, /^https:\/\/ejemplo\.test\/calculadora-asado\/#asado=/);
  assert.equal(new URL(url).search, '');
  assert.doesNotMatch(evaluar('atob(codificarAsadoCompartido(ESTADO_INICIAL).replace(/-/g,"+").replace(/_/g,"/"))'), /lista|historial/i);
});

test('enlaces corruptos, versiones desconocidas y precios invalidos se rechazan', () => {
  const { evaluar } = crearApp();
  for (const texto of ["''", "'%'", "'a'.repeat(12001)", "'bm90LWpzb24'"]) {
    assert.equal(evaluar(`decodificarAsadoCompartido(${texto})`), null);
  }
  const base = '{version:1,fecha:"2026-10-08T15:00:00.000Z",estado:{...ESTADO_INICIAL}}';
  for (const cambio of ['version:99', 'fecha:"mala"', 'estado:{...ESTADO_INICIAL,precioCarne:-1}',
    'estado:{...ESTADO_INICIAL,precioCarne:"12.5"}', 'estado:{...ESTADO_INICIAL,modo:"inventado"}',
    'estado:{...ESTADO_INICIAL,temperatura:99}', 'estado:{...ESTADO_INICIAL,hombres:99}',
    'estado:{...ESTADO_INICIAL,pagadores:0}', 'estado:{...ESTADO_INICIAL,pagadores:10001}']) {
    assert.equal(evaluar(`validarDatosCompartidos({...${base},${cambio}})`), null, cambio);
  }
});

test('abrir y cancelar un enlace no modifica formulario ni almacenamiento', () => {
  const { evaluar, memoria, window } = crearApp();
  evaluar('guardarEstadoFormulario()');
  const guardado = memoria.get('asadoProEstado');
  evaluar(`window.location.hash = '#asado=' + codificarAsadoCompartido({...ESTADO_INICIAL,pagadores:20,precioCarne:10000}); ofrecerAsadoCompartido()`);
  assert.equal(evaluar('calculoActual.pagadores'), 12);
  assert.equal(evaluar('elementos.modalCompartido.open'), true);
  assert.equal(memoria.get('asadoProEstado'), guardado);
  evaluar('cancelarAsadoCompartido()');
  assert.equal(window.location.hash, '');
  assert.equal(evaluar('calculoActual.pagadores'), 12);
  assert.equal(memoria.get('asadoProEstado'), guardado);
});

test('confirmar un enlace restaura precios, limpia ediciones y conserva el historial', () => {
  const { evaluar, memoria, window } = crearApp();
  memoria.set('asadoProHistorialVanilla', '[{"conservar":true}]');
  evaluar(`aplicarEstadoFormulario({...ESTADO_INICIAL,listaEdiciones:{vacio:{cantidad:'9 kg'}}});
    window.location.hash = '#asado=' + codificarAsadoCompartido({...ESTADO_INICIAL,pagadores:20,personasAchuras:7,precioCarne:10000,precioAchuras:7000});
    ofrecerAsadoCompartido(); aceptarAsadoCompartido()`);
  assert.equal(evaluar('calculoActual.pagadores'), 20);
  assert.equal(evaluar('calculoActual.precioAchuras'), 7000);
  assert.equal(evaluar('Object.keys(calculoActual.listaEdiciones).length'), 0);
  assert.equal(memoria.get('asadoProHistorialVanilla'), '[{"conservar":true}]');
  assert.equal(JSON.parse(memoria.get('asadoProEstado')).precioCarne, 10000);
  assert.equal(window.location.hash, '');
});

test('copiar enlace falla con feedback visible y nunca comparte rutas locales', async () => {
  const { evaluar, nodos, window } = crearApp();
  evaluar('navigator.clipboard.writeText = async () => { throw new Error("Sin permiso"); }');
  await evaluar('copiarEnlaceAsado()');
  assert.equal(nodos.get('#salidaEnlace').hidden, false);
  assert.match(nodos.get('#enlaceGenerado').value, /#asado=/);
  assert.match(nodos.get('#estadoGuardado').textContent, /No se pudo copiar/);
  window.location = new URL('file:///C:/privado/asado/index.html');
  await evaluar('copiarEnlaceAsado()');
  assert.equal(nodos.get('#salidaEnlace').hidden, true);
  assert.match(nodos.get('#estadoGuardado').textContent, /HTTP o HTTPS/);
});

test('los tipos de carne conservan el gramaje crudo salvo ajuste explicito', () => {
  const { evaluar } = crearApp();
  for (const tipo of ['premium', 'con_hueso', 'sin_hueso', 'cerdo', 'pollo', 'mixto_cerdo', 'mixto_pollo']) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,tipoCarne:'${tipo}',hombres:4,mujeres:4,ninos:4})`);
    assert.equal(c.kgCarneTotal, 6);
    assert.equal(Math.round((c.kgVacio + c.kgTira + c.kgPollo + c.kgCerdo) * 10), 60);
    assert.ok(c.rendimiento > 0 && c.rendimiento < 1);
  }
  const ajustado = evaluar("calcularAsado({...ESTADO_INICIAL,tipoCarne:'con_hueso',ajustarPorCorte:true,pagadores:1,hombres:1})");
  assert.equal(ajustado.gramosCarneTotal, 880);
  assert.equal(ajustado.kgTira, 0.9);
});

test('cordero se compra por medias reses exactas, sin redondear el precio a 6,3 kg', () => {
  const { evaluar } = crearApp();
  const c = evaluar("calcularAsado({...ESTADO_INICIAL,tipoCarne:'cordero',precioCordero:10000})");
  assert.equal(c.mediasReses, 1);
  assert.equal(c.kgCordero, 6.25);
  assert.equal(c.detallePresupuesto.find((r) => r.nombre === 'Cordero').subtotal, 62500);
  assert.equal(evaluar('formatearCompraKg(6.25)'), '6,25 kg');
  assert.equal(evaluar("calcularAsado({...ESTADO_INICIAL,tipoCarne:'cordero',pagadores:13}).kgCordero"), 12.5);
  assert.equal(evaluar("calcularAsado({...ESTADO_INICIAL,tipoCarne:'cordero',pagadores:0}).mediasReses"), 0);
});

test('cerdo y pollo usan precios propios y no exigen precio de vacuno', () => {
  const { evaluar } = crearApp();
  for (const [tipo, precio] of [['cerdo', 'precioCerdo'], ['pollo', 'precioPollo']]) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,tipoCarne:'${tipo}',${precio}:1000,precioChorizo:0,precioMorcilla:0,precioCarbon:0,precioLena:0})`);
    assert.equal(c.presupuestoCompleto, true);
    assert.equal(c.totalEstimado, 6000);
  }
});

test('bebidas son optativas, no generan compras vacias ni alcohol para ninos', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('calcularAsado(ESTADO_INICIAL).bebidas.length'), 0);
  assert.equal(evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:0,incluirExtras:true}).bebidas.length'), 0);
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,ninos:12,incluirExtras:true,adultosBebedores:12})');
  assert.ok(!c.bebidas.some((item) => ['cerveza', 'vino'].includes(item.id)));
  assert.ok(c.preciosFaltantes.includes('Bebidas y acompañamientos'));
  const adultos = evaluar('calcularAsado({...ESTADO_INICIAL,incluirExtras:true,adultosBebedores:4})');
  assert.equal(adultos.bebidas.find((item) => item.id === 'cerveza').cantidad, 4.4);
  assert.equal(adultos.bebidas.find((item) => item.id === 'vino').cantidad, 1);
});

test('lista editada se comparte y restaura sin alterar el presupuesto', () => {
  const { evaluar, memoria } = crearApp();
  evaluar(`aplicarEstadoFormulario({...ESTADO_INICIAL,tipoCarne:'cerdo',incluirExtras:true,listaEdiciones:{cerdo:{nombre:'Bondiola',cantidad:'8 kg',comprado:true},morcillas:{excluido:true}},listaPersonalizados:[{id:'personal_1_1',nombre:'Sal',cantidad:'1 paquete'}]})`);
  const original = evaluar('calculoActual.totalEstimado');
  const texto = evaluar('textoResumen(calculoActual)');
  assert.match(texto, /Bondiola: 8 kg \(comprado\)/);
  assert.match(texto, /Sal: 1 paquete/);
  assert.doesNotMatch(texto, /Morcillas:/);
  evaluar('guardarEstadoFormulario(); aplicarEstadoFormulario(ESTADO_INICIAL); restaurarEstadoFormulario()');
  assert.equal(evaluar('calculoActual.tipoCarne'), 'cerdo');
  assert.equal(evaluar('calculoActual.totalEstimado'), original);
  assert.match(evaluar('textoResumen(calculoActual)'), /Bondiola: 8 kg/);
  assert.ok(memoria.has('asadoProEstado'));
});

test('lista corrupta limita textos, descarta estructuras invalidas y no interpreta HTML', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('normalizarEstado({listaEdiciones:[],listaPersonalizados:{}}).listaPersonalizados.length'), 0);
  assert.equal(evaluar("normalizarEstado({listaEdiciones:{vacio:{nombre:'x'.repeat(1000)}}}).listaEdiciones.vacio.nombre.length"), 80);
  const texto = evaluar(`textoResumen(calcularAsado({...ESTADO_INICIAL,listaEdiciones:{vacio:{nombre:'<img src=x onerror=alert(1)>',cantidad:'1 kg'}}}))`);
  assert.match(texto, /<img src=x onerror=alert\(1\)>: 1 kg/);
});

test('cero personas no genera comida, combustible, bolsas ni presupuesto', () => {
  const { evaluar } = crearApp();
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:0,gratis:0,precioCarbon:2200,extras:5000})');
  for (const clave of ['kgCarneTotal', 'carbonKg', 'lenaKg', 'bolsasCarbon', 'chorizos', 'morcillas', 'totalEstimado']) {
    assert.equal(c[clave], 0, clave);
  }
  assert.equal(c.costoPorCabeza, null);
});

test('los invitados comen igual pero solo dividen los pagadores', () => {
  const { evaluar } = crearApp();
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:8,gratis:4,precioCarne:10000})');
  const todos = evaluar('calcularAsado({...ESTADO_INICIAL,precioCarne:10000})');
  for (const clave of ['kgCarneTotal', 'chorizos', 'morcillas', 'carbonKg', 'lenaKg', 'totalEstimado']) {
    assert.equal(c[clave], todos[clave], clave);
  }
  assert.equal(c.costoPorCabeza, Math.ceil(c.totalEstimado / 8));
});

test('sin pagadores no se presenta un costo por persona de cero', () => {
  const { evaluar } = crearApp();
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:0,gratis:12,precioCarne:10000})');
  assert.equal(c.costoPorCabeza, null);
  assert.ok(c.kgCarneTotal > 0);
  assert.match(evaluar('textoResumen(calcularAsado({...ESTADO_INICIAL,pagadores:0,gratis:12}))'), /Sin pagadores/);
});

test('el factor termico conserva la formula y afecta a ambos combustibles', () => {
  const { evaluar } = crearApp();
  for (const [entorno, coeficiente] of [['quincho', 0], ['chulengo', 0.45], ['intemperie', 1]]) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,entorno:'${entorno}'})`);
    const factor = 1 + (0.02 * 7 + 0.015 * 25) * coeficiente;
    assert.equal(c.carbonKg, Math.round(Math.max(3, c.kgCarneTotal * 0.95 + c.chorizos * 0.06) * factor * 10) / 10);
    assert.equal(c.lenaKg, Math.round(Math.max(2, c.kgCarneTotal * 0.48) * factor * 10) / 10);
  }
});

test('los cortes siempre suman el total para ambos modos, de 0 a 500 personas', () => {
  const { evaluar } = crearApp();
  for (const modo of ['premium', 'economico']) {
    for (let personas = 0; personas <= 500; personas++) {
      const c = evaluar(`calcularAsado({...ESTADO_INICIAL,modo:'${modo}',pagadores:${personas}})`);
      assert.equal(Math.round((c.kgVacio + c.kgTira + c.kgPollo) * 10), Math.round(c.kgCarneTotal * 10));
      assert.ok(c.kgVacio >= 0 && c.kgTira >= 0 && c.kgPollo >= 0);
      if (modo === 'premium') assert.equal(c.kgPollo, 0);
    }
  }
});

test('el presupuesto suma cada rubro con su precio, incluido el pollo', () => {
  const { evaluar } = crearApp();
  const datos = "{...ESTADO_INICIAL,modo:'economico',precioCarne:12000,precioPollo:4000,precioChorizo:1000,precioMorcilla:900,precioCarbon:2200,precioLena:700,extras:1500}";
  const c = evaluar(`calcularAsado(${datos})`);
  const esperado = Math.round((c.kgVacio + c.kgTira) * 12000) + Math.round(c.kgPollo * 4000)
    + c.chorizos * 1000 + c.morcillas * 900 + c.bolsasCarbon * 2200 + Math.round(c.lenaKg * 700) + 1500;
  assert.equal(c.totalEstimado, esperado);
  assert.equal(c.presupuestoCompleto, true);
  const masPollo = evaluar(`calcularAsado({...${datos},precioPollo:5000})`);
  assert.equal(masPollo.totalEstimado - c.totalEstimado, Math.round(c.kgPollo * 1000));
});

test('precio vacio es incompleto, cero explicito es valido y extras es opcional', () => {
  const { evaluar } = crearApp();
  assert.equal(evaluar('calcularAsado(ESTADO_INICIAL).presupuestoCompleto'), false);
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,precioCarne:0,precioChorizo:0,precioMorcilla:0,precioCarbon:0,precioLena:0})');
  assert.equal(c.presupuestoCompleto, true);
  assert.equal(c.totalEstimado, 0);
  assert.ok(!c.preciosFaltantes.includes('Pollo'));
});

test('precios invalidos nunca se convierten en otro precio ni producen NaN', () => {
  const { evaluar } = crearApp();
  for (const dato of ["'12.5'", "'12,5'", "'-10'", "'abc'", 'null', '{}', '[]', 'Infinity']) {
    assert.equal(evaluar(`leerPrecio(${dato})`), '');
    assert.equal(evaluar(`Number.isFinite(calcularAsado({...ESTADO_INICIAL,precioCarne:${dato}}).totalEstimado)`), true);
  }
  assert.equal(evaluar("leerPrecio('12000')"), 12000);
  assert.match(evaluar('formatearKg(6.8)'), /6,8 kg/);
  assert.match(evaluar('formatearKg(2)'), /2,0 kg/);
});

test('datos de estado corruptos se normalizan a opciones validas', () => {
  const { evaluar } = crearApp();
  const c = evaluar("calcularAsado({modo:'__proto__',entorno:'constructor',temperatura:200,viento:-30,precioCarne:{toString:0}})");
  assert.equal(c.modo, 'premium');
  assert.equal(c.entorno, 'chulengo');
  assert.equal(c.temperatura, 35);
  assert.equal(c.viento, 0);
  assert.equal(c.precioCarne, '');
});

test('historial invalido no rompe la app y conserva hasta 10 entradas sanas', () => {
  const { evaluar, memoria } = crearApp();
  for (const invalido of ['{}', 'null', '{roto', '[null,{"fecha":"invalida"}]']) {
    memoria.set('asadoProHistorialVanilla', invalido);
    assert.equal(evaluar('leerHistorial().length'), 0);
    assert.doesNotThrow(() => evaluar('renderizarHistorial()'));
  }
  const valido = { fecha: '2026-10-08T12:00:00Z', calculo: { totalPersonas: 12, totalEstimado: 10000 } };
  memoria.set('asadoProHistorialVanilla', JSON.stringify([null, { fecha: '2026-10-08', calculo: {totalPersonas: {}} }, ...Array(12).fill(valido)]));
  assert.equal(evaluar('leerHistorial().length'), 10);
});

test('almacenamiento bloqueado no impide calcular, restaurar ni resetear', () => {
  const { evaluar, window, nodos } = crearApp();
  for (const clave of ['getItem', 'setItem', 'removeItem']) window.localStorage[clave] = () => { throw new Error('Bloqueado'); };
  assert.doesNotThrow(() => evaluar('guardarEstadoFormulario(); restaurarEstadoFormulario(); resetearFormulario()'));
  assert.match(nodos.get('#estadoGuardado').textContent, /No se pudo guardar/);
});

test('reset cancela el debounce y deja el estado sin persistir', () => {
  const { evaluar, memoria, pendientes, nodos } = crearApp();
  nodos.get('#personasPagas').value = '22';
  evaluar('debounceRender(); resetearFormulario()');
  assert.equal(pendientes.size, 0);
  assert.equal(memoria.has('asadoProEstado'), false);
  assert.equal(nodos.get('#personasPagas').value, '12');
});

test('compartir confirma los cambios pendientes antes de generar el mensaje', () => {
  const { evaluar, nodos, pendientes, window } = crearApp();
  nodos.get('#personasPagas').value = '18';
  evaluar('debounceRender(); compartirPorWhatsapp()');
  assert.equal(pendientes.size, 0);
  assert.match(decodeURIComponent(window.ultimaUrl), /Personas: 18/);
  assert.match(decodeURIComponent(window.ultimaUrl), /Faltan precios/);
});

test('historial restaura los nuevos precios y conserva ceros explicitos', () => {
  const { evaluar, nodos } = crearApp();
  evaluar('cargarAsadoHistorial({...ESTADO_INICIAL,pagadores:8,gratis:4,precioPollo:4000,precioChorizo:0,precioLena:700})');
  assert.equal(nodos.get('#invitadosGratis').value, '4');
  assert.equal(nodos.get('#precioPollo').value, '4000');
  assert.equal(nodos.get('#precioChorizo').value, '0');
  assert.equal(nodos.get('#precioLena').value, '700');
});

test('manifest inicia en la raiz del proyecto y todos los assets offline existen', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'public/manifest.json'), 'utf8'));
  const url = 'https://nitsugaone.github.io/calculadora-asado/public/manifest.json';
  assert.equal(new URL(manifest.start_url, url).pathname, '/calculadora-asado/');
  assert.equal(new URL(manifest.scope, url).pathname, '/calculadora-asado/');
  const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
  const contexto = vm.createContext({ URL, self: { registration: { scope: 'https://ejemplo.com/calculadora-asado/' }, addEventListener() {} } });
  vm.runInContext(sw, contexto);
  for (const archivo of vm.runInContext('ARCHIVOS_CACHE', contexto)) assert.ok(fs.existsSync(path.join(raiz, archivo)));
});

test('el service worker solo elimina sus versiones antiguas, no caches ajenas', async () => {
  const eventos = {};
  const borrados = [];
  let nombres = [];
  const contexto = vm.createContext({ URL, self: {
    registration: { scope: 'https://ejemplo.com/calculadora-asado/' },
    addEventListener: (nombre, funcion) => { eventos[nombre] = funcion; }, clients: { claim() {} },
  }, caches: {
    keys: async () => nombres,
    delete: async (nombre) => borrados.push(nombre),
  } });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'), contexto);
  nombres = ['asado-pro:/calculadora-asado/:anterior', vm.runInContext('CACHE_NAME', contexto), 'asado-pro:/otra-app/:v1', 'otro-proyecto'];
  let terminado;
  eventos.activate({ waitUntil: (promesa) => { terminado = promesa; } });
  await terminado;
  assert.deepEqual(borrados, ['asado-pro:/calculadora-asado/:anterior']);
});

test('perfiles conservan 750/500/250 g crudos en ambos modos', () => {
  const { evaluar } = crearApp();
  for (const modo of ['premium', 'economico']) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,pagadores:6,gratis:2,hombres:3,mujeres:3,ninos:2,modo:'${modo}'})`);
    assert.equal(c.gramosCarneTotal, 4250);
    assert.equal(c.kgCarneTotal, 4.3);
    assert.equal(c.sinPerfil, 0);
    assert.equal(c.perfilesValidos, true);
    assert.equal(c.totalPersonas, 8);
  }
});

test('personas sin perfil usan 500 g sin asumir su edad o genero', () => {
  const { evaluar } = crearApp();
  const c = evaluar('calcularAsado({...ESTADO_INICIAL,pagadores:10,hombres:2,mujeres:1,ninos:1})');
  assert.equal(c.sinPerfil, 6);
  assert.equal(c.gramosCarneTotal, 5250);
  assert.equal(c.kgCarneTotal, 5.3);
});

test('la compra no redondea por debajo de los gramos base', () => {
  const { evaluar } = crearApp();
  for (const [perfil, gramos] of [['hombres', 750], ['mujeres', 500], ['ninos', 250]]) {
    const c = evaluar(`calcularAsado({...ESTADO_INICIAL,pagadores:1,${perfil}:1})`);
    assert.equal(c.gramosCarneTotal, gramos);
    assert.ok(Math.round(c.kgCarneTotal * 1000) >= gramos);
    assert.equal(Math.round((c.kgVacio + c.kgTira + c.kgPollo) * 10), Math.round(c.kgCarneTotal * 10));
  }
});

test('perfiles que superan comensales no generan compras ni permiten guardar', () => {
  const { evaluar, nodos, memoria } = crearApp();
  nodos.get('#personasPagas').value = '2';
  nodos.get('#hombres').value = '3';
  evaluar('actualizarTodo(); guardarAsado()');
  assert.equal(evaluar('calculoActual.perfilesValidos'), false);
  assert.equal(evaluar('calculoActual.kgCarneTotal'), 0);
  assert.equal(evaluar('calculoActual.carbonKg'), 0);
  assert.equal(nodos.get('#guardarAsado').disabled, true);
  assert.equal(memoria.has('asadoProHistorialVanilla'), false);
});

test('los perfiles persisten y se recuperan desde el historial', () => {
  const { evaluar, nodos, memoria } = crearApp();
  evaluar("cargarAsadoHistorial({...ESTADO_INICIAL,pagadores:4,gratis:2,hombres:2,mujeres:2,ninos:2,modo:'economico'})");
  const guardado = JSON.parse(memoria.get('asadoProEstado'));
  assert.equal(guardado.hombres, 2);
  assert.equal(guardado.ninos, 2);
  assert.equal(guardado.modo, 'economico');
  assert.equal(nodos.get('#ninos').value, '2');
  evaluar('restaurarEstadoFormulario()');
  assert.equal(evaluar('calculoActual.gramosCarneTotal'), 3000);
});

test('Quincho retira clima y pronostico; volver a Chulengo los recupera', () => {
  const { evaluar, nodos } = crearApp();
  evaluar("aplicarEstadoFormulario({...ESTADO_INICIAL,entorno:'quincho'})");
  for (const id of ['#camposClima', '#panelPronostico', '#mensajeClima']) assert.equal(nodos.get(id).hidden, true);
  assert.equal(evaluar('calculoActual.factorTermico'), 1);
  evaluar("aplicarEstadoFormulario({...ESTADO_INICIAL,entorno:'chulengo'})");
  for (const id of ['#camposClima', '#panelPronostico', '#mensajeClima']) assert.equal(nodos.get(id).hidden, false);
});
