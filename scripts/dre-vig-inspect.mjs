// ============================================================
// O QUE A DRE TEM POR VIGÊNCIA (Renan, 09/09/2026: "sem dados em agosto?")
//
// A Visão Financeira abriu em AGO/26 com Realizado e Remunerado zerados e a
// linha do AV caindo para zero. Antes de mexer em painel, este script diz o
// que existe na PLANILHA: por vigência, quantas linhas e a soma de orçado,
// remunerado e realizado — nas abas Frota, Receita Líquida e EBITDA.
//
// Roda no GitHub Actions (o sandbox não alcança o docs.google). Não grava nada.
// ============================================================
const SHEET = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';

async function aba(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const raw = await (await fetch(url)).text();
  const json = JSON.parse(raw.replace(/^[\s\S]*?setResponse\(/, '').replace(/\);?\s*$/, ''));
  if (!json.table) throw new Error('sem table em ' + tab);
  return json.table;
}
// o gviz devolve data como o TEXTO "Date(2026,7,1)" — mês base zero
const vigDe = v => {
  const m = String(v == null ? '' : v).match(/Date\((\d+),(\d+),/);
  if (m) return `${String(+m[2] + 1).padStart(2, '0')}/${m[1]}`;
  const t = String(v || '').trim();
  const b = t.match(/^(\d{2})\/(\d{4})$/);
  return b ? t : null;
};
const n = v => (v == null || v === '' ? 0 : +v) || 0;
const mi = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + ' mi' : Math.round(v).toLocaleString('pt-BR'));

async function conta(tab, iVig, iOrc, iRem, iReal) {
  const t = await aba(tab);
  const rows = t.rows || [];
  const por = {};
  rows.forEach(r => {
    const c = r.c || [];
    const k = vigDe(c[iVig] && c[iVig].v);
    if (!k) return;
    const o = (por[k] = por[k] || { linhas: 0, orc: 0, rem: 0, real: 0 });
    o.linhas++; o.orc += n(c[iOrc] && c[iOrc].v);
    o.rem += n(c[iRem] && c[iRem].v); o.real += n(c[iReal] && c[iReal].v);
  });
  const chaves = Object.keys(por).sort((a, b) => (a.slice(3) + a.slice(0, 2)).localeCompare(b.slice(3) + b.slice(0, 2)));
  console.log(`\n── ${tab} · ${rows.length} linha(s) · ${(t.cols || []).length} coluna(s)`);
  console.log('vigência    linhas        orçado      remunerado       realizado');
  chaves.slice(-9).forEach(k => console.log(`${k}   ${String(por[k].linhas).padStart(6)}  ${mi(por[k].orc).padStart(12)}  ${mi(por[k].rem).padStart(14)}  ${mi(por[k].real).padStart(14)}`));
  const comReal = chaves.filter(k => Math.abs(por[k].real) > 0);
  console.log(`última vigência COM realizado: ${comReal.length ? comReal[comReal.length - 1] : 'nenhuma'}`
    + ` · última vigência presente: ${chaves[chaves.length - 1]}`);
}

// As três abas: os índices vêm do CABEÇALHO, como o painel faz (mapTab).
// Índice fixo não serve — a Frota tem um arranjo de colunas diferente das
// outras duas e a leitura sai vazia sem avisar (foi o que aconteceu aqui).
for (const tab of ['Frota', 'Receita Líquida', 'EBITDA']) {
  const t = await aba(tab);
  const h = (t.cols || []).map(c => String((c && c.label) || '').toLowerCase());
  const acha = (...p) => h.findIndex(x => p.some(y => x.includes(y)));
  const iVig = acha('vigência', 'vigencia'), iOrc = acha('orçado', 'orcado'),
        iRem = acha('remunerado'), iReal = acha('realizado');
  console.log(`\n(${tab}: colunas ${h.map((x, i) => i + ':' + (x || '—')).join(' | ')})`);
  console.log(`(${tab}: vig=${iVig} orc=${iOrc} rem=${iRem} real=${iReal})`);
  if (iVig < 0) { console.log('  sem coluna de vigência — pulando'); continue; }
  await conta(tab, iVig, iOrc, iRem, iReal);
}
