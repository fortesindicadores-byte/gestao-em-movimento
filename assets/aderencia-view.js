/* ============================================================
   ADERÊNCIA — visão compartilhada (hero + KPIs + 2 gráficos + tabela)
   ------------------------------------------------------------
   É o Resumo do FCA Gerencial embalado para rodar em qualquer painel:
   Planner (por Assunto/Pessoa), FCA da unidade (por Conta/Indicador) e
   FCA Admin (por Unidade/Projeto/Conta). Um lugar só para a regra da
   métrica, as faixas de cor e o desenho da barra — se mudar aqui, muda
   nos três, que era justamente o pedido ("tudo igual ao Planner").

   Desenhada no LAYOUT PADRÃO DO PORTAL: hero solto (número grande sem
   card), fileira de KPIs em cards --side, gráficos sem grade com o
   rótulo em cima da barra e a tabela numa VISÃO PRÓPRIA — o Resumo
   Gerencial fica só com hero + cards + gráficos (Renan, 16/08/2026).

   USO
     container.innerHTML = AderenciaView.html({dims:[…]});         // tudo junto
     container.innerHTML = AderenciaView.html({dims:[…], tabela:false});  // sem tabela
     container.innerHTML = AderenciaView.htmlTabela({dims:[…]});   // só a tabela
     AderenciaView.render(container, {linhas, dim, aoTrocarDim});  // pinta o que existir

   CADA LINHA (o painel normaliza antes de entregar)
     {
       vig:   'jul/26',              // rótulo do mês (o que aparece no eixo)
       ord:   202606,               // chave de ordenação (ano*100+mês)
       concl: 'Concluída' | 'Andamento' | 'Não Iniciada',
       venc:  true|false,            // fora do prazo
       dims:  {unidade:'CGR', projeto:'ROTA', conta:'Combustíveis'}
     }

   Precisa do Chart.js 4 na página (mesmo CDN do FCA Gerencial).
   ============================================================ */
