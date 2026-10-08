// Simula el paso desde el worker React real sin depender del bundle ni de Vite.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const permitidos = new Set(['index.html', 'script.js', 'style.css', 'sw.js', 'manifest.json', 'icon.svg', 'public/manifest.json', 'public/icon.svg']);
const htmlAnterior = '<!doctype html><html lang="es"><title>PWA anterior</title><h1>PWA anterior</h1><script>navigator.serviceWorker.register("./sw.js");</script></html>';

(async () => {
  let version = 'react';
  let navegador;
  const servidor = http.createServer(async (solicitud, respuesta) => {
    const ruta = new URL(solicitud.url, 'http://localhost').pathname;
    const archivo = ruta.replace(/^\/calculadora-asado\//, '') || 'index.html';
    if (!ruta.startsWith('/calculadora-asado/') || !permitidos.has(archivo)) {
      respuesta.writeHead(404).end(); return;
    }
    try {
      let contenido;
      if (version === 'react' && archivo === 'index.html') contenido = htmlAnterior;
      else if (version === 'react' && archivo === 'sw.js') {
        contenido = await fs.readFile(path.join(__dirname, 'fixtures/sw-react-v8.js'));
      } else {
        contenido = await fs.readFile(path.join(raiz, archivo));
        if (version === 'siguiente' && archivo === 'sw.js') {
          contenido = contenido.toString().replace('${PREFIJO_CACHE}v9', '${PREFIJO_CACHE}v10');
        }
      }
      respuesta.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)], 'Cache-Control': 'no-store' }).end(contenido);
    } catch { respuesta.writeHead(404).end(); }
  });
  try {
    await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    navegador = await chromium.launch({ channel: 'msedge', headless: true });
    const contexto = await navegador.newContext();
    let pagina = await contexto.newPage();
    const inicio = `http://127.0.0.1:${servidor.address().port}/calculadora-asado/`;
    await pagina.goto(inicio);
    await pagina.evaluate(() => navigator.serviceWorker.ready);
    await pagina.reload();
    await pagina.waitForFunction(() => navigator.serviceWorker.controller);
    const original = JSON.stringify([{ id: 'previo', date: '2026-09-01T12:00:00Z', people: 12, meatKg: 6, carbonKg: 8, costPerPerson: 5000, totalARS: 60000 }]);
    await pagina.evaluate(async (historial) => {
      localStorage.setItem('asado-pro-history-v1', historial);
      localStorage.setItem('asadoProEstado', JSON.stringify({ pagadores: 7, gratis: 2 }));
      await caches.open('otra-aplicacion');
    }, original);
    version = 'vanilla';
    await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pagina.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    // El cliente anterior no tiene botón de actualización: cerrar libera el worker.
    await pagina.close();
    pagina = await contexto.newPage();
    await pagina.goto(inicio);
    await pagina.locator('#personasPagas').waitFor();
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '7');
    assert.equal(await pagina.locator('#invitadosGratis').inputValue(), '2');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('asado-pro-history-v1')), original);
    assert.equal(await pagina.evaluate(() => caches.has('otra-aplicacion')), true);
    const manifest = await pagina.evaluate(async () => {
      const ruta = document.querySelector('link[rel="manifest"]').href;
      return { ruta, contenido: await (await fetch(ruta)).json() };
    });
    assert.equal(manifest.ruta, inicio + 'manifest.json');
    assert.equal(new URL(manifest.contenido.start_url, manifest.ruta).href, inicio);
    assert.equal(new URL(manifest.contenido.scope, manifest.ruta).href, inicio);
    // Las actualizaciones vanilla deben esperar confirmación y conservar la edición pendiente.
    version = 'siguiente';
    await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pagina.locator('#actualizarApp').waitFor({ state: 'visible' });
    await pagina.locator('#personasPagas').fill('19');
    await pagina.locator('#actualizarApp').click();
    await pagina.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
    await pagina.reload();
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '19');
    assert.equal(await pagina.evaluate(() => localStorage.getItem('asado-pro-history-v1')), original);
    const cachesFinales = await pagina.evaluate(() => caches.keys());
    assert.ok(cachesFinales.includes('otra-aplicacion'));
    assert.ok(cachesFinales.includes('asado-pro:/calculadora-asado/:v10'));
    assert.ok(!cachesFinales.includes('asado-pro:/calculadora-asado/:v9'));
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.locator('#personasPagas').waitFor();
    assert.equal(await pagina.locator('#personasPagas').inputValue(), '19');
    assert.equal(await pagina.locator('#estadoConexion').textContent(), 'Modo offline');
    for (const archivo of ['manifest.json', 'icon.svg', 'public/manifest.json', 'public/icon.svg']) {
      assert.equal(await pagina.evaluate(async (ruta) => (await fetch(ruta)).ok, archivo), true);
    }
    console.log('OK: migración React, identidad PWA, datos originales, cachés ajenas, actualización confirmada y recarga offline.');
  } finally {
    await navegador?.close();
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
