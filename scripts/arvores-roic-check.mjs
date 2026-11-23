// ============================================================================
// Arvores ROIC Check — abre o /arvores/ com os dados reais (service key, só leitura)
// e imprime o ROIC pela MESMA roicDe da página: por mês, por operação, por
// unidade e os recortes do último mês acima de 40% ou sem capital.
// Renan, 21/11/2026: "tem ROIC de 213%?"
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
await ctx.route('https://lozwipoeacpvplgkrxkq.supabase.co/**', async r => {
  const u = r.request().url();
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range,content-profile' };
  if (/\/rest\/v1\/fca_profiles/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(/vnd\.pgrst\.object/.test(r.request().headers()['accept'] || '') ? { is_admin: true, nome: 'Check' } : [{ is_admin: true, nome: 'Check' }]) });
  if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'check', email: 'fortesindicadores@gmail.com' }) });
  const rq = r.request();
  if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS, body: '' });
  if (rq.method() !== 'GET' && rq.method() !== 'HEAD' && !/\/rpc\//.test(u)) return r.fulfill({ status: 403, headers: CORS, body: '{"message":"check: só leitura"}' });
  const hin = rq.headers(), h = { apikey: KEY, authorization: 'Bearer ' + KEY };
  ['accept', 'prefer', 'range', 'range-unit', 'content-type', 'accept-profile', 'content-profile'].forEach(k => { if (hin[k]) h[k] = hin[k]; });
  try {
    const resp = await fetch(u, { method: rq.method(), headers: h, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
    const body = Buffer.from(await resp.arrayBuffer());
    const out = { ...CORS, 'content-type': resp.headers.get('content-type') || 'application/json' };
    if (resp.headers.get('content-range')) out['content-range'] = resp.headers.get('content-range');
    return r.fulfill({ status: resp.status, headers: out, body });
  } catch (e) { return r.fulfill({ status: 599, headers: CORS, body: String(e) }); }
});

const pg = await ctx.newPage();
pg.on('pageerror', e => console.log('  [pageerror]', e.message));
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [console]', m.text().slice(0, 220)); });
await pg.addInitScript(() => {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJjaGVjayJ9.x', refresh_token: 'r', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp,
    user: { id: 'check', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated' } }));
  sessionStorage.setItem('gem_hub', '1');
});
await pg.goto(BASE + '/arvores/index.html', { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof VIGS !== 'undefined' && VIGS.length && Object.keys(DRE).length, null, { timeout: 300000, polling: 1000 });
await pg.waitForTimeout(2000);
const out = await pg.evaluate(async (ANO) => {
  const L = [], mi = v => (v / 1e6).toFixed(2), p = v => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(1) + '%';
  const vigs = VIGS.filter(v => v.startsWith(ANO)).sort();
  L.push('vigências com receita: ' + VIGS.slice().sort().join(' '));
  { const o = await carregaIPCA(), k = Object.keys(o).sort(); L.push('IPCA do Banco Central: ' + (k.length ? k.length + ' meses, último ' + k[k.length - 1] + ' = ' + p(o[k[k.length - 1]]) : 'INDISPONÍVEL')); }
  for (const v of vigs) { try { await capMes(v); } catch (e) { L.push(v + ' capMes ERRO ' + (e.message || e)); } }
  const linha = (rot, vv, f) => { const R = roicDe(vv, f); return `${rot.padEnd(26)} ROIC ${p(R.roic).padStart(8)} · pré-IR ${p(R.roicPre).padStart(8)} · EBIT/mês ${mi(R.ebit / R.n)} mi · cap ${mi(R.cap)} mi (${R.qtd.toFixed(0)} eq) · rec/mês ${mi(R.rec / R.n)} mi · dep ${R.mesesEst.length ? 'FT' : 'DRE'}`; };
  L.push('', '== por mês (tudo) ==');
  vigs.forEach(v => { const c = CAP[v] || []; const t = {}; c.forEach(e => { t[e.tipo] = (t[e.tipo] || 0) + 1; });
    L.push(linha(v, [v], () => true) + ' · ' + Object.entries(t).map(([k, n]) => k + ' ' + n).join(', ')); });
  L.push('', '== ano ' + ANO + ' por operação ==');
  OP_ORD.forEach(o => L.push(linha(o, vigs, op => op === o)));
  L.push('', '== ano ' + ANO + ' por unidade ==');
  UNIS.forEach(u => L.push(linha(u, vigs, (op, uni) => uni === u)));
  L.push('', '== último mês ' + vigs[vigs.length - 1] + ' por unidade × operação (só ROIC > 40% ou cap 0 com EBIT) ==');
  const ult = [vigs[vigs.length - 1]];
  UNIS.forEach(u => OP_ORD.forEach(o => { const R = roicDe(ult, (op, uni) => op === o && uni === u); if (!R.rec && !R.cap) return;
    if ((R.roic != null && Math.abs(R.roic) > 0.4) || (!R.cap && R.ebit)) L.push(linha(u + ' ' + o, ult, (op, uni) => op === o && uni === u)); }));
  L.push('', '== chaves do DRE sem capital no ano (op|uni : EBIT/mês) ==');
  const k = {}; Object.keys(DRE).forEach(x => { const [v, op, uni] = x.split('|'); if (v.startsWith(ANO)) k[op + '|' + uni] = 1; });
  Object.keys(k).sort().forEach(x => { const [o, u] = x.split('|'); const R = roicDe(vigs, (op, uni) => op === o && uni === u); if (!R.cap) L.push('  ' + x + ' : ' + mi(R.ebit / R.n)); });
  // Seara (Anhanguera): o que entra na Árvore do Custo e na Árvore de Km
  L.push('', '== Seara · Anhanguera por mês ==');
  try { await carregaKm(); const S = SEARA, fs = (op, u) => op === 'SEA';
    if (!S) L.push('  SEARA não carregou');
    else vigs.forEach(v => { const m = S.mes[v], C = ctCusto([v], fs, null), k = KM.find(r => r.vig === v && r.op === 'SEA');
      const ft = ctFT([v], fs, ['comb', 'manut', 'pneu', 'lavagem_var']), B = ctCombAgg([v], fs);
      const semTab = S.pl.filter(x => x.vig === v && !(x.kmL > 0)).length, nPl = S.pl.filter(x => x.vig === v).length;
      L.push(`${v}  km rem ${m ? Math.round(m.rem) : '—'} · real ${m ? Math.round(m.real) : '—'} · CT-e ${m ? Math.round(m.cte) : '—'} · placas rem ${m ? m.placas.size : 0} · ${k ? 'ENTRA' : 'fora (sem rem ou sem real)'}`
        + ` | custo real ${Math.round(C.real)} rem ${Math.round(C.rem)} orç ${Math.round(C.orc)} · pago tabela ${ft == null ? '—' : Math.round(ft)}`
        + ` | Km/L ${B && B.kmLReal ? B.kmLReal.toFixed(2) : '—'} × ${B && B.kmLRem ? B.kmLRem.toFixed(2) : '—'} · R$/L ${B && B.rsLReal ? B.rsLReal.toFixed(2) : '—'} × ${B && B.rsLRem ? B.rsLRem.toFixed(2) : '—'} · placas ${nPl} (${semTab} sem tabela)`); });
    const cs = {}; Object.entries(FRC).forEach(([k, o]) => { if (!/\|SEA\|ANG$/.test(k) || !k.startsWith(ANO)) return; Object.entries(o).forEach(([c, x]) => { const d = cs[c] = cs[c] || { real: 0, rem: 0 }; d.real += x.real; d.rem += x.rem; }); });
    L.push('  contas no ano (real · rem): ' + Object.entries(cs).sort((a, b) => b[1].real - a[1].real).map(([c, x]) => `${ctDef(c).nome} ${Math.round(x.real)} · ${Math.round(x.rem)}`).join(' | '));
  } catch (e) { L.push('  Seara ERRO ' + (e.message || e)); }
  // Van é locada? Campos de aluguel, locadora, finame e compra em cada cadastro do FT, no último mês
  // (Renan, 23/11/2026: "Van é locada, não tem ROIC acredito. Valide"). Só contagens, sem placa.
  L.push('', '== próprio × locado no FT · ' + vigs[vigs.length - 1] + ' (campos de aluguel, locadora, finame, compra) ==');
  try { const [aa, mm] = vigs[vigs.length - 1].split('-').map(Number);
    for (const d of EQ) {
      const vs = d.c === 'ARMAZEM' ? [`ARMAZEM_1_${mm}_${aa}`] : [`${d.c}_2_${mm}_${aa}`, `${d.c}_1_${mm}_${aa}`];
      const { data: lays } = await sb.from('ft_layout').select('vigencia,colunas').eq('canal', d.c).eq('tabela', d.t).in('vigencia', vs);
      const lay = vs.map(v => (lays || []).find(l => l.vigencia === v)).find(Boolean); if (!lay) { L.push(`${d.c} ${d.t}: sem layout`); continue; }
      const rows = await todas(sb.from('ft_linha').select('unidade,dados').eq('canal', d.c).eq('tabela', d.t).eq('vigencia', lay.vigencia).order('linha'));
      L.push(`${d.c} ${d.t} (${lay.vigencia}): ${rows.length} linhas`);
      lay.colunas.forEach((c, i) => { if (!/alug|locad|leas|finame|compra|propri|amortiz|deprecia|modelo$|^modelo|remunera/i.test(c)) return;
        const vals = rows.map(r => r.dados[i]); const nums = vals.map(numFT); const nz = nums.filter(x => x > 0);
        const txt = {}; vals.forEach(v => { if (v == null || v === '') { txt['(vazio)'] = (txt['(vazio)'] || 0) + 1; return; } if (typeof v === 'number' || (typeof v === 'string' && /^[\d.,-]+$/.test(v.trim()))) return; const k = String(v).slice(0, 40); txt[k] = (txt[k] || 0) + 1; });
        const cat = Object.entries(txt).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, n]) => `${k}=${n}`).join(' · ');
        L.push(`   ${c}: ${nz.length} de ${rows.length} com número > 0` + (nz.length ? ` (soma ${mi(nz.reduce((x, y) => x + y, 0))} mi, mediana ${Math.round(nz.sort((x, y) => x - y)[Math.floor(nz.length / 2)])})` : '') + (cat ? ' | ' + cat : '')); });
    }
    const ultv = vigs[vigs.length - 1], c = CAP[ultv] || [], t = {};
    c.forEach(e => { const o = t[e.tipo] = t[e.tipo] || { n: 0, compra: 0, liq: 0 }; o.n++; o.compra += e.compra; o.liq += e.liq; });
    L.push('capital que a página conta em ' + ultv + ': ' + Object.entries(t).map(([k, o]) => `${k} ${o.n} eq · compra ${mi(o.compra)} mi · líquido ${mi(o.liq)} mi`).join(' | '));
    L.push('', '== ' + ultv + ' · Van e Armazém por unidade ==');
    UNIS.forEach(u => ['VAN', 'ARM'].forEach(o => { const R = roicDe([ultv], (op, uni) => op === o && uni === u); if (!R.rec && !R.cap) return; L.push(linha(u + ' ' + o, [ultv], (op, uni) => op === o && uni === u)); }));
  } catch (e) { L.push('  próprio × locado ERRO ' + (e.message || e)); }
  L.push('', 'filtros salvos no navegador: n/a (check limpo)');
  return L.join('\n');
}, process.env.ROIC_ANO || '2026');
console.log(out);
await nav.close(); srv.close();
