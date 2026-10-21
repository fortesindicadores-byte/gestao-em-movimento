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
const escuro = txt => `<div class="box res" style="background:#0F1A20"><p style="color:#F4F5F7">${txt}</p></div>`;

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
const foraQzTxt = Object.entries(D.mudRes.foraPorQz).sort((a, b) => a[0] - b[0]).map(([t, o]) => `${D.QZ.find(z => z.t === +t)?.label || t} ${o.n}`).join(' · ');
const UNIS = [...new Set(UPS.map(up => up.split(' · ')[0].replace(/ UDC| LATA/, '')))].sort();
const upsDe = u => UPS.filter(up => up.split(' · ')[0].replace(/ UDC| LATA/, '') === u);
const nomeU = u => D.NOME[u] || u;

// explica o Δ Q3→Q4 de uma operação: em outubro nenhum valor mudou, então é ativação (quem saiu/entrou) ou valor que mudou dentro do Q3
function explicaUp(up) {
  const r = D.rankUP.find(x => x.up === up), m = D.movUP[up]; if (!r || r.dQ3Q4 == null || !m) return '';
  const d = r.dQ3Q4; const partes = [];
  if (m.sai.n) partes.push(m.sai.n <= 3 ? `saiu do ativo ${m.sai.lista.map(x => `${x.placa} (${f2(x.v)})`).join(', ')}` : `${m.sai.n} placas saíram do ativo (média ${f2(m.sai.media)})`);
  if (m.ent.n) partes.push(m.ent.n <= 3 ? `entrou ${m.ent.lista.map(x => `${x.placa} (${f2(x.v)})`).join(', ')}` : `${m.ent.n} entraram (média ${f2(m.ent.media)})`);
  const ficMudou = m.fic.n && Math.abs(m.fic.q4 - m.fic.q3) > 0.005;
  if (ficMudou) partes.push(`as ${m.fic.n} que ficaram passaram de ${f2(m.fic.q3)} para ${f2(m.fic.q4)} (valor mudado dentro do Q3)`);
  else if (m.fic.n) partes.push(`as ${m.fic.n} que ficaram seguem a ${f2(m.fic.q4)}`);
  if (Math.abs(d) < 0.5) return `<b>${esc(up)}</b> Q3→Q4 ${pct(d)}: sem mudança.`;
  return `<b>${esc(up)}</b> Q3→Q4 ${pct(d)}: ${ficMudou ? '' : 'nenhum valor mudou, é ativação: '}${partes.join(', ')}.`;
}

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
  ${`<div style="margin-top:22px">${escuro(`<b>4 · Erros do cadastro:</b> ${D.erros.ativasZero.length} linhas de placa ativa com consumo zero (todas na 1ª quinzena de abril, nas Empurradas), uma placa a 0,67 km/L em Piraí, placa "TESTE" ativa o ano inteiro e ${D.mudRes.fora} mudanças de valor fora da revisão.`)}</div>`}`));

// ── 3 · VISÃO GERAL DO ANO ──
S.push(slide(`
  <div class="kicker">Visão geral do ano · média simples das placas ativas no FT</div>
  <h2>Duas revisões no ano, em abril e em julho. Em outubro, nenhuma.</h2>
  ${lineChart({ h: 250, labels: MES.slice(0, 10).map(m => m.toUpperCase()), series: [{ data: frotaMes, cor: ACC }],
    bands: [{ de: 0, ate: 2, label: 'Q1' }, { de: 3, ate: 5, label: 'Q2', fill: '#fff' }, { de: 6, ate: 8, label: 'Q3' }, { de: 9, ate: 9, label: 'Q4', fill: '#fff' }],
    marks: [{ i: 3, label: `revisão · 1ª abr · ${fr[6].mudaram} placas` }, { i: 6, label: `revisão · 1ª jul · ${fr[12].mudaram} placas` }, { i: 9, label: 'sem revisão', cor: ACC }] })}
  <div class="grid g3" style="margin-top:10px;gap:18px">
    <div class="box" style="padding:12px 18px"><div class="lbl">Frota · Q1 → Q2 → Q3 → Q4</div><div class="num" style="font-size:26px">${f2(q[1].media)} · ${f2(q[2].media)} · ${f2(q[3].media)} · ${f2(q[4].media)}</div><p style="font-size:13.5px">Q1→Q3 ${pct(dQ1Q3)}: no total a régua quase não mudou; o movimento está nas operações. Q3→Q4 ${pct(dQ3Q4)} é só troca de placas ativas.</p></div>
    <div class="box" style="padding:12px 18px"><div class="lbl">Maior alta Q1 → Q3 (pior para nós)</div><div class="num" style="font-size:22px;color:${ACC};letter-spacing:0">${esc(maiorAlta.up)}</div><p>${f2(maiorAlta.q1)} → ${f2(maiorAlta.q3)} km/L (${pct(maiorAlta.dQ1Q3)}).<br>Depois: ${esc([...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[1].up)} ${pct([...rank].sort((a, b) => b.dQ1Q3 - a.dQ1Q3)[1].dQ1Q3)}.</p></div>
    <div class="box" style="padding:12px 18px"><div class="lbl">Maior queda Q1 → Q3 (a favor)</div><div class="num" style="font-size:22px;color:${AZUL};letter-spacing:0">${esc(maiorQueda.up)}</div><p>${f2(maiorQueda.q1)} → ${f2(maiorQueda.q3)} km/L (${pct(maiorQueda.dQ1Q3)}).<br>Depois: ${esc([...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[1].up)} ${pct([...rank].sort((a, b) => a.dQ1Q3 - b.dQ1Q3)[1].dQ1Q3)}.</p></div>
  </div>
  <div style="margin-top:12px">${escuro(`<b>Resumo:</b> a régua da frota só muda na 1ª quinzena de abril e de julho; o resto do ano é troca de placas ativas. Em outubro não houve revisão, e a queda de ${f2(q[3].media)} para ${f2(q[4].media)} é só ativação: nenhum valor mudou.`)}</div>`));

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
      <div class="box"><h3>${D.mudRes.fora} mudanças fora da revisão no ano</h3><p>${foraQzTxt}. Ajustes pontuais de placa, sem regra visível (Excel: G5).</p></div>
    </div>
  </div>`));
}

