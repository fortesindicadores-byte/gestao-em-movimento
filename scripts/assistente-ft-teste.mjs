// Teste da Edge Function supabase/functions/assistente-ft: a API do modelo e o Supabase são dublados
// e o SQL roda DE VERDADE num Postgres local com scripts/assistente-ft.sql aplicado.
// Uso: AFT_DIR=<pasta com @anthropic-ai/sdk@1.3.0 instalado> PGSOCK=<pasta do socket> PGPORT=5499
//   node --experimental-strip-types scripts/assistente-ft-teste.mjs
// O Postgres precisa dos papéis do Supabase (postgres sem superusuário, anon, authenticated,
// service_role) e das tabelas ft_rem_mes e portal_segredo (portal_segredo NÃO liberada).
import http from 'node:http'; import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const SRC = new URL('../supabase/functions/assistente-ft/index.ts', import.meta.url);
const AFT = process.env.AFT_DIR || '.', SOCK = process.env.PGSOCK || '/var/tmp/pga', PORT = process.env.PGPORT || '5499';
const FN = AFT.replace(/\/$/,'') + '/fn.ts';
fs.writeFileSync(FN, fs.readFileSync(SRC,'utf8').replace('npm:@anthropic-ai/sdk@1.3.0','@anthropic-ai/sdk'));
let ok=0, falha=0; const chk=(c,m)=>{ if(c){ok++;console.log('ok  ',m);} else {falha++;console.log('FALHA',m);} };
const pedidosIA=[]; const logs=[]; let roteiro=[];
function sse(res, msg){ res.writeHead(200,{'content-type':'text/event-stream'});
  const w=(e,d)=>res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
  w('message_start',{type:'message_start',message:{id:'m',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,usage:{input_tokens:1000,output_tokens:1,cache_read_input_tokens:500,cache_creation_input_tokens:200}}});
  msg.blocos.forEach((b,i)=>{
    if(b.type==='text'){ w('content_block_start',{type:'content_block_start',index:i,content_block:{type:'text',text:''}});
      for(const p of b.text.match(/.{1,8}/gs)) w('content_block_delta',{type:'content_block_delta',index:i,delta:{type:'text_delta',text:p}}); }
    else { w('content_block_start',{type:'content_block_start',index:i,content_block:{type:'tool_use',id:b.id,name:b.name,input:{}}});
      w('content_block_delta',{type:'content_block_delta',index:i,delta:{type:'input_json_delta',partial_json:JSON.stringify(b.input)}}); }
    w('content_block_stop',{type:'content_block_stop',index:i}); });
  w('message_delta',{type:'message_delta',delta:{stop_reason:msg.stop},usage:{output_tokens:300}});
  w('message_stop',{type:'message_stop'}); res.end(); }
