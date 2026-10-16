// ============================================================================
// Teste do /fca-automatico/ no Chromium, com TODAS as fontes dubladas (o
// sandbox não alcança o Supabase nem o Google). Respostas conhecidas:
//
//  1. FATO = pacote que estourou no DRE, a mesma regra do FCA: CGR · ROTA ·
//     ago/26 · Combustíveis com R$ 31.000 (conta Combustíveis 30 mil + Arla 1 mil);
//  2. a PONTE da conta Combustíveis fecha no Δ do custo, como a Árvore:
//     Km rodado 11.600 (5.000 km ÷ 2,50 km/L rem × R$ 5,80/L rem) · Eficiência 11.600 (2.000 L a
//     mais × R$ 5,80) · Preço 4.800 · Diferença DRE × bases 3.600, e o Arla
//     1.000 à parte → 100% do desvio explicado em R$;
//  3. o OFENSOR de eficiência é a placa que gastou acima da régua (CGR0A01,
//     2.000 L), as de preço vêm na ordem do R$ pago acima;
//  4. a aba Km/L SEM CABEÇALHO (como chega do Google) cai nas posições padrão;
//     VAN do DRE ("ROTA (VAN) - GRL") casa com a Km/L ("VAN - GRL") e usa o
//     preço do ROTA da unidade;
//  5. MANUTENÇÕES: a Carta diz onde o dinheiro foi (grupo, placa, fornecedor);
//     o SLA fora da meta vira causa "rede" porque a relação SLA × desvio foi
//     PLANTADA nas 10 unidades × 8 meses; as preventivas vencidas e as OS em
//     aberto do Ginfo de hoje viram ação com placa;
//  6. APRENDIZADO: o FCA de jul/26 do GRL (tema Oficina / SLA) é "melhorou",
//     porque o desvio caiu de 30 mil para 15 mil em ago/26; a ação de SLA do
//     fato de ago/26 traz essa taxa (1 de 1);
//  7. PNEUS: Prolog (pressão fora, 3–4 mm) e alinhamento vencido viram ação;
//  8. condução: os motoristas de pior nota da unidade (PIR) entram na ação;
//  9. o que a unidade escreveu no FCA do mês aparece ao lado, no modal;
// 10. sem admin cai no gate; telas sem rolagem da página em 1366 e 1920, nos
//     dois temas.
// Uso: node scripts/fca-automatico-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0, T2D = null;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures ── */
let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const VIGS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const U = { CGR: ['CAMPO GRANDE', 'ROTA - CGR', 'CDD RIO DE JANEIRO'], GRL: ['GUARULHOS', 'ROTA - GRL', 'CDD GUARULHOS'], PIR: ['PIRAÍ', 'EMPURRADA - PIR', 'PIRAI EMPURRADA'],
  'CBA T2': ['CUIABÁ', 'ROTA - CBA', 'CDD CUIABA'], FLP: ['FLORIANÓPOLIS', 'ROTA - FLP', 'CDD FLORIANOPOLIS'], NFR: ['NOVA FRIBURGO', 'ROTA - NFR', 'CDD NOVA FRIBURGO'],
  PLT: ['PELOTAS', 'ROTA - PLT', 'CDD PELOTAS'], RON: ['RONDONÓPOLIS', 'ROTA - RON', 'CDD RONDONOPOLIS'], BLC: ['BALNEÁRIO CAMBORIÚ', 'ROTA - BLC', 'CDD CAMBORIU'], 'MCC T2': ['CACHOEIRAS DE MACACU', 'ROTA - MCC', 'CDI MACACU'],
  ANG: ['ANHANGUERA', 'DISTRIBUIÇÃO URBANA - ANG', 'ANHANGUERA'] };
const G = [];   // uma linha por unidade × mês, com as relações PLANTADAS
Object.keys(U).forEach(u => VIGS.forEach(v => {
  const sla = 55 + rnd() * 40;                                  // SLA de manutenção
  const dm = (75 - sla) / 100 * 0.8 + (rnd() - 0.5) * 0.02;     // PLANTADO: SLA pior → desvio de Manutenções maior
  const disp = (rnd() - 0.4) * 0.2, dc = disp * 0.9 + (rnd() - 0.5) * 0.02;
  G.push({ u, v, sla, prev: 85 + rnd() * 15, manRem: 100000, manReal: 100000 * (1 + dm), combRem: 100000, combReal: 100000 * (1 + dc), arlaRem: 5000, arlaReal: 5000,
    kmRem: 50000, kmReal: 50000 * (1 + disp), pnRem: 30000, pnReal: 30000 * (1 + (rnd() - 0.5) * 0.1) });
}));
const g = (u, v) => G.find(x => x.u === u && x.v === v);
// CGR ago/26: a ponte conhecida
Object.assign(g('CGR', '2026-08'), { combRem: 100000, combReal: 130000, arlaRem: 5000, arlaReal: 6000, kmRem: 50000, kmReal: 55000 });
// GRL: Manutenções jul 30 mil → ago 15 mil (o FCA de jul "melhorou"); SLA ago 50
Object.assign(g('GRL', '2026-07'), { manRem: 100000, manReal: 130000, sla: 45 });
Object.assign(g('GRL', '2026-08'), { manRem: 100000, manReal: 113000, ctRem: 10000, ctReal: 12000, sla: 50, prev: 80 });
// PIR ago/26: combustível com eficiência ruim, sem volume e sem preço
Object.assign(g('PIR', '2026-08'), { combRem: 100000, combReal: 120000, arlaReal: 5000, kmRem: 50000, kmReal: 50000, pnRem: 30000, pnReal: 40000 });
// ANG (Seara) ago/26: a ponte pela Árvore da Seara — custo 100 → 125 mil; km rem 36.000 × real 40.000 (abas Remunerado/Combustível)
Object.assign(g('ANG', '2026-08'), { combRem: 100000, combReal: 125000, arlaRem: 5000, arlaReal: 5000 });
// acumulado do ano do GRL Manutenções: jan→jun no remunerado, jul +30 mil, ago +15 mil ⇒ ano ▲ 45 mil (5,6% de 800 mil), 4 meses restantes
VIGS.slice(0, 6).forEach(v => Object.assign(g('GRL', v), { manRem: 100000, manReal: 100000 }));
// CGR Pneus: saving no ano (todo mês 5% abaixo) e um estouro só em ago
VIGS.forEach(v => Object.assign(g('CGR', v), { pnRem: 30000, pnReal: v === '2026-08' ? 31000 : 28000 }));

const DATE = v => `Date(${v.slice(0, 4)},${+v.slice(5, 7) - 1},1)`;
const FROTA_COLS = ['VIGÊNCIA', 'Δ ORÇ (BRL)', 'Δ REM (BRL)', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'];
const lin = (v, cid, n3, cta, rem, real) => ({ c: [{ v: DATE(v) }, { v: 0 }, { v: 0 }, { v: cid }, { v: n3 }, { v: cta }, { v: 'x' }, { v: 2026 }, { v: -rem }, { v: -rem }, { v: -real }] });
const gvizFrota = () => ({ status: 'ok', table: { cols: FROTA_COLS.map(l => ({ label: l })), rows: G.flatMap(x => { const [cid, n3] = U[x.u]; return [
  lin(x.v, cid, n3, 'Combustíveis Veiculos e Equipamentos', x.combRem, x.combReal), lin(x.v, cid, n3, 'Fluídos (Arla)', x.arlaRem, x.arlaReal),
  lin(x.v, cid, n3, 'Manutenção de Veículos e Equipamentos', x.manRem, x.manReal), lin(x.v, cid, n3, 'Pneus Novos', x.pnRem, x.pnReal),
  lin(x.v, cid, n3, 'Seguro de Veículos e Equipamentos', 5000, 9000), lin(x.v, cid, n3, 'IPVA e Licenciamento de Veículos', 1000, 9000), lin(x.v, cid, n3, 'Depreciação', 2000, 2500)]
  .concat(x.ctRem != null ? [lin(x.v, cid, n3, 'Contratos de Manutenção Fabricante', x.ctRem, x.ctReal)] : []); })
  // VAN do GRL em ago/26: o DRE escreve "ROTA (VAN) - GRL"
  .concat([lin('2026-08', 'GUARULHOS', 'ROTA (VAN) - GRL', 'Combustíveis Veiculos e Equipamentos', 20000, 22000)])
  // mês só orçado (set/26 sem realizado) não pode virar fato
  .concat([lin('2026-09', 'CAMPO GRANDE', 'ROTA - CGR', 'Combustíveis Veiculos e Equipamentos', 100000, 0)]) } });
const gvizAbertura = () => ({ status: 'ok', table: { cols: ['Unidade', 'Mês', 'Projeto', 'Placa', 'Remunerado', 'Real', 'R$/km', 'Impacto'].map(l => ({ label: l })), rows: [
  ['Guarulhos - SP', DATE('2026-07'), 'ROTA', 'GRL4D44', 2000, 3000, 'R$ 2,50', 'R$ 2.500,00'], ['Guarulhos - SP', DATE('2026-07'), 'ROTA', 'GRL1A11', 2200, 2000, 'R$ 2,50', '-R$ 500,00'],
  ['CDD GUARULHOS', DATE('2026-08'), 'ROTA', 'GRL4D44', 2000, 2100, 'R$ 2,50', 'R$ 250,00'], ['Cuiába - MT', DATE('2026-07'), 'EMPURRADA', 'CBA9Z99', 5000, 5500, 'R$ 4,00', 'R$ 2.000,00'] ].map(r => ({ c: r.map(v => ({ v })) })) } });
const gvizReceita = () => ({ status: 'ok', table: { cols: FROTA_COLS.map(l => ({ label: l })), rows: [] } });
const gvizDisp = () => { const rows = G.map(x => { const c = new Array(40).fill(null).map(() => ({ v: null }));
  c[0] = { v: DATE(x.v) }; c[13] = { v: x.u.split(' ')[0] }; c[14] = { v: U[x.u][1] }; c[22] = { v: 400 }; c[25] = { v: 12 }; c[28] = { v: 8 }; c[38] = { v: 5 }; c[31] = { v: x.kmRem }; c[32] = { v: x.kmReal }; return { c }; });
  return { status: 'ok', table: { cols: new Array(40).fill(0).map((_, i) => ({ label: 'c' + i })), rows } }; };
// aba Km/L SEM cabeçalho: rótulos A, B, C… e a 1ª linha com os títulos só nas colunas de texto
const L = n => n < 26 ? String.fromCharCode(65 + n) : 'A' + String.fromCharCode(65 + n - 26);
const kmlLin = (vig, proj, placa, modelo, km, lit, tot, rem) => { const c = new Array(27).fill(null).map(() => ({ v: null }));
  c[0] = { v: DATE(vig) }; c[4] = { v: rem }; c[5] = { v: rem }; c[6] = { v: km / lit }; c[9] = { v: tot / lit }; c[14] = { v: proj }; c[15] = { v: 'x' }; c[16] = { v: placa }; c[19] = { v: modelo };
  c[22] = { v: km }; c[23] = { v: lit }; c[25] = { v: tot }; return { c }; };
const gvizKml = () => { const head = new Array(27).fill(null).map(() => ({ v: null })); head[0] = { v: 'Vigência' }; head[14] = { v: 'Projeto-Unidade' }; head[15] = { v: 'Unidade' }; head[16] = { v: 'Placa' }; head[19] = { v: 'Modelo' };
  return { status: 'ok', table: { cols: new Array(27).fill(0).map((_, i) => ({ id: L(i), label: '' })), rows: [{ c: head },
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0A01', 'VW 13.180', 20000, 10000, 60000, 2.5),
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0B02', 'VW 13.180', 20000, 8000, 48000, 2.5),
    kmlLin('2026-08', 'ROTA - CGR', 'CGR0C03', 'VW 9.170', 15000, 6000, 36000, 2.5),
    kmlLin('2026-08', 'EMPURRADA - PIR', 'PIR1A11', 'MB ACTROS', 50000, 21000, 21000 * 5.8, 2.5),
    kmlLin('2026-08', 'VAN - GRL', 'GRL9V99', 'RENAULT MASTER', 8000, 1200, 1200 * 6.2, 7) ] } }; };
const gvizRsl = () => ({ status: 'ok', table: { cols: ['Unidade Benner', 'TipoCombustivel', 'x', 'Vigência', 'PrecoOperadora'].map(l => ({ label: l })), rows: [
  { c: [{ v: 'ROTA - CGR' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 5.8 }] },
  { c: [{ v: 'EMPURRADA - PIR' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 5.8 }] },
  { c: [{ v: 'ROTA - GRL' }, { v: 'DIESEL S10' }, { v: null }, { v: DATE('2026-08') }, { v: 6.0 }] } ] } });
// SEARA: as três abas da Árvore da Seara (Combustível por gid, Base Remunerado gid 0, Remunerado por nome com tq)
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';
const sc = (placa, mes, ano, modelo, km, lit, tot) => { const c = new Array(14).fill(null).map(() => ({ v: null })); c[4] = { v: placa }; c[5] = { v: mes }; c[6] = { v: ano }; c[7] = { v: modelo }; c[10] = { v: km }; c[11] = { v: lit }; c[13] = { v: tot }; return { c }; };
const gvizSearaComb = () => ({ status: 'ok', table: { cols: ['A', 'B', 'C', 'D', 'Placa', 'Mês', 'Ano', 'Modelo', 'I', 'Tipo', 'Km Rodado', 'Litros', 'M', 'Total R$'].map(l => ({ label: l })), rows: [
  sc('ANG1A11', 'ago', 2026, 'VW/11.180 DRC 4X2', 20000, 8000, 48000), sc('ANG2B22', 'ago', 2026, 'VW 11.180', 20000, 6000, 36000), sc('ANG1A11', 'jul', 2026, 'VW/11.180 DRC 4X2', 19000, 6500, 39000) ] } });
// Base Remunerado só tem a ANG1A11: a ANG2B22 recebe a média do modelo (11.180)
const gvizSearaBrem = () => ({ status: 'ok', table: { cols: ['Vigencia', 'Empresa', 'Unidade', 'Placa', 'Tipo', 'ModeloVeiculo', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'TotalReaisPorKm', 'KmPorLitro', 'Q', 'PrecoDiesel'].map(l => ({ label: l })), rows: [
  { c: [{ v: '08/2026' }, { v: 'SEARA' }, { v: 'ANHANGUERA' }, { v: 'ANG1A11' }, { v: 'x' }, { v: 'VW/11.180 DRC 4X2' }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: 2 }, { v: 3.0 }, { v: null }, { v: 5.5 }] },
  { c: [{ v: '07/2026' }, { v: 'SEARA' }, { v: 'ANHANGUERA' }, { v: 'ANG1A11' }, { v: 'x' }, { v: 'VW/11.180 DRC 4X2' }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: null }, { v: 2 }, { v: 3.0 }, { v: null }, { v: 5.4 }] } ] } });
const gvizSearaRem = () => ({ status: 'ok', table: { cols: ['Vigência', 'Placa', 'KM'].map(l => ({ label: l })), rows: [
  { c: [{ v: '08/2026' }, { v: 'ANG1A11' }, { v: 18000 }] }, { c: [{ v: '08/2026' }, { v: 'ANG2B22' }, { v: 18000 }] }, { c: [{ v: '07/2026' }, { v: 'ANG1A11' }, { v: 18500 }] } ] } });
