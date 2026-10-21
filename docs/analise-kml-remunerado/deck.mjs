// ============================================================
// Deck "Consumo remunerado Km/L" — monta o HTML no layout do DriverPro
// (../driverpro-apresentacao/base.css, sem redesenhar nada) a partir do
// dados.json gerado por analise.mjs. Render em PDF: ../driverpro-apresentacao/render.mjs
//   KML_REM_DADOS=…/dados.json node deck.mjs → deck.html
// Só o REMUNERADO: nada aqui compara com o realizado (Renan, 21/10/2026:
// "não pedi comparativo com realizado. Pedi para analisar o remunerado em si").
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(process.env.KML_REM_DADOS || new URL('./dados.json', import.meta.url).pathname, 'utf8'));
const OUT = new URL('./deck.html', import.meta.url).pathname;

const ACC = '#F22C05', AZUL = '#1F6FEB', INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6';
const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f1 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
const pct = (v, d = 1) => { if (v == null || !isFinite(v)) return '—'; const z = Math.abs(v) < 0.5 / Math.pow(10, d); return (z ? '' : v > 0 ? '+' : '') + (z ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; };
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const MES = D.MESES;
// Δ no remunerado: subir = pior para nós (vermelho), cair = melhor (azul)
const sinalPct = (v, d = 1) => v == null || !isFinite(v) ? '—' : `<span style="color:${v > 0.05 ? ACC : v < -0.05 ? AZUL : INK3};font-weight:700">${pct(v, d)}</span>`;
const sinal2 = v => v == null ? '—' : `<span style="color:${v > 0.005 ? ACC : v < -0.005 ? AZUL : INK3};font-weight:700">${(v > 0 ? '+' : '') + f2(v)}</span>`;
const RODAPE = 'Consumo remunerado Km/L · análise de 2026 · Conlog';
let N = 1;
const slide = (inner, { cls = '', style = '' } = {}) => `<section class="slide ${cls}"${style ? ` style="${style}"` : ''}>${inner}<div class="foot"><span>${RODAPE}</span><span>${N++}</span></div></section>`;

// ── gráfico de linhas (SVG) ──
function lineChart({ w = 1136, h = 330, series, labels, bands = [], marks = [], yfmt = f2, pad = { l: 60, r: 30, t: 30, b: 42 } }) {
  const all = series.flatMap(s => s.data.filter(v => v != null));
  let y0 = Math.min(...all), y1 = Math.max(...all); const amp = y1 - y0 || 1; y0 -= amp * .35; y1 += amp * .3;
  const step = (w - pad.l - pad.r) / (labels.length - 1);
  const X = i => pad.l + step * i;
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="13">`;
  bands.forEach(b => { const x0 = X(b.de) - step / 2, x1 = X(b.ate) + step / 2; s += `<rect x="${x0}" y="${pad.t - 12}" width="${x1 - x0}" height="${h - pad.t - pad.b + 12}" fill="${b.fill || PALE}"/><text x="${(x0 + x1) / 2}" y="${pad.t - 18}" text-anchor="middle" font-size="12" font-weight="700" fill="${INK3}" letter-spacing="1.5">${b.label}</text>`; });
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}"/><text x="${pad.l - 10}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${yfmt(v)}</text>`; }
  labels.forEach((l, i) => { s += `<text x="${X(i)}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`; });
  marks.forEach(m => { const dir = X(m.i) > w * .8 ? -1 : 1; s += `<line x1="${X(m.i)}" x2="${X(m.i)}" y1="${pad.t}" y2="${h - pad.b}" stroke="${m.cor || INK3}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${X(m.i) + 7 * dir}" y="${pad.t + 10}" text-anchor="${dir < 0 ? 'end' : 'start'}" fill="${m.cor || INK3}" font-size="12" font-weight="700">${m.label}</text>`; });
  series.forEach(sr => {
    const pts = sr.data.map((v, i) => v == null ? null : [X(i), Y(v)]);
    let dpath = '', open = false; pts.forEach(p => { if (!p) { open = false; return; } dpath += (open ? 'L' : 'M') + p[0] + ' ' + p[1] + ' '; open = true; });
    s += `<path d="${dpath}" fill="none" stroke="${sr.cor}" stroke-width="3" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => { if (!p) return; s += `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#fff" stroke="${sr.cor}" stroke-width="2.5"/><text x="${p[0]}" y="${p[1] - 13}" text-anchor="middle" font-size="13" font-weight="700" fill="${INK}">${yfmt(sr.data[i])}</text>`; });
  });
  return s + '</svg>';
}
// ── barras verticais ──
function barChart({ w = 760, h = 300, data, labels, corFn, pad = { l: 44, r: 16, t: 28, b: 40 }, fmt = f0, destaque = [] }) {
  const max = Math.max(...data, 1);
  const bw = (w - pad.l - pad.r) / data.length;
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="12">`;
  s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${h - pad.b}" y2="${h - pad.b}" stroke="${LINE}"/>`;
  data.forEach((v, i) => { const x = pad.l + bw * i + bw * .15; s += `<rect x="${x}" y="${Y(v)}" width="${bw * .7}" height="${h - pad.b - Y(v)}" fill="${corFn(i, v)}" rx="3"/>`; if (v > 0) s += `<text x="${x + bw * .35}" y="${Y(v) - 6}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(v)}</text>`; s += `<text x="${x + bw * .35}" y="${h - 14}" text-anchor="middle" fill="${destaque.includes(i) ? ACC : INK2}" font-weight="${destaque.includes(i) ? 800 : 500}" font-size="11">${labels[i]}</text>`; });
  return s + '</svg>';
}
const escuro = txt => `<div class="box" style="background:#0F1A20"><p style="color:#F4F5F7;font-size:15px">${txt}</p></div>`;

