// Km/L · Seara — compara o Km/L REMUNERADO pelas duas ponderações, mês a mês:
//
//  · ANTES: Σ(KmPorLitro × viagens) ÷ Σviagens — peso = nº de viagens da placa na
//    Base CTEs. Quando a Base CTEs atrasa (chega 2 meses depois da Combustível),
//    todo mundo fica com peso zero e o painel mostra "—" (ago/2026).
//  · AGORA: Σkm ÷ Σ(km ÷ KmPorLitro) — peso = km rodado da placa na aba
//    Combustível (chega junto com o real). É "km rodado ÷ litros que o remunerado
//    previa para esse km", a mesma conta do impacto. A Base CTEs sai do painel.
//
// Imprime, por vigência: placas, placas com benchmark, Km/L real, Km/L rem
// antes × agora, Δ entre os dois, e o impacto em R$ pelas duas contas.
// Roda no Actions (o sandbox não alcança o docs.google).
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';
const GID_REM = 0, GID_CTES = 1672208132, GID_COMB = 1982300845;

const MERC = 'ABCDEFGHIJ';
const placaKey = s => { const p = String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,''); return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0,4)+MERC[+p[4]]+p.slice(5) : p; };
const MES3 = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function vigDe(v){
  const s = String(v==null?'':v);
  let m = s.match(/Date\((\d+),(\d+)/); if(m) return m[1]+'-'+String(+m[2]+1).padStart(2,'0');
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0');
  const d = new Date(s); return isNaN(d) ? '' : d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
const mesAnt = k => { const [p,ym]=k.split('|'); const [y,m]=ym.split('-').map(Number); const d=new Date(y,m-2,1); return p+'|'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
async function gvz(gid, tq){
  const p = ['gid='+gid,'headers=1','tqx=out:json']; if(tq) p.push('tq='+encodeURIComponent(tq));
  const t = await (await fetch(`https://docs.google.com/spreadsheets/d/${SEARA_ID}/gviz/tq?${p.join('&')}`)).text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}')+1));
  if(j.status!=='ok') throw new Error('gviz '+j.status);
  const cols = (j.table.cols||[]).map(c => String((c&&(c.label||c.id))||'').trim());
  const rows = (j.table.rows||[]).map(x => (x.c||[]).map(c => c ? (c.v!=null?c.v:c.f) : null));
  return {cols, rows};
}

const [comb, ctes, brem] = await Promise.all([gvz(GID_COMB), gvz(GID_CTES,'select B, C, D, E'), gvz(GID_REM)]);

// viagens distintas por placa|vig (Base CTEs) — o peso ANTIGO
let nD=0, nE=0; ctes.rows.slice(0,80).forEach(r => { if(vigDe(r[2])) nD++; if(vigDe(r[3])) nE++; });
const iDt = nE>nD ? 3 : 2;
const seen = new Set(), viag = {};
ctes.rows.forEach(r => { const b=r[0], p=placaKey(r[1]), v=vigDe(r[iDt]); if(b==null||!p||!v) return; if(seen.has(b)) return; seen.add(b); viag[p+'|'+v]=(viag[p+'|'+v]||0)+1; });

// benchmark (Base Remunerado) por placa|vig, colunas pelo nome
const bl = brem.cols.map(c => c.toLowerCase().replace(/\s/g,''));
const bi = (alvo, def) => { const i = bl.findIndex(c => c.includes(alvo)); return i>=0 ? i : def; };
const iVig=bi('vigencia',0), iPl=bi('placa',3), iKmL=bi('kmporlitro',15);
const bench = {};
brem.rows.forEach(r => { const p=placaKey(r[iPl]), v=vigDe(r[iVig]); if(!p||!v) return; bench[p+'|'+v] = +r[iKmL]||0; });
const benchFor = k => bench[k] > 0 ? bench[k] : (bench[mesAnt(k)] || 0);
const viagFor  = k => viag[k] || viag[mesAnt(k)] || 0;

// raiz = aba Combustível
const por = {};
comb.rows.forEach(r => {
  const p = placaKey(r[4]); const mi = MES3.indexOf(String(r[5]||'').toLowerCase().slice(0,3)); const y=+r[6];
  const km=+r[10]||0, lit=+r[11]||0, tot=+r[13]||0; if(!p||mi<0||!y||km<=0) return;
  const v = y+'-'+String(mi+1).padStart(2,'0'); const k = p+'|'+v;
  const o = por[v] || (por[v] = {placas:0, comB:0, km:0, lit:0, tot:0, remV:0, sumV:0, kmB:0, litB:0});
  const b = benchFor(k), vg = viagFor(k);
  o.placas++; o.km+=km; o.lit+=lit; o.tot+=tot;
  if(b>0){ o.comB++; o.kmB+=km; o.litB+=km/b; if(vg>0){ o.remV+=b*vg; o.sumV+=vg; } }
});

const f2 = x => x==null ? '   —' : x.toFixed(2).padStart(5);
const fR = x => x==null ? '        —' : Math.round(x).toLocaleString('pt-BR').padStart(9);
console.log('vig     | placas | c/bench | Km/L real | rem ANTES (viagens) | rem AGORA (km) |   Δ rem | impacto ANTES | impacto AGORA');
console.log('--------+--------+---------+-----------+---------------------+----------------+---------+---------------+--------------');
let maxDelta = 0;
Object.keys(por).sort().forEach(v => {
  const o = por[v];
  const real = o.lit>0 ? o.km/o.lit : null;
  const antes = o.sumV>0 ? o.remV/o.sumV : null;
  const agora = o.litB>0 ? o.kmB/o.litB : null;
  const rsL = o.lit>0 ? o.tot/o.lit : null;
  const imp = rem => (rem && real && rsL) ? (o.km/rem - o.km/real)*rsL : null;
  const d = (antes!=null && agora!=null) ? agora-antes : null;
  if(d!=null) maxDelta = Math.max(maxDelta, Math.abs(d));
  console.log(`${v} | ${String(o.placas).padStart(6)} | ${String(o.comB).padStart(7)} | ${f2(real).padStart(9)} | ${f2(antes).padStart(19)} | ${f2(agora).padStart(14)} | ${d==null?'      —':(d>=0?'+':'')+d.toFixed(3).padStart(6)} | ${fR(imp(antes)).padStart(13)} | ${fR(imp(agora)).padStart(13)}`);
});
console.log(`\nmaior |Δ| entre as duas ponderações (meses em que as duas existem): ${maxDelta.toFixed(3)} km/L`);
console.log('impacto = (km/rem − km/real) × R$/L real — a mesma conta do painel; "—" = ponderação sem peso no mês.');