// ── 5 · MATRIZ unidade-projeto × ciclo ──
{
  const rows = D.rankUP.filter(r => !FORA.has(r.up) && (r.q1 != null || r.q3 != null)).sort((a, b) => a.up.localeCompare(b.up));
  const linha = r => `<tr><td style="white-space:nowrap"><b>${esc(r.up)}</b></td><td class="r">${f2(r.q1)}</td><td class="r">${f2(r.q2)}</td><td class="r">${f2(r.q3)}</td><td class="r">${f2(r.q4)}</td><td class="r">${sinalPct(r.dQ1Q3)}</td><td class="r">${sinalPct(r.dQ3Q4)}</td></tr>`;
  const meio = Math.ceil(rows.length / 2);
  const tab = rs => `<table class="compacta"><thead><tr><th>Operação</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q1→Q3</th><th class="r">Δ Q3→Q4</th></tr></thead><tbody>${rs.map(linha).join('')}</tbody></table>`;
  S.push(slide(`
  <div class="kicker">Matriz do ano · unidade-projeto × ciclo de revisão</div>
  <h2>A régua de cada operação, trimestre a trimestre</h2>
  <div class="grid g2" style="gap:36px;margin-top:10px;align-items:start">${tab(rows.slice(0, meio))}${tab(rows.slice(meio))}</div>
  <p class="note" style="margin-top:6px">Q1 = jan a mar · Q2 = abr a jun · Q3 = jul a set · Q4 = outubro. Média simples das placas ativas com consumo, a régua do FT. Vermelho = subiu (pior para nós); azul = caiu.</p>
  <div style="margin-top:8px">${escuro(`<b>Resumo:</b> as revisões de abril e julho mexeram em ${rank.filter(r => Math.abs(r.dQ1Q3) >= 5).length} das ${rank.length} operações em 5% ou mais. O Δ Q3→Q4 é só ativação (nenhum valor mudou em outubro): ${esc(maiorAlta.up)} e ${esc(rank.filter(r => Math.abs(r.dQ3Q4) >= 5).map(r => r.up).join(', '))} são os únicos acima de 5%.`)}</div>`));
}

