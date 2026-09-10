// ============================================================
// PAINEL DE METAS — o que a aba fonte tem e o que falta no mês
// (Renan, 10/09/2026: "Mas o que falta do painel de metas?")
//
// O painel calcula quase tudo sozinho, mas monta a lista de vigências a partir
// das LINHAS da aba: mês sem linha não existe na tela. Esta sonda diz, por
// vigência, quantos indicadores estão lançados, e devolve o bloco do último
// mês preenchido pronto para colar no mês seguinte.
//
// Também marca quais indicadores o painel calcula (a coluna Real da aba é
// ignorada neles) e quais dependem do que estiver escrito ali.
//
// Uso: [METAS_VIG=2026-08] node scripts/metas-aba-inspect.mjs
// ============================================================
const WB = '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o';
const GID = '199351909';
const ALVO = process.env.METAS_VIG || '';   // AAAA-MM

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// a MESMA classificação do painel-metas/index.html — se divergir, a sonda mente
function classify(nome) {
  const n = String(nome || '').toLowerCase();
  if (/ranking/.test(n)) return 'rank';
  if (/dispers/.test(n)) return 'disp';
  if (/dpo|vpo|sustent/.test(n)) return 'dpo';
  if (/consolida|fca/.test(n)) return 'fca';
  if (/custo/.test(n)) return 'custo';
  return 'other';
}
const CALCULA = { rank: 'Frota de Elite', disp: 'Dispersão de km', dpo: 'aba DPO', fca: 'aba FCA Total', custo: 'DRE Frota' };

const parseD = v => {
  const m = String(v || '').match(/^Date\((\d+),(\d+),(\d+)/);
  return m ? new Date(+m[1], +m[2], +m[3]) : null;
};
const vigStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const cel = c => (c && c.v != null ? c.v : null);
const txt = c => String(c && (c.f != null ? c.f : c.v) != null ? (c.f != null ? c.f : c.v) : '').trim();

const url = `https://docs.google.com/spreadsheets/d/${WB}/gviz/tq?gid=${GID}&tqx=out:json`;
const bruto = await (await fetch(url)).text();
const j = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1));
if (j.status !== 'ok') { console.error('gviz recusou:', j.status, JSON.stringify(j.errors || [])); process.exit(1); }

const cols = (j.table.cols || []).map(c => c && c.label ? c.label : '');
console.log('colunas da aba: ' + cols.map((c, i) => `${i}=${c || '(sem rótulo)'}`).join(' · ') + '\n');

const linhas = (j.table.rows || []).map(r => r.c || []);
const porVig = new Map();
linhas.forEach(c => {
  const d = parseD(cel(c[0]));
  if (!d || !cel(c[1])) return;                       // o painel exige vigência E indicador
  const k = vigStr(d);
  if (!porVig.has(k)) porVig.set(k, []);
  porVig.get(k).push(c);
});

const vigs = [...porVig.keys()].sort();
console.log(`${linhas.length} linha(s) na aba · ${vigs.length} vigência(s)\n`);
console.log('vigência   indicadores');
vigs.forEach(v => {
  const n = porVig.get(v).length;
  console.log(`  ${v}      ${String(n).padStart(3)}`);
});

// ── peso e meta mudam de mês para mês? ──
// É o que decide se repetir a estrutura do último mês é seguro. Meta que varia
// não pode ser herdada; meta que o painel recalcula da origem não vem daqui.
console.log('\n── peso e meta por vigência ──');
const nomes = [...new Set(linhas.map(c => txt(c[1])).filter(Boolean))];
nomes.forEach(nome => {
  const serie = vigs.map(v => {
    const c = (porVig.get(v) || []).find(x => txt(x[1]) === nome);
    return c ? `${txt(c[2])}/${txt(c[6]) || '—'}` : '·';
  });
  const distintos = [...new Set(serie.filter(s => s !== '·'))];
  const tipo = classify(nome);
  console.log(nome.slice(0, 40).padEnd(42) + serie.map(s => s.padStart(11)).join('')
    + (distintos.length > 1 ? '   ⚠ VARIA' : '   constante')
    + (tipo === 'custo' ? ' · meta vem do DRE do mês, a aba não manda' : ''));
});
console.log('(peso/meta em cada mês; ⚠ VARIA = não dá para herdar do mês anterior)');

const ultima = vigs[vigs.length - 1];
const alvo = ALVO || (() => {                          // default: o mês seguinte ao último
  const [a, m] = ultima.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
})();

console.log(`\núltimo mês preenchido: ${ultima} · alvo: ${alvo}`);
if (porVig.has(alvo)) {
  console.log(`✔ ${alvo} já tem ${porVig.get(alvo).length} indicador(es) — nada a colar.`);
  process.exit(0);
}

// ── o que cada indicador do último mês exige ──
const modelo = porVig.get(ultima);
console.log(`\n── os ${modelo.length} indicadores de ${ultima} ──`);
console.log('indicador'.padEnd(46) + 'peso'.padStart(5) + '  meta'.padStart(10) + '   Real vem de');
modelo.forEach(c => {
  const nome = txt(c[1]), tipo = classify(nome);
  console.log(txt(c[1]).slice(0, 44).padEnd(46)
    + String(txt(c[2])).padStart(5)
    + String(txt(c[6])).padStart(10)
    + '   ' + (CALCULA[tipo] ? 'calculado · ' + CALCULA[tipo] : '⚠ DA PRÓPRIA ABA (coluna Real)'));
});

const mao = modelo.filter(c => classify(txt(c[1])) === 'other');
console.log(`\n${modelo.length - mao.length} de ${modelo.length} o painel calcula sozinho`
  + (mao.length ? `; ${mao.length} depende(m) do que estiver escrito na aba` : '; nenhum depende da aba'));

// ── bloco pronto para colar ──
// TSV: cola direto na primeira linha vazia da aba, já com a data do mês alvo
const [aa, mm] = alvo.split('-');
const dataBR = `01/${mm}/${aa}`;
const nCols = Math.max(...modelo.map(c => c.length), cols.length);
console.log(`\n── COLE ISTO na aba (${modelo.length} linhas, TAB entre as colunas) ──`);
console.log(`── a 1ª coluna já vem com ${dataBR}; Real/Ating./Pontos ficam vazios porque o painel calcula ──`);
modelo.forEach(c => {
  const saida = [];
  for (let i = 0; i < nCols; i++) {
    if (i === 0) { saida.push(dataBR); continue; }
    if (i >= 7 && i <= 9 && classify(txt(c[1])) !== 'other') { saida.push(''); continue; }
    saida.push(txt(c[i]));
  }
  console.log(saida.join('\t'));
});
console.log(`── fim (${modelo.length} linhas) ──`);
console.log(`\nmês/ano: se a aba tiver colunas de mês e ano separadas, conferir acima nos rótulos.`);
