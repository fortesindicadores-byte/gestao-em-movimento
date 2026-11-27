/* ══════════════════════════════════════════════════════════════
   ASSISTENTE FLUTUANTE (Renan, 27/11/2026: "Gostei daquele assistente ícone flutuando lá na direita, igual o
   Bússola" → em todos os painéis, só para quem usa o Assistente).
   Carregado pelo assets/mobile.js. Põe um botão redondo no canto inferior direito que abre uma gaveta lateral
   com a página /assistente/ em modo embutido (?embed=1): a mesma conversa, as mesmas regras e a mesma Edge
   Function (que confere o e-mail de novo pelo login). O chat lê o painel aberto pelo window.parent.
   Quem vê: os e-mails cujo SHA-256 está em ASSISTENTE_HASHES (o e-mail não fica no repositório).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var d = document, w = window;
  if (w.__assistenteFlut) return; w.__assistenteFlut = true;
  try { if (w.top !== w) return; } catch (e) { return; }
  if (/\/assistente\/|\/app\/|\/app-motorista|\/financeiro-pessoal\//.test(location.pathname)) return;
  var ASSISTENTE_HASHES = w.ASSISTENTE_HASHES || [
    '028b8bbecfccb5b3a83c7b7977fac009a9c57b2b8b6d001c849c7954b88f0f6a'   /* dono do portal */
  ];
  var CHAVE = 'sb-lozwipoeacpvplgkrxkq-auth-token';
  var eu = d.currentScript && d.currentScript.src;
  var URL_IA = eu ? eu.replace(/assets\/assistente-flutuante\.js.*$/, 'assistente/') : '../assistente/';

  function emailSessao() {
    try { var j = JSON.parse(localStorage.getItem(CHAVE) || 'null'); var u = j && (j.user || (j.currentSession && j.currentSession.user)); return u && u.email ? String(u.email).toLowerCase() : ''; } catch (e) { return ''; }
  }
  function sha(t) {
    if (!w.crypto || !crypto.subtle || !w.TextEncoder) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }).catch(function () { return ''; });
  }

  var CSS =
    '.afl-bt{position:fixed;right:22px;bottom:22px;z-index:9000;width:52px;height:52px;border-radius:50%;border:0;cursor:pointer;' +
      'background:#F97316;color:#fff;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 10px 26px rgba(249,115,22,.38),0 3px 8px rgba(0,0,0,.28);transition:transform .15s ease,box-shadow .15s ease,opacity .2s}' +
    '.afl-bt:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 14px 30px rgba(249,115,22,.45),0 4px 10px rgba(0,0,0,.3)}' +
    '.afl-bt svg{width:24px;height:24px}' +
    '.afl-bt .afl-dica{position:absolute;right:62px;top:50%;transform:translateY(-50%);background:#26262B;color:#EEF2FA;font:600 11.5px Montserrat,sans-serif;' +
      'padding:6px 10px;border-radius:7px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s;box-shadow:0 8px 22px rgba(0,0,0,.35)}' +
    '.afl-bt:hover .afl-dica{opacity:1}' +
    '.afl-aberto .afl-bt{opacity:0;pointer-events:none}' +
    '.afl-gv{position:fixed;top:12px;right:12px;bottom:12px;z-index:9001;width:min(500px,calc(100vw - 24px));border-radius:16px;overflow:hidden;' +
      'background:#1C1D21;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;' +
      'transform:translateX(calc(100% + 24px));transition:transform .25s cubic-bezier(.2,.8,.2,1);visibility:hidden}' +
    'body.claro .afl-gv{background:#fff;border-color:rgba(15,23,42,.10);box-shadow:0 24px 60px rgba(15,23,42,.22)}' +
    '.afl-aberto .afl-gv{transform:none;visibility:visible}' +
    '.afl-cab{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:10px 10px 10px 16px;border-bottom:1px solid rgba(255,255,255,.07);' +
      'font:700 13px Montserrat,sans-serif;color:#EEF2FA}' +
    'body.claro .afl-cab{color:#161D2B;border-bottom-color:rgba(15,23,42,.08)}' +
    '.afl-cab .afl-ic{width:24px;height:24px;border-radius:50%;background:#F97316;color:#fff;display:flex;align-items:center;justify-content:center}' +
    '.afl-cab .afl-ic svg{width:14px;height:14px}' +
    '.afl-cab .afl-t{flex:1}' +
    '.afl-cab button,.afl-cab a{background:transparent;border:0;color:inherit;opacity:.7;cursor:pointer;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center}' +
    '.afl-cab button:hover,.afl-cab a:hover{opacity:1;background:rgba(127,127,127,.15)}' +
    '.afl-cab svg{width:16px;height:16px}' +
    '.afl-gv iframe{flex:1;width:100%;border:0;background:transparent}' +
    'body.modo-tv .afl-bt,body.modo-tv .afl-gv{display:none}' +
    '@media print{.afl-bt,.afl-gv{display:none!important}}' +
    '@media(max-width:860px){.afl-bt{right:14px;bottom:14px;width:46px;height:46px}.afl-gv{top:0;right:0;bottom:0;width:100vw;border-radius:0}}';
  var ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z"/><path d="M5 16l.6 1.4 1.4.6-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z"/></svg>';

  var gv, ifr, bt;
  function monta() {
    var st = d.createElement('style'); st.textContent = CSS; d.head.appendChild(st);
    bt = d.createElement('button'); bt.className = 'afl-bt'; bt.type = 'button'; bt.setAttribute('aria-label', 'Assistente');
    bt.setAttribute('data-html2canvas-ignore', 'true'); bt.innerHTML = ICO + '<span class="afl-dica">Assistente</span>';
    gv = d.createElement('div'); gv.className = 'afl-gv'; gv.setAttribute('data-html2canvas-ignore', 'true');
    gv.innerHTML = '<div class="afl-cab"><span class="afl-ic">' + ICO + '</span><span class="afl-t">Assistente</span>' +
      '<button type="button" data-a="nova" title="Nova conversa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>' +
      '<a data-a="cheia" href="' + URL_IA + '" title="Abrir em tela cheia"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></a>' +
      '<button type="button" data-a="fecha" title="Fechar (Esc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>';
    d.body.appendChild(gv); d.body.appendChild(bt);
    bt.addEventListener('click', abre);
    gv.addEventListener('click', function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'fecha') fecha();
      if (a.dataset.a === 'nova') { try { ifr && ifr.contentWindow.IA && ifr.contentWindow.IA.nova(); } catch (er) {} }
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.documentElement.classList.contains('afl-aberto')) fecha(); });
  }
  function abre() {
    if (!ifr) { ifr = d.createElement('iframe'); ifr.title = 'Assistente'; ifr.src = URL_IA + '?embed=1'; gv.appendChild(ifr); }
    d.documentElement.classList.add('afl-aberto');
    setTimeout(function () { try { var t = ifr.contentDocument && ifr.contentDocument.getElementById('ia-txt'); if (t) t.focus(); } catch (e) {} }, 280);
  }
  function fecha() { d.documentElement.classList.remove('afl-aberto'); }
  w.AssistenteFlutuante = { abre: function () { if (gv) abre(); }, fecha: fecha };

  function inicia() {
    var em = emailSessao(); if (!em) return;
    sha(em).then(function (h) { if (h && ASSISTENTE_HASHES.indexOf(h) >= 0 && !gv) monta(); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', inicia); else inicia();
  /* o hub mostra o login antes da sessão: confere de novo quando ela chega */
  w.addEventListener('storage', function (e) { if (e.key === CHAVE && !gv) inicia(); });
  var tentativas = 0, it = setInterval(function () { if (gv || ++tentativas > 40) { clearInterval(it); return; } inicia(); }, 3000);
})();
