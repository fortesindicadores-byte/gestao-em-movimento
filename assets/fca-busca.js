/* ============================================================================
   PESQUISA POR PALAVRA-CHAVE NO FCA (Renan, 28/10/2026: "Coloca um campo de
   pesquisa em todos os FCAs (Admin e unidades) onde procure por palavra chave")

   Põe um campo "Pesquisar" na lateral, logo acima do "Voltar ao Hub" (abaixo de
   Gerar / Modo TV), e expõe a regra para a página filtrar as linhas de ação:

     FcaBusca.init(redesenha)     liga o campo; redesenha() roda a cada digitação
     FcaBusca.ativa()             true quando há algo digitado
     FcaBusca.ok(...textos)       true quando TODAS as palavras aparecem em algum
                                  dos textos (sem acento, sem maiúscula)

   A página junta o texto do fato (unidade, projeto, vigência, fato, desvio) e o
   da ação (causa, ação, responsável, acompanhamento, status): uma palavra pode
   estar no fato e outra na ação. Recolhida, a lateral mostra só a lupa, que
   abre o menu e põe o cursor no campo. O gerenciador de senhas não preenche:
   só vale o que foi digitado (o mesmo cuidado da busca do Gerenciar Acessos).
   ============================================================================ */
(function (global) {
  'use strict';
  var Q = [], digitou = false, inp = null, cb = null, tm = null;
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function tokens(v) { return norm(v).split(/\s+/).filter(Boolean); }
  function ativa() { return Q.length > 0; }
  function ok() {
    if (!Q.length) return true;
    var t = norm(Array.prototype.join.call(arguments, ' \u0001 '));
    for (var i = 0; i < Q.length; i++) if (t.indexOf(Q[i]) < 0) return false;
    return true;
  }
  function aplica() {
    var nq = digitou ? tokens(inp.value) : [];
    if (nq.join(' ') === Q.join(' ')) return;
    Q = nq;
    if (inp) inp.closest('.s-busca').classList.toggle('on', Q.length > 0);
    if (cb) try { cb(); } catch (e) { console.warn('FcaBusca:', e); }
  }
  function css() {
    if (document.getElementById('fca-busca-css')) return;
    var st = document.createElement('style'); st.id = 'fca-busca-css';
    st.textContent =
      '.s-busca{padding:12px 4px 4px;}' +
      '.s-busca .sb-box{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:8px;' +
        'background:var(--hover);border:1px solid var(--card-brd);color:var(--txt3);}' +
      '.s-busca .sb-box:focus-within{border-color:var(--laranja,#F97316);color:var(--txt);}' +
      '.s-busca.on .sb-box{border-color:var(--laranja,#F97316);}' +
      '.s-busca input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--txt);' +
        'font:500 11.5px Montserrat,sans-serif;}' +
      '.s-busca input::placeholder{color:var(--txt3);}' +
      '.s-busca input::-webkit-search-cancel-button{cursor:pointer;}' +
      '.s-busca .sb-lupa{display:none;}' +
      '.side.mini .s-busca{padding:10px 0 2px;}' +
      '.side.mini .s-busca .sb-box{display:none;}' +
      '.side.mini .s-busca .sb-lupa{display:flex;}' +
      '.side.mini .s-busca.on .sb-lupa{color:var(--laranja,#F97316);}' +
      '@media(max-width:860px){.s-busca{flex:1 1 100%;padding:6px 0;}.s-busca .sb-lupa{display:none!important;}' +
        '.s-busca .sb-box{display:flex!important;}}';
    (document.head || document.documentElement).appendChild(st);
  }
  var LUPA = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  function monta() {
    var side = document.querySelector('.side'); if (!side) return null;
    var w = document.createElement('div'); w.className = 's-busca';
    w.innerHTML =
      '<label class="sb-box" title="Pesquisa por palavra-chave: fato, causa, ação, responsável, acompanhamento, unidade, projeto">' + LUPA +
      '<input type="search" id="fcaBusca" name="fca-busca-palavra" placeholder="Pesquisar…" autocomplete="off" autocorrect="off" ' +
      'autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" aria-label="Pesquisar no FCA"></label>' +
      '<button type="button" class="s-item sb-lupa" title="Pesquisar">' + LUPA + '<span class="n">Pesquisar</span></button>';
    var volta = side.querySelector('.s-volta');
    if (volta) side.insertBefore(w, volta); else side.appendChild(w);
    w.querySelector('.sb-lupa').addEventListener('click', function () {
      var bt = document.getElementById('btMini');
      if (side.classList.contains('mini') && bt) bt.click();
      setTimeout(function () { inp.focus(); }, 60);
    });
    return w.querySelector('input');
  }
  // o Modo TV (assets/modo-tv.js) entra na lateral depois que a página carrega; o
  // campo entra depois dele, para ficar logo acima do Voltar ao Hub
  function init(redesenha) {
    cb = redesenha || cb;
    if (inp) return;
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { init(); }, 0); }); return; }
    css(); inp = monta(); if (!inp) return;
    window.addEventListener('load', function () { var w = inp.closest('.s-busca'), v = w.parentNode.querySelector('.s-volta'); if (v && w.nextElementSibling !== v) w.parentNode.insertBefore(w, v); });
    inp.value = '';
    var marca = function () { digitou = true; };
    ['keydown', 'beforeinput', 'paste', 'cut', 'drop'].forEach(function (ev) { inp.addEventListener(ev, marca); });
    inp.addEventListener('input', function (e) {
      if (!digitou) { inp.value = ''; return; }   // preenchido pelo navegador, sem ninguém digitar
      digitou = true;
      clearTimeout(tm); tm = setTimeout(aplica, 180);
    });
    inp.addEventListener('search', function () { digitou = true; aplica(); });   // o "x" do campo
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') { inp.value = ''; aplica(); } });
    [300, 1200, 3000].forEach(function (ms) { setTimeout(function () { if (!digitou && inp.value) inp.value = ''; }, ms); });
  }
  global.FcaBusca = { init: init, ok: ok, ativa: ativa, norm: norm };
})(typeof window !== 'undefined' ? window : globalThis);
