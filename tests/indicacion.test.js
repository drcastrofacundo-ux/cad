'use strict';

// Que la bomba de insulina solo se prescriba cuando el diagnostico la indica.
//
// Error encontrado el 2026-09-26: prescribir() no miraba el diagnostico. Con
// peso cargado armaba la bomba de CAD (0,1 U/kg/h) aun con veredicto
// "Hiperglucemia sin acidosis", que dice textual "NO corresponde infusion", y la
// constancia para la historia clinica quedaba con la bomba indicada.
//
// Igual que winter.test.js: la logica vive inline en ingreso.html, asi que se
// extrae la funcion pura y se evalua. Si alguien la saca o la renombra, falla.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ingreso.html'), 'utf8');

const fuente = html.match(/function indicacionBomba\(dx\)\{[\s\S]*?\n\}/);
assert.ok(fuente, 'No se hallo la funcion indicacionBomba() en ingreso.html');

const contexto = {};
vm.createContext(contexto);
vm.runInContext(`${fuente[0]}; this.indicacionBomba = indicacionBomba;`, contexto);
const { indicacionBomba } = contexto;

// --- Corresponde bomba -----------------------------------------------------
for (const dx of ['Cetoacidosis diabética leve', 'Cetoacidosis diabética moderada',
  'Cetoacidosis diabética severa', 'Cetoacidosis diabética severa (cetonuria no concluyente)',
  'Estado hiperosmolar']) {
  assert.equal(indicacionBomba(dx).tipo, 'si', dx);
}

// --- Bomba con advertencia (decision del 2026-09-26) -------------------------
const agNormal = indicacionBomba('Hiperglucemia con acidosis de anion gap normal');
assert.equal(agNormal.tipo, 'advertencia');
assert.match(agNormal.motivo, /no confirmad/i);

// --- NO corresponde bomba: el caso de la captura -----------------------------
const simple = indicacionBomba('Hiperglucemia sin acidosis');
assert.equal(simple.tipo, 'no', 'Hiperglucemia sin acidosis no lleva bomba');
assert.match(simple.motivo, /no corresponde/i);

assert.equal(indicacionBomba('Acidosis metabólica sin criterio de hiperglucemia').tipo, 'no');

// CAD euglucemica confirmada: bomba, con la dextrosa desde el inicio (2026-09-29)
const eug = indicacionBomba('Cetoacidosis diabética euglucémica leve');
assert.equal(eug.tipo, 'advertencia', 'CAD euglucemica lleva bomba con advertencia');
assert.match(eug.motivo, /dextrosa desde el inicio/i);

// Diabetico con glucemia < 200 y cetonas no confirmadas: sin bomba (decision del 2026-09-29)
const noConf = indicacionBomba('Acidosis en diabético con glucemia menor a 200, cetonas no confirmadas');
assert.equal(noConf.tipo, 'no', 'sin cetonas confirmadas no hay bomba');
assert.match(noConf.motivo, /cetonemia/i);

// Sin glucemia, pH y bicarbonato no hay diagnostico: no se prescribe.
assert.equal(indicacionBomba('').tipo, 'no');
assert.match(indicacionBomba('').motivo, /glucemia, pH y bicarbonato/);

// Un diagnostico que no se reconoce no habilita la bomba (falla segura).
assert.equal(indicacionBomba('algo nuevo que nadie conecto').tipo, 'no');

// --- Que prescribir() y nota() realmente la usen -----------------------------
// Sin esto, la funcion podria existir y la pantalla seguir ignorandola.
const prescribir = html.match(/function prescribir\(dx\)\{[\s\S]*?\n\}/);
assert.ok(prescribir, 'prescribir() tiene que recibir el diagnostico: function prescribir(dx)');
assert.match(prescribir[0], /indicacionBomba\(dx\)/, 'prescribir() tiene que consultar indicacionBomba(dx)');

const nota = html.match(/function nota\(\)\{[\s\S]*?\n\}/);
assert.ok(nota, 'No se hallo nota()');
assert.match(nota[0], /prescribir\(d\.dx\)/, 'nota() tiene que pasarle el diagnostico a prescribir()');
assert.match(nota[0], /rx\.sinBomba/, 'la constancia tiene que omitir la bomba cuando no corresponde');

console.log('indicacion.test.js: ok');
