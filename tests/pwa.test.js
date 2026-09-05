'use strict';

// Protege la app de las formas en que se rompe sola. Varias de estas ya habian
// pasado antes de publicarla: tres de las cuatro pantallas no declaraban
// charset (todos los acentos rotos) ni viewport (se renderizaban a ancho de
// escritorio en el celular), y solo la portada registraba el service worker.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

const sw = leer('sw.js');
const registrador = leer('registrar-sw.js');
const manifest = JSON.parse(leer('manifest.json'));

const PANTALLAS = ['index.html', 'ingreso.html', 'enfermeria.html', 'transicion.html'];

// --- Cada pantalla se ve bien en un celular ---------------------------------

for (const archivo of PANTALLAS) {
  const s = leer(archivo);
  assert.match(s, /<meta charset="utf-8">/i, `${archivo} no declara charset: los acentos se rompen`);
  assert.match(s, /name="viewport"/, `${archivo} no declara viewport: se renderiza a ancho de escritorio en el celular`);
  assert.match(s, /rel="manifest"/, `${archivo} no enlaza el manifest`);
  assert.match(s, /registrar-sw\.js/, `${archivo} no carga registrar-sw.js`);
  assert.match(s, /apple-touch-icon/, `${archivo} no declara apple-touch-icon`);
  assert.match(s, /name="robots"[^>]*noindex/, `${archivo} no pide noindex`);

  // Duplicados: dos metas en conflicto dejan el resultado librado a cual gana.
  for (const meta of ['charset', 'viewport', 'theme-color']) {
    const re = new RegExp(meta === 'charset' ? '<meta charset' : `name="${meta}"`, 'g');
    const n = (s.match(re) || []).length;
    assert.equal(n, 1, `${archivo} declara ${n} veces ${meta}, tiene que ser 1`);
  }
}

// El registro viejo vivia inline y solo en la portada.
for (const archivo of PANTALLAS) {
  assert.doesNotMatch(
    leer(archivo),
    /navigator\.serviceWorker\.register/,
    `${archivo} volvio a registrar el service worker inline: el registro vive en registrar-sw.js`,
  );
}

// --- La precarga cubre todo lo que se sirve ---------------------------------

const precarga = new Set(
  [...sw.matchAll(/^\s*'\.\/([^']*)',/gm)].map(([, url]) => url),
);

// Rutas relativas: la app tiene que andar desde la raiz de un dominio, desde un
// subdirectorio, y abierta por file:// desde el disco.
assert.doesNotMatch(
  sw,
  /^\s*'\/[^']*',/m,
  'sw.js volvio a precargar rutas absolutas: romperia por file:// y desde un subdirectorio',
);

for (const archivo of PANTALLAS) {
  assert.ok(precarga.has(archivo), `${archivo} no esta en FILES de sw.js: no funcionaria sin senal`);
}

// La portada ofrece el PDF como "22 paginas". Sin precargarlo el enlace muere
// justo sin senal, que es cuando mas hace falta.
assert.ok(precarga.has('protocolo.pdf'), 'protocolo.pdf no esta precargado y la portada lo ofrece');

for (const url of precarga) {
  if (url === '') continue; // './' es alias de index.html
  assert.ok(fs.existsSync(path.join(raiz, url)), `sw.js precarga ${url}, que no existe en disco`);
}

// --- Iconos -----------------------------------------------------------------

for (const icono of manifest.icons) {
  assert.ok(
    fs.existsSync(path.join(raiz, icono.src)),
    `El manifest declara ${icono.src}, que no existe en disco`,
  );
}

// Android recorta el icono a un circulo; sin uno maskable queda con marco.
assert.ok(
  manifest.icons.some((i) => i.purpose === 'maskable'),
  'El manifest no declara ningun icono maskable',
);

assert.equal(manifest.start_url, '.', 'El start_url del manifest tiene que ser relativo');
assert.equal(manifest.scope, '.', 'El scope del manifest tiene que ser relativo');

// --- La version no se desincroniza ------------------------------------------

const versionSw = sw.match(/var VERSION = '([^']+)'/);
const versionReg = registrador.match(/var VERSION = '([^']+)'/);
assert.ok(versionSw && versionReg, 'No se hallo la constante VERSION');
assert.equal(
  versionReg[1],
  versionSw[1],
  'La version de registrar-sw.js no coincide con la de sw.js: el sello mostraria una fecha equivocada',
);

// --- No se indexa -----------------------------------------------------------

assert.match(leer('robots.txt'), /Disallow:\s*\//, 'robots.txt ya no bloquea la indexacion');
assert.match(leer('_headers'), /X-Robots-Tag:\s*noindex/, '_headers ya no manda X-Robots-Tag noindex');

// --- El README no vuelve a decir que esta sin aprobar -----------------------
// Estaba aprobado por direccion, comite y diabetologia, pero el README seguia
// diciendo "no apto para uso asistencial". Repartirlo con eso se contradice.

assert.doesNotMatch(
  leer('README.md'),
  /no apto para uso asistencial/i,
  'El README volvio a decir que no esta aprobado, y si lo esta',
);

// --- La version del protocolo no se dispersa --------------------------------
// Llego a haber tres numeros distintos conviviendo: la portada decia 0.7, los
// pies de ingreso y enfermeria 0.6, y transicion 0.1. Dos de esas menciones van
// a la constancia que se pega en la historia clinica, asi que el registro del
// paciente quedaba sellado con una version que no era la vigente.

const VERSION_PROTOCOLO = '1.0';
const menciones = [];

for (const archivo of [...PANTALLAS, 'README.md']) {
  const s = leer(archivo);
  for (const [, v] of s.matchAll(/versi[oó]n\s*v?(\d+\.\d+)/gi)) menciones.push({ archivo, v });
  for (const [, v] of s.matchAll(/\bv(\d+\.\d+)\s*\((?:ago|sep|oct|nov|dic|ene|feb|mar|abr|may|jun|jul)/gi)) {
    menciones.push({ archivo, v });
  }
}

assert.ok(menciones.length >= 7, `Se esperaban al menos 7 menciones de version, se hallaron ${menciones.length}`);

for (const { archivo, v } of menciones) {
  assert.equal(
    v,
    VERSION_PROTOCOLO,
    `${archivo} menciona la version ${v} y la vigente es ${VERSION_PROTOCOLO}`,
  );
}

// --- La estrategia sigue siendo red primero ---------------------------------

const manejadorFetch = sw.slice(sw.indexOf("addEventListener('fetch'"));
assert.ok(
  manejadorFetch.indexOf('fetch(e.request)') < manejadorFetch.indexOf('caches.match'),
  'sw.js ya no consulta la red antes que el cache: esto calcula dosis de insulina, la version vigente tiene que ganar',
);

console.log(
  `OK: publicación ${versionSw[1]} — ${precarga.size} archivos precargados, `
  + `${manifest.icons.length} iconos, ${PANTALLAS.length} pantallas`,
);