// ═════════════════ dados derivados ═════════════════
const FORA = new Set(['PLT · AS']); // Pelotas: AS entra em Rota (Renan, 21/10/2026: "AS lá não tem nada mesmo. Entra em Rota. Tire")
const UPS = D.UPS.filter(up => !FORA.has(up));
const frotaMes = D.MES_IDX.map(m => D.frota.mes[m]?.media ?? null);
const q = D.frota.q;
const rank = D.rankUP.filter(r => !FORA.has(r.up) && r.q3 != null && r.q1 != null);
const maiorAlta = [...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[0], maiorQueda = [...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[0];
const ativOrd = D.rankUP.filter(r => !FORA.has(r.up) && r.ativMed != null).sort((a, b) => b.ativMed - a.ativMed);
const dispTot = UPS.reduce((a, up) => { const v = D.impDisp[up] || { perde: 0, ganha: 0 }; return { perde: a.perde + v.perde, ganha: a.ganha + v.ganha }; }, { perde: 0, ganha: 0 });
const kmInatPct = D.kmInatFTTot.km / D.kmInatTot.total * 100;
const fr = D.fronteiras;
const mudQz = D.QZ.map(z => fr[z.t] ? fr[z.t].mudaram : 0);
const dQ1Q3 = (q[3].media / q[1].media - 1) * 100, dQ3Q4 = (q[4].media / q[3].media - 1) * 100;
const UNIS = [...new Set(UPS.map(up => up.split(' · ')[0].replace(/ UDC| LATA/, '')))].sort();
const upsDe = u => UPS.filter(up => up.split(' · ')[0].replace(/ UDC| LATA/, '') === u);
const nomeU = u => D.NOME[u] || u;

const S = [];

// ── 1 · CAPA ──
S.push(`<section class="slide dark" style="display:flex;flex-direction:column;justify-content:center;">
  <div class="logo" style="margin-bottom:38px"><div class="ic"><svg viewBox="0 0 48 48" fill="none"><path d="M12 30a12 12 0 1 1 24 0" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M24 30l7-8" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="24" cy="30" r="2.4" fill="#fff"/></svg></div><div class="nm">Km/L <b>Remunerado</b></div></div>
  <div class="kicker">Freightech · consumo remunerado · 2026</div>
  <h1 style="max-width:980px">O consumo remunerado de Km/L<br>em 2026: duas revisões, uma<br>que não aconteceu.</h1>
  <p style="margin-top:26px;font-size:18px;max-width:820px">Planilha do FT: ${f0(D.totais.linhas)} linhas, ${D.totais.placas} placas, ${UPS.length} unidade-projeto, 1ª quinzena de janeiro a 2ª de outubro. Quatro perguntas, na ordem de importância: a revisão do 4º trimestre, placas do mesmo modelo com valores diferentes, o efeito da ativação na média e os demais erros do cadastro. Campo Grande (tanque interno/SUMA) fica fora: é assunto do limpa-pauta.</p>
  <div class="foot"><span>Gestão em Movimento · Fortes Indicadores</span><span>Outubro de 2026</span></div>
</section>`);
N = 2;

// ── 2 · RESUMO EM QUATRO NÚMEROS ──
S.push(slide(`
  <div class="kicker">Resumo</div>
  <h2>O ano em quatro números</h2>
  <div class="grid g4" style="margin-top:28px;gap:18px">
    <div class="box"><div class="lbl">1 · Revisão do 4º tri</div><div class="num">0 <small style="font-size:20px">de ${D.q3q4.iguais}</small></div><p>placas mudaram de valor na 1ª quinzena de outubro. Nas duas revisões do ano mudaram ${fr[6].mudaram} (1ª abr) e ${fr[12].mudaram} (1ª jul). O 4º tri roda com a régua do 3º.</p></div>
    <div class="box"><div class="lbl">Remunerado da frota · Q1 → Q3</div><div class="num" style="color:${dQ1Q3 > 0.5 ? ACC : dQ1Q3 < -0.5 ? AZUL : INK}">${pct(dQ1Q3)}</div><p>${f2(q[1].media)} → ${f2(q[3].media)} km/L, média simples das placas ativas. No total quase nada mudou; nas operações vai de ${pct(maiorQueda.dQ1Q3, 0)} (${esc(maiorQueda.up)}) a ${pct(maiorAlta.dQ1Q3, 0)} (${esc(maiorAlta.up)}).</p></div>
    <div class="box"><div class="lbl">2 · Mesmo modelo, valores diferentes</div><div class="num">${D.dispRes.comDif} <small style="font-size:20px">de ${D.dispRes.grupos}</small></div><p>grupos modelo-mês com placas do mesmo modelo recebendo valores diferentes na mesma operação. Saldo contra nós: ${f0(dispTot.perde - dispTot.ganha)} L em 9 meses.</p></div>
    <div class="box"><div class="lbl">3 · Efeito da ativação</div><div class="num">+${f2(ativOrd[0].ativMed)}</div><p>km/L é o quanto a ativação sobe a média, no máximo (${esc(ativOrd[0].up)}). Na maioria das operações o efeito é zero. Não há padrão de ativar as melhores placas.</p></div>
  </div>
  ${`<div style="margin-top:22px">${escuro(`<b>4 · Erros do cadastro:</b> ${D.erros.ativasZero.length} linhas de placa ativa com consumo zero (todas na 1ª quinzena de abril, nas Empurradas), uma placa a 0,67 km/L em Piraí, placa "TESTE" ativa o ano inteiro, ${D.erros.duplaGrafia.length} placas em duas grafias e ${D.mudancasCiclo} mudanças de valor fora da revisão.`)}</div>`}`));

// ── 3 · VISÃO GERAL DO ANO ──
S.push(slide(`
  <div class="kicker">Visão geral do ano · média simples das placas ativas no FT</div>
  <h2>Duas revisões no ano, em abril e em julho. Em outubro, nenhuma.</h2>
  ${lineChart({ h: 290, labels: MES.slice(0, 10).map(m => m.toUpperCase()), series: [{ data: frotaMes, cor: ACC }],
    bands: [{ de: 0, ate: 2, label: 'Q1' }, { de: 3, ate: 5, label: 'Q2', fill: '#fff' }, { de: 6, ate: 8, label: 'Q3' }, { de: 9, ate: 9, label: 'Q4', fill: '#fff' }],
    marks: [{ i: 3, label: `revisão · 1ª abr · ${fr[6].mudaram} placas` }, { i: 6, label: `revisão · 1ª jul · ${fr[12].mudaram} placas` }, { i: 9, label: 'sem revisão', cor: ACC }] })}
  <div class="grid g3" style="margin-top:10px;gap:18px">
    <div class="box" style="padding:16px 20px"><div class="lbl">Frota · Q1 → Q2 → Q3 → Q4</div><div class="num" style="font-size:28px">${f2(q[1].media)} · ${f2(q[2].media)} · ${f2(q[3].media)} · ${f2(q[4].media)}</div><p style="font-size:13.5px">Q1→Q3 ${pct(dQ1Q3)}: no total a régua quase não mudou; o movimento está nas operações. Q3→Q4 ${pct(dQ3Q4)} é só troca de placas ativas.</p></div>
    <div class="box" style="padding:16px 20px"><div class="lbl">Maior alta Q1 → Q3 (pior para nós)</div><div class="num" style="font-size:24px;color:${ACC};letter-spacing:0">${esc(maiorAlta.up)}</div><p>${f2(maiorAlta.q1)} → ${f2(maiorAlta.q3)} km/L (${pct(maiorAlta.dQ1Q3)}).<br>Depois: ${esc([...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[1].up)} ${pct([...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[1].dQ1Q3)}.</p></div>
    <div class="box" style="padding:16px 20px"><div class="lbl">Maior queda Q1 → Q3 (a favor)</div><div class="num" style="font-size:24px;color:${AZUL};letter-spacing:0">${esc(maiorQueda.up)}</div><p>${f2(maiorQueda.q1)} → ${f2(maiorQueda.q3)} km/L (${pct(maiorQueda.dQ1Q3)}).<br>Depois: ${esc([...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[1].up)} ${pct([...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[1].dQ1Q3)}.</p></div>
  </div>`));

// ── 4 · PERGUNTA 1 ──
{
  const lin = (nome, t, cor) => { const f = fr[t]; const tot = f.iguais + f.mudaram; return `<tr><td><b>${nome}</b></td><td>${D.QZ.find(z => z.t === t).label}</td><td class="r">${tot}</td><td class="r"><b style="color:${cor}">${f.mudaram}</b></td><td class="r">${f.iguais}</td><td class="r">${pct(f.mudaram / tot * 100, 0).replace('+', '')}</td></tr>`; };
  S.push(slide(`
  <div class="kicker">1 · Revisão do 3º para o 4º trimestre</div>
  <h2>Não houve revisão: as ${D.q3q4.iguais} placas presentes em 2ª set e 1ª out entraram em outubro com o mesmo valor.</h2>
  <div class="grid" style="grid-template-columns:1.15fr 1fr;gap:34px;margin-top:18px;align-items:start">
    <div>
      <table><thead><tr><th>Revisão</th><th>Quinzena</th><th class="r">Placas ativas</th><th class="r">Mudaram de valor</th><th class="r">Mesmo valor</th><th class="r">% mudou</th></tr></thead><tbody>
        ${lin('Q2', 6, INK)}${lin('Q3', 12, INK)}${lin('Q4', 18, ACC)}
      </tbody></table>
      <p class="note">Placas ativas na quinzena, comparadas com o valor que tinham na quinzena anterior. A revisão entra sempre na <b>1ª quinzena</b> do trimestre: em abril e em julho ela aconteceu; em outubro, nenhuma placa mudou (em 2ª out, ${fr[19].mudaram}).</p>
      ${escuro('<b>O 4º trimestre está rodando com a régua do 3º.</b> O consumo remunerado de cada placa em outubro é o mesmo de julho, agosto e setembro.')}
    </div>
    <div>
      <div class="box" style="margin-bottom:16px"><h3>As últimas mudanças: 2ª set, Cuiabá</h3><p>ROTA: 8 placas (RAZ3F18/28/38/68/88, RRP5C22/32, RRR8A49) caíram de 3,27–4,09 para 2,31, a favor. AS: RRT3H09 e RRT1D26 subiram de 2,21 para 3,36 (+52%), contra. É ajuste de placa no meio do ciclo, não revisão.</p></div>
      <div class="box"><h3>${D.mudancasCiclo} mudanças fora da revisão no ano</h3><p>2ª jan ${fr[1].mudaram} · 2ª fev ${fr[3].mudaram} · 2ª mar ${fr[5].mudaram} · 2ª abr ${fr[7].mudaram} · 1ª mai ${fr[8].mudaram} · 2ª set ${fr[17].mudaram}. Ajustes pontuais de placa, sem regra visível.</p></div>
    </div>
  </div>`));
}

// ── 5 · MATRIZ unidade-projeto × ciclo ──
{
  const rows = D.rankUP.filter(r => !FORA.has(r.up) && (r.q1 != null || r.q3 != null)).sort((a, b) => a.up.localeCompare(b.up));
  const linha = r => `<tr><td style="white-space:nowrap"><b>${esc(r.up)}</b></td><td class="r">${f2(r.q1)}</td><td class="r">${f2(r.q2)}</td><td class="r">${f2(r.q3)}</td><td class="r">${f2(r.q4)}</td><td class="r">${sinalPct(r.dQ1Q3)}</td><td class="r">${sinalPct(r.dQ3Q4)}</td></tr>`;
  const meio = Math.ceil(rows.length / 2);
  const tab = rs => `<table class="media"><thead><tr><th>Operação</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q1→Q3</th><th class="r">Δ Q3→Q4</th></tr></thead><tbody>${rs.map(linha).join('')}</tbody></table>`;
  S.push(slide(`
  <div class="kicker">Matriz do ano · unidade-projeto × ciclo de revisão</div>
  <h2>A régua de cada operação, trimestre a trimestre</h2>
  <div class="grid g2" style="gap:36px;margin-top:10px;align-items:start">${tab(rows.slice(0, meio))}${tab(rows.slice(meio))}</div>
  <p class="note">Q1 = jan a mar · Q2 = abr a jun · Q3 = jul a set · Q4 = outubro. Média simples das placas ativas com consumo, a régua do FT. Vermelho = o remunerado subiu (pior para nós); azul = caiu. Δ Q3→Q4 diferente de zero é só troca de placas ativas: nenhum valor mudou em outubro.</p>`));
}

// ── 6… · UM SLIDE POR UNIDADE ──
for (const u of UNIS) {
  const ups = upsDe(u).filter(up => (D.modelosQ[up] || []).some(m => m.placas > 0));
  const nRows = ups.reduce((s, up) => s + D.modelosQ[up].filter(m => m.placas > 0).length, 0);
  const dens = nRows <= 7 ? 'media' : nRows <= 10 ? 'compacta' : 'densa';
  const blocos = ups.map(up => {
    const lista = D.modelosQ[up].filter(m => m.placas > 0);
    const tr = lista.map(m => {
      const c = k => m.q[k] ? f2(m.q[k].media) : '—';
      const d34 = m.q[3] && m.q[4] ? (m.q[4].media / m.q[3].media - 1) * 100 : null;
      const faixa = m.q[3] ? (m.q[3].max - m.q[3].min > 0.005 ? `${f2(m.q[3].min)} – ${f2(m.q[3].max)}` : 'todas iguais') : '—';
      return `<tr><td><b>${esc(m.modelo)}</b></td><td class="r">${m.placas}</td><td class="r">${c(1)}</td><td class="r">${c(2)}</td><td class="r">${c(3)}</td><td class="r">${c(4)}</td><td class="r">${sinalPct(d34)}</td><td class="r" style="color:${m.q[3] && m.q[3].max - m.q[3].min > 0.005 ? ACC : INK2}">${faixa}</td></tr>`;
    }).join('');
    const mu = D.mediaUP[up];
    return `<div class="bloco"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><h3 style="margin:0">${esc(up)}</h3><span style="font-size:13px;color:${INK2}">média da operação · Q1 <b>${f2(mu.q[1]?.media)}</b> · Q2 <b>${f2(mu.q[2]?.media)}</b> · Q3 <b>${f2(mu.q[3]?.media)}</b> · Q4 <b>${f2(mu.q[4]?.media)}</b></span></div>
      <table class="${dens}"><thead><tr><th>Modelo</th><th class="r">Placas</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q3→Q4</th><th class="r">Faixa no Q3</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  }).join('');
  S.push(slide(`
  <div class="kicker">Modelos × trimestre · ${esc(nomeU(u))}</div>
  <h2 style="font-size:28px;margin-bottom:${dens === 'densa' ? 6 : 12}px">${esc(nomeU(u))}: consumo remunerado por modelo em cada ciclo</h2>
  ${blocos}
  <p class="note" style="margin-top:${dens === 'densa' ? 6 : 12}px">Média simples das placas ativas do modelo na operação. "Faixa no Q3" = menor e maior valor pago a placas do mesmo modelo no 3º tri; em vermelho quando o mesmo modelo recebe valores diferentes. Δ Q3→Q4 em outubro vem só da troca de placas ativas.</p>`, { style: dens === 'densa' ? 'padding-top:40px' : '' }));
}

// ── PERGUNTA 2 · dispersão: MATRIZ up·modelo × mês, saldo em litros ──
{
  const rows = {};
  for (const up of UPS) for (const o of D.dispersao[up] || []) { if (o.max - o.min < 0.005) continue; const k = `${up}|${o.modelo}`; rows[k] = rows[k] || { up, modelo: o.modelo, meses: {}, saldo: 0, n: 0 }; rows[k].meses[o.mes] = o; rows[k].saldo += o.perde - o.ganha; rows[k].n = Math.max(rows[k].n, o.n); }
  const arr = Object.values(rows).sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  const MIN = 100; const vis = arr.filter(r => Math.abs(r.saldo) >= MIN), resto = arr.filter(r => Math.abs(r.saldo) < MIN);
  const meses = D.MES_IDX.filter(m => m <= 9); // litros usam o km da aba Km/L, que vai até setembro
  const cel = o => { if (!o) return `<td class="r" style="color:#bbb">—</td>`; const v = o.perde - o.ganha; const bg = v >= 50 ? 'rgba(242,44,5,.14)' : v <= -50 ? 'rgba(31,111,235,.14)' : 'transparent'; return `<td class="r" style="background:${bg};font-weight:${Math.abs(v) >= 50 ? 700 : 400}" title="${f2(o.min)}–${f2(o.max)}">${Math.abs(v) < 0.5 ? '0' : f0(v)}</td>`; };
  const tr = vis.map(r => `<tr><td style="white-space:nowrap"><b>${esc(r.up)}</b> · ${esc(r.modelo)}</td><td class="r">${r.n}</td>${meses.map(m => cel(r.meses[m])).join('')}<td class="r"><b style="color:${r.saldo > 0 ? ACC : AZUL}">${f0(r.saldo)}</b></td></tr>`).join('');
  const tot = m => vis.reduce((s, r) => s + (r.meses[m] ? r.meses[m].perde - r.meses[m].ganha : 0), 0);
  S.push(slide(`
  <div class="kicker">2 · Mesmo modelo, valores diferentes · litros a mais ou a menos por mês</div>
  <h2 style="font-size:25px">Em ${D.dispRes.comDif} de ${D.dispRes.grupos} grupos modelo-mês há placas do mesmo modelo com valores diferentes. Saldo: ${f0(dispTot.perde - dispTot.ganha)} litros contra nós.</h2>
  <div class="grid" style="grid-template-columns:1fr 236px;gap:22px;margin-top:8px;align-items:start">
    <div>
      <table class="densa ativ"><thead><tr><th>Operação · modelo</th><th class="r">Placas</th>${meses.map(m => `<th class="r">${MES[m - 1]}</th>`).join('')}<th class="r">Saldo</th></tr></thead><tbody>${tr}
      <tr class="tot"><td>Total das linhas</td><td class="r"></td>${meses.map(m => `<td class="r">${f0(tot(m))}</td>`).join('')}<td class="r" style="color:${ACC}">${f0(vis.reduce((s, r) => s + r.saldo, 0))}</td></tr></tbody></table>
      <p class="note" style="margin-top:8px">Célula = litros que a operação deixa de receber (vermelho) ou recebe a mais (azul) no mês por placas do mesmo modelo terem valores diferentes: referência = mediana do modelo na operação; litros = km da placa × (1/mediana − 1/valor). Fora: ${resto.length} linhas com menos de ${MIN} L no ano.</p>
    </div>
    <div>
      <div class="box" style="padding:14px 16px;margin-bottom:10px"><div class="lbl">Valor constante</div><div class="num" style="font-size:30px">${D.placaRes.constantes}</div><p style="font-size:12.5px">placas com o mesmo valor o ano todo</p></div>
      <div class="box" style="padding:14px 16px;margin-bottom:10px"><div class="lbl">Mudam só na revisão</div><div class="num" style="font-size:30px">${D.placaRes.soFronteira}</div><p style="font-size:12.5px">1ª abr e 1ª jul, como esperado</p></div>
      <div class="box" style="padding:14px 16px;margin-bottom:10px"><div class="lbl">Mudam fora dela</div><div class="num" style="font-size:30px;color:${ACC}">${D.placaRes.dentroTri}</div><p style="font-size:12.5px">de ${D.placaRes.total} placas-operação</p></div>
      <div class="box" style="padding:14px 16px"><div class="lbl">Maior caso</div><div class="num" style="font-size:22px;letter-spacing:0">${esc(vis[0].up)}</div><p style="font-size:12.5px">${esc(vis[0].modelo)}: ${f0(vis[0].saldo)} L no ano, ${vis[0].n} placas. UGU5D17 a 0,67 km/L explica a maior parte.</p></div>
    </div>
  </div>`, { style: 'padding-top:40px' }));
}

// ── 4a · ATIVAS SEM CONSUMO: MATRIZ 2ª mar · 1ª abr · 2ª abr ──
{
  const det = D.erros.ativasZeroDet;
  const ups = [...new Set(det.map(d => d.up))];
  const T = { '2ª mar': 5, '1ª abr': 6, '2ª abr': 7 };
  const linhas = [];
  for (const up of ups) {
    const z = D.mediaUP[up].qz;
    const q6 = z[6], q5 = z[5], q7 = z[7];
    const comZero = q6.n ? q6.media * q6.n / q6.nAt : 0; // se o FT contar o zero na média simples
    const comZeroTxt = q6.n ? `${f2(comZero)} (${pct((comZero / q6.media - 1) * 100, 0)})` : '0,00 (todas zeradas)';
    linhas.push(`<tr style="background:${PALE}"><td style="white-space:nowrap"><b>${esc(up)}</b> · operação</td><td class="r">${q5.nAt} · <b>${f2(q5.media)}</b></td><td class="r">${q6.nAt}</td><td class="r" style="color:${ACC};font-weight:800">${q6.zeros}</td><td class="r"><b>${f2(q6.media)}</b></td><td class="r" style="color:${ACC};font-weight:700">${comZeroTxt}</td><td class="r">${q7.nAt} · <b>${f2(q7.media)}</b></td></tr>`);
    const grupos = {}; det.filter(d => d.up === up).forEach(d => (grupos[d.modelo] = grupos[d.modelo] || []).push(d));
    for (const [mod, a] of Object.entries(grupos)) {
      const d = a[0];
      const vals = f => [...new Set(a.map(x => f(x) ? f2(f(x).v) : '—'))].join(' / ');
      linhas.push(`<tr><td style="padding-left:28px;white-space:nowrap">${esc(mod)} · ${a.length} zeradas</td><td class="r">${vals(x => x.ant)}</td><td class="r">${d.irmas ? `${a.length + d.irmas}` : a.length}</td><td class="r" style="color:${ACC};font-weight:700">${a.length}</td><td class="r">${d.irmas ? `${f2(d.irmasMin)}–${f2(d.irmasMax)} <span style="color:${INK3}">(${d.irmas} irmãs)</span>` : '<span style="color:' + INK3 + '">modelo inteiro zerado</span>'}</td><td class="r" style="color:${INK3}">—</td><td class="r">${vals(x => x.prox)}</td></tr>`);
    }
  }
  S.push(slide(`
  <div class="kicker">4 · Placas ativas com consumo zero · todas na 1ª quinzena de abril, nas Empurradas</div>
  <h2 style="font-size:28px">${D.erros.ativasZero.length} placas entraram na revisão do Q2 com consumo zero: o valor novo só chegou na quinzena seguinte.</h2>
  <table class="compacta" style="margin-top:6px"><thead><tr><th>Operação · modelo</th><th class="r">2ª mar · ativas · valor</th><th class="r">1ª abr · ativas</th><th class="r">zeradas</th><th class="r">1ª abr · valor das demais</th><th class="r">média se o zero contar</th><th class="r">2ª abr · ativas · valor</th></tr></thead><tbody>${linhas.join('')}</tbody></table>
  <div class="grid g2" style="gap:18px;margin-top:12px">
    <div class="box" style="padding:14px 18px"><h3 style="font-size:15px">O que isso significa</h3><p style="font-size:13px">Em três dos quatro grupos o modelo inteiro ficou sem valor na 1ª abr (Actros 2548 em Cuiabá e Macacu, Actros 2651 em Piraí). Só em Piraí 8 Actros 2548 ficaram zeradas com 12 irmãs ativas com valor. Se o FT conta o zero na média simples, a operação cai o que está em vermelho; se ignora, a placa rodou uma quinzena sem régua.</p></div>
    <div class="box" style="padding:14px 18px"><h3 style="font-size:15px">O que pedir à Ambev</h3><p style="font-size:13px">Qual regra o FT aplica ao zero na quinzena da revisão e o valor que efetivamente valeu para essas ${D.erros.ativasZero.length} placas na 1ª abr. Na próxima revisão (Q4 atrasado e Q1/27), o valor novo tem de entrar junto com a 1ª quinzena.</p></div>
  </div>`, { style: 'padding-top:40px' }));
}

// ── PERGUNTA 3 · ativação ──
{
  const meses = D.MES_IDX;
  const temEfeito = up => Object.values(D.ativacao[up] || {}).some(x => x.delta != null && Math.abs(x.delta) >= 0.005);
  const comInat = UPS.filter(up => Object.values(D.ativacao[up] || {}).some(x => x.nInat > 0));
  const rows = comInat.filter(temEfeito).map(up => {
    const a = D.ativacao[up];
    const cells = meses.map(m => { const o = a[m]; if (!o || o.delta == null) return `<td class="r" style="color:#bbb">—</td>`; const v = o.delta; const bg = v > 0.03 ? 'rgba(242,44,5,.14)' : v < -0.03 ? 'rgba(31,111,235,.14)' : 'transparent'; return `<td class="r" style="background:${bg};font-weight:${Math.abs(v) > 0.03 ? 700 : 400}">${Math.abs(v) < 0.005 ? '0,00' : (v > 0 ? '+' : '') + f2(v)}</td>`; }).join('');
    const med = D.rankUP.find(x => x.up === up).ativMed;
    return `<tr><td><b>${esc(up)}</b></td>${cells}<td class="r">${sinal2(med)}</td></tr>`;
  }).join('');
  const semEfeito = comInat.filter(up => !temEfeito(up));
  const ev = D.evRes;
  S.push(slide(`
  <div class="kicker">3 · Efeito da ativação na média</div>
  <h2 style="font-size:26px">A ativação mexe pouco na média: até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}. Em ${semEfeito.length} operações com placas inativas o efeito é zero.</h2>
  <div class="grid" style="grid-template-columns:1fr 250px;gap:24px;margin-top:8px;align-items:start">
    <div>
      <table class="densa ativ"><thead><tr><th>Unidade · projeto</th>${meses.map(m => `<th class="r">${MES[m - 1]}</th>`).join('')}<th class="r">Média</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note">Célula = média das placas ativas (a que o FT paga) − média de todas as placas da operação com valor no mês. Positivo (vermelho) = a ativação deixou a média mais alta, pior para nós. Sem efeito (fora da tabela): ${semEfeito.map(esc).join(' · ')}.</p>
    </div>
    <div>
      <div class="box" style="padding:16px 18px;margin-bottom:12px"><div class="lbl">Desativações</div><div class="num" style="font-size:32px">${Math.round(ev.desat.abaixo / ev.desat.n * 100)}%</div><p style="font-size:13px">das ${ev.desat.n} desativações do ano tiraram uma placa <b>abaixo</b> da média da operação (acaso = 50%).</p></div>
      <div class="box" style="padding:16px 18px;margin-bottom:12px"><div class="lbl">Ativações</div><div class="num" style="font-size:32px">${Math.round(ev.ativ.abaixo / ev.ativ.n * 100)}%</div><p style="font-size:13px">das ${ev.ativ.n} ativações trouxeram uma placa abaixo da média. Sem padrão de escolher as melhores.</p></div>
      <div class="box" style="padding:16px 18px"><div class="lbl">Km de placas inativas</div><div class="num" style="font-size:32px;color:${ACC}">${f1(kmInatPct)}%</div><p style="font-size:13px">do km do ano (aba Km/L, jan a set) foi rodado por ${D.kmInatFTTot.placas} placas marcadas inativas no FT: km sem régua remunerada.</p></div>
    </div>
  </div>`, { style: 'padding-top:40px' }));
}

// ── PERGUNTA 4 · erros ──
{
  const dup = D.erros.duplaGrafia.map(x => x.grafias.join('/')).join(', ');
  S.push(slide(`
  <div class="kicker">4 · Outros erros encontrados</div>
  <h2 style="font-size:28px">Seis achados para levar à Ambev, do maior para o menor</h2>
  <div class="grid g2" style="gap:22px 30px;margin-top:14px">
    <div class="step"><div class="n">1</div><div><b>${D.erros.ativasZero.length} placas ativas com consumo zero na 1ª abr (matriz anterior)</b><span>Todas nas Empurradas, na quinzena da revisão do Q2: o valor novo entrou com uma quinzena de atraso. Em Piraí, 8 Actros 2548 zeradas enquanto 12 irmãs seguiam com valor.</span></div></div>
    <div class="step"><div class="n">2</div><div><b>Piraí Empurrada: UGU5D17 a 0,67 km/L</b><span>Em jul, set e out, contra 2,2 das irmãs Actros 2548 (a faixa do modelo no Q3 vai de 0,67 a 2,22 só por ela). É 3× mais litros remunerados para uma placa; vai ser corrigido na próxima revisão e vale saber o quanto entrou.</span></div></div>
    <div class="step"><div class="n">3</div><div><b>Cuiabá AS subiu 52% fora da revisão</b><span>RRT3H09 e RRT1D26 (VW 30.280) passaram de 2,21 para 3,36 na 2ª set, sem revisão e sem outra placa do modelo na operação para comparar.</span></div></div>
    <div class="step"><div class="n">4</div><div><b>Placa "TESTE" ativa o ano inteiro</b><span>${D.erros.placaTeste.length} quinzenas em ${esc(D.erros.placaTeste[0]?.up || '')}, a única placa dessa operação, com consumo ${f2(D.erros.placaTeste[0]?.v)} e depois 4,59. Entra na média como se fosse caminhão.</span></div></div>
    <div class="step"><div class="n">5</div><div><b>${D.erros.duplaGrafia.length} placas em duas grafias</b><span>${dup}. A mesma placa no formato antigo e no Mercosul; em FLP e PLT a mesma placa está em duas operações.</span></div></div>
    <div class="step"><div class="n">6</div><div><b>${D.mudancasCiclo} mudanças de valor fora da revisão</b><span>21 placas em 2ª jan, 22 em 2ª abr, 10 em 2ª set (Cuiabá) e mais 7 espalhadas. Ajuste de placa no meio do ciclo não está na regra; vale pedir a trilha de cada um.</span></div></div>
  </div>`, { cls: 'erros', style: 'padding-top:40px' }));
}

// ── PRÓXIMOS PASSOS ──
S.push(slide(`
  <div class="kicker">O que levar à Ambev</div>
  <h2>Quatro pontos, na ordem de importância</h2>
  <div class="grid g2" style="gap:16px 30px;margin-top:16px">
    <div class="box"><h3>1 · Rodar a revisão do Q4 agora</h3><p>Nenhuma das ${D.q3q4.iguais} placas mudou em outubro: o trimestre inteiro está rodando com a régua de julho. A revisão é trimestral por contrato e a troca do especialista não pode parar o ciclo.</p></div>
    <div class="box"><h3>2 · Uma régua por modelo dentro da operação</h3><p>${D.dispRes.comDif} grupos modelo-mês com valores diferentes para o mesmo modelo, ${D.placaRes.dentroTri} placas mudando fora da revisão. Saldo de ${f0(dispTot.perde - dispTot.ganha)} L contra nós em 9 meses.</p></div>
    <div class="box"><h3>3 · Limpeza do cadastro no FT</h3><p>Placa TESTE, ${D.erros.duplaGrafia.length} grafias duplas, UGU5D17 a 0,67, valor da revisão entrando com uma quinzena de atraso nas Empurradas. Corrigir antes da próxima revisão, para a base do Q1/27 nascer limpa.</p></div>
    <div class="box" style="grid-column:1/3"><h3>4 · Ativação: monitorar, não brigar</h3><p>O efeito na média é pequeno (até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}) e sem padrão de escolher as melhores. O ponto é outro: ${f1(kmInatPct)}% do km do ano foi rodado por placas inativas no FT, sem régua remunerada. Pedir o critério de ativação por escrito e acompanhar mês a mês com esta mesma matriz.</p></div>
  </div>`));

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Consumo remunerado Km/L · 2026</title>
<link rel="stylesheet" href="../driverpro-apresentacao/base.css">
<style>
  /* só a densidade das tabelas muda; o resto é o base.css do DriverPro */
  table.media{font-size:13.5px} table.media th{padding:7px 9px} table.media td{padding:6px 9px}
  table.compacta{font-size:12.5px} table.compacta th{padding:6px 8px} table.compacta td{padding:5px 8px}
  table.densa{font-size:12px} table.densa th{padding:5px 7px} table.densa td{padding:4px 7px}
  table.ativ td{padding:3px 7px}
  .bloco{margin-bottom:12px} .bloco h3{font-size:16px}
  .step{margin-bottom:0}
  .slide.erros .step b{font-size:15px} .slide.erros .step span{font-size:13.5px;line-height:1.45} .slide.erros .step .n{flex:0 0 36px;width:36px;height:36px;font-size:15px}
</style></head>
<body>
${S.join('\n')}
</body></html>`;
writeFileSync(OUT, html);
console.log('deck.html', S.length, 'slides');
