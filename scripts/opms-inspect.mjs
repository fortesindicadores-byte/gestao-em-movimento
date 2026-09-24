// ============================================================
// API do Portal Operacional (TI Conlog, 24/09/2026) — o que ela entrega.
//   https://operacionalms.conlogsa.com.br/external-api/docs
//   POST /api/v1/auth/login            → token
//   GET  /api/v1/benner/km-realizado   → substitui o PowerShell manual?
//   GET  /api/v1/benner/lancamento-dre-frota → substitui a aba Frota do DRE?
// 1) Lê a especificação (openapi.json, pública): parâmetros e esquemas.
// 2) Com OPMS_USER/OPMS_PASS (Secrets), faz login e chama os dois endpoints.
// O LOG DO ACTIONS É PÚBLICO: nada de token, linha crua ou texto livre.
// Imprime só estrutura (colunas, tipos, preenchimento), totais e valores de
// colunas de recorte (unidade, projeto, conta, vigência, data).
// Uso: OPMS_DE=2026-08-01 OPMS_ATE=2026-08-31 node scripts/opms-inspect.mjs
// ============================================================
const BASE = (process.env.OPMS_URL || 'https://operacionalms.conlogsa.com.br/external-api').replace(/\/$/, '');
const USER = process.env.OPMS_USER || '', PASS = process.env.OPMS_PASS || '';
const DE = process.env.OPMS_DE || '', ATE = process.env.OPMS_ATE || '';
const h = s => console.log('\n==== ' + s);

async function pega(url, opt = {}) {
  const t0 = Date.now();
  try { const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(120000) }); const txt = await r.text(); return { st: r.status, ms: Date.now() - t0, txt, ct: r.headers.get('content-type') || '' }; }
  catch (e) { return { st: 0, ms: Date.now() - t0, txt: String(e && e.message || e), ct: '' }; }
}

