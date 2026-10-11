/* ============================================================
   MODO TV — tela cheia em qualquer painel (Renan, 11/10/2026)
   ------------------------------------------------------------
   "Crie um aqui pra todos os painéis. Pode ficar no menu lateral e
   atalhos… um símbolo de tela cheia."

   Um botão só, posto por este arquivo, para não repetir HTML em 50 painéis:
   - painel com lateral: item no fim de "Atalhos" (sem Atalhos, logo acima
     do "Voltar ao Hub"). Recolhida, vira só o ícone, como os outros itens;
   - tela sem lateral (sub-hubs, institucionais): pílula no rodapé, ao lado
     do "Voltar", com a mesma classe dos links de lá.
   Clicar pede tela cheia do documento inteiro; clicar de novo (ou Esc) sai.
   O rótulo e o ícone acompanham o estado real (fullscreenchange), então
   sair pelo Esc também volta o botão para "Modo TV".

   Fica de fora, de propósito:
   - dentro de iframe (Check de Metas fotografa os painéis em iframes, e o
     navegador nem deixa iframe sem permissão ir para tela cheia);
   - navegador sem a API (Safari do iPhone): botão que não faz nada é pior
     que botão nenhum.
   Gráficos: ao entrar e sair a janela muda de tamanho e o Chart.js
   (responsive) redesenha sozinho; o resize é disparado de novo por
   garantia, para painéis que redesenham no próprio listener de resize.
   ============================================================ */
(function () {
  'use strict';
  if (window.__modoTV) return;
  window.__modoTV = true;

  try { if (window.top !== window.self) return; } catch (e) { return; }
  const d = document, de = d.documentElement;
  const pode = !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
  if (!pode) return;

  const ativo = () => !!(d.fullscreenElement || d.webkitFullscreenElement);
  function entra() {
    const f = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!f) return;
    try { const p = f.call(de); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function sai() {
    const f = d.exitFullscreen || d.webkitExitFullscreen;
    if (!f) return;
    try { const p = f.call(d); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  const alterna = () => (ativo() ? sai() : entra());

  const SVG = (tam, corpo) =>
    `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`;
  const ABRE  = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
  const FECHA = '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>';

  const botoes = [];
  function pinta() {
    const on = ativo();
    d.body && d.body.classList.toggle('modo-tv', on);
    botoes.forEach(b => {
      b.el.innerHTML = SVG(b.tam, on ? FECHA : ABRE) + (on ? 'Sair do modo TV' : 'Modo TV');
      b.el.title = on ? 'Sair do modo TV (Esc)' : 'Modo TV · tela cheia';
      b.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // a dica da lateral recolhida é criada por cada painel; procura na hora
  function ligaDica(el) {
    el.addEventListener('mouseenter', () => {
      const side = el.closest('.side, .adm-side');
      const dica = d.querySelector('.dica');
      if (!side || !dica || !side.classList.contains('mini')) return;
      dica.textContent = ativo() ? 'Sair do modo TV' : 'Modo TV';
      const r = el.getBoundingClientRect();
      dica.style.top = Math.round(r.top + r.height / 2) + 'px';
      dica.style.left = Math.round(r.right + 10) + 'px';
      dica.classList.add('on');
    });
    const esconde = () => { const dica = d.querySelector('.dica'); if (dica) dica.classList.remove('on'); };
    el.addEventListener('mouseleave', esconde);
    el.addEventListener('click', esconde);
  }

  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function naLateral(side) {
    if (side.querySelector('.tv-btn')) return;
    const b = d.createElement('button');
    b.type = 'button';
    b.className = 's-item tv-btn';
    b.addEventListener('click', alterna);
    ligaDica(b);
    // fim do bloco "Atalhos": anda pelos irmãos até a próxima seção/rodapé
    const sec = [...side.querySelectorAll('.s-sec')].find(s => txt(s) === 'atalhos');
    let antes = null, pai = side;
    if (sec) {
      pai = sec.parentNode;
      let n = sec.nextElementSibling;
      while (n && !n.matches('.s-sec, .s-volta, .s-user')) n = n.nextElementSibling;
      antes = n;
    } else {
      const volta = side.querySelector('.s-volta') || side.querySelector('.s-user');
      if (volta) { pai = volta.parentNode; antes = volta; }
    }
    pai.insertBefore(b, antes);
    botoes.push({ el: b, tam: 14 });
  }

  function noRodape(pe) {
    if (pe.querySelector('.tv-btn')) return;
    const irmao = pe.querySelector('a');
    const a = d.createElement('a');
    a.href = '#';
    a.setAttribute('role', 'button');
    a.className = ((irmao && irmao.className) || '') + ' tv-btn';
    a.addEventListener('click', e => { e.preventDefault(); alterna(); });
    pe.appendChild(a);
    botoes.push({ el: a, tam: 12 });
  }

  function monta() {
    d.querySelectorAll('.side, .adm-side').forEach(naLateral);
    if (!botoes.length) d.querySelectorAll('.pe-volta').forEach(noRodape);
    if (!botoes.length) return;
    // a pílula do rodapé herda o estilo dos links de lá; o ícone precisa de cor própria
    const st = d.createElement('style');
    st.textContent = '.pe-volta .tv-btn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;}'
      + '.pe-volta .tv-btn svg{flex:0 0 auto;}';
    d.head.appendChild(st);
    pinta();
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => d.addEventListener(ev, () => {
      pinta();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    }));
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
