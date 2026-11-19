// ============================================================
// Pneus Ginfo × Prolog: a aderência de aferição do Ginfo (aba Pneus do Frota
// de Elite, export de detalhes colado à mão → sh_elite_pneus) contra as
// inspeções do Prolog (tabela snapshot), placa a placa e mês a mês. Serve para
// achar a régua do Ginfo e trocar a aba manual pelo Prolog no Frota de Elite,
// no Gestão à Vista e no painel de Aferições (Renan, 19/11/2026).
// Também mostra o que o robô do Elite gravou de Stress Test e Pneus no mês.
// Só leitura; não imprime placa.
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const get = async (q, extra = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${q}`, { headers: { ...H, ...extra } });
  if (!r.ok) throw new Error(q.slice(0, 60) + ' http ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};
const NK = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const merc = p => { const s = NK(p).replace(/[^A-Z0-9]/g, ''); return /^[A-Z]{3}\d{4}$/.test(s) ? s.slice(0, 4) + 'ABCDEFGHIJ'[+s[4]] + s.slice(5) : s; };
const MES = { JANEIRO:1,FEVEREIRO:2,MARCO:3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12 };
const vigDe = v => {
  if (v == null || v === '') return null;
  const s = String(v);
  let m = s.match(/^(\d{4})-(\d{2})/); if (m) return m[1] + '-' + m[2];
  m = NK(s).match(/([A-Z]+)\s+DE\s+(\d{4})/); if (m && MES[m[1]]) return m[2] + '-' + String(MES[m[1]]).padStart(2, '0');
  m = s.match(/(\d{2})\/(\d{4})/); if (m) return m[2] + '-' + m[1];
  return null;
};
const dataDe = v => { if (v == null || v === '') return null; const t = new Date(String(v).length === 10 ? v + 'T12:00:00-03:00' : v).getTime(); return isFinite(t) ? t : null; };
const fimMes = vig => { const [a, m] = vig.split('-').map(Number); return new Date(Date.UTC(a, m, 1, 2, 59, 59)).getTime(); }; // 23:59 BRT do último dia
const iniMes = vig => { const [a, m] = vig.split('-').map(Number); return new Date(Date.UTC(a, m - 1, 1, 3, 0, 0)).getTime(); };
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';

// ── 1. aba Pneus do Ginfo no banco ──
const [base] = await get('sh_base?slug=eq.elite_pneus&select=slug,tabela,colunas,linhas,carregado_em,mudou_em,erro');
console.log('sh_base elite_pneus:', base && { tabela: base.tabela, linhas: base.linhas, carregado_em: base.carregado_em, erro: base.erro });
const cols = (base && base.colunas) || [];
console.log('colunas:', cols.map(c => `${c.label}→${c.col}`).join(' | '));
const colDe = re => (cols.find(c => re.test(NK(c.label))) || {}).col;
const C = { fil: colDe(/^FILIAL/), ev: colDe(/^EVENTO/), pl: colDe(/^PLACA/), pj: colDe(/^PROJETO/), per: colDe(/^PERIODO/), ult: colDe(/ULTIMA/), st: colDe(/^STATUS/) };
console.log('mapa:', JSON.stringify(C));
const tab = (base && base.tabela) || 'sh_elite_pneus';
let gin = [];
for (let off = 0; ; off += 1000) {
  const pg = await get(`${tab}?select=*&order=linha&offset=${off}&limit=1000`);
  gin.push(...pg); if (pg.length < 1000) break;
}
console.log('linhas lidas:', gin.length);
const G = gin.map(r => ({ fil: NK(r[C.fil]), ev: NK(r[C.ev]), pl: merc(r[C.pl]), vig: vigDe(r[C.per]) || vigDe(r.vigencia), ult: dataDe(r[C.ult]), st: NK(r[C.st]) }))
  .filter(r => r.fil && r.pl && r.vig && r.fil !== 'FILIAL');
const conta = (arr, f) => arr.reduce((o, x) => (o[f(x)] = (o[f(x)] || 0) + 1, o), {});
console.log('status:', JSON.stringify(conta(G, r => r.st)));
console.log('eventos:', JSON.stringify(conta(G, r => r.ev)));
console.log('por vigência:', JSON.stringify(conta(G, r => r.vig)));
console.log('filiais:', JSON.stringify(conta(G, r => r.fil)));
// mesma placa repetida no mês/evento?
const dup = conta(G, r => r.vig + '|' + r.ev + '|' + r.pl); console.log('placa-mês-evento repetidas:', Object.values(dup).filter(n => n > 1).length);
// Última Leitura × Status: em que dia do mês cai a leitura, por status
console.log('\n── Última Leitura × Status (dias entre a leitura e o fim do mês) ──');
const fx = d => d == null ? 'sem leitura' : d < 0 ? 'depois do mês' : d <= 30 ? '0-30' : d <= 31 ? '31' : d <= 45 ? '32-45' : d <= 60 ? '46-60' : '>60';
const dentro = r => r.ult != null && r.ult >= iniMes(r.vig) && r.ult <= fimMes(r.vig);
for (const st of Object.keys(conta(G, r => r.st))) {
  const q = G.filter(r => r.st === st);
  console.log(`  ${st.padEnd(18)} n=${q.length} · leitura no próprio mês ${q.filter(dentro).length} · faixas ${JSON.stringify(conta(q, r => fx(r.ult == null ? null : Math.floor((fimMes(r.vig) - r.ult) / 864e5))))}`);
}

// ── 2. Prolog ──
const meta = await get('snapshot?select=branch_id,endpoint,updated_at');
const bids = [...new Set(meta.map(m => m.branch_id))];
const INS = {}; const VEI = {}; const PLB = {}; // placa → [datas]; branch → placas ativas
for (const b of bids) {
  for (const ep of ['inspections', 'vehicles']) {
    let j = null;
    for (let a = 0; a < 5 && !j; a++) { try { j = await get(`snapshot?branch_id=eq.${b}&endpoint=eq.${ep}&select=data`); } catch (e) { await new Promise(r => setTimeout(r, 1500)); } }
    const d = (j && j[0] && j[0].data) || [];
    if (ep === 'vehicles') { VEI[b] = new Set(d.map(v => merc(v.placa))); d.forEach(v => PLB[merc(v.placa)] = b); }
    else {
      const vis = new Set();
      d.forEach(i => { const k = i.inspecaoId + '|' + merc(i.placa); if (vis.has(k)) return; vis.add(k);
        const t = new Date(i.dataInspecao).getTime(); if (!isFinite(t)) return;
        const p = merc(i.placa); (INS[p] = INS[p] || []).push({ t, pr: i.pressaoMedida > 0, mm: i.menorMM > 0 }); });
      // inspeções sem pressão ou sem mm na mesma inspeção ficam marcadas pela medida
    }
  }
}
console.log('\nProlog: branches', bids.length, '· placas com inspeção', Object.keys(INS).length, '· veículos ativos', Object.values(VEI).reduce((a, s) => a + s.size, 0));

// ── 3. comparação placa a placa ──
// réguas candidatas: A = inspeção no mês calendário; B = última inspeção até o fim
// do mês com ≤ 30 dias; C = inspeção nos 30 dias antes do fim do mês ou do dia do
// Ginfo; para CALIBRAGEM exige pressão medida, para MILIMETRAGEM exige mm.
const regras = {
  A_mes: (ins, vig) => ins.some(x => x.t >= iniMes(vig) && x.t <= fimMes(vig)),
  B_30d: (ins, vig) => ins.some(x => x.t <= fimMes(vig) && fimMes(vig) - x.t <= 30 * 864e5),
};
const medOk = (ev, x) => ev.startsWith('CALIBR') ? x.pr : ev.startsWith('MILIM') ? x.mm : true;
const ok = r => r.st !== 'NAO REALIZADO';
console.log('\n── Ginfo × Prolog, placa a placa (todas as vigências) ──');
const semProlog = G.filter(r => !INS[r.pl] && !PLB[r.pl]).length;
console.log('linhas do Ginfo com placa que o Prolog não conhece:', semProlog, 'de', G.length);
for (const [nome, f] of Object.entries(regras)) for (const comMed of [false, true]) {
  const m = { ok_ok: 0, ok_nok: 0, nok_ok: 0, nok_nok: 0 };
  G.forEach(r => { const ins = (INS[r.pl] || []).filter(x => !comMed || medOk(r.ev, x)); const p = f(ins, r.vig);
    m[(ok(r) ? 'ok' : 'nok') + '_' + (p ? 'ok' : 'nok')]++; });
  const conc = m.ok_ok + m.nok_nok;
  console.log(`  ${nome}${comMed ? '+medida' : ''}: concordam ${pct(conc, G.length)} · Ginfo ok/Prolog não ${m.ok_nok} · Ginfo não/Prolog ok ${m.nok_ok} · ${JSON.stringify(m)}`);
}
// por vigência, régua A
console.log('\n── por vigência (régua A, mês calendário, sem exigir medida) ──');
for (const vig of Object.keys(conta(G, r => r.vig)).sort()) {
  const q = G.filter(r => r.vig === vig);
  const pA = q.filter(r => regras.A_mes(INS[r.pl] || [], vig)).length;
  const pB = q.filter(r => regras.B_30d(INS[r.pl] || [], vig)).length;
  const conc = q.filter(r => ok(r) === regras.A_mes(INS[r.pl] || [], vig)).length;
  console.log(`  ${vig}: Ginfo ${pct(q.filter(ok).length, q.length)} · Prolog A ${pct(pA, q.length)} · B ${pct(pB, q.length)} · concordância A ${pct(conc, q.length)} (n=${q.length})`);
}
// por filial no último mês completo do Ginfo
const vigs = Object.keys(conta(G, r => r.vig)).sort();
for (const vig of vigs.slice(-2)) {
  console.log(`\n── ${vig} por filial: Ginfo × Prolog A (mesmas placas) × Prolog A (frota ativa do Prolog) ──`);
  for (const fil of Object.keys(conta(G, r => r.fil)).sort()) {
    const q = G.filter(r => r.vig === vig && r.fil === fil); if (!q.length) continue;
    const pA = q.filter(r => regras.A_mes(INS[r.pl] || [], vig)).length;
    const conc = q.filter(r => ok(r) === regras.A_mes(INS[r.pl] || [], vig)).length;
    console.log(`  ${fil.padEnd(22)} Ginfo ${pct(q.filter(ok).length, q.length).padStart(6)} · Prolog ${pct(pA, q.length).padStart(6)} · concordam ${pct(conc, q.length)} · n=${q.length} · placas ${new Set(q.map(r => r.pl)).size}`);
  }
}
// Ginfo ok e Prolog sem inspeção no mês: quando foi a inspeção mais perto?
console.log('\n── divergências: Ginfo ok, Prolog sem inspeção no mês (dias até a inspeção mais perto) ──');
const dv = G.filter(r => ok(r) && !regras.A_mes(INS[r.pl] || [], r.vig));
console.log('  ', dv.length, JSON.stringify(conta(dv, r => { const ins = INS[r.pl] || []; if (!ins.length) return 'nenhuma'; const c = Math.min(...ins.map(x => Math.min(Math.abs(x.t - iniMes(r.vig)), Math.abs(x.t - fimMes(r.vig))))) / 864e5; return c <= 3 ? '≤3d' : c <= 10 ? '4-10d' : c <= 31 ? '11-31d' : '>31d'; })));
console.log('  com Última Leitura do Ginfo no mês:', dv.filter(dentro).length);
const dv2 = G.filter(r => !ok(r) && regras.A_mes(INS[r.pl] || [], r.vig));
console.log('Ginfo não realizado, Prolog com inspeção no mês:', dv2.length, '· por evento', JSON.stringify(conta(dv2, r => r.ev)));

// ── 4. elite_snapshot: stress test e pneus do mês ──
console.log('\n── elite_snapshot ──');
const es = await get('elite_snapshot?select=indicador,vigencia,escopo,updated_at,data&indicador=in.(stress-test-frota,pneus,stress-test-empilhadeira)&vigencia=in.(09/2026,10/2026,11/2026)');
es.sort((a, b) => (a.indicador + a.vigencia + a.escopo).localeCompare(b.indicador + b.vigencia + b.escopo)).forEach(r => {
  const d = Array.isArray(r.data) ? r.data : [];
  const k = d[0] ? Object.keys(d[0]) : [];
  const kSt = k.find(x => /^status/i.test(x)), kD = k.find(x => /^desconto$/i.test(x.trim()));
  const resumo = kSt ? JSON.stringify(conta(d, x => x[kSt])) : '';
  console.log(`  ${r.indicador} ${r.vigencia} ${r.escopo} · ${d.length} linhas · gravado ${String(r.updated_at).slice(0, 16)} · ${resumo}${kD ? ' · com desconto ' + d.filter(x => +x[kD] > 0).length : ''}`);
  if (r.indicador === 'stress-test-frota' && r.vigencia === '11/2026') console.log('     colunas:', k.join(' | '));
});
console.log('\nFIM.');