// ── 1. especificação ──
h('ESPECIFICAÇÃO');
const docs = await pega(BASE + '/docs');
console.log(`docs: HTTP ${docs.st} em ${docs.ms} ms`);
const cands = [];
const m = docs.txt.match(/url\s*:\s*['"]([^'"]*openapi[^'"]*)['"]/i); if (m) cands.push(m[1]);
cands.push('/openapi.json', '/api/v1/openapi.json', '/../openapi.json');
let spec = null;
for (const c of cands) {
  const u = /^https?:/.test(c) ? c : c.startsWith('/external-api') ? new URL(c, BASE).href : BASE + c;
  const r = await pega(u); console.log(`  ${u} → HTTP ${r.st}`);
  if (r.st === 200) { try { spec = JSON.parse(r.txt); break; } catch {} }
}
const resolve = (ref) => ref && ref.startsWith('#/') ? ref.slice(2).split('/').reduce((o, k) => o && o[k], spec) : null;
function esquema(s, ind = '    ', prof = 0) {
  if (!s || prof > 4) return;
  if (s.$ref) { console.log(`${ind}(${s.$ref.split('/').pop()})`); return esquema(resolve(s.$ref), ind, prof + 1); }
  if (s.type === 'array') { console.log(`${ind}array de:`); return esquema(s.items, ind + '  ', prof + 1); }
  for (const k of ['anyOf', 'oneOf', 'allOf']) if (s[k]) s[k].forEach(x => esquema(x, ind, prof + 1));
  if (s.properties) Object.entries(s.properties).forEach(([k, v]) => {
    const tipo = v.type || (v.$ref ? v.$ref.split('/').pop() : (v.anyOf || []).map(x => x.type || (x.$ref || '').split('/').pop()).join('|'));
    console.log(`${ind}${k}: ${tipo}${v.format ? ' (' + v.format + ')' : ''}${v.description ? ' — ' + v.description : ''}`);
    if (v.$ref || v.type === 'array' || v.properties) esquema(v, ind + '  ', prof + 1);
  });
}
const PARAMS = {};
if (spec) {
  console.log(`título: ${spec.info && spec.info.title} · versão ${spec.info && spec.info.version} · servidores ${JSON.stringify(spec.servers || [])}`);
  for (const [p, ops] of Object.entries(spec.paths || {})) for (const [met, op] of Object.entries(ops)) {
    console.log(`\n${met.toUpperCase()} ${p} — ${op.summary || ''}${op.description ? '\n  ' + op.description.replace(/\n/g, '\n  ') : ''}`);
    (op.parameters || []).forEach(q => { const s = q.schema || {}; console.log(`  param ${q.in} ${q.name}${q.required ? ' (obrigatório)' : ''}: ${s.type || (s.anyOf || []).map(x => x.type).join('|')}${s.format ? ' ' + s.format : ''}${s.default !== undefined ? ' padrão=' + JSON.stringify(s.default) : ''}${q.description ? ' — ' + q.description : ''}`); });
    PARAMS[p] = op.parameters || [];
    if (op.requestBody) { console.log('  corpo:'); const c = op.requestBody.content || {}; Object.values(c).forEach(x => esquema(x.schema)); }
    const ok = (op.responses || {})['200']; if (ok && ok.content) { console.log('  resposta 200:'); Object.values(ok.content).forEach(x => esquema(x.schema)); }
  }
} else console.log('especificação não encontrada (segue só com as chamadas).');

// ── 2. chamadas ──
if (!USER || !PASS) { h('SEM CREDENCIAIS'); console.log('Cadastre os Secrets OPMS_USER e OPMS_PASS para a parte 2.'); process.exit(0); }
h('LOGIN');
const lg = await pega(BASE + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
let tok = null, jl = null; try { jl = JSON.parse(lg.txt); } catch {}
console.log(`HTTP ${lg.st} em ${lg.ms} ms · campos da resposta: ${jl ? Object.keys(jl).join(', ') : lg.txt.slice(0, 200)}`);
if (jl) { tok = jl.access_token || jl.token || jl.accessToken || (jl.data && (jl.data.access_token || jl.data.token)); for (const k of ['token_type', 'expires_in', 'expires_at', 'expiresIn']) if (jl[k] != null) console.log(`  ${k}: ${jl[k]}`); }
if (!tok) { console.log('::error::login sem token'); process.exit(1); }

const SENS = /nome|name|cpf|cnpj|motorista|fornecedor|favorecido|histor|descri|obs|coment|email|telefone|usuario|user/i;
const RECORTE = /unid|filial|proj|conta|nivel|n[íi]vel|estrut|pacote|vig|compet|data|dt_|mes|m[êe]s|ano|periodo|tipo|opera|empresa|centro|cc|tier|status|placa|origem/i;
function perfil(nome, rows) {
  h(`${nome}: ${rows.length} linha(s)`);
  if (!rows.length) return;
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  for (const c of cols) {
    const vs = rows.map(r => r[c]), nn = vs.filter(v => v != null && v !== '');
    const nums = nn.filter(v => typeof v === 'number' || (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())));
    const dist = new Set(nn.map(v => String(v)));
    let linha = `  ${c}: ${nn.length}/${rows.length} preenchidas · ${dist.size} distintos`;
    if (nums.length === nn.length && nn.length) { const ns = nums.map(v => +String(v).replace(',', '.')); linha += ` · numérico Σ=${ns.reduce((a, b) => a + b, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mín=${Math.min(...ns)} máx=${Math.max(...ns)}`; }
    else if (SENS.test(c)) linha += ' · (texto livre/pessoal — não impresso)';
    else if (RECORTE.test(c) || dist.size <= 25) { const cont = {}; nn.forEach(v => { const k = String(v).slice(0, 40); cont[k] = (cont[k] || 0) + 1; }); const top = Object.entries(cont).sort((a, b) => b[1] - a[1]); linha += ` · ${top.slice(0, 25).map(([k, n]) => `${k}(${n})`).join(' ')}${top.length > 25 ? ' …' : ''}`; }
    console.log(linha);
  }
}
function linhasDe(j) {
  if (Array.isArray(j)) return j;
  if (j && typeof j === 'object') { for (const k of ['data', 'items', 'results', 'rows', 'content', 'registros', 'lancamentos']) if (Array.isArray(j[k])) return j[k]; }
  return null;
}
for (const p of ['/api/v1/benner/km-realizado', '/api/v1/benner/lancamento-dre-frota']) {
  const qs = new URLSearchParams();
  (PARAMS[p] || []).filter(q => q.in === 'query').forEach(q => {
    const n = q.name.toLowerCase();
    if (DE && /(ini|de$|from|start|inicio|data_?i)/.test(n)) qs.set(q.name, DE);
    else if (ATE && /(fim|ate|até|to$|end|final|data_?f)/.test(n)) qs.set(q.name, ATE);
    else if (q.required && q.schema && q.schema.default !== undefined) qs.set(q.name, q.schema.default);
  });
  const url = BASE + p + (qs.toString() ? '?' + qs : '');
  const r = await pega(url, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' } });
  h(`GET ${p}${qs.toString() ? '?' + qs : ''} → HTTP ${r.st} em ${r.ms} ms · ${(r.txt.length / 1024).toFixed(0)} KB · ${r.ct}`);
  let j = null; try { j = JSON.parse(r.txt); } catch {}
  if (r.st !== 200) { console.log('  resposta: ' + r.txt.slice(0, 400)); continue; }
  if (j && !Array.isArray(j)) console.log('  envelope: ' + Object.entries(j).map(([k, v]) => `${k}=${Array.isArray(v) ? '[' + v.length + ']' : typeof v === 'object' && v ? '{…}' : JSON.stringify(v)}`).join(' · '));
  const rows = linhasDe(j);
  if (!rows) { console.log('  formato não reconhecido: ' + r.txt.slice(0, 300)); continue; }
  perfil(p, rows);
}