// ── 6… · UM SLIDE POR UNIDADE-PROJETO ──
// o Δ Q3→Q4 de um modelo é a média simples das linhas placa-quinzena ativas: em outubro nenhum valor mudou, então o Δ vem de
// placa que saiu/entrou do ativo (ou de valor mudado dentro do Q3). A coluna "O que explica" diz qual.
const qzL = t => D.QZ.find(z => z.t === t)?.label || '';
const nomesPl = (l, n = 3) => l.length <= n ? l.map(x => `${x.placa} (${f2(x.v)})`).join(', ') : `${l.length} placas (média ${f2(l.reduce((s, x) => s + x.v, 0) / l.length)})`;
function explicaModelo(m) {
  if (!m.q[3] && !m.q[4]) return 'sem placa ativa no Q3 e no Q4';
  if (!m.q[4]) return 'nenhuma placa ativa no Q4';
  if (!m.q[3]) return 'só tem placa ativa no Q4';
  const d = (m.q[4].media / m.q[3].media - 1) * 100, mv = m.mov, partes = [];
  if (mv.mudou.length) partes.push(`valor mudou: ${mv.mudou.slice(0, 2).map(x => `${x.placa} ${f2(x.de)}→${f2(x.para)}`).join(', ')}${mv.mudou.length > 2 ? ` e mais ${mv.mudou.length - 2}` : ''}`);
  if (Math.abs(d) < 0.05 && !mv.mudou.length) return 'sem mudança';
  if (mv.sai.n) partes.push(`saiu do ativo: ${nomesPl(mv.sai.lista)}${mv.sai.n === 1 ? `, última ${qzL(mv.sai.lista[0].t)}` : ''}`);
  if (mv.ent.n) partes.push(`entrou: ${nomesPl(mv.ent.lista)}`);
  if (!partes.length) partes.push('placas ativas em menos quinzenas');
  return (mv.mudou.length ? '' : 'nenhum valor mudou · ') + partes.join(' · ');
}
for (const u of UNIS) {
  const ups = upsDe(u).filter(up => (D.modelosQ[up] || []).some(m => m.placas > 0));
  const nRows = ups.reduce((s, up) => s + D.modelosQ[up].filter(m => m.placas > 0).length + 1, 0);
  const dens = nRows <= 9 ? 'media' : nRows <= 13 ? 'compacta' : 'densa';
  const corpo = ups.map(up => {
    const lista = D.modelosQ[up].filter(m => m.placas > 0), mu = D.mediaUP[up], proj = up.split(' · ')[1], uc = up.split(' · ')[0];
    const rot = `${esc(proj)}${uc !== u ? `<br><span style="font-weight:500;color:${INK3}">${esc(uc.replace(u + ' ', ''))}</span>` : ''}`;
    const linhas = lista.map((m, i) => {
      const c = k => m.q[k] ? f2(m.q[k].media) : '—';
      const d34 = m.q[3] && m.q[4] ? (m.q[4].media / m.q[3].media - 1) * 100 : null;
      const dif = m.q[3] && m.q[3].max - m.q[3].min > 0.005;
      const faixa = m.q[3] ? (dif ? `${f2(m.q[3].min)} – ${f2(m.q[3].max)}` : 'iguais') : '—';
      return `<tr${i === 0 ? ' class="g0"' : ''}>${i === 0 ? `<td rowspan="${lista.length + 1}" class="proj">${rot}</td>` : ''}<td style="white-space:nowrap">${esc(m.modelo)}</td><td class="r">${m.placas}</td><td class="r">${c(1)}</td><td class="r">${c(2)}</td><td class="r">${c(3)}</td><td class="r">${c(4)}</td><td class="r">${sinalPct(d34)}</td><td class="r" style="${dif ? `color:${ACC};font-weight:600` : `color:${INK3}`}">${faixa}</td><td class="exp">${esc(explicaModelo(m))}</td></tr>`;
    }).join('');
    const d = mu.q[3]?.media && mu.q[4]?.media ? (mu.q[4].media / mu.q[3].media - 1) * 100 : null;
    return linhas + `<tr class="med"><td>Média da operação</td><td></td><td class="r">${f2(mu.q[1]?.media)}</td><td class="r">${f2(mu.q[2]?.media)}</td><td class="r">${f2(mu.q[3]?.media)}</td><td class="r">${f2(mu.q[4]?.media)}</td><td class="r">${sinalPct(d)}</td><td></td><td></td></tr>`;
  }).join('');
  const difs = ups.flatMap(up => D.modelosQ[up].filter(m => m.placas > 1 && m.q[3] && m.q[3].max - m.q[3].min > 0.005).map(m => `${esc(m.modelo)} em ${esc(up.split(' · ')[1])} (${f2(m.q[3].min)}–${f2(m.q[3].max)})`));
  S.push(slide(`
  <div class="kicker">Modelos × trimestre · ${esc(nomeU(u))}</div>
  <h2 style="font-size:${dens === 'densa' ? 26 : 30}px">${esc(nomeU(u))}: consumo remunerado por projeto e modelo</h2>
  <table class="clean ${dens}" style="margin-top:${dens === 'densa' ? 8 : 14}px"><thead><tr><th style="width:96px">Projeto</th><th>Modelo</th><th class="r">Placas</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q3→Q4</th><th class="r">Faixa no Q3</th><th style="width:34%">O que explica o Δ Q3→Q4</th></tr></thead><tbody>${corpo}</tbody></table>
  <div style="margin-top:${dens === 'densa' ? 10 : 16}px">${escuro(`<b>Resumo:</b> ${ups.map(explicaUp).filter(Boolean).join(' ')} ${difs.length ? `Mesmo modelo com valores diferentes no Q3: ${difs.join(', ')}.` : 'No Q3 cada modelo tem um valor só.'}`)}</div>
  <p class="note" style="margin-top:8px">Q1 jan–mar · Q2 abr–jun · Q3 jul–set · Q4 outubro (sem revisão). Média simples das linhas placa-quinzena ativas, a régua do FT: placa que sai ou entra do ativo muda a média sem nenhum valor mudar. Faixa no Q3 = menor e maior valor pago a placas do mesmo modelo.</p>`, dens === 'densa' ? { cls: 'densa', style: 'padding-top:34px' } : {}));
}

