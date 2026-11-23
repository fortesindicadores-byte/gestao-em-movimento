// ============================================================
// Km Projeto Placa Check — em que projeto cada mapa foi PAGO × o projeto da placa no FT
// (Renan, 23/11/2026: "tem que ser por projeto. É por projeto que Ambev remunera").
// Só leitura, com a service key. Não imprime placa: só contagens e somas.
//
// Para uma unidade e um mês:
//   1. mapas do 2art (remun_mapa) cruzados: projeto do MAPA × projeto da PLACA no FT
//      (Caminhao = Rota · CaminhaoAS = AS · Van), com mapas, km que o FT paga pelo projeto
//      do mapa, valor pago médio e valor do FT médio (se o pago segue a placa, o valor médio
//      do mapa de Rota feito por placa de AS sai diferente do valor de Rota);
//   2. km rodado do mês (aba Km/L do consumo automático) pelo projeto da PLACA no FT e pelo
//      projeto da linha da aba;
//   3. o Δ por projeto nas duas leituras: remunerado pelo projeto do mapa (como o Painel KM
//      faz hoje) e remunerado pelo projeto da placa.
// Env: UNI (sigla, padrão CGR), MES (AAAA-MM, padrão 2026-10).
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!KEY) { console.error('::error::GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const UNI = (process.env.UNI || 'CGR').trim().toUpperCase(), MES = (process.env.MES || '2026-10').trim();
const [ANO, MM] = MES.split('-').map(Number);
async function api(path) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H });
    if (r.ok) return r.json();
    const txt = (await r.text()).slice(0, 200);
    if (r.status < 500 || t >= 4) throw new Error(`HTTP ${r.status} ${path.slice(0, 80)} ${txt}`);
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}
async function tudo(path) { const out = []; for (let off = 0; ; off += 1000) { const p = await api(`${path}${path.includes('?') ? '&' : '?'}limit=1000&offset=${off}`); out.push(...(p || [])); if (!p || p.length < 1000) break; } return out; }
const MERC = 'ABCDEFGHIJ';
const pk = s => { const p = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 4) + MERC[+p[4]] + p.slice(5) : p; };
const norm = s => String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const f0 = v => v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString('pt-BR');
const f2 = v => v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (s, n) => String(s).padEnd(n), padL = (s, n) => String(s).padStart(n);

// 1. projeto da placa no FT (qualquer unidade, as quinzenas do mês)
const FT = {};   // placa → Set de projetos
for (const [canal, tabela, proj] of [['ROTA', 'Caminhao', 'Rota'], ['ROTA', 'Van', 'Van'], ['AS', 'CaminhaoAS', 'Auto Serviço']]) {
  const rows = await tudo(`ft_linha?select=placa,quinzena&canal=eq.${canal}&tabela=eq.${tabela}&ano=eq.${ANO}&mes=eq.${MM}`);
  rows.forEach(r => { const p = pk(r.placa); if (p) (FT[p] = FT[p] || new Set()).add(proj); });
  console.log(`FT ${canal} · ${tabela}: ${rows.length} linhas no mês`);
}
const ftDe = p => { const s = FT[p]; return !s ? 'fora do FT' : s.size > 1 ? [...s].sort().join(' + ') : [...s][0]; };

// 2. mapas
const mapas = await tudo(`remun_mapa?select=projeto,tipo,placa,km_ft,valor_pago,valor_ft,quinzena&vigencia=eq.${MES}&unidade=eq.${UNI}`);
console.log(`\n${UNI} · ${MES}: ${mapas.length} mapas no remun_mapa`);
const G = {};
mapas.forEach(m => { const k = m.projeto + ' → placa ' + ftDe(pk(m.placa)); const g = G[k] = G[k] || { proj: m.projeto, ft: ftDe(pk(m.placa)), n: 0, km: 0, pago: 0, vft: 0, np: 0, placas: new Set() };
  g.n++; g.km += +m.km_ft || 0; if (m.valor_pago != null) { g.pago += +m.valor_pago; g.np++; } g.vft += +m.valor_ft || 0; g.placas.add(pk(m.placa)); });
