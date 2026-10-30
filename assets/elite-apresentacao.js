// ============================================================
// Call de Resultados do Frota de Elite — "Gerar apresentação" (Renan, 30/10/2026)
//
// Monta o PDF da call no layout clean do DriverPro, com a temática do Frota
// de Elite: primeiro os indicadores gerais, depois as premiações (do mês
// fechado e do acumulado) e, no fim, os recados do mês vigente tirados do
// Gestão à Vista. Os números são os do painel: GerotBase.load({fundir:true})
// + a mesma pontuação (pesos, teto de 100 por indicador, peso de quem não tem
// o indicador redistribuído) e o acumulado do GerotBase.acumFor.
//
// O Gestão à Vista roda o farol-frota/farol-core.js num iframe da mesma
// origem: ele declara constantes globais (DATA, _n, toggleMs, buildMsFilter…)
// que colidiriam com as do painel. Os recados usam o unitStats() de lá, o
// mesmo número do Ranking do Gestão à Vista, só em contagem por unidade.
//
// API: EliteApresentacao.html(D, opts) → documento HTML (puro, roda também no
//      Node, para conferência); coleta(opts) → D; gerar(opts) → baixa o PDF.
// ============================================================
(function () {
  const OURO = '#C7861B', VERDE = '#1E8E5A', AMAR = '#D9A400', VERM = '#D83A2E';
  const INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6';
  const F = ['disp', 'prev', 'comb', 'pneus', 'checkT', 'checkWH', 'conf', 'stVeic', 'stEmp', 'sla', 'civf'];
  const LAB = { disp: 'Disponibilidade', prev: 'Preventivas', comb: 'Combustível', pneus: 'Pneus', checkT: 'Checklist T1/T2', checkWH: 'Checklist WH', conf: 'Conformidade', stVeic: 'Stress Test Veíc.', stEmp: 'Stress Test Emp.', sla: 'SLA Manutenção', civf: 'CIVF' };
  const CUR = { disp: 'Disp.', prev: 'Prev.', comb: 'Comb.', pneus: 'Pneus', checkT: 'Check T1/T2', checkWH: 'Check WH', conf: 'Conf.', stVeic: 'Stress V.', stEmp: 'Stress E.', sla: 'SLA', civf: 'CIVF' };
  const PESO = { disp: 20, prev: 15, comb: 10, pneus: 10, checkT: 10, checkWH: 10, conf: 5, stVeic: 5, stEmp: 5, sla: 5, civf: 5 };
  const UNIDS = ['MACACU', 'CDD PELOTAS', 'CDD RONDONOPOLIS', 'CDD NOVA FRIBURGO', 'CDD RIO DE JANEIRO', 'CDD FLORIANOPOLIS', 'CDD CUIABA', 'CDD GUARULHOS', 'CDD CAMBORIU', 'PIRAI EMPURRADA', 'CUIABA EMPURRADA', 'CUIABA'];
  const UN = { 'MACACU': 'Macacu', 'CDD PELOTAS': 'CDD Pelotas', 'CDD RONDONOPOLIS': 'CDD Rondonópolis', 'CDD NOVA FRIBURGO': 'CDD Nova Friburgo', 'CDD RIO DE JANEIRO': 'CDD Rio de Janeiro', 'CDD FLORIANOPOLIS': 'CDD Florianópolis', 'CDD CUIABA': 'CDD Cuiabá', 'CDD GUARULHOS': 'CDD Guarulhos', 'CDD CAMBORIU': 'CDD Camboriú', 'PIRAI EMPURRADA': 'Piraí Empurrada', 'CUIABA EMPURRADA': 'Cuiabá Empurrada', 'CUIABA': 'Cuiabá Armazém' };
  // Gestão à Vista: código do portal → nome da unidade na call
  const GAV_UN = { 'BLC': 'CDD Camboriú', 'CBA T1': 'Cuiabá Empurrada', 'CBA T1 WH': 'Cuiabá Armazém', 'CBA T2': 'CDD Cuiabá', 'CGR': 'CDD Rio de Janeiro', 'FLP': 'CDD Florianópolis', 'GRL': 'CDD Guarulhos', 'MCC T1': 'Macacu Empurrada', 'MCC T2': 'CDI Macacu', 'NFR': 'CDD Nova Friburgo', 'PIR': 'Piraí Empurrada', 'PLT': 'CDD Pelotas', 'RON': 'CDD Rondonópolis' };
  const PREMIO = [3000, 1600, 1000];
  const MESN = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
  const f1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const lista = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const avg = a => { a = a.filter(v => v != null && isFinite(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const pl = (n, s, p) => n === 1 ? s : (p || s + 's');

  // pontuação = a do painel (calcScore_): teto de 100 por indicador e o peso
  // de quem não tem o indicador redistribuído
  const score = f => { let n = 0, d = 0; F.forEach(k => { const v = f[k]; if (v == null) return; const w = PESO[k] / 100; d += w; n += w * Math.min(1, v / 100); }); return d > 0 ? n / d * 100 : null; };
  const linhas = rs => { const m = new Map();
    rs.forEach(r => { if (!UNIDS.includes(r.unit)) return; const k = (r.vig || 'acum') + '|' + r.unit;
      if (!m.has(k)) m.set(k, { vig: r.vig || 'acum', unit: r.unit, f: {} }); m.get(k).f[r.field] = r.atg; });
    return [...m.values()].map(o => Object.assign({ vig: o.vig, unit: o.unit }, Object.fromEntries(F.map(k => [k, o.f[k] == null ? null : o.f[k]])), { pont: score(o.f) })); };

  // ── CSS: base do DriverPro (docs/driverpro-apresentacao/base.css) + o que os decks usam, com o ouro do Frota de Elite ──
  const CSS = `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff}
body{font-family:'Montserrat',Arial,sans-serif;color:${INK};font-size:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide{width:1280px;height:720px;position:relative;overflow:hidden;background:#fff;page-break-after:always;break-after:page;padding:56px 72px 60px;display:flex;flex-direction:column;justify-content:center}
.slide>*{flex:0 0 auto}
.slide:last-child{page-break-after:auto}
.slide.top{justify-content:flex-start}
.slide.dark{background:radial-gradient(70% 90% at 85% 10%,rgba(199,134,27,.16),transparent 60%),#0F1216;color:#F4F5F7}
.kicker{font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:${OURO};margin-bottom:10px}
h1{font-size:42px;font-weight:800;line-height:1.1;letter-spacing:-.8px}
.slide.dark h1{color:#fff}
h2{font-size:27px;font-weight:800;line-height:1.15;letter-spacing:-.5px;margin-bottom:6px}
p{font-size:14.5px;line-height:1.55;color:${INK2}}
.slide.dark p{color:#B9C0CA}
.sub{font-size:14px;color:${INK2};margin:0 0 6px}
.foot{position:absolute;left:72px;right:72px;bottom:26px;display:flex;justify-content:space-between;font-size:10.5px;color:${INK3};letter-spacing:.4px}
.slide.dark .foot{color:#6B7683}
.note{font-size:11px;color:${INK3};line-height:1.4;margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:auto}
table th{text-align:left;padding:7px 9px;white-space:nowrap;background:#E4E7EC;color:${INK};font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
table td{padding:6px 9px;white-space:nowrap;border-bottom:1px solid #D9DDE3;color:${INK};font-weight:500}
table.compacta{font-size:11.5px} table.compacta th{padding:6px 7px} table.compacta td{padding:5px 7px}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums} td.w,th.w{white-space:normal}
tr.sep td{border-top:2px solid ${INK3}}
.cards{display:grid;gap:12px;margin-top:10px} .card{background:${PALE};border-radius:14px;padding:16px 18px;min-width:0}
.card .k{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${INK3};margin-bottom:6px}
.card .n{font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.05;color:${INK};white-space:nowrap} .card .n.acc{color:${OURO}} .card .n small{font-size:13px;font-weight:700;letter-spacing:0}
.card p{font-size:12px;line-height:1.45;color:${INK2};margin-top:7px}
.conc,.concb{margin-top:12px;background:${PALE};border-radius:12px;padding:12px 18px 13px}
.lbl{font-size:10.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${OURO}}
.conc .lbl{margin-bottom:3px} .conc p{font-size:12.5px;line-height:1.48;color:${INK}}
.concb .lbl{margin-bottom:6px} .concb .cb{display:grid;gap:8px 18px}
.concb .t{font-size:11.5px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.4px}
.concb .v{font-size:19px;font-weight:800;color:${OURO};line-height:1.15;margin:2px 0}
.concb .s{font-size:11.5px;line-height:1.42;color:${INK2}}
.duas{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px;align-items:start}`;

  function html(D, opts) {
    opts = opts || {};
    const AV = opts.av || 'avatares/';
    const AVATAR = opts.avatares || {}, GESTOR = opts.nomes || {};
    const LOGO = opts.logo || AV + 'logo_frota.webp';
    const V = D.vigs, VU = V[V.length - 1], VA = V[V.length - 2] || V[0];
    const mI = v => +v.slice(5) - 1, mN = v => MESN[mI(v)], m3 = v => MES3[mI(v)] + '/' + v.slice(2, 4);
    const Mes = MESN[mI(VU)][0].toUpperCase() + MESN[mI(VU)].slice(1), ANO = VU.slice(0, 4);
    const rows = v => D.mes.filter(r => r.vig === v);
    const rk = rs => rs.slice().sort((a, b) => (b.pont == null ? -1 : b.pont) - (a.pont == null ? -1 : a.pont));
    const pos = rs => Object.fromEntries(rk(rs).map((r, i) => [r.unit, i + 1]));
    const indMes = (f, v) => avg(rows(v).map(r => f === 'pont' ? r.pont : r[f]));
    const acum = D.acum[VU] || [], acumA = D.acum[VA] || [];
    const indAc = (f, rs) => avg((rs || acum).map(r => f === 'pont' ? r.pont : r[f]));
    const cor = v => v == null ? INK3 : v >= 95 ? VERDE : v >= 85 ? AMAR : VERM;
    const fundo = v => v == null ? '' : v >= 95 ? 'background:rgba(30,142,90,.13)' : v >= 85 ? 'background:rgba(217,164,0,.16)' : 'background:rgba(216,58,46,.14)';
    const sgn = v => (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + f1(Math.abs(v));
    const seta = v => v > 0.05 ? `<span style="color:${VERDE};font-weight:800">▲ ${f1(v)}</span>` : v < -0.05 ? `<span style="color:${VERM};font-weight:800">▼ ${f1(-v)}</span>` : `<span style="color:${INK3}">= 0,0</span>`;
    const posSeta = d => d > 0 ? `<span style="color:${VERDE};font-weight:800">▲ ${d}</span>` : d < 0 ? `<span style="color:${VERM};font-weight:800">▼ ${-d}</span>` : `<span style="color:${INK3}">=</span>`;
    const pct0 = v => v == null ? '—' : Math.round(v) + '%';

    let N = 1; const S = [];
    const rodape = `Frota de Elite · Call de Resultados · ${Mes}/${ANO}`;
    const foot = () => `<div class="foot"><span>${rodape}</span><span>${N++}</span></div>`;
    const slide = (inner, o) => S.push(`<section class="slide${o && o.top ? ' top' : ''}${o && o.dark ? ' dark' : ''}">${inner}${foot()}</section>`);
    const head = (k, h, sub) => `<div class="kicker">${k}</div><h2>${h}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}`;
    const conc = (txt, rot) => `<div class="conc"><div class="lbl">${rot || 'Leitura'}</div><p>${txt}</p></div>`;
    const concBlocos = (itens, rot, cols) => `<div class="concb"><div class="lbl">${rot}</div><div class="cb" style="grid-template-columns:repeat(${cols || itens.length},minmax(0,1fr))">${itens.map(b => `<div><div class="t">${b.t}</div>${b.v ? `<div class="v">${b.v}</div>` : ''}<div class="s">${b.s || ''}</div></div>`).join('')}</div></div>`;
    const tabela = ({ cols, rows: rr, classe, style }) => {
      const th = cols.map(c => `<th class="${c.n ? 'n' : ''}${c.w ? ' w' : ''}">${c.t}</th>`).join('');
      const tr = r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((v, i) => { const c = cols[i] || {}; const o = v !== null && typeof v === 'object' && !Array.isArray(v) ? v : { v }; return `<td class="${c.n ? 'n' : ''}${c.w ? ' w' : ''}"${o.style ? ` style="${o.style}"` : ''}>${o.v}</td>`; }).join('')}</tr>`;
      return `<table class="${classe || 'compacta'}" style="${style || ''}"><tr>${th}</tr>${rr.map(tr).join('')}</table>`;
    };
    const logoEl = h => `<img src="${LOGO}" style="height:${h}px;width:auto">`;
    const capaSec = (num, h1, texto) => slide(`<div style="display:flex;align-items:center;gap:44px">${logoEl(150)}<div><div class="kicker">Parte ${num}</div><h1 style="max-width:900px">${h1}</h1>${texto ? `<p style="margin-top:18px;font-size:16px;max-width:820px">${texto}</p>` : ''}</div></div>`, { dark: true });

    // ── números do mês ──
    const RU = rk(rows(VU)), RA = rows(VA), PA = pos(RA), PU = pos(rows(VU));
    const pontU = indMes('pont', VU), pontA = indMes('pont', VA), pont1 = indMes('pont', V[0]);
    const verdes = RU.filter(r => r.pont >= 95).length, verm = RU.filter(r => r.pont < 85).length;
    const indU = Object.fromEntries(F.map(f => [f, indMes(f, VU)])), indA = Object.fromEntries(F.map(f => [f, indMes(f, VA)]));
    const temInd = f => indU[f] != null;
    const indVerde = F.filter(f => temInd(f) && indU[f] >= 95), indAm = F.filter(f => temInd(f) && indU[f] >= 85 && indU[f] < 95), indVm = F.filter(f => temInd(f) && indU[f] < 85);
    const acP = indAc('pont'), acPA = indAc('pont', acumA);
    const RAc = rk(acum);
    const serie = V.map(v => indMes('pont', v));
    const maxV = Math.max(...serie), maxMes = V[serie.indexOf(maxV)];
    const altasN = V.slice(1).filter((v, i) => serie[i + 1] > serie[i]).length;
    let seg = 0; for (let i = serie.length - 1; i > 0 && serie[i] > serie[i - 1]; i--) seg++;
    const primeiraVerde = pontU >= 95 && serie.slice(0, -1).every(x => x < 95);
    const ofens = RU.flatMap(r => F.filter(f => r[f] != null && r[f] < 85).map(f => ({ u: r.unit, f, v: r[f] })));
    const porInd = F.map(f => ({ f, l: ofens.filter(o => o.f === f).sort((a, b) => a.v - b.v) })).filter(x => x.l.length).sort((a, b) => b.l.length - a.l.length);
    const pior = F.map(f => ({ f, d: indU[f] - indA[f] })).filter(x => isFinite(x.d) && x.d < -0.05).sort((a, b) => a.d - b.d);

    // ═══ 1 · capa ═══
    const temGav = D.gav && D.gav.unid && D.gav.unid.length;
    const mesGav = temGav ? MESN[new Date(D.gav.gerado).getMonth()] : '';
    slide(`<div style="display:flex;align-items:center;gap:56px">${logoEl(300)}<div>
      <div class="kicker">Call de Resultados</div>
      <h1 style="font-size:50px">Frota de Elite<br>${Mes}/${ANO}</h1>
      <p style="margin-top:22px;font-size:17px;max-width:600px">Os indicadores do programa em ${mN(VU)} e no ano, as premiações de ${mN(VU)} e do acumulado${temGav ? ` e os recados de ${mesGav} pelo Gestão à Vista` : ''}.</p></div></div>`, { dark: true });

    // ═══ 2 · visão geral (sem nomear quem lidera: as premiações vêm depois) ═══
    slide(`${head('Visão geral', `${Mes}: ${f1(pontU)} pontos de média${pontU >= maxV - 1e-9 ? ', a maior pontuação do ano' : ''}`, `Média das ${RU.length} unidades do programa, pela mesma conta do painel Frota de Elite (pesos por indicador, teto de 100 por indicador).`)}
      <div class="cards" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${[
          { k: `Pontuação média · ${m3(VU)}`, n: f1(pontU), p: `${seta(pontU - pontA)} contra ${m3(VA)} (${f1(pontA)}) e ${seta(pontU - pont1)} desde ${m3(V[0])} (${f1(pont1)}).`, acc: 1 },
          { k: `Acumulado ${m3(V[0])}–${m3(VU)}`, n: f1(acP), p: acumA.length ? `${seta(acP - acPA)} contra o acumulado até ${m3(VA)} (${f1(acPA)}).` : '' },
          { k: 'Unidades no verde (≥ 95)', n: `${verdes} <small>de ${RU.length}</small>`, p: `${RU.filter(r => r.pont >= 85 && r.pont < 95).length} entre 85 e 95 · ${verm} abaixo de 85. Em ${m3(VA)} eram ${RA.filter(r => r.pont >= 95).length} no verde.` },
          { k: 'Indicadores no verde (média ≥ 95)', n: `${indVerde.length} <small>de ${F.filter(temInd).length}</small>`, p: `No amarelo: ${lista(indAm.map(f => LAB[f])) || '—'}. No vermelho: ${lista(indVm.map(f => LAB[f])) || '—'}.` },
        ].map(c => `<div class="card"><div class="k">${c.k}</div><div class="n${c.acc ? ' acc' : ''}">${c.n}</div><p>${c.p}</p></div>`).join('')}
      </div>
      ${concBlocos([
        { t: 'O cenário', s: `${sgn(pontU - pont1)} pontos desde ${mN(V[0])}: a média sai de ${f1(pont1)} e chega a ${f1(pontU)}, com alta em ${altasN} dos ${V.length - 1} meses.` },
        { t: 'O marco', s: primeiraVerde ? `Pela primeira vez a média da rede passou de 95: ${verdes} de ${RU.length} unidades no verde, contra ${RA.filter(r => r.pont >= 95).length} em ${mN(VA)}.` : `${verdes} de ${RU.length} unidades no verde em ${mN(VU)}, contra ${RA.filter(r => r.pont >= 95).length} em ${mN(VA)}.` },
        { t: 'O ponto de atenção', s: porInd.length ? `${ofens.length} ${pl(ofens.length, 'resultado')} abaixo de 85 em ${mN(VU)}, ${porInd[0].l.length} deles em ${LAB[porInd[0].f]}.` : `Nenhum resultado abaixo de 85 em ${mN(VU)}.` },
      ], 'Leitura do mês', 3)}`);

    // ═══ gráficos ═══
    function colunas(vals, o) {
      o = o || {}; const w = 1136, h = o.h || 300, lo = o.lo == null ? 50 : o.lo;
      const pad = { l: 40, r: 20, t: 28, b: 34 }, bw = (w - pad.l - pad.r) / 12, H = h - pad.t - pad.b, Y = v => pad.t + H * (1 - (Math.max(v, lo) - lo) / (100 - lo));
      let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
      [lo, (lo + 100) / 2, 100].forEach(v => s += `<text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${f0(v)}</text>`);
      [[95, VERDE, 'Verde 95'], [85, AMAR, 'Meta base 85']].forEach(([v, c, t]) => s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}" stroke-dasharray="5 4"/><text x="${w - pad.r}" y="${Y(v) - 5}" text-anchor="end" fill="${c}" font-weight="700" font-size="10">${t}</text>`);
      MES3.forEach((m, i) => { const v = vals[i], x = pad.l + bw * i + bw * .18;
        if (v != null) s += `<rect x="${x}" y="${Y(v)}" width="${bw * .64}" height="${h - pad.b - Y(v)}" rx="3" fill="${cor(v)}" fill-opacity=".85"/><text x="${x + bw * .32}" y="${Y(v) - 6}" text-anchor="middle" font-weight="800" fill="${INK}">${f1(v)}</text>`;
        s += `<text x="${x + bw * .32}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${m}</text>`; });
      return s + '</svg>';
    }
    function dbar(itens) {
      const w = 640, lh = 30, lw = 170, mx = Math.max(...itens.map(i => Math.abs(i.v)), 1), half = (w - lw - 70) / 2, x0 = lw + half + 10;
      let s = `<svg viewBox="0 0 ${w} ${itens.length * lh + 10}" width="${w}" height="${itens.length * lh + 10}" font-family="Montserrat,Arial" font-size="12">`;
      s += `<line x1="${x0}" x2="${x0}" y1="0" y2="${itens.length * lh + 6}" stroke="${INK3}"/>`;
      itens.forEach((it, i) => { const y = 4 + i * lh, ww = half * Math.abs(it.v) / mx, neg = it.v < 0;
        s += `<text x="${lw - 10}" y="${y + lh / 2 + 4}" text-anchor="end" fill="${INK}" font-weight="600">${it.rot}</text>`;
        s += `<rect x="${neg ? x0 - ww : x0}" y="${y + 6}" width="${Math.max(ww, 1.5)}" height="${lh - 12}" rx="2" fill="${neg ? VERM : VERDE}"/>`;
        s += `<text x="${neg ? x0 - ww - 6 : x0 + ww + 6}" y="${y + lh / 2 + 4}" text-anchor="${neg ? 'end' : 'start'}" fill="${INK}" font-weight="700">${sgn(it.v)}</text>`; });
      return s + '</svg>';
    }
    function barrasInd(vals, h) {
      const w = 1136, items = F.map(f => ({ f, v: vals[f] })).filter(x => x.v != null).sort((a, b) => a.v - b.v), pad = { l: 16, r: 16, t: 22, b: 30 }, bw = (w - pad.l - pad.r) / items.length, H = h - pad.t - pad.b, lo = 40, Y = v => pad.t + H * (1 - (Math.min(Math.max(v, lo), 100) - lo) / (100 - lo));
      let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="10">`;
      [[95, VERDE], [85, AMAR]].forEach(([v, c]) => s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}" stroke-dasharray="5 4"/>`);
      items.forEach((it, i) => { const x = pad.l + bw * i + bw * .16; s += `<rect x="${x}" y="${Y(it.v)}" width="${bw * .68}" height="${h - pad.b - Y(it.v)}" rx="3" fill="${cor(it.v)}" fill-opacity=".85"/><text x="${x + bw * .34}" y="${Y(it.v) - 5}" text-anchor="middle" font-weight="800" fill="${INK}" font-size="11">${f1(it.v)}</text><text x="${x + bw * .34}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${CUR[it.f]}</text>`; });
      return s + '</svg>';
    }

    // ═══ Parte 1 · indicadores gerais ═══
    capaSec(1, 'Indicadores gerais', `A pontuação da rede no ano, os onze indicadores mês a mês, o que evoluiu, o que piorou e onde estão os ofensores.`);
    const ano = Array.from({ length: 12 }, (_, i) => { const v = V.find(x => mI(x) === i); return v ? indMes('pont', v) : null; });
    const abaixo90 = V.filter((v, i) => serie[i] < 90);
    slide(`${head('Pontuação no ano', `De ${f1(pont1)} em ${mN(V[0])} para ${f1(pontU)} em ${mN(VU)}: ${sgn(pontU - pont1)} pontos (${sgn((pontU / pont1 - 1) * 100)}%)`, 'Pontuação média das unidades, mês a mês.')}
      ${colunas(ano)}
      ${concBlocos([
        { t: 'Evolução', s: `${sgn(pontU - pont1)} pontos de ${mN(V[0])} a ${mN(VU)}, com alta em ${altasN} dos ${V.length - 1} meses${seg >= 2 ? ` e ${seg} altas seguidas desde ${mN(V[V.length - seg])}` : ''}.` },
        { t: 'Consistência', s: serie.every(x => x >= 85) ? `Acima de 85 em todos os meses.${abaixo90.length ? ` ${abaixo90.length} ${pl(abaixo90.length, 'mês', 'meses')} abaixo de 90 (${abaixo90.map(m3).join(', ')}).` : ''}` : `${serie.filter(x => x < 85).length} ${pl(serie.filter(x => x < 85).length, 'mês', 'meses')} abaixo de 85.` },
        { t: 'Pico', s: `${f1(maxV)} em ${mN(maxMes)}${primeiraVerde ? ', o primeiro mês com a média da rede no verde (95 ou mais)' : ''}.` },
      ], 'Destaques', 3)}`);

    slide(`${head('Indicadores mês a mês', 'Média das unidades em cada indicador', `Atingimento médio das unidades que têm o indicador · acumulado ${m3(V[0])}–${m3(VU)} na última coluna.`)}
      ${tabela({ cols: [{ t: 'Indicador' }, { t: 'Peso', n: 1 }].concat(V.map(v => ({ t: MES3[mI(v)], n: 1 })), [{ t: 'Acum.', n: 1 }, { t: `Δ ${MES3[mI(VA)]}→${MES3[mI(VU)]}`, n: 1 }]),
        rows: F.map(f => [`<b>${LAB[f]}</b>`, PESO[f]].concat(V.map(v => { const x = indMes(f, v); return { v: x == null ? '—' : f1(x), style: fundo(x) + ';text-align:center' }; }), [{ v: `<b>${f1(indAc(f))}</b>`, style: fundo(indAc(f)) + ';text-align:center' }, isFinite(indU[f] - indA[f]) ? seta(indU[f] - indA[f]) : '—']))
          .concat([{ cls: 'sep', c: ['<b>Pontuação</b>', ''].concat(V.map(v => { const x = indMes('pont', v); return { v: `<b>${f1(x)}</b>`, style: fundo(x) + ';text-align:center' }; }), [{ v: `<b>${f1(acP)}</b>`, style: fundo(acP) + ';text-align:center' }, seta(pontU - pontA)]) }]) })}
      ${ANO === '2026' ? '<p class="note">Conformidade mudou de régua no Ginfo em agosto (prazo de vencimento por equipamento); de janeiro a julho vale a régua antiga, e as Empurradas entram a partir de abril.</p>' : ''}`, { top: true });

    // evoluções do ano (Conformidade fica fora em 2026: mudou de régua no meio do ano)
    const evo = F.map(f => ({ f, a: indMes(f, V[0]), b: indU[f] })).filter(x => x.a != null && x.b != null && !(ANO === '2026' && x.f === 'conf')).map(x => Object.assign(x, { d: x.b - x.a })).sort((a, b) => b.d - a.d);
    function linhaInd(f, rot, queda) {
      const s = Array.from({ length: 12 }, (_, i) => { const v = V.find(x => mI(x) === i); return v ? indMes(f, v) : null; });
      const vs = V.map(v => indMes(f, v)), a = vs[0], b = vs[vs.length - 1], mx = Math.max(...vs.filter(x => x != null)), mn = Math.min(...vs.filter(x => x != null));
      const vPico = V[vs.indexOf(mx)];
      const cruza = V.findIndex((v, i) => vs[i] >= 85 && vs.slice(i).every(x => x >= 85));
      const lo = Math.max(0, Math.floor((mn - 8) / 10) * 10);
      const ur = rows(VU).filter(r => r[f] != null), abaixo = ur.filter(r => r[f] < 95);
      if (queda) {
        // quem puxou a queda: unidades que mais caíram do mês do pico até agora
        const rp = rows(vPico), qq = ur.map(r => { const x = rp.find(y => y.unit === r.unit); return x && x[f] != null ? { u: r.unit, a: x[f], b: r[f], d: r[f] - x[f] } : null; }).filter(x => x && x.d < -0.5).sort((x, y) => x.d - y.d);
        slide(`${head(rot, `${LAB[f]}: ${sgn(b - mx)} pontos contra o melhor mês do ano`, `Média das unidades no indicador, mês a mês · peso ${PESO[f]} na pontuação · pico de ${f1(mx)} em ${mN(vPico)}.`)}
          ${colunas(s, { lo, h: 290 })}
          ${concBlocos([
            { t: 'Do pico até agora', s: `De ${f1(mx)} em ${mN(vPico)} para ${f1(b)} em ${mN(VU)}. ${b >= a ? `No ano ainda está ${sgn(b - a)} contra ${mN(V[0])}.` : `Já está ${sgn(b - a)} abaixo de ${mN(V[0])}.`}` },
            { t: 'Quem puxou', s: qq.length ? `${lista(qq.slice(0, 3).map(x => `${UN[x.u]} (${pct0(x.a)} → ${pct0(x.b)})`))}.` : 'Queda espalhada, sem unidade isolada.' },
            { t: `Em ${mN(VU)}`, s: abaixo.length ? `${ur.length - abaixo.length} de ${ur.length} unidades no verde; abaixo de 95: ${abaixo.map(r => `${UN[r.unit]} (${pct0(r[f])})`).join(', ')}.` : `Todas as ${ur.length} unidades com o indicador no verde.` },
          ], 'Destaques', 3)}`);
        return;
      }
      slide(`${head(rot, `${LAB[f]}: ${sgn(b - a)} pontos de ${mN(V[0])} a ${mN(VU)} (${sgn((b / a - 1) * 100)}%)`, `Média das unidades no indicador, mês a mês · peso ${PESO[f]} na pontuação.`)}
        ${colunas(s, { lo, h: 290 })}
        ${concBlocos([
          { t: 'Evolução', s: `De ${f1(a)} (${MES3[mI(V[0])]}) a ${f1(b)} (${MES3[mI(VU)]}). Pico de ${f1(mx)} em ${mN(vPico)}.` },
          { t: 'Virada', s: cruza > 0 ? `Acima de 85 desde ${mN(V[cruza])}${vs.slice(cruza).every(x => x >= 95) ? ' e acima de 95 desde então' : ''}.` : cruza === 0 ? 'Acima de 85 em todos os meses.' : `Ainda abaixo de 85 em ${vs.filter(x => x < 85).length} meses.` },
          { t: `Em ${mN(VU)}`, s: abaixo.length ? `${ur.length - abaixo.length} de ${ur.length} unidades no verde; abaixo de 95: ${abaixo.map(r => `${UN[r.unit]} (${pct0(r[f])})`).join(', ')}.` : `Todas as ${ur.length} unidades com o indicador no verde.` },
        ], 'Destaques', 3)}`);
    }
    // evolução × involução: cada indicador contra janeiro e contra o melhor mês do ano
    // (Renan, 30/10/2026: "Faltaram indicadores que involuíram")
    const tabEvo = F.map(f => { const vs = V.map(v => indMes(f, v)); const nn = vs.filter(x => x != null); if (!nn.length) return null; const mx = Math.max(...nn); return { f, a: vs[0], b: vs[vs.length - 1], mx, vp: V[vs.indexOf(mx)], dA: vs[vs.length - 1] - vs[0], dP: vs[vs.length - 1] - mx }; }).filter(x => x && x.a != null && x.b != null);
    const invo = tabEvo.filter(x => x.dP < -0.95 && !(ANO === '2026' && x.f === 'conf')).sort((a, b) => a.dP - b.dP);
    const caiuAno = tabEvo.filter(x => x.dA < -0.05);
    slide(`${head('Evolução e involução no ano', `${tabEvo.filter(x => x.dA > 0.05).length} ${pl(tabEvo.filter(x => x.dA > 0.05).length, 'indicador subiu', 'indicadores subiram')} desde ${mN(V[0])} · ${invo.length} ${pl(invo.length, 'está', 'estão')} abaixo do melhor mês do ano`, `Média das unidades em ${m3(V[0])}, no melhor mês e em ${m3(VU)}, do que mais caiu contra o pico para o que mais subiu.`)}
      ${tabela({ cols: [{ t: 'Indicador' }, { t: m3(V[0]), n: 1 }, { t: 'Melhor mês', n: 1 }, { t: m3(VU), n: 1 }, { t: `Δ desde ${MES3[mI(V[0])]}`, n: 1 }, { t: 'Δ contra o melhor mês', n: 1 }],
        rows: tabEvo.slice().sort((a, b) => a.dP - b.dP || a.dA - b.dA).map(x => [`<b>${LAB[x.f]}</b>`, f1(x.a), `${f1(x.mx)} <span style="color:${INK3}">${MES3[mI(x.vp)]}</span>`, { v: `<b>${f1(x.b)}</b>`, style: fundo(x.b) }, seta(x.dA), x.dP < -0.05 ? seta(x.dP) : `<span style="color:${INK3}">no pico</span>`]) })}
      ${concBlocos([
        { t: 'Mais evoluíram', s: lista(evo.filter(x => x.d > 0.05).slice(0, 3).map(x => `${LAB[x.f]} ${sgn(x.d)}`)) + '.' },
        { t: 'Involuíram', s: invo.length ? `Abaixo do melhor mês: ${lista(invo.slice(0, 4).map(x => `${LAB[x.f]} ${sgn(x.dP)} (pico em ${mN(x.vp)})`))}.` : 'Nenhum indicador abaixo do melhor mês do ano.' },
        { t: 'Contra janeiro', s: caiuAno.length ? `${lista(caiuAno.map(x => `${LAB[x.f]} ${sgn(x.dA)}`))}${caiuAno.some(x => x.f === 'conf') && ANO === '2026' ? ' (Conformidade mudou de régua em agosto e as Empurradas entram em abril; não compara com janeiro)' : ''}.` : `Todos os indicadores acima de ${mN(V[0])}.` },
      ], 'Leitura', 3)}`, { top: true });
    if (evo[0] && evo[0].d > 0) linhaInd(evo[0].f, 'Indicador que mais evoluiu no ano');
    if (evo[1] && evo[1].d > 0) linhaInd(evo[1].f, '2º indicador que mais evoluiu no ano');
    if (invo[0]) linhaInd(invo[0].f, 'Indicador que mais involuiu no ano', true);
    if (invo[1]) linhaInd(invo[1].f, '2º indicador que mais involuiu no ano', true);

    // o que piorou no mês
    const quem = f => rows(VU).map(r => { const a = RA.find(x => x.unit === r.unit); return a && a[f] != null && r[f] != null ? { u: r.unit, a: a[f], b: r[f], d: r[f] - a[f] } : null; }).filter(x => x && x.d < -0.5).sort((x, y) => x.d - y.d);
    if (pior.length) {
      const p = pior[0], q = quem(p.f);
      slide(`${head('O que piorou', `${pior.length} ${pl(pior.length, 'indicador caiu', 'indicadores caíram')} de ${mN(VA)} para ${mN(VU)}`, 'Média das unidades no indicador e as unidades que mais puxaram a queda.')}
        ${tabela({ cols: [{ t: 'Indicador' }, { t: MES3[mI(VA)], n: 1 }, { t: MES3[mI(VU)], n: 1 }, { t: 'Δ', n: 1 }, { t: 'Quem puxou a queda', w: 1 }],
          rows: pior.map(pp => [`<b>${LAB[pp.f]}</b>`, f1(indA[pp.f]), { v: `<b>${f1(indU[pp.f])}</b>`, style: fundo(indU[pp.f]) }, seta(pp.d), quem(pp.f).slice(0, 4).map(x => `${UN[x.u]} ${pct0(x.a)} → ${pct0(x.b)}`).join(' · ') || '—']) })}
        ${concBlocos([
          { t: 'Maior queda', v: `${LAB[p.f]} ${sgn(p.d)}`, s: q.length ? `${q.length} ${pl(q.length, 'unidade caiu', 'unidades caíram')}; ${lista(q.slice(0, 2).map(x => `${UN[x.u]} (${pct0(x.a)} → ${pct0(x.b)})`))} ${q.length > 1 ? 'respondem' : 'responde'} pela maior parte.` : 'Queda espalhada, sem unidade isolada.' },
        ].concat(pior.slice(1, 3).map(pp => { const qq = quem(pp.f); return { t: LAB[pp.f], v: sgn(pp.d), s: qq.length ? `${lista(qq.slice(0, 2).map(x => `${UN[x.u]} (${pct0(x.a)} → ${pct0(x.b)})`))}.` : 'Queda espalhada, sem unidade isolada.' }; })), 'Leitura', 3)}`);
    }

    // ofensores
    if (ofens.length) {
      const cnt = {}; ofens.forEach(o => cnt[o.u] = (cnt[o.u] || 0) + 1);
      const topU = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2);
      const blocos = porInd.slice(0, 2).map(x => { const tot = rows(VU).filter(r => r[x.f] != null).length;
        return { t: LAB[x.f], v: `${x.l.length} de ${tot} ${pl(tot, 'unidade')}`, s: `Média de ${f1(indU[x.f])} em ${mN(VU)}. ${lista(x.l.slice(0, 3).map(o => `${UN[o.u]} (${pct0(o.v)})`))}${x.l.length > 3 ? ' e outras' : ''}.` }; });
      blocos.push({ t: 'Unidades com mais ofensores', v: topU.map(([u, n]) => `${UN[u]} ${n}`).join(' · '), s: 'Indicadores abaixo de 85 na mesma unidade no mês.' });
      slide(`${head('Ofensores do mês', `${ofens.length} ${pl(ofens.length, 'resultado')} abaixo de 85 em ${mN(VU)}`, 'Unidade e indicador com atingimento abaixo da meta base de 85, do pior para o melhor.')}
        ${tabela({ cols: [{ t: 'Indicador' }, { t: 'Unidades', n: 1 }, { t: 'Unidade (atingimento)', w: 1 }],
          rows: porInd.map(x => [`<b>${LAB[x.f]}</b>`, x.l.length, x.l.map(o => `<span style="white-space:nowrap">${UN[o.u]} <b style="color:${VERM}">${pct0(o.v)}</b></span>`).join(' · ')]) })}
        ${concBlocos(blocos, 'Leitura', 3)}`);
    }

    // comparativo: 1º mês do Termômetro (fev/26) ou o 1º mês do ano × acumulado
    const PRI = ANO === '2026' && V[1] ? V[1] : V[0];
    const rotPri = ANO === '2026' && V[1] ? '1º mês do Termômetro' : '1º mês do ano';
    const vPri = Object.fromEntries(F.map(f => [f, indMes(f, PRI)])), vAc = Object.fromEntries(F.map(f => [f, indAc(f)]));
    const faixa = vals => { const a = F.filter(f => vals[f] != null); return { v: a.filter(f => vals[f] >= 95).length, a: a.filter(f => vals[f] >= 85 && vals[f] < 95).length, r: a.filter(f => vals[f] < 85).length }; };
    const fP = faixa(vPri), fA = faixa(vAc), fU = faixa(indU);
    if (PRI !== VU) slide(`${head('Comparativo', `${MESN[mI(PRI)][0].toUpperCase() + MESN[mI(PRI)].slice(1)} (${rotPri}) contra o acumulado ${m3(V[0])}–${m3(VU)}`, 'Média das unidades em cada indicador, do menor para o maior.')}
      <div class="kicker" style="color:${INK2};margin:4px 0 0">${m3(PRI)} · ${fP.v} no verde · ${fP.a} no amarelo · ${fP.r} no vermelho</div>${barrasInd(vPri, 190)}
      <div class="kicker" style="color:${INK2};margin:6px 0 0">Acumulado ${m3(V[0])}–${m3(VU)} · ${fA.v} no verde · ${fA.a} no amarelo · ${fA.r} no vermelho</div>${barrasInd(vAc, 190)}
      ${conc(`Em ${m3(PRI)}, ${fP.r} ${pl(fP.r, 'indicador estava', 'indicadores estavam')} abaixo de 85 (${lista(F.filter(f => vPri[f] < 85).map(f => LAB[f])) || 'nenhum'}); no acumulado ${fA.r === 1 ? 'sobra' : 'sobram'} ${fA.r} (${lista(F.filter(f => vAc[f] < 85).map(f => LAB[f])) || 'nenhum'}). Em ${mN(VU)}, ${fU.v} indicadores estão no verde e ${fU.r} no vermelho (${lista(F.filter(f => indU[f] < 85).map(f => LAB[f])) || 'nenhum'}).`)}`);

    // ═══ pódio e ranking ═══
    function podio(rs, titulo, sub) {
      const t3 = rk(rs).slice(0, 3), ord = [1, 0, 2];
      const slot = i => {
        const r = t3[i]; if (!r) return '<div></div>';
        const h = i === 0 ? 280 : 230, pd = i === 0 ? 162 : i === 1 ? 140 : 124, av = AVATAR[r.unit];
        return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
          ${av ? `<img src="${av}" style="height:${h}px;width:auto;display:block;margin-bottom:8px">` : ''}
          <div style="width:${i === 0 ? 270 : 236}px;height:${pd}px;border-radius:14px 14px 0 0;background:${i === 0 ? 'linear-gradient(180deg,#2A2416,#1A1710)' : 'rgba(255,255,255,.07)'};border:1px solid ${i === 0 ? OURO : 'rgba(255,255,255,.12)'};border-bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:${i === 0 ? OURO : '#9AA3AE'}">${i + 1}º LUGAR</div>
            <div style="font-size:${i === 0 ? 24 : 20}px;font-weight:800;color:#fff">${esc(GESTOR[r.unit] || UN[r.unit])}</div>
            <div style="font-size:11px;color:#9AA3AE;letter-spacing:.5px;text-transform:uppercase">${UN[r.unit]}</div>
            <div style="font-size:${i === 0 ? 22 : 18}px;font-weight:800;color:${i === 0 ? OURO : '#E6E8EB'};margin-top:2px">${f1(r.pont)} pts</div>
            <div style="font-size:${i === 0 ? 14 : 12}px;font-weight:500;color:${i === 0 ? OURO : '#B9C0CA'}">R$ ${PREMIO[i].toLocaleString('pt-BR')}</div>
          </div></div>`;
      };
      slide(`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:-20px"><div><div class="kicker">${sub}</div><h1 style="font-size:40px">${titulo}</h1></div>${logoEl(92)}</div>
        <div style="display:grid;grid-template-columns:1fr 1.15fr 1fr;align-items:end;gap:18px;margin-top:6px;height:470px">${ord.map(slot).join('')}</div>`, { dark: true });
    }
    function ranking(rs, comp, titulo, sub, rot) {
      const R = rk(rs), P0 = pos(comp), pc = Object.fromEntries(comp.map(r => [r.unit, r.pont]));
      const cols = [{ t: '#' }, { t: 'Unidade' }].concat(F.map(f => ({ t: CUR[f], n: 1 })), [{ t: 'Pontuação', n: 1 }, { t: `Δ pts ${rot}`, n: 1 }, { t: `Posição ${rot}`, n: 1 }]);
      const body = R.map((r, i) => ({ c: [i + 1, `<b>${UN[r.unit]}</b>`].concat(F.map(f => ({ v: pct0(r[f]), style: fundo(r[f]) + ';text-align:center' })), [{ v: `<b style="color:${cor(r.pont)}">${f1(r.pont)}</b>` }, { v: pc[r.unit] != null ? seta(r.pont - pc[r.unit]) : '—' }, { v: P0[r.unit] ? `${P0[r.unit]}º → ${i + 1}º ${posSeta(P0[r.unit] - (i + 1))}` : '—' }]) }));
      return `${head(sub, titulo)}${tabela({ cols, rows: body, style: 'margin-top:8px' })}
        <p class="note">Cada célula é o atingimento do indicador (verde ≥ 95 · amarelo 85 a 94 · vermelho &lt; 85; — = a unidade não tem o indicador). Pontuação = média ponderada dos indicadores (pesos: ${F.map(f => CUR[f] + ' ' + PESO[f]).join(' · ')}), com o peso de quem não tem o indicador redistribuído.</p>`;
    }

    // ═══ Parte 2 · premiações do mês ═══
    capaSec(2, `Premiações de ${mN(VU)}`, `O pódio do mês, o ranking das ${RU.length} unidades e quem subiu ou caiu contra ${mN(VA)}.`);
    podio(rows(VU), 'Pódio Frota de Elite', `${Mes}/${ANO}`);
    slide(ranking(rows(VU), RA, `Ranking de ${mN(VU)}`, `Frota de Elite · ${m3(VU)}`, `vs ${MES3[mI(VA)]}`), { top: true });
    const mov = RU.map(r => ({ u: r.unit, d: r.pont - ((RA.find(x => x.unit === r.unit) || {}).pont), p0: PA[r.unit], p1: PU[r.unit] })).filter(m => isFinite(m.d)).sort((a, b) => b.d - a.d);
    const sobe = mov.filter(m => m.p1 < m.p0).sort((a, b) => (b.p0 - b.p1) - (a.p0 - a.p1)), cai = mov.filter(m => m.p1 > m.p0).sort((a, b) => (b.p1 - b.p0) - (a.p1 - a.p0));
    const motivo = u => { const a = RA.find(x => x.unit === u), b = rows(VU).find(x => x.unit === u); if (!a || !b) return ''; return F.filter(f => a[f] != null && b[f] != null).map(f => ({ f, d: Math.min(b[f], 100) - Math.min(a[f], 100) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 2).filter(x => Math.abs(x.d) >= 1).map(x => `${LAB[x.f]} ${sgn(x.d)}`).join(', '); };
    if (mov.length) slide(`${head('Movimento no ranking', `Quem subiu e quem caiu de ${mN(VA)} para ${mN(VU)}`, 'Variação da pontuação de cada unidade, em pontos.')}
      <div class="duas" style="align-items:center">${dbar(mov.map(m => ({ rot: UN[m.u], v: m.d })))}
        <div>${tabela({ cols: [{ t: 'Unidade' }, { t: 'Posição', n: 1 }, { t: 'O que mais mexeu', w: 1 }], rows: sobe.slice(0, 3).concat(cai.slice(0, 3)).map(m => [`<b>${UN[m.u]}</b>`, `${m.p0}º → ${m.p1}º ${posSeta(m.p0 - m.p1)}`, motivo(m.u) || '—']) })}</div></div>
      ${concBlocos([{ t: 'Maior alta', v: `${UN[mov[0].u]} ${sgn(mov[0].d)}`, s: `${motivo(mov[0].u) || 'Sem indicador isolado'}.` }]
        .concat(sobe[0] ? [{ t: 'Maior subida de posição', v: `${UN[sobe[0].u]} ${sobe[0].p0}º → ${sobe[0].p1}º`, s: `${motivo(sobe[0].u) || 'Sem indicador isolado'}.` }] : [])
        .concat(cai[0] ? [{ t: 'Maior queda de posição', v: `${UN[cai[0].u]} ${cai[0].p0}º → ${cai[0].p1}º`, s: `${motivo(cai[0].u) || 'Sem indicador isolado'}.` }] : []), 'Destaques', 3)}`);

    // ═══ Parte 3 · premiação do acumulado ═══
    if (acum.length) {
      capaSec(3, `Acumulado de ${mN(V[0])} a ${mN(VU)}`, 'O pódio do acumulado e o ranking do ano.');
      podio(acum, 'Pódio Frota de Elite', `Acumulado ${m3(V[0])}–${m3(VU)} · ${V.length} períodos`);
      slide(ranking(acum, acumA, `Ranking acumulado ${m3(V[0])}–${m3(VU)}`, 'Frota de Elite · acumulado do ano', `vs ${MES3[mI(VA)]}`), { top: true });
    }

    // ═══ Parte 4 · recados do mês vigente (Gestão à Vista) ═══
    if (temGav) {
      const G = D.gav, dt = new Date(G.gerado);
      const MesG = mesGav[0].toUpperCase() + mesGav.slice(1);
      const quando = d => d ? new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
      const U = G.unid;
      const C = [
        { k: 'dp', t: 'Disponib.', c: v => v >= 97 ? 0 : v >= 93 ? 1 : 2 },
        { k: 'pv', t: 'Preventivas', c: v => v >= 99.95 ? 0 : v >= 95 ? 1 : 2 },
        { k: 'af', t: 'Aferições', c: v => v >= 95 ? 0 : v >= 85 ? 1 : 2 },
        { k: 'al', t: 'Alinhamento', c: v => v >= 80 ? 0 : 2 },
        { k: 'sv', t: 'Stress Veíc.', c: v => v >= 99.95 ? 0 : v >= 95 ? 1 : 2 },
        { k: 'se', t: 'Stress Emp.', c: v => v >= 99.95 ? 0 : v >= 95 ? 1 : 2 },
        { k: 'cf', t: 'CIVF', c: v => v >= 99.95 ? 0 : v >= 95 ? 1 : 2 },
        { k: 'os', t: 'OS no prazo', c: v => v >= 90 ? 0 : v >= 70 ? 1 : 2 },
        { k: 'ck', t: 'Saída OS crít.', c: v => v >= 100 ? 0 : 2 },
      ].filter(c => U.some(u => u[c.k] != null));
      const FUNDO = ['background:rgba(30,142,90,.13)', 'background:rgba(217,164,0,.16)', 'background:rgba(216,58,46,.14)'];
      capaSec(4, `Recados de ${mesGav}`, `Como ${mesGav} está andando no Gestão à Vista: o que já pesa na pontuação do mês e onde agir.`);
      slide(`${head('Gestão à Vista', `${MesG} até agora, unidade a unidade`, `Foto do Gestão à Vista em ${quando(dt)}${G.ginfoAtt ? ` · última exportação do Ginfo em ${quando(G.ginfoAtt)}` : ''}.`)}
        ${tabela({ cols: [{ t: 'Unidade' }].concat(C.map(c => ({ t: c.t, n: 1 }))),
          rows: U.map(u => [`<b>${GAV_UN[u.cod] || u.cod}</b>`].concat(C.map(c => { const v = u[c.k]; return v == null ? { v: '—', style: 'text-align:center;color:' + INK3 } : { v: pct0(v), style: FUNDO[c.c(v)] + ';text-align:center' }; }))) })}
        <p class="note">Mesmas faixas do Ranking do Gestão à Vista. Disponibilidade = veículos indisponíveis agora sobre os ativos do dia · Preventivas = placas sem preventiva vencida · Aferições = placas aferidas nos últimos 30 dias · Stress Test e CIVF = sem desconto no período${G.stressPer ? ` (${G.stressPer})` : ''} · OS no prazo = abertas há até ${G.osMeta || 8} dias · Saída com OS crítica: 100% sem nenhuma no mês.</p>`, { top: true });

      // recados: só o que tem a dizer, com as unidades que mais pesam
      const n = (u, k) => (u.n && u.n[k]) || 0;
      const topo = (k, q) => U.filter(u => n(u, k) > 0).sort((a, b) => n(b, k) - n(a, k)).slice(0, q || 3).map(u => `${GAV_UN[u.cod] || u.cod} ${n(u, k)}`);
      const soma = k => U.reduce((s, u) => s + n(u, k), 0);
      const R = [];
      const indisp = soma('indisp'), ativos = soma('ativos');
      if (ativos) R.push({ ok: !indisp, t: 'Disponibilidade · peso 20', v: `${indisp} ${pl(indisp, 'veículo parado', 'veículos parados')}`, s: indisp ? `${f1((ativos - indisp) / ativos * 100)}% da frota disponível agora. Mais parados: ${topo('indisp').join(' · ')}.` : 'Nenhum veículo indisponível agora.' });
      const pv = soma('prevVenc');
      if (U.some(u => n(u, 'prevTot'))) R.push({ ok: !pv, t: 'Preventivas · peso 15', v: `${pv} ${pl(pv, 'placa vencida', 'placas vencidas')}`, s: pv ? `Cada placa vencida tira ponto do mês. ${topo('prevVenc').join(' · ')}.` : 'Nenhuma preventiva vencida.' });
      const af = U.reduce((s, u) => s + ((u.n && u.n.afTot) || 0) - ((u.n && u.n.afOk) || 0), 0);
      if (U.some(u => u.n && u.n.afTot)) R.push({ ok: !af, t: 'Pneus · peso 10', v: `${af} ${pl(af, 'placa sem aferição', 'placas sem aferição')}`, s: af ? `Placas sem aferição nos últimos 30 dias. ${U.filter(u => u.n && u.n.afTot > u.n.afOk).sort((a, b) => (b.n.afTot - b.n.afOk) - (a.n.afTot - a.n.afOk)).slice(0, 3).map(u => `${GAV_UN[u.cod] || u.cod} ${u.n.afTot - u.n.afOk}`).join(' · ')}.` : 'Todas as placas aferidas nos últimos 30 dias.' });
      const sv = soma('svDesc'), se = soma('seDesc');
      const stTop = U.map(u => ({ u, q: n(u, 'svDesc') + n(u, 'seDesc') })).filter(x => x.q > 0).sort((a, b) => b.q - a.q).slice(0, 3).map(x => `${GAV_UN[x.u.cod] || x.u.cod} ${x.q}`);
      if (U.some(u => n(u, 'svTot') || n(u, 'seTot'))) R.push({ ok: !(sv + se), t: 'Stress Test · peso 5 + 5', v: `${sv + se} com desconto`, s: sv + se ? `${sv} ${pl(sv, 'veículo')} e ${se} ${pl(se, 'empilhadeira')} com desconto no período. ${stTop.join(' · ')}.` : 'Nenhum desconto no período.' });
      const cf = soma('cfDesc');
      if (U.some(u => n(u, 'cfTot'))) R.push({ ok: !cf, t: 'CIVF · peso 5', v: `${cf} com desconto`, s: cf ? `${topo('cfDesc').join(' · ')}.` : 'Nenhum desconto de CIVF.' });
      const os = soma('osAtr');
      if (U.some(u => n(u, 'osTot'))) R.push({ ok: !os, t: 'SLA de Manutenção · peso 5', v: `${os} OS fora do prazo`, s: os ? `Abertas há mais de ${G.osMeta || 8} dias, de ${soma('osTot')} em aberto. ${topo('osAtr').join(' · ')}.` : `Nenhuma OS aberta há mais de ${G.osMeta || 8} dias.` });
      const ck = soma('chk');
      if (U.some(u => u.ck != null)) R.push({ ok: !ck, t: 'Checklist', v: `${ck} ${pl(ck, 'saída', 'saídas')} com OS crítica`, s: ck ? `${topo('chk').join(' · ')}.` : 'Nenhuma saída com OS crítica no mês.' });
      // primeiro o que pede ação; o que está em dia vira um bloco só no fim
      const prob = R.filter(r => !r.ok), emDia = R.filter(r => r.ok);
      const B = prob.slice(0, emDia.length ? 5 : 6);
      if (emDia.length) B.push({ t: 'Em dia', v: lista(emDia.map(r => r.t.split(' · ')[0])), s: emDia.map(r => r.s).join(' ') });
      if (B.length) slide(`${head('Recados', `O que fazer em ${mesGav} para não perder ponto`, `Contagens do Gestão à Vista em ${quando(dt)}, por indicador do Frota de Elite.`)}
        ${concBlocos(B, `Recados de ${mesGav}`, B.length > 4 ? 3 : 2)}`);
    }

    // ═══ conclusão ═══
    const atacar = porInd[0];
    const piorX = pior.filter(p => !atacar || p.f !== atacar.f);
    const fecha = [
      { t: 'Manter', v: `${f1(pontU)} pts`, s: `Média de ${mN(VU)}${primeiraVerde ? ' acima de 95 pela primeira vez' : ''}, com ${verdes} ${pl(verdes, 'unidade')} e ${indVerde.length} ${pl(indVerde.length, 'indicador', 'indicadores')} no verde.` },
    ];
    if (atacar) fecha.push({ t: 'Atacar', v: LAB[atacar.f], s: `${atacar.l.length} de ${rows(VU).filter(r => r[atacar.f] != null).length} unidades abaixo de 85 e média de ${f1(indU[atacar.f])} em ${mN(VU)}.` });
    if (piorX.length) fecha.push({ t: 'Recuperar', v: lista(piorX.slice(0, 2).map(p => LAB[p.f])), s: `${piorX.length > 1 ? 'Os que' : 'O que'} mais ${piorX.length > 1 ? 'caíram' : 'caiu'} em ${mN(VU)}: ${piorX.slice(0, 2).map(p => `${LAB[p.f]} ${sgn(p.d)}`).join(' · ')}.` });
    if (RAc.length >= 3) fecha.push({ t: 'Na disputa do ano', v: `${UN[RAc[0].unit]} ${f1(RAc[0].pont)}`, s: `Lidera o acumulado; ${UN[RAc[1].unit]} (${f1(RAc[1].pont)}) e ${UN[RAc[2].unit]} (${f1(RAc[2].pont)}) completam o pódio, separados por ${f1(RAc[0].pont - RAc[2].pont)} ${RAc[0].pont - RAc[2].pont < 1.95 ? 'ponto' : 'pontos'}.` });
    slide(`${head('Conclusão', `O foco de ${MESN[(mI(VU) + 1) % 12]} é manter o resultado e atacar os ofensores`)}
      ${concBlocos(fecha, 'Próximos passos', 2)}`);

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Call de Resultados · Frota de Elite · ${m3(VU)}</title><style>${CSS}</style></head><body>${S.join('\n')}</body></html>`;
  }

  // ── coleta: Frota de Elite (mesma conta do painel) ──
  async function coletaElite(ate) {
    const GB = window.GerotBase;
    if (!GB) throw new Error('GerotBase não carregou');
    const recs = await GB.load({ fundir: true });
    let mes = linhas(recs);
    // mês FECHADO = o último com pelo menos 8 dos 11 indicadores (o combustível
    // do mês corrente chega antes do Ginfo, e sozinho não fecha o mês)
    const fechado = v => F.filter(f => mes.some(r => r.vig === v && r[f] != null)).length >= 8;
    const todas = [...new Set(mes.map(r => r.vig))].filter(v => /^\d{4}-\d{2}$/.test(v)).sort();
    const VU = ate || todas.filter(fechado).pop();
    if (!VU) throw new Error('nenhum mês fechado no Frota de Elite');
    const vigs = todas.filter(v => v.slice(0, 4) === VU.slice(0, 4) && v <= VU);
    mes = mes.filter(r => vigs.includes(r.vig));
    const acum = {};
    vigs.forEach(v => { const jan = vigs.filter(x => x <= v); if (jan.length > 1) acum[v] = linhas(GB.acumFor(jan).map(r => Object.assign({}, r, { vig: null }))); });
    return { gerado: new Date().toISOString(), vigs, mes, acum };
  }

  // ── coleta: Gestão à Vista (farol-core num iframe da mesma origem) ──
  function coletaGav(o) {
    o = o || {};
    const base = o.base || new URL('../', location.href).href;
    return new Promise((ok, falha) => {
      const ifr = document.createElement('iframe');
      ifr.setAttribute('aria-hidden', 'true');
      ifr.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;visibility:hidden';
      const fim = (e, v) => { clearTimeout(tm); try { ifr.remove(); } catch (_) {} e ? falha(e) : ok(v); };
      const tm = setTimeout(() => fim(new Error('Gestão à Vista sem resposta em 3 minutos')), o.timeout || 180000);
      ifr.onload = async () => {
        try {
          const w = ifr.contentWindow;
          for (let i = 0; i < 200 && typeof w.farolLoad !== 'function'; i++) await new Promise(r => setTimeout(r, 100));
          if (typeof w.farolLoad !== 'function') throw new Error('farol-core não carregou');
          const r = await w.eval(`(async()=>{
            await farolLoad();
            const H=new Date();
            const ref=ateTerceiroDiaUtil(H)?new Date(H.getFullYear(),H.getMonth()-1,1):H;
            const P=DATA.pneus;
            const per=(DATA.stressV||[]).map(r=>r.per).filter(Boolean)[0];
            const unid=Object.keys(UNIDADES).filter(c=>c!=='GNA').map(cod=>{
              const s=unitStats(cod);
              const prev=byCod(DATA.prev,cod),sv=byCod(DATA.stressV,cod),se=byCod(DATA.stressE,cod).filter(r=>r.contratada),
                cf=byCod(DATA.cifv,cod),al=byCod(DATA.alinh,cod),os=byCod(DATA.os,cod),dp=(DATA.disp||[]).find(r=>r.cod===cod);
              const chk=byCod(DATA.chk,cod).filter(r=>_n(r.tipo).includes('SAIDA')&&r.dt&&r.dt.getMonth()===ref.getMonth()&&r.dt.getFullYear()===ref.getFullYear()).length;
              const veic=P?P.veic.filter(v=>v.cod===cod):[];
              return {cod,sv:s.sv,se:s.se,cf:s.cf,pv:s.pv,al:s.al,os:s.os,ck:s.ck,dp:s.dp,af:s.af,
                n:{prevVenc:prev.filter(r=>r.ad===0).length,prevTot:prev.length,svDesc:sv.filter(r=>r.desc>0).length,svTot:sv.length,
                  seDesc:se.filter(r=>r.d1>0||r.d2>0).length,seTot:se.length,cfDesc:cf.filter(r=>(r.dt||0)!==0).length,cfTot:cf.length,
                  alVenc:al.filter(r=>_n(r.st)==='VENCIDO').length,alTot:al.length,osAtr:os.filter(r=>(r.dias||0)>OS_META).length,osTot:os.length,
                  chk:DATA.chk?chk:0,indisp:dp?dp.indisp:0,ativos:dp?dp.ativos:0,
                  afOk:P?veic.filter(v=>(P.ult-v.dt.getTime())<=30*864e5).length:0,afTot:P?veic.length:0}};
            });
            const M=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            return {gerado:H.toISOString(),ginfoAtt:DATA.ginfoAtt?new Date(DATA.ginfoAtt).toISOString():null,osMeta:OS_META,
              stressPer:per?M[per.getMonth()]+'/'+String(per.getFullYear()).slice(2):null,unid};
          })()`);
          fim(null, r);
        } catch (e) { fim(e); }
      };
      const sup = o.supabaseSrc || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      ifr.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="${sup}"><\/script><script src="${base}assets/gviz-cache.js"><\/script><script src="${base}farol-frota/farol-core.js"><\/script></head><body></body></html>`;
      document.body.appendChild(ifr);
    });
  }

  async function coleta(o) {
    o = o || {};
    const [el, gav] = await Promise.all([coletaElite(o.ate), coletaGav(o).catch(e => { console.warn('Gestão à Vista fora da apresentação:', e); return null; })]);
    el.gav = gav;
    return el;
  }

  // ── PDF: cada slide fotografado (html2canvas) numa página 1280×720 (jsPDF) ──
  const carrega = (src, ok) => ok() ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('não carregou ' + src)); document.head.appendChild(s); });
  async function pdf(doc, nome, aviso) {
    await carrega('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', () => typeof window.html2canvas !== 'undefined');
    await carrega('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js', () => !!window.jspdf);
    const ifr = document.createElement('iframe');
    ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:720px;border:0';
    document.body.appendChild(ifr);
    try {
      await new Promise(r => { ifr.onload = r; ifr.srcdoc = doc; });
      const d = ifr.contentDocument;
      try { await d.fonts.ready; } catch (_) {}
      await Promise.all([...d.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
      const sl = [...d.querySelectorAll('.slide')];
      const pdfDoc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720], hotfixes: ['px_scaling'], compress: true });
      for (let i = 0; i < sl.length; i++) {
        if (aviso) aviso(`Montando o PDF · slide ${i + 1} de ${sl.length}…`);
        const c = await window.html2canvas(sl[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1280, windowHeight: 720 });
        if (i) pdfDoc.addPage([1280, 720], 'landscape');
        pdfDoc.addImage(c.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, 1280, 720);
      }
      pdfDoc.save(nome);
      return sl.length;
    } finally { ifr.remove(); }
  }

  async function gerar(o) {
    o = o || {};
    const aviso = o.aviso || (() => {});
    aviso('Lendo o Frota de Elite e o Gestão à Vista…');
    const D = await coleta(o);
    const VU = D.vigs[D.vigs.length - 1];
    aviso('Montando os slides…');
    const doc = html(D, o);
    const nome = `Frota_de_Elite_Call_${MESN[+VU.slice(5) - 1][0].toUpperCase() + MESN[+VU.slice(5) - 1].slice(1)}${VU.slice(0, 4)}.pdf`;
    const n = await pdf(doc, nome, aviso);
    return { slides: n, vig: VU, gav: !!D.gav, nome };
  }

  window.EliteApresentacao = { html, coleta, coletaElite, coletaGav, gerar, pdf, linhas, score };
})();