// ── O MESMO MODELO ENTRE UNIDADES: VW 26.260 (Renan, 21/10/2026: "Isso de Rondo precisa ser questionado. É um truck
// com média incompatível. Foi via revisão?"). Só remunerado: média do modelo por operação e o que a revisão de julho mudou.
{
  const MOD = 'VW 26.260';
  const linhas = (D.modEntreUps[MOD] || []).slice().sort((a, b) => (b.q['3']?.media || 0) - (a.q['3']?.media || 0));
  const v3 = linhas.map(x => x.q['3']?.media).filter(v => v != null), mn = Math.min(...v3), mx = Math.max(...v3);
  const ron = D.mudRes.julModUp[MOD + '|RON · ROTA'] || { placas: 0, litros: 0, volta: [] };
  const v385 = ron.volta.filter(x => Math.abs(x.para - 3.85) < 0.005);
  const mcc = linhas.find(x => x.up === 'MCC · ROTA');
  const tr = linhas.map(x => {
    const q = k => x.q[k] ? f2(x.q[k].media) : '—';
    const d = x.q['2'] && x.q['3'] ? (x.q['3'].media / x.q['2'].media - 1) * 100 : null;
    const fx = x.q['3'] ? (x.q['3'].max - x.q['3'].min > 0.005 ? `${f2(x.q['3'].min)} – ${f2(x.q['3'].max)}` : 'iguais') : '—';
    const j = D.mudRes.julModUp[MOD + '|' + x.up];
    const dest = x.up === 'RON · ROTA' || x.up === 'MCC · ROTA';
    return `<tr><td style="white-space:nowrap">${dest ? '<b>' : ''}${esc(nomeU(x.up.split(' · ')[0]))} · ${esc(x.up.split(' · ')[1])}${dest ? '</b>' : ''}</td><td class="r">${x.q['3']?.placas ?? '—'}</td><td class="r">${q('1')}</td><td class="r">${q('2')}</td><td class="r"><b>${q('3')}</b></td><td class="r">${q('4')}</td><td class="r">${sinalPct(d)}</td><td class="r" style="${fx.includes('–') ? `color:${ACC};font-weight:600` : `color:${INK3}`}">${fx}</td><td class="r">${j ? j.placas : 0}</td><td class="r" style="color:${j && j.litros > 50 ? ACC : j && j.litros < -50 ? AZUL : INK3};font-weight:600">${j ? (j.litros > 0 ? '+' : '') + f0(j.litros) : '0'}</td></tr>`;
  }).join('');
  S.push(slide(`
  <div class="kicker">O mesmo modelo entre unidades · VW 26.260 (baú roll-up, 10 pallets)</div>
  <h2 style="font-size:28px">O mesmo caminhão: régua de ${f2(mn)} a ${f2(mx)} depois da revisão de julho</h2>
  <table class="clean media" style="margin-top:12px"><thead><tr><th>Rota</th><th class="r">Placas ativas no Q3</th><th class="r">Q1</th><th class="r">Q2</th><th class="r">Q3</th><th class="r">Q4</th><th class="r">Δ Q2→Q3</th><th class="r">Faixa no Q3</th><th class="r">Placas mudadas em jul</th><th class="r">Litros até set (+ contra nós)</th></tr></thead><tbody>${tr}</tbody></table>
  <div class="grid g2" style="gap:18px;margin-top:14px">
    <div class="box" style="padding:14px 18px"><h3>Rondonópolis: veio da revisão</h3><p>As placas do 26.260 foram de 2,70 para 3,43 na 1ª jul, a quinzena da revisão. ${v385.map(x => x.placa).join(', ')} estavam inativas quando a revisão passou e voltaram na ${v385[0]?.quinzena || '1ª ago'} a 3,85, acima das irmãs. ${f0(ron.litros)} L a menos até setembro.</p></div>
    <div class="box" style="padding:14px 18px"><h3>Macacu: uma placa a ${f2(mcc?.q['4']?.media)}</h3><p>Só ${mcc?.q['3']?.placas ?? 1} placas ativas no Q3. UFA5H96 foi de 3,12 para 4,64 na 1ª jul (+49%) e segue assim em outubro. É a maior régua do modelo na frota, com uma placa só.</p></div>
  </div>
  <div style="margin-top:12px">${escuro(`<b>Resumo:</b> no Q2 o VW 26.260 estava a 2,70 em quase toda a Rota; a revisão de julho espalhou o mesmo caminhão de ${f2(mn)} a ${f2(mx)}. Pedir à Ambev o critério de cada operação, em especial Rondonópolis (3,43 e 3,85 nas 4 que voltaram do inativo) e a placa de Macacu a 4,64. Excel: G7 Revisão julho e G8 Modelo entre unidades.`)}</div>`, { style: 'padding-top:40px' }));
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
  <h2 style="font-size:23px;margin-bottom:6px">Em ${D.dispRes.comDif} de ${D.dispRes.grupos} grupos modelo-mês há placas do mesmo modelo com valores diferentes. Saldo: ${f0(dispTot.perde - dispTot.ganha)} litros contra nós.</h2>
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
      ${escuro(`<b>Resumo:</b> o problema está concentrado em Piraí Empurrada: os Actros 2651 custam ${f0(vis[0].saldo)} L (UGU5D17 a 0,67 km/L) e os 2548 devolvem ${f0(Math.abs(vis[1].saldo))} L. No resto da frota o saldo é pequeno e dos dois lados.`)}
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
  const temEfeito = up => Object.values(D.ativacao[up] || {}).some(x => x.delta != null && Math.abs(x.delta) >= 0.03);
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
  <h2 style="font-size:23px;margin-bottom:6px">A ativação mexe pouco na média: até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}. Em ${semEfeito.length} operações com placas inativas o efeito fica abaixo de 0,03.</h2>
  <div class="grid" style="grid-template-columns:1fr 250px;gap:24px;margin-top:8px;align-items:start">
    <div>
      <table class="densa ativ"><thead><tr><th>Unidade · projeto</th>${meses.map(m => `<th class="r">${MES[m - 1]}</th>`).join('')}<th class="r">Média</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note" style="margin-top:6px;margin-bottom:8px">Célula = média das placas ativas (a que o FT paga) − média de todas as placas da operação com valor no mês. Positivo (vermelho) = a ativação deixou a média mais alta, pior para nós. Abaixo de 0,03 em todos os meses (fora da tabela): ${semEfeito.map(esc).join(' · ')}.</p>
      ${escuro(`<b>Resumo:</b> a ativação não explica o remunerado: o efeito passa de 0,10 km/L só em BLC AS, PLT VAN, GRL UDC ROTA e FLP ROTA, em poucos meses, e as desativações tiram placas abaixo e acima da média na mesma proporção. O que pesa: ${f1(kmInatPct)}% do km do ano rodado por placas fora do ativo, sem régua.`)}
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
  const fq = Object.entries(D.mudRes.foraPorQz).sort((a, b) => b[1].n - a[1].n);
  const fqTxt = fq.slice(0, 3).map(([t, o]) => `${o.n} em ${D.QZ.find(z => z.t === +t)?.label}`).join(', ') + (fq.length > 3 ? ` e mais ${fq.slice(3).reduce((s, x) => s + x[1].n, 0)} espalhadas` : '');
  const lit = D.mudRes.foraLitros;
  S.push(slide(`
  <div class="kicker">4 · Outros erros encontrados</div>
  <h2 style="font-size:28px">Cinco achados para levar à Ambev, do maior para o menor</h2>
  <div class="grid g2" style="gap:22px 30px;margin-top:14px">
    <div class="step"><div class="n">1</div><div><b>${D.erros.ativasZero.length} placas ativas com consumo zero na 1ª abr (matriz anterior)</b><span>Todas nas Empurradas, na quinzena da revisão do Q2: o valor novo entrou com uma quinzena de atraso. Em Piraí, 8 Actros 2548 zeradas enquanto 12 irmãs seguiam com valor. Excel: G4 Ativas zeradas.</span></div></div>
    <div class="step"><div class="n">2</div><div><b>Piraí Empurrada: UGU5D17 a 0,67 km/L</b><span>Em jul, set e out, contra 2,2 das irmãs Actros 2548. É 3× mais litros remunerados para uma placa (a favor); vai ser corrigido na próxima revisão e vale saber o quanto entrou. Excel: G6 Cadastro, mês a mês.</span></div></div>
    <div class="step"><div class="n">3</div><div><b>Cuiabá AS subiu 52% fora da revisão</b><span>RRT3H09 e RRT1D26 (VW 30.280) passaram de 2,21 para 3,36 na 2ª set, sem revisão e sem outra placa do modelo na operação para comparar. Excel: G5 Fora da revisão.</span></div></div>
    <div class="step"><div class="n">4</div><div><b>Placa "TESTE" ativa o ano inteiro</b><span>${D.erros.placaTeste.length} quinzenas em ${esc(D.erros.placaTeste[0]?.up || '')}, a única placa dessa operação, com consumo ${f2(D.erros.placaTeste[0]?.v)} e depois 4,59. Entra na média como se fosse caminhão. Excel: G6 Cadastro, quinzena a quinzena.</span></div></div>
    <div class="step" style="grid-column:1/3"><div class="n">5</div><div><b>${D.mudRes.fora} mudanças de valor fora da revisão</b><span>${fqTxt}. Saldo até setembro: ${f0(Math.abs(lit))} L ${lit > 0 ? 'contra nós' : 'a favor'}, puxado pela queda dos Actros de Piraí Empurrada na 2ª jan (2,39 para 2,12). Ajuste de placa no meio do ciclo não está na regra; vale pedir a trilha de cada um. Excel: G5 Fora da revisão, com os litros de cada mudança.</span></div></div>
  </div>
  <div style="margin-top:18px">${escuro(`<b>Resumo:</b> nenhum desses erros é grande em litros; são erros de cadastro e de processo no FT, e cada um está placa a placa na planilha de cobrança. Corrigir antes da próxima revisão custa pouco e evita que a base do Q1/27 nasça com placa de teste e valor atrasado.`)}</div>`, { cls: 'erros', style: 'padding-top:40px' }));
}

