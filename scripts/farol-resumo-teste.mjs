// Resumo Gerencial do Gestão à Vista (renderResumo do farol-core.js) no recorte
// de UMA unidade × rede. Roda a função DO PRÓPRIO ARQUIVO em node:vm.
// Renan, 24/09/2026: "Preventivas: pior unidade GRL (100%)" e os descontos /
// vencidos somando a rede inteira na tela da unidade.
import fs from 'node:fs'; import vm from 'node:vm';
const s = fs.readFileSync(new URL('../farol-frota/farol-core.js', import.meta.url), 'utf8');
const pega = (ini, fim) => { const i = s.indexOf(ini); const j = s.indexOf(fim, i); if (i < 0 || j < 0) throw new Error('não achei ' + ini); return s.slice(i, j); };
const helpers = ['const _n=', 'const brl=', 'const pct1=', 'const sumA=', 'const OS_META='].map(h => s.slice(s.indexOf(h), s.indexOf('\n', s.indexOf(h)))).join('\n');
const codigo = helpers + '\n' + pega('let FILT={uni:null};', '// ── CUSTOS ──') + pega('function renderResumo(el){', '// ── DISPONIBILIDADE') +
  ';this.renderResumo=renderResumo;this.setFilt=u=>{FILT.uni=u?new Set(u):null;};';
const STATS = { GRL: { sv: 89, cf: 100, pv: 100, al: 81 }, CGR: { sv: 95, cf: 97, pv: 92, al: 70 } };
const ctx = {
  UNIDADES: { GRL: 1, CGR: 1 }, unitStats: c => STATS[c],
  DATA: {
    stressV: [{ cod: 'GRL', desc: 1000 }, { cod: 'CGR', desc: 50000 }],
    stressE: [{ cod: 'GRL', contratada: true, dt: 200 }, { cod: 'CGR', contratada: true, dt: 9000 }],
    cifv: [{ cod: 'CGR', dt: 300 }],
    prev: [{ cod: 'GRL', st: 'Vencida' }, { cod: 'CGR', st: 'Vencida' }, { cod: 'CGR', st: 'Vencida' }],
    alinh: [{ cod: 'GRL', st: 'Vencido' }, { cod: 'CGR', st: 'Vencido' }, { cod: 'CGR', st: 'Vencido' }, { cod: 'CGR', st: 'Vencido' }],
    os: [{ cod: 'CGR', dias: 30 }],
  },
};
vm.createContext(ctx); vm.runInContext(codigo, ctx);
const tela = u => { ctx.setFilt(u); const el = {}; ctx.renderResumo(el); return el.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); };
let ok = 0, falha = 0; const conf = (c, m) => { c ? ok++ : falha++; console.log((c ? 'ok   ' : 'FALHA') + ' ' + m); };
const g = tela(['GRL']);
conf(!/pior unidade/.test(g), 'unidade sozinha: nenhum "pior unidade"');
conf(/R\$ 1k/.test(g) && !/R\$ 59k|R\$ 60k/.test(g), 'unidade: descontos só da GRL (R$ 1k + 200)');
conf(/ 1 preventiva/.test(g), 'unidade: 1 preventiva vencida (não 3)');
conf(/ 1 alinhamento/.test(g), 'unidade: 1 alinhamento vencido (não 4)');
conf(!/OS\(s\) acima/.test(g), 'unidade: OS da CGR não aparece na GRL');
const r = tela(null);
conf(/Stress Veíc\.: pior unidade GRL \(89%\)/.test(r), 'rede: pior Stress Veíc. = GRL 89%');
conf(/Preventivas: pior unidade CGR \(92%\)/.test(r), 'rede: pior Preventivas = CGR 92%');
conf(!/CIFV: pior unidade GRL|pior unidade [A-Z]+ \(100%\)/.test(r), 'rede: nada de "pior" com 100%');
conf(/ 3 preventiva/.test(r) && / 4 alinhamento/.test(r), 'rede: contagens da rede inteira');
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);
