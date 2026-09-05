'use strict';

// Tests del criterio de resolucion de transicion.html.
//
// El bug que los motiva: el umbral de pH estaba como `ph>7.30`, asi que un pH de
// 7,30 exacto caia en "todavia no se cumplen los criterios" mientras 7,31 pasaba.
// Los otros dos umbrales del mismo criterio ya eran inclusivos (hco3>=18,
// ag<=12), y ingreso.html usa ph>=7.30 para decir que no hay acidosis: el mismo
// paciente quedaba sin acidosis en una pantalla y sin resolver en la otra.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'transicion.html'), 'utf8');

const fuente = html.match(/function estaResuelto\(ph, hco3, ag, tieneCl\)\{[\s\S]*?\n\}/);
assert.ok(fuente, 'No se hallo la funcion estaResuelto() en transicion.html');

const contexto = {};
vm.createContext(contexto);
vm.runInContext(`${fuente[0]}; this.estaResuelto = estaResuelto;`, contexto);
const { estaResuelto } = contexto;

// --- El caso reportado ------------------------------------------------------
assert.equal(estaResuelto(7.30, 18, 12, true), true,
  'pH 7,30 con bicarbonato 18 y anion gap 12 tiene que dar resuelto');

// --- Los tres umbrales son inclusivos --------------------------------------
assert.equal(estaResuelto(7.30, 18, 12, true), true, 'Los tres justo en el umbral: resuelto');
assert.equal(estaResuelto(7.31, 18, 12, true), true, 'pH apenas arriba: resuelto');
assert.equal(estaResuelto(7.29, 18, 12, true), false, 'pH apenas abajo: no resuelto');
assert.equal(estaResuelto(7.40, 17.9, 12, true), false, 'Bicarbonato apenas abajo: no resuelto');
assert.equal(estaResuelto(7.40, 18, 12.1, true), false, 'Anion gap apenas arriba: no resuelto');

// --- Coherencia con ingreso.html -------------------------------------------
// ingreso.html define hayAcidosis=(ph<7.30||hco3<18). Lo que alli deja de ser
// acidosis no puede seguir siendo "no resuelto" aca.
const ingreso = fs.readFileSync(path.join(raiz, 'ingreso.html'), 'utf8');
assert.match(
  ingreso,
  /hayAcidosis\s*=\s*\(ph<7\.30\|\|hco3<18\)/,
  'Cambio el criterio de acidosis de ingreso.html: revisar que siga coherente con este',
);
for (const [ph, hco3] of [[7.30, 18], [7.35, 20], [7.30, 24]]) {
  assert.equal(
    estaResuelto(ph, hco3, 10, true), true,
    `pH ${ph} y bicarbonato ${hco3} no son acidosis en ingreso.html, tienen que ser resolucion aca`,
  );
}

// --- Centros sin cloro ------------------------------------------------------
// Donde no hay determinacion de cloro no hay anion gap: el criterio corre solo
// con pH y bicarbonato, y no debe exigir un dato que no existe.
assert.equal(estaResuelto(7.30, 18, null, false), true, 'Sin cloro alcanza con pH y bicarbonato');
assert.equal(estaResuelto(7.29, 18, null, false), false, 'Sin cloro el pH sigue mandando');

// --- Faltan datos: null, distinto de "no resuelto" -------------------------
assert.equal(estaResuelto(null, 18, 12, true), null, 'Sin pH no se sabe');
assert.equal(estaResuelto(7.30, null, 12, true), null, 'Sin bicarbonato no se sabe');
assert.equal(estaResuelto(7.30, 18, null, true), null, 'Con cloro disponible, sin anion gap no se sabe');

console.log('OK: criterio de resolución — umbrales inclusivos, coherencia con ingreso.html, centros sin cloro y datos faltantes');