// ── PRÓXIMOS PASSOS ──
S.push(slide(`
  <div class="kicker">O que levar à Ambev</div>
  <h2>Quatro pontos, na ordem de importância</h2>
  <div class="grid g2" style="gap:16px 30px;margin-top:16px">
    <div class="box"><h3>1 · Rodar a revisão do Q4 agora</h3><p>Nenhuma das ${D.q3q4.iguais} placas mudou em outubro: o trimestre inteiro está rodando com a régua de julho. A revisão é trimestral por contrato e a troca do especialista não pode parar o ciclo.</p></div>
    <div class="box"><h3>2 · Uma régua por modelo dentro da operação</h3><p>${D.dispRes.comDif} grupos modelo-mês com valores diferentes para o mesmo modelo, ${D.placaRes.dentroTri} placas mudando fora da revisão. Saldo de ${f0(dispTot.perde - dispTot.ganha)} L contra nós em 9 meses.</p></div>
    <div class="box"><h3>3 · Limpeza do cadastro no FT</h3><p>Placa TESTE, UGU5D17 a 0,67, valor da revisão entrando com uma quinzena de atraso nas Empurradas. Corrigir antes da próxima revisão, para a base do Q1/27 nascer limpa.</p></div>
    <div class="box" style="grid-column:1/3"><h3>4 · Ativação: monitorar, não brigar</h3><p>O efeito na média é pequeno (até +${f2(ativOrd[0].ativMed)} km/L em ${esc(ativOrd[0].up)}) e sem padrão de escolher as melhores. O ponto é outro: ${f1(kmInatPct)}% do km do ano foi rodado por placas inativas no FT, sem régua remunerada. Pedir o critério de ativação por escrito e acompanhar mês a mês com esta mesma matriz.</p></div>
  </div>`));

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Consumo remunerado Km/L · 2026</title>
<link rel="stylesheet" href="../driverpro-apresentacao/base.css">
<style>
  /* só a densidade das tabelas muda; o resto é o base.css do DriverPro */
  table.media{font-size:13.5px} table.media th{padding:7px 9px} table.media td{padding:6px 9px}
  table.compacta{font-size:12.5px} table.compacta th{padding:6px 8px} table.compacta td{padding:5px 8px}
  table.densa{font-size:11.5px} table.densa th{padding:4px 7px} table.densa td{padding:2.5px 7px}
  table.ativ td{padding:2.5px 7px}
  /* padrão clean: cabeçalho com fundo, filete fino, pouca cor */
  table th{background:#EEF0F3;color:var(--ink2);border-bottom:0;font-size:10.5px;letter-spacing:.8px}
  table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
  table td{border-bottom:1px solid #EDEFF2}
  table.clean td.proj{font-weight:700;vertical-align:top;border-right:1px solid #EDEFF2;line-height:1.3}
  table.clean tr.g0 td{border-top:1px solid #D5D9DF}
  table.clean tbody tr.g0:first-child td{border-top:0}
  table.clean tr.med td{font-weight:700;color:var(--ink2);background:#F7F8FA}
  table.clean td.exp{font-size:11.5px;color:var(--ink2);line-height:1.3}
  table.clean.media td{padding:6px 9px} table.clean.compacta td{padding:4px 8px} table.clean.densa td{padding:3px 7px}
  .bloco{margin-bottom:8px} .bloco h3{font-size:15px} .slide.densa .bloco{margin-bottom:5px} .slide.densa .bloco h3{font-size:13.5px} .slide.densa .box.res p{font-size:12.5px;line-height:1.4} .slide.densa .box.res{padding:10px 16px} .slide.densa .note{margin-top:4px;font-size:11.5px}
  .slide .box.res{padding:12px 18px} .slide .box.res p{font-size:13.5px;line-height:1.45}
  .step{margin-bottom:0}
  .slide.erros .step b{font-size:15px} .slide.erros .step span{font-size:13.5px;line-height:1.45} .slide.erros .step .n{flex:0 0 36px;width:36px;height:36px;font-size:15px}
</style></head>
<body>
${S.join('\n')}
</body></html>`;
writeFileSync(OUT, html);
console.log('deck.html', S.length, 'slides');
