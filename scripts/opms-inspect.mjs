// ============================================================
// API do Portal Operacional (TI Conlog, 24/09/2026) — o que ela entrega e se
// bate com o que os painéis usam hoje.
//   https://operacionalms.conlogsa.com.br/external-api/docs
// Decisão do Renan (24/09/2026): do DRE, a API entra SÓ com o REALIZADO;
// orçado e remunerado continuam vindo do Sheets / banco (sh_dre_frota).
//
// 1) especificação (openapi.json, pública) — com OPMS_SPEC=1;
// 2) login com OPMS_USER/OPMS_PASS (Secrets) e as rotas do mês ANO/MES;
// 3) comparação: lancamento-dre-frota × aba Frota do DRE (Realizado) e
//    km-realizado × aba Dispersão de km (Km Rodado TT).
// O LOG DO ACTIONS É PÚBLICO: nada de token nem linha crua — só estrutura,
// totais e valores de colunas de recorte (unidade, projeto, conta, data).
// Uso: OPMS_ANO=2026 OPMS_MES=8 node scripts/opms-inspect.mjs
// ============================================================
const BASE = (process.env.OPMS_URL || 'https://operacionalms.conlogsa.com.br/external-api').replace(/\/$/, '');
const USER = process.env.OPMS_USER || '', PASS = process.env.OPMS_PASS || '';
// mês padrão = o fechado (anterior ao atual, em BRT)
const agora = new Date(Date.now() - 3 * 3600e3);
const ant = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
const ANO = +(process.env.OPMS_ANO || ant.getUTCFullYear()), MES = +(process.env.OPMS_MES || ant.getUTCMonth() + 1);
const VIG = `${ANO}-${String(MES).padStart(2, '0')}`;
const DRE_ID = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8', GV_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const h = s => console.log('\n==== ' + s);
const n = v => (v == null || !isFinite(v) ? '—' : (+v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return v; let s = String(v).replace(/\s|R\$/g, ''); if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); const f = parseFloat(s); return isNaN(f) ? 0 : f; };

async function pega(url, opt = {}) {
  const t0 = Date.now();
  try { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(180000) }); const txt = await r.text(); return { st: r.status, ms: Date.now() - t0, txt, ct: r.headers.get('content-type') || '' }; }
  catch (e) { return { st: 0, ms: Date.now() - t0, txt: String(e && e.message || e), ct: '' }; }
}

// ── 1. especificação (opcional) ──
if (process.env.OPMS_SPEC === '1') {
  h('ESPECIFICAÇÃO');
  const r = await pega(BASE + '/openapi.json');
  const spec = JSON.parse(r.txt);
  for (const [p, ops] of Object.entries(spec.paths || {})) for (const [met, op] of Object.entries(ops))
    console.log(`${met.toUpperCase()} ${p} — ${op.summary || ''} · params: ${(op.parameters || []).map(q => q.name + (q.required ? '*' : '')).join(', ') || '—'}`);
}

if (!USER || !PASS) { h('SEM CREDENCIAIS'); console.log('Cadastre os Secrets OPMS_USER e OPMS_PASS.'); process.exit(0); }

