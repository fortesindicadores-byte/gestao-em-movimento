// Scorecard: os cards de DPO, pneus (saúde, pressão, aferições) e FCA seguem o filtro de vigência.
// Roda as funções DO PRÓPRIO scorecard/index.html em node:vm (extraídas pelo nome) com dados montados.
// Uso: node scripts/scorecard-periodo-teste.mjs
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../scorecard/index.html', import.meta.url), 'utf8');
function fn(nome) {               // extrai "function nome(...){...}" casando chaves
  const i = html.indexOf('function ' + nome + '('); if (i < 0) throw new Error('sem ' + nome);
  let j = html.indexOf('{', i), d = 0;
  for (let k = j; k < html.length; k++) { const c = html[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return html.slice(i, k + 1); } }
}
const linha = n => { const m = html.match(new RegExp('const ' + n + '=[^\\n]+')); return m[0]; };
const ctx = { console, Date, Set, Math, JSON, XPANEL: {} };
vm.createContext(ctx);
vm.runInContext([linha('MESES'), linha('UNI2COD'), linha('UNI2DPO'), linha('UNI2CONLOG'),
  fn('conlogMes'), fn('conlogU'), fn('compDPO'), fn('dpoSemDe'), fn('dpoNotaU'), fn('fcaSplitP'),
  'globalThis.T={conlogMes,conlogU,compDPO,dpoSemDe,dpoNotaU,fcaSplitP};'].join('\n'), ctx);
const T = ctx.T;
let ok = 0, falha = 0;
const conf = (nome, cond, extra = '') => { if (cond) { ok++; console.log('ok   ', nome); } else { falha++; console.log('FALHA', nome, extra); } };
const vk = (y, m) => y * 100 + m;

// ── pneus: PIR com inspeções em jun e jul/2026 ──
const ins = [];
const add = (dia, placa, tireId, mm, dsv) => ins.push({ unidade: 'PIR', placa, veiculoId: placa === 'PAL1' ? 99 : 1, dataInspecao: dia + 'T12:00:00Z', tireId, menorMM: mm, pressaoIdeal: 100, desvioPressao: dsv });
add('2026-06-05', 'AAA1', 't1', 8, 5);  add('2026-06-05', 'AAA1', 't2', 2, 30);   // jun: 1 bom de 2, 1 calibrado de 2
add('2026-06-20', 'AAA1', 't2', 5, 0);                                              // última medida de t2 em jun: bom e calibrado
add('2026-07-10', 'AAA1', 't1', 3, 20); add('2026-07-10', 'AAA1', 't2', 7, 0);      // jul: 1 bom de 2, 1 calibrado de 2
add('2026-06-05', 'PAL1', 'p1', 1, 50);                                             // paleteira: fora
const mes = T.conlogMes({ vehicles: [{ id: 1, tipo: 'CAMINHAO' }, { id: 99, tipo: 'PALETEIRA ELETRICA' }], inspections: ins });
const jun = mes.PIR[vk(2026, 5)], jul = mes.PIR[vk(2026, 6)];
conf('jun: última medida de cada pneu no mês (2 de 2 bons)', jun.tBom === 2 && jun.tTot === 2, JSON.stringify(jun));
conf('jun: pressão 2 de 2 calibrados', jun.pOk === 2 && jun.pTot === 2, JSON.stringify(jun));
conf('jul: 1 de 2 bons, 1 de 2 calibrados', jul.tBom === 1 && jul.tTot === 2 && jul.pOk === 1 && jul.pTot === 2, JSON.stringify(jul));
conf('paleteira fora da conta', !Object.values(mes.PIR).some(o => o.tTot > 2), JSON.stringify(mes.PIR));
conf('aferição jun: última inspeção 20/06, fim do mês 30/06 → ok', jun.aOk === 1 && jun.aTot === 1, JSON.stringify(jun));
conf('aferição jul: última 10/07, fim 31/07 → 21 dias, ok', jul.aOk === 1 && jul.aTot === 1, JSON.stringify(jul));
const ago = mes.PIR[vk(2026, 7)];
conf('aferição ago: última 10/07 → mais de 30 dias no fim de agosto, vencida', ago && ago.aOk === 0 && ago.aTot === 1, JSON.stringify(ago));
ctx.XPANEL.conlog = { snap: { PIR: { saude: 11, pressao: 22, afer: 33 } }, mes };
const P = 'PIRAI EMPURRADA';
conf('card Saúde só jun = 100%', T.conlogU([P], 'saude', new Set([vk(2026, 5)])) === 100);
conf('card Saúde só jul = 50%', T.conlogU([P], 'saude', new Set([vk(2026, 6)])) === 50);
conf('card Saúde jun+jul = 75% (pneu-mês somado, não média)', T.conlogU([P], 'saude', new Set([vk(2026, 5), vk(2026, 6)])) === 75);
conf('cache antigo sem "mes" cai na foto de hoje', (() => { ctx.XPANEL.conlog = { PIR: { saude: 11 } }; const v = T.conlogU([P], 'saude', new Set([vk(2026, 5)])); ctx.XPANEL.conlog = { snap: {}, mes }; return v === 11; })());

