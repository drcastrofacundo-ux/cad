'use strict';

// Tests de la formula de Winter tal como la implementa ingreso.html.
//
// La logica clinica de esta app vive inline en el HTML, sin modulo, asi que el
// test extrae la funcion pura del archivo y la evalua. Si alguien la renombra o
// la saca, este test falla en vez de pasar en silencio.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ingreso.html'), 'utf8');

const fuente = html.match(/function winter\(hco3, pco2, ph\)\{[\s\S]*?\n\}/);
assert.ok(fuente, 'No se hallo la funcion winter() en ingreso.html');

const contexto = {};
vm.createContext(contexto);
vm.runInContext(`${fuente[0]}; this.winter = winter;`, contexto);
const { winter } = contexto;

function cerca(a, b, t = 1e-9) {
  assert.ok(Math.abs(a - b) <= t, `${a} no coincide con ${b}`);
}

// --- El calculo ------------------------------------------------------------
// HCO3 10 -> 1,5 x 10 + 8 = 23, rango 21 a 25.
const w = winter(10, null, 7.10);
cerca(w.esperada, 23);
cerca(w.min, 21);
cerca(w.max, 25);
assert.equal(w.lectura, null, 'Sin pCO2 medida no hay lectura');

// --- Las tres lecturas -----------------------------------------------------
assert.equal(winter(10, 23, 7.10).lectura, 'compensacion-adecuada');
assert.equal(winter(10, 21, 7.10).lectura, 'compensacion-adecuada', 'El borde inferior entra');
assert.equal(winter(10, 25, 7.10).lectura, 'compensacion-adecuada', 'El borde superior entra');
assert.equal(winter(10, 26, 7.10).lectura, 'acidosis-respiratoria', 'Un punto arriba ya no compensa');
assert.equal(winter(10, 20, 7.10).lectura, 'alcalosis-respiratoria', 'Un punto abajo es alcalosis');

// El caso que motivo todo: pCO2 "tranquilizadora" que en realidad es fatiga.
// HCO3 8 -> esperada 20 (18 a 22). Una pCO2 de 30 parece normal y no lo es.
assert.equal(winter(8, 30, 7.05).lectura, 'acidosis-respiratoria',
  'pCO2 30 con HCO3 8 tiene que leerse como acidosis respiratoria agregada');

// --- Cuando NO aplica ------------------------------------------------------
// Sin acidosis metabolica no hay compensacion que evaluar. Importa porque el
// paciente hiperosmolar tipico tiene bicarbonato normal.
// Los pH de estos casos son deliberadamente no alcalemicos: con pH > 7,38 el
// otro guarda tambien devuelve null y enmascararia que este dejo de funcionar.
assert.equal(winter(24, 40, 7.35), null, 'Con bicarbonato normal no aplica');
assert.equal(winter(26, 40, 7.30), null, 'Con bicarbonato alto tampoco aplica');
assert.equal(winter(22, 40, 7.35), null, 'El umbral de 22 no aplica');
assert.ok(winter(21.9, 40, 7.35) !== null, 'Justo por debajo de 22 si aplica');
assert.equal(winter(null, 40, 7.30), null, 'Sin bicarbonato no se calcula');

// Bicarbonato bajo con pH alcalemico es la compensacion de una alcalosis
// respiratoria, no una acidosis metabolica: dar un objetivo ahi seria enganoso.
assert.equal(winter(15, 25, 7.45), null, 'Con pH alcalemico no aplica');
assert.ok(winter(15, 25, null) !== null, 'Sin pH se calcula igual');

// --- El piso fisiologico ---------------------------------------------------
// La hiperventilacion no baja de ~10 a 12 mmHg: con bicarbonato muy bajo el
// objetivo deja de ser alcanzable y hay que decirlo.
assert.equal(winter(10, 23, 7.10).bajoElPiso, false, 'Esperada 23 esta sobre el piso');
assert.equal(winter(2, 12, 7.00).bajoElPiso, true, 'Esperada 11 cae bajo el piso');

console.log('OK: formula de Winter — calculo, las tres lecturas, bordes, cuando no aplica y piso fisiologico');
