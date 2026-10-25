// ============================================================
// Deck "Freightech × nossa remuneração" — layout do DriverPro
// (../driverpro-apresentacao/base.css, embutido para o HTML abrir de
// qualquer pasta), a partir do dados.json de analise.py.
//   FT_DADOS=…/dados.json FT_HTML=…/deck.html node deck.mjs
// O HTML e o PDF NÃO vão para o repositório (remuneração da Ambev).
// ============================================================
import { readFileSync, writeFileSync } from 'node:fs';
const D = JSON.parse(readFileSync(process.env.FT_DADOS || 'dados.json', 'utf8'));
const OUT = process.env.FT_HTML || 'deck.html';
const CSS = readFileSync(new URL('../driverpro-apresentacao/base.css', import.meta.url), 'utf8');

const ACC = '#F22C05', AZUL = '#1F6FEB', INK = '#0F1A20', INK2 = '#4A5563', INK3 = '#8A94A2', LINE = '#E3E6EA', PALE = '#F3F4F6';
const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mi = v => (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
const mil = v => Math.round(v / 1e3).toLocaleString('pt-BR') + ' mil';
const pct = (v, d = 1) => { if (v == null || !isFinite(v)) return '—'; const z = Math.abs(v) < 0.5 / 10 ** d; return (z ? '' : v > 0 ? '+' : '') + (z ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const vl = v => { const [a, m] = v.split('-'); return MES[+m - 1] + '/' + a.slice(2); };
const NOME = D.NOME;
const RODAPE = 'Freightech × nossa remuneração · análise inicial · Conlog';
let N = 1;
const slide = (inner, extra = '') => `<section class="slide"${extra}>${inner}<div class="foot"><span>${RODAPE}</span><span>${N++}</span></div></section>`;
const escuro = txt => `<div class="box res" style="background:${INK}"><p style="color:#F4F5F7">${txt}</p></div>`;
const LOGO = `<div class="logo" style="margin-bottom:38px"><div class="ic"><svg viewBox="0 0 48 48" fill="none"><path d="M10 32h28M14 32V20h12l6 6v6" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="33" r="3" fill="#fff"/><circle cx="31" cy="33" r="3" fill="#fff"/></svg></div><div class="nm">Remuneração <b>Freightech</b></div></div>`;
const S = [];
const capaSec = (kicker, titulo, texto) => S.push(`<section class="slide dark">${LOGO}<div class="kicker">${kicker}</div><h1 style="max-width:980px">${titulo}</h1><p style="margin-top:26px;font-size:16.5px;max-width:820px">${texto}</p><div class="foot"><span>${RODAPE}</span><span>${N++}</span></div></section>`);

// ── gráficos ──
function stack({ w = 1136, h = 300, labels, series, pad = { l: 56, r: 16, t: 26, b: 34 } }) {
  const tot = labels.map((_, i) => series.reduce((s, x) => s + x.data[i], 0));
  const max = Math.max(...tot) * 1.08, bw = (w - pad.l - pad.r) / labels.length;
  const Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}"/><text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${(v / 1e6).toFixed(0)} mi</text>`; }
  labels.forEach((l, i) => {
    let acc = 0; const x = pad.l + bw * i + bw * .16;
    series.forEach(sr => { const v = sr.data[i]; s += `<rect x="${x}" y="${Y(acc + v)}" width="${bw * .68}" height="${Y(acc) - Y(acc + v)}" fill="${sr.cor}"/>`; acc += v; });
    s += `<text x="${x + bw * .34}" y="${Y(acc) - 6}" text-anchor="middle" font-weight="700" fill="${INK}">${(acc / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</text><text x="${x + bw * .34}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`;
  });
  return s + '</svg>';
}
function lines({ w = 1136, h = 280, labels, series, yfmt = f0, pad = { l: 70, r: 20, t: 24, b: 34 } }) {
  const all = series.flatMap(x => x.data); let y0 = Math.min(...all), y1 = Math.max(...all); const a = y1 - y0 || 1; y0 -= a * .25; y1 += a * .2;
  const step = (w - pad.l - pad.r) / (labels.length - 1), X = i => pad.l + step * i, Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="11">`;
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${LINE}"/><text x="${pad.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="${INK3}">${yfmt(v)}</text>`; }
  labels.forEach((l, i) => { s += `<text x="${X(i)}" y="${h - 12}" text-anchor="middle" fill="${INK2}" font-weight="600">${l}</text>`; });
  series.forEach(sr => {
    s += `<path d="${sr.data.map((v, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(v)).join(' ')}" fill="none" stroke="${sr.cor}" stroke-width="3"${sr.dash ? ' stroke-dasharray="7 5"' : ''}/>`;
    sr.data.forEach((v, i) => { s += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="#fff" stroke="${sr.cor}" stroke-width="2.2"/>`; });
  });
  return s + '</svg>';
}
function bars({ w = 560, h = 240, labels, data, cor = INK, fmt = f0, pad = { l: 16, r: 16, t: 24, b: 32 } }) {
  const max = Math.max(...data) * 1.12, bw = (w - pad.l - pad.r) / data.length, Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Montserrat,Arial" font-size="10">`;
  data.forEach((v, i) => { const x = pad.l + bw * i + bw * .14; s += `<rect x="${x}" y="${Y(v)}" width="${bw * .72}" height="${h - pad.b - Y(v)}" rx="2" fill="${typeof cor === 'function' ? cor(i) : cor}"/><text x="${x + bw * .36}" y="${Y(v) - 5}" text-anchor="middle" font-weight="700" fill="${INK}">${fmt(v)}</text><text x="${x + bw * .36}" y="${h - 12}" text-anchor="middle" fill="${INK2}">${labels[i]}</text>`; });
  return s + '</svg>';
}

// ═══════ números derivados ═══════
const C = D.comp, L = C.linhas, ult = C.meses.length - 1;
const totMes = C.meses.map((_, i) => Object.values(L).reduce((s, a) => s + a[i], 0));
const media = a => a.reduce((s, x) => s + x, 0) / a.length;
const part = k => media(L[k]) / media(totMes) * 100;
const FD = D.ftdre_mes, nFD = FD.vig.length;
const soma = k => FD[k].reduce((s, x) => s + x, 0);
const dif = k => (soma(k + '_dre') / soma(k) - 1) * 100;
const KM = D.km_mes, KD = D.km_dec, KC = D.km_canal, KU = D.km_uni;
const kmS = k => KM[k].reduce((s, x) => s + x, 0);
const kmTeto = kmS('km'), kmPago = kmS('Km Rem. TT');
const ultKm = KM.vig[KM.vig.length - 1];
const aprov = o => o['Viagens - Real'] / o['Viagens Rem.'] * 100;
const tudo = Object.values(KC).reduce((a, x) => ({ 'Viagens Rem.': a['Viagens Rem.'] + x['Viagens Rem.'], 'Viagens - Real': a['Viagens - Real'] + x['Viagens - Real'] }), { 'Viagens Rem.': 0, 'Viagens - Real': 0 });
const PG = D.ftdre_pago, pg = k => (PG[k].dre / PG[k].pago - 1) * 100;
const manutSemContr = (PG.manut.dre - PG.contrato_fab) / PG.manut.pago * 100 - 100;
const MZ = D.manut_zero_free, MF = D.manut_faixa, MV = D.manut_velha_uni;
const contr26 = Object.entries(D.dre_contrato).filter(([v]) => v >= '2026-01').reduce((s, [, x]) => s + x, 0);
const mccBaixo = D.comb_baixo.find(x => x.cod === 'MCC');
const AC = D.comb_acima;

// ── 1 · CAPA ──
S.push(`<section class="slide dark">${LOGO}
  <div class="kicker">Freightech · Rota, AS, Empurrada, Insumos e Armazém · 2022–2026</div>
  <h1 style="max-width:1000px">Como o Freightech nos remunera,<br>como isso bate com a nossa DRE<br>e onde pode estar o erro.</h1>
  <p style="margin-top:26px;font-size:16.5px;max-width:860px">Base: 556 mil linhas do FT (38 tabelas, 116 quinzenas, jan/2022 a out/2026), lidas pelo robô direto do Freightech, contra o remunerado da DRE Frota, a Dispersão de km e as abas de consumo. Análise inicial: o que está confirmado aparece como fato; o que depende de regra que só você ou a Ambev sabem aparece como pergunta.</p>
  <div class="foot"><span>Gestão em Movimento · Fortes Indicadores</span><span>Outubro de 2026</span></div>
</section>`); N = 2;

// ── 2 · RESUMO ──
S.push(slide(`
  <div class="kicker">Resumo</div>
  <h2>Quatro achados, do mais seguro ao mais aberto</h2>
  <div class="grid g4" style="margin-top:22px;gap:16px">
    <div class="box"><div class="lbl">1 · A conta do FT fecha</div><div class="num">100%</div><p>dos ${f0(D.comb_regra.diesel_regs)} preços de diesel pagos pela regra (o menor entre o nosso e a ANP), R$/km = soma dos componentes, e lavagem e IPVA do FT batem com o remunerado da DRE a ±1%.</p></div>
    <div class="box"><div class="lbl">2 · O km do FT é o teto</div><div class="num">${aprov(tudo).toFixed(0)}%</div><p>dos mapas possíveis (frota ativa × dias úteis) viraram viagem em jan–${vl(ultKm)}, somando Rota, Van e AS. O FT calcula o variável no teto; o que entra é o mapa rodado. Ao km pago, o combustível da DRE fica ${pct(pg('comb'), 0)} do FT.</p></div>
    <div class="box"><div class="lbl">3 · Manutenção zerada fora da carência</div><div class="num">${MF.mais24.placas} <small>placas</small></div><p>ativas na Rota com mais de 24 meses de vida (mediana ${String(MF.mais24.vida).replace('.', ',')} meses) e R$/km de manutenção zero em 2026. Ao valor do BID: R$ ${mil(MF.mais24.pot)} (jan–out). As ${MF.ate12.placas + MF['12a24'].placas} placas mais novas estão na carência.</p></div>
    <div class="box"><div class="lbl">4 · Preço do diesel</div><div class="num">R$ ${mil(mccBaixo.dif)}</div><p>Macacu, 1ª quinzena de ago/25: diesel lançado a R$ ${f2(mccBaixo.precoOperadora)}/L (ANP R$ ${f2(mccBaixo.precoAnp)}). E quando o nosso preço passa da ANP, a diferença fica conosco: R$ ${mil(AC['2025'].dif)} em 2025.</p></div>
  </div>
  <div style="margin-top:18px">${escuro(`<b>Onde está o dinheiro:</b> na Rota (caminhão + van) o FT paga ~R$ ${mi(media(totMes))} por mês. Só ${part('Total Viagens').toFixed(0)}% disso é o variável por km; ${part('Total Equipe Entrega').toFixed(0)}% é equipe, ${(part('Total Frota Ativa') + part('Total Frota Parada')).toFixed(0)}% é frota (ativa + parada), ${part('Total QLP ADM').toFixed(0)}% QLP e ${part('Total Outras Despesas').toFixed(0)}% outras despesas. O fixo bate; o que ainda não fecha é a manutenção e os pneus da DRE, que ficam acima do FT (${pct(pg('manut'), 0)} e ${pct(pg('pneu'), 0)} ao km pago).`)}</div>`));

// ── PARTE 1 ──
capaSec('Parte 1 de 4', 'Como o FT monta<br>a remuneração.', 'Placa a placa, unidade a unidade, quinzena a quinzena. O que cada tabela faz e as contas que conferimos.');

S.push(slide(`
  <div class="kicker">1 · A estrutura da Rota (a mesma lógica vale para AS e Van)</div>
  <h2>Cada caminhão tem um custo fixo e um R$/km; a unidade soma os ativos e os parados</h2>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:30px;margin-top:16px">
    <div>
      <div class="step"><div class="n">1</div><div><b>Placa (tabela Caminhão)</b><span>Fixo: FINAME ou quitado, lucro, IPVA, seguro, rastreador, faixa. Variável por km: <b>combustível</b> = (preço do diesel + Arla) ÷ Km/L da placa · <b>manutenção</b> = R$/km do contrato (zero no free maintenance) · <b>carroceria</b> = tabela por tipo · <b>pneu</b> = (pneus × preço + recapagens × preço) ÷ vida em km.</span></div></div>
      <div class="step"><div class="n">2</div><div><b>Preço (tabela Combustível)</b><span>Por unidade e quinzena: o nosso preço (das NFs) e o da ANP. O FT paga o menor dos dois.</span></div></div>
      <div class="step"><div class="n">3</div><div><b>Unidade (Resumo Rota / Van)</b><span>Frota ativa + frota parada + equipe de entrega + QLP ADM + outras despesas + <b>viagens</b> (R$/km × km remunerado por caminhão × caminhões ativos). O km remunerado do caminhão é o km por mapa × 25 dias úteis: as viagens do Resumo são o teto. Os valores são mensais; a quinzena repete o mês.</span></div></div>
    </div>
    <div>
      <table class="media"><thead><tr><th>Conta conferida</th><th class="r">Resultado</th></tr></thead><tbody>
        <tr><td>R$/km total = combustível + manutenção + carroceria + pneu</td><td class="r">diferença máx. R$ ${f2(D.ident.rskm_max)}</td></tr>
        <tr><td>Viagens = R$/km × km × caminhões ativos</td><td class="r">mediana R$ ${f0(D.ident.viagens_med)} por unidade</td></tr>
        <tr><td>Preço do diesel pago = menor entre o nosso e a ANP</td><td class="r">${(D.comb_regra.igual_min * 100).toFixed(0)}% de ${f0(D.comb_regra.diesel_regs)}</td></tr>
        <tr><td>Pneu por km = (pneus × preço + recapagens) ÷ vida km</td><td class="r">90% a ±R$ ${f2(D.pneu_formula)}</td></tr>
        <tr><td>Manutenção R$/km = valor do contrato da placa</td><td class="r">95% a ±R$ ${f2(D.manut_regra.rskm_igual_contrato)}</td></tr>
        <tr><td>Lavagem e IPVA do FT × remunerado da DRE (2026)</td><td class="r">${pct(dif('lav'))} · ${pct(dif('ipva'))}</td></tr>
      </tbody></table>
      <p class="note" style="margin-top:8px">As diferenças das duas primeiras linhas são arredondamento do R$/km em 2 casas.</p>
    </div>
  </div>
  <div style="margin-top:12px">${escuro('<b>Resumo:</b> o FT é uma planilha de custo por caminhão. Se a premissa da placa estiver certa (Km/L, contrato, pneus, preço) e a placa estiver ativa, a conta sai certa. Os erros que importam estão no cadastro e nas viagens, não na fórmula.')}</div>`));

S.push(slide(`
  <div class="kicker">2 · Quanto o FT paga na Rota (caminhão + van), por mês</div>
  <h2>~R$ ${mi(media(totMes))} por mês; o variável por km é só ${part('Total Viagens').toFixed(0)}%</h2>
  ${stack({ h: 300, labels: C.meses.map(vl), series: [
    { data: L['Total Viagens'], cor: ACC }, { data: L['Total Equipe Entrega'], cor: INK }, { data: L['Total QLP ADM'], cor: '#5B6673' },
    { data: L['Total Frota Ativa'], cor: '#8A94A2' }, { data: L['Total Frota Parada'], cor: '#BAC1CA' }, { data: L['Total Outras Despesas'], cor: '#DCE0E5' }] })}
  <div style="display:flex;gap:22px;font-size:12px;color:${INK2};margin:4px 0 0 56px">
    ${[['Viagens (variável por km)', ACC], ['Equipe de entrega', INK], ['QLP ADM', '#5B6673'], ['Frota ativa', '#8A94A2'], ['Frota parada', '#BAC1CA'], ['Outras despesas', '#DCE0E5']].map(([t, c]) => `<span><i style="display:inline-block;width:11px;height:11px;background:${c};border-radius:2px;margin-right:6px;vertical-align:-1px"></i>${t} · ${part({ 'Viagens (variável por km)': 'Total Viagens', 'Equipe de entrega': 'Total Equipe Entrega', 'QLP ADM': 'Total QLP ADM', 'Frota ativa': 'Total Frota Ativa', 'Frota parada': 'Total Frota Parada', 'Outras despesas': 'Total Outras Despesas' }[t]).toFixed(0)}%</span>`).join('')}
  </div>
  <div style="margin-top:14px">${escuro(`<b>Resumo:</b> R$ ${mi(media(totMes))} por mês em média de jan a ${vl(C.meses[ult])} (soma das 10 unidades, caminhão + van, pelo Resumo do FT). A frota parada recebe ~R$ ${mil(media(L['Total Frota Parada']))} por mês. Nota: a Rota é a parte que o FT entrega já somada por unidade; AS, Empurrada e Armazém aparecem na Parte 4.`)}</div>`));

// ── PARTE 2 ──
capaSec('Parte 2 de 4', 'Km e DRE:<br>o que bate e o que não bate.', 'Como o km remunerado do FT vira o km pago da Dispersão, e o remunerado da DRE Frota (combustível, manutenção, pneus) contra o FT ao km pago. Rota, Van e AS juntos, porque placa de AS roda mapa de Rota e vice-versa.');

{
  const uni = Object.entries(KU).sort((a, b) => aprov(a[1]) - aprov(b[1]));
  const canal = [['ROTA', 'Rota'], ['ROTA (VAN)', 'Van'], ['AUTO SERVIÇO', 'Auto Serviço']].filter(([k]) => KC[k]);
  const fk = KD.frota + KD.kmmapa;
  S.push(slide(`
  <div class="kicker">3 · Km remunerado: do FT à Dispersão de km (Rota + Van + AS), jan–${vl(ultKm)}</div>
  <h2>O FT calcula o variável no teto, um mapa por dia útil; o que entra é o mapa rodado</h2>
  <div class="grid" style="grid-template-columns:1fr 1.05fr;gap:26px;margin-top:12px;align-items:start">
    <div>
      <table class="media"><thead><tr><th>Do km do FT ao km pago</th><th class="r">Km</th></tr></thead><tbody>
        <tr><td><b>FT:</b> km remunerado do caminhão (km por mapa × 25 dias úteis) × caminhões ativos</td><td class="r"><b>${f0(kmTeto)}</b></td></tr>
        <tr><td>− mapas que não viraram viagem (caminhão ativo sem mapa no dia)</td><td class="r">${f0(-KD.mapas)}</td></tr>
        <tr><td>+ recargas e noturnas (pagas além do mapa)</td><td class="r">+${f0(-KD.recarga)}</td></tr>
        <tr><td>± frota ativa e km por mapa diferentes entre FT e Dispersão</td><td class="r">${fk > 0 ? '' : '+'}${f0(-fk)}</td></tr>
        <tr class="tot"><td><b>Dispersão:</b> km/viagem × viagens realizadas + recargas e noturnas</td><td class="r">${f0(kmPago)}</td></tr>
      </tbody></table>
      <p class="note" style="margin-top:6px">O km por mapa do FT (km remunerado ÷ 25) é o km/viagem da Dispersão: mediana ${(D.km_kmv.mediana * 100).toFixed(0)}% em ${D.km_kmv.n} unidade-projeto-mês. A diferença de frota ativa entre os dois pesa ${pct((KD.frota / kmTeto) * 100)} do km. Os mapas possíveis da tabela usam os dias úteis da Dispersão.</p>
      <table class="compacta" style="margin-top:10px"><thead><tr><th>Canal</th><th class="r">Mapas possíveis</th><th class="r">Viagens</th><th class="r">Aproveitamento</th></tr></thead><tbody>
        ${canal.map(([k, t]) => `<tr><td>${t}</td><td class="r">${f0(KC[k]['Viagens Rem.'])}</td><td class="r">${f0(KC[k]['Viagens - Real'])}</td><td class="r">${aprov(KC[k]).toFixed(0)}%</td></tr>`).join('')}
        <tr class="tot"><td>Juntos (com UDC)</td><td class="r">${f0(tudo['Viagens Rem.'])}</td><td class="r">${f0(tudo['Viagens - Real'])}</td><td class="r">${aprov(tudo).toFixed(0)}%</td></tr>
      </tbody></table>
    </div>
    <div>
      <table class="compacta"><thead><tr><th>Unidade</th><th class="r">Km FT (teto)</th><th class="r">Km pago</th><th class="r">Mapas possíveis</th><th class="r">Viagens</th><th class="r">Aprov.</th></tr></thead><tbody>
        ${uni.map(([k, u]) => `<tr><td>${NOME[k] || k}</td><td class="r">${mil(u.km)}</td><td class="r">${mil(u['Km Rem. TT'])}</td><td class="r">${f0(u['Viagens Rem.'])}</td><td class="r">${f0(u['Viagens - Real'])}</td><td class="r"><b style="color:${aprov(u) < 80 ? ACC : INK}">${aprov(u).toFixed(0)}%</b></td></tr>`).join('')}
      </tbody></table>
      <p class="note" style="margin-top:6px">Mapas possíveis = frota ativa × dias úteis do mês, como a Dispersão calcula. Rota, Van, UDC e AS somados por unidade.</p>
    </div>
  </div>
  <div style="margin-top:10px">${escuro(`<b>Não é erro do FT.</b> O caminhão ativo recebe o fixo inteiro; o variável só entra com viagem. O AS sozinho faz ${aprov(KC['AUTO SERVIÇO']).toFixed(0)}% dos próprios mapas, em parte porque a placa de AS roda mapa de Rota, por isso os canais estão juntos. A frota ativa sem mapa é o que mais pesa: ${uni.slice(0, 3).map(([k, u]) => `${NOME[k]} ${aprov(u).toFixed(0)}%`).join(', ')}. Vale conferir com as unidades se é caminhão sobrando no ativo do FT ou viagem que não entrou no 2art.`)}</div>`));
}

{
  const lin = k => `<tr><td><b>${{ comb: 'Combustível + Arla', manut: 'Manutenção', pneu: 'Pneus' }[k]}</b></td><td class="r">R$ ${mi(PG[k].teto)}</td><td class="r">R$ ${mi(PG[k].pago)}</td><td class="r">R$ ${mi(PG[k].dre)}</td><td class="r"><b style="color:${Math.abs(pg(k)) < 5 ? INK3 : pg(k) > 0 ? AZUL : ACC}">${pct(pg(k))}</b></td></tr>`;
  const uni = Object.entries(D.ftdre_pago_uni).sort((a, b) => a[0].localeCompare(b[0]));
  const cExt = uni.map(([k, u]) => [k, u.comb]).sort((a, b) => b[1] - a[1]).filter(x => x[1] >= 10);
  S.push(slide(`
  <div class="kicker">4 · Remunerado da DRE Frota × FT ao km pago (Rota + Van + AS), jan–${vl(ultKm)}</div>
  <h2>O combustível fecha; a manutenção e os pneus da DRE ficam acima do FT</h2>
  <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:28px;margin-top:14px;align-items:start">
    <div>
      <table class="media"><thead><tr><th>Conta</th><th class="r">FT no teto</th><th class="r">FT ao km pago</th><th class="r">DRE rem.</th><th class="r">DRE ÷ FT pago</th></tr></thead><tbody>
        ${['comb', 'manut', 'pneu'].map(lin).join('')}
        <tr><td>Manutenção sem "Contratos de Manutenção Fabricante"</td><td></td><td class="r">R$ ${mi(PG.manut.pago)}</td><td class="r">R$ ${mi(PG.manut.dre - PG.contrato_fab)}</td><td class="r">${pct(manutSemContr)}</td></tr>
      </tbody></table>
      <p class="note" style="margin-top:8px">FT ao km pago = componentes do FT (Resumo Rota/Van e Caminhão AS) × km da Dispersão ÷ km do FT, unidade a unidade e mês a mês. Lavagem e IPVA, fixos por caminhão, batem a ${pct(dif('lav'))} e ${pct(dif('ipva'))} (jan–${vl(FD.vig[nFD - 1])}).</p>
    </div>
    <div>
      <table class="compacta"><thead><tr><th>Unidade</th><th class="r">Combustível</th><th class="r">Manutenção</th><th class="r">Pneus</th></tr></thead><tbody>
        ${uni.map(([k, u]) => `<tr><td>${NOME[k] || k}</td><td class="r">${pct(u.comb, 0)}</td><td class="r">${pct(u.manut, 0)}</td><td class="r">${pct(u.pneu, 0)}</td></tr>`).join('')}
      </tbody></table>
      <p class="note" style="margin-top:6px">DRE ÷ FT ao km pago, por unidade.</p>
    </div>
  </div>
  <div style="margin-top:12px">${escuro(`<b>Leitura:</b> ao km que foi pago, o combustível da DRE fica ${pct(pg('comb'), 0)} do FT${cExt.length ? `; fora da curva, ${cExt.map(([k, v]) => `${NOME[k]} (${pct(v, 0)})`).join(' e ')}` : ''}. A manutenção da DRE fica ${pct(pg('manut'), 0)} acima, e a diferença é a conta "Contratos de Manutenção Fabricante" (R$ ${mi(PG.contrato_fab)} em jan–${vl(ultKm)}): sem ela, a DRE fica ${Math.abs(manutSemContr).toFixed(0)}% abaixo do FT. Os pneus ficam ${pg('pneu').toFixed(0)}% acima, e acima em todas as unidades. <b>Pergunta:</b> de onde sai o remunerado do contrato do fabricante e dos pneus na DRE?`)}</div>`));
}

// ── PARTE 3 ──
capaSec('Parte 3 de 4', 'Manutenção e combustível:<br>o que está no cadastro.', 'Placas que já passaram da carência da montadora e seguem com R$/km de manutenção zero, e o preço do diesel que entrou errado.');

{
  const uni = Object.entries(MV).sort((a, b) => b[1].pot - a[1].pot);
  const vd = v => String(v).replace('.', ',');
  const fx = [['ate12', 'Até 12 meses', 'carência da montadora'], ['12a24', '12 a 24 meses', 'carência da montadora'], ['mais24', 'Mais de 24 meses', 'a conferir']];
  S.push(slide(`
  <div class="kicker">5 · Manutenção R$/km = 0 em placa ativa da Rota, 2026</div>
  <h2>Placa nova vem zerada pela carência; ${MF.mais24.placas} placas com mais de 24 meses seguem zeradas</h2>
  <div class="grid" style="grid-template-columns:1fr 1.05fr;gap:26px;margin-top:12px;align-items:start">
    <div>
      <table class="media"><thead><tr><th>Vida da placa</th><th class="r">Placas</th><th class="r">Vida mediana</th><th class="r">Ao valor do BID, jan–out</th><th>Leitura</th></tr></thead><tbody>
        ${fx.map(([k, t, l]) => `<tr${k === 'mais24' ? ' style="font-weight:700"' : ''}><td>${t}</td><td class="r">${MF[k].placas}</td><td class="r">${vd(MF[k].vida)} m</td><td class="r">${f0(MF[k].pot)}</td><td>${l}</td></tr>`).join('')}
        <tr class="tot"><td>Total</td><td class="r">${MZ.placas26}</td><td></td><td class="r">${f0(MZ.pot26)}</td><td></td></tr>
      </tbody></table>
      <p class="note" style="margin-top:8px">Regra conferida: o R$/km de manutenção da placa é o valor do contrato (manutencaoContrato). Nessas placas o contrato está zero e o BID tem valor (mediana R$ ${f2(D.manut_velha_bid)}/km nas de mais de 24 meses). O campo free maintenance do FT diz 6 meses, mas a carência da montadora é maior, por isso as placas até 24 meses ficam de fora do achado. Ao valor do BID = BID × km do mês da placa.</p>
    </div>
    <div>
      <table class="compacta"><thead><tr><th>Unidade · mais de 24 meses</th><th class="r">Placas</th><th class="r">Vida mediana</th><th class="r">Ao valor do BID</th></tr></thead><tbody>
        ${uni.map(([k, u]) => `<tr><td>${NOME[k] || k}</td><td class="r">${u.placas}</td><td class="r">${vd(u.vida)} m</td><td class="r"><b>${f0(u.pot)}</b></td></tr>`).join('')}
        <tr class="tot"><td>Total</td><td class="r">${MF.mais24.placas}</td><td class="r">${vd(MF.mais24.vida)} m</td><td class="r">${f0(MF.mais24.pot)}</td></tr>
      </tbody></table>
      <p class="note" style="margin-top:6px">Modelos: ${Object.entries(D.manut_velha_mod).map(([m, q]) => `${m} (${q})`).join(', ')}.</p>
    </div>
  </div>
  <div style="margin-top:10px">${escuro(`<b>Duas leituras possíveis para as ${MF.mais24.placas}:</b> (a) estão num contrato do fabricante pago por fora do R$/km, o que conversa com a conta "Contratos de Manutenção Fabricante" no remunerado da DRE (R$ ${mi(contr26)} em 2026); ou (b) o contrato da placa não foi cadastrado no FT e a manutenção delas não está sendo remunerada. Cuiabá e Nova Friburgo concentram ${Math.round((MV.CBA.pot + MV.NFR.pot) / MF.mais24.pot * 100)}% do valor. <b>Pergunta:</b> essas ${MF.mais24.placas} estão no contrato do fabricante?`)}</div>`));
}

S.push(slide(`
  <div class="kicker">6 · Combustível</div>
  <h2>A regra do preço é aplicada à risca; o problema é o preço que entra</h2>
  <div class="grid g3" style="margin-top:18px;gap:18px">
    <div class="box"><div class="lbl">Regra</div><div class="num">${(D.comb_regra.igual_min * 100).toFixed(0)}%</div><p>dos ${f0(D.comb_regra.diesel_regs)} preços de diesel (Rota, 2022–2026) pagos pelo menor entre o nosso e a ANP. O R$/km da placa embute a Arla (~R$ 0,20/L a mais). Ao km pago, o combustível da DRE fica ${pct(pg('comb'), 0)} do FT.</p></div>
    <div class="box"><div class="lbl">Preço errado · Macacu</div><div class="num">R$ ${f2(mccBaixo.precoOperadora)}<small>/L</small></div><p>1ª quinzena de ago/25: o diesel S10 de Macacu entrou a R$ ${f2(mccBaixo.precoOperadora)} (ANP R$ ${f2(mccBaixo.precoAnp)}). O FT pagou R$ ${f2(mccBaixo.pago)}/L em ${mccBaixo.placas} placas, ~${f0(mccBaixo.lit)} L: <b>R$ ${f0(mccBaixo.dif)}</b> a menos se o preço real era o da ANP. Conferir se houve retroativo.</p></div>
    <div class="box"><div class="lbl">Nosso preço acima da ANP</div><div class="num">R$ ${mil(AC['2025'].dif)}</div><p>em 2025 (${AC['2025'].quinzenas} quinzenas, ${AC['2025'].uni.map(u => NOME[u]).join(', ')}): quando o nosso diesel passa da ANP, o FT paga a ANP e a diferença fica conosco. Em 2024 foram R$ ${mil(AC['2024'].dif)}; em 2026, nenhuma quinzena até aqui.</p></div>
  </div>
  <div style="margin-top:18px">${escuro(`<b>Resumo:</b> o FT não erra a regra do preço; erra quando o preço lançado está errado, e cobra de nós quando compramos acima da ANP. Os preços muito abaixo da ANP de Florianópolis em 2022–2023 são do tanque interno (preço real) e não entram como erro. Os VW elétricos do Rio ficam fora: a energia entra na conta de luz do CD, paga pela Ambev. A conferência quinzenal do nosso preço contra a ANP pode ser automática a partir desta base.`)}</div>`));

// ── PARTE 4 ──
capaSec('Parte 4 de 4', 'AS, Empurrada e Armazém,<br>e o que levar.', 'Os outros canais têm outra estrutura. O que já dá para afirmar e as perguntas que destravam a próxima etapa.');

{
  const A = D.km_canal_uni['AUTO SERVIÇO'] || {};
  const lin = Object.entries(A).map(([k, u]) => `<tr><td>${NOME[k] || k}</td><td class="r">${f0(u['Frota Ativa'])}</td><td class="r">${f0(u['Viagens Rem.'])}</td><td class="r">${f0(u['Viagens - Real'])}</td><td class="r">${aprov(u).toFixed(0)}%</td><td class="r">${KU[k] ? aprov(KU[k]).toFixed(0) + '%' : '—'}</td></tr>`).join('');
  S.push(slide(`
  <div class="kicker">7 · Os outros canais</div>
  <h2>AS: mesma conta da Rota, placa a placa. Empurrada: por trecho. Armazém: por equipamento.</h2>
  <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:26px;margin-top:12px;align-items:start">
    <div>
      <h3>Auto Serviço · jan–${vl(ultKm)}</h3>
      <table class="compacta"><thead><tr><th>Unidade</th><th class="r">Frota ativa (cam.-mês)</th><th class="r">Mapas AS possíveis</th><th class="r">Viagens AS</th><th class="r">Aprov. AS</th><th class="r">Aprov. da unidade</th></tr></thead><tbody>${lin}
        <tr class="tot"><td>Total</td><td class="r">${f0(KC['AUTO SERVIÇO']['Frota Ativa'])}</td><td class="r">${f0(KC['AUTO SERVIÇO']['Viagens Rem.'])}</td><td class="r">${f0(KC['AUTO SERVIÇO']['Viagens - Real'])}</td><td class="r">${aprov(KC['AUTO SERVIÇO']).toFixed(0)}%</td><td class="r">${aprov(tudo).toFixed(0)}%</td></tr></tbody></table>
      <p class="note" style="margin-top:6px">O km do AS no FT também é o teto (km por mapa × 25 dias úteis, por placa ativa). A placa de AS roda mapa de Rota e vice-versa: no AS sozinho o aproveitamento parece baixo, mas a viagem aparece na Rota. Por isso o km e a DRE estão comparados com os canais juntos (slides 3 e 4). Pelotas AS entra na Rota na DRE.</p>
    </div>
    <div>
      <div class="box" style="padding:16px 20px;margin-bottom:12px"><h3>Empurrada e Insumos</h3><p>Fixo por unidade (equipamento ativo e parado, equipe, QLP, outras; em 2026, ~R$ ${mi(D.emp_fixo.PIRAI)}/mês em Piraí, R$ ${mi(D.emp_fixo.MACACU)} em Macacu, R$ ${mi(D.emp_fixo.CUIABA)} em Cuiabá, valor de CTRC) + variável por trecho: ${f0(D.emp_trechos.MACACU + D.emp_trechos.PIRAI + D.emp_trechos.CUIABA)} trechos por quinzena, cada um com R$/km de diesel (pelo Km/L do trecho), pneu, manutenção, salário variável, pedágio e lucro. Manutenção dos cavalos: só ${D.emp_manut.zero_depois} de ${f0(D.emp_manut.regs)} registros zerados fora do free maintenance.</p></div>
      <div class="box" style="padding:16px 20px"><h3>Armazém</h3><p>Mensal (a 1ª quinzena só): empilhadeira, operador, ajudante, amarrador, gás, gestão e variável por horímetro, com valor faturado, líquido e SAP por item.</p></div>
    </div>
  </div>`));
}

{
  const piores = Object.entries(KU).sort((a, b) => aprov(a[1]) - aprov(b[1])).slice(0, 3).map(([k]) => NOME[k]);
  S.push(slide(`
  <div class="kicker">8 · Próximos passos</div>
  <h2>O que levar, o que perguntar e o que vem depois</h2>
  <div class="grid g3" style="margin-top:16px;gap:18px">
    <div class="box"><h3>Levar à Ambev</h3><p>1. Diesel de Macacu na 1ª quinzena de ago/25 (R$ ${f2(mccBaixo.precoOperadora)}/L): retroativo de ~R$ ${mil(mccBaixo.dif)}.<br>2. Contrato de manutenção das ${MF.mais24.placas} placas com mais de 24 meses e R$/km zero, se não estiverem no contrato do fabricante (até R$ ${mil(MF.mais24.pot)} em 2026).</p></div>
    <div class="box"><h3>Conferir aqui dentro</h3><p>1. Frota ativa sem mapa (${(100 - aprov(tudo)).toFixed(0)}% dos mapas possíveis): ${piores.join(', ')} primeiro. É caminhão sobrando no ativo do FT ou viagem que não entrou no 2art?<br>2. Como o remunerado da DRE é montado para o contrato do fabricante e para pneus (${pg('pneu').toFixed(0)}% acima do FT).<br>3. Compra acima da ANP: a diferença é nossa.</p></div>
    <div class="box"><h3>Depois deste PDF</h3><p>1. Painel <b>Remuneração</b> com essa base, atualizada todo dia às 05:00.<br>2. Alertas automáticos: preço fora da ANP, caminhão ativo sem mapa, manutenção zerada fora da carência.<br>3. Orçamento da próxima semana a partir do histórico do FT.</p></div>
  </div>
  <div style="margin-top:18px">${escuro('<b>Base desta análise:</b> robô do Freightech (todas as quinzenas desde jan/2022, 5 canais, 38 tabelas) × DRE Frota, Dispersão de km e abas de consumo, todos lidos do banco do portal. Os números são reproduzíveis e passam a se atualizar sozinhos.')}</div>`));
}

writeFileSync(OUT, `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Remuneração Freightech · análise inicial</title>
<style>${CSS}
  .kicker{font-size:11px} h1{font-size:42px} h2{font-size:28px} h3{font-size:15px} p{font-size:15px}
  .box h3{font-size:15px} .box p{font-size:13px} .num{font-size:34px} .num small{font-size:15px} .lbl{font-size:10.5px}
  .step{margin-bottom:12px} .step b{font-size:14.5px} .step span{font-size:12.5px} .note{font-size:11px;color:var(--ink3);line-height:1.4} .foot{font-size:10.5px}
  table{font-size:13px} table.media th{padding:7px 9px} table.media td{padding:7px 9px} table.media{font-size:12.5px}
  table.compacta{font-size:11.5px} table.compacta th{padding:6px 8px} table.compacta td{padding:5px 8px}
  table th{background:#EEF0F3;color:var(--ink2);border-bottom:0;font-size:9.5px;letter-spacing:.8px}
  table th:first-child{border-radius:8px 0 0 8px} table th:last-child{border-radius:0 8px 8px 0}
  table td{border-bottom:1px solid #EDEFF2}
  .slide .box.res{padding:12px 18px} .slide .box.res p{font-size:12.5px;line-height:1.45}
</style></head><body>${S.join('\n')}</body></html>`);
console.log('ok', OUT, S.length, 'slides');
