// mesmasChaves() do saude-robot: todo objeto do lote sai com o MESMO conjunto
// de chaves (PGRST102 — bug real de 23/09/2026). Roda a função do PRÓPRIO
// arquivo em node:vm, para não medir uma cópia.
import fs from 'node:fs'; import vm from 'node:vm';
const src = fs.readFileSync(new URL('./saude-robot.mjs', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('function mesmasChaves'), src.indexOf('async function grava'));
const ctx = {}; vm.createContext(ctx); vm.runInContext(fn + ';this.mesmasChaves = mesmasChaves;', ctx);
let ok = 0, ruim = 0; const t = (c, m, x) => { c ? ok++ : ruim++; console.log((c ? '  ok   ' : '  ✗    ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
const out = ctx.mesmasChaves([
  { chave: 'sh:a', impressao: 'h1', mudou_em: '2026-09-24', linhas: 3 },
  { chave: 'elite:b', linhas: 7 },                       // sem impressao nem mudou_em
  { chave: 'app:c', linhas: null, erro: 'permission denied' },
]);
const ks = out.map(o => Object.keys(o).sort().join(','));
t(ks.every(k => k === ks[0]), 'todas as linhas saem com o mesmo conjunto de chaves', ks);
t(ks[0] === 'chave,erro,impressao,linhas,mudou_em', 'o conjunto é a UNIÃO das chaves do lote', ks[0]);
t(out[1].impressao === null && out[1].mudou_em === null && out[1].erro === null, 'chave que faltava entra como null', out[1]);
t(out[0].impressao === 'h1' && out[2].erro === 'permission denied' && out[2].linhas === null, 'o que existia fica como estava (inclusive null explícito)', [out[0], out[2]]);
t(ctx.mesmasChaves([]).length === 0, 'lote vazio continua vazio');
console.log(`\n${ok} ok · ${ruim} falha(s)`); process.exit(ruim ? 1 : 0);
