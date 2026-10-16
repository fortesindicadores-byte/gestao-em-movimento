/* ============================================================================
   FcaTabela — a Tabela do FCA no desenho do FCA Automático (Renan, 16/10/2026:
   "O layout não está como desenhamos… Está desenhado! Passamos dias fazendo").
   Usada pelo FCA · Admin (fca-consolidado) e pelo FCA da unidade (fca-preenchimento).

   · UM BLOCO POR FATO (tbody.fg): Unidade · Projeto · Vigência · Fato mesclados (rowspan);
   · UMA LINHA POR AÇÃO, na ordem da causa (1.1, 1.2, 2.1…); a causa fica mesclada sobre
     as ações dela, com o número em negrito, as placas embaixo (uma por linha) e o "Obs."
     em parágrafo à parte;
   · FATO CURTO: "▲ R$ 3.070 (4%)" e as contas "Combustíveis ▲ 4,2K (5%)"; o YTD ("YTD: …"
     no fato_desvio, gravado pela geração) fica no pé da célula do fato;
   · pontilhado entre as linhas do mesmo fato; o bloco inteiro acende no hover;
   · só leitura: a linha abre a caixa da ação (tr[data-id]), como antes.
   O texto gravado não muda; é só a apresentação.
   ============================================================================ */
(function (g) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NK = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  // o mesmo resumo das contas do FCA Automático (FcaAuto.CONTA_CURTA)
  const CONTA_CURTA = {
    'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'Man. Veículos e Equip.', 'MANUTENCAO DE VEICULOS E EQUIP.': 'Man. Veículos e Equip.',
    'CONTRATOS DE MANUTENCAO FABRICANTE': 'Contratos Fabricante', 'MANUTENCAO DE CARROCERIAS': 'Carrocerias', 'MATERIAIS E FERRAMENTAS DE OFICINA': 'Ferramentas',
    'LAVACAO DE VEICULOS': 'Lavação', 'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'Personalização', 'PERSONALIZACAO/PADRONIZACAO': 'Personalização', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'Personalização',
    'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'Combustíveis', 'COMBUSTIVEIS': 'Combustíveis', 'FLUIDOS (ARLA)': 'Arla', 'ARLA': 'Arla',
    'PNEUS NOVOS': 'Pneus Novos', 'RECAPAGENS E OUTROS SERVICOS': 'Recapagens', 'CONSERTOS E RECAPAGENS DE PNEUS': 'Consertos e Recap.', 'PNEUS E CAMARAS': 'Pneus e Câmaras',
    'SEGURO DE VEICULOS E EQUIPAMENTOS': 'Seguro', 'SEGUROS': 'Seguro', 'IPVA E LICENCIAMENTO DE VEICULOS': 'IPVA', 'IPVA E LICENCIAMENTO': 'IPVA'
  };
  const contaCurta = c => CONTA_CURTA[NK(c)] || String(c || '').trim();
  const primeira = s => String(s || '').split('\n')[0].replace(/(\S)\s*desvio[\s\S]*$/i, '$1').trim();

  /* fato_desvio → {tot, contas[], ytd, resto}. Formato do FCA de Custos:
     "Desvio: ▲ R$ 3.070 · ▲ -4%\nContas:\n- Combustíveis: ▲ 4,2K | ▲ 5%\n- Arla: ▼ 1,2K | ▼ 68% (saving)\nYTD: ▲ R$ 45.000 (6%) · reduzir 11% até dez/26".
     Texto em outro formato (RPM "Meta: … | Real: …", fato escrito à mão) volta inteiro em "resto". */
  function desvioCurto(txt) {
    const ls = String(txt || '').split('\n').map(s => s.trim()).filter(Boolean);
    const o = { tot: '', contas: [], ytd: '', resto: [] };
    ls.forEach(l => {
      let m;
      if ((m = l.match(/^YTD:\s*(.+)$/i))) { o.ytd = m[1]; return; }
      if ((m = l.match(/^Desvio:\s*([▲▼])\s*(R\$\s*[\d.,]+)\s*(?:·\s*[▲▼]?\s*[-−]?\s*([\d.,]+)\s*%)?/))) { o.tot = `${m[1]} ${m[2]}${m[3] != null ? ' (' + m[3] + '%)' : ''}`; return; }
      if (/^Contas:?$/i.test(l)) return;
      if ((m = l.match(/^-\s*(.+?):\s*([▲▼])\s*([^|]+?)(?:\s*\|\s*[▲▼]?\s*[-−]?\s*([\d.,]+)\s*%)?(?:\s*\(saving\))?$/i))) { o.contas.push(`${contaCurta(m[1])} ${m[2]} ${m[3].trim()}${m[4] != null ? ' (' + m[4] + '%)' : ''}`); return; }
      o.resto.push(l);
    });
    return o;
  }

  // número da ação ("2.1.") e da causa ("2.") que a geração grava no início do texto
  const numAcao = t => { const m = String(t || '').match(/^\s*(\d+)\.(\d+)\.(\s|$)/); return m ? [+m[1], +m[2]] : null; };
  const numCausa = t => { const m = String(t || '').match(/^\s*(\d+)\.(\s|$)/); return m ? +m[1] : null; };

  function causaHTML(t, tri) {
    let s = String(t || '').trim(); if (!s) return '<span class="fg-vazio">—</span>';
    let num = ''; const m = s.match(/^(\d+)\.\s+/); if (m) { num = `<span class="ln-n">${m[1]}.</span>`; s = s.slice(m[0].length); }
    const i = s.search(/\n\s*\n\s*Obs\.:/), cab = i < 0 ? s : s.slice(0, i), obs = i < 0 ? '' : s.slice(i).trim();
    const linhas = cab.split('\n'), txt = [], of = [];
    linhas.forEach(l => { if (/^\s*-\s+/.test(l)) of.push(l.replace(/^\s*-\s+/, '')); else if (!of.length) txt.push(l); else of.push(l); });
    return num + tri(esc(txt.join('\n')).replace(/\n/g, '<br>')) +
      (of.length ? `<ul class="fa-of">${of.map(o => `<li>${tri(esc(o))}</li>`).join('')}</ul>` : '') +
      (obs ? `<div class="fa-obs">${tri(esc(obs).replace(/\n/g, '<br>'))}</div>` : '');
  }
  function acaoHTML(t, tri) {
    let s = String(t || '').trim(); if (!s) return '<span class="fg-vazio">—</span>';
    let num = ''; const m = s.match(/^(\d+\.\d+)\.\s+/); if (m) { num = `<span class="ln-n">${m[1]}.</span>`; s = s.slice(m[0].length); }
    return num + tri(esc(s).replace(/\n/g, '<br>'));
  }
  function fatoHTML(fato, desvio, tri) {
    const d = desvioCurto(desvio), corpo = [];
    if (d.tot) corpo.push(`<span class="fa-tot">${tri(esc(d.tot))}</span>`);
    d.contas.forEach(c => corpo.push(tri(esc(c))));
    d.resto.forEach(c => corpo.push(tri(esc(c))));
    const ytd = d.ytd ? `<div class="fa-ano"><span class="kl">YTD</span>${tri(esc(d.ytd))}</div>` : '';
    return `<b class="fa-pac">${esc(fato) || '—'}</b>${corpo.length ? `<small>${corpo.join('<br>')}</small>` : ''}` +
      (ytd ? ytd.replace('class="fa-ano"', 'class="fa-ano fa-ano-res" aria-hidden="true"') + ytd.replace('class="fa-ano"', 'class="fa-ano fa-ano-pe"') : '');
  }

  /* html(itens, o)
     itens: [{id, uni, proj, vig, fato, desvio, causa, acao, resp, prazo, status}] — já na ordem da página
       (vencidas primeiro); o bloco do fato entra na posição da 1ª linha dele.
     o: {uni:true (coluna Unidade), tri, chip(status), prazoState(row), diasVenc(prazo), defaultStatus, vazio} */
  function html(itens, o) {
    o = o || {}; estilo();
    const tri = o.tri || (h => h), chip = o.chip || (s => esc(s)), ps = o.prazoState || (() => ''), dv = o.diasVenc || (() => 0);
    const DEF = o.defaultStatus || 'Não iniciada';
    const grupos = [], porK = {};
    itens.forEach((r, i) => { const k = [r.uni, r.proj, r.vig, primeira(r.fato)].join('|');
      if (!porK[k]) { porK[k] = { k, rows: [] }; grupos.push(porK[k]); } porK[k].rows.push({ r, i }); });
    const prazoBR = p => p ? String(p).slice(0, 10).split('-').reverse().join('/') : '—';
    const nCol = o.uni ? 9 : 8;
    let h = `<div class="rel-section"><div class="rel-wrap"><table class="rel fg-rel" data-no-sort><thead><tr>` +
      (o.uni ? '<th class="c-uni" title="Unidade">Unid.</th>' : '') + '<th class="c-proj">Projeto</th><th class="c-vig" title="Vigência">Vig.</th>' +
      '<th class="c-fato">Fato</th><th class="c-txt">Causa</th><th class="c-txt">Ação</th>' +
      '<th class="c-resp" title="Responsável">Resp.</th><th class="c-prazo">Prazo</th><th class="c-st">Status</th></tr></thead>';
    if (!grupos.length) return h + `<tbody><tr><td colspan="${nCol}" class="center">${esc(o.vazio || 'Nenhuma ação com os filtros selecionados.')}</td></tr></tbody></table></div></div>`;
    grupos.forEach(G => {
      // dentro do fato: as linhas da MESMA causa ficam juntas; as causas na ordem do número (1., 2., 3.) e, sem número,
      // na ordem em que aparecem; dentro da causa, as ações numeradas (1.1, 1.2…) e depois as sem número (ex.: a nova)
      const ck = r => String(r.causa || '').trim(), ordC = {};
      G.rows.forEach(x => { const k = ck(x.r); if (k && !(k in ordC)) { const nc = numCausa(k); ordC[k] = nc != null ? nc : 1000 + x.i; } });
      const rows = G.rows.slice().sort((a, b) => {
        const ca = ck(a.r) ? ordC[ck(a.r)] : 5000 + a.i, cb = ck(b.r) ? ordC[ck(b.r)] : 5000 + b.i;
        if (ca !== cb) return ca - cb;
        const na = numAcao(a.r.acao), nb = numAcao(b.r.acao);
        if (na && nb) return na[0] - nb[0] || na[1] - nb[1] || a.i - b.i;
        if (na) return -1; if (nb) return 1; return a.i - b.i; }).map(x => x.r);
      const n = rows.length, f0 = rows[0];
      // a causa repetida nas linhas seguidas vira UMA célula (rowspan) sobre as ações dela
      const span = rows.map(() => 1), dono = rows.map((_, i) => i);
      for (let i = 0; i < n; i++) { if (!span[i]) continue; const c = ck(rows[i]); if (!c) continue;
        let j = i + 1; while (j < n && ck(rows[j]) === c) { span[i]++; span[j] = 0; dono[j] = i; j++; } }
      // "+" ÁGIL (Renan, 16/10/2026: "Aqui pode ter um +, para adicionar mais uma causa ou mais uma ação de forma ágil"):
      // no pé da última causa do fato, + causa; no pé da última ação de cada causa, + ação para ESSA causa
      const temTxt = r => !!(ck(r) || String(r.acao || '').trim());
      const ultCausa = (() => { for (let i = n - 1; i >= 0; i--) if (span[i] && temTxt(rows[i])) return i; return -1; })();
      const add = (tipo, id, t) => o.add ? `<button type="button" class="kadd fg-add" data-add="${tipo}" data-id="${esc(id)}" title="${t}">+</button>` : '';
      h += '<tbody class="fg">';
      rows.forEach((r, i) => {
        const st = r.status || DEF, sp = ps(r), cor = sp === 'Vencida' ? 'var(--vermelho,#FF5252)' : 'var(--verde,#3BB33B)';
        const feita = /conclu|cancel/i.test(st);
        const fimDaCausa = i === n - 1 || dono[i + 1] !== dono[i];
        h += `<tr data-id="${esc(r.id)}" title="Clique para abrir a ação"${feita ? ' class="feita"' : ''}>`;
        if (i === 0) h += (o.uni ? `<td class="center id" rowspan="${n}">${esc(f0.uni || '—')}</td>` : '') +
          `<td class="center id" rowspan="${n}">${esc(f0.proj || '—')}</td><td class="center id vig" rowspan="${n}">${esc(String(f0.vig || '').toUpperCase())}</td>` +
          `<td class="txt fato id" rowspan="${n}">${fatoHTML(primeira(f0.fato), f0.desvio, tri)}</td>`;
        if (span[i]) h += `<td class="txt ln cz${i === ultCausa && o.add ? ' tem-add' : ''}"${span[i] > 1 ? ` rowspan="${span[i]}"` : ''}>${causaHTML(r.causa, tri)}${i === ultCausa ? add('causa', r.id, 'Mais uma causa para este fato') : ''}</td>`;
        const addA = fimDaCausa && temTxt(r) ? add('acao', r.id, 'Mais uma ação para esta causa') : '';
        h += `<td class="txt ln${addA ? ' tem-add' : ''}">${acaoHTML(r.acao, tri)}${addA}</td>` +
          `<td class="center ln">${esc(r.resp) || '<span class="fg-vazio">—</span>'}</td>` +
          `<td class="center ln prazo" title="${esc(sp)}"><span class="dot" style="background:${cor}"></span>${prazoBR(r.prazo)}</td>` +
          `<td class="center ln">${chip(st)}</td></tr>`;
      });
      h += '</tbody>';
    });
    return h + '</table></div></div>';
  }

  /* CARD DO KANBAN no desenho do FCA Automático (Renan, 16/10/2026: "As unidades precisam ver no mesmo formato
     e visão. É a nova visão!"): origem · unidade · projeto · mês, o pacote, só o desvio do pacote e o YTD, e embaixo
     de um filete a causa (com o número) e a ação inteira (número em laranja); rodapé com prazo e iniciais.
     x: {id, origem, uni, proj, vig, fato, desvio, causa, acao, resp, prazoHTML, arrasta, extra (html dos atalhos)} */
  function card(x, o) {
    o = o || {}; estilo(); const tri = o.tri || (h => h);
    const d = desvioCurto(x.desvio), org = /rpm/i.test(x.origem || '') ? 'rpm' : 'cst';
    const linha1 = d.tot || d.resto[0] || '';
    const c = String(x.causa || '').trim(), cm = c.match(/^(\d+)\.\s+/), c1 = (cm ? c.slice(cm[0].length) : c).split('\n')[0];
    const a = String(x.acao || '').trim(), am = a.match(/^(\d+\.\d+)\.\s+/), at = am ? a.slice(am[0].length) : a;
    const ini = n => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return !p.length ? '?' : (p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase(); };
    return `<div class="kcard fa-kc"${x.arrasta === false ? '' : ' draggable="true"'} data-id="${esc(x.id)}">
    <div class="kcard-top"><span class="korg ${org}">${esc(x.origem || '')}</span> ${esc(x.uni || '')} · ${esc(x.proj || '')} · ${esc(String(x.vig || '').toUpperCase())}</div>
    <div class="kcard-fato">${esc(primeira(x.fato)) || '—'}</div>
    <div class="kcard-desvio">${linha1 ? '<span class="kl">Fato:</span> ' + tri(esc(linha1)) : '<i>sem desvio</i>'}${d.ytd ? `<div class="fk-ytd"><span class="kl">YTD</span> ${tri(esc(d.ytd))}</div>` : ''}</div>
    <div class="fk-in">
      <div class="kcard-causa">${c ? `<span class="kl">Causa${cm ? ' ' + cm[1] : ''}:</span> ${tri(esc(c1))}` : '<i>causa não preenchida</i>'}</div>
      <div class="kcard-ac">${a ? (am ? `<b class="fk-n">${esc(am[1])}</b> ` : '') + tri(esc(at)).replace(/\n/g, '<br>') : '<i>ação não preenchida</i>'}</div>
    </div>
    <div class="kcard-meta"><span>${x.prazoHTML || ''}</span>${x.extra || ''}${x.resp ? `<span class="kav" title="${esc(x.resp)}">${esc(ini(x.resp))}</span>` : '<span></span>'}</div>
  </div>`;
  }

  // o CSS do desenho mora aqui, para as duas páginas ficarem iguais
  let _est = false;
  function estilo() {
    if (_est || typeof document === 'undefined') return; _est = true;
    const s = document.createElement('style'); s.id = 'fca-tabela-css';
    s.textContent = `
table.rel.fg-rel tbody.fg{border-top:2px solid var(--card-brd);}
table.rel.fg-rel tbody.fg td.id{vertical-align:top;border-bottom:0!important;}
table.rel.fg-rel td.center{overflow-wrap:anywhere;}
table.rel.fg-rel td.vig{white-space:nowrap;overflow-wrap:normal;}
table.rel.fg-rel td.id.center{overflow-wrap:normal;word-break:normal;}
table.rel.fg-rel th.c-proj{width:9.5%;} table.rel.fg-rel th.c-txt{width:20.25%;}
table.rel.fg-rel thead th{letter-spacing:.3px!important;}
table.rel.fg-rel tbody.fg td.ln{border-bottom:0!important;padding-top:8px!important;padding-bottom:8px!important;line-height:1.4;vertical-align:top;}
table.rel.fg-rel tbody.fg tr+tr td.ln{border-top:1px dashed rgba(255,255,255,.26)!important;}
body.claro table.rel.fg-rel tbody.fg tr+tr td.ln,body.light-mode table.rel.fg-rel tbody.fg tr+tr td.ln{border-top-color:rgba(15,23,42,.30)!important;}
table.rel.fg-rel tbody.fg:hover td{background:var(--hover)!important;}
table.rel.fg-rel tbody tr:hover{background:none!important;}
table.rel.fg-rel tr.feita td.ln:not(.cz){opacity:.5;}
table.rel.fg-rel .ln-n{font-weight:700;margin-right:4px;color:inherit;}
table.rel.fg-rel td.fato{position:relative;}
table.rel.fg-rel td.fato .fa-pac{font-size:13px;color:var(--txt,var(--text));}
table.rel.fg-rel td.fato small{display:block;margin-top:3px;font-size:10.5px;font-weight:600;color:var(--txt3,var(--text3));line-height:1.45;}
table.rel.fg-rel td.fato .fa-tot{font-weight:800;color:var(--txt2,var(--text2));}
table.rel.fg-rel .fa-ano{font-size:10.5px;font-weight:700;color:var(--txt2,var(--text2));margin-top:10px;}
table.rel.fg-rel .fa-ano .kl{color:var(--txt3,var(--text3));font-weight:600;text-transform:uppercase;font-size:9.5px;letter-spacing:.5px;margin-right:4px;}
table.rel.fg-rel td.fato .fa-ano-res{visibility:hidden;}
table.rel.fg-rel td.fato .fa-ano-pe{position:absolute;left:0;right:0;bottom:10px;margin:0;padding-left:inherit;padding-right:inherit;}
table.rel.fg-rel .fa-of{list-style:none;margin:5px 0 0;padding:0;font-size:10px;font-weight:500;color:var(--txt2,var(--text2));line-height:1.45;}
table.rel.fg-rel .fa-of li{padding-left:10px;position:relative;white-space:normal;}
table.rel.fg-rel .fa-of li::before{content:'';position:absolute;left:2px;top:.62em;width:4px;height:4px;border-radius:50%;background:var(--orange,#F97316);}
table.rel.fg-rel .fa-obs{margin-top:6px;}
table.rel.fg-rel .fg-vazio{color:var(--txt3,var(--text3));}
table.rel.fg-rel td.tem-add{position:relative;padding-bottom:28px!important;}
table.rel.fg-rel .fg-add{position:absolute;right:8px;bottom:4px;padding:0 2px;background:none!important;border:0!important;box-shadow:none!important;font-family:inherit;font-size:17px;font-weight:700;line-height:1;color:var(--orange,#F97316)!important;cursor:pointer;opacity:.6;transition:opacity .15s,transform .15s;}
table.rel.fg-rel tbody.fg:hover .fg-add{opacity:1;}
table.rel.fg-rel .fg-add:hover{transform:scale(1.2);}
.kcard.fa-kc{padding:0 0 13px!important;}
body:not(.claro):not(.light-mode) .kcard.fa-kc{background:var(--brilho), rgba(30,30,32,.88)!important;box-shadow:0 3px 10px rgba(0,0,0,.22), var(--luz-card)!important;}
.fa-kc .kcard-top{padding:13px 15px 0!important;font-size:10px!important;}
.fa-kc .kcard-fato{padding:0 15px;font-size:15.5px!important;margin-top:6px;}
.fa-kc .kcard-desvio{padding:0 15px;font-size:11.5px;margin-top:6px;line-height:1.45;}
.fa-kc .fk-ytd{margin-top:3px;font-weight:600;color:var(--txt3,var(--text3));}
.fa-kc .fk-in{margin:11px 15px 0;padding:11px 0 0;border-top:1px solid var(--linha);}
.fa-kc .kcard-causa{padding:0;margin:0 0 7px;font-size:11.5px;font-weight:700;color:var(--txt2,var(--text2));line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.fa-kc .kcard-ac{padding:0;margin:0!important;font-size:12.5px!important;color:var(--txt,var(--text))!important;line-height:1.45;min-height:0;}
.fa-kc .fk-n{color:var(--laranja,var(--orange,#F97316));font-weight:800;}
.fa-kc .kcard-meta{padding:11px 15px 0;margin-top:11px!important;border-top:1px solid var(--linha);}
@media(max-width:860px){table.rel.fg-rel td.fato .fa-ano-res{display:none;}table.rel.fg-rel td.fato .fa-ano-pe{position:static;}}`;
    document.head.appendChild(s);
  }

  // número automático do "+": rows = as linhas do MESMO fato; tipo 'acao' (com a causa de origem) ou 'causa'.
  // + ação → "k.n. " (n = próxima ação da causa k); + causa → causa "k. " e ação "k.1. " (k = próxima causa).
  function numeracao(rows, causaSrc, tipo) {
    const ck = t => String(t || '').trim();
    const causas = [];
    (rows || []).forEach(r => { const c = ck(r.causa); if (c && !causas.includes(c)) causas.push(c); });
    const numDe = c => { const n = numCausa(c); return n != null ? n : causas.indexOf(c) + 1; };
    const src = ck(causaSrc);
    if (tipo === 'acao' && src) {
      const k = numDe(src);
      let max = 0, qtd = 0;
      (rows || []).forEach(r => {
        if (ck(r.causa) !== src || !ck(r.acao)) return;
        qtd++;
        String(r.acao).replace(/(\d+)\.(\d+)\./g, (m, a, b) => { if (+a === k && +b > max) max = +b; return m; });
      });
      return { acao: `${k}.${Math.max(max, qtd) + 1}. ` };
    }
    const maxC = causas.reduce((m, c) => Math.max(m, numDe(c)), 0);
    const k = Math.max(maxC, causas.length) + 1;
    return { causa: `${k}. `, acao: `${k}.1. ` };
  }

  g.FcaTabela = { html, card, desvioCurto, causaHTML, acaoHTML, fatoHTML, contaCurta, numeracao };
})(typeof window !== 'undefined' ? window : globalThis);