// ── 2. login ──
h(`LOGIN · mês pedido ${VIG}`);
const lg = await pega(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
let jl = null; try { jl = JSON.parse(lg.txt); } catch {}
console.log(`HTTP ${lg.st} em ${lg.ms} ms · campos: ${jl ? Object.keys(jl).join(', ') : lg.txt.slice(0, 200)}${jl && jl.primeiro_acesso != null ? ' · primeiro_acesso=' + jl.primeiro_acesso : ''}`);
const TOK = jl && jl.access_token;
if (!TOK) { console.log('::error::login sem token'); process.exit(1); }
const api = async (p, qs) => {
  const url = BASE + p + (qs ? '?' + new URLSearchParams(qs) : '');
  const r = await pega(url, { headers: { Authorization: 'Bearer ' + TOK, Accept: 'application/json' } });
  let j = null; try { j = JSON.parse(r.txt); } catch {}
  const items = j && Array.isArray(j.items) ? j.items : Array.isArray(j) ? j : null;
  console.log(`GET ${p}${qs ? '?' + new URLSearchParams(qs) : ''} → HTTP ${r.st} em ${(r.ms / 1000).toFixed(1)} s · ${(r.txt.length / 1024).toFixed(0)} KB · total=${j && j.total != null ? j.total : '—'} · itens=${items ? items.length : '—'}`);
  if (r.st !== 200 || !items) console.log('  resposta: ' + r.txt.slice(0, 300));
  return items || [];
};

const SENS = /cpf|cnpj|motorista|fornecedor|favorecido|histor|obs|email|telefone|usuario/i;
function perfil(nome, rows) {
  console.log(`  ${nome}: ${rows.length} linha(s)`);
  if (!rows.length) return;
  for (const c of [...new Set(rows.flatMap(r => Object.keys(r)))]) {
    const nn = rows.map(r => r[c]).filter(v => v != null && v !== '');
    const dist = new Set(nn.map(String));
    const isNum = nn.length && nn.every(v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v).trim()));
    let l = `    ${c}: ${nn.length}/${rows.length} · ${dist.size} distintos`;
    if (isNum && !/^handle|^id|num_os/.test(c)) { const ns = nn.map(Number); l += ` · Σ=${n(ns.reduce((a, b) => a + b, 0))} mín=${n(Math.min(...ns))} máx=${n(Math.max(...ns))}`; }
    else if (SENS.test(c)) l += ' · (não impresso)';
    else if (dist.size <= 30 || /placa/.test(c) === false && dist.size <= 60) { const ct = {}; nn.forEach(v => { const k = String(v).slice(0, 45); ct[k] = (ct[k] || 0) + 1; }); l += ' · ' + Object.entries(ct).sort((a, b) => b[1] - a[1]).map(([k, q]) => `${k}(${q})`).join(' '); }
    else l += ` · ex.: ${[...dist].slice(0, 4).map(v => v.slice(0, 30)).join(' | ')}`;
    console.log(l);
  }
}
const somaPor = (rows, chave, val) => { const m = new Map(); rows.forEach(r => { const k = chave(r) || '(vazio)'; const a = m.get(k) || { n: 0, v: 0 }; a.n++; a.v += val(r); m.set(k, a); }); return m; };

// de-paras
h('DE-PARAS');
const projs = await api('/api/v1/projects');
const PJ = new Map(projs.map(p => [String(p.id), p]));
console.log(`  projetos: ${projs.length} · ex.: ${projs.slice(0, 6).map(p => `${p.id}=${p.nome_abrev || p.nome}${p.cod_estrutura ? ' [' + p.cod_estrutura + ']' : ''}`).join(' · ')}`);
const contas = await api('/api/v1/benner/plano-contas');
const CT = new Map(contas.map(c => [String(c.handle), c]));
console.log(`  contas: ${contas.length}`);

// ── 3a. DRE Frota: API (realizado) × aba Frota ──
h(`DRE FROTA · ${VIG}`);
const dre = await api('/api/v1/benner/lancamento-dre-frota', { ano: ANO, mes: MES });
perfil('lancamento-dre-frota', dre);
const apiTot = dre.reduce((a, r) => a + num(r.valor), 0);
console.log(`  Σ valor API = ${n(apiTot)}`);
const pjNome = r => { const p = PJ.get(String(r.handle_projeto)); return p ? (p.nome_abrev || p.nome) : 'proj ' + r.handle_projeto; };
console.log('  API por projeto (top 40):');
[...somaPor(dre, pjNome, r => num(r.valor))].sort((a, b) => Math.abs(b[1].v) - Math.abs(a[1].v)).slice(0, 40)
  .forEach(([k, a]) => console.log(`    ${k.padEnd(40)} ${String(a.n).padStart(5)} lanç. · ${n(a.v)}`));