// ── DPO por semestre ──
const rows = [['Unidade', '1H26', '2H26'], ['PIR', 'Nível 2', 'Nível 4'], ['BLC', 'Nível 3', ''], ['CBA T1', '', 'Nível 1']];
ctx.XPANEL.dpo = T.compDPO(rows);
conf('DPO PIR em jun/26 = 1H26 (Nível 2 → 60)', T.dpoNotaU([P], 2026, 5) === 60);
conf('DPO PIR em ago/26 = 2H26 (Nível 4 → 100)', T.dpoNotaU([P], 2026, 7) === 100);
conf('DPO BLC em ago/26 sem auditoria no 2H = continua 1H26 (80)', T.dpoNotaU(['CDD CAMBORIU'], 2026, 7) === 80);
conf('DPO CBA T1 em jun/26 sem auditoria no 1H = sem nota', T.dpoNotaU(['CUIABA EMPURRADA'], 2026, 5) === null);
conf('semestre do período: jul/26 → 2H26', (T.dpoSemDe(2026, 6) || {}).sem === '2H26');
conf('aba sem semestre no cabeçalho cai na regra antiga', (() => { ctx.XPANEL.dpo = T.compDPO([['Unidade', 'Auditoria'], ['PIR', 'Nível 3']]); return T.dpoNotaU([P], 2026, 5) === 80; })());

// ── FCA por período ──
const recs = [
  { k: vk(2026, 0), full: 'PIR', cod: 'PIR', concl: 'C', venc: false },
  { k: vk(2026, 5), full: 'PIR', cod: 'PIR', concl: 'N', venc: true },
  { k: vk(2026, 6), full: 'PIR', cod: 'PIR', concl: 'C', venc: false },
  { k: vk(2026, 6), full: 'CBA T1 WH', cod: 'CBA', concl: 'C', venc: false },
  { k: vk(2026, 6), cod: 'CBA', concl: 'N', venc: true },             // registro da aba antiga: casa pelo código-base
];
const jj = T.fcaSplitP(recs, new Set([vk(2026, 5), vk(2026, 6)]), [P]);
conf('FCA PIR jun+jul: janeiro fica fora (2 FCAs, 50% concluído)', jj.concl === 50 && jj.prazo === 50, JSON.stringify(jj));
const wh = T.fcaSplitP(recs, new Set([vk(2026, 6)]), ['CUIABA']);
conf('FCA CUIABA (WH) jul: casa CBA T1 WH do banco e CBA da aba antiga', wh.concl === 50, JSON.stringify(wh));
const emp = T.fcaSplitP(recs, new Set([vk(2026, 6)]), ['CUIABA EMPURRADA']);
conf('FCA CUIABA EMPURRADA jul: não pega o CBA T1 WH', emp.concl === 0, JSON.stringify(emp));
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
