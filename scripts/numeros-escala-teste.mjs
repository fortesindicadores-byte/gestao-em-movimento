import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
// Números grandes acompanham a tela (Renan, 13/10/2026: "Na tela fica ok, mas no
// notebook fica muito grande"). Em cada painel da casca, mede o tamanho da fonte dos
// números dos cards em três janelas: 1920×950 tem de ficar IGUAL ao de antes,
// 1536×730 (notebook com escala de 125%) e 1366×650 têm de ficar menores, e o
// celular (390×800) tem de ficar igual ao de antes.
// ANTIGO=<commit> compara com o código de um commit (padrão HEAD).
const ROOT=process.cwd(), ANT=process.env.ANTIGO||'HEAD';
const SEL='.kpi .kv, .kpis .kv, .kpi b, .scard .sval, .hn, .hv, .hval, .hero-value, #v-impPreco, #v-impVolume, .uc-score, .ec-val';
const arqs=execSync(`grep -rl "números grandes acompanham a tela" --include=*.html .`,{cwd:ROOT}).toString().trim().split('\n').map(s=>s.replace(/^\.\//,''));
let antigo=false;
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]).replace(/^\//,'');if(!u||u.endsWith('/'))u+='index.html';
  let body;
  if(antigo&&u.endsWith('.html')){try{body=execSync(`git show ${ANT}:${u}`,{cwd:ROOT,maxBuffer:64e6});}catch(e){body=null;}}
  else{const f=path.join(ROOT,u);body=fs.existsSync(f)?fs.readFileSync(f):null;}
  if(!body){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':u.endsWith('.js')?'text/javascript':u.endsWith('.css')?'text/css':'text/html'});r.end(body);}).listen(0);
const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const VP=[[1920,950],[1536,730],[1366,650],[390,800]];
async function mede(arq,w,h){
  const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
  await ctx.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await ctx.addInitScript(()=>{try{sessionStorage.setItem('gem_hub','1');}catch(e){}});
  const pg=await ctx.newPage();
  await pg.goto(`http://localhost:${port}/${arq}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await pg.waitForTimeout(300);
  const v=await pg.evaluate(sel=>{const o={};document.querySelectorAll(sel).forEach(e=>{const k=e.id?('#'+e.id):(e.className||e.tagName);if(!(k in o))o[k]=parseFloat(getComputedStyle(e).fontSize);});return o;},SEL).catch(()=>({}));
  await ctx.close(); return v;
}
let ok=0,fail=0; const t=(c,m)=>{c?ok++:fail++; if(!c)console.log('FALHA',m);};
const res={};
for(const modo of [true,false]){ antigo=modo;
  for(const a of arqs) for(const [w,h] of VP){ res[`${modo?'A':'N'}|${a}|${w}`]=await mede(a,w,h); } }
for(const a of arqs){
  const A=res[`A|${a}|1920`],N=res[`N|${a}|1920`],ks=Object.keys(N);
  if(!ks.length){console.log('  (sem elemento medível)',a);continue;}
  t(ks.every(k=>A[k]===N[k]),`${a} 1920×950 igual ao antigo ${JSON.stringify(A)} → ${JSON.stringify(N)}`);
  const n15=res[`N|${a}|1536`],a15=res[`A|${a}|1536`];
  t(ks.some(k=>n15[k]<a15[k]),`${a} 1536×730 menor que o antigo ${JSON.stringify(a15)} → ${JSON.stringify(n15)}`);
  t(ks.every(k=>n15[k]<=a15[k]),`${a} 1536×730 nada maior`);
  t(ks.every(k=>res[`N|${a}|1366`][k]<=n15[k]),`${a} 1366×650 ≤ 1536×730`);
  t(ks.every(k=>res[`N|${a}|390`][k]===res[`A|${a}|390`][k]),`${a} celular igual ao antigo`);
  const k=ks[0]; console.log(`${a.padEnd(44)} ${k.slice(0,18).padEnd(18)} 1920:${N[k]} · 1536:${n15[k]} (era ${a15[k]}) · 1366:${res[`N|${a}|1366`][k]}`);
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