async function gviz(id, aba) {
  const r = await pega(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(aba)}`);
  const j = JSON.parse(r.txt.replace(/^[\s\S]*?\(/, '').replace(/\);?\s*$/, ''));
  if (j.status !== 'ok') throw new Error(aba + ': gviz ' + j.status);
  return { header: (j.table.cols || []).map(c => (c && c.label) || ''), rows: (j.table.rows || []).map(x => (x.c || []).map(c => (c && c.v != null ? c.v : null))) };
}
const vigDe = v => { const m = String(v ?? '').match(/^Date\((\d{4}),(\d{1,2}),/); if (m) return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}`; const b = String(v ?? '').match(/(\d{1,2})\/(\d{4})/); return b ? `${b[2]}-${b[1].padStart(2, '0')}` : ''; };
const col = (hd, ...nm) => { const H = hd.map(x => norm(x)); for (const x of nm) { const i = H.indexOf(norm(x)); if (i >= 0) return i; } for (const x of nm) { const i = H.findIndex(c => c.includes(norm(x))); if (i >= 0) return i; } return -1; };
try {
  const F = await gviz(DRE_ID, 'Frota');
  const i = { vig: col(F.header, 'vigência', 'vigencia'), uni: col(F.header, 'unidade'), n3: col(F.header, 'nível 3', 'nivel 3'), cta: col(F.header, 'conta gerencial'), real: col(F.header, 'realizado') };
  const L = F.rows.filter(r => vigDe(r[i.vig]) === VIG).map(r => ({ uni: String(r[i.uni] || ''), n3: String(r[i.n3] || ''), cta: String(r[i.cta] || ''), real: num(r[i.real]) }));
  const sheetTot = L.reduce((a, r) => a + r.real, 0);
  console.log(`\n  aba Frota ${VIG}: ${L.length} linhas · Σ Realizado = ${n(sheetTot)}  (API ${n(apiTot)} · razão ${sheetTot ? n(apiTot / sheetTot) : '—'})`);
  // por conta: casa pelo nome normalizado
  const aC = somaPor(dre, r => norm(r.nome_conta || (CT.get(String(r.handle_conta)) || {}).nome), r => num(r.valor));
  const sC = somaPor(L, r => norm(r.cta), r => r.real);
  const ks = [...new Set([...aC.keys(), ...sC.keys()])].sort((a, b) => Math.abs((sC.get(b) || aC.get(b)).v) - Math.abs((sC.get(a) || aC.get(a)).v));
  console.log('  POR CONTA (aba Frota × API):');
  console.log('    ' + 'conta'.padEnd(46) + 'aba'.padStart(16) + 'API'.padStart(16) + '   API/aba');
  ks.forEach(k => { const s = sC.get(k), a = aC.get(k); console.log('    ' + k.slice(0, 45).padEnd(46) + n(s && s.v).padStart(16) + n(a && a.v).padStart(16) + '   ' + (s && a && s.v ? n(a.v / s.v) : (s ? 'só aba' : 'só API'))); });
  console.log('  aba por unidade: ' + [...somaPor(L, r => r.uni, r => r.real)].map(([k, a]) => `${k} ${n(a.v)}`).join(' · '));
} catch (e) { console.log('  aba Frota: ERRO ' + e.message); }

// ── 3b. km: API × Dispersão de km ──
h(`KM REALIZADO · ${VIG}`);
const km = await api('/api/v1/benner/km-realizado', { ano: ANO, mes: MES });
perfil('km-realizado', km);
const kmTot = km.reduce((a, r) => a + num(r.tt_km_realizado), 0);
console.log(`  Σ tt_km_realizado = ${n(kmTot)} · placas ${new Set(km.map(r => r.placa)).size} · OS ${new Set(km.map(r => r.num_os)).size}`);
console.log('  API por filial × projeto:');
[...somaPor(km, r => `${r.nome_filial} | ${r.nome_projeto}`, r => num(r.tt_km_realizado))].sort((a, b) => b[1].v - a[1].v).slice(0, 60)
  .forEach(([k, a]) => console.log(`    ${k.slice(0, 60).padEnd(62)} ${String(a.n).padStart(6)} OS · ${n(a.v)} km`));
try {
  const D = await gviz(GV_ID, 'Dispersão de km');
  const i = { vig: 0, proj: col(D.header, 'proj.'), km: col(D.header, 'km rodado tt') };
  const L = D.rows.filter(r => vigDe(r[i.vig]) === VIG).map(r => ({ proj: String(r[i.proj] || ''), km: num(r[i.km]) }));
  console.log(`\n  Dispersão de km ${VIG}: ${L.length} linhas · Σ Km Rodado TT = ${n(L.reduce((a, r) => a + r.km, 0))}  (API ${n(kmTot)})`);
  [...somaPor(L, r => r.proj, r => r.km)].sort((a, b) => b[1].v - a[1].v).forEach(([k, a]) => console.log(`    ${k.padEnd(40)} ${n(a.v)} km`));
} catch (e) { console.log('  Dispersão: ERRO ' + e.message); }