// Gerot: o contrato que o CorrDados usa (records com o NOME da unidade)
const RECS = G.flatMap(x => [{ field: 'sla', unit: U[x.u][2], vig: x.v, real: x.sla }, { field: 'prev', unit: U[x.u][2], vig: x.v, real: x.prev }, { field: 'disp', unit: U[x.u][2], vig: x.v, real: 96 }]);
const FIL2COD = Object.fromEntries(Object.entries(U).map(([c, a]) => [a[2], c]));
const STUB_GEROT = `window.GerotBase={load:async()=>${JSON.stringify(RECS)},FIL2COD:${JSON.stringify(FIL2COD)},METAS:{}};`;
const hoje = new Date(); const ha = d => { const x = new Date(hoje); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
const T = {
  fca_profiles: [{ is_admin: true }],
  fca: [
    { id: 'h1', unidade: 'GRL', vigencia: 'jul/26', origem: 'Custos', fato: 'Manutenções', projeto: 'ROTA - GRL', causa: 'SLA da oficina credenciada estourado, OS paradas', acao: 'Cobrar a oficina e priorizar as OS antigas', status: 'Concluída' },
    { id: 'h2', unidade: 'CGR', vigencia: 'ago/26', origem: 'Custos', fato: 'Combustíveis', projeto: 'ROTA - CGR', causa: 'Rodamos mais km por causa da rota nova', acao: 'Rever roteirização', status: 'Em andamento' },
    { id: 'h3', unidade: 'PIR', vigencia: 'ago/26', origem: 'RPM', fato: 'SLA Man.', projeto: 'EMPURRADA', causa: 'x', acao: 'y' },
    { id: 'e1', unidade: 'GRL', vigencia: 'ago/26', origem: 'Custos', fato: 'Manutenções', projeto: 'ROTA - GRL', fato_desvio: 'Desvio: ▲ R$ 1', causa: null, acao: null, status: 'Não iniciada' } ],
  carta_custos: [
    { id: 1, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Freios', equipamento: 'GRL1A11', fornecedor: 'Oficina Alfa', valor: 18000, nf: '10', projeto: 'ROTA' },
    { id: 2, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Freios', equipamento: 'GRL2B22', fornecedor: 'Oficina Alfa', valor: 12000, nf: '11', projeto: 'ROTA' },
    { id: 3, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Motor', equipamento: 'GRL3C33', fornecedor: 'Retífica Beta', valor: 10000, nf: '12', projeto: 'ROTA' },
    { id: 5, unidade: 'GRL', vigencia: '2026-08', pacote: 'Manutenção', conta: 'Manutenção de Veículos e Equip.', grupo: 'Embreagem', equipamento: 'GRL4D44', fornecedor: 'Retífica Beta', valor: 60000, nf: '14', projeto: 'ROTA' },
    { id: 4, unidade: 'PIR', vigencia: '2026-08', pacote: 'Pneus', conta: 'Pneus Novos', grupo: 'Pneus Novos', equipamento: 'PIR1A11', fornecedor: 'Pneus Gama', valor: 9000, nf: '13', projeto: 'EMPURRADA' } ],
  ginfo_snapshot: [
    { chave: 'ativos', data: [{ Placa: 'GRL1A11', Projeto: 'ROTA', 'Ano Fabricação': 2020 }, { Placa: 'PIR1A11', Projeto: 'EMPURRADA', 'Ano Fabricação': 2024 }] },
    { chave: 'preventivas', data: [{ Placa: 'GRL4D44', Status: 'Vencido', 'Dias Próxima': -12, Filial: 'CDD GUARULHOS' }, { Placa: 'GRL5E55', Status: 'No Prazo', 'Dias Próxima': 20, Filial: 'CDD GUARULHOS' }] },
    { chave: 'os-em-aberto', data: [{ 'Nº OS': 777, Data: ha(30), Status: 'Aberta', Filial: 'CDD GUARULHOS', Criticidade: 'Alta', Placa: 'GRL6F66' }, { 'Nº OS': 778, Data: ha(2), Status: 'Aberta', Filial: 'CDD GUARULHOS', Criticidade: 'Baixa', Placa: 'GRL7G77' }] },
    { chave: 'alinhamentos', data: [{ Placa: 'PIR2B22', Status: 'Vencido', Filial: 'PIRAI EMPURRADA' }] } ],
  snapshot: [{ endpoint: 'tires', branch_id: 38, data: [
    { status: 'INSTALLED', placa: 'PIR1A11', menorMM: 3.5, amplitude: 1, pressaoNOK: true }, { status: 'INSTALLED', placa: 'PIR1A11', menorMM: 8, amplitude: 6, pressaoNOK: true },
    { status: 'INSTALLED', placa: 'PIR3C33', menorMM: 2.5, amplitude: 1, pressaoNOK: false }, { status: 'INSTALLED', placa: 'PIR3C33', menorMM: 9, amplitude: 1, pressaoNOK: false },
    { status: 'INVENTORY', placa: '', menorMM: 12 } ] }],
  fca_auto_acao: [ { fato_id: 'GRL|ROTA|Manutenções|2026-08', chave: 'Carta de Custos|FAZER A ANALISE DE CAUSA RAIZ', unidade: 'GRL', vigencia: '2026-08', responsavel: 'ANA SOUZA', prazo: '2026-09-30', status: 'Concluída' } ],
  fca_profiles: [ { nome: 'Ana Souza', unidade: 'GRL', is_admin: false }, { nome: 'Bruno Carvalho Lima', unidade: 'GRL,PIR', is_admin: false }, { nome: 'Carla Dias', unidade: 'CGR', is_admin: false }, { nome: 'Renan Teste', unidade: null, is_admin: true } ],
  custo_vigencia_mv: [
    { vig_km: '2026-07-01', placa: 'GRL4D44', unidade: 'GRL', projeto: 'ROTA - GRL', tipo: 'variavel', taxa_km: 0.4, km_vig: 3000, custo_vig: 1200, previa: false },
    { vig_km: '2026-07-01', placa: 'GRL1A11', unidade: 'GRL', projeto: 'ROTA - GRL', tipo: 'variavel', taxa_km: 0.4, km_vig: 2000, custo_vig: 800, previa: false },
    { vig_km: '2026-07-01', placa: 'GRL6F66', unidade: 'GRL', projeto: 'ROTA - GRL', tipo: 'fixo', taxa_km: 0, km_vig: 2500, custo_vig: 1500, previa: false } ], disp_resumo: [], indisponibilidade: [],
  ce_scores_mensais: [
    { competencia: '2026-08-01', chave: 'gt:1', motorista: 'JOAO RUIM', unidade: 'EMP PIRAI', km: 3000, dias: 20, pontuacao: 52, rpm_pontos: 40, idle_pontos: 60, acel_pontos: 80, vel_pontos: 90, viagens: 30, vel_excessos: 1, litros: 1300, km_litros: 3000 },
    { competencia: '2026-08-01', chave: 'gt:2', motorista: 'ANA BOA', unidade: 'EMP PIRAI', km: 3500, dias: 20, pontuacao: 91, rpm_pontos: 90, idle_pontos: 90, acel_pontos: 95, vel_pontos: 95, viagens: 30, vel_excessos: 0, litros: 1250, km_litros: 3500 } ],
};
const CE_UNI = { CGR: 'CDD CAMPO GRANDE', GRL: 'CDD GUARULHOS', PIR: 'EMP PIRAI', 'CBA T2': 'CDD CUIABA', FLP: 'CDD FLORIANOPOLIS', NFR: 'CDD NOVA FRIBURGO', PLT: 'CDD PELOTAS', RON: 'CDD RONDONOPOLIS', BLC: 'CDD BALNEARIO', 'MCC T2': 'CDI MACACU' };
G.forEach((x, i) => { const dc = x.combReal / x.combRem - 1; const nota = Math.max(5, Math.min(99, 80 - dc * 150 + (rnd() - 0.5) * 2));
  T.ce_scores_mensais.push({ competencia: x.v + '-01', chave: 'gt:p' + i, motorista: 'MOT ' + x.u + ' ' + x.v, unidade: CE_UNI[x.u], km: 2000, dias: 20, pontuacao: nota, rpm_pontos: nota, idle_pontos: 70, acel_pontos: 80, vel_pontos: 90, viagens: 30, vel_excessos: 0, litros: 800, km_litros: 2000 }); });
// O banco dublado GUARDA o que a página grava (window.__T): insert acrescenta linhas (com id) e update muda a linha
// pelo id — assim a geração do FCA de Custos (?gen=all) cria o fato vazio e, na mesma rodada, o motor o relê e o
// reusa, como no banco de verdade. __ins/__upd/__ups continuam sendo o diário do que foi pedido.
const SHIM_SB = (admin, acErr) => `window.__ups=[];window.__T=window.__T||${JSON.stringify(T)};window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'renan@x.com'}}}})},
  from:(tabela)=>{const T=window.__T;let rows=(T[tabela]||[]).slice();
    const q={select(){return q;},order(){return q;},eq(c,v){if(tabela==='fca_profiles')rows=[{is_admin:${admin},nome:'Renan Teste'}];else rows=rows.filter(r=>r[c]===v);return q;},
      in(c,vs){rows=rows.filter(r=>!(c in r)||vs.includes(r[c]));return q;},gte(){return q;},lt(){return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      range:async(a,b)=>(tabela==='fca_auto_acao'&&${!!acErr}?{data:null,error:{message:'relation "public.fca_auto_acao" does not exist'}}:{data:rows.slice(a,b+1),error:null,count:rows.length}),
      upsert:async(row)=>{ if(${!!acErr}) return {data:null,error:{message:'relation "public.fca_auto_acao" does not exist'}}; window.__ups.push(row); return {data:null,error:null}; },
      insert:(rs0)=>{ window.__ins=window.__ins||[]; const rs=Array.isArray(rs0)?rs0:[rs0]; const data=rs.map((r,i)=>Object.assign({id:'ins'+(window.__ins.length+i)+'_'+Math.random().toString(36).slice(2,7)},r)); window.__ins.push(...rs); (T[tabela]=T[tabela]||[]).push(...data.map(r=>Object.assign({},r))); const q2={select:()=>q2,single:async()=>({data:Object.assign({},data[0]),error:null}),then:(r,j)=>Promise.resolve({data,error:null}).then(r,j)}; return q2; },
      update:(p)=>{ window.__upd=window.__upd||[]; const rec={tabela,p}; window.__upd.push(rec); const q2={eq:(c,v)=>{rec.eq=[c,v];(T[tabela]||[]).filter(r=>r[c]===v).forEach(r=>Object.assign(r,p));return q2;},in:(c,vs)=>{rec.in=[c,vs];(T[tabela]||[]).filter(r=>vs.includes(r[c])).forEach(r=>Object.assign(r,p));return q2;},then:(r,j)=>Promise.resolve({data:null,error:null}).then(r,j)}; return q2; },
      then(res,rej){return Promise.resolve({data:rows,error:null}).then(res,rej);}};
    return q;}})};`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre({ admin = true, w = 1600, h = 900, tema = 'dark', acErr = false, oficial = null, pagina = 'fca-automatico/index.html', espera = null, t = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gerot-base.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB_GEROT }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('supabase') ? SHIM_SB(admin, acErr) : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");' : '' }); });
  await ctx.route('**/lozwipoeacpvplgkrxkq.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await ctx.route('**/docs.google.com/**', r => { const u = r.request().url(); const aba = decodeURIComponent((u.match(/sheet=([^&]+)/) || [])[1] || ''); const gid = (u.match(/gid=(\d+)/) || [])[1];
    const j = aba === 'Frota' ? gvizFrota() : aba === 'Receita Líquida' ? gvizReceita() : aba === 'Dispersão de km' ? gvizDisp() : aba === 'Abertura' ? gvizAbertura() : aba === 'Km/L' ? gvizKml() : aba === 'R$/L' ? gvizRsl()
      : aba === 'Remunerado' && u.includes(SEARA_ID) ? gvizSearaRem() : gid === '1982300845' ? gvizSearaComb() : gid === '0' && u.includes(SEARA_ID) ? gvizSearaBrem() : { status: 'error', errors: [{ message: 'aba desconhecida ' + aba }] };
    // o fca-preenchimento pede por JSONP (responseHandler:_gvNNN); o motor lê por fetch e aceita qualquer nome(json)
    const fn = (u.match(/responseHandler:(\w+)/) || [])[1] || 'google.visualization.Query.setResponse';
    r.fulfill({ status: 200, contentType: 'text/plain', body: '/*O_o*/\n' + fn + '(' + JSON.stringify(j) + ');' }); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(t => { try { localStorage.setItem('bi_theme', t); localStorage.removeItem('fcaauto_mini'); } catch (e) {} }, tema);
  // a prévia guardada no navegador só é limpa no cenário oficial (o cenário da prévia depende dela sobreviver ao F5)
  if (t) await pg.addInitScript(x => { window.__T = x; }, t);
  if (oficial) await pg.addInitScript(o => { window.__oficialInicio = o.inicio; window.__oficialFora = o.fora; try { localStorage.removeItem('fcaauto_previa_v1'); } catch (e) {} }, oficial);
  await pg.goto(BASE + '/' + pagina, { waitUntil: 'domcontentloaded' });
  if (espera) await pg.waitForSelector(espera, { timeout: 120000 }).catch(() => {});
  else await pg.waitForFunction(() => document.querySelector('.gate') || (typeof CTX !== 'undefined' && CTX && typeof PROLOG_ESTADO !== 'undefined' && PROLOG_ESTADO !== 'lendo'), { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return { pg, ctx, errs };
}
const rola = pg => pg.evaluate(() => ({ doc: document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
  main: (() => { const m = document.getElementById('mainBox'); return m.scrollHeight > m.clientHeight + 1; })() }));

/* ══ 1 · motor ══ */
{
  console.log('\n══ 1 · fatos, ponte, ofensores, rede, aprendizado');
  const { pg, ctx, errs } = await abre();
  af('sem erro de página', errs.length === 0, errs.join(' | '));
  const r = await pg.evaluate(() => {
    const f = id => FATOS.find(x => x.id === id);
    const cgr = f('CGR|ROTA|Combustíveis|2026-08'), grl = f('GRL|ROTA|Manutenções|2026-08'), pir = f('PIR|EMPURRADA|Pneus|2026-08'), pirc = f('PIR|EMPURRADA|Combustíveis|2026-08'), van = f('GRL|VAN|Combustíveis|2026-08');
    const d = cgr && diag(cgr), dg = grl && diag(grl), dp = pir && diag(pir), dpc = pirc && diag(pirc), dv = van && diag(van);
    const seg = f('CGR|ROTA|Seguros e licenças|2026-08'), outros = f('CGR|ROTA|Outros|2026-08');
    const ang = f('ANG|DISTRIBUICAO URBANA|Combustíveis|2026-08'), da = ang && diag(ang), cgrp = f('CGR|ROTA|Pneus|2026-08');
    const inv = { n: 0, erros: [] }; FATOS.forEach(fx => { const dx = diag(fx); inv.n++; const tm = new Set(dx.causas.map(c => c.tema)), pt = {};
      if (dx.causas.length > 3) inv.erros.push(fx.id + ': ' + dx.causas.length + ' causas');
      dx.causas.filter(c => c.rede && c.meta != null && isFinite(c.val) && !/osVenc|osCritica/.test(c.ind)).forEach(c => { if (c.dir === 'down' ? c.val < c.meta * 1.05 : c.val > c.meta * 0.95) inv.erros.push(fx.id + ': ' + c.ind + ' colado na meta virou causa'); });
      dx.acoes.forEach(a => { if (!tm.has(a.tema)) inv.erros.push(fx.id + ': ação sem causa (' + a.tema + ')'); pt[a.tema] = (pt[a.tema] || 0) + 1; if (pt[a.tema] > 3) inv.erros.push(fx.id + ': 4+ ações em ' + a.tema); }); });
    const kS = Object.keys(CTX.kml).find(x => /^CGR\|ROTA\|2026-08$/.test(x)) || Object.keys(CTX.kml).find(x => x.startsWith('CGR|') && x.endsWith('|2026-08'));
    const dS = kS && FcaAuto.diagnostico(cgr, Object.assign({}, CTX, { kml: Object.assign({}, CTX.kml, { [kS]: CTX.kml[kS].map(r => ({ ...r, pRem: r.pRem > 0 ? r.pRem * 1.2 : r.pRem })) }) }));
    const savP = dS && { k: kS, preco: dS.blocos.comb.preco, causas: dS.causas.map(c => [c.tema, c.txt]), acoes: dS.acoes.map(a => a.tema) };
    return { savP, inv, n: FATOS.length, maxVig: CTX.maxVig, setembro: FATOS.some(x => x.vig === '2026-09'), seguro: FATOS.some(x => x.pac === 'Seguros e licenças'), goi: FcaAuto.unidadeDoDRE('', 'AUTO SERVIÇO - GOI'),
      tol: cgr && [{ over: 4000, dpct: 1.5 }, { over: 6000, dpct: 1.5 }, { over: 3000, dpct: 2.6 }, { over: 5000, dpct: 2.4 }].map(o => { const dx = FcaAuto.diagnostico(Object.assign({}, cgr, o), CTX); return [!!dx.tol, dx.causas.length, dx.acoes.length, dx.causaTxt]; }),
      seg: seg && { over: seg.over, dpct: seg.dpct, txt: FcaAuto.desvioTxt(seg) }, outros: outros && { over: outros.over }, segD: seg && { causas: diag(seg).causas.map(c => c.txt), acoes: diag(seg).acoes.map(a => a.txt) },
      cgr: cgr && { over: cgr.over, contas: cgr.contas.map(c => [c.conta, Math.round(c.ov)]), txt: FcaAuto.desvioTxt(cgr) },
      ponte: d && { dCusto: d.blocos.ponte.dCusto, vol: d.blocos.ponte.vol, efic: d.blocos.ponte.efic, preco: d.blocos.ponte.preco, dif: d.blocos.ponte.dif, expl: d.explicado,
        kmL: [d.blocos.comb.kmLReal, d.blocos.comb.kmLRem], causas: d.causas.map(c => [c.tema, Math.round(c.rs || 0), c.txt.slice(0, 60), c.txt]), acoes: d.acoes.map(a => [a.tema, a.ofens]) },
      grl: dg && { causas: dg.causas.map(c => [c.tema, !!c.rede, c.txt]), acoes: dg.acoes.map(a => [a.tema, a.txt, a.ofens, a.taxa && a.taxa.txt]), hist: dg.historico.daUni.map(c => [c.vig, c.res, c.over, c.overProx]) },
      grlSinais: dg && dg.sinais.map(x => x.txt), grlKm: dg && dg.blocos.contratoKm, cgrSinais: d && d.sinais.map(x => x.txt),
      pir: dp && { causas: dp.causas.map(c => c.txt), acoes: dp.acoes.map(a => [a.txt, a.ofens]) },
      pirc: dpc && { over: pirc.over, expl: dpc.explicado, causas: dpc.causas.map(c => [c.tema, c.txt]), acoes: dpc.acoes.map(a => [a.tema, a.ofens, a.txt]), efic: dpc.blocos.comb && dpc.blocos.comb.efic, sinais: dpc.sinais.map(s => s.txt), avisos: dpc.avisos },
      van: dv && { comb: dv.blocos.comb && { lit: dv.blocos.comb.lit, rsLRem: dv.blocos.comb.rsLRem } },
      ang: da && { over: ang.over, seara: da.blocos.seara, ponte: da.blocos.ponte && ['dCusto', 'vol', 'efic', 'preco', 'dif'].map(k => Math.round(da.blocos.ponte[k])), kmL: [da.blocos.comb.kmLReal, da.blocos.comb.kmLRem], rsL: [da.blocos.comb.rsLReal, da.blocos.comb.rsLRem],
        expl: da.explicado, avisos: da.avisos, ofE: (da.acoes.find(a => a.tema === 'Condução') || {}).ofens, ofP: (da.acoes.find(a => a.tema === 'Abastecimento / preço') || {}).ofens, gap: CTX.fatoUni['ANG|2026-08'] },
      ano: { grl: dg && dg.ano, cgrp: cgrp && diag(cgrp).ano, cgr: d && d.ano, txt: dg && dg.causaTxt },
      fontes: LIDO.fontes.map(x => [x.nome, x.estado, x.linhas]),
      redeManut: (CTX.rede['Manutenções'] || []).filter(e => e.x === 'sla').map(e => ({ r0: +e.r0.toFixed(2), n0: e.n0, sust: e.sust, q0: e.q0 })),
      aprend: CTX.aprend.temas.map(t => [t.pac, t.tema, t.aval, t.melhor]), casos: CTX.aprend.casos.map(c => [c.uni, c.vig, c.res]),
      extra: { cat: Object.keys(CTX.cat), nRede: (CTX.rede['Manutenções'] || []).length, pir: CTX.fatoUni['PIR|2026-08'], grl: CTX.fatoUni['GRL|2026-08'], grlJul: CTX.fatoUni['GRL|2026-07'], cgr: CTX.fatoUni['CGR|2026-08'],
        redeNota: (CTX.rede['Combustíveis'] || []).find(e => e.x === 'cond_nota'),
        cgrCausas: d && d.causas.map(c => [c.ind || c.tema, !!c.rede]), cgrCond: !!(d && (d.causas.some(c => /^cond_/.test(c.ind || '')) || d.sinais.some(x => /^cond_/.test(x.ind || '')))),
        pirSinal: !!(dpc && dpc.sinais.some(x => x.ind === 'cond_nota')), pirRede: !!(dpc && dpc.causas.some(c => c.rede)), pirCausas: dpc && dpc.causas.map(c => [c.ind || c.tema, !!c.rede]) } };
  });
  af('fatos: a regra do FCA — todo pacote que estourou, SEM Seguros e licenças (corporativo, 15/10/2026); set/26 (só orçado) fora', r.n > 0 && !r.setembro && !r.seguro && r.maxVig === '2026-08', `${r.n} fatos · DRE até ${r.maxVig}`);
  af('Goiânia: "AUTO SERVIÇO - GOI" da aba Km/L é a unidade GNA', r.goi === 'GNA', String(r.goi));
  const tl = r.tol || [];
  af('tolerância: até 2% e até R$ 5 mil fica sem causa e ação', tl[0] && tl[0][0] && tl[0][1] === 0 && tl[0][2] === 0 && /toler/.test(tl[0][3]), JSON.stringify(tl[0]));
  af('tolerância: até 2% com mais de R$ 5 mil é explicado', tl[1] && !tl[1][0] && tl[1][1] > 0, JSON.stringify(tl[1]));
  af('tolerância: acima de 2% é explicado, qualquer valor', tl[2] && !tl[2][0] && tl[2][1] > 0, JSON.stringify(tl[2]));
  af('tolerância: 2,4% (a tela mostra 2%) e R$ 5 mil fica sem causa', tl[3] && tl[3][0], JSON.stringify(tl[3]));
  af('Seguro e IPVA não viram fato (Seguros e licenças fora do FCA); Depreciação cai em "Outros"', !r.seg && r.outros && Math.round(r.outros.over) === 500, JSON.stringify([r.seg, r.outros]));
  af('CGR · ROTA · ago/26 · Combustíveis = R$ 31.000 (30 mil da conta + 1 mil do Arla)', r.cgr && Math.round(r.cgr.over) === 31000, JSON.stringify(r.cgr && r.cgr.contas));
  af('o fato tem o MESMO texto do FCA (Desvio + Contas)', r.cgr && /^Desvio: ▲ R\$ 31\.000 · ▲ -30%\nContas:\n- Combustíveis Veiculos e Equipamentos: ▲ 30K \| ▲ 30%\n- Fluídos \(Arla\): ▲ 1K \| ▲ 20%$/.test(r.cgr.txt), r.cgr && JSON.stringify(r.cgr.txt));
  const P = r.ponte || {};
  af('ponte: Δ custo 30.000 = Km rodado 11.600 (5.000 km ÷ Km/L rem 2,50 × R$/L rem 5,80, sem R$/km) + Eficiência 11.600 + Preço 4.800 + Diferença 2.000', Math.round(P.dCusto) === 30000 && Math.round(P.vol) === 11600 && Math.round(P.efic) === 11600 && Math.round(P.preco) === 4800 && Math.round(P.dif) === 2000, JSON.stringify([P.dCusto, P.vol, P.efic, P.preco, P.dif]));
  af('aba Km/L sem cabeçalho: Km/L real 2,29 × rem 2,50 pelas posições padrão', P.kmL && Math.abs(P.kmL[0] - 55000 / 24000) < 1e-9 && P.kmL[1] === 2.5, JSON.stringify(P.kmL));
  af('as três alavancas + Arla explicam 94% (29.000 de 31.000): acima da metade, a diferença DRE × bases (2.000) NÃO vira causa; o km fala em litros e R$/L, nunca em R$/km', Math.abs(P.expl - 29000 / 31000) < 1e-9 && (P.causas || []).some(c => c[0] === 'Km / rota' && /^Dispersão de km: \+5\.000 km \(\+10,0%\) · R\$ 11,6 mil$/.test(c[3])) && !(P.causas || []).some(c => /R\$\/km/.test(c[3])) && !(P.causas || []).some(c => c[0] === 'Lançamento / contábil') && !(P.acoes || []).some(a => a[0] === 'Lançamento / contábil'), String(P.expl) + ' ' + JSON.stringify(P.causas));
  af('SAVING DE PREÇO vira só observação dentro da causa da eficiência: sem linha de preço e sem ação de preço', r.savP && r.savP.preco < 0 && !r.savP.causas.some(c => /^Preço R\$\/L:/.test(c[1])) && r.savP.causas.some(c => /^Eficiência Km\/L: [^\n]*\n\nObs\.: Preço R\$\/L economizou R\$ 23,0 mil \(6,00 vs 6,96 rem\.\)$/.test(c[1])) && !r.savP.acoes.includes('Abastecimento / preço'), JSON.stringify(r.savP));
  af('NO MÁXIMO 3 CAUSAS: Km rodado, Eficiência e Preço (na ordem do R$); o Arla (R$ 1.000, 3% do desvio: abaixo de 10%) fica nos sinais, sem ação', P.causas && P.causas.map(c => c[1]).join(',') === '11600,11600,4800' && !(P.acoes || []).some(a => a[0] === 'Arla') && (r.cgrSinais || []).some(t => /^Arla: real R\$ 6,0 mil vs rem\. R\$ 5,0 mil · menos de 10%/.test(t)), JSON.stringify([P.causas, r.cgrSinais]));
  const ofE = (P.acoes || []).find(a => a[0] === 'Condução'), ofP = (P.acoes || []).find(a => a[0] === 'Abastecimento / preço');
  af('ofensor de eficiência: só a placa que gastou acima da régua (CGR0A01, 2.000 L)', ofE && ofE[1].length === 1 && /^CGR0A01 \(VW 13\.180\) 2,00 km\/L, 2\.000 L, R\$ 11,6 mil$/.test(ofE[1][0]), JSON.stringify(ofE));
  af('ofensores de preço na ordem do R$ pago acima (A 2.000, B 1.600, C 1.200)', ofP && ofP[1].map(x => x.slice(0, 7)).join(',') === 'CGR0A01,CGR0B02,CGR0C03', JSON.stringify(ofP));
  af('VAN: "ROTA (VAN) - GRL" do DRE casa com "VAN - GRL" da Km/L e usa o preço do ROTA (6,00)', r.van && r.van.comb && r.van.comb.lit === 1200 && r.van.comb.rsLRem === 6, JSON.stringify(r.van));
  const G1 = r.grl || { causas: [], acoes: [] };
  af('Manutenções: a CARTA numa causa só, primeiro (grupos com o %, a placa que mais pesa com o grupo e o fornecedor que concentra)', G1.causas[0] && G1.causas[0][0] === 'Carta de Custos' && /^Carta de Custos: Embreagem R\$ 60,0 mil \(60% de R\$ 100,0 mil\), Freios R\$ 30,0 mil \(30%\), Motor R\$ 10,0 mil \(10%\) · placa: GRL4D44 R\$ 60,0 mil \(Embreagem R\$ 60,0 mil\) · fornecedor: Retífica Beta 70%$/.test(G1.causas[0][2]), JSON.stringify(G1.causas.map(c => c[2])));
  const aGr = G1.acoes.find(a => /^Fazer a análise de causa raiz nas placas listadas/.test(a[1]));
  af('ações da Carta: causa raiz no grupo que mais pesou com as placas dele, e cotar com outro fornecedor (os dois com o tema da causa)', aGr && aGr[0] === 'Carta de Custos' && aGr[2].join() === 'GRL4D44 R$ 60,0 mil' && G1.acoes.some(a => a[0] === 'Carta de Custos' && /^Auditar os orçamentos de Retífica Beta e cotar com outro fornecedor$/.test(a[1])), JSON.stringify(G1.acoes.map(a => [a[0], a[1].slice(0, 70)])));
  af('rede: SLA × desvio de Manutenções plantado sai forte, sentido certo e sustentado', r.redeManut[0] && r.redeManut[0].r0 < -0.8 && r.redeManut[0].sust, JSON.stringify(r.redeManut));
  af('SLA 50% (meta 75%) vira causa "rede" no GRL, em português da ponta (sem r, sem n, sem quartil)', G1.causas.some(c => c[1] && /^SLA de manutenção: 50,0% \(meta 75,0%\)$/.test(c[2])) && !G1.causas.some(c => /r = |unidade-mês|quartil|rede|ligação/.test(c[2])), JSON.stringify(G1.causas.filter(c => c[1])));
  af('COMBUSTÍVEIS só tem preço, eficiência e km: nenhuma causa nem ação de checklist/SLA/preventiva (CGR e PIR)', (r.ponte.causas || []).every(c => /^(Condução|Km \/ rota|Abastecimento \/ preço|Lançamento \/ contábil)$/.test(c[0])) && !(r.ponte.acoes || []).some(a => /Preventiva|Oficina|Corretiva/.test(a[0])) && (r.pirc.acoes || []).every(a => /^(Condução|Km \/ rota|Abastecimento \/ preço|Lançamento \/ contábil)$/.test(a[0])), JSON.stringify([r.ponte.causas.map(c => c[0]), r.pirc.acoes.map(a => a[0])]));
  const aSla = G1.acoes.find(a => a[0] === 'Oficina / SLA');
  af('a REDE entra com UM indicador (o SLA, a ligação mais forte) e a preventiva fora da meta vai para os sinais, sem ação', G1.causas.filter(c => c[1]).length === 1 && !G1.acoes.some(a => a[0] === 'Preventiva') && (r.grlSinais || []).some(t => /^Aderência a preventivas: 80,0%/.test(t)), JSON.stringify([G1.causas.map(c => c[0]), r.grlSinais]));
  af('…e a ação do SLA é a dele: OS em aberto, da mais velha (OS 777 há 30 dias, Alta)', aSla && /^Cobrar o SLA/.test(aSla[1]) && aSla[2][0] === 'OS 777 GRL6F66 30d (Alta)', JSON.stringify(aSla));
  af('CONTRATO numa causa só, com o km das placas variáveis: a fatura de ago cobra o km de jul; GRL4D44 rodou +1.000 km acima do remunerado (+24% das 2 variáveis), R$ 400 a R$ 0,40/km; a fixa fica fora', G1.causas.some(c => c[0] === 'Contrato' && /^Contrato de manutenção: 1 de 2 placas variáveis acima do km rem\. em jul\/26 \(\+1\.000 km, \+24%\) · R\$ 400 na fatura$/.test(c[2])), JSON.stringify(G1.causas.filter(c => c[0] === 'Contrato').map(c => c[2])));
  const aKm = G1.acoes.find(a => /^Rever as viagens que não remuneram e a roteirização das placas listadas/.test(a[1]));
  af('…e a ação de contenção (rever viagens e roteirização, separada de "usar placa de contrato fixo") lista a placa, o km a mais, o % e o R$', aKm && aKm[2].join() === 'GRL4D44 +1.000 km (+50%), R$ 400' && G1.acoes.some(a => /^Usar placa de contrato fixo/.test(a[1])), JSON.stringify(aKm));
  af('…3 causas no total (Carta, Contrato, SLA), e nada de Km/L vira causa nem sinal de Manutenções', G1.causas.length === 3 && !G1.causas.some(c => /Km\/L|R\$\/L/.test(c[2])) && !(r.grlSinais || []).some(t => /Km\/L|R\$\/L/.test(t)), JSON.stringify([G1.causas.map(c => c[0]), r.grlSinais]));
  af('aprendizado: FCA de jul/26 do GRL "melhorou" (30 mil → 15 mil no mês seguinte)', G1.hist.length === 1 && G1.hist[0][1] === 'melhorou' && Math.round(G1.hist[0][2]) === 30000 && Math.round(G1.hist[0][3]) === 15000, JSON.stringify(G1.hist));
  af('…e a ação de SLA traz a taxa do tema na rede (1 de 1)', aSla && /FCAs de oficina \/ sla em Manutenções melhoraram o mês seguinte em 1 de 1/.test(aSla[3] || ''), JSON.stringify(aSla && aSla[3]));
  af('FCA de RPM fica fora do aprendizado de Custos; o de ago/26 fica "aguardando"', !r.casos.some(c => c[0] === 'PIR') && r.casos.some(c => c[0] === 'CGR' && c[2] === 'aguardando'), JSON.stringify(r.casos));
  const Pn = r.pir || { causas: [], acoes: [] };
  af('Pneus: o Prolog numa causa só (2 de 4 com pressão fora; 1 com ≤ 3 mm; amplitude) e o alinhamento vencido como outra', Pn.causas.some(c => /^Prolog \(hoje\): pressão fora do ideal em 2 de 4 pneus \(50,0%\) · 1 com ≤ 3 mm · 1 com amplitude > 5 mm$/.test(c)) && Pn.causas.some(c => /^Alinhamento vencido \(Ginfo, hoje\): 1 placa$/.test(c)) && Pn.causas.length <= 3, JSON.stringify(Pn.causas));
  af('Pneus: ações com placa (calibrar PIR1A11; recape 3–4 mm; alinhar PIR2B22)', Pn.acoes.some(a => /Calibrar/.test(a[0]) && a[1][0] === 'PIR1A11 2 pneus') && Pn.acoes.some(a => /recape/.test(a[0])) && Pn.acoes.some(a => /Alinhar/.test(a[0]) && a[1][0] === 'PIR2B22'), JSON.stringify(Pn.acoes));
  const Pc = r.pirc || { acoes: [], sinais: [] };
  af('condução: o motorista de pior nota de PIR entra na ação de eficiência', Pc.acoes.some(a => a[0] === 'Condução' && a[1].some(x => /^JOAO RUIM 52 pts/.test(x))) && !Pc.acoes.some(a => a[1].some(x => /ANA BOA/.test(x))), JSON.stringify(Pc.acoes));
  const X = r.extra || {};
  af('catálogo: as variáveis novas entram na rede (condução, frota, Carta, FCA, bases de combustível)', ['cond_nota', 'cond_baixo', 'carta_n', 'carta_forn', 'fca_preench', 'kml_gap', 'preco_gap'].every(k => X.cat.includes(k)) && X.cat.length >= 40 && X.nRede >= 15, `${X.cat.length} no catálogo · ${X.nRede} com dado em Manutenções`);
  af('condução de PIR ago/26: inclui o motorista plantado (≥ 500 km) e pesa pelo km', X.pir && X.pir.cond_nota > 0 && X.pir.cond_nota < 91 && X.pir.cond_baixo > 0, JSON.stringify(X.pir));
  af('Carta do GRL ago/26: 4 lançamentos, ticket R$ 25.000, maior fornecedor 70%', X.grl && X.grl.carta_n === 4 && Math.round(X.grl.carta_ticket) === 25000 && Math.round(X.grl.carta_forn) === 70, JSON.stringify(X.grl));
  af('Carta de PIR ago/26: 100% de pneus novos; FCA do GRL jul/26: 100% com ação', X.pir && Math.round(X.pir.carta_novos) === 100 && X.grlJul && X.grlJul.fca_preench === 100, JSON.stringify([X.pir && X.pir.carta_novos, X.grlJul]));
  af('bases de combustível do CGR ago/26: Km/L −8,3% e R$/L +3,4% contra o remunerado', X.cgr && Math.abs(X.cgr.kml_gap - (22000 / 24000 - 1) * 100) < 1e-9 && Math.abs(X.cgr.preco_gap - (144000 / 139200 - 1) * 100) < 1e-9, JSON.stringify(X.cgr));
  af('DriverPro SÓ NA EMPURRADA: a nota plantada nas CDDs fica fora; a rede só tem os 8 meses de PIR, e ainda sai sustentada', X.redeNota && X.redeNota.sust && X.redeNota.r0 < -0.8 && X.redeNota.n0 === 8 && !(X.cgr && 'cond_nota' in X.cgr), JSON.stringify([X.redeNota, X.cgr && X.cgr.cond_nota]));
  af('…CGR ago/26 não ganha causa nem sinal de condução; em PIR ago/26 (nota 68 < 75) a condução entra como SINAL (a causa é a eficiência, e a ação do DriverPro fica com ela)', !X.cgrCond && X.pirSinal && !X.pirRede, JSON.stringify([X.cgrCausas, X.pirCausas]));
  const INV = r.inv || {};
  af('EM TODOS OS FATOS: no máximo 3 causas, nenhum indicador a menos de 5% da meta como causa, toda ação com o tema de uma causa mostrada e no máximo 3 ações por causa (uma por linha)', INV.n > 0 && !INV.erros.length, JSON.stringify(INV));
  const A = r.ang || {};
  af('SEARA pela Árvore da Seara: ANG ago/26 tem a ponte (Δ 25.000 = km rodado 7.333 pelo Km/L e R$/L rem + eficiência 4.000 + preço 7.000 + diferença 6.667)', A.seara && A.ponte && A.ponte.join() === '25000,7333,4000,7000,6667' && Math.abs(A.expl - 18333.33 / 25000) < 1e-4, JSON.stringify(A.ponte) + ' ' + A.expl);
  af('…Km/L 2,86 × 3,00 rem (KmPorLitro) e R$/L 6,00 × 5,50 (PrecoDiesel); ANG2B22 pela média do modelo (aviso)', A.kmL && Math.abs(A.kmL[0] - 40000 / 14000) < 1e-9 && A.kmL[1] === 3 && A.rsL[0] === 6 && A.rsL[1] === 5.5 && A.avisos.some(a => /1 placa sem remunerado na Base Remunerado/.test(a)) && A.avisos.length === 1, JSON.stringify([A.kmL, A.rsL, A.avisos]));
  af('…ofensores: só a ANG1A11 gastou acima da régua (8.000 L × 6.667) e pagou acima do preço', A.ofE && A.ofE.length === 1 && /^ANG1A11/.test(A.ofE[0]) && A.ofP && A.ofP.length === 2 && /^ANG1A11/.test(A.ofP[0]), JSON.stringify([A.ofE, A.ofP]));
  af('…e a rede recebe o Km/L (−4,8%) e o R$/L (+9,1%) da Anhanguera contra o remunerado', A.gap && Math.abs(A.gap.kml_gap - (40000 / 14000 / 3 - 1) * 100) < 1e-9 && Math.abs(A.gap.preco_gap - (6 / 5.5 - 1) * 100) < 1e-9, JSON.stringify(A.gap));
  af('fontes: as três abas da Seara lidas com o nº de linhas', ['Seara · aba Combustível', 'Seara · Base Remunerado (Km/L e R$/L rem)', 'Seara · Remunerado (km por placa)'].every(n => (r.fontes || []).some(x => x[0] === n && x[1] === 'ok' && x[2] > 0)), JSON.stringify(r.fontes));
  const Y = r.ano || {};
  af('ANO em todo pacote: GRL Manutenções ▲ R$ 45.000 (6%) com a curva de captura (11% abaixo nos 4 meses que faltam, set → dez/26)', Y.grl && Math.round(Y.grl.over) === 45000 && Y.grl.restam === 4 && Math.round(Y.grl.reducao) === 11 && /^▲ R\$ 45\.000 \(6%\) · reduzir 11% até dez\/26$/.test(Y.grl.txt), JSON.stringify(Y.grl));
  af('…CGR Pneus estourou em ago mas o ano é saving ▼ R$ 13.000 (5%): tratar como pontual', Y.cgrp && Math.round(Y.cgrp.over) === -13000 && /^▼ R\$ 13\.000 \(5%\) · desvio pontual$/.test(Y.cgrp.txt), JSON.stringify(Y.cgrp));
  af('…e a linha do ano vai no texto copiado, depois das causas, como YTD', /\nYTD: ▲ R\$ 45\.000/.test(Y.txt || ''), '');
  af('empurrada sem Dispersão maior: sem causa de volume; aviso nenhum de base faltando', Pc.efic > 0 && !Pc.avisos.length, JSON.stringify(Pc.avisos));
  const Lc = (Pc.causas || []).find(c => c[0] === 'Lançamento / contábil'), La = (Pc.acoes || []).find(a => a[0] === 'Lançamento / contábil');
  af('PIR: as três alavancas explicam só 29% (5,8 de 20 mil): entra a linha do resto (14,2 mil que não batem com os abastecimentos, com os dois lados) e a ação de conciliar', Lc && /^Dispersão de km, Eficiência Km\/L e Preço R\$\/L explicam só 29% \(R\$ 5,8 mil de R\$ 20,0 mil\) · R\$ 14,2 mil sem explicação \(real DRE −R\$ 1,8 mil vs abastecimentos; rem\. DRE −R\$ 16,0 mil vs bases\)$/.test(Lc[1]) && La && /^Conciliar a conta Combustíveis/.test(La[2]) && Pc.expl <= 0.5, JSON.stringify([Pc.expl, Lc, La]));
  af('…e a frase "sai do nosso bolso" não existe mais em causa nenhuma', ![...(P.causas || []), ...(Pc.causas || [])].some(c => /nosso bolso|Somos pagos/.test(c[2] || c[1] || '')), '');
  await ctx.close();
}

/* ══ 2 · telas ══ */
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  console.log(`\n══ 2 · telas ${w}×${h} ${tema}`);
  const { pg, ctx, errs } = await abre({ w, h, tema });
  af('sem erro de página', errs.length === 0, errs.join(' | '));
  for (const v of ['resumo', 'kanban', 'tabela', 'rede', 'historico', 'fontes']) {
    await pg.click(`.s-item[data-v="${v}"]`); await pg.waitForTimeout(120);
    const s = await rola(pg);
    af(`${v}: a página não rola${v === 'resumo' || v === 'rede' || v === 'fontes' ? ' e o miolo também não' : ''}`, !s.doc && (v === 'kanban' || v === 'tabela' || v === 'historico' || !s.main), JSON.stringify(s));
    if (SHOT && w === 1366) await pg.screenshot({ path: path.join(SHOT, `fa-${v}-${tema}.png`) });
    if (v === 'tabela') { const q = await pg.evaluate(() => { const ls = [...document.querySelectorAll('table.fa-rel.din td.fato small')].filter(x => !x.classList.contains('fa-ano'));
      const lh = x => parseFloat(getComputedStyle(x).lineHeight) || 15; return { n: ls.length, quebra: ls.filter(x => Math.round(x.getBoundingClientRect().height / lh(x)) > x.querySelectorAll('br').length + 1).map(x => x.innerText.trim()) }; });
      af(`tabela ${w}: as contas do fato cabem numa linha`, q.n > 0 && !q.quebra.length, JSON.stringify(q)); }
  }
  if (w === 1366 && tema === 'dark') {
    await pg.click('.s-item[data-v="resumo"]'); await pg.waitForTimeout(100);
    const res = await pg.evaluate(() => ({ hn: document.querySelector('.hn').textContent, sub: document.getElementById('subVista').textContent, kpis: [...document.querySelectorAll('.fa-kpis .kpi .kl')].map(x => x.textContent) }));
    af('resumo abre em ago/26 (último mês com realizado) com o desvio total', /AGO\/26/.test(res.sub) && /^R\$/.test(res.hn), JSON.stringify(res));
    await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(100);
    const tb = await pg.evaluate(() => { const g = [...document.querySelectorAll('tbody.fg')]; const grl = g.find(t => t.querySelector('tr').dataset.id === 'GRL|ROTA|Manutenções|2026-08'), cgr = g.find(t => t.querySelector('tr').dataset.id === 'CGR|ROTA|Combustíveis|2026-08');
      const f = FATOS.find(x => x.id === 'GRL|ROTA|Manutenções|2026-08'), d = diag(f), ls = linhasDoFato(d);
      const ana = grl && [...grl.querySelectorAll('td[data-c="responsavel"]')].find(x => x.innerText.trim() === 'ANA SOUZA');
      const trAna = ana && ana.closest('tr');
      return { n: g.length, fatos: visiveis().length, modo: document.querySelector('#tabModo') ? 'botao' : 'linha', faixa: !!document.querySelector('.fa-tbar'), din: !!document.querySelector('table.fa-rel.din'),
        cols: [...document.querySelectorAll('table.fa-rel thead th')].map(x => x.textContent).join('|'),
        grlRows: grl && grl.querySelectorAll('tr').length, linhas: ls.length, acoes: d.acoes.length, campos: grl && grl.querySelectorAll('td[data-c="responsavel"]').length, editavel: !!document.querySelector('tbody.fg input, tbody.fg select'),
        grlSpan: grl && grl.querySelector('td').getAttribute('rowspan'), nums: grl && [...grl.querySelectorAll('td.cz .ln-n')].map(x => x.textContent.replace('.', '')).join(','), nCausas: d.causas.length, czSpan: grl && [...grl.querySelectorAll('td.cz')].reduce((s, x) => s + (+x.getAttribute('rowspan') || 1), 0), grlIds: grl && [...grl.querySelectorAll('tr')].every(t => t.dataset.id === 'GRL|ROTA|Manutenções|2026-08'),
        pareado: ls.filter(l => l.a && l.c).every(l => l.a.tema === l.c.tema), chaves: new Set(ls.filter(l => l.a).map(l => l.k)).size === d.acoes.length,
        ana: !!ana, anaAcao: trAna && trAna.querySelector('td.ln:not(.ac-c):nth-last-of-type(1)') ? '' : '', anaTxt: trAna && trAna.querySelector('td.ln:not(.cz):not(.ac-c)').innerText.slice(0, 60), anaSt: trAna && trAna.querySelector('td[data-c="status"] .chip').textContent, anaFeita: trAna && trAna.classList.contains('feita'), anaPrazo: trAna && trAna.querySelector('td[data-c="prazo"]').innerText.trim(),
        dl: [...document.querySelectorAll('#dl-resp option')].map(o => o.value).join(','), cgrFato: cgr && cgr.querySelector('td.fato').innerText.replace(/\s+/g, ' ').trim(), ytdNaCausa: !!document.querySelector('td.txt:not(.fato) .fa-ano'), erro: (document.querySelector('.fa-tbar-err') || {}).textContent || '' }; });
    af('TABELA SÓ LEITURA, COMO A DO FCA (nenhum input/select; dono, prazo e status em texto e chip) e SEMPRE "uma por linha" (sem a faixa de cima nem o botão Agrupado) = UMA LINHA POR AÇÃO, com Responsável · Prazo · Status; identificação mesclada (rowspan); causa do mesmo tema ao lado', tb.modo === 'linha' && !tb.faixa && tb.din && tb.n === tb.fatos && /Responsável\|Prazo\|Status$/.test(tb.cols) && !/Explica/.test(tb.cols) && tb.grlRows === tb.linhas && +tb.grlSpan === tb.linhas && tb.grlIds && tb.campos === tb.acoes && !tb.editavel && tb.pareado && tb.chaves && !tb.erro, JSON.stringify(tb));
    af('…causas numeradas 1, 2, 3 na ordem, cada uma mesclada sobre as ações dela; sem a coluna Explica', tb.nums === Array.from({ length: tb.nCausas }, (_, i) => i + 1).join(',') && tb.czSpan === tb.linhas, JSON.stringify([tb.nums, tb.nCausas, tb.czSpan, tb.linhas, tb.cols]));
    af('…a ação já gravada volta do banco: dono Ana Souza, prazo 30/09, Concluída e a linha esmaecida; os nomes do perfil viram sugestão', tb.ana && /^\d\.\d\.\s*Fazer a análise de causa raiz/.test(tb.anaTxt || '') && tb.anaSt === 'Concluída' && tb.anaFeita && tb.anaPrazo === '30/09/2026' && tb.dl === 'ANA SOUZA,BRUNO LIMA,CARLA DIAS,RENAN TESTE', JSON.stringify([tb.anaTxt, tb.anaSt, tb.anaFeita, tb.anaPrazo, tb.dl]));
    af('…o fato curto: contas resumidas, um ▲/▼ e o % entre parênteses, com o YTD dentro do Fato (e não nas causas)', /^Combustíveis ▲ R\$ 31\.000 \(30%\) Combustíveis ▲ 30K \(30%\) Arla ▲ 1K \(20%\) YTD/.test(tb.cgrFato) && !tb.ytdNaCausa, tb.cgrFato);
    // fecha uma ação sozinha: na Tabela nada se edita; o clique no STATUS da linha abre a caixa da ação, e é lá que se muda
    const alvo = await pg.evaluate(() => { const td = [...document.querySelectorAll('tbody.fg td[data-c="status"]')].find(x => x.dataset.fid === 'GRL|ROTA|Manutenções|2026-08' && /Não iniciada/.test(x.innerText)); td.setAttribute('id', 'stAlvo'); return td.dataset.k; });
    await pg.click('#stAlvo'); await pg.waitForTimeout(150);
    const abriu = await pg.evaluate(() => getComputedStyle(document.getElementById('ac-ov')).display);
    await pg.click('#ac-seg button[data-st="Em andamento"]'); await pg.waitForTimeout(150);
    await pg.selectOption('#ac-resp', 'BRUNO LIMA'); await pg.waitForTimeout(150);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
    const up = await pg.evaluate(() => ({ ok: document.getElementById('ac-ok').textContent, seg: [...document.querySelectorAll('#ac-seg button.on')].map(b => b.dataset.st), ups: window.__ups, st: document.getElementById('stAlvo').innerText.trim(), resp: [...document.querySelectorAll('tbody.fg td[data-c="responsavel"]')].find(x => x.dataset.k === document.getElementById('stAlvo').dataset.k && x.dataset.fid === 'GRL|ROTA|Manutenções|2026-08').innerText.trim() }));
    const u2 = up.ups[up.ups.length - 1] || {};
    af('…cada ação fecha sozinha: o clique no status da linha abre a caixa; status e dono mudados lá gravam UMA linha (fato × ação) e a linha da Tabela mostra o novo status e o dono', abriu === 'flex' && up.ups.length === 2 && up.ups.every(r => r.fato_id === 'GRL|ROTA|Manutenções|2026-08' && r.chave === alvo && r.unidade === 'GRL' && r.vigencia === '2026-08' && r.acao) && u2.status === 'Em andamento' && u2.responsavel === 'BRUNO LIMA' && up.st === 'Em andamento' && up.resp === 'BRUNO LIMA', JSON.stringify(up));
    const gest = await pg.evaluate(() => { const tds = [...document.querySelectorAll('tbody.fg td[data-c="responsavel"]')];
      const grl = tds.filter(x => x.dataset.fid === 'GRL|ROTA|Manutenções|2026-08').map(x => x.innerText.trim());
      const cgr = tds.filter(x => x.dataset.fid.startsWith('CGR|')).map(x => x.innerText.trim());
      return { grl, cgr, kav: [...document.querySelectorAll('.kav')].length }; });
    af('GESTOR DE FROTA AUTOMÁTICO: sem dono escolhido, a ação vem com o gestor da unidade (GRL → JOSE SANTOS, CGR → MICHEL OLIVEIRA); quem foi trocado na caixa continua com o escolhido', gest.grl.length > 1 && gest.grl.includes('JOSE SANTOS') && gest.grl.includes('BRUNO LIMA') && gest.cgr.length > 0 && gest.cgr.every(n => n === 'MICHEL OLIVEIRA'), JSON.stringify(gest));
    const selR = await pg.evaluate(() => { const s = document.getElementById('ac-resp'); return { tag: s.tagName, ops: [...s.options].map(o => o.textContent), val: s.value }; });
    af('RESPONSÁVEL É SELETOR: o gestor de frota da unidade (automático) + quem é da unidade do fato + admins, em maiúsculo com primeiro e último nome, SÓ o nome (Carla, da CGR, fica fora; Bruno Carvalho Lima vira BRUNO LIMA)', selR.tag === 'SELECT' && selR.ops.join('|') === 'JOSE SANTOS|ANA SOUZA|BRUNO LIMA|RENAN TESTE' && selR.val === 'BRUNO LIMA', JSON.stringify(selR));
    af('…a caixa grava sozinha: o botão de status fica marcado e o rodapé diz "Salvo ✓"', /^(Salvo|Guardado) ✓$/.test(up.ok) && up.seg.join() === 'Em andamento', JSON.stringify([up.ok, up.seg]));
    await pg.click('.s-item[data-v="kanban"]'); await pg.waitForTimeout(150);
    // KANBAN do FCA · Admin: um card por ação, colunas pelo status, arrastar muda o status
    const kc = await pg.evaluate(a => { const cols = [...document.querySelectorAll('.kcol[data-status]')], noCol = (fid, k) => { const c = [...document.querySelectorAll('.kcard[data-k]')].find(x => x.dataset.id === fid && x.dataset.k === k); return c && c.closest('.kcol').dataset.status; };
      const c = document.querySelector('.kcard.fa-kc[data-id="CGR|ROTA|Combustíveis|2026-08"]'), cs = c && getComputedStyle(c), inn = c && getComputedStyle(c.querySelector('.fk-in'));
      const nAc = FATOS.filter(f => visiveis().includes(f)).reduce((t, f) => t + linhasDoFato(diag(f)).filter(l => l.a).length, 0);
      return c && { heads: [...document.querySelectorAll('.kcol-head')].map(h => h.firstChild.textContent.trim()), cols: cols.map(x => x.dataset.status), cards: document.querySelectorAll('.kcard[data-k]').length, nAc,
        grl: noCol('GRL|ROTA|Manutenções|2026-08', a), top: c.querySelector('.kcard-top').innerText.replace(/\s+/g, ' '), fato: c.querySelector('.kcard-fato').innerText, ac: c.querySelector('.kcard-ac').innerText, causa: (c.querySelector('.kcard-causa') || {}).innerText || '', desv: c.querySelector('.kcard-desvio').innerText,
        drag: c.getAttribute('draggable'), raio: cs.borderTopLeftRadius, inBg: inn.backgroundColor, inTop: inn.borderTopWidth, k: c.dataset.k }; }, alvo);
    af('KANBAN como o do FCA · Admin: colunas Não iniciada · Em andamento · Concluída, um card por ação, e a ação que foi para "Em andamento" está nessa coluna', kc && kc.heads.join() === 'Não iniciada,Em andamento,Concluída' && kc.cols.join() === kc.heads.join() && kc.cards === kc.nAc && kc.cards > 0 && kc.grl === 'Em andamento', JSON.stringify(kc && [kc.heads, kc.cards, kc.nAc, kc.grl]));
    af('…o card: Custos · unidade · projeto · mês, o pacote, só o desvio do pacote (sem as contas), a causa numerada e a ação inteira num bloco separado por filete, sem caixa; arrastável, cantos de 4px', kc && /^Custos CGR · ROTA · AGO\/26$/.test(kc.top) && kc.fato === 'Combustíveis' && /^causa 1:/i.test(kc.causa) && /^1\.1 \S/.test(kc.ac) && kc.drag === 'true' && kc.raio === '4px' && /rgba\(0, 0, 0, 0\)|transparent/.test(kc.inBg) && kc.inTop === '1px' && !/Combustíveis ▲ 30K/.test(kc.desv) && /▲ R\$ 31\.000/.test(kc.desv), JSON.stringify(kc));
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'fa-kanban.png') });
    const caber = await pg.evaluate(() => { const ws = [...document.querySelectorAll('.top .ms-wrap')], r = ws[ws.length - 1].getBoundingClientRect(), t = document.getElementById('themeBtn').getBoundingClientRect(); return { dir: Math.round(r.right), tema: Math.round(t.right), w: innerWidth }; });
    af('…em 1366 px os 11 filtros e o botão de tema cabem no topo', caber.tema <= caber.w - 8, JSON.stringify(caber));
    // arrasta o card para Concluída: grava o status e o card muda de coluna
    const nUps = await pg.evaluate(() => window.__ups.length);
    await pg.dragAndDrop(`.kcard[data-id="CGR|ROTA|Combustíveis|2026-08"][data-k="${kc.k}"]`, '.kcol[data-status="Concluída"]'); await pg.waitForTimeout(250);
    const ar = await pg.evaluate(k => ({ ups: window.__ups.slice(-1)[0] || {}, n: window.__ups.length, col: (() => { const c = [...document.querySelectorAll('.kcard[data-k]')].find(x => x.dataset.id === 'CGR|ROTA|Combustíveis|2026-08' && x.dataset.k === k); return c && c.closest('.kcol').dataset.status; })() }), kc.k);
    af('…arrastar para "Concluída" grava o status da ação e o card passa para essa coluna', ar.n === nUps + 1 && ar.ups.status === 'Concluída' && ar.ups.chave === kc.k && ar.col === 'Concluída', JSON.stringify(ar));
    // os filtros do Admin: Status = Concluída deixa só as ações concluídas, no Kanban e na Tabela
    const fl = await pg.evaluate(() => { const w = document.getElementById('ms-st'); w._sel.clear(); w._sel.add('Concluída'); w._render(''); render();
      const sts = [...document.querySelectorAll('.kcard[data-k]')].map(c => c.closest('.kcol').dataset.status); vaiPara('tabela');
      const tb = [...document.querySelectorAll('tbody.fg td[data-c="status"]')].map(td => td.innerText.trim());
      const ids = [...document.querySelectorAll('.top .ms-wrap')].map(x => x.id); w._sel.clear(); w._render(''); vaiPara('kanban'); return { sts, tb, ids }; });
    af('FILTROS DO ADMIN: os 11, na mesma ordem; Status = Concluída deixa só as concluídas no Kanban e na Tabela', fl.ids.join() === 'ms-uni,ms-vig,ms-proj,ms-org,ms-pac,ms-st,ms-prazo,ms-conta,ms-causa,ms-acao,ms-resp' && fl.sts.length >= 2 && fl.sts.every(x => x === 'Concluída') && fl.tb.length === fl.sts.length && fl.tb.every(x => x === 'Concluída'), JSON.stringify(fl));
    await pg.dragAndDrop(`.kcard[data-id="CGR|ROTA|Combustíveis|2026-08"][data-k="${kc.k}"]`, '.kcol[data-status="Não iniciada"]'); await pg.waitForTimeout(250);
    const volta = await pg.evaluate(() => (window.__ups.slice(-1)[0] || {}).status);
    af('…e arrastar de volta para "Não iniciada" grava de novo', volta === 'Não iniciada', volta);
    await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(150);
    // as placas ofensoras ficam embaixo da causa, a ação só com o que fazer, uma por linha
    const of = await pg.evaluate(() => { const g = [...document.querySelectorAll('tbody.fg')].find(t => t.querySelector('tr').dataset.id === 'CGR|ROTA|Combustíveis|2026-08');
      const cz = [...g.querySelectorAll('td.cz')].find(x => /^.{0,4}Eficiência Km\/L/.test(x.innerText));
      const acs = [...g.querySelectorAll('tr[data-k]')].map(tr => tr.querySelector('td.ln:not(.cz):not(.ac-c)').innerText.trim());
      return { lis: cz ? [...cz.querySelectorAll('.fa-of li')].map(x => x.innerText) : null, acs, placaNaAcao: acs.some(a => /[A-Z]{3}[0-9][A-Z0-9][0-9]{2}/.test(a)), small: !!g.querySelector('td.ln:not(.cz) small') }; });
    af('PLACAS OFENSORAS EMBAIXO DA CAUSA (uma por linha) e a ação só com o que fazer, vistoria · rota · motoristas em três linhas', of.lis && of.lis.length === 1 && /^CGR0A01/.test(of.lis[0]) && !of.placaNaAcao && !of.small && of.acs.some(a => /^\d\.1\.\s*Vistoriar as placas listadas/.test(a)) && of.acs.some(a => /^\d\.2\.\s*Validar o perfil de rota/.test(a)) && of.acs.some(a => /^\d\.3\.\s*Acompanhar os motoristas/.test(a)), JSON.stringify(of));
    // a ação começa com o número da causa (2.1., 2.2., 2.3.)
    const nums = await pg.evaluate(() => { const erros = []; let n = 0;
      document.querySelectorAll('tbody.fg').forEach(tb => { let causa = null, j = 0;
        tb.querySelectorAll('tr').forEach(tr => { const cz = tr.querySelector('td.cz .ln-n'); if (cz) { causa = cz.textContent.replace('.', ''); j = 0; }
          if (!tr.dataset.k) return; const an = tr.querySelector('td.ln:not(.cz):not(.ac-c) .ln-n'); j++; n++;
          const quer = causa + '.' + j + '.'; if (!an || an.textContent !== quer) erros.push(tr.dataset.id + ': ' + (an ? an.textContent : '—') + ' ≠ ' + quer); }); });
      return { n, erros: erros.slice(0, 5) }; });
    af('AÇÃO NUMERADA PELA CAUSA: toda ação da Tabela começa com <causa>.<ordem> (2.1., 2.2., 2.3.)', nums.n > 0 && !nums.erros.length, JSON.stringify(nums));
    // clicar na AÇÃO abre a caixa dela, no desenho da caixa do FCA · Admin (prévia, nada grava)
    await pg.click('tr[data-id="CGR|ROTA|Combustíveis|2026-08"][data-k] td.ln:not(.ac-c):not(.cz)'); await pg.waitForTimeout(150);
    const ac = await pg.evaluate(() => { const g = id => document.getElementById(id); return { vis: getComputedStyle(g('ac-ov')).display, tit: g('ac-tit').textContent, ctx: g('ac-ctx').textContent, fato: g('ac-fato').value, desv: g('ac-desv').value, causa: g('ac-causa').value, acao: g('ac-acao').value, st: g('ac-status').value, campos: ['ac-resp','ac-prazo','ac-acomp'].every(i => g(i)), dir: [...document.querySelectorAll('#ac-ov .btn')].some(b => /Direcionar à unidade/.test(b.textContent) && b.disabled), previa: /^Sugestão automática\. .*FCA oficial/.test(document.querySelector('#ac-ov .ac-previa').textContent), diag: getComputedStyle(g('fm-ov') || document.body).display }; });
    af('AÇÃO ABRE NA CAIXA DO FCA: fato, desvio com YTD, a causa dela, a ação com os ofensores, responsável, prazo, status e acompanhamento; "Direcionar à unidade" travado e o aviso de prévia', ac.vis === 'flex' && ac.tit === 'Combustíveis' && /CGR · ROTA · AGO\/26/.test(ac.ctx) && ac.fato === 'Combustíveis' && /^Desvio: ▲ R\$ 31\.000/.test(ac.desv) && /\nYTD: ▲/.test(ac.desv) && ac.causa.length > 10 && ac.acao.length > 10 && ac.st === 'Não iniciada' && ac.campos && ac.dir && ac.previa && ac.diag !== 'flex', JSON.stringify(ac));
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'fa-acao.png') });
    // caixa maior: Fato, Causa e Ação abrem inteiros (sem rolagem por dentro) e a caixa cabe na tela
    const tam = await pg.evaluate(() => { const q = id => document.getElementById(id), cheio = el => el.scrollHeight <= el.clientHeight + 2, bx = document.querySelector('.kmodal.kac').getBoundingClientRect();
      return { w: Math.round(bx.width), cabe: bx.bottom <= innerHeight && bx.top >= 0, desv: cheio(q('ac-desv')), causa: cheio(q('ac-causa')), acao: cheio(q('ac-acao')), mesma: q('ac-causa').style.height === q('ac-acao').style.height }; });
    af('CAIXA MAIOR: Fato, Causa e Ação abrem inteiros, Causa e Ação com a mesma altura, e a caixa cabe na tela', tam.w >= 1100 && tam.cabe && tam.desv && tam.causa && tam.acao && tam.mesma, JSON.stringify(tam));
    await pg.click('#ac-diag'); await pg.waitForTimeout(150);
    const dg = await pg.evaluate(() => ({ ac: getComputedStyle(document.getElementById('ac-ov')).display, fm: getComputedStyle(document.getElementById('fm-ov')).display, lis: document.querySelectorAll('#fm-corpo li.ac-abre[data-k]').length }));
    af('…"Ver diagnóstico" troca para o diagnóstico do fato, e lá cada ação também abre a caixa dela', dg.ac === 'none' && dg.fm === 'flex' && dg.lis > 0, JSON.stringify(dg));
    await pg.click('#fm-corpo li.ac-abre[data-k]'); await pg.waitForTimeout(150);
    const dg2 = await pg.evaluate(() => ({ ac: getComputedStyle(document.getElementById('ac-ov')).display, fm: getComputedStyle(document.getElementById('fm-ov')).display }));
    af('…clicar na ação dentro do diagnóstico abre a caixa da ação', dg2.ac === 'flex' && dg2.fm === 'none', JSON.stringify(dg2));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
    await pg.click('tr[data-id="CGR|ROTA|Combustíveis|2026-08"] td.fato'); await pg.waitForTimeout(150);
    const m = await pg.evaluate(() => ({ vis: getComputedStyle(document.getElementById('fm-ov')).display, tit: document.getElementById('fm-tit').textContent, txt: document.getElementById('fm-corpo').textContent }));
    af('clique na linha abre o diagnóstico (ponte, causas, ações) com a linha do ano', m.vis === 'flex' && /Combustíveis · R\$ 31,0 mil/.test(m.tit) && /Ponte da conta Combustíveis/.test(m.txt) && /Vistoriar as placas listadas/.test(m.txt) && /YTD.{0,3}[▲▼]|YTD.{0,3}no remunerado/.test(m.txt), m.tit);
    af('…com o que a unidade escreveu no FCA do mês', /Rodamos mais km por causa da rota nova/.test(m.txt), '');
    if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'fa-modal.png') });
  }
  await ctx.close();
}

