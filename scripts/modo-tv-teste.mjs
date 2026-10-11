// Modo TV: confere o botão (lugar, rótulo, tela cheia, Esc) em painéis de cada tipo e que ele NÃO aparece em iframe.
// Rodar: NODE_PATH=$(npm root -g) node scripts/modo-tv-teste.mjs  (servidor local na porta 8765, rede externa bloqueada)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=new URL('..', import.meta.url).pathname;
const srv=http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p.endsWith('/')) p+='index.html';
  const f=path.join(ROOT,p); if(!fs.existsSync(f)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'}); fs.createReadStream(f).pipe(r); }).listen(8765);
const b=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1366,height:768}});
await ctx.route(u=>!u.hostname.includes('localhost'), r=>r.abort());
await ctx.addInitScript(()=>{ try{sessionStorage.setItem('gem_hub','1');}catch(e){} });
const pags=['visao-financeira/','painel-km/','fca-consolidado/','fca-preenchimento/','combustivel/','combustivel/seara/remunerado/','pneus/','mpr/','carta-custos/','check-metas/','compra-pneus/'];
for(const pg of pags){
  const p=await ctx.newPage(); const err=[]; p.on('pageerror',e=>err.push(e.message.slice(0,80)));
  await p.goto('http://localhost:8765/'+pg,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await p.waitForTimeout(700);
  const info=await p.evaluate(()=>{ const b=document.querySelector('.tv-btn'); if(!b) return {btn:false, url:location.pathname};
    const prev=b.previousElementSibling, next=b.nextElementSibling;
    return {btn:document.querySelectorAll('.tv-btn').length, txt:b.textContent.trim(), onde:b.parentElement.className,
      antes:prev?(prev.className+':'+prev.textContent.trim().slice(0,22)):null, depois:next?(next.className+':'+next.textContent.trim().slice(0,22)):null, vis:b.offsetParent!==null}; });
  let fs1=null;
  const bx=info.btn?await p.locator('.tv-btn').first().boundingBox():null; info.box=!!(bx&&bx.width); if(info.btn && info.box){ info.visivelPW=await p.locator('.tv-btn').first().isVisible(); await p.click('.tv-btn',{force:true}); await p.waitForTimeout(400);
    fs1=await p.evaluate(()=>({fs:!!document.fullscreenElement, txt:document.querySelector('.tv-btn').textContent.trim(), cls:document.body.classList.contains('modo-tv')}));
    await p.keyboard.press('Escape'); await p.evaluate(()=>document.fullscreenElement&&document.exitFullscreen()); await p.waitForTimeout(300);
    fs1.depois=await p.evaluate(()=>document.querySelector('.tv-btn').textContent.trim());
    if(pg==='visao-financeira/'){ await p.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/tv-vf.png'}); await p.evaluate(()=>trocaMini()); await p.waitForTimeout(300); await p.hover('.tv-btn'); await p.waitForTimeout(200); await p.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/tv-vf-mini.png'}); }
    if(pg==='combustivel/') await p.screenshot({path:(process.env.SHOT_DIR||'/tmp')+'/tv-comb.png'});
  }
  console.log(pg, JSON.stringify(info), fs1?JSON.stringify(fs1):'', err.length?'ERROS:'+err.join('|'):'');
  await p.close();
}
// iframe: não pode aparecer
const p=await ctx.newPage(); await p.setContent('<iframe src="http://localhost:8765/visao-financeira/" width="1200" height="700"></iframe>'); await p.waitForTimeout(1200);
const fr=p.frames().find(f=>f.url().includes('visao-financeira')); console.log('iframe tv-btn:', fr?await fr.evaluate(()=>document.querySelectorAll('.tv-btn').length):'sem frame');
await b.close(); srv.close();
