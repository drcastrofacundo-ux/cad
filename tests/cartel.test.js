'use strict';

// Cartel de derivacion en ingreso: solo "Hiperglucemia sin acidosis" se manda a
// la pantalla de hiperglucemia en el critico (paso 1, 2026-09-27).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ingreso.html'), 'utf8');
const fuente = html.match(/function cartelPuerta\(dx\)\{[\s\S]*?\n\}/);
assert.ok(fuente, 'No se hallo cartelPuerta(dx) en ingreso.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fuente[0]}; this.cartelPuerta = cartelPuerta;`, ctx);
const { cartelPuerta } = ctx;

const c = cartelPuerta('Hiperglucemia sin acidosis');
assert.match(c, /no es CAD/i);
assert.match(c, /no uses (esta|la) bomba/i);
assert.match(c, /href="hiperglucemia\.html"/);

for (const dx of ['', 'Cetoacidosis diabética severa', 'Cetoacidosis diabética leve (cetonuria no concluyente)',
  'Estado hiperosmolar', 'Hiperglucemia con acidosis de anion gap normal',
  'Acidosis metabólica sin criterio de hiperglucemia']) {
  assert.equal(cartelPuerta(dx), '', `${dx || 'sin datos'} no lleva cartel`);
}

const calc = html.match(/function calcular\(\)\{[\s\S]*?\n\}/)[0];
assert.match(calc, /cartelPuerta\(dx\)/, 'calcular() tiene que mostrar el cartel');

console.log('cartel.test.js: ok');
