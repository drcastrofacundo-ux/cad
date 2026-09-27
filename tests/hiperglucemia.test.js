'use strict';

// Algoritmo Yale 140(B) del Protocolo de hiperglucemia en el paciente critico
// v1.0 (vigente desde el 2026-09-27). Fuente: Marvin MR, Inzucchi SE,
// Besterman BJ. Diabetes Technol Ther 2016;18:480-6, tabla 1 (A-D), version 140.
//
// Cada fila de la tabla tiene su test. Si alguien toca una celda de
// hiperglucemia.js, algo de aca tiene que fallar: esto le dice a enfermeria
// cuanta insulina poner.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.join(__dirname, '..', 'hiperglucemia.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fuente, ctx);
const H = ctx.HIPER;
assert.ok(H, 'hiperglucemia.js tiene que exponer HIPER');

// --- Tabla 1C: delta segun la velocidad actual -----------------------------
const d = (v) => H.delta(v);
assert.equal(d(0.5), 0.5);
assert.equal(d(2.5), 0.5);
assert.equal(d(3), 1);
assert.equal(d(6), 1);
assert.equal(d(6.5), 1.5);
assert.equal(d(9.5), 1.5);
assert.equal(d(10), 2);
assert.equal(d(14.5), 2);
assert.equal(d(15), 3);
assert.equal(d(19.5), 3);
assert.equal(d(20), 4);
assert.equal(d(24.5), 4);
assert.equal(d(25), 5);
assert.equal(d(30), 5);

// --- Columna (tabla 1A, version 140) ---------------------------------------
const col = (g) => H.columna(g);
assert.equal(col(74), 0);
assert.equal(col(75), 1);
assert.equal(col(99), 1);
assert.equal(col(100), 2);
assert.equal(col(139), 2);
assert.equal(col(140), 3);
assert.equal(col(141), 4);
assert.equal(col(200), 4);
assert.equal(col(201), 5);

// --- Tabla 1B: una llamada por fila ----------------------------------------
// titular(glucActual, glucPrevia, minutos, velocidadActual)
const acc = (g, p, v = 4, min = 60) => H.titular(g, p, min, v).accion;

// Columna 5: >200
assert.equal(acc(250, 240), 'subir2', '>200 y sube');
assert.equal(acc(250, 250), 'subir', '>200 sin cambio');
assert.equal(acc(250, 275), 'subir', '>200 baja 25');
assert.equal(acc(250, 276), 'igual', '>200 baja 26');
assert.equal(acc(250, 325), 'igual', '>200 baja 75');
assert.equal(acc(250, 326), 'bajar', '>200 baja 76');
assert.equal(acc(250, 350), 'bajar', '>200 baja 100');
assert.equal(acc(250, 351), 'suspender_corta', '>200 baja >100');

// Columna 4: 141-200
assert.equal(acc(190, 139), 'subir2', '141-200 sube 51');
assert.equal(acc(190, 140), 'subir', '141-200 sube 50');
assert.equal(acc(190, 190), 'subir', '141-200 sin cambio');
assert.equal(acc(190, 191), 'igual', '141-200 baja 1');
assert.equal(acc(190, 240), 'igual', '141-200 baja 50');
assert.equal(acc(190, 241), 'bajar', '141-200 baja 51');
assert.equal(acc(190, 265), 'bajar', '141-200 baja 75');
assert.equal(acc(190, 266), 'suspender_corta', '141-200 baja >75');

// Columna 3: 140
assert.equal(acc(140, 114), 'subir', '140 sube 26');
assert.equal(acc(140, 115), 'igual', '140 sube 25');
assert.equal(acc(140, 140), 'igual', '140 sin cambio');
assert.equal(acc(140, 165), 'igual', '140 baja 25');
assert.equal(acc(140, 166), 'bajar', '140 baja 26');
assert.equal(acc(140, 190), 'bajar', '140 baja 50');
assert.equal(acc(140, 191), 'suspender_corta', '140 baja >50');

// Columna 2: 100-139
assert.equal(acc(120, 110), 'igual', '100-139 sube');
assert.equal(acc(120, 120), 'bajar', '100-139 sin cambio');
assert.equal(acc(120, 145), 'bajar', '100-139 baja 25');
assert.equal(acc(120, 146), 'suspender_corta', '100-139 baja >25');

// Columna 1: 75-99, siempre suspension larga (interpretacion aprobada)
assert.equal(acc(99, 80), 'suspender_larga');
assert.equal(acc(75, 75), 'suspender_larga');

// Debajo de la tabla: regla del servicio y ADA 2026
assert.equal(acc(74, 90), 'suspender_7074');
assert.equal(acc(70, 90), 'suspender_7074');
assert.equal(acc(69, 90), 'hipoglucemia');
assert.equal(acc(53, 90), 'hipoglucemia');
assert.ok(H.titular(53, 90, 60, 4).alertas.some((a) => /<54|nivel 2|inmediato/i.test(a)), '<54 avisa al medico en forma inmediata');

// --- El cambio se lleva a mg/dL por hora -----------------------------------
// +20 en 30 min son +40/h: en 141-200 eso es subir, no subir2
assert.equal(acc(190, 170, 4, 30), 'subir');
// +30 en 30 min son +60/h: subir2
assert.equal(acc(190, 160, 4, 30), 'subir2');
// -60 en 120 min son -30/h: en 140 eso es bajar
assert.equal(acc(140, 200, 4, 120), 'bajar');