/* ══ 2b · tabela fca_auto_acao ainda não criada ══ */
{
  console.log('\n══ 2b · sem a tabela fca_auto_acao');
  const { pg, ctx, errs } = await abre({ acErr: true });
  await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(150);
  const r = await pg.evaluate(() => ({ faixa: !!document.querySelector('.fa-tbar'), dis: false, n: document.querySelectorAll('tbody.fg').length }));
  af('sem a tabela: a tela abre com as ações e não aparece faixa nem aviso em cima', r.n > 0 && !r.dis && !r.faixa && errs.length === 0, JSON.stringify(r));
  // preenche dono e status na caixa da ação: guarda no navegador, aparece na linha da tabela e volta depois do F5
  const alvo = await pg.evaluate(() => { const el = document.querySelector('tbody.fg td[data-c="responsavel"]'); return el ? { fid: el.dataset.fid, k: el.dataset.k } : null; });
  await pg.evaluate(a => abreAcao(a.fid, a.k), alvo); await pg.waitForTimeout(100);
  const dis = await pg.evaluate(() => document.getElementById('ac-status').disabled || document.getElementById('ac-resp').disabled);
  await pg.selectOption('#ac-resp', 'RENAN TESTE'); await pg.waitForTimeout(150);
  await pg.click('#ac-seg button[data-st="Em andamento"]'); await pg.waitForTimeout(150);
  const ok1 = await pg.evaluate(() => { try { return localStorage.getItem('fcaauto_previa_v1') || ''; } catch (e) { return ''; } });
  const naLinha = await pg.evaluate(a => { const q = c => [...document.querySelectorAll('tbody.fg td[data-c="' + c + '"]')].find(x => x.dataset.fid === a.fid && x.dataset.k === a.k); return [q('responsavel').innerText.trim(), q('status').innerText.trim()]; }, alvo);
  af('prévia: dono e status preenchidos na caixa da ação (liberada) são guardados no navegador', /RENAN TESTE/.test(ok1) && !dis, JSON.stringify([ok1, dis]));
  af('prévia: o que foi mudado na caixa aparece na linha da tabela', naLinha[0] === 'RENAN TESTE' && naLinha[1] === 'Em andamento', JSON.stringify(naLinha));
  await pg.reload(); await pg.waitForTimeout(400); await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(200);
  const volta = await pg.evaluate(a => { const q = c => [...document.querySelectorAll('tbody.fg td[data-c="' + c + '"]')].find(x => x.dataset.fid === a.fid && x.dataset.k === a.k); return [q('responsavel') && q('responsavel').innerText.trim(), q('status') && q('status').innerText.trim()]; }, alvo);
  af('prévia: depois do F5 o dono e o status voltam (guardados no navegador)', volta[0] === 'RENAN TESTE' && volta[1] === 'Em andamento', JSON.stringify(volta));
  await ctx.close();
}