console.log('\n── mapas: projeto do MAPA × projeto da PLACA no FT ──');
console.log(pad('projeto do mapa → placa', 44), padL('mapas', 6), padL('placas', 7), padL('km FT', 9), padL('pago médio', 11), padL('FT médio', 10));
Object.keys(G).sort().forEach(k => { const g = G[k]; console.log(pad(k, 44), padL(f0(g.n), 6), padL(g.placas.size, 7), padL(f0(g.km), 9), padL(f2(g.np ? g.pago / g.np : null), 11), padL(f2(g.n ? g.vft / g.n : null), 10)); });
// só a 1ª viagem, por quinzena: o valor pago separa quem foi pago como AS de quem foi pago como Rota
console.log('\n── só 1ª viagem (prim), por quinzena: valor pago médio ──');
const P = {};
mapas.filter(m => m.tipo === 'prim').forEach(m => { const k = 'Q' + m.quinzena + ' · ' + m.projeto + ' → placa ' + ftDe(pk(m.placa)); const g = P[k] = P[k] || { n: 0, pago: 0, np: 0, min: Infinity, max: -Infinity, km: 0 };
  g.n++; g.km += +m.km_ft || 0; if (m.valor_pago != null) { const v = +m.valor_pago; g.pago += v; g.np++; if (v > 0) { g.min = Math.min(g.min, v); g.max = Math.max(g.max, v); } } });
Object.keys(P).sort().forEach(k => { const g = P[k]; console.log(pad(k, 50), padL(f0(g.n), 5), 'mapas · km FT por mapa', padL(f2(g.km / g.n), 7), '· pago médio', padL(f2(g.np ? g.pago / g.np : null), 8), '· mín', padL(f2(isFinite(g.min) ? g.min : null), 8), '· máx', padL(f2(isFinite(g.max) ? g.max : null), 8)); });

// 3. km rodado do mês (aba Km/L do consumo automático; cai na sh_ se a ca_ não existir)
let kml = [];
for (const t of ['ca_consumo_km_litro', 'sh_consumo_km_litro']) {
  try { kml = await tudo(`${t}?select=projeto,placa,km_rodado_horas_trabalhadas&vigencia_orig=eq.${MES}-01`); if (kml.length) { console.log(`\nkm rodado: ${t}, ${kml.length} linhas no mês (todas as unidades)`); break; } } catch (e) { console.log('  ' + t + ': ' + e.message); }
}
const daUni = kml.filter(r => new RegExp('-\\s*' + UNI + '\\s*$').test(norm(r.projeto)));
const projAba = r => { const p = norm(r.projeto).replace(/\s*-\s*[A-Z]+\s*$/, ''); return /VAN/.test(p) ? 'Van' : /AUTO/.test(p) ? 'Auto Serviço' : /ROTA/.test(p) ? 'Rota' : p; };
const R1 = {}, R2 = {}, R3 = {};
// placa → projeto em que ela teve mais km do FT nos mapas (a regra do Painel KM)
const kmPl = {}; mapas.forEach(m => { const p = pk(m.placa); ((kmPl[p] = kmPl[p] || {})[m.projeto] = (kmPl[p][m.projeto] || 0) + (+m.km_ft || 0)); });
const maior = p => { const o = kmPl[p]; if (!o) return null; return Object.keys(o).sort((a, b) => o[b] - o[a])[0]; };
daUni.forEach(r => { const km = +r.km_rodado_horas_trabalhadas || 0, p = pk(r.placa);
  R1[projAba(r)] = (R1[projAba(r)] || 0) + km; R2[ftDe(p)] = (R2[ftDe(p)] || 0) + km; const mj = maior(p) || ('sem mapa (aba: ' + projAba(r) + ')'); R3[mj] = (R3[mj] || 0) + km; });
const lista = o => Object.keys(o).sort().map(k => `${k} ${f0(o[k])}`).join(' · ');
console.log('km rodado pelo projeto da LINHA da aba Km/L :', lista(R1));
console.log('km rodado pelo projeto da PLACA no FT       :', lista(R2));
console.log('km rodado pelo projeto de MAIS km nos mapas :', lista(R3));

// 4. remunerado nas duas leituras
const A = {}, B = {};
mapas.forEach(m => { const km = +m.km_ft || 0; A[m.projeto] = (A[m.projeto] || 0) + km; const f = ftDe(pk(m.placa)); B[f] = (B[f] || 0) + km; });
console.log('\nkm remunerado pelo projeto do MAPA  :', lista(A));
console.log('km remunerado pelo projeto da PLACA :', lista(B));
console.log('\n── Δ por projeto ──');
const projs = [...new Set([...Object.keys(A), ...Object.keys(B), ...Object.keys(R2), ...Object.keys(R3)])].sort();
console.log(pad('', 34), padL('rem (mapa)', 11), padL('real (maior)', 13), padL('Δ hoje', 9), ' |', padL('rem (placa)', 12), padL('real (placa)', 13), padL('Δ pela placa', 13));
projs.forEach(p => console.log(pad(p, 34), padL(f0(A[p] || 0), 11), padL(f0(R3[p] || 0), 13), padL(f0((R3[p] || 0) - (A[p] || 0)), 9), ' |', padL(f0(B[p] || 0), 12), padL(f0(R2[p] || 0), 13), padL(f0((R2[p] || 0) - (B[p] || 0)), 13)));