// --- Nueva velocidad --------------------------------------------------------
const vel = (g, p, v, min = 60) => H.titular(g, p, min, v).velocidad;
assert.equal(vel(250, 240, 4), 6, '4 U/h + 2 delta(1) = 6');
assert.equal(vel(250, 250, 4), 5);
assert.equal(vel(250, 280, 4), 4);
assert.equal(vel(250, 330, 4), 3);
assert.equal(vel(250, 250, 2), 2.5, 'con <3 U/h el delta es 0,5');
assert.equal(vel(250, 250, 12), 14, 'con 10-14,5 el delta es 2');
assert.equal(vel(250, 400, 4), 0, 'suspendido');
assert.equal(vel(120, 120, 0.5), 0, 'bajar delta desde 0,5 llega a 0: queda suspendido');
assert.ok(H.titular(120, 120, 60, 0.5).alertas.length > 0, 'llegar a 0 bajando avisa');

// >=25 U/h: consultar al medico
assert.ok(H.titular(250, 250, 60, 25).alertas.some((a) => /m[eé]dico/i.test(a)));

// --- Tabla 1D: bolos --------------------------------------------------------
const bolo = (g, p, v = 4) => H.titular(g, p, 60, v).bolo;
assert.equal(bolo(150, 129), 1, '141-160 y sube 21: bolo delta');
assert.equal(bolo(150, 130), 0, '141-160 y sube 20: sin bolo');
assert.equal(bolo(170, 149), 2, '161-180 y sube 21: bolo 2 delta');
assert.equal(bolo(170, 150), 0, '161-180 y sube 20: sin bolo');
assert.equal(bolo(181, 181), 2, '>180 sin cambio: bolo 2 delta');
assert.equal(bolo(250, 240), 2, '>180 sube: bolo 2 delta');
assert.equal(bolo(250, 251), 0, '>180 baja: sin bolo');
assert.equal(bolo(140, 100), 0, '140: nunca bolo');
assert.equal(bolo(250, 250, 12), 4, 'el bolo usa el delta de la velocidad actual');
// El bolo se cuenta desde el control anterior, no por hora (interpretacion aprobada):
// +21 en 30 min da bolo aunque por hora sean +42, y +15 en 30 min no da bolo aunque por hora sean +30
assert.equal(H.titular(150, 129, 30, 4).bolo, 1);
assert.equal(H.titular(150, 135, 30, 4).bolo, 0);

// --- Proximo control --------------------------------------------------------
const prox = (g, p, v = 4, estable = false) => H.titular(g, p, 60, v, { estable }).proximoMin;
assert.equal(prox(160, 160), 60);
assert.equal(prox(160, 160, 4, true), 120, '4 controles seguidos en meta: cada 2 h');
assert.equal(prox(250, 250, 4, true), 60, 'fuera de meta no se espacia aunque este marcado estable');
assert.equal(prox(250, 400), 30, 'suspension corta: control a los 30 min');
assert.equal(prox(85, 85), 30, 'suspension larga <90: cada 30 min');
assert.equal(prox(95, 95), 60, 'suspension larga >=90: cada hora (nota a de la tabla, literal)');
assert.equal(prox(72, 90), 15);
assert.equal(prox(60, 90), 15);

// --- Reanudar despues de una suspension ------------------------------------
// reanudar(glucActual, ultimaVelocidad, tipo)
const r = (g, v, tipo) => H.reanudar(g, v, tipo);
assert.equal(r(150, 4, 'corta').accion, 'reiniciar');
assert.equal(r(150, 4, 'corta').velocidad, 2, 'corta y >=140: velocidad previa menos 2 delta');
assert.equal(r(140, 4, 'corta').accion, 'reiniciar', '140 ya es >= meta inferior');
assert.equal(r(139, 4, 'corta').accion, 'seguir_suspendido', 'corta y <140: pasa a larga');
assert.equal(r(139, 4, 'corta').tipo, 'larga');
assert.equal(r(150, 4, 'larga').velocidad, 3, 'larga y >=140: 75% de la ultima');
assert.equal(r(150, 5, 'larga').velocidad, 3.8, '75% de 5 = 3,75, redondeado a 0,1');
assert.equal(r(120, 4, 'larga').accion, 'seguir_suspendido');
assert.equal(r(89, 4, 'larga').proximoMin, 30, '<90: cada 30 min');
assert.equal(r(90, 4, 'larga').proximoMin, 60, '>=90: cada hora');
assert.equal(r(150, 1, 'corta').accion, 'seguir_suspendido', 'restar 2 delta a 1 U/h da 0: no se reinicia en 0');
assert.ok(r(150, 1, 'corta').alertas.length > 0);
assert.equal(r(72, 4, 'larga').accion, 'suspender_7074');
assert.equal(r(60, 4, 'corta').accion, 'hipoglucemia');

// --- Datos invalidos no calculan -------------------------------------------
assert.equal(H.titular(null, 150, 60, 4).accion, 'error');
assert.equal(H.titular(150, null, 60, 4).accion, 'error');
assert.equal(H.titular(150, 150, 0, 4).accion, 'error');
assert.equal(H.titular(150, 150, 60, -1).accion, 'error');
assert.equal(H.titular(1500, 150, 60, 4).accion, 'error', 'glucemia fuera de rango fisiologico');
// Campo vacio en la pantalla llega como null, y en JS null >= 0 es true:
// sin este chequeo calculaba como si la velocidad fuera 0.
assert.equal(H.titular(250, 240, 60, null).accion, 'error', 'velocidad vacia no calcula');
assert.equal(H.titular(250, 240, null, 4).accion, 'error', 'minutos vacios no calculan');
assert.equal(H.reanudar(150, null, 'corta').accion, 'error');

// Control atrasado: calcula pero avisa
assert.ok(H.titular(160, 160, 100, 4).alertas.some((a) => /atrasad/i.test(a)));

console.log('hiperglucemia.test.js: ok');
