// FCA Numeracao Check: fatos com a numeração de causa/ação quebrada. Só leitura, com a service key.
// Por fato (unidade · vigência · projeto · origem · 1ª linha do fato) aponta:
//  · DUAS CAUSAS DIFERENTES com o mesmo número (ex.: "1. Diferencial" e "1. Motor");
//  · número de causa pulado (1, 3 sem o 2);
//  · ação com número de outra causa (ação "2.1." numa linha da causa 1) e ação pulada (1.1, 1.3).
// Imprime unidade, vigência, projeto, fato e o número das causas/ações; nunca o nome de ninguém.
const URL = process.env.SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'count=exact' };
const VIG = (process.env.VIG || '').trim();   // ex.: set/26 — vazio = todas
const rows = [];
for (let o = 0; ; o += 1000) {
  const q = `/rest/v1/fca?select=id,unidade,vigencia,projeto,origem,fato,causa,acao,auto_chave&order=id&offset=${o}&limit=1000` + (VIG ? `&vigencia=eq.${encodeURIComponent(VIG)}` : '');
  const r = await fetch(URL + q, { headers: H }); const j = await r.json();
  if (!Array.isArray(j)) { console.error('erro', r.status, JSON.stringify(j).slice(0, 200)); process.exit(1); }
  rows.push(...j); if (j.length < 1000) break;
}
console.log(`linhas lidas: ${rows.length}${VIG ? ' · vigência ' + VIG : ''}`);
const p1 = s => String(s || '').split('\n')[0].trim();
const nC = c => { const m = String(c || '').trim().match(/^(\d+)\.\s/); return m ? +m[1] : null; };
const nA = a => { const m = String(a || '').trim().match(/^(\d+)\.(\d+)\.\s/); return m ? [+m[1], +m[2]] : null; };
const fatos = new Map();
rows.forEach(r => { const k = [r.unidade, r.vigencia, r.projeto || '', r.origem, p1(r.fato)].join(' | '); if (!fatos.has(k)) fatos.set(k, []); fatos.get(k).push(r); });
let ruins = 0; const porUni = {};
for (const [k, rs] of fatos) {
  const prob = [];
  const causas = new Map();   // texto → número
  rs.forEach(r => { const c = String(r.causa || '').trim(); if (c && !causas.has(c)) causas.set(c, nC(c)); });
  const porNum = {}; for (const [c, n] of causas) if (n != null) (porNum[n] = porNum[n] || []).push(c);
  Object.entries(porNum).forEach(([n, cs]) => { if (cs.length > 1) prob.push(`causa ${n} repetida em ${cs.length} textos diferentes`); });
  const nums = Object.keys(porNum).map(Number).sort((a, b) => a - b);
  for (let i = 1; i <= (nums[nums.length - 1] || 0); i++) if (!nums.includes(i)) prob.push(`causa ${i} pulada`);
  for (const [c, n] of causas) {
    if (n == null) continue;
    const ac = rs.filter(r => String(r.causa || '').trim() === c).map(r => nA(r.acao)).filter(Boolean);
    ac.forEach(a => { if (a[0] !== n) prob.push(`ação ${a[0]}.${a[1]} na causa ${n}`); });
    const sub = ac.filter(a => a[0] === n).map(a => a[1]).sort((a, b) => a - b);
    for (let i = 1; i <= (sub[sub.length - 1] || 0); i++) if (!sub.includes(i)) prob.push(`ação ${n}.${i} pulada`);
    const rep = sub.filter((x, i) => sub.indexOf(x) !== i); if (rep.length) prob.push(`ação ${n}.${rep[0]} repetida`);
  }
  if (!prob.length) continue;
  ruins++; const u = rs[0].unidade; porUni[u] = (porUni[u] || 0) + 1;
  console.log(`\n${k}  (${rs.length} linha(s), ${rs.filter(r => r.auto_chave).length} automática(s))`);
  console.log('  ' + [...new Set(prob)].join(' · '));
  rs.slice().sort((a, b) => (nC(a.causa) || 99) - (nC(b.causa) || 99)).forEach(r => {
    const c = String(r.causa || '').trim(), a = String(r.acao || '').trim();
    console.log(`    id ${r.id} · causa "${c.slice(0, 48).replace(/\n/g, ' ')}" · ação "${a.slice(0, 40).replace(/\n/g, ' ')}"`);
  });
}
console.log(`\nfatos: ${fatos.size} · com numeração quebrada: ${ruins}`);
console.log('por unidade:', JSON.stringify(porUni));
