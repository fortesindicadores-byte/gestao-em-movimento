// A guarda contra aba filtrada, exercitada no PRÓPRIO scripts/gviz-robot.mjs.
// O fetch global é dublado: o "Google" devolve um corpo do tamanho que o
// cenário mandar e o "Supabase" devolve a foto anterior. Nada sai da máquina.
//
// O que cada cenário prova:
//   filtrada  → a foto encolheu 95%: tem de RECUSAR, manter a anterior e
//               fechar o job em vermelho (é o alarme);
//   normal    → encolheu 10%: grava, porque conteúdo muda mesmo;
//   no limite → encolheu exatamente 40%: NÃO recusa (a régua é "mais de 40%");
//   primeira  → sem foto anterior: grava, não há com o que comparar;
//   igual     → md5 bate: "sem mudança", sem reescrever o corpo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const S = '/tmp/claude-0/-home-user-gestao-em-movimento/df61d1fb-06c6-51a4-9fae-692ed62b893f/scratchpad';

const PRELOAD = `
const CEN = process.env.CEN;
const ANTES = 1000000;                       // bytes da foto anterior
const FATOR = { filtrada: 0.05, normal: 0.90, limite: 0.60, primeira: 1, igual: 1 }[CEN];
const corpo = n => { const pre = '/*O_o*/\\ngoogle.visualization.Query.setResponse({"status":"ok","table":{"rows":[', pos = ']}});';
  return pre + 'x'.repeat(Math.max(0, n - pre.length - pos.length)) + pos; };
const BODY = corpo(Math.round(ANTES * FATOR));
import { createHash } from 'node:crypto';
const HASH_IGUAL = createHash('md5').update(BODY).digest('hex');
globalThis.__escrito = [];
globalThis.fetch = async (u, opt = {}) => {
  const s = String(u);
  const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
  if (s.includes('docs.google.com')) return new Response(BODY, { status: 200 });
  if (s.includes('select=key,hash&limit=1')) return J([]);           // coluna hash existe
  if (s.includes('select=hash,bytes') || s.includes('select=bytes')) {
    if (CEN === 'primeira') return J([]);                            // nunca fotografada
    return J([{ hash: CEN === 'igual' ? HASH_IGUAL : 'outro-hash', bytes: ANTES }]);
  }
  if (opt.method === 'POST') { globalThis.__escrito.push(s); return J([], 201); }
  if (opt.method === 'PATCH') return new Response(null, { status: 204 });
  return J([]);
};
`;
fs.writeFileSync(S + '/gviz-stub.mjs', PRELOAD);

let falhas = 0;
const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (!v) falhas++; };

for (const cen of ['filtrada', 'normal', 'limite', 'primeira', 'igual']) {
  const r = spawnSync(process.execPath, ['--import', S + '/gviz-stub.mjs', 'scripts/gviz-robot.mjs'], {
    cwd: '/home/user/gestao-em-movimento',
    env: { ...process.env, CEN: cen, GEM_SUPABASE_SERVICE_KEY: 'fake' },
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const resumo = (out.match(/^\d+ ok .*$/m) || [''])[0];
  const linha = (out.split('\n').find(l => /^(RECUSADA|ok |=   |FALHOU)/.test(l)) || '').slice(0, 118);
  console.log(`\n══ ${cen}  (exit ${r.status})`);
  console.log('   1ª linha:', linha);
  console.log('   resumo:  ', resumo);
  const rec = /RECUSADA/.test(out), err = /::error::gviz-robot/.test(out);

  if (cen === 'filtrada') {
    ok('recusa a foto encolhida', rec);
    ok('grita com ::error:: (o alarme)', err);
    ok('diz o quanto encolheu e que manteve a anterior', /-95%.*FILTRADA.*MANTIDA/s.test(out));
    ok('30 recusadas, 0 gravadas', /^0 ok \(0 sem mudança\) · 30 recusada/m.test(out), resumo);
    ok('job vermelho', r.status === 1, String(r.status));
    ok('ensina o que fazer', /Tirar o filtro na aba/.test(out));
  }
  if (cen === 'normal') {
    ok('grava (conteúdo muda mesmo)', !rec && /^ok  /m.test(out));
    ok('30 gravadas, 0 recusadas', /^30 ok \(0 sem mudança\) · 0 recusada/m.test(out), resumo);
    ok('job verde', r.status === 0, String(r.status));
  }
  if (cen === 'limite') {
    ok('exatamente -40% NÃO é recusa (a régua é "mais de 40%")', !rec, linha);
    ok('job verde', r.status === 0, String(r.status));
  }
  if (cen === 'primeira') {
    ok('sem foto anterior, grava sem guarda', !rec && /^ok  /m.test(out));
    ok('job verde', r.status === 0, String(r.status));
  }
  if (cen === 'igual') {
    ok('md5 igual → "sem mudança"', /sem mudança/.test(out) && !rec);
    ok('nada foi reescrito (só o touch)', !/^ok  /m.test(out));
    ok('job verde', r.status === 0, String(r.status));
  }
}
console.log(falhas ? `\n✗ ${falhas} falha(s)` : '\n✓ tudo certo');
process.exit(falhas ? 1 : 0);