/* ══ 2b · FCA OFICIAL (Renan, 15/10/2026: "subir como oficial, de setembro em diante. Anhanguera… ainda não"
   → "Não quero enviar. Quero que já seja direto o oficial quando for gerar FCA custos"): o plano e a gravação
   moram no motor (FcaAuto.planoOficial/aplicaOficial); esta seção confere o plano visto do /fca-automatico/ e
   a gravação pelo mesmo caminho; a 2c confere a geração de verdade (?gen=all do fca-preenchimento). ══ */
{
  console.log('\n══ 2b · plano e gravação no FCA oficial (motor)');
  const { pg, ctx, errs } = await abre({ acErr: true, oficial: { inicio: '2026-08', fora: ['ANG|2026-08'] } });
  const cte = await pg.evaluate(() => ({ ini: OFICIAL_INICIO, fora: [...OFICIAL_FORA], ok: fcaOk(), elegiveis: FATOS.filter(oficialElegivel).map(f => f.uni + '|' + f.vig), bt: !!document.getElementById('btOficial'), env: typeof enviarOficial }));
  af('o corte de verdade é set/26 com a ANG de set/26 fora (o teste adianta para ago/26 e a ANG de ago/26)', cte.ini === '2026-08' && cte.fora.join() === 'ANG|2026-08' && cte.ok, JSON.stringify(cte).slice(0, 200));
  const srcM = fs.readFileSync(path.join(RAIZ, 'assets/fca-auto.js'), 'utf8');
  af('…no motor: OFICIAL_INICIO 2026-09 e ANG|2026-09 fora', /\|\|\s*'2026-09'/.test(srcM) && /\['ANG\|2026-09'\]/.test(srcM));
  af('o botão "Enviar ao FCA oficial" NÃO existe mais: quem grava é a geração do FCA de Custos', !cte.bt && cte.env === 'undefined', JSON.stringify({ bt: cte.bt, env: cte.env }));
  af('…só fatos de ago/26 em diante e nenhum da ANG entram', cte.elegiveis.length > 0 && cte.elegiveis.every(k => k.endsWith('2026-08') && !k.startsWith('ANG|')), cte.elegiveis.join(' '));
  const P = await pg.evaluate(() => { const P = planoOficial(); const g = r => r.unidade + '|' + r.vigencia + '|' + r.projeto + '|' + r.fato;
    return { ins: P.ins.length, upd: P.upd.length, pulados: P.pulados.map(f => f.id), semAcao: P.semAcao.length,
      e1: P.upd.find(x => x.id === 'e1'), grlIns: P.ins.filter(r => g(r) === 'GRL|ago/26|ROTA - GRL|Manutenções'), todosIns: P.ins.map(r => ({ u: r.unidade, v: r.vigencia, o: r.origem, p: r.projeto, f: r.fato, st: r.status, ch: r.auto_chave, resp: r.responsavel, c: (r.causa || '').slice(0, 3), a: (r.acao || '').slice(0, 5), fd: !!r.fato_desvio })),
      anyAng: P.ins.some(r => r.unidade === 'ANG') || P.upd.some(x => x.f.uni === 'ANG'), anyJul: P.ins.some(r => r.vigencia !== 'ago/26') || P.upd.some(x => x.f.vig !== '2026-08') }; });
  af('o plano tem ações novas e nenhuma da ANG nem de antes do corte', P.ins > 0 && !P.anyAng && !P.anyJul, JSON.stringify({ ins: P.ins, upd: P.upd }));
  af('o fato que a unidade JÁ preencheu à mão (CGR ROTA Combustíveis ago/26, h2) é pulado, não misturado', P.pulados.includes('CGR|ROTA|Combustíveis|2026-08') && !P.todosIns.some(r => r.u === 'CGR' && r.f === 'Combustíveis'), P.pulados.join(' '));
  af('a 1ª ação do GRL Manutenções REUSA a linha vazia do fca-preenchimento (e1) com causa, ação, gestor e auto_chave', !!P.e1 && P.e1.u.auto_chave && /^1\. /.test(P.e1.u.causa || '') && /^1\.1\. /.test(P.e1.u.acao || '') && P.e1.u.responsavel === 'JOSE SANTOS' && P.e1.u.status === 'Não iniciada', JSON.stringify(P.e1 && P.e1.u).slice(0, 300));
  af('…as demais ações do mesmo fato viram linhas novas na fca: unidade, ago/26, Custos, projeto nível 3 inteiro, fato = pacote, desvio, dono = gestor, Não iniciada', P.grlIns.length > 0 && P.todosIns.every(r => r.v === 'ago/26' && r.o === 'Custos' && r.st === 'Não iniciada' && r.ch && r.fd && /^\d\.\d\. /.test(r.a)) && P.grlIns.every(r => r.projeto === 'ROTA - GRL' && r.fato === 'Manutenções' && r.responsavel === 'JOSE SANTOS'), JSON.stringify(P.todosIns.slice(0, 3)));
  // grava pelo MESMO caminho da geração do FCA de Custos (FcaAuto.aplicaOficial) e confere o que foi ao banco
  await pg.evaluate(async () => { const P = planoOficial(); await FA.aplicaOficial(sb, P, LIDO.fca); acoesDoFca(); render(); }); await pg.waitForTimeout(200);
  const G1 = await pg.evaluate(() => ({ ins: (window.__ins || []).filter(r => r.auto_chave).length, upd: (window.__upd || []).filter(x => x.tabela === 'fca').map(x => ({ id: x.eq && x.eq[1], ch: x.p.auto_chave })), fca: LIDO.fca.filter(r => r.auto_chave).length,
    acoes: Object.values(ACOES).filter(a => a._fca).length, plano2: (() => { const P = planoOficial(); return { ins: P.ins.length, upd: P.upd.length, iguais: P.iguais.length }; })() }));
  af('gravou: as linhas novas foram inseridas na fca e a e1 atualizada; as ações passaram a existir na fca e em ACOES', G1.ins === P.ins && G1.upd.some(x => x.id === 'e1' && x.ch) && G1.fca === P.ins + P.upd && G1.acoes === G1.fca, JSON.stringify(G1).slice(0, 300));
  af('gravar de novo não duplica nada: o plano volta vazio (tudo igual)', G1.plano2.ins === 0 && G1.plano2.upd === 0 && G1.plano2.iguais === G1.fca, JSON.stringify(G1.plano2));
  // dono/prazo/status de uma ação oficial gravam na própria fca
  await pg.click('.s-item[data-v="tabela"]'); await pg.waitForTimeout(200);
  const alvo = await pg.evaluate(() => { const td = [...document.querySelectorAll('tbody.fg td[data-c="status"]')].find(x => x.dataset.fid === 'GRL|ROTA|Manutenções|2026-08'); return td ? { fid: td.dataset.fid, k: td.dataset.k } : null; });
  af('a Tabela mostra o gestor como dono da ação oficial', !!alvo && await pg.evaluate(a => [...document.querySelectorAll('tbody.fg td[data-c="responsavel"]')].find(x => x.dataset.fid === a.fid && x.dataset.k === a.k).innerText.trim() === 'JOSE SANTOS', alvo));
  await pg.evaluate(a => salvaCampo(a.fid, a.k, 'status', 'Em andamento'), alvo); await pg.waitForTimeout(200);
  const G2 = await pg.evaluate(a => { const u = (window.__upd || []).filter(x => x.tabela === 'fca' && x.p.status === 'Em andamento'); const ac = ACOES[a.fid + '||' + a.k];
    return { n: u.length, eq: u[0] && u[0].eq, fcaId: ac && ac._fca, st: ac && ac.status, naFca: (LIDO.fca.find(r => r.id === (ac && ac._fca)) || {}).status, ups: window.__ups.length, msg: document.getElementById('acSalvo').textContent }; }, alvo);
  af('status mudado na ação oficial vai para a tabela fca (update pelo id), não para a prévia local nem para a fca_auto_acao', G2.n === 1 && G2.eq && G2.eq[0] === 'id' && G2.eq[1] === G2.fcaId && G2.st === 'Em andamento' && G2.naFca === 'Em andamento' && G2.ups === 0 && /Gravado no FCA/.test(G2.msg), JSON.stringify(G2));
  af('sem erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
}
/* ══ 2c · A GERAÇÃO DO FCA DE CUSTOS GRAVA CAUSA, AÇÃO E DONO (Renan, 15/10/2026: "Não quero enviar. Quero que já
   seja direto o oficial quando for gerar FCA custos"): FCA · Admin → Gerar FCA de Custos → fca-preenchimento
   ?gen=all cria os fatos vazios do mês e, na mesma rodada, o motor preenche cada um (set/26+; ANG set/26 fora). ══ */
{
  console.log('\n══ 2c · ?gen=all do fca-preenchimento grava o oficial');
  const { pg, ctx, errs } = await abre({ acErr: true, oficial: { inicio: '2026-08', fora: ['ANG|2026-08'] }, pagina: 'fca-preenchimento/index.html?gen=all', espera: '.genres' });
  const R = await pg.evaluate(() => { const T = window.__T.fca, fid = r => (r.unidade + '|' + FcaAuto.projKey(r.projeto || '') + '|' + (FcaAuto.pacDoFato(r.fato) || '') + '|' + (FcaAuto.vigDeLbl(r.vigencia) || ''));
    const grl = T.filter(r => fid(r) === 'GRL|ROTA|Manutenções|2026-08'), cgr = T.filter(r => fid(r) === 'CGR|ROTA|Combustíveis|2026-08'), ang = T.filter(r => r.unidade === 'ANG');
    const vazios = (window.__ins || []).filter(r => r.origem === 'Custos' && !r.auto_chave), autoIns = (window.__ins || []).filter(r => r.auto_chave), autoUpd = (window.__upd || []).filter(x => x.tabela === 'fca' && x.p.auto_chave);
    return { h: (document.querySelector('.genres-h') || {}).textContent || '', sub: (document.querySelector('.genres-sub') || {}).textContent || '', cols: [...document.querySelectorAll('.gentbl th')].map(t => t.textContent),
      vazios: vazios.length, vaziosSemCausa: vazios.every(r => !r.causa && !r.acao && !r.responsavel), autoIns: autoIns.length, autoUpd: autoUpd.length,
      reusou: autoUpd.filter(x => String(x.eq[1]).startsWith('ins')).length, e1: T.find(r => r.id === 'e1'),
      grl: grl.map(r => ({ id: r.id, ch: !!r.auto_chave, c: (r.causa || '').slice(0, 3), a: (r.acao || '').slice(0, 5), resp: r.responsavel, st: r.status })),
      cgr: cgr.map(r => ({ id: r.id, ch: !!r.auto_chave, causa: r.causa })), ang: ang.filter(r => r.auto_chave).length,
      comAuto: T.filter(r => r.auto_chave).length, semDono: T.filter(r => r.auto_chave && !r.responsavel).length }; });
  af('a tela de geração fecha com fatos novos E ações automáticas no título, e a coluna "Ações automáticas" na tabela', /fato\(s\) novo\(s\) · \d+ ação\(ões\) automática\(s\)/.test(R.h) && R.cols.includes('Ações automáticas'), R.h + ' | ' + R.cols.join(','));
  af('1º o fato nasce vazio (como sempre), depois o motor preenche: as linhas vazias dos fatos do mês foram REUSADAS por update', R.vazios > 0 && R.vaziosSemCausa && R.reusou > 0 && R.autoUpd >= R.reusou, JSON.stringify({ vazios: R.vazios, reusou: R.reusou, autoUpd: R.autoUpd, autoIns: R.autoIns }));
  af('GRL ago/26 Manutenções: a linha vazia e1 virou a 1ª ação (causa "1. ", ação "1.1. ", gestor JOSE SANTOS, Não iniciada) e as demais ações são linhas novas com auto_chave', !!R.e1 && !!R.e1.auto_chave && /^1\. /.test(R.e1.causa || '') && /^1\.1\. /.test(R.e1.acao || '') && R.e1.responsavel === 'JOSE SANTOS' && R.grl.length > 1 && R.grl.every(r => r.ch && r.resp === 'JOSE SANTOS' && r.st === 'Não iniciada'), JSON.stringify(R.grl).slice(0, 300));
  af('CGR ago/26 Combustíveis, preenchido à mão (h2): não ganha linha automática nem é tocado', R.cgr.length === 1 && !R.cgr[0].ch && /rota nova/.test(R.cgr[0].causa), JSON.stringify(R.cgr));
  af('ANG ago/26 (fora, a reunião) fica sem ação automática; toda ação gravada tem dono', R.ang === 0 && R.comAuto > 0 && R.semDono === 0, JSON.stringify({ ang: R.ang, comAuto: R.comAuto, semDono: R.semDono }));
  af('o resumo diz os fatos pulados à mão e o fora (ANG ago/26)', /preenchido\(s\) à mão/.test(R.sub) && /CGR ROTA Combustíveis ago\/26/.test(R.sub) && /fora: ANG ago\/26/.test(R.sub), R.sub.slice(0, 240));
  // gerar de novo é idempotente: nenhum insert nem update a mais (a 2ª rodada acha os fatos e as ações iguais)
  const antes = await pg.evaluate(() => ({ ins: (window.__ins || []).length, upd: (window.__upd || []).length }));
  await pg.evaluate(() => gerarTodas());
  const depois = await pg.evaluate(() => ({ ins: (window.__ins || []).length, upd: (window.__upd || []).length, h: (document.querySelector('.genres-h') || {}).textContent || '' }));
  af('gerar de novo é idempotente: 0 fato novo e 0 ação (nada inserido nem atualizado)', depois.ins === antes.ins && depois.upd === antes.upd && /— 0 fato\(s\) novo\(s\) · 0 ação/.test(depois.h), JSON.stringify({ antes, depois }));
  const ytd = await pg.evaluate(() => window.__T.fca.filter(r => r.auto_chave).map(r => r.fato_desvio || ''));
  af('o desvio gravado leva o YTD na última linha (e o R$ do mês continua o 1º R$ do texto, que o Check de Metas lê)', ytd.length && ytd.every(t => /^Desvio: ▲ R\$/.test(t) && /\nYTD: [▲▼n]/.test(t)), ytd[0]);
  af('sem erro de página', !errs.length, errs.join(' | ').slice(0, 300));
  T2D = await pg.evaluate(() => window.__T);
  await ctx.close();
}
/* ══ 2d · A TABELA DO FCA · ADMIN NO DESENHO DO AUTOMÁTICO (Renan, 16/10/2026: "O layout não está como desenhamos") ══ */
{
  console.log('\n══ 2d · Tabela do FCA · Admin com as linhas da geração');
  for (const [w, h, tema] of [[1600, 900, 'dark'], [1366, 768, 'light'], [1920, 1000, 'dark']]) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('supabase') ? SHIM_SB(true, true) : '' }); });
    await ctx.route('**/lozwipoeacpvplgkrxkq.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await ctx.route('**/docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/plain', body: '' }));
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(({ t, tema }) => { window.__T = t; try { localStorage.clear(); localStorage.setItem('bi_theme', tema); } catch (e) {} }, { t: T2D, tema });
    await pg.goto(BASE + '/fca-consolidado/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => { const b = document.querySelector('.s-item[data-v="tabela"]'); if (b) b.click(); });
    await pg.waitForTimeout(600);
    const R = await pg.evaluate(() => {
      const t = document.querySelector('table.rel.fg-rel'); if (!t) return { sem: true };
      const fg = [...t.querySelectorAll('tbody.fg')].map(b => ({ txt: b.querySelector('td.id') ? [...b.querySelectorAll('td.id')].map(x => x.textContent.trim().slice(0, 40)) : [],
        rs: (b.querySelector('td.id') || {}).rowSpan, n: b.rows.length,
        acoes: [...b.querySelectorAll('tr')].map(tr => { const c = tr.querySelectorAll('td.ln'); const a = [...c].find(x => !x.classList.contains('cz') && x.classList.contains('txt')); return a ? (a.querySelector('.ln-n') || {}).textContent || '' : ''; }),
        causas: [...b.querySelectorAll('td.cz')].map(x => ({ n: (x.querySelector('.ln-n') || {}).textContent || '', rs: x.rowSpan, of: x.querySelectorAll('.fa-of li').length })),
        ytd: !!b.querySelector('.fa-ano-pe'), tot: (b.querySelector('.fa-tot') || {}).textContent || '' }));
      const w = document.querySelector('.rel-wrap');
      return { fg, barra: w ? w.scrollWidth > w.clientWidth + 1 : null, pag: document.documentElement.scrollWidth > innerWidth + 1, ns: t.hasAttribute('data-no-sort') };
    });
    const grl = (R.fg || []).find(b => b.txt[0] === 'GRL' && /Manuten/.test(b.txt[3] || ''));
    if (w === 1600) {
      af('a Tabela do Admin desenha um bloco por fato (tbody.fg) com Unidade · Projeto · Vigência · Fato mesclados', !R.sem && R.fg.length > 0 && R.fg.every(b => b.rs === b.n), JSON.stringify((R.fg || []).slice(0, 2)).slice(0, 300));
      af('GRL Manutenções: ações na ordem da causa (1.1, 1.2, 2.1…), causa numerada e mesclada sobre as ações dela, placas embaixo da causa', !!grl && grl.acoes.join(' ') === grl.acoes.slice().sort((a, b) => { const p = s => s.split('.').filter(Boolean).map(Number); const x = p(a), y = p(b); return x[0] - y[0] || x[1] - y[1]; }).join(' ') && grl.causas[0].n === '1.' && grl.causas.reduce((s, c) => s + c.rs, 0) === grl.n && grl.causas[0].of > 0, JSON.stringify(grl).slice(0, 300));
      af('o fato vem curto ("▲ R$ X (Y%)") e com o YTD no pé', !!grl && /^▲ R\$ [\d.]+ \(\d+%\)$/.test(grl.tot) && grl.ytd, JSON.stringify({ tot: grl && grl.tot, ytd: grl && grl.ytd }));
      af('a tabela não é reordenada pelo cabeçalho (rowspan), o fato escrito à mão continua com o bloco dele', R.ns && R.fg.some(b => b.txt[0] === 'CGR' && b.n === 1), '');
    }
    af(`${w}×${h} ${tema}: sem barra horizontal na tabela nem na página`, R.barra === false && !R.pag, JSON.stringify({ barra: R.barra, pag: R.pag }));
    af(`${w}×${h} ${tema}: sem erro de página`, !errs.length, errs.join(' | ').slice(0, 300));
    if (SHOT) { await pg.screenshot({ path: `${SHOT}/fca-admin-tabela-${w}-${tema}.png` });
      await pg.evaluate(() => { const b = [...document.querySelectorAll('tbody.fg')].find(x => /GRL/.test(x.textContent) && /Manuten/.test(x.textContent)); if (b) b.scrollIntoView(); });
      await pg.screenshot({ path: `${SHOT}/fca-admin-tabela-${w}-${tema}-grl.png` }); }
    await ctx.close();
  }
}
/* ══ 2e · a Tabela do FCA da unidade no mesmo desenho ══ */
{
  console.log('\n══ 2e · Tabela do FCA da unidade (GRL)');
  const { pg, ctx, errs } = await abre({ acErr: true, t: T2D, pagina: 'fca-preenchimento/index.html?u=GRL&vig=ago/26', espera: '#list' });
  await pg.waitForTimeout(2500);
  const AB = await pg.evaluate(() => ({ tit: document.getElementById('tituloVista').textContent, tab: !!document.querySelector('table.rel.fg-rel'), on: (document.querySelector('.s-item.on[data-v]') || {}).dataset.v }));
  af('o FCA da unidade abre direto na Tabela (sem clicar)', AB.tit === 'Tabela' && AB.tab && AB.on === 'flat', JSON.stringify(AB));
  const R = await pg.evaluate(() => { const t = document.querySelector('table.rel.fg-rel'); if (!t) return { sem: true, html: (document.getElementById('list') || document.body).innerText.slice(0, 200) };
    const b = [...t.querySelectorAll('tbody.fg')].find(x => /Manuten/.test(x.textContent));
    return { nfg: t.querySelectorAll('tbody.fg').length, uniCol: [...t.querySelectorAll('th')].some(th => /Unid/.test(th.textContent)),
      acoes: b ? [...b.querySelectorAll('.ln-n')].map(x => x.textContent).filter(x => /\d\.\d/.test(x)) : [], ytd: !!(b && b.querySelector('.fa-ano-pe')) }; });
  af('a Tabela da unidade usa o mesmo desenho: bloco por fato, ações em ordem, YTD no pé, sem a coluna Unidade', !R.sem && R.nfg > 0 && !R.uniCol && R.acoes.length > 1 && R.acoes[0] === '1.1.' && R.ytd, JSON.stringify(R).slice(0, 300));
  // unidade: "+ ação" na causa 1 e depois mudar a causa na linha nova → a causa muda nas duas
  pg.once('dialog', d => d.accept());
  const U1 = await pg.evaluate(async () => {
    const key = Object.keys(_DBROWS).find(k => (_DBROWS[k] || []).some(r => /^1\. /.test(r.causa || '') && /Manuten/.test(r.fato || '')));
    const r0 = _DBROWS[key].find(r => /^1\. /.test(r.causa || ''));
    await _novaLinhaFCA(key, r0.causa);
    const nova = _DBROWS[key][_DBROWS[key].length - 1];
    const dica = document.getElementById('km-causa-dica').textContent;
    const ta = document.getElementById('km-causa'); ta.value = '1. Motor fundido'; ta.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    return { dica, a: r0.causa, b: nova.causa, numNova: nova.acao, banco: [r0.id, nova.id].map(id => (window.__T.fca.find(x => x.id === id) || {}).causa) };
  });
  af('unidade: "+ ação" vem na mesma causa e mudar a causa na ação nova muda nas duas (tela e banco)',
    /vale para as \d+ ações/.test(U1.dica) && U1.a === '1. Motor fundido' && U1.b === '1. Motor fundido' && U1.banco.every(c => c === '1. Motor fundido') && /^1\.\d+\. $/.test(U1.numNova || ''), JSON.stringify(U1));
  // o caso de GRL: "+ ação" para escrever uma causa NOVA → Cancelar separa a ação numa causa nova com o próximo número
  pg.once('dialog', d => d.dismiss());
  const U2 = await pg.evaluate(async () => {
    const key = Object.keys(_DBROWS).find(k => (_DBROWS[k] || []).some(r => r.causa === '1. Motor fundido'));
    const r0 = _DBROWS[key].find(r => r.causa === '1. Motor fundido');
    const maxC = Math.max(...(_DBROWS[key] || []).map(r => +((String(r.causa || '').match(/^(\d+)\./) || [])[1] || 0)));
    const antes = _DBROWS[key].filter(r => r.causa === '1. Motor fundido').length;
    await _novaLinhaFCA(key, r0.causa);
    const nova = _DBROWS[key][_DBROWS[key].length - 1];
    document.getElementById('km-acao').value = nova.acao + 'Trocar o motor';
    const ta = document.getElementById('km-causa'); ta.value = '1. Embreagem'; ta.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 300));
    return { maxC, causa: nova.causa, acao: nova.acao, banco: (window.__T.fca.find(x => x.id === nova.id) || {}).causa,
      irmas: _DBROWS[key].filter(r => r.causa === '1. Motor fundido').length, antes, campo: document.getElementById('km-causa').value };
  });
  af('Cancelar separa só esta ação numa causa nova (próximo número, ação k.1) e não mexe nas outras',
    U2.causa === `${U2.maxC + 1}. Embreagem` && U2.acao === `${U2.maxC + 1}.1. Trocar o motor` && U2.banco === U2.causa && U2.irmas === U2.antes && U2.campo === U2.causa, JSON.stringify(U2));
  af('sem erro de página', !errs.length, errs.join(' | ').slice(0, 300));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/fca-unidade-tabela.png` });
  await ctx.close();
}
/* ══ 2f · a caixa da ação no formato novo, no FCA · Admin e no da unidade ══ */
{
  console.log('\n══ 2f · caixa da ação no formato novo (Admin e unidade)');
  for (const [pagina, w, h] of [['fca-consolidado/index.html', 1366, 768], ['fca-preenchimento/index.html?u=GRL&vig=ago/26', 1600, 900]]) {
    const adm = pagina.startsWith('fca-consolidado');
    const { pg, ctx, errs } = await abre({ acErr: true, t: T2D, pagina, w, h, espera: adm ? '.s-item' : '#list' });
    await pg.waitForTimeout(2500);
    const R = await pg.evaluate(async (adm) => {
      const id = (window.__T.fca.find(r => r.unidade === 'GRL' && /^1\.1\. /.test(r.acao || '') && r.auto_chave) || {}).id;
      openKModal(id); await new Promise(r => setTimeout(r, 300));
      const m = document.querySelector('.kmodal.kac'), sel = document.getElementById('km-resp');
      const c = document.getElementById('km-causa').getBoundingClientRect(), a = document.getElementById('km-acao').getBoundingClientRect(), mb = m ? m.getBoundingClientRect() : {};
      const antes = (window.__upd || []).length;
      const bt = [...document.querySelectorAll('#km-seg button')].find(b => b.dataset.st === 'Em andamento'); bt.click();
      await new Promise(r => setTimeout(r, 400));
      const up = (window.__upd || []).slice(antes).find(x => x.tabela === 'fca' && x.p.status === 'Em andamento');
      return { kac: !!m, w: Math.round(mb.width), hOk: mb.height <= innerHeight, ladoALado: Math.abs(c.top - a.top) < 2 && a.left > c.right,
        tag: sel.tagName, opt0: sel.options[0] && sel.options[0].value, val: sel.value, seg: document.querySelectorAll('#km-seg button').length,
        on: (document.querySelector('#km-seg button.on') || {}).textContent, up: !!up, ok: document.getElementById('km-ok').textContent,
        fatoEd: !!document.getElementById('km-fato-ed') };
    }, adm);
    const nome = adm ? 'Admin' : 'unidade';
    af(`${nome}: a caixa abre no formato novo (larga, Causa e Ação lado a lado, cabe em ${w}×${h})`, R.kac && R.w > 1000 && R.ladoALado && R.hOk, JSON.stringify(R));
    af(`${nome}: Responsável é lista com o gestor de frota primeiro (JOSE SANTOS) e já selecionado`, R.tag === 'SELECT' && R.opt0 === 'JOSE SANTOS' && R.val === 'JOSE SANTOS', JSON.stringify({ opt0: R.opt0, val: R.val }));
    af(`${nome}: status em botões; clicar grava na fca e o rodapé diz Salvo ✓`, R.seg === 4 && /Em andamento/.test(R.on || '') && R.up && /Salvo/.test(R.ok), JSON.stringify({ on: R.on, up: R.up, ok: R.ok }));
    af(`${nome}: ${adm ? 'o admin edita o fato e o desvio' : 'a unidade vê o fato sem editar'}`, adm ? R.fatoEd : !R.fatoEd, '');
    af(`${nome}: sem erro de página`, !errs.length, errs.join(' | ').slice(0, 300));
    if (SHOT) await pg.screenshot({ path: `${SHOT}/fca-caixa-${nome}.png` });
    await ctx.close();
  }
}
/* ══ 2g · o "+" da Tabela: + ação na causa, + causa no fato, e a caixa abre na linha nova ══ */
{
  console.log('\n══ 2g · "+" ágil na Tabela do FCA · Admin');
  const { pg, ctx, errs } = await abre({ acErr: true, t: T2D, pagina: 'fca-consolidado/index.html', w: 1600, h: 900, espera: '.s-item' });
  await pg.waitForTimeout(2000);
  const AB = await pg.evaluate(() => ({ tit: document.getElementById('tituloVista').textContent, tab: !!document.querySelector('table.rel.fg-rel'), on: (document.querySelector('.s-item.on[data-v]') || {}).dataset.v }));
  af('o FCA · Admin abre direto na Tabela', AB.tit === 'Tabela' && AB.tab && AB.on === 'tabela', JSON.stringify(AB));
  await pg.evaluate(() => { const b = document.querySelector('.s-item[data-v="tabela"]'); if (b) b.click(); });
  await pg.waitForTimeout(500);
  const grlBloco = () => [...document.querySelectorAll('tbody.fg')].find(x => /^GRL/.test((x.querySelector('td.id') || {}).textContent || '') && /Manuten/.test(x.textContent));
  const R0 = await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); return { causa: b.querySelectorAll('.fg-add[data-add="causa"]').length, acao: b.querySelectorAll('.fg-add[data-add="acao"]').length, ncz: b.querySelectorAll('td.cz').length, n: b.rows.length }; }, grlBloco.toString());
  af('o bloco tem UM "+ causa" (na última causa) e um "+ ação" por causa', R0.causa === 1 && R0.acao === R0.ncz, JSON.stringify(R0));
  // + ação na 1ª causa
  await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); b.querySelector('.fg-add[data-add="acao"]').click(); }, grlBloco.toString());
  await pg.waitForTimeout(700);
  const R1 = await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); const ov = document.getElementById('kmodal-ov');
    const ins = (window.__ins || []).slice(-1)[0] || {};
    const cz = [...b.querySelectorAll('td.cz')].map(td => td.rowSpan);
    return { aberta: !!ov && ov.style.display === 'flex', causaIns: (ins.causa || '').slice(0, 2), acaoIns: ins.acao, resp: ins.responsavel, n: b.rows.length, cz, foco: document.activeElement && document.activeElement.id }; }, grlBloco.toString());
  af('"+ ação" cria a linha com a MESMA causa e o gestor como dono, abre a caixa com o cursor na Ação', R1.aberta && R1.causaIns === '1.' && R1.resp === 'JOSE SANTOS' && R1.foco === 'km-acao', JSON.stringify(R1));
  af('"+ ação" já vem com o próximo número da causa (1.N. )', /^1\.\d+\. $/.test(R1.acaoIns || ''), JSON.stringify(R1.acaoIns));
  af('a linha nova entra dentro da causa 1 (a causa mescla mais uma linha), não no fim do fato', R1.n === R0.n + 1 && R1.cz[0] === 3, JSON.stringify({ n0: R0.n, n1: R1.n, cz: R1.cz }));
  // o número não sai: Backspace no começo, Home + Delete, Ctrl+A + digitar e colar por cima mantêm "1.N. "
  const pref = R1.acaoIns;
  await pg.focus('#km-acao'); await pg.keyboard.press('End');
  for (let i = 0; i < 8; i++) await pg.keyboard.press('Backspace');
  const T1 = await pg.$eval('#km-acao', e => e.value);
  await pg.keyboard.press('Home'); await pg.keyboard.press('Delete'); await pg.keyboard.type('Ok');
  const T2 = await pg.$eval('#km-acao', e => e.value);
  await pg.keyboard.press('Control+A'); await pg.keyboard.type('Nova ação');
  const T3 = await pg.$eval('#km-acao', e => e.value);
  await pg.$eval('#km-acao', e => { e.value = 'sem número'; e.dispatchEvent(new Event('input')); });
  const T4 = await pg.$eval('#km-acao', e => e.value);
  await pg.click('#km-acomp'); await pg.waitForTimeout(300);
  const T5 = await pg.evaluate(() => { const ins = (window.__ins || []).slice(-1)[0] || {}; const r = _ROWS.find(x => x.acao && x.causa === ins.causa && x.acao.startsWith(ins.acao)); return r && r.acao; });
  af('o número da ação não se apaga (Backspace, Home+Delete, Ctrl+A, troca do texto) e grava com ele', T1 === pref && T2 === pref + 'Ok' && T3 === pref + 'Nova ação' && T4 === pref + 'sem número' && T5 === pref + 'sem número', JSON.stringify({ pref, T1, T2, T3, T4, T5 }));
  await pg.evaluate(() => closeKModal());
  // + causa
  await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); b.querySelector('.fg-add[data-add="causa"]').click(); }, grlBloco.toString());
  await pg.waitForTimeout(700);
  const R2 = await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); const ins = (window.__ins || []).slice(-1)[0] || {};
    return { aberta: document.getElementById('kmodal-ov').style.display === 'flex', causa: ins.causa, acao: ins.acao, n: b.rows.length, foco: document.activeElement && document.activeElement.id,
      caret: document.activeElement && document.activeElement.selectionStart, vlen: document.activeElement && document.activeElement.value.length,
      ultima: (b.rows[b.rows.length - 1].querySelector('td.cz') || {}).textContent }; }, grlBloco.toString());
  af('"+ causa" cria uma linha no mesmo fato, no fim do bloco, e abre a caixa com o cursor na Causa', R2.aberta && R2.n === R1.n + 1 && R2.foco === 'km-causa', JSON.stringify(R2));
  af('"+ causa" já vem com a próxima causa ("k. ") e a ação "k.1. "', /^(\d+)\. $/.test(R2.causa || '') && R2.acao === R2.causa.trim() + '1. ' && R2.caret === R2.causa.length, JSON.stringify(R2));
  const NU = await pg.evaluate(() => {
    const rows = [{ causa: '1. A', acao: '1.1. x' }, { causa: '1. A', acao: '1.2. y' }, { causa: '2. B', acao: '2.1. z' }, { causa: '3. C', acao: '' }];
    return [FcaTabela.numeracao(rows, '1. A', 'acao').acao, FcaTabela.numeracao(rows, '2. B', 'acao').acao, FcaTabela.numeracao(rows, '3. C', 'acao').acao,
      FcaTabela.numeracao(rows, '', 'causa').causa, FcaTabela.numeracao([], '', 'causa').acao, FcaTabela.numeracao([{ causa: '4. ', acao: '4.1. ' }], '4. ', 'acao').acao];
  });
  af('numeração: 1.3 · 2.2 · 3.1 · causa 4 · 1.1 num fato vazio · 4.2 depois de "4.1. " sem texto', JSON.stringify(NU) === JSON.stringify(['1.3. ', '2.2. ', '3.1. ', '4. ', '1.1. ', '4.2. ']), JSON.stringify(NU));
  // o "+" não pula número: duas causas com o mesmo número e uma ação sem número não contam a mais (Piraí, 16/10/2026)
  const NU2 = await pg.evaluate(() => [
    FcaTabela.numeracao([{ causa: '1. A', acao: '1.1. x' }, { causa: '1. Motor', acao: '1.2. y' }, { causa: '2. C', acao: '2.1. z' }], '', 'causa').causa,
    FcaTabela.numeracao([{ causa: '1. A', acao: '1.1. x' }, { causa: '1. A', acao: 'sem número' }], '1. A', 'acao').acao]);
  af('numeração não pula: causa 3 com "1." repetido · ação 1.2 com uma ação sem número', JSON.stringify(NU2) === JSON.stringify(['3. ', '1.2. ']), JSON.stringify(NU2));
  // mudar o texto da causa numa linha leva para as outras ações da mesma causa (Guarulhos, 16/10/2026)
  await pg.evaluate(() => closeKModal());
  let msgC = ''; pg.once('dialog', d => { msgC = d.message(); d.accept(); });
  const C1 = await pg.evaluate(() => {
    const doGrl = _ROWS.filter(r => r.unidade === 'GRL' && /Manuten/.test(r.fato || '') && /^1\. /.test(r.causa || ''));
    const velha = doGrl[0].causa, irmas = doGrl.filter(r => r.causa === velha);
    openKModal(irmas[0].id);
    const dica = document.getElementById('km-causa-dica').textContent;
    const ta = document.getElementById('km-causa'); ta.value = '1. Diferencial quebrado'; ta.dispatchEvent(new Event('change'));
    return { n: irmas.length, ids: irmas.map(r => r.id), dica, velha };
  });
  await pg.waitForTimeout(400);
  const C2 = await pg.evaluate(ids => ({ tela: ids.map(id => (_ROWS.find(r => r.id === id) || {}).causa), banco: ids.map(id => (window.__T.fca.find(r => r.id === id) || {}).causa),
    blocos: [...document.querySelectorAll('tbody.fg')].filter(b => /^GRL/.test((b.querySelector('td.id') || {}).textContent || '') && /Manuten/.test(b.textContent)).map(b => [...b.querySelectorAll('td.cz')].filter(td => /^1\./.test(td.textContent.trim())).length) }), C1.ids);
  af('a caixa avisa que a causa vale para as N ações dela', C1.n >= 2 && C1.dica === `vale para as ${C1.n} ações desta causa`, JSON.stringify(C1));
  af('mudar a causa pergunta: todas as ações ou separar numa causa nova', /vale para \d+ ações/.test(msgC) && /causa nova \(\d+\.\)/.test(msgC), msgC);
  af('mudar a causa numa ação muda em todas as ações dela (tela e banco), e continua UMA causa 1 na Tabela',
    C2.tela.every(c => c === '1. Diferencial quebrado') && C2.banco.every(c => c === '1. Diferencial quebrado') && C2.blocos[0] === 1, JSON.stringify(C2));
  af('sem erro de página', !errs.length, errs.join(' | ').slice(0, 300));
  if (SHOT) { await pg.evaluate(() => closeKModal()); await pg.evaluate(f => { const b = (0, eval)('(' + f + ')')(); b.scrollIntoView(); b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); }, grlBloco.toString()); await pg.hover('tbody.fg td.cz'); await pg.screenshot({ path: `${SHOT}/fca-add.png` }); }
  await ctx.close();
}
/* ══ 3 · sem admin ══ */
{
  console.log('\n══ 3 · sem admin');
  const { pg, ctx } = await abre({ admin: false });
  const gt = await pg.evaluate(() => (document.querySelector('.gate h2') || {}).textContent || '');
  af('cai no gate de admin', /somente admin/.test(gt), gt);
  await ctx.close();
}
await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
