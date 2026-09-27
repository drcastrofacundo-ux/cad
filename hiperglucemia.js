'use strict';

// Algoritmo de titulacion del Protocolo de hiperglucemia en el paciente critico
// (sin CAD ni EHH), version 1.0, vigente desde el 2026-09-27.
//
// Fuente de las tablas: Marvin MR, Inzucchi SE, Besterman BJ. Diabetes Technol
// Ther 2016;18:480-6, tabla 1 A-D, version "140" con bolos, la 140(B).
// PMID 27257910, acceso abierto CC BY-NC. Transcripcion textual en el vault:
// "Marvin 2016 - Algoritmo Yale 140(B), tablas transcriptas".
//
// Interpretaciones del servicio, aprobadas con el protocolo (no son del paper):
//   - "meta inferior" = 140 (la version 140 tiene meta unica);
//   - con 75-99 se suspende siempre (columna 1);
//   - 70-74: suspender sin dextrosa y controlar cada 15 min; <70: rescate;
//   - el bolo cuenta la suba desde el control anterior, no por hora, y se da
//     ademas del ajuste del goteo.
//
// Funciones puras, sin DOM: tests/hiperglucemia.test.js cubre cada fila.
// Si se toca una celda, un test tiene que fallar.

var HIPER = (function () {
  var META_INFERIOR = 140;

  // Tabla 1C: cambio de velocidad segun la velocidad actual (U/h).
  // El paper usa pasos de 0,5; los cortes <6,5, <10, etc. cubren valores
  // intermedios sin cambiar ninguna celda publicada.
  var TABLA_DELTA = [
    { hasta: 3, delta: 0.5 },
    { hasta: 6.5, delta: 1 },
    { hasta: 10, delta: 1.5 },
    { hasta: 15, delta: 2 },
    { hasta: 20, delta: 3 },
    { hasta: 25, delta: 4 },
    { hasta: Infinity, delta: 5 },
  ];

  function delta(vel) {
    for (var i = 0; i < TABLA_DELTA.length; i++) {
      if (vel < TABLA_DELTA[i].hasta) return TABLA_DELTA[i].delta;
    }
    return 5;
  }

  // Tabla 1A, version 140: 0 = debajo de la tabla (<75).
  function columna(g) {
    if (g < 75) return 0;
    if (g <= 99) return 1;
    if (g <= 139) return 2;
    if (g === 140) return 3;
    if (g <= 200) return 4;
    return 5;
  }

  // Tabla 1B. "c" es el cambio en mg/dL por hora (positivo = sube).
  function fila(col, c) {
    if (col === 5) {
      if (c > 0) return 'subir2';
      if (c >= -25) return 'subir';
      if (c >= -75) return 'igual';
      if (c >= -100) return 'bajar';
      return 'suspender_corta';
    }
    if (col === 4) {
      if (c > 50) return 'subir2';
      if (c >= 0) return 'subir';
      if (c >= -50) return 'igual';
      if (c >= -75) return 'bajar';
      return 'suspender_corta';
    }
    if (col === 3) {
      if (c > 25) return 'subir';
      if (c >= -25) return 'igual';
      if (c >= -50) return 'bajar';
      return 'suspender_corta';
    }
    if (col === 2) {
      if (c > 0) return 'igual';
      if (c >= -25) return 'bajar';
      return 'suspender_corta';
    }
    return 'suspender_larga';
  }

  // Tabla 1D. "suba" es la diferencia con el control anterior, sin llevar a hora.
  function bolo(g, suba, vel) {
    var dl = delta(vel);
    if (g >= 141 && g <= 160 && suba > 20) return dl;
    if (g >= 161 && g <= 180 && suba > 20) return 2 * dl;
    if (g > 180 && suba >= 0) return 2 * dl;
    return 0;
  }

  function r1(x) { return Math.round(x * 10) / 10; }

  function valido(g) { return typeof g === 'number' && isFinite(g) && g >= 10 && g <= 1000; }

  function debajo(g, alertas) {
    // Debajo de la tabla: 70-74 regla del servicio; <70 hipoglucemia (ADA 2026).
    if (g >= 70) {
      alertas.push('Glucemia 70–74: suspender el goteo, sin dextrosa. Control cada 15 min. Al llegar a ≥75, suspensión larga.');
      return 'suspender_7074';
    }
    alertas.push('HIPOGLUCEMIA (<70): suspender el goteo y aplicar el rescate de hipoglucemia de la institución (dextrosa IV). Control cada 15 min hasta >70. Avisar al médico.');
    if (g < 54) alertas.push('Glucemia <54 (nivel 2): aviso médico inmediato y buscar la causa.');
    return 'hipoglucemia';
  }

  // titular(glucActual, glucPrevia, minutos, velocidadActual, opciones)
  // opciones.estable: los ultimos 4 controles en 140-180 sin cambio de velocidad.
  function titular(g, p, min, vel, op) {
    op = op || {};
    var alertas = [];
    // typeof: un campo vacio llega como null, y null >= 0 es true en JS.
    if (!valido(g) || !valido(p) || typeof min !== 'number' || !(min > 0)
        || typeof vel !== 'number' || !(vel >= 0) || !isFinite(vel)) {
      return { accion: 'error', velocidad: null, bolo: 0, proximoMin: null,
        alertas: ['Faltan datos o hay un valor fuera de rango: revisar glucemia actual, anterior, minutos y velocidad.'] };
    }
    g = Math.round(g); p = Math.round(p);
    var suba = g - p;
    var porHora = Math.round(suba * 60 / min);
    var col = columna(g);
    var accion = col === 0 ? debajo(g, alertas) : fila(col, porHora);
    var dl = delta(vel);
    var nueva = vel;
    var prox = 60;

    if (accion === 'subir2') nueva = vel + 2 * dl;
    else if (accion === 'subir') nueva = vel + dl;
    else if (accion === 'bajar') nueva = vel - dl;
    else if (accion !== 'igual') nueva = 0;

    if (accion === 'bajar' && nueva <= 0) {
      nueva = 0;
      alertas.push('Al bajar el goteo llega a 0: queda suspendido. Seguir la suspensión larga y avisar al médico.');
    }

    if (accion === 'suspender_corta') {
      prox = 30;
      alertas.push('Suspender el goteo. Control a los 30 min: si está ≥140, reiniciar a ' + r1(Math.max(vel - 2 * dl, 0)) + ' U/h (velocidad previa menos 2Δ); si está <140, suspensión larga.');
    } else if (accion === 'suspender_larga') {
      prox = g < 90 ? 30 : 60;
      alertas.push('Suspensión larga: goteo parado, control cada 30 min hasta ≥90 y después cada hora. Con ≥140, reiniciar a ' + r1(vel * 0.75) + ' U/h (75% de la última velocidad).');
    } else if (accion === 'suspender_7074' || accion === 'hipoglucemia') {
      prox = 15;
    } else if (op.estable && g >= 140 && g <= 180) {
      prox = 120;
    }

    var b = (accion === 'subir2' || accion === 'subir' || accion === 'igual') ? bolo(g, suba, vel) : 0;

    if (vel >= 25 || nueva >= 25) alertas.push('Goteo ≥25 U/h: consultar al médico antes de seguir subiendo.');
    if (min > 90) alertas.push('Pasaron ' + min + ' min desde el control anterior. Si el intervalo indicado era 1 h, el control está atrasado: el atraso es causa de hipoglucemia.');

    return { accion: accion, velocidad: r1(nueva), delta: dl, bolo: b, proximoMin: prox,
      columna: col, cambioPorHora: porHora, alertas: alertas };
  }

  // reanudar(glucActual, ultimaVelocidad, tipo): control con el goteo suspendido.
  // tipo 'corta' = primer control a los 30 min de una suspension por caida rapida;
  // tipo 'larga' = nota a de la tabla 1B.
  function reanudar(g, ultima, tipo) {
    var alertas = [];
    if (!valido(g) || !(ultima > 0) || (tipo !== 'corta' && tipo !== 'larga')) {
      return { accion: 'error', velocidad: null, proximoMin: null,
        alertas: ['Faltan datos: glucemia actual, última velocidad antes de suspender y tipo de suspensión.'] };
    }
    g = Math.round(g);
    if (g < 75) {
      var a = debajo(g, alertas);
      return { accion: a, velocidad: 0, tipo: 'larga', proximoMin: 15, alertas: alertas };
    }
    if (g >= META_INFERIOR) {
      var v = tipo === 'corta' ? ultima - 2 * delta(ultima) : ultima * 0.75;
      if (v <= 0) {
        alertas.push('Restar 2Δ a ' + ultima + ' U/h da 0 o menos: no se reinicia en 0. Seguir suspendido (suspensión larga) y avisar al médico.');
        return { accion: 'seguir_suspendido', velocidad: 0, tipo: 'larga', proximoMin: 60, alertas: alertas };
      }
      return { accion: 'reiniciar', velocidad: r1(v), tipo: tipo, proximoMin: 60, alertas: alertas };
    }
    return { accion: 'seguir_suspendido', velocidad: 0, tipo: 'larga', proximoMin: g < 90 ? 30 : 60, alertas: alertas };
  }

  return { META_INFERIOR: META_INFERIOR, TABLA_DELTA: TABLA_DELTA, delta: delta, columna: columna,
    titular: titular, reanudar: reanudar };
})();

if (typeof this !== 'undefined' && this) this.HIPER = HIPER;
