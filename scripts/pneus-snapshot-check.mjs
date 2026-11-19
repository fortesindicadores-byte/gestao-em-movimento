// ============================================================
// Pneus Snapshot Check: o que a tabela `snapshot` tem de cada unidade
// (hora da gravação, nº de inspeções, data da inspeção mais nova, inspeções
// por mês) e, para a unidade pedida, o que o Prolog responde AGORA no mês
// corrente. Responde "fizemos a aferição e o Gestão à Vista não mostra"
// (Renan, 19/11/2026, Márcio de BLC). Só leitura; não imprime placa.
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const TOKEN = process.env.PROLOG_TOKEN;
const BRANCH = String(process.env.PN_BRANCH || '24');
const BASE_URL = 'https://prologapp.com/prolog/api/v3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOMES = {1676:'MCC T1',1677:'MCC T2',37:'CGR',1906:'CBA T1 WH',1907:'CBA T1',1878:'CBA T2',20:'FLP',30:'GRL',24:'BLC',2517:'NFR',26:'PLT',38:'PIR',2277:'RON',2550:'?'};
const dia = s => s ? new Date(s).toISOString().slice(0, 10) : '—';

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const r = await fetch(`${SUPA}/rest/v1/snapshot?select=endpoint,branch_id,updated_at`, { headers: H });
const meta = await r.json();
console.log('=== gravação por unidade (UTC) ===');
const porB = {};
meta.forEach(m => { (porB[m.branch_id] = porB[m.branch_id] || {})[m.endpoint] = m.updated_at; });
Object.keys(porB).sort().forEach(b => console.log(`${b} ${NOMES[b] || ''}: ` + Object.entries(porB[b]).map(([e, t]) => `${e} ${t}`).join(' · ')));

console.log('\n=== inspeções gravadas ===');
for (const b of Object.keys(porB).sort()) {
  const x = await fetch(`${SUPA}/rest/v1/snapshot?branch_id=eq.${b}&endpoint=eq.inspections&select=data`, { headers: H });
  const j = await x.json();
  const d = (j[0] && j[0].data) || [];
  const porMes = {}; let max = '';
  const veicNov = new Set(); const insp = new Set();
  d.forEach(i => {
    const t = String(i.dataInspecao || '');
    if (t > max) max = t;
    const m = t.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1;
    if (m === new Date().toISOString().slice(0, 7)) { veicNov.add(i.veiculoId); insp.add(i.inspecaoId); }
  });
  const ult = Object.keys(porMes).sort().slice(-3).map(m => `${m}:${porMes[m]}`).join(' ');
  console.log(`${b} ${NOMES[b] || ''}: ${d.length} medidas · mais nova ${dia(max)} · ${ult} · mês corrente ${insp.size} inspeções em ${veicNov.size} veículos`);
}

// PN_MESES=1: para cada unidade de PN_BRANCH (separadas por vírgula), compara a
// janela do ano inteiro (a do loader) com a consulta mês a mês: inspeções
// distintas, repetidas entre páginas e por mês. Mostra se a paginação longa
// perde inspeções.
const pede = async (b, ini, fim) => {
  let page = 0; const ids = new Map(); let itens = 0; const pags = [];
  while (true) {
    const qs = new URLSearchParams({ branchOfficesId: b, startDate: ini.toISOString().split('.')[0] + 'Z', endDate: fim.toISOString().split('.')[0] + 'Z', includeMeasures: false, pageSize: 100, pageNumber: page }).toString();
    const res = await fetch(`${BASE_URL}/tire-inspections/vehicles?${qs}`, { headers: { 'x-prolog-api-token': TOKEN } });
    if (res.status === 429) { await sleep(61000); continue; }
    if (res.status >= 300) { pags.push(`HTTP ${res.status} na pág ${page}`); break; }
    const j = await res.json(); const c = j.content || [];
    c.forEach(i => { itens++; ids.set(i.id, i.submittedAt); });
    pags.push(c.length);
    if (!c.length || j.lastPage) { pags.push(`fim lastPage=${j.lastPage} totalElements=${j.totalElements ?? '?'}`); break; }
    page++; await sleep(6500);
  }
  return { ids, itens, pags };
};
const mesDe = t => { const d = new Date(new Date(t).getTime() - 3 * 36e5); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
if (TOKEN && process.env.PN_MESES === '1') {
  const hoje = new Date();
  for (const b of BRANCH.split(',').map(s => s.trim()).filter(Boolean)) {
    console.log(`\n=== ${b} ${NOMES[b] || ''}: ano inteiro × mês a mês ===`);
    const ano = await pede(b, new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1)), hoje);
    const porA = {}; ano.ids.forEach(t => { const m = mesDe(t); porA[m] = (porA[m] || 0) + 1; });
    console.log(`ano: ${ano.itens} itens · ${ano.ids.size} distintas · repetidas ${ano.itens - ano.ids.size} · páginas ${ano.pags.join(',')}`);
    const linha = [];
    for (let m = 0; m <= hoje.getUTCMonth(); m++) {
      const ini = new Date(Date.UTC(hoje.getUTCFullYear(), m, 1, 3));
      const fim = m === hoje.getUTCMonth() ? hoje : new Date(Date.UTC(hoje.getUTCFullYear(), m + 1, 1, 2, 59, 59));
      const r = await pede(b, ini, fim);
      const k = hoje.getUTCFullYear() + '-' + String(m + 1).padStart(2, '0');
      const so = [...r.ids.keys()].filter(id => !ano.ids.has(id)).length;
      linha.push(`${k.slice(5)}: mês ${r.ids.size} · ano ${porA[k] || 0} · só no mês ${so}${r.itens !== r.ids.size ? ' · rep ' + (r.itens - r.ids.size) : ''}`);
    }
    linha.forEach(l => console.log('  ' + l));
  }
  process.exit(0);
}

