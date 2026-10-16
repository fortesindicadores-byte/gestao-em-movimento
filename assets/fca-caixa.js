/* ============================================================================
   FcaCaixa — a caixa da ação do FCA no formato novo (o do FCA Automático),
   usada pelo FCA · Admin (fca-consolidado) e pelo FCA da unidade (fca-preenchimento).
   Renan, 16/10/2026: "quando abre a ação para editar, está no novo formato?".

   · 1180 px; cabeçalho e rodapé com filete; Causa e Ação lado a lado, abrindo do
     tamanho do texto;
   · Responsável ESCOLHIDO, não digitado: o gestor de frota da unidade primeiro
     (FcaAuto.GESTOR_FROTA), depois os cadastrados na unidade e os admins, só o
     nome curto em maiúsculo;
   · Status em botões lado a lado; a dica do prazo diz quanto falta ou há quanto venceu;
   · grava sozinho (o rodapé diz "Salvo ✓"); + ação, + causa e Excluir viram links.
   Os ids continuam os da caixa antiga (km-*), então a gravação de cada página não muda:
   o select #km-status (escondido) e o #km-resp disparam 'change' como antes.
   ============================================================================ */
(function (g) {
  'use strict';
  const ST = ['Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'];
  const COR = { 'Não iniciada': 'var(--vermelho,#FF5252)', 'Em andamento': 'var(--amber,#F4A100)', 'Concluída': 'var(--verde,#3BB33B)', 'Cancelada': 'var(--txt3,#888)' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const FA = () => g.FcaAuto || {};
  const nomeCurto = n => (FA().nomeCurto ? FA().nomeCurto(n) : String(n || '').trim().toUpperCase());

  const CSS = `
.kmodal-ov{position:fixed;inset:0;background:rgba(3,6,11,.55);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:2000;padding:20px;}
.kmodal.kac{background:var(--brilho), var(--card);border:1px solid var(--card-brd);border-radius:14px;width:min(1180px,96vw);max-height:94vh;padding:0;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 30px 70px rgba(0,0,0,.6);}
.kac .ac-hd{display:flex;align-items:flex-start;gap:12px;padding:18px 22px 14px;border-bottom:1px solid var(--card-brd);}
.kac .ac-hd .t{flex:1;min-width:0;}.kac .ac-hd b{display:block;font-size:16px;font-weight:800;color:var(--txt);line-height:1.25;}
.kac .kmodal-sub{font-size:10px;color:var(--txt3);margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;font-weight:600;}
.kac .kmodal-x{background:none;border:none;color:var(--txt3);font-size:18px;cursor:pointer;line-height:1;}.kac .kmodal-x:hover{color:var(--txt);}
.kac .ac-bd{padding:6px 22px 16px;overflow:auto;flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:14px;}
.kac .ac-bd>.cheio{grid-column:1/-1;}
.kac label{display:flex;align-items:baseline;gap:6px;font-size:9.5px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.9px;margin:14px 0 6px;}
.kac label .dica{text-transform:none;letter-spacing:0;font-weight:500;color:var(--txt3);font-size:10.5px;}
.kac label .dica.venc{color:var(--vermelho,#FF5252);font-weight:700;}
.kac textarea,.kac input,.kac select{width:100%;box-sizing:border-box;background:var(--hover);border:1px solid var(--card-brd);border-radius:8px;color:var(--txt);font-family:inherit;font-size:12.5px;padding:9px 11px;outline:none;}
body.claro .kac textarea,body.claro .kac input,body.claro .kac select,body.light-mode .kac textarea,body.light-mode .kac input,body.light-mode .kac select{background:#fff;border-color:#d7dce4;}
.kac textarea:focus,.kac input:focus,.kac select:focus{border-color:var(--laranja,var(--orange,#F97316));}
.kac input,.kac select{height:36px;}.kac select{padding:0 11px;cursor:pointer;}
.kac select option{background:var(--pop,#26262B);color:var(--txt);}body.claro .kac select option,body.light-mode .kac select option{background:#fff;color:#0f172a;}
.kac textarea{resize:vertical;line-height:1.45;}
.kac #km-desv-ed{min-height:64px;margin-top:6px;}.kac #km-causa,.kac #km-acao{min-height:96px;height:112px;}.kac #km-acomp{min-height:56px;height:72px;}
.kac .km-ro{background:var(--hover);border:1px dashed var(--card-brd);border-radius:8px;padding:9px 11px;font-size:12.5px;color:var(--txt2);line-height:1.45;}
.kac .km-ro b{color:var(--txt);font-weight:700;}
.kac #km-status{display:none;}
.kac .ac-seg{display:inline-flex;gap:2px;padding:3px;border-radius:9px;background:var(--hover);border:1px solid var(--card-brd);flex-wrap:wrap;}
.kac .ac-seg button{background:transparent;border:0;border-radius:6px;color:var(--txt2);font-family:inherit;font-size:11.5px;font-weight:600;padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;}
.kac .ac-seg button:hover{color:var(--txt);}
.kac .ac-seg button i{width:7px;height:7px;border-radius:50%;display:inline-block;}
.kac .ac-seg button.on{background:var(--laranja,var(--orange,#F97316));color:#1A0D02;font-weight:800;}.kac .ac-seg button.on i{background:#1A0D02!important;}
.kac .ac-ft{display:flex;align-items:center;gap:8px;padding:12px 22px;border-top:1px solid var(--card-brd);}
.kac .ac-ft .esq{margin-right:auto;display:flex;gap:14px;align-items:center;}
.kac .ac-ft .lnk{background:none;border:0;padding:0;font-family:inherit;font-size:11px;font-weight:600;color:var(--txt3);cursor:pointer;}
.kac .ac-ft .lnk:hover{color:var(--txt);}.kac .ac-ft .lnk.del{color:var(--vermelho,#FF5252);}
.kac .ac-ok{font-size:11px;font-weight:700;color:var(--verde,#3BB33B);min-width:70px;text-align:right;}
.kcard{cursor:pointer;}
@media(max-width:860px){.kac .ac-bd{grid-template-columns:1fr;}}`;

  /* monta(o): o.editaFato (admin edita o fato e o desvio), o.fechar/o.novaAcao/o.novaCausa/o.excluir (nomes de função global) */
  function monta(o) {
    o = o || {};
    if ($('kmodal-ov')) return;
    const st = document.createElement('style'); st.id = 'fca-caixa-css'; st.textContent = CSS; document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'kmodal-ov'; d.className = 'kmodal-ov';
    const fato = o.editaFato
      ? '<input id="km-fato-ed" type="text" placeholder="Fato"><textarea id="km-desv-ed" rows="3" placeholder="Desvio / contas do pacote…"></textarea>'
      : '<div class="km-ro" id="km-desv"></div>';
    d.innerHTML = '<div class="kmodal kac">' +
      '<div class="ac-hd"><div class="t"><b id="km-fato"></b><div class="kmodal-sub" id="km-ctx"></div></div><button class="kmodal-x" onclick="' + (o.fechar || 'closeKModal') + '()">✕</button></div>' +
      '<div class="ac-bd">' +
        '<div class="cheio"><label>Fato <span class="dica">desvio do pacote e YTD</span></label>' + fato + '</div>' +
        '<div><label>Causa</label><textarea id="km-causa"></textarea></div>' +
        '<div><label>Ação</label><textarea id="km-acao"></textarea></div>' +
        '<div><label>Responsável <span class="dica">quem fecha a ação</span></label><select id="km-resp"></select></div>' +
        '<div><label>Prazo <span class="dica" id="km-prazo-dica"></span></label><input id="km-prazo" type="date"></div>' +
        '<div class="cheio"><label>Status <span class="dica">concluída ou cancelada fecha a ação</span></label>' +
          '<div class="ac-seg" id="km-seg">' + ST.map(s => '<button type="button" data-st="' + s + '"><i style="background:' + COR[s] + '"></i>' + s + '</button>').join('') + '</div>' +
          '<select id="km-status">' + ST.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
        '<div class="cheio"><label>Acompanhamento <span class="dica">o que já foi feito</span></label><textarea id="km-acomp" rows="3"></textarea></div>' +
      '</div>' +
      '<div class="ac-ft"><span class="esq">' +
        '<button class="lnk" onclick="' + (o.novaAcao || 'novaAcaoDoModal') + '()">+ ação (mesma causa)</button>' +
        '<button class="lnk" onclick="' + (o.novaCausa || 'novaCausaDoModal') + '()">+ causa (mesmo fato)</button>' +
        '<button class="lnk del" onclick="' + (o.excluir || 'excluirDoModal') + '()">Excluir</button>' +
      '</span><span class="ac-ok" id="km-ok"></span>' +
      '<button class="btn ghost" onclick="' + (o.fechar || 'closeKModal') + '()">Fechar</button></div>' +
    '</div>';
    d.addEventListener('click', e => { if (e.target === d) g[o.fechar || 'closeKModal'](); });
    document.body.appendChild(d);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && d.style.display === 'flex') g[o.fechar || 'closeKModal'](); });
    // status em botões: muda o select escondido e avisa a página pelo 'change' de sempre
    $('km-seg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const s = $('km-status'); if (s.value === b.dataset.st) return; s.value = b.dataset.st; marca(b.dataset.st); dica(); s.dispatchEvent(new Event('change')); }));
    $('km-prazo').addEventListener('change', dica);
    ['km-causa', 'km-acao'].forEach(id => travaNumero($(id)));
  }
  // o número da causa ("2. ") e da ação ("2.3. ") é fixo: dá para escrever depois dele, nunca apagar nem sobrescrever
  const RE_NUM = { 'km-causa': /^\s*\d+\.\s/, 'km-acao': /^\s*\d+\.\d+\.\s/ };
  function prefixo(el) { el.dataset.pref = ((el.value || '').match(RE_NUM[el.id]) || [''])[0]; }
  function travaNumero(el) {
    if (!el) return;
    const L = () => (el.dataset.pref || '').length;
    const poe = (v, c) => { el.value = v; el.setSelectionRange(c, c); el._sujo = true; el.dispatchEvent(new Event('input')); };
    const prende = () => { const n = L(); if (!n || document.activeElement !== el) return;
      if (el.selectionStart < n) el.setSelectionRange(n, Math.max(n, el.selectionEnd)); };
    el.addEventListener('beforeinput', e => {
      const n = L(); if (!n) return;
      const a = el.selectionStart, b = el.selectionEnd, v = el.value, t = e.inputType || '';
      if (a === b) {
        if ((/^delete.*Backward/.test(t) && a <= n) || (/^delete.*Forward/.test(t) && a < n)) e.preventDefault();
        else if (a < n && !/^delete/.test(t)) { e.preventDefault(); const d = e.data || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || (t === 'insertLineBreak' ? '\n' : '');
          poe(v.slice(0, n) + d + v.slice(n), n + d.length); }
        return;
      }
      if (a >= n) return;
      e.preventDefault();
      const d = /^delete/.test(t) ? '' : (e.data || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || (t === 'insertLineBreak' ? '\n' : ''));
      poe(v.slice(0, n) + d + v.slice(Math.max(b, n)), n + d.length);
    });
    // rede: se algo passou (arrastar, corretor), o número volta e o texto fica
    el.addEventListener('input', () => { const p = el.dataset.pref || ''; if (!p || el.value.startsWith(p)) return;
      poe(p + el.value.replace(/^\s*\d*(\.\d*)*\.?\s?/, ''), p.length); });
    ['focus', 'click', 'keyup', 'select'].forEach(ev => el.addEventListener(ev, () => setTimeout(prende, 0)));
    el.addEventListener('blur', () => { if (el._sujo) { el._sujo = false; el.dispatchEvent(new Event('change')); } });
    el.addEventListener('change', () => { el._sujo = false; });
  }
  function marca(v) { const s = $('km-seg'); if (s) s.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === v)); }
  // quanto falta ou há quanto venceu (ação fechada não vence)
  function dica() {
    const el = $('km-prazo-dica'); if (!el) return; const p = $('km-prazo').value, st = $('km-status').value;
    el.className = 'dica'; el.textContent = ''; if (!p) return;
    if (st === 'Concluída' || st === 'Cancelada') { el.textContent = 'ação fechada'; return; }
    const h = new Date(); h.setHours(0, 0, 0, 0); const [a, m, dd] = p.slice(0, 10).split('-').map(Number);
    const n = Math.round((new Date(a, m - 1, dd) - h) / 864e5);
    if (n < 0) { el.className = 'dica venc'; el.textContent = 'vencida há ' + (-n) + (n === -1 ? ' dia' : ' dias'); }
    else el.textContent = n === 0 ? 'vence hoje' : 'faltam ' + n + (n === 1 ? ' dia' : ' dias');
  }
  // quem pode ser dono: o gestor de frota da unidade primeiro, os cadastrados nela (com ou sem tier) e os admins
  function nomesDe(uni, perfis) {
    const u = String(uni || '').replace(/\s*\(INATIVO\)\s*/gi, ' ').trim(), base = u.split(' ')[0];
    const gest = FA().gestorDe ? FA().gestorDe(u) : '';
    const out = []; if (gest) out.push(gest);
    (perfis || []).filter(p => p.admin || (p.unis || []).some(x => x === u || x.split(' ')[0] === base))
      .map(p => p.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(n => { if (n && !out.includes(n)) out.push(n); });
    return out;
  }
  // perfis do fca_profiles → [{nome curto, unis, admin}] (o mesmo nome em vários cadastros vira um)
  function perfisDe(rows) {
    const m = new Map();
    (rows || []).forEach(p => { const n = nomeCurto(p.nome); if (!n) return; const c = m.get(n) || { nome: n, unis: [], admin: false };
      String(p.unidade || '').split(',').map(x => x.trim()).filter(Boolean).forEach(x => { if (!c.unis.includes(x)) c.unis.push(x); });
      if (p.is_admin) c.admin = true; m.set(n, c); });
    return [...m.values()];
  }
  /* abre(o): o.unidade, o.responsavel (gravado), o.perfis (de perfisDe), o.status, o.prazo — os textos a página já pôs nos campos */
  function abre(o) {
    o = o || {};
    const sel = $('km-resp'), atual = String(o.responsavel || '').trim(), lista = nomesDe(o.unidade, o.perfis);
    sel.innerHTML = (atual ? '' : '<option value="">—</option>') +
      (atual && !lista.includes(atual) ? `<option value="${esc(atual)}">${esc(atual)}</option>` : '') +
      lista.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    sel.value = atual;
    ['km-causa', 'km-acao'].forEach(id => { const el = $(id); if (el) prefixo(el); });
    const st = o.status || ST[0]; $('km-status').value = st; marca(st); dica();
    $('km-ok').textContent = '';
    $('kmodal-ov').style.display = 'flex';
    ajusta();
  }
  // Fato, Causa e Ação abrem do tamanho do texto; Causa e Ação com a mesma altura (a maior), com teto
  function ajusta() {
    const vh = window.innerHeight, alt = el => { el.style.height = 'auto'; return el.scrollHeight + 2; };
    const ds = $('km-desv-ed'); if (ds) ds.style.height = Math.min(alt(ds), Math.round(vh * .24)) + 'px';
    const c = $('km-causa'), a = $('km-acao'); const h = Math.max(112, Math.min(Math.max(alt(c), alt(a)), Math.round(vh * .42)));
    c.style.height = a.style.height = h + 'px';
  }
  let _t = null;
  function salvo(txt) { const el = $('km-ok'); if (!el) return; el.textContent = txt || 'Salvo ✓'; clearTimeout(_t); _t = setTimeout(() => { el.textContent = ''; }, 2200); }

  g.FcaCaixa = { monta, abre, salvo, ajusta, perfisDe, nomesDe };
})(typeof window !== 'undefined' ? window : globalThis);
