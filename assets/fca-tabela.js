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
  const numAcao = t => { const m = String(t || '').match(/^\s*(\d+)\.(\d+)\.\s/); return m ? [+m[1], +m[2]] : null; };
  const numCausa = t => { const m = String(t || '').match(/^\s*(\d+)\.\s/); return m ? +m[1] : null; };

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
      // dentro do fato: as ações numeradas na ordem da causa (1.1, 1.2, 2.1…); as escritas à mão depois, na ordem da página
      const rows = G.rows.slice().sort((a, b) => {
        const na = numAcao(a.r.acao) || (numCausa(a.r.causa) != null ? [numCausa(a.r.causa), 0] : null),
          nb = numAcao(b.r.acao) || (numCausa(b.r.causa) != null ? [numCausa(b.r.causa), 0] : null);
        if (na && nb) return na[0] - nb[0] || na[1] - nb[1] || a.i - b.i;
        if (na) return -1; if (nb) return 1; return a.i - b.i; }).map(x => x.r);
      const n = rows.length, f0 = rows[0];
      // a causa repetida nas linhas seguidas vira UMA célula (rowspan) sobre as ações dela
      const span = rows.map(() => 1);
      for (let i = 0; i < n; i++) { if (!span[i]) continue; const c = String(rows[i].causa || '').trim(); if (!c) continue;
        let j = i + 1; while (j < n && String(rows[j].causa || '').trim() === c) { span[i]++; span[j] = 0; j++; } }
      h += '<tbody class="fg">';
      rows.forEach((r, i) => {
        const st = r.status || DEF, sp = ps(r), cor = sp === 'Vencida' ? 'var(--vermelho,#FF5252)' : 'var(--verde,#3BB33B)';
        const feita = /conclu|cancel/i.test(st);
        h += `<tr data-id="${esc(r.id)}" title="Clique para abrir a ação"${feita ? ' class="feita"' : ''}>`;
        if (i === 0) h += (o.uni ? `<td class="center id" rowspan="${n}">${esc(f0.uni || '—')}</td>` : '') +
          `<td class="center id" rowspan="${n}">${esc(f0.proj || '—')}</td><td class="center id vig" rowspan="${n}">${esc(String(f0.vig || '').toUpperCase())}</td>` +
          `<td class="txt fato id" rowspan="${n}">${fatoHTML(primeira(f0.fato), f0.desvio, tri)}</td>`;
        if (span[i]) h += `<td class="txt ln cz"${span[i] > 1 ? ` rowspan="${span[i]}"` : ''}>${causaHTML(r.causa, tri)}</td>`;
        h += `<td class="txt ln">${acaoHTML(r.acao, tri)}</td>` +
          `<td class="center ln">${esc(r.resp) || '<span class="fg-vazio">—</span>'}</td>` +
          `<td class="center ln prazo" title="${esc(sp)}"><span class="dot" style="background:${cor}"></span>${prazoBR(r.prazo)}</td>` +
          `<td class="center ln">${chip(st)}</td></tr>`;
      });
      h += '</tbody>';
    });
    return h + '</table></div></div>';
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
@media(max-width:860px){table.rel.fg-rel td.fato .fa-ano-res{display:none;}table.rel.fg-rel td.fato .fa-ano-pe{position:static;}}`;
    document.head.appendChild(s);
  }

  g.FcaTabela = { html, desvioCurto, causaHTML, acaoHTML, fatoHTML, contaCurta };
})(typeof window !== 'undefined' ? window : globalThis);
