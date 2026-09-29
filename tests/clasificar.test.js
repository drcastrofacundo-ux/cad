'use strict';

// clasificar(): la puerta de entrada del protocolo como funcion pura.
// Se extrajo de calcular() el 2026-09-27 sin cambiar el resultado, para
// reutilizarla en el cartel de derivacion y en el modulo de hiperglucemia.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ingreso.html'), 'utf8');
const fuente = html.match(/function clasificar\(glu, ph, hco3, ag, osme, ceto, dm\)\{[\s\S]*?\n\}/);
assert.ok(fuente, 'No se hallo clasificar(glu, ph, hco3, ag, osme, ceto, dm) en ingreso.html');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fuente[0]}; this.clasificar = clasificar;`, ctx);
const { clasificar } = ctx;

// orden de argumentos: glu, ph, hco3, ag, osme, ceto, dm (dm: 1 = diabetico conocido)
const dx = (...a) => clasificar(...a).dx;

// Sin datos basicos no hay diagnostico
assert.equal(dx(null, 7.1, 8, 20, null, 3, 0), '');
assert.equal(dx(450, null, 8, 20, null, 3, 0), '');
assert.equal(dx(450, 7.1, null, 20, null, 3, 0), '');

// Cetoacidosis con cetonuria >= 2 y severidad
assert.equal(dx(450, 7.10, 8, 25, null, 3, 0), 'Cetoacidosis diabética severa');     // HCO3 < 10
assert.equal(dx(450, 6.95, 12, 25, null, 3, 0), 'Cetoacidosis diabética severa');    // pH < 7,0
assert.equal(dx(450, 7.20, 12, 25, null, 3, 0), 'Cetoacidosis diabética moderada');  // HCO3 < 15
assert.equal(dx(450, 7.28, 16, 25, null, 2, 0), 'Cetoacidosis diabética leve');
assert.equal(clasificar(450, 7.28, 16, 25, null, 2, 0).sev, 'leve');

// Glucemia < 200 pero diabetico conocido: el antecedente cumple el criterio
// (ADA/EASD 2024), pero SOLO con cetonas confirmadas (cetonuria >= 2) se llama
// CAD euglucemica. Error del 2026-09-29: diabetica que abandono el tratamiento y
// hace hipoglucemias, glucemia 82, pH 7,28, HCO3 17, AG 21, cetonuria negativa y
// urea 89 salia "Cetoacidosis probable leve" con bomba a 0,1 U/kg/h.
assert.equal(dx(180, 7.10, 8, 25, null, 3, 1), 'Cetoacidosis diabética euglucémica severa');
assert.equal(dx(120, 7.28, 16, 25, null, 2, 1), 'Cetoacidosis diabética euglucémica leve');
assert.equal(clasificar(120, 7.28, 16, 25, null, 2, 1).sev, 'leve');
const NO_CONF = 'Acidosis en diabético con glucemia menor a 200, cetonas no confirmadas';
assert.equal(dx(82, 7.28, 17, 21, null, 0, 1), NO_CONF, 'el caso de la captura del 2026-09-29');
assert.equal(dx(82, 7.28, 17, 21, null, 1, 1), NO_CONF, 'cetonuria 1 cruz no confirma');
assert.equal(dx(82, 7.28, 17, 21, null, null, 1), NO_CONF, 'sin cetonuria no confirma');
assert.equal(dx(150, 7.10, 8, null, null, null, 1), NO_CONF, 'sin cloro tampoco');
assert.equal(dx(150, 7.25, 14, 8, null, 0, 1), NO_CONF, 'con AG normal y glucemia < 200 no se llama hiperglucemia');
// El borde: 200 ya es criterio por el valor, sigue la regla de siempre
assert.equal(dx(200, 7.28, 17, 21, null, 0, 1), 'Cetoacidosis diabética leve (cetonuria no concluyente)');
assert.equal(dx(199, 7.28, 17, 21, null, 0, 1), NO_CONF);
// Sin acidosis el antecedente no cambia nada
assert.equal(dx(82, 7.40, 24, 12, null, 0, 1), 'Hiperglucemia sin acidosis');

// Cetonuria no concluyente con anion gap alto
assert.equal(dx(450, 7.10, 8, 25, null, 1, 0), 'Cetoacidosis diabética severa (cetonuria no concluyente)');
// Sin cloro (ag null): el HCO3 < 15 hace de sustituto del anion gap alto
assert.equal(dx(450, 7.10, 8, null, null, null, 0), 'Cetoacidosis diabética severa (cetonuria no concluyente)');

// Acidosis con anion gap normal
assert.equal(dx(400, 7.25, 14, 8, null, 0, 0), 'Hiperglucemia con acidosis de anion gap normal');

// Estado hiperosmolar y sus bordes: glu >= 600, osm > 300 (o sin dato), sin acidosis, HCO3 >= 15, ceto < 2
assert.equal(dx(700, 7.35, 20, 12, 330, 0, 0), 'Estado hiperosmolar');
assert.equal(dx(600, 7.35, 20, 12, 301, 0, 0), 'Estado hiperosmolar', 'glucemia 600 entra');
assert.equal(dx(599, 7.35, 20, 12, 330, 0, 0), 'Hiperglucemia sin acidosis', '599 no es EHH');
assert.equal(dx(700, 7.35, 20, 12, 300, 0, 0), 'Hiperglucemia sin acidosis', 'osm 300 no es > 300');
assert.equal(dx(700, 7.35, 20, 12, null, 0, 0), 'Estado hiperosmolar', 'sin osmolaridad no descarta EHH');
assert.equal(dx(700, 7.35, 20, 12, 330, 2, 0), 'Hiperglucemia sin acidosis', 'cetonuria 2 descarta EHH');

// Acidosis sin criterio de hiperglucemia (glu < 200 y no diabetico)
assert.equal(dx(150, 7.10, 8, 25, null, 3, 0), 'Acidosis metabólica sin criterio de hiperglucemia');

// El caso de la captura del 2026-09-26
assert.equal(dx(350, 7.38, 22, null, null, null, 0), 'Hiperglucemia sin acidosis');

// calcular() tiene que usarla, no duplicar la logica
const calc = html.match(/function calcular\(\)\{[\s\S]*?\n\}/)[0];
assert.match(calc, /clasificar\(glu, ?ph, ?hco3, ?ag, ?osme, ?ceto, ?dm\)/, 'calcular() tiene que llamar a clasificar()');
assert.doesNotMatch(calc, /var esEHH=/, 'la regla de EHH no puede quedar duplicada en calcular()');

console.log('clasificar.test.js: ok');
