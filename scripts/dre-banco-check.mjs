// ============================================================
// A Visão Financeira pode sair do gviz? — planilha × banco, aba por aba
//
// Antes de trocar a fonte de um painel, os dois lados têm de bater. É a regra
// que o Km/L seguiu em 10/09/2026 e é o que separa "migrei" de "migrei e
// quebrei sem ninguém ver".
//
// Compara as TRÊS abas do DRE que a Visão Financeira lê — Frota, EBITDA e
// Receita Líquida — contra sh_dre_frota / sh_dre_ebitda / sh_dre_receita:
// nº de linhas, Σ orçado, Σ remunerado e Σ realizado, no total, por vigência
// e por unidade. Diferença acima de 1 centavo aparece na tela.
//
// ⚠️ LEIA ANTES DE CONFIAR NO RESULTADO: se alguém estiver com FILTRO na aba
// do Sheets, o gviz devolve só as linhas visíveis e o lado "planilha" vem
// menor — o que este check vai mostrar como divergência enorme. Nesse caso o
// errado é a planilha, não o banco. O robô do Sheets recusa carga que encolha
// mais de 40%, então a tabela guarda a última boa.
//
// Não grava nada. Roda no Actions — o sandbox não alcança o docs.google.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const DRE = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';

const ABAS = [
  { aba: 'Frota',           tabela: 'sh_dre_frota' },
  { aba: 'EBITDA',          tabela: 'sh_dre_ebitda' },
  { aba: 'Receita Líquida', tabela: 'sh_dre_receita' },
];

const n = v => (v == null ? '—' : (+v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const num = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/\s|R\$/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const f = parseFloat(s); return isNaN(f) ? 0 : f;
};
// a célula de data do gviz vem como a STRING "Date(2021,0,1)" — não é ISO
const vigDe = v => {
  if (v == null || v === '') return '';
  const m = String(v).match(/^Date\((\d{4}),(\d{1,2}),/);
  if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}`;
  const i = String(v).match(/^(\d{4})-(\d{2})/);
  if (i) return `${i[1]}-${i[2]}`;
  const br = String(v).match(/^(\d{2})\/(\d{4})$/);
  if (br) return `${br[2]}-${br[1]}`;
  const d = String(v).match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  if (d) return `${d[2]}-${d[1]}`;
  return String(v);
};

async function gviz(aba) {
  const url = `https://docs.google.com/spreadsheets/d/${DRE}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(aba)}`;
  const r = await fetch(url);
  const raw = await r.text();
  const json = JSON.parse(raw.replace(/^[\s\S]*?\(/, '').replace(/\);?\s*$/, ''));
  if (json.status !== 'ok') throw new Error('gviz: ' + (json.errors?.[0]?.message || 'erro'));
  const header = (json.table.cols || []).map(c => (c && c.label) || '');
  const rows = (json.table.rows || []).map(r2 => (r2.c || []).map(c => (c && c.v != null ? c.v : null)));
  return { header, rows };
}
async function tabela(nome) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${nome}?select=*&order=linha.asc`,
      { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${nome} → ${r.status} ${(await r.text()).slice(0, 160)}`);
    const p = await r.json(); out.push(...p);
    if (p.length < 1000) return out;
  }
}
const idx = (header, ...nomes) => {
  const nc = header.map(norm);
  for (const x of nomes) { const i = nc.indexOf(norm(x)); if (i >= 0) return i; }
  for (const x of nomes) { const i = nc.findIndex(c => c.includes(norm(x))); if (i >= 0) return i; }
  return -1;
};

// soma por chave, dos dois lados, na MESMA função — medir com réguas
// diferentes mediria a diferença entre as réguas
const agrega = (linhas, chave) => {
  const m = new Map();
  for (const l of linhas) {
    const k = chave(l) || '(vazio)';
    const a = m.get(k) || { n: 0, orc: 0, rem: 0, real: 0 };
    a.n++; a.orc += l.orc; a.rem += l.rem; a.real += l.real;
    m.set(k, a);
  }
  return m;
};
const difere = (a, b) => !a || !b || a.n !== b.n
  || Math.abs(a.orc - b.orc) > 0.01 || Math.abs(a.rem - b.rem) > 0.01 || Math.abs(a.real - b.real) > 0.01;