(function (global) {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const claroAgora = () => document.body.classList.contains('light-mode')
                        || document.body.classList.contains('claro');

  // ── faixas de cor: lidas do CSS, para o claro poder usar os tons fortes ──
  function band(p) {
    const cs = getComputedStyle(document.body), v = n => cs.getPropertyValue(n).trim();
    if (p == null) return v('--band-gray') || '#555555';
    if (p < 70)    return v('--band-red')  || '#FF5252';
    if (p < 85)    return v('--band-amber')|| '#F4A100';
    return           v('--band-green')|| '#3BB33B';
  }
  function bandRgba(p, a) {
    const c = band(p);
    if (c[0] !== '#' || c.length < 7) return c;
    return `rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},${a})`;
  }
  const pct  = v => v == null ? '—' : Math.round(v) + '%';
  const pct1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%';

  // ── métrica: a mesma conta do FCA Gerencial ──
  // total = (concluídas*100 + em andamento*50) / total de ações
  function metrics(rows) {
    const tt = rows.length;
    let noP = 0, venc = 0, concl = 0, andam = 0, nini = 0;
    rows.forEach(o => {
      o.venc ? venc++ : noP++;
      if (o.concl === 'Concluída') concl++;
      else if (o.concl === 'Andamento') andam++;
      else nini++;
    });
    return {
      tt, noP, venc, concl, andam, nini,
      pPrazo: tt ? noP / tt * 100 : null,
      pConcl: tt ? concl / tt * 100 : null,
      total:  tt ? (concl * 100 + andam * 50) / tt : null,
    };
  }

  // ── meses do eixo: do 1º ao último com dado, sem buraco no meio ──
  function meses(linhas) {
    const m = new Map();
    linhas.forEach(o => { if (o.ord) m.set(o.ord, o.vig); });
    if (!m.size) return [];
    const ords = [...m.keys()].sort((a, b) => a - b);
    const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const saida = [];
    for (let o = ords[0]; o <= ords[ords.length - 1]; o = (o % 100 === 11) ? (Math.floor(o/100)+1)*100 : o + 1) {
      saida.push({ ord: o, lbl: m.get(o) || (MES[o % 100] + '/' + String(Math.floor(o/100)).slice(2)) });
    }
    return saida;
  }

  // META da aderência = a faixa "Adequado" (≥ 85%). Vira a linha tracejada
  // do gráfico, como a meta do Painel KM.
  const META = 85;

  // rótulo em cima da barra — padrão do Painel KM (eixo Y some, o número fica
  // na barra; 700 14px, 8px no celular; só nos meses em foco)
  const barLabels = {
    id: 'aderencia-bar-labels',
    afterDatasetsDraw(c) {
      const ds = c.data.datasets[0], m = c.getDatasetMeta(0), ctx = c.ctx;
      const mob = window.innerWidth < 768;
      ctx.save();
      ctx.font = `700 ${mob ? 8 : 14}px Montserrat`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = claroAgora() ? '#333333' : '#F1F5F9';
      m.data.forEach((b, i) => {
        const v = ds.data[i];
        if (v == null) return;
        if (ds._on && !ds._on[i]) return;   // mês fora do filtro: barra apagada, sem rótulo
        ctx.fillText(Math.round(v) + '%', b.x, b.y - 4);
      });
      ctx.restore();
    },
  };

  const _charts = {};   // canvasId -> instância, para destruir antes de redesenhar

  // Desenho do gráfico de barra PADRÃO (o do Painel KM, escolhido pelo Renan
  // em 09/09/2026, aplicado aqui em 05/10/2026): barra translúcida (.65) com
  // contorno sólido e cantos de 3px, cor pela faixa, linha de META tracejada,
  // eixo Y escondido a partir do zero, sem grade, rótulo em cima da barra.
  // `foco` = quais meses estão selecionados no filtro de vigência: o escolhido
  // fica mais forte (.85) e o resto vira contexto (.2).
  function grafico(canvasId, labels, data, foco) {
    const cv = document.getElementById(canvasId);
    if (!cv || typeof Chart === 'undefined') return;
    const claro = claroAgora();
    const mob = window.innerWidth < 768;
    const temFoco = !!(foco && foco.some(f => !f) && foco.some(f => f));
    const aceso = i => !temFoco || foco[i];
    const bg = data.map((v, i) => v == null ? 'transparent'
      : bandRgba(v, temFoco ? (aceso(i) ? .85 : .2) : .65));
    const bc = data.map(v => v == null ? 'transparent' : band(v));
    const metaC = claro ? '#1a1a1a' : '#F1F5F9';
    const metaD = data.map(v => v == null ? null : META);
    // fonte do eixo do Painel KM (15px) quando o card é largo; os dois gráficos
    // dividem a linha, então em tela menor ela desce para o mês não girar
    const larg = cv.parentElement ? cv.parentElement.clientWidth : 800;
    const tick = { color: claro ? '#444444' : '#94A3B8', maxRotation: 0, autoSkip: false,
      font: { family: 'Montserrat', size: mob ? 9 : (larg >= 700 ? 15 : larg >= 520 ? 12 : 10) } };
    const tooltip = { backgroundColor: '#141B26', titleColor: '#F97316', bodyColor: '#F1F5F9',
      borderColor: '#1E2D40', borderWidth: 1,
      titleFont: { family: 'Montserrat' }, bodyFont: { family: 'Montserrat' },
      callbacks: { label: c => (c.datasetIndex ? 'Meta ' : '') + Math.round(c.raw) + '%' } };
    if (_charts[canvasId]) _charts[canvasId].destroy();
    _charts[canvasId] = new Chart(cv, {
      type: 'line',
      data: { labels, datasets: [
        { type: 'bar', label: 'Aderência', data, backgroundColor: bg, borderColor: bc,
          borderWidth: 1, borderRadius: 3, order: 2, _on: data.map((_, i) => aceso(i)) },
        { type: 'line', label: 'Meta ' + META + '%', data: metaD, borderColor: metaC, borderWidth: 2,
          tension: 0, fill: false, borderDash: [5, 3], order: 1,
          pointRadius: data.map(v => v == null ? 0 : 3), pointBackgroundColor: metaC,
          pointBorderColor: metaC, pointBorderWidth: 0, pointHoverRadius: 8 },
      ] },
      plugins: [barLabels],
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 30 } },
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip,
        },
        scales: {
          x: { grid: { display: false }, ticks: tick },
          y: { display: false, beginAtZero: true, suggestedMax: 100 },
        },
      },
    });
  }

  // ── markup ──
  function blocoToggle(dims) {
    return dims.length > 1
      ? `<div class="adv-toggle">${dims.map((d, i) =>
          `<button class="adv-dim${i ? '' : ' on'}" data-dim="${esc(d.k)}">${esc(d.rot)}</button>`).join('')}</div>`
      : '';
  }

  function htmlTabela(opts) {
    const dims = (opts && opts.dims) || [];
    return `<div class="adv-tsec">
      <div class="adv-thead">
        <div><div class="adv-ttit" data-adv="tbl-titulo">Aderência</div>
             <div class="adv-tsub" data-adv="tbl-sub">Da menor aderência para a maior</div></div>
        ${blocoToggle(dims)}
      </div>
      <div class="adv-twrap"><table class="adv-table"><thead><tr>
        <th data-adv="th-dim">—</th><th class="num">TT Ações</th><th class="num">Concluídas</th>
        <th class="num">No Prazo</th><th class="num">Conclusão</th><th class="num">Prazo</th><th class="num">Aderência</th>
      </tr></thead><tbody data-adv="tbody"></tbody></table></div>
    </div>`;
  }

  function html(opts) {
    const comTabela = !(opts && opts.tabela === false);
    return `<div class="adv">
      <div class="adv-hero">
        <div class="adv-hlbl">Aderência Total</div>
        <div class="adv-hval" data-adv="total">—</div>
        <div class="adv-hdel">
          <div>Aderência ao Prazo<b data-adv="prazo">—</b></div>
          <div>Aderência à Conclusão<b data-adv="concl">—</b></div>
        </div>
        <div class="adv-faixas">
          <span><i style="background:var(--band-red,#FF5252)"></i>&lt; 70% — Crítico</span>
          <span><i style="background:var(--band-amber,#F4A100)"></i>≥ 70% e &lt; 85% — Atenção</span>
          <span><i style="background:var(--band-green,#3BB33B)"></i>≥ 85% — Adequado</span>
        </div>
      </div>

      <div class="adv-kpis">
        <div class="adv-kpi"><div class="kl">Total de Ações</div><div class="kv" data-adv="k-tt">—</div><div class="km" data-adv="m-tt">—</div></div>
        <div class="adv-kpi k-verde"><div class="kl">Concluídas</div><div class="kv" data-adv="k-concl">—</div><div class="km" data-adv="m-concl">—</div></div>
        <div class="adv-kpi k-ambar"><div class="kl">Em Andamento</div><div class="kv" data-adv="k-andam">—</div><div class="km" data-adv="m-andam">—</div></div>
        <div class="adv-kpi k-vermelho"><div class="kl">Não Iniciadas</div><div class="kv" data-adv="k-nini">—</div><div class="km" data-adv="m-nini">—</div></div>
        <div class="adv-kpi k-verde"><div class="kl">No Prazo</div><div class="kv" data-adv="k-nop">—</div><div class="km" data-adv="m-nop">—</div></div>
        <div class="adv-kpi k-vermelho"><div class="kl">Fora do Prazo</div><div class="kv" data-adv="k-venc">—</div><div class="km" data-adv="m-venc">—</div></div>
      </div>

      <div class="adv-gr2">
        <div class="adv-gcard">
          <div class="adv-gleg"><span><i class="sq"></i>Aderência</span><span><i></i>Meta ${META}%</span></div>
          <div class="adv-gtit">Aderência ao Prazo</div>
          <div class="adv-gsub">% de ações dentro do prazo, mês a mês</div>
          <div class="adv-gcv"><canvas id="adv-ch-prazo"></canvas></div>
        </div>
        <div class="adv-gcard">
          <div class="adv-gleg"><span><i class="sq"></i>Aderência</span><span><i></i>Meta ${META}%</span></div>
          <div class="adv-gtit">Aderência à Conclusão</div>
          <div class="adv-gsub">% de ações concluídas, mês a mês</div>
          <div class="adv-gcv"><canvas id="adv-ch-concl"></canvas></div>
        </div>
      </div>
      ${comTabela ? htmlTabela(opts) : ''}
    </div>`;
  }

  // ── render ──
  function render(root, opts) {
    if (!root) return;
    const linhas = (opts && opts.linhas) || [];
    const dims   = (opts && opts.dims) || [];
    const dim    = (opts && opts.dim) || (dims[0] && dims[0].k) || '';
    const rot    = (dims.find(d => d.k === dim) || {}).rot || '';
    const q = sel => root.querySelector(`[data-adv="${sel}"]`);

    const g = metrics(linhas);
    const setN = (k, v) => { const e = q(k); if (e) e.textContent = v.toLocaleString('pt-BR'); };
    const setT = (k, v) => { const e = q(k); if (e) e.textContent = v; };
    const setP = (k, v) => { const e = q(k); if (e) { e.textContent = pct(v); e.style.color = band(v); } };
    const share = n => g.tt ? Math.round(n / g.tt * 100) + '% do total' : '—';
    setP('total', g.total); setP('prazo', g.pPrazo); setP('concl', g.pConcl);
    setN('k-tt', g.tt); setN('k-concl', g.concl); setN('k-andam', g.andam);
    setN('k-nini', g.nini); setN('k-nop', g.noP); setN('k-venc', g.venc);
    setT('m-tt', g.tt ? 'no recorte atual' : '—');
    setT('m-concl', share(g.concl)); setT('m-andam', share(g.andam)); setT('m-nini', share(g.nini));
    setT('m-nop', share(g.noP));     setT('m-venc', share(g.venc));

    // A série mensal usa as linhas SEM o filtro de vigência (quando o painel as
    // manda), para os outros meses continuarem no gráfico — apagados.
    const serie = (opts && opts.linhasMes) || linhas;
    const sel   = (opts && opts.vigsSel) || [];
    const ms = meses(serie);
    const labels = ms.map(m => m.lbl);
    const foco = ms.map(m => !sel.length || sel.includes(m.lbl));
    const porMes = m => metrics(serie.filter(o => o.ord === m.ord));
    grafico('adv-ch-prazo', labels, ms.map(m => porMes(m).pPrazo), foco);
    grafico('adv-ch-concl', labels, ms.map(m => porMes(m).pConcl), foco);

    // tabela por dimensão, da pior aderência para a melhor
    const tt = q('tbl-titulo'); if (tt) tt.textContent = 'Aderência por ' + rot;
    const th = q('th-dim');     if (th) th.textContent = rot;
    const chaves = [...new Set(linhas.map(o => (o.dims || {})[dim]).filter(v => v != null && v !== ''))];
    const itens = chaves.map(k => ({ k, ...metrics(linhas.filter(o => (o.dims || {})[dim] === k)) }))
      .sort((a, b) => (a.total == null ? 999 : a.total) - (b.total == null ? 999 : b.total)
                   || String(a.k).localeCompare(String(b.k), 'pt'));
    const ts = q('tbl-sub');
    if (ts) ts.textContent = itens.length
      ? `${itens.length} ${itens.length === 1 ? 'linha' : 'linhas'} · da menor aderência para a maior`
      : 'Da menor aderência para a maior';
    const tb = q('tbody');
    if (tb) tb.innerHTML = itens.length
      ? itens.map(it => `<tr>
          <td class="nome">${esc(it.k)}</td>
          <td class="num">${it.tt}</td>
          <td class="num">${it.concl}</td>
          <td class="num">${it.noP}</td>
          <td class="num" style="color:${band(it.pConcl)};font-weight:800">${pct(it.pConcl)}</td>
          <td class="num" style="color:${band(it.pPrazo)};font-weight:800">${pct(it.pPrazo)}</td>
          <td class="num"><span class="adv-pct" style="background:${band(it.total)}${it.total!=null&&it.total<70?';color:#fff':''}">${pct(it.total)}</span></td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="adv-vazio">Nenhuma ação com os filtros atuais.</td></tr>';

    // troca de dimensão (Unidade ⇄ Projeto ⇄ Conta, Assunto ⇄ Pessoa…)
    root.querySelectorAll('.adv-dim').forEach(b => {
      b.classList.toggle('on', b.dataset.dim === dim);
      if (!b._lig) {
        b._lig = true;
        b.addEventListener('click', () => {
          if (opts && typeof opts.aoTrocarDim === 'function') opts.aoTrocarDim(b.dataset.dim);
        });
      }
    });
  }

  global.AderenciaView = { html, htmlTabela, render, metrics, band, bandRgba, pct };
})(window);
