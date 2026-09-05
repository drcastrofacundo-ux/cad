'use strict';

// Registra el service worker y agrega al pie de cada pantalla el sello de
// version, el aviso de sin conexion y, en Android, el boton de instalar.
//
// Usa las variables CSS que ya define cada pantalla (--muted, --warn, --accent),
// asi acompana solo el modo claro y el oscuro sin duplicar la paleta.
//
// La version se declara aca y en sw.js. tests/pwa.test.js falla si difieren.

(function () {
  var VERSION = '2026.09.04-5';

  function pie() {
    var el = document.getElementById('cad-estado');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cad-estado';
    el.style.cssText = 'max-width:640px;margin:18px auto 28px;padding:0 16px;'
      + 'text-align:center;font-size:0.72rem;line-height:1.5;'
      + 'font-family:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif;';
    document.body.appendChild(el);
    return el;
  }

  function linea(texto, color) {
    var p = document.createElement('p');
    p.style.cssText = 'margin:4px 0;color:' + color + ';';
    p.textContent = texto;
    return p;
  }

  // --- Sello de version -----------------------------------------------------
  // Si alguien reporta un numero raro, sirve para saber que version corre.
  // Fecha de publicacion, no la version del protocolo: el protocolo es v0.7 y
  // se muestra en la portada. Este sello dice que copia corre en el telefono,
  // que sin senal puede no ser la ultima.
  var sello = linea('publicación ' + VERSION, 'var(--muted,#68788A)');
  sello.id = 'cad-version';
  pie().appendChild(sello);

  // --- Aviso de sin conexion ------------------------------------------------
  // Sin senal se sirve la copia guardada, que puede no ser la ultima.
  var aviso = linea(
    'Sin conexión — estás viendo la copia guardada en el teléfono.',
    'var(--warn,#9C6100)'
  );
  aviso.id = 'cad-offline';
  aviso.style.display = 'none';
  pie().appendChild(aviso);

  function estado() {
    aviso.style.display = navigator.onLine ? 'none' : 'block';
  }
  window.addEventListener('online', estado);
  window.addEventListener('offline', estado);
  estado();

  // --- Ayuda de instalacion en iOS -----------------------------------------
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var yaInstalada = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;

  if (esIOS && !yaInstalada) {
    pie().appendChild(linea(
      'Para tenerla como app: Compartir → «Agregar a inicio».',
      'var(--muted,#68788A)'
    ));
  }

  // --- Boton de instalar en Android ----------------------------------------
  // Sin esto hay que buscar «Instalar» en el menu de Chrome, y quien cae en
  // «Agregar a pantalla principal» termina con un acceso directo al navegador
  // en vez de la app: se abre con barra de direcciones y no funciona sin senal.
  window.__cadInstalable = false;
  var promptGuardado = null;

  window.addEventListener('beforeinstallprompt', function (evento) {
    evento.preventDefault();
    promptGuardado = evento;
    window.__cadInstalable = true;
    if (yaInstalada) return;

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = '⬇ Instalar la app';
    boton.style.cssText = 'display:inline-flex;align-items:center;gap:6px;'
      + 'margin:10px auto 4px;padding:9px 18px;border-radius:8px;'
      + 'font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;'
      + 'color:#fff;background:var(--accent,#0A6480);border:0;';

    boton.addEventListener('click', function () {
      if (!promptGuardado) return;
      boton.disabled = true;
      promptGuardado.prompt();
      promptGuardado.userChoice.then(function (r) {
        promptGuardado = null;
        if (r.outcome === 'accepted') boton.remove();
        else boton.disabled = false;
      });
    });

    var cont = document.createElement('div');
    cont.style.textAlign = 'center';
    cont.appendChild(boton);
    pie().prepend(cont);
  });

  window.addEventListener('appinstalled', function () {
    promptGuardado = null;
    var b = document.querySelector('#cad-estado button');
    if (b) b.parentElement.remove();
  });

  // --- Registro -------------------------------------------------------------
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (error) {
      // Sin service worker la app sigue funcionando: pierde el uso sin senal,
      // no los calculos.
      console.warn('[cad] no se pudo registrar el service worker:', error);
    });
  });
})();
