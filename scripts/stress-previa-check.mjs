// Stress Test de veículos no mês corrente: o que o robô do Farol coletou do
// Ginfo (ginfo_snapshot 'stress-test-frota', tela padrão = mês atual) e o que
// o robô do Elite gravou (2ª quinzena). Base para a prévia do Frota de Elite
// (Renan, 19/11/2026: "Na prévia, pode avaliar o stress test atual"). Só
// leitura; não imprime placa.
const SUPA='https://lozwipoeacpvplgkrxkq.supabase.co', KEY=process.env.GEM_SUPABASE_SERVICE_KEY;
const H={apikey:KEY,Authorization:'Bearer '+KEY};
const get=async q=>{const r=await fetch(`${SUPA}/rest/v1/${q}`,{headers:H});if(!r.ok)throw new Error(q+' '+r.status+' '+(await r.text()).slice(0,200));return r.json();};
const conta=(a,f)=>a.reduce((o,x)=>(o[f(x)]=(o[f(x)]||0)+1,o),{});
const [g]=await get("ginfo_snapshot?chave=eq.stress-test-frota&select=chave,updated_at,data");
const d=(g&&g.data)||[];
console.log('ginfo_snapshot stress-test-frota:',d.length,'linhas · gravado',g&&g.updated_at);
if(d[0]) console.log('colunas:',Object.keys(d[0]).join(' | '));
for(const k of ['Período','Status','Justificativa','Freightech','Empresa'])
  if(d[0]&&k in d[0]) console.log(k,':',JSON.stringify(conta(d,x=>x[k])).slice(0,600));
const num=v=>{const n=Number(String(v??'').replace(',','.'));return isFinite(n)?n:null;};
console.log('Viagens:',JSON.stringify(conta(d,x=>{const n=num(x.Viagens);return n==null?'vazio':n===0?'0':n<5?'1-4':n<20?'5-19':'20+';})));
console.log('Desconto>0:',d.filter(x=>num(x.Desconto)>0).length);
console.log('Última Saída (amostra de tipos):',JSON.stringify(d.slice(0,5).map(x=>x['Última Saída'])));
console.log('Saída:',JSON.stringify(conta(d,x=>String(x['Saída']??'vazio'))).slice(0,300));
console.log('Saída na FIlial:',JSON.stringify(conta(d,x=>String(x['Saída na FIlial']??'vazio'))).slice(0,300));
console.log('por filial (n · com viagem · com desconto):');
const fil=conta(d,x=>x['Filial Freightech']);
for(const f of Object.keys(fil).sort()){const q=d.filter(x=>x['Filial Freightech']===f);console.log('  ',String(f).padEnd(24),q.length,'·',q.filter(x=>num(x.Viagens)>0).length,'·',q.filter(x=>num(x.Desconto)>0).length);}
const e=await get("elite_snapshot?indicador=eq.stress-test-frota&escopo=eq.mes&vigencia=in.(10/2026,11/2026)&select=vigencia,updated_at,data");
for(const r of e){const q=r.data||[];console.log(`\nelite ${r.vigencia}:`,q.length,'linhas · gravado',r.updated_at,'· Período',JSON.stringify(conta(q,x=>x['Período'])).slice(0,200),'· Viagens>0',q.filter(x=>num(x.Viagens)>0).length,'· desconto',q.filter(x=>num(x.Desconto)>0).length);}
