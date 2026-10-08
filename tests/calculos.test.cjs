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
    localStorage: {
      getItem: (clave) => memoria.get(clave) ?? null,
      setItem: (clave, valor) => memoria.set(clave, valor),
      removeItem: (clave) => memoria.delete(clave),
    },
    clearTimeout: (id) => pendientes.delete(id),
    setTimeout: (accion) => { pendientes.set(++indice, accion); return indice; },
    open: (url) => { window.ultimaUrl = url; },
  };
  const contexto = vm.createContext({ document, window, Intl, URL });
  vm.runInContext(fuente.slice(0, fuente.lastIndexOf('\nconfigurarEventos();')), contexto);
  const evaluar = (codigo) => vm.runInContext(codigo, contexto);
  evaluar('aplicarEstadoFormulario(ESTADO_INICIAL)');
  return { evaluar, nodos, memoria, pendientes, window };
}

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
