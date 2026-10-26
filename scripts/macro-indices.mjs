// ============================================================
// Índices macroeconômicos para a análise do Freightech (2019 → hoje).
// Lê o SGS do Banco Central (API pública, JSON) e grava docs/analise-freightech/macro.json
// no branch temporário tmp-analise-dump (o workflow faz o push). Nada sensível:
// são séries públicas. O sandbox da sessão não alcança api.bcb.gov.br, por isso
// roda no Actions.
//   MACRO_OUT=/tmp/macro.json node scripts/macro-indices.mjs
// ============================================================
import fs from 'node:fs';

const SERIES = {
  ipca:        { id: 433,  nome: 'IPCA (var. % mensal)', tipo: 'var' },
  igpm:        { id: 189,  nome: 'IGP-M (var. % mensal)', tipo: 'var' },
  ipa_m:       { id: 225,  nome: 'IPA-M (var. % mensal)', tipo: 'var' },
  selic_meta:  { id: 432,  nome: 'Selic meta (% a.a.)', tipo: 'nivel' },
  tjlp:        { id: 256,  nome: 'TJLP (% a.a.)', tipo: 'nivel' },
  cambio:      { id: 3698, nome: 'Câmbio USD venda, média mensal (R$)', tipo: 'nivel' },
  sal_minimo:  { id: 1619, nome: 'Salário mínimo (R$)', tipo: 'nivel' },
  inpc:        { id: 188,  nome: 'INPC (var. % mensal)', tipo: 'var' },
  desemprego:  { id: 24369, nome: 'Taxa de desocupação PNAD (%)', tipo: 'nivel' },
  ibc_br:      { id: 24364, nome: 'IBC-Br (índice, proxy do PIB mensal)', tipo: 'nivel' },
};
const INI = process.env.MACRO_INI || '01/01/2019';
const hoje = new Date(); const FIM = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;

async function sgs(id) {
  const u = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${id}/dados?formato=json&dataInicial=${INI}&dataFinal=${FIM}`;
  for (let t = 1; ; t++) {
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    if (r.ok) return r.json();
    if (t >= 4) throw new Error(`${r.status} série ${id}`);
    await new Promise(x => setTimeout(x, 2000 * t));
  }
}
const out = { gerado_em: new Date().toISOString(), inicio: INI, series: {} };
for (const [k, s] of Object.entries(SERIES)) {
  try {
    const d = await sgs(s.id);
    const pts = d.map(x => ({ d: x.data, v: parseFloat(String(x.valor).replace(',', '.')) })).filter(x => isFinite(x.v));
    // por mês (AAAA-MM): nível = último do mês; variação = valor do mês
    const mes = {};
    for (const p of pts) { const [dd, mm, aa] = p.d.split('/'); mes[`${aa}-${mm}`] = p.v; }
    // acumulado anual das variações (índice base dez do ano anterior) e média anual dos níveis
    const anos = {};
    for (const [m, v] of Object.entries(mes)) { const a = m.slice(0, 4); (anos[a] ||= []).push(v); }
    const ano = {};
    for (const [a, vs] of Object.entries(anos)) ano[a] = s.tipo === 'var' ? +((vs.reduce((p, v) => p * (1 + v / 100), 1) - 1) * 100).toFixed(2) : +(vs.reduce((p, v) => p + v, 0) / vs.length).toFixed(3);
    out.series[k] = { ...s, mes, ano, n: pts.length };
    console.log(k, s.id, pts.length, 'pontos', Object.keys(mes).slice(-1)[0]);
  } catch (e) { out.series[k] = { ...s, erro: e.message }; console.log(k, 'FALHOU', e.message); }
}
fs.writeFileSync(process.env.MACRO_OUT || 'macro.json', JSON.stringify(out, null, 1));
console.log('gravado', process.env.MACRO_OUT || 'macro.json');