function sql(q){ fs.writeFileSync(SOCK+'/q.sql', "set role service_role;\nselect assistente_sql($q$"+q+"$q$, 2000);\n"); fs.chmodSync(SOCK+'/q.sql',0o644);
  try{ const out=execFileSync('su',['postgres','-c','psql -h '+SOCK+' -p '+PORT+' -U postgres -d app -tA -q -v ON_ERROR_STOP=1 -f '+SOCK+'/q.sql'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); return {st:200,body:out.trim().split('\n').pop()}; }
  catch(e){ return {st:400,body:JSON.stringify({message:String(e.stderr).split('\n').find(l=>/ERROR/.test(l))})}; } }
const srv=http.createServer((req,res)=>{ let b=''; req.on('data',d=>b+=d); req.on('end',()=>{
  if(req.url==='/auth/v1/user'){ const a=req.headers.authorization||''; res.writeHead(a==='Bearer tokdono'?200:a==='Bearer tokoutro'?200:401,{'content-type':'application/json'});
    return res.end(JSON.stringify(a==='Bearer tokdono'?{email:'Fortesindicadores@gmail.com'}:a==='Bearer tokoutro'?{email:'outro@conlogsa.com.br'}:{})); }
  if(req.url==='/rest/v1/rpc/assistente_sql'){ const r=sql(JSON.parse(b).p_sql); res.writeHead(r.st,{'content-type':'application/json'}); return res.end(r.body); }
  if(req.url==='/rest/v1/assistente_log'){ logs.push(JSON.parse(b)); res.writeHead(201); return res.end(); }
  if(req.url.startsWith('/v1/messages')){ pedidosIA.push({h:req.headers,b:JSON.parse(b)}); return sse(res, roteiro.shift()); }
  res.writeHead(404); res.end(); }); }).listen(0);
await new Promise(r=>srv.on('listening',r)); const URLB='http://127.0.0.1:'+srv.address().port;
const env={SUPABASE_URL:URLB,SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'srv',ANTHROPIC_API_KEY:'sk-teste',ANTHROPIC_BASE_URL:URLB};
Object.assign(process.env,env); let handler;
globalThis.Deno={env:{get:k=>process.env[k]},serve:h=>{handler=h;}};
await import(FN);
async function pede(tok, mensagens){ const r=await handler(new Request('http://x/',{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify({mensagens,contexto:'Resumo Gerencial · set/26'})}));
  if(r.headers.get('content-type')?.includes('ndjson')){ const t=await r.text(); return {st:r.status, ev:t.trim().split('\n').map(l=>JSON.parse(l))}; } return {st:r.status, body:await r.text()}; }

// 1 · sem login, outro e-mail
chk((await pede('ruim',[{role:'user',content:'oi'}])).st===401,'sem login → 401');
chk((await pede('tokoutro',[{role:'user',content:'oi'}])).st===403,'outro e-mail → 403');
chk((await pede('tokdono',[{role:'assistant',content:'oi'}])).st===400,'sem pergunta → 400');

// 2 · pergunta com consulta e resposta
roteiro=[
 {stop:'tool_use',blocos:[{type:'text',text:'Vou somar. '},{type:'tool_use',id:'tu1',name:'consultar_banco',input:{sql:'select unidade, sum(total) total from ft_rem_mes group by 1 order by 2 desc',motivo:'total por unidade'}}]},
 {stop:'tool_use',blocos:[{type:'tool_use',id:'tu2',name:'consultar_banco',input:{sql:'select * from portal_segredo',motivo:'teste'}}]},
 {stop:'end_turn',blocos:[{type:'text',text:'CGR lidera com R$ 200.'}]}];
const r=await pede('tokdono',[{role:'user',content:'Quem recebe mais?'}]);
const tipos=r.ev.filter(e=>e.t!=='ping').map(e=>e.t);
chk(r.st===200,'resposta 200 em NDJSON');
chk(r.ev.filter(e=>e.t==='txt').map(e=>e.d).join('')==='Vou somar. CGR lidera com R$ 200.','texto chega em pedaços e na ordem');
const res1=r.ev.find(e=>e.t==='res'); chk(res1&&res1.linhas===2,'1ª consulta rodou no Postgres (2 linhas)');
const res2=r.ev.filter(e=>e.t==='res')[1]; chk(res2&&/permission denied/.test(res2.erro||''),'portal_segredo recusado pelo banco: '+(res2&&res2.erro));
const fim=r.ev.find(e=>e.t==='fim'); chk(fim&&fim.consultas===2&&fim.custo>0,'fim com 2 consultas e custo '+(fim&&fim.custo));
chk(tipos.indexOf('sql')<tipos.indexOf('res'),'evento sql antes do resultado');
const p1=pedidosIA[0].b, p2=pedidosIA[1].b, p3=pedidosIA[2].b;
chk(p1.model==='claude-opus-5-5'&&p1.thinking.type==='adaptive'&&p1.output_config.effort==='high','modelo, thinking adaptive e effort high');
chk(p1.cache_control&&p1.cache_control.type==='ephemeral','cache automático ligado');
chk(p1.fallbacks==='default'&&String(pedidosIA[0].h['anthropic-beta']).includes('server-side-fallback-2026-07-01'),'fallback "default" com o beta certo');
chk(p1.messages.at(-1).role==='system'&&/Hoje é/.test(p1.messages.at(-1).content),'data e contexto como mensagem de sistema no fim');
chk(p2.messages.at(-1).role==='user'&&p2.messages.at(-1).content[0].type==='tool_result'&&p2.messages.at(-2).content.some(b=>b.type==='tool_use'),'tool_result volta junto do tool_use');
chk(p3.messages.at(-1).content[0].is_error===true,'erro do banco volta como is_error');
chk(logs.length===1&&logs[0].email==='fortesindicadores@gmail.com'&&logs[0].consultas===2&&!logs[0].erro,'log gravado (sem chave, com custo '+(logs[0]&&logs[0].custo_usd)+')');
chk(!JSON.stringify(logs).includes('sk-teste'),'chave não vai para o log');
chk(JSON.stringify(p1.tools[0]).includes('"strict":true'),'ferramenta strict');

// 3 · histórico: começa sempre pelo usuário e corta o que não é texto
roteiro=[{stop:'end_turn',blocos:[{type:'text',text:'ok'}]}];
await pede('tokdono',[{role:'assistant',content:'boas-vindas'},{role:'user',content:'a'},{role:'assistant',content:'b'},{role:'user',content:{x:1}},{role:'user',content:'c'}]);
const ph=pedidosIA.at(-1).b.messages; chk(ph[0].role==='user'&&ph.length===4&&ph[2].content==='c','histórico limpo: '+ph.map(m=>m.role).join(','));

// 4 · erro da API vira evento de erro
roteiro=[]; const srv2=srv; // sem roteiro → mock quebra
const e=await (async()=>{ const old=srv2.listeners('request')[0]; srv2.removeAllListeners('request');
  srv2.on('request',(req,res)=>{ if(req.url.startsWith('/v1/messages')){ res.writeHead(529,{'content-type':'application/json'}); return res.end(JSON.stringify({type:'error',error:{type:'overloaded_error',message:'Overloaded'}})); } old(req,res); });
  return pede('tokdono',[{role:'user',content:'x'}]); })();
chk(e.ev.some(x=>x.t==='erro'),'API fora vira {t:"erro"}: '+JSON.stringify(e.ev.find(x=>x.t==='erro')));
chk(logs.at(-1).erro,'log guarda o erro');
console.log(`\n${ok} ok · ${falha} falha(s)`); srv.close(); process.exit(falha?1:0);