if (TOKEN) {
  console.log(`\n=== Prolog agora, unidade ${BRANCH} ${NOMES[BRANCH] || ''}, mês corrente ===`);
  const hoje = new Date();
  const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  let page = 0, tot = 0; const veic = new Set(); let max = '';
  while (true) {
    const qs = new URLSearchParams({ branchOfficesId: BRANCH, startDate: ini.toISOString().split('.')[0] + 'Z', endDate: hoje.toISOString().split('.')[0] + 'Z', includeMeasures: true, pageSize: 100, pageNumber: page }).toString();
    const res = await fetch(`${BASE_URL}/tire-inspections/vehicles?${qs}`, { headers: { 'x-prolog-api-token': TOKEN } });
    if (res.status === 429) { await sleep(61000); continue; }
    if (res.status >= 300) { console.log(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`); break; }
    const j = await res.json();
    const c = j.content || [];
    c.forEach(i => { tot++; veic.add(i.vehicle && i.vehicle.id); const t = String(i.submittedAt || ''); if (t > max) max = t; });
    if (!c.length || j.lastPage) break;
    page++; await sleep(6500);
  }
  console.log(`${tot} inspeções em ${veic.size} veículos · mais nova ${max}`);
  // a mesma janela que o loader usa (01/01 → agora): quantas páginas e a data mais nova
  const ini2 = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
  let p2 = 0, t2 = 0, max2 = '', min2 = 'z'; const ordem = [];
  while (true) {
    const qs = new URLSearchParams({ branchOfficesId: BRANCH, startDate: ini2.toISOString().split('.')[0] + 'Z', endDate: hoje.toISOString().split('.')[0] + 'Z', includeMeasures: true, pageSize: 100, pageNumber: p2 }).toString();
    const res = await fetch(`${BASE_URL}/tire-inspections/vehicles?${qs}`, { headers: { 'x-prolog-api-token': TOKEN } });
    if (res.status === 429) { await sleep(61000); continue; }
    if (res.status >= 300) { console.log(`janela do ano: HTTP ${res.status} na pág ${p2}: ${(await res.text()).slice(0, 300)}`); break; }
    const j = await res.json();
    const c = j.content || [];
    let pmax = '', pmin = 'z';
    c.forEach(i => { t2++; const t = String(i.submittedAt || ''); if (t > max2) max2 = t; if (t < min2) min2 = t; if (t > pmax) pmax = t; if (t < pmin) pmin = t; });
    ordem.push(`p${p2}:${dia(pmin)}→${dia(pmax)}`);
    if (!c.length || j.lastPage) { console.log(`janela do ano: fim na pág ${p2} (lastPage=${j.lastPage}, ${c.length} itens, totalElements=${j.totalElements ?? '?'}, totalPages=${j.totalPages ?? '?'})`); break; }
    p2++; await sleep(6500);
  }
  console.log(`janela do ano: ${t2} inspeções · ${dia(min2)} → ${dia(max2)}`);
  console.log('ordem das páginas: ' + ordem.join(' '));
}
