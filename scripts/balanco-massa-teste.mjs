// ============================================================
// BALANÇO DE MASSA — teste do motor `assets/balanco-massa.js`
//
// Roda a conta nova (Renan, 09/10/2026) em casos montados à mão:
//   · o exemplo dele: trimestre somado e rateado pelo remunerado;
//   · remunerado LÍQUIDO (a Frota já carrega o balanço na conta);
//   · conta a conta, km = soma das contas;
//   · só a partir de `inicio` (ago/26 → T3 = ago + set);
//   · mês sem km não recebe rateio (o valor vai para os meses com km);
//   · conta sem remunerado líquido cai no plano B (remunerado total);
//   · crédito (balanço negativo) tira km.
// Uso: node scripts/balanco-massa-teste.mjs
// ============================================================
import { createRequire } from 'node:module';
const BM = createRequire(import.meta.url)('../assets/balanco-massa.js');

let ok = 0, falha = 0;
const t = (nome, cond, info) => { if (cond) { ok++; console.log('  ok  ' + nome); } else { falha++; console.log('  FALHA ' + nome + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); } };
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const G = 'CBA|EMPURRADA';
const ch = v => v + '|' + G;

// ── 1) o exemplo do Renan: rem 150k · 200k · 120k, balanço 50k no trimestre ──
// Como a tela do Painel KM é por mês, o balanço de 50k entra num mês só
// (set) e tem de ser rateado 32/43/26 pelo remunerado — líquido, porque a
// Frota de set já carrega os 50k dentro da conta.
console.log('1) trimestre rateado pelo remunerado (regra 1 e 3)');
{
  const bal = { [ch('09/2026')]: { COMBUSTIVEIS: 50000 } };
  const remCta = { [ch('07/2026')]: { COMBUSTIVEIS: 150000 }, [ch('08/2026')]: { COMBUSTIVEIS: 200000 }, [ch('09/2026')]: { COMBUSTIVEIS: 120000 + 50000 } };
  const km0 = { [ch('07/2026')]: 75000, [ch('08/2026')]: 100000, [ch('09/2026')]: 60000 };   // R$/km = 2,00 em todos
  const r = BM.recompoe({ bal, remCta, km0, inicio: '07/2026' });
  const v = m => r.porChave[ch(m)] || { km: 0, valor: 0 };
  t('jul recebe 150/470 do balanço', perto(v('07/2026').valor, 50000 * 150 / 470), v('07/2026').valor);
  t('ago recebe 200/470', perto(v('08/2026').valor, 50000 * 200 / 470), v('08/2026').valor);
  t('set recebe 120/470 (líquido dos 50k que a Frota carrega)', perto(v('09/2026').valor, 50000 * 120 / 470), v('09/2026').valor);
  t('a soma do trimestre bate com o lançado', perto(v('07/2026').valor + v('08/2026').valor + v('09/2026').valor, 50000));
  t('km = valor ÷ R$/km da conta (2,00)', perto(v('08/2026').km, 50000 * 200 / 470 / 2), v('08/2026').km);
  t('taxa da chave = 2,00', perto(v('09/2026').taxa, 2), v('09/2026').taxa);
  t('sem avisos', r.avisos.length === 0, r.avisos);
}

// ── 2) conta a conta, km = soma das contas (regra 2) ──
console.log('2) conta a conta');
{
  const bal = { [ch('08/2026')]: { COMBUSTIVEIS: 30000, 'PNEUS NOVOS': 5000 } };
  const remCta = { [ch('08/2026')]: { COMBUSTIVEIS: 330000, 'PNEUS NOVOS': 55000, ARLA: 10000 } };   // líquido: 300k e 50k
  const km0 = { [ch('08/2026')]: 100000 };   // R$/km comb 3,00 · pneus 0,50
  const r = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  const e = r.porChave[ch('08/2026')];
  t('combustíveis → 10.000 km (30k ÷ 3,00)', perto(e.contas.COMBUSTIVEIS.km, 10000), e.contas.COMBUSTIVEIS.km);
  t('pneus → 10.000 km (5k ÷ 0,50)', perto(e.contas['PNEUS NOVOS'].km, 10000), e.contas['PNEUS NOVOS'].km);
  t('km da chave = soma das contas', perto(e.km, 20000), e.km);
  t('valor = 35.000', perto(e.valor, 35000), e.valor);
  t('Arla sem balanço não aparece', !e.contas.ARLA);
  // o mesmo balanço pela regra antiga (valor total ÷ R$/km de todas as contas) daria outro km
  const antiga = 35000 / ((330000 + 55000 + 10000) / 100000);
  t('difere da regra antiga (valor total ÷ R$/km de tudo)', !perto(e.km, antiga, 1e-3), { nova: e.km, antiga });
}