console.log('═══ Visão Financeira: planilha × banco ═══\n');
let problemas = 0;

for (const { aba, tabela: tab } of ABAS) {
  console.log(`━━ ${aba}  ×  ${tab}`);
  let gv, bc;
  try { gv = await gviz(aba); } catch (e) { console.log('   planilha: ERRO —', e.message, '\n'); problemas++; continue; }
  try { bc = await tabela(tab); } catch (e) {
    console.log('   banco: ERRO —', e.message);
    if (/PGRST205|does not exist|schema cache/i.test(e.message))
      console.log('   → a tabela ainda não existe: rodar o SQL do Sheets DDL e o robô do Sheets.\n');
    problemas++; console.log(''); continue;
  }

  const i = {
    vig: idx(gv.header, 'vigência', 'vigencia'), uni: idx(gv.header, 'unidade'),
    orc: idx(gv.header, 'orçado', 'orcado'), rem: idx(gv.header, 'remunerado'), real: idx(gv.header, 'realizado'),
  };
  const P = gv.rows.map(r => ({
    vig: vigDe(i.vig >= 0 ? r[i.vig] : null), uni: String(i.uni >= 0 ? r[i.uni] || '' : '').trim(),
    orc: num(i.orc >= 0 ? r[i.orc] : 0), rem: num(i.rem >= 0 ? r[i.rem] : 0), real: num(i.real >= 0 ? r[i.real] : 0),
  }));
  const B = bc.map(l => ({
    vig: vigDe(l.vigencia_orig || l.vigencia), uni: String(l.unidade || '').trim(),
    orc: num(l.orcado), rem: num(l.remunerado), real: num(l.realizado),
  }));

  const tot = x => x.reduce((a, l) => ({ n: a.n + 1, orc: a.orc + l.orc, rem: a.rem + l.rem, real: a.real + l.real }),
    { n: 0, orc: 0, rem: 0, real: 0 });
  const tp = tot(P), tb = tot(B);
  console.log(`   planilha: ${n(tp.n)} linhas · orç ${n(tp.orc)} · rem ${n(tp.rem)} · real ${n(tp.real)}`);
  console.log(`   banco:    ${n(tb.n)} linhas · orç ${n(tb.orc)} · rem ${n(tb.rem)} · real ${n(tb.real)}`);
  const bateTotal = !difere(tp, tb);
  console.log(`   total: ${bateTotal ? 'BATE' : 'DIVERGE'}`);
  if (!bateTotal) {
    problemas++;
    if (tp.n < tb.n * 0.6) console.log('   ⚠️  a PLANILHA veio bem menor: a aba provavelmente está FILTRADA no Sheets.');
  }

  for (const [rot, chave] of [['vigência', l => l.vig], ['unidade', l => l.uni]]) {
    const mp = agrega(P, chave), mb = agrega(B, chave);
    const chaves = [...new Set([...mp.keys(), ...mb.keys()])].sort();
    const ruins = chaves.filter(k => difere(mp.get(k), mb.get(k)));
    console.log(`   por ${rot}: ${chaves.length} chave(s) · ${ruins.length} divergente(s)`);
    ruins.slice(0, 12).forEach(k => {
      const a = mp.get(k), b = mb.get(k);
      const f = x => x ? `${x.n}l orç ${n(x.orc)} rem ${n(x.rem)} real ${n(x.real)}` : 'não existe';
      console.log(`      ${k}:  planilha ${f(a)}  ×  banco ${f(b)}`);
    });
    if (ruins.length > 12) console.log(`      … e mais ${ruins.length - 12}`);
    if (ruins.length) problemas++;
  }
  console.log('');
}

console.log(problemas
  ? `✗ ${problemas} ponto(s) de divergência — NÃO trocar a fonte do painel antes de entender cada um.`
  : '✓ os dois lados batem nas três abas: a Visão Financeira pode ler do banco.');
process.exit(problemas ? 1 : 0);
