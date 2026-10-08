// Pruebas opcionales de navegador: requiere Playwright disponible en NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const permitidos = new Set(['index.html', 'script.js', 'style.css', 'sw.js', 'public/manifest.json', 'public/icon.svg']);

(async () => {
  const servidor = http.createServer(async (solicitud, respuesta) => {
    const ruta = new URL(solicitud.url, 'http://localhost').pathname;
    const archivo = ruta.replace(/^\/calculadora-asado\//, '') || 'index.html';
    if (!ruta.startsWith('/calculadora-asado/') || !permitidos.has(archivo)) {
      respuesta.writeHead(404).end(); return;
    }
    try {
      const contenido = await fs.readFile(path.join(raiz, archivo));
      respuesta.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)], 'Cache-Control': 'no-cache' }).end(contenido);
    } catch { respuesta.writeHead(404).end(); }
  });
  let navegador;
  try {
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    navegador = await chromium.launch({ headless: true, channel: 'msedge' });
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pagina = await contexto.newPage();
    const errores = [];
    let consultasClima = 0;
    pagina.on('request', (solicitud) => {
      if (solicitud.url().includes('api.open-meteo.com')) consultasClima += 1;
    });
    pagina.on('pageerror', (error) => errores.push(error.message));
    await pagina.goto(`http://127.0.0.1:${servidor.address().port}/calculadora-asado/`);
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.reload();
    await pagina.waitForFunction(() => navigator.serviceWorker.controller);
    await pagina.getByText('Presupuesto incompleto.', { exact: false }).waitFor();
    const altoConClima = (await pagina.locator('.panel--resultados').boundingBox()).height;
    await pagina.locator('input[value="quincho"]').check();
    assert.equal(await pagina.locator('#camposClima').isVisible(), false);
    assert.equal(await pagina.locator('#panelPronostico').isVisible(), false);
    assert.ok((await pagina.locator('.panel--resultados').boundingBox()).height < altoConClima - 100);
    assert.equal(await pagina.locator('#presupuestoQuincho #presupuestoAsado').count(), 1);
    await pagina.locator('input[value="chulengo"]').check();
    assert.equal(await pagina.locator('#temperatura').inputValue(), '8');

    await pagina.locator('#personasPagas').fill('0');
    await pagina.locator('#personasPagas').blur();
    await pagina.getByText('Ingresá la cantidad de personas para ver las cantidades', { exact: false }).waitFor();
    assert.equal(await pagina.locator('#guardarAsado').isDisabled(), true);

    await pagina.locator('#personasPagas').fill('8');
    await pagina.locator('#invitadosGratis').fill('4');
    await pagina.locator('#invitadosGratis').blur();
    await pagina.locator('#resumenComensales').getByText('12 personas comen').waitFor();
    await pagina.locator('.perfiles summary').click();
    await pagina.locator('#hombres').fill('20');
    await pagina.locator('#hombres').blur();
    await pagina.getByText('Revisá los perfiles:', { exact: false }).waitFor();
    assert.equal(await pagina.locator('#guardarAsado').isDisabled(), true);
    for (const [id, valor] of [['hombres', '4'], ['mujeres', '3'], ['ninos', '2']]) {
      await pagina.locator(`#${id}`).fill(valor);
      await pagina.locator(`#${id}`).blur();
    }
    await pagina.getByText('6,5 kg', { exact: true }).waitFor();
    await pagina.locator('#abrirAjustes').click();
    assert.equal(await pagina.locator('#modalAjustes').isVisible(), true);
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.locator('#modalAjustes').isVisible(), false);
    assert.equal(await pagina.locator('#abrirAjustes').evaluate((nodo) => document.activeElement === nodo), true);
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesPrecios summary').click();
    for (const id of ['precioCarne', 'precioCarbon', 'precioChorizo', 'precioMorcilla', 'precioLena']) {
      await pagina.locator(`#${id}`).fill('1000');
      await pagina.locator(`#${id}`).blur();
    }
    await pagina.getByText('Presupuesto completo', { exact: true }).waitFor();
    await pagina.locator('#cerrarAjustes').click();
    await pagina.locator('#guardarAsado').click();
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesHistorial summary').click();
    assert.equal(await pagina.locator('.historial-item').count(), 1);
    await pagina.locator('#cerrarAjustes').click();
    await pagina.locator('#personasPagas').fill('3');
    await pagina.locator('#personasPagas').blur();
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('.btn-cargar').click();
    assert.equal(await pagina.locator('#modalAjustes').isVisible(), false);
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '8');
    assert.equal(await pagina.locator('#invitadosGratis').inputValue(), '4');
    assert.equal(await pagina.locator('#hombres').inputValue(), '4');
    assert.equal(await pagina.locator('#ninos').inputValue(), '2');

    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesCortes summary').click();
    await pagina.locator('input[value="economico"]').check();
    assert.equal(await pagina.locator('#campoPrecioPollo').isVisible(), true);
    await pagina.locator('#precioPollo').fill('4000');
    await pagina.locator('#precioPollo').blur();
    await pagina.getByText('Presupuesto completo', { exact: true }).waitFor();
    await pagina.locator('#cerrarAjustes').click();
    await pagina.reload();
    assert.equal(await pagina.locator('#hombres').inputValue(), '4');
    assert.equal(await pagina.locator('#ninos').inputValue(), '2');
    assert.equal(await pagina.locator('input[value="economico"]').isChecked(), true);

    await pagina.locator('#generarLista').click();
    assert.equal(await pagina.locator('#modalLista').isVisible(), true);
    assert.match(await pagina.locator('#contenidoLista').textContent(), /Morcillas:.*\nCarbón:/);
    await pagina.emulateMedia({ media: 'print' });
    const impresion = await pagina.locator('#contenidoLista').evaluate((nodo) => {
      const estilo = getComputedStyle(nodo);
      return { fondo: estilo.backgroundColor, altura: estilo.maxHeight, overflow: estilo.overflow };
    });
    assert.deepEqual(impresion, { fondo: 'rgb(255, 255, 255)', altura: 'none', overflow: 'visible' });
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.locator('#cerrarLista').click();

    // Recuperación de funciones: rendimiento optativo, tipos, bebidas y edición segura.
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesPrecios').evaluate((nodo) => { nodo.open = true; });
    await pagina.locator('#ajustesCortes').evaluate((nodo) => { nodo.open = true; });
    await pagina.locator('#tipoCarne').selectOption('con_hueso');
    await pagina.locator('#ajustarPorCorte').check();
    assert.equal(await pagina.locator('label[for="hombres"] .gramaje').textContent(), '880 g');
    await pagina.locator('#resultadoCards .card-resultado').first().getByText('7,7 kg', { exact: true }).waitFor();
    await pagina.locator('#ajustarPorCorte').uncheck();
    await pagina.locator('#tipoCarne').selectOption('cordero');
    assert.equal(await pagina.locator('#campoPrecioCordero').isVisible(), true);
    assert.equal(await pagina.locator('#campoPrecioCarne').isVisible(), false);
    await pagina.locator('#tipoCarne').selectOption('cerdo');
    await pagina.locator('#precioCerdo').fill('9000');
    await pagina.locator('#precioCerdo').blur();
    await pagina.locator('#personasAchuras').fill('6');
    await pagina.locator('#personasAchuras').blur();
    await pagina.locator('#precioAchuras').fill('6000');
    await pagina.locator('#precioAchuras').blur();
    await pagina.locator('#extras').fill('2000');
    await pagina.locator('#extras').blur();
    await pagina.locator('#ajustesBebidas summary').click();
    await pagina.locator('#incluirExtras').check();
    await pagina.locator('#adultosBebedores').fill('4');
    await pagina.locator('#adultosBebedores').blur();
    await pagina.locator('#ajustesLista summary').click();
    const nombreCerdo = pagina.locator('[data-id="cerdo"] input[type="text"]').first();
    await nombreCerdo.fill('<img src=x onerror=alert(1)>');
    assert.equal(await nombreCerdo.evaluate((nodo) => document.activeElement === nodo), true);
    assert.equal(await pagina.locator('#listaEditable img').count(), 0);
    await nombreCerdo.fill('Bondiola');
    await pagina.locator('[data-id="cerdo"] input[type="text"]').nth(1).fill('8 kg');
    await pagina.locator('[data-id="cerdo"] input[type="checkbox"]').check();
    await pagina.locator('#agregarItemLista').click();
    const personalizado = pagina.locator('[data-id^="personal_"]');
    await personalizado.locator('input[type="text"]').first().fill('Sal');
    await personalizado.locator('input[type="text"]').nth(1).fill('1 paquete');
    await pagina.locator('#cerrarAjustes').click();
    await pagina.locator('#guardarAsado').click();
    await pagina.reload();
    await pagina.locator('#generarLista').click();
    const listaEditada = await pagina.locator('#contenidoLista').textContent();
    assert.match(listaEditada, /Bondiola: 8 kg \(comprado\)/);
    assert.match(listaEditada, /Sal: 1 paquete/);
    assert.match(listaEditada, /Cerveza: 4,4 l/);
    assert.match(listaEditada, /Achuras: 0,8 kg/);
    assert.match(listaEditada, /presupuesto corresponde a las cantidades sugeridas/);
    await pagina.locator('#cerrarLista').click();
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesCortes summary').click();
    await pagina.locator('#tipoCarne').selectOption('pollo');
    await pagina.locator('#ajustesHistorial summary').click();
    await pagina.locator('.btn-cargar').first().click();
    assert.equal(await pagina.locator('#tipoCarne').inputValue(), 'cerdo');
    assert.equal(await pagina.locator('#incluirExtras').isChecked(), true);
    assert.equal(await pagina.locator('#personasAchuras').inputValue(), '6');
    assert.equal(await pagina.locator('#precioAchuras').inputValue(), '6000');
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesLista summary').click();
    await personalizado.locator('button').click();
    assert.equal(await personalizado.count(), 0);
    await pagina.locator('#cerrarAjustes').click();

    // Evaluar no altera la compra; la sugerencia se aplica por separado y con confirmación.
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesHistorial').evaluate((nodo) => { nodo.open = true; });
    const evaluacion = pagina.locator('.evaluacion-asado').first();
    await evaluacion.focus();
    await evaluacion.selectOption('falto');
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1');
    assert.equal(await evaluacion.evaluate((nodo) => document.activeElement === nodo), true);
    await evaluacion.selectOption('sobro');
    assert.equal(await pagina.locator('.btn-ajuste').first().textContent(), 'Usar ajuste 0,95x');
    await evaluacion.selectOption('falto');
    assert.equal(await pagina.locator('.btn-ajuste').first().textContent(), 'Usar ajuste 1,12x');
    pagina.once('dialog', (dialogo) => dialogo.dismiss());
    await pagina.locator('.btn-ajuste').first().click();
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1');
    pagina.once('dialog', (dialogo) => dialogo.accept());
    await pagina.locator('.btn-ajuste').first().click();
    assert.equal(await pagina.locator('#modalAjustes').isVisible(), false);
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1.12');
    assert.equal(await pagina.locator('#precioCerdo').inputValue(), '9000');
    assert.equal(await pagina.evaluate(() => JSON.parse(localStorage.getItem('asadoProHistorialVanilla'))[0].calculo.kgCarneTotal), 6.5);
    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#ajustesCalibracion summary').click();
    await pagina.locator('#restablecerFactor').click();
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1');
    await pagina.locator('#factorCompra').focus();
    await pagina.keyboard.press('ArrowRight');
    await pagina.locator('#valorFactorCompra').getByText('1,01x', { exact: true }).waitFor();
    await pagina.locator('#factorCompra').evaluate((nodo) => {
      nodo.value = '1.12'; nodo.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await pagina.locator('#cerrarAjustes').click();

    // El enlace guarda precios y factor, no textos de la lista, y requiere decisión explícita.
    await pagina.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async (texto) => { window.enlaceCopiadoPrueba = texto; } } }));
    await pagina.locator('#copiarEnlace').click();
    await pagina.getByRole('button', { name: 'Enlace copiado', exact: true }).waitFor();
    const enlace = await pagina.locator('#enlaceGenerado').inputValue();
    assert.equal(await pagina.evaluate(() => window.enlaceCopiadoPrueba), enlace);
    assert.match(enlace, /\/calculadora-asado\/#asado=/);
    await pagina.locator('#personasPagas').fill('16');
    await pagina.locator('#personasPagas').blur();
    const estadoAntesDelEnlace = await pagina.evaluate(() => localStorage.getItem('asadoProEstado'));
    await pagina.goto(enlace);
    await pagina.locator('#modalCompartido').waitFor({ state: 'visible' });
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '16');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('asadoProEstado')), estadoAntesDelEnlace);
    await pagina.locator('#cancelarCompartido').click();
    assert.equal(new URL(pagina.url()).hash, '');
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '16');
    await pagina.goto(enlace);
    await pagina.locator('#modalCompartido').waitFor({ state: 'visible' });
    await pagina.keyboard.press('Escape');
    await pagina.waitForFunction(() => !location.hash);
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '16');
    await pagina.goto(enlace);
    await pagina.locator('#aceptarCompartido').click();
    await pagina.waitForFunction(() => !location.hash);
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '8');
    assert.equal(await pagina.locator('#precioCerdo').inputValue(), '9000');
    assert.equal(await pagina.locator('#precioAchuras').inputValue(), '6000');
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1.12');
    await pagina.locator('#generarLista').click();
    assert.doesNotMatch(await pagina.locator('#contenidoLista').textContent(), /Bondiola/);
    await pagina.locator('#cerrarLista').click();
    await pagina.reload();
    assert.equal(await pagina.locator('#modalCompartido').isVisible(), false);
    await pagina.goto(`${enlace.split('#')[0]}#asado=corrupto`);
    await pagina.getByText('Enlace inválido o incompatible.', { exact: false }).waitFor();
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '8');
    const enlaceV1 = await pagina.evaluate((url) => {
      const destino = new URL(url);
      const codificado = destino.hash.slice('#asado='.length).replace(/-/g, '+').replace(/_/g, '/');
      const datos = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(codificado), (letra) => letra.charCodeAt(0))));
      datos.version = 1; delete datos.estado.factorCompra;
      destino.hash = `asado=${btoa(JSON.stringify(datos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
      return destino.href;
    }, enlace);
    await pagina.goto(enlaceV1);
    await pagina.locator('#resumenCompartido').getByText('ajuste 1x', { exact: false }).waitFor();
    await pagina.locator('#cancelarCompartido').click();

    await pagina.locator('#abrirAjustes').click();
    await pagina.locator('#btnReset').click();
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '12');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('asadoProEstado')), null);
    assert.equal(await pagina.locator('#hombres').inputValue(), '0');
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1');
    await pagina.locator('#cerrarAjustes').click();
    await fs.mkdir(path.join(raiz, '.qa'), { recursive: true });
    for (const [nombre, ancho] of [['desktop', 1280], ['tablet', 768], ['mobile', 390], ['mobile-estrecho', 320]]) {
      await pagina.setViewportSize({ width: ancho, height: 900 });
      await pagina.evaluate(() => window.scrollTo(0, 0));
      if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        console.log('Elementos fuera de pantalla:', await pagina.locator('body *').evaluateAll((nodos) => nodos
          .filter((nodo) => nodo.getBoundingClientRect().right > innerWidth + 1)
          .map((nodo) => `${nodo.tagName}.${nodo.className}`).slice(0, 15)));
      }
      assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Sin desborde en ${ancho}px`);
      const desbordes = await pagina.locator('.card-resultado').evaluateAll((cards) => cards.filter((card) => card.scrollWidth > card.clientWidth + 1).length);
      assert.equal(desbordes, 0);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}.png`), fullPage: true });
      const altoAnterior = (await pagina.locator('.panel--resultados').boundingBox()).height;
      await pagina.locator('input[value="quincho"]').check();
      assert.ok((await pagina.locator('.panel--resultados').boundingBox()).height < altoAnterior - 100);
      assert.equal(await pagina.locator('#presupuestoQuincho #presupuestoAsado').count(), 1);
      await pagina.evaluate(() => Promise.all(document.getAnimations().map((animacion) => animacion.finished)));
      await pagina.evaluate(() => window.scrollTo(0, 0));
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-quincho.png`), fullPage: true });
      await pagina.locator('#abrirAjustes').click();
      await pagina.locator('#ajustesPrecios').evaluate((nodo) => { nodo.open = true; });
      assert.equal(await pagina.locator('#modalAjustes').evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth), true);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-ajustes.png`) });
      await pagina.locator('#ajustesLista').evaluate((nodo) => { nodo.open = true; nodo.scrollIntoView(); });
      assert.equal(await pagina.locator('#modalAjustes').evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth), true);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-lista.png`) });
      await pagina.locator('#ajustesCalibracion').evaluate((nodo) => { nodo.open = true; nodo.scrollIntoView(); });
      assert.equal(await pagina.locator('#modalAjustes').evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth), true);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-calibracion.png`) });
      await pagina.locator('#ajustesHistorial').evaluate((nodo) => { nodo.open = true; nodo.scrollIntoView(); });
      assert.equal(await pagina.locator('#modalAjustes').evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth), true);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-evaluacion.png`) });
      await pagina.keyboard.press('Escape');
      await pagina.goto(enlace);
      await pagina.locator('#modalCompartido').waitFor({ state: 'visible' });
      assert.equal(await pagina.locator('#modalCompartido').evaluate((nodo) => nodo.scrollWidth <= nodo.clientWidth), true);
      await pagina.screenshot({ path: path.join(raiz, '.qa', `${nombre}-compartido.png`) });
      await pagina.locator('#cancelarCompartido').click();
      await pagina.locator('input[value="chulengo"]').check();
      assert.equal(await pagina.locator('.panel--resultados #presupuestoAsado').count(), 1);
    }

    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.locator('#personasPagas').fill('20');
    await pagina.locator('#personasPagas').blur();
    await pagina.locator('#resumenComensales').getByText('20 personas comen').waitFor();
    assert.equal(await pagina.locator('#estadoConexion').textContent(), 'Modo offline');
    await pagina.goto(enlace);
    await pagina.locator('#modalCompartido').waitFor({ state: 'visible' });
    await pagina.reload();
    await pagina.locator('#aceptarCompartido').click();
    assert.equal(await pagina.locator('#precioAchuras').inputValue(), '6000');
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '8');
    assert.equal(await pagina.locator('#factorCompra').inputValue(), '1.12');
    assert.equal(await pagina.locator('#estadoConexion').textContent(), 'Modo offline');
    assert.deepEqual(errores, []);
    assert.equal(consultasClima, 0);
    console.log('OK: evaluación idempotente, ajuste confirmado, teclado, reset y enlaces v1/v2 con factor offline; achuras, cortes, bebidas, lista, historial, perfiles e impresión en 4 tamaños. Sin errores JS ni consultas automáticas de clima.');
  } finally {
    await navegador?.close();
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
