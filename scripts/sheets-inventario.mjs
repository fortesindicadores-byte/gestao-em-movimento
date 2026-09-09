// ============================================================
// INVENTÁRIO DAS BASES MANUAIS (Renan, 09/09/2026)
//
// Lê TODAS as abas de sheets-bases.mjs e descreve cada uma: quantas linhas,
// quantas colunas, o cabeçalho com o tipo que o próprio Sheets declara e uma
// amostra do valor. É daqui que sai o SQL das tabelas (sheets-ddl.mjs) — sem
// isso eu estaria adivinhando nome e tipo de coluna.
//
// Roda no GitHub Actions porque o sandbox não alcança o docs.google.
// Não grava nada: só lê e imprime.
// ============================================================
import { BASES, baixa, chaveDe } from './sheets-bases.mjs';

const SO = process.env.SHEETS_SO || '';        // rodar só um slug (ou prefixo)
const alvos = SO ? BASES.filter(b => b.slug.startsWith(SO)) : BASES;
console.log(`Inventário de ${alvos.length} base(s) manuais\n`);

const kb = n => (n / 1024).toFixed(0) + 'KB';
const nk = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const ehVig = s => /vig|compet|m[eê]s|per[ií]odo|data/i.test(nk(s));

const out = [];
let falhas = 0;

for (const b of alvos) {
  try {
    const { json, bytes } = await baixa(b);
    const cols = (json.table.cols || []).map((c, i) => ({
      i, label: String((c && c.label) || '').trim(), id: c && c.id, tipo: (c && c.type) || 'string',
    }));
    const rows = json.table.rows || [];
    // amostra: 1º valor não vazio de cada coluna
    const amostra = cols.map(c => {
      for (const r of rows) {
        const v = r.c && r.c[c.i] && r.c[c.i].v;
        if (v != null && v !== '') return typeof v === 'string' ? v.slice(0, 28) : v;
      }
      return null;
    });
    const semRotulo = cols.filter(c => !c.label).length;
    const vig = cols.filter(c => c.label && ehVig(c.label)).map(c => c.label);

    console.log(`── ${b.slug}  (${b.nome})`);
    console.log(`   ${rows.length} linha(s) · ${cols.length} coluna(s) · ${kb(bytes)}`
      + (semRotulo ? ` · ⚠ ${semRotulo} coluna(s) SEM rótulo` : '')
      + (vig.length ? ` · vigência: ${vig.join(' / ')}` : ' · ⚠ sem coluna de vigência'));
    cols.forEach((c, k) => console.log(`     ${String(c.i).padStart(2)} ${(c.label || '(sem rótulo)').padEnd(34).slice(0, 34)} ${c.tipo.padEnd(8)} ${JSON.stringify(amostra[k])}`));
    console.log('');

    out.push({ slug: b.slug, nome: b.nome, chave: chaveDe(b), linhas: rows.length, bytes,
      cols: cols.map(c => ({ i: c.i, label: c.label, tipo: c.tipo })) });
  } catch (e) {
    falhas++;
    console.log(`── ${b.slug}  (${b.nome})\n   FALHOU: ${e.message}\n`);
  }
}

console.log(`\n${out.length} lida(s) · ${falhas} falha(s) de ${alvos.length}`);
console.log(`total: ${out.reduce((a, x) => a + x.linhas, 0).toLocaleString('pt-BR')} linhas · `
  + kb(out.reduce((a, x) => a + x.bytes, 0)));
console.log('\nJSON_INICIO');
console.log(JSON.stringify(out));
console.log('JSON_FIM');
if (!out.length) process.exit(1);
