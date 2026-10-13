// Km/L · Seara — onde falta o Km/L REMUNERADO de uma placa.
//
// O painel pega o KmPorLitro da Base Remunerado (gid 0) pela placa + vigência e,
// se não achar, usa o mês anterior da mesma placa. "—" na coluna REM = nenhum dos
// dois meses tem KmPorLitro > 0. Este script mostra, para cada placa pedida (ou
// para todas as placas sem benchmark na vigência pedida):
//  · as linhas da aba Combustível (vigência, unidade, km);
//  · as linhas da Base Remunerado (vigência, placa como está, KmPorLitro, PrecoDiesel);
//  · placas parecidas na Base Remunerado (um caractere de diferença);
//  · o estado da carga da Base Remunerado no banco (sh_base), que é de onde o
//    painel lê pelo gviz-cache.
// Uso: PLACAS="STK2E63,SUE0A79" VIG=2026-09 node scripts/seara-kml-placas-check.mjs
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';
const GID_REM = 0, GID_COMB = 1982300845;
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const VIG = process.env.VIG || '2026-09';
const PEDIDAS = String(process.env.PLACAS || '').split(/[,\s]+/).filter(Boolean);

const MERC = 'ABCDEFGHIJ';
const placaKey = s => { const p = String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0,4)+MERC[+p[4]]+p.slice(5) : p; };
const MES3 = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function vigDe(v){
  const s = String(v==null?'':v);
  let m = s.match(/Date\((\d+),(\d+)/); if(m) return m[1]+'-'+String(+m[2]+1).padStart(2,'0');
  m = s.match(/^(\d{1,2})\/(\d{4})$/); if(m) return m[2]+'-'+m[1].padStart(2,'0');
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0');
  const d = new Date(s); return isNaN(d) ? '' : d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
const mesAnt = v => { const [y,m]=v.split('-').map(Number); const d=new Date(y,m-2,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
async function gvz(gid){
  const t = await (await fetch(`https://docs.google.com/spreadsheets/d/${SEARA_ID}/gviz/tq?gid=${gid}&headers=1&tqx=out:json`)).text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1));
  if(j.status!=='ok') throw new Error('gviz '+j.status);
  const cols = (j.table.cols||[]).map(c => String((c&&(c.label||c.id))||'').trim());
  const rows = (j.table.rows||[]).map(x => (x.c||[]).map(c => c ? (c.v!=null?c.v:c.f) : null));
  return {cols, rows};
}
const dist1 = (a,b) => { if(a.length!==b.length) return false; let d=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i] && ++d>1) return false; return d===1; };

const [comb, brem] = await Promise.all([gvz(GID_COMB), gvz(GID_REM)]);
const bl = brem.cols.map(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s/g,''));
const bi = (alvo, def) => { const i = bl.findIndex(c => c.includes(alvo)); return i>=0 ? i : def; };
const iVig=bi('vigencia',0), iPl=bi('placa',3), iKmL=bi('kmporlitro',15), iPr=bi('precodiesel',17);
console.log(`Base Remunerado: ${brem.rows.length} linhas · colunas: vigência=${brem.cols[iVig]}(${iVig}) placa=${brem.cols[iPl]}(${iPl}) KmPorLitro=${brem.cols[iKmL]}(${iKmL}) PrecoDiesel=${brem.cols[iPr]}(${iPr})`);
console.log(`Combustível: ${comb.rows.length} linhas · colunas: ${comb.cols.slice(0,14).join(' | ')}`);

const vigsRem = {}; const bench = {}; const remPorPlaca = {};
brem.rows.forEach(r => { const p=placaKey(r[iPl]), v=vigDe(r[iVig]); if(!v) return; vigsRem[v]=(vigsRem[v]||0)+1; if(!p) return;
  bench[p+'|'+v] = {kml:+r[iKmL]||0, pr:+r[iPr]||0, cru:r[iPl], kmlCru:r[iKmL]};
  (remPorPlaca[p] = remPorPlaca[p] || []).push(v); });
console.log('\nBase Remunerado — linhas por vigência:', Object.keys(vigsRem).sort().map(v=>`${v}:${vigsRem[v]}`).join(' '));

const combPorPlaca = {}; const combVig = {};
comb.rows.forEach(r => { const p=placaKey(r[4]); const mi=MES3.indexOf(String(r[5]||'').toLowerCase().slice(0,3)); const y=+r[6]; if(!p||mi<0||!y) return;
  const v=y+'-'+String(mi+1).padStart(2,'0'); const km=+r[10]||0; const uni=String(r[3]||'').trim()||'(vazia)';
  (combPorPlaca[p] = combPorPlaca[p] || []).push({v, uni, km, mod:String(r[7]||'').trim()});
  if(km>0) { (combVig[v] = combVig[v] || []).push({p, uni, km}); } });

const temBench = (p,v) => { const b=bench[p+'|'+v]; return b && (b.kml>0 || b.pr>0); };
const semBench = (combVig[VIG]||[]).filter(x => !temBench(x.p,VIG) && !temBench(x.p,mesAnt(VIG)));
console.log(`\n${VIG}: ${(combVig[VIG]||[]).length} placa(s) com km na Combustível · ${semBench.length} sem KmPorLitro em ${VIG} nem em ${mesAnt(VIG)}`);
const porUni = {}; semBench.forEach(x => porUni[x.uni]=(porUni[x.uni]||0)+1);
Object.keys(porUni).sort().forEach(u => console.log(`  ${u}: ${porUni[u]}`));

const alvo = PEDIDAS.length ? PEDIDAS.map(placaKey) : semBench.map(x=>x.p);
const todasRem = Object.keys(remPorPlaca);
for (const p of alvo) {
  console.log(`\n── ${p}`);
  const c = (combPorPlaca[p]||[]).sort((a,b)=>a.v<b.v?-1:1);
  console.log(`  Combustível: ${c.length ? c.map(x=>`${x.v} ${x.uni} ${Math.round(x.km)} km${x.mod?' · '+x.mod:''}`).join(' | ') : 'NÃO ESTÁ'}`);
  const vs = (remPorPlaca[p]||[]).sort();
  console.log(`  Base Remunerado: ${vs.length ? vs.map(v=>{const b=bench[p+'|'+v]; return `${v} KmPorLitro=${JSON.stringify(b.kmlCru)} Preço=${b.pr}`;}).join(' | ') : 'NÃO ESTÁ em vigência nenhuma'}`);
  const par = todasRem.filter(q => dist1(q,p));
  if (par.length) console.log(`  parecidas na Base Remunerado: ${par.map(q=>`${q} (${remPorPlaca[q].sort().join(',')})`).join(' · ')}`);
}

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (KEY) {
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  const r = await fetch(`${SUPA}/rest/v1/sh_base?slug=in.(seara_remunerado,seara_combustivel)&select=slug,linhas,carregado_em,erro`, { headers: H });
  console.log('\nBanco (sh_base):', r.ok ? JSON.stringify(await r.json()) : 'HTTP '+r.status);
}
