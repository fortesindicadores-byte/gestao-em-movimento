/* ============================================================
   PONTEIRO DE APRESENTAÇÃO (Renan, 26/11/2026)
   ------------------------------------------------------------
   "Mudar meu ponteiro do mouse, para quando eu estiver em apresentação
   ele fique maior, translúcido, que eu consigo mostrar melhor tópicos."

   Vale em TELA CHEIA: o Modo TV de qualquer painel e o "Apresentar" do
   painel Apresentações (que escondia o cursor de vez). Fora da tela cheia
   o mouse fica o de sempre.
   - um círculo laranja translúcido segue o mouse, no lugar da setinha;
   - parado 2,5 s, some (não fica em cima do número); mexeu, volta;
   - segurando o botão, ele encolhe e acende (para marcar um ponto);
   - tecla P liga/desliga; + e − mudam o tamanho (guardado neste navegador).
   O círculo mora DENTRO do elemento em tela cheia: o navegador só desenha
   o que está dentro dele (no Apresentações é o #show, não o body).
   Não roda em iframe nem em tela de toque.
   ============================================================ */
(function () {
  'use strict';
  if (window.__ponteiroGEM) return;
  window.__ponteiroGEM = true;
  try { if (window.top !== window.self) return; } catch (e) { return; }
  if (window.matchMedia && !matchMedia('(pointer:fine)').matches) return;

  const d = document;
  const CH_LIG = 'gem_ponteiro', CH_TAM = 'gem_ponteiro_tam';
  const ler = (k, v) => { try { const x = localStorage.getItem(k); return x == null ? v : x; } catch (e) { return v; } };
  const grava = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  let ligado = ler(CH_LIG, '1') !== '0';
  let tam = Math.min(140, Math.max(24, +ler(CH_TAM, '56') || 56));
  let x = -200, y = -200, timer = 0;

  const st = d.createElement('style');
  st.textContent =
    '.gem-pt-on, .gem-pt-on *{cursor:none!important;}' +
    '#gem-ponteiro{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;border-radius:50%;' +
    'background:radial-gradient(circle, rgba(249,115,22,.42) 0%, rgba(249,115,22,.26) 58%, rgba(249,115,22,.10) 100%);' +
    'border:2px solid rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.25), 0 0 18px rgba(249,115,22,.45);' +
    'transition:opacity .25s ease, width .12s ease, height .12s ease, background .12s ease;opacity:0;}' +
    '#gem-ponteiro.vivo{opacity:1;}' +
    '#gem-ponteiro.aperta{background:radial-gradient(circle, rgba(249,115,22,.75) 0%, rgba(249,115,22,.45) 70%, rgba(249,115,22,.15) 100%);}' +
    '#gem-ponteiro .gem-pt-dica{position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;' +
    'font:600 11px Montserrat,sans-serif;color:#fff;background:rgba(0,0,0,.7);padding:3px 8px;border-radius:999px;opacity:0;transition:opacity .2s;}' +
    '#gem-ponteiro .gem-pt-dica.on{opacity:1;}';
  (d.head || d.documentElement).appendChild(st);

  const el = d.createElement('div');
  el.id = 'gem-ponteiro';
  el.setAttribute('aria-hidden', 'true');
  const dica = d.createElement('div');
  dica.className = 'gem-pt-dica';
  el.appendChild(dica);

  const fsEl = () => d.fullscreenElement || d.webkitFullscreenElement || null;
  const ativo = () => ligado && !!fsEl();

  function posiciona(aperto) {
    const t = aperto ? tam * 0.6 : tam;
    el.style.width = el.style.height = t + 'px';
    el.style.transform = `translate(${x - t / 2}px, ${y - t / 2}px)`;
  }
  function acorda() {
    el.classList.add('vivo');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('vivo'), 2500);
  }
  function aviso(txt) {
    dica.textContent = txt;
    dica.classList.add('on');
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => dica.classList.remove('on'), 1400);
    acorda();
  }
  function aplica() {
    const f = fsEl();
    d.querySelectorAll('.gem-pt-on').forEach(n => n.classList.remove('gem-pt-on'));
    if (f && ligado) {
      if (el.parentNode !== f) f.appendChild(el);
      f.classList.add('gem-pt-on');
      posiciona(false);
    } else {
      el.classList.remove('vivo');
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  d.addEventListener('mousemove', e => {
    x = e.clientX; y = e.clientY;
    if (!ativo()) return;
    posiciona(e.buttons & 1);
    acorda();
  }, { passive: true });
  d.addEventListener('mousedown', e => { if (ativo() && e.button === 0) { el.classList.add('aperta'); posiciona(true); acorda(); } }, true);
  d.addEventListener('mouseup', () => { el.classList.remove('aperta'); if (ativo()) posiciona(false); }, true);
  d.addEventListener('mouseleave', () => el.classList.remove('vivo'));

  d.addEventListener('keydown', e => {
    if (!fsEl() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable)) return;
    const k = e.key;
    if (k === 'p' || k === 'P') {
      ligado = !ligado; grava(CH_LIG, ligado ? '1' : '0'); aplica();
      if (ligado) aviso('Ponteiro ligado \u00b7 P desliga');
    } else if (ligado && (k === '+' || k === '=')) {
      tam = Math.min(140, tam + 12); grava(CH_TAM, tam); posiciona(false); aviso('Tamanho ' + tam);
    } else if (ligado && (k === '-' || k === '_')) {
      tam = Math.max(24, tam - 12); grava(CH_TAM, tam); posiciona(false); aviso('Tamanho ' + tam);
    } else return;
    e.preventDefault();
  });

  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => d.addEventListener(ev, () => {
    aplica();
    if (ativo()) aviso('Ponteiro \u00b7 P liga/desliga \u00b7 + \u2212 tamanho');
  }));
})();
