// Master Check: o administrador Master chegou ao banco? Só leitura, com a service key.
// Diz quem está em portal_master (pelo e-mail do auth), se as funções master_* existem
// e quantos cadastros de auth.users nunca chegaram ao user_approvals. Nunca imprime senha.
const URL = process.env.SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const get = async p => { const r = await fetch(URL + p, { headers: H }); return { st: r.status, j: await r.json().catch(() => null) }; };
const rpc = async (n, b = {}) => { const r = await fetch(URL + '/rest/v1/rpc/' + n, { method: 'POST', headers: H, body: JSON.stringify(b) }); return { st: r.status, j: await r.json().catch(() => null) }; };

const pm = await get('/rest/v1/portal_master?select=user_id,criado_em');
console.log('portal_master:', pm.st, Array.isArray(pm.j) ? pm.j.length + ' linha(s)' : JSON.stringify(pm.j));
const users = [];
for (let page = 1; page < 20; page++) {
  const r = await get(`/auth/v1/admin/users?page=${page}&per_page=200`);
  const lst = (r.j && (r.j.users || r.j)) || [];
  if (!Array.isArray(lst) || !lst.length) break;
  users.push(...lst); if (lst.length < 200) break;
}
const byId = Object.fromEntries(users.map(u => [u.id, u]));
for (const m of (Array.isArray(pm.j) ? pm.j : [])) {
  const u = byId[m.user_id];
  console.log('  Master:', u ? u.email : '(id sem usuário) ' + m.user_id, '· desde', m.criado_em);
}
const dono = users.find(u => (u.email || '').toLowerCase() === 'fortesindicadores@gmail.com');
console.log('conta do dono:', dono ? 'existe' : 'NÃO EXISTE', dono && Array.isArray(pm.j) ? (pm.j.some(m => m.user_id === dono.id) ? '· é Master' : '· NÃO é Master') : '');
for (const f of ['master_eu', 'master_usuarios', 'portal_senha_trocada']) {
  const r = await rpc(f);
  console.log(`rpc ${f}:`, r.st, JSON.stringify(r.j).slice(0, 140));
}
const ap = await get('/rest/v1/user_approvals?select=user_id,status');
const comAp = new Set((ap.j || []).map(a => a.user_id));
const st = {}; (ap.j || []).forEach(a => st[a.status] = (st[a.status] || 0) + 1);
console.log('auth.users:', users.length, '· user_approvals:', JSON.stringify(st));
console.log('sem aprovação (travaram no e-mail ou nunca pediram):', users.filter(u => !comAp.has(u.id)).length);
console.log('e-mail não confirmado:', users.filter(u => !u.email_confirmed_at).length);
console.log('com senha provisória:', users.filter(u => u.app_metadata && u.app_metadata.troca_senha).length);
const andre = users.find(u => /andre\.pompeu/i.test(u.email || ''));
console.log('André Pompeu:', andre ? `confirmado=${!!andre.email_confirmed_at} · aprovação=${(ap.j || []).find(a => a.user_id === andre.id)?.status || 'sem'} · provisória=${!!(andre.app_metadata || {}).troca_senha} · último acesso=${andre.last_sign_in_at || 'nunca'}` : 'não encontrado');
