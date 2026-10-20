// A fca passou de 1.000 linhas e o FCA · Admin parou de mostrar RON (bug real, 20/10/2026, Renan:
// "Cadê Rondo?"). O PostgREST corta cada leitura em 1.000 linhas; ordenada por unidade, RON é a última.
// Este teste roda o fcaTudo DE CADA PÁGINA (extraído do próprio arquivo) contra um cliente dublado que
// corta em 1.000 como o servidor, e confere que todas as linhas voltam. Também mostra o lado antigo
// (uma leitura só) perdendo RON, senão o teste não prova nada.
import fs from 'node:fs';
import vm from 'node:vm';

const PAGS = ['fca-consolidado', 'fca-gerencial', 'fca', 'painel-metas', 'gestao-a-vista', 'fca-preenchimento', 'check-metas'];
const UNIS = ['ANG', 'BLC', 'CBA T1', 'CBA T2', 'CGR', 'FLP', 'GRL', 'MCC T2', 'NFR', 'PIR', 'PLT', 'RON'];
const LINHAS = [];
for (let i = 0; i < 2350; i++) LINHAS.push({ id: i + 1, unidade: UNIS[Math.min(UNIS.length - 1, Math.floor(i / 196))], origem: i % 3 ? 'Custos' : 'RPM' });
const TETO = 1000;

function cliente() {
  return { from(t) {
    const q = { _f: {}, _ord: [], _r: null };
    q.select = () => q;
    q.eq = (c, v) => { q._f[c] = v; return q; };
    q.order = (c, o) => { q._ord.push([c, !o || o.ascending !== false]); return q; };
    q.range = (a, b) => { q._r = [a, b]; return q; };
    q.then = (res, rej) => {
      let d = LINHAS.filter(r => Object.entries(q._f).every(([c, v]) => r[c] === v));
      d = d.slice().sort((x, y) => { for (const [c, asc] of q._ord) { if (x[c] < y[c]) return asc ? -1 : 1; if (x[c] > y[c]) return asc ? 1 : -1; } return 0; });
      const a = q._r ? q._r[0] : 0, b = q._r ? Math.min(q._r[1], a + TETO - 1) : TETO - 1;
      return Promise.resolve({ data: d.slice(a, b + 1), error: null }).then(res, rej);
    };
    return q;
  } };
}

let ok = 0, falha = 0;
const af = (c, m, x) => { if (c) { ok++; console.log('  ok   ' + m); } else { falha++; console.log('  FALHA ' + m + (x != null ? '  (' + JSON.stringify(x) + ')' : '')); } };

// o lado antigo: uma leitura só
{
  const { data } = await cliente().from('fca').select('*').order('unidade', { ascending: true });
  af(data.length === TETO && !data.some(r => r.unidade === 'RON'), 'leitura antiga (uma só) para em 1.000 e perde RON', data.length);
}

for (const p of PAGS) {
  const src = fs.readFileSync(new URL('../' + p + '/index.html', import.meta.url), 'utf8');
  const m = src.match(/async function fcaTudo\([^]*?\n/);
  af(!!m, p + ': tem o fcaTudo');
  if (!m) continue;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(m[0] + ';this.fcaTudo=fcaTudo;', ctx);
  const { data, error } = await ctx.fcaTudo(cliente(), '*', q => q.order('unidade', { ascending: true }));
  af(!error && data.length === LINHAS.length, p + ': lê as ' + LINHAS.length + ' linhas', data && data.length);
  af(data && new Set(data.map(r => r.id)).size === LINHAS.length, p + ': sem linha repetida');
  af(data && data.filter(r => r.unidade === 'RON').length === LINHAS.filter(r => r.unidade === 'RON').length, p + ': RON inteira');
  const rpm = await ctx.fcaTudo(cliente(), 'vigencia', q => q.eq('origem', 'RPM'));
  af(rpm.data.length === LINHAS.filter(r => r.origem === 'RPM').length, p + ': com filtro, lê só o filtrado e inteiro', rpm.data.length);
  // a página não pode mais ler a fca inteira sem paginar
  const cru = (src.match(/from\('fca'\)\.select\(/g) || []).length;
  af(cru === 1, p + ': a única leitura direta da fca é a de dentro do fcaTudo', cru);
}
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