// ── 3) só de agosto em diante: T3/2026 = ago + set ──
console.log('3) início em ago/26');
{
  const bal = { [ch('07/2026')]: { COMBUSTIVEIS: 1000 }, [ch('09/2026')]: { COMBUSTIVEIS: 9000 } };
  const remCta = { [ch('07/2026')]: { COMBUSTIVEIS: 100000 }, [ch('08/2026')]: { COMBUSTIVEIS: 100000 }, [ch('09/2026')]: { COMBUSTIVEIS: 100000 + 9000 } };
  const km0 = { [ch('07/2026')]: 50000, [ch('08/2026')]: 50000, [ch('09/2026')]: 50000 };
  const r = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  t('julho fica fora (regra antiga cuida dele)', !r.porChave[ch('07/2026')]);
  t('setembro divide com agosto só', perto((r.porChave[ch('08/2026')] || {}).valor || 0, 4500) && perto(r.porChave[ch('09/2026')].valor, 4500), r.porChave);
  t('julho não entra no denominador', perto(r.porChave[ch('08/2026')].km, 4500 / 2), r.porChave[ch('08/2026')].km);
}

// ── 4) mês do trimestre sem km não recebe rateio ──
console.log('4) mês sem km');
{
  const bal = { [ch('10/2026')]: { COMBUSTIVEIS: 8000 } };
  const remCta = { [ch('10/2026')]: { COMBUSTIVEIS: 108000 }, [ch('11/2026')]: { COMBUSTIVEIS: 100000 } };
  const km0 = { [ch('10/2026')]: 50000 };   // novembro sem Dispersão ainda
  const r = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  t('outubro leva o balanço inteiro', perto(r.porChave[ch('10/2026')].valor, 8000), r.porChave);
  t('novembro não aparece', !r.porChave[ch('11/2026')]);
  // quando novembro chegar, o rateio refaz sozinho
  km0[ch('11/2026')] = 50000;
  const r2 = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  t('com novembro, divide meio a meio', perto(r2.porChave[ch('10/2026')].valor, 4000) && perto(r2.porChave[ch('11/2026')].valor, 4000), r2.porChave);
}

// ── 5) conta sem remunerado líquido → plano B ──
console.log('5) plano B');
{
  const bal = { [ch('08/2026')]: { 'LAVACAO DE VEICULOS': 600 } };
  const remCta = { [ch('08/2026')]: { 'LAVACAO DE VEICULOS': 600, COMBUSTIVEIS: 300000 } };   // líquido da lavação = 0
  const km0 = { [ch('08/2026')]: 100000 };
  const r = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  const e = r.porChave[ch('08/2026')];
  t('aviso de plano B', r.avisos.some(a => /rateado pelo remunerado total/.test(a)), r.avisos);
  t('km pelo R$/km de todas as contas (600 ÷ 3,00)', perto(e.km, 200), e.km);
  t('marcado como planoB', e.contas['LAVACAO DE VEICULOS'].planoB === true);
}

// ── 6) crédito tira km; balanço sem km nenhum avisa ──
console.log('6) crédito e sem km');
{
  const bal = { [ch('08/2026')]: { COMBUSTIVEIS: -3000 } };
  const remCta = { [ch('08/2026')]: { COMBUSTIVEIS: 97000 } };   // bruto 97k = líquido 100k − 3k de crédito
  const km0 = { [ch('08/2026')]: 50000 };
  const r = BM.recompoe({ bal, remCta, km0, inicio: '08/2026' });
  t('crédito → km negativo (−1.500)', perto(r.porChave[ch('08/2026')].km, -1500), r.porChave[ch('08/2026')].km);
  const r2 = BM.recompoe({ bal: { [ch('08/2026')]: { COMBUSTIVEIS: 1000 } }, remCta, km0: {}, inicio: '08/2026' });
  t('sem km em mês nenhum → aviso e nada recomposto', Object.keys(r2.porChave).length === 0 && r2.avisos.length === 1, r2.avisos);
}

// ── 7) helpers ──
console.log('7) helpers');
t('trimestre(08/2026) = 2026-T3', BM.trimestre('08/2026') === '2026-T3');
t('trimestre(12/2026) = 2026-T4', BM.trimestre('12/2026') === '2026-T4');
t('ym ordena', BM.ym('01/2027') > BM.ym('12/2026'));

console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
