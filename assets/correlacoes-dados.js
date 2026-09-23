/* ============================================================================
   correlacoes-dados.js — a TABELA-FATO dos painéis de Correlações (23/09/2026).

   Monta, no navegador, uma linha por entidade × vigência com as MESMAS
   leituras dos painéis (DRE Frota por rótulo, Dispersão de km por índice,
   DRE Receita Líquida, Frota de Elite/Gerot pelo gerot-base, disp_resumo, custo_vigencia_mv +
   ativos + indisponibilidade, ce_scores_mensais). Três grãos: uni (unidade ×
   mês) · placa (placa × mês) · mot (motorista × mês). Cada linha leva
   {ent, uni, cod, vig, v:{variável:valor}} — `cod` é o código do portal
   (cada variável leva `dir`: 'up' = maior é melhor, 'down' = menor é melhor,
   sem dir = neutra — é o que diz "onde é melhor estar" no quadrante)
   (CGR, CBA T1…) em todos os grãos, para o painel da operação recortar a
   própria unidade; `uni` é o rótulo como veio da fonte.

   Quem usa: /correlacoes/ (admin) e /correlacoes-operacao/ (unidades).
   Precisa de window.GerotBase (assets/gerot-base.js) e do supabase-js.
   Uso: const {FATO, FONTES} = await CorrDados.carregar(sb);
   ============================================================================ */
(function(global){
'use strict';
const br=(n,d=0)=>(+n||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fin=v=>typeof v==='number'&&isFinite(v);
const NK=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const d2=n=>String(n).padStart(2,'0');
let SB=null;
/* rótulo da unidade na Condução Econômica (EMP PIRAI, CDD CAMPO GRANDE, INS LATA PIRAI…) → código do portal */
function uniCodCE(rot){
  const s=NK(rot); if(!s) return null;
  const emp=/^EMP\b/.test(s);
  const base=s.replace(/^(EMP|CDD|CDI|AS|INS LATA)\s+/,'').replace(/^BALNEARIO$/,'BALNEARIO CAMBORIU');
  const cod=CIDADE2COD[base]||null; if(!cod) return null;
  if(cod==='CBA') return emp?'CBA T1':'CBA T2';
  if(cod==='MCC') return emp?'MCC T1':'MCC T2';
  return cod;
}
/* toda vigência vira 'AAAA-MM' — cada fonte escreve de um jeito */
function vigKey(v){
  if(v==null||v==='') return null;
  if(v instanceof Date) return isNaN(v)?null:`${v.getFullYear()}-${d2(v.getMonth()+1)}`;
  const s=String(v).trim(); let m;
  if((m=s.match(/^Date\((\d+),(\d+)/))) return `${m[1]}-${d2(+m[2]+1)}`;
  if((m=s.match(/^(\d{4})-(\d{2})/))) return `${m[1]}-${m[2]}`;
  if((m=s.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${d2(+m[1])}`;
  if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${d2(+m[2])}`;
  if((m=s.toLowerCase().match(/^([a-zç]{3})[a-zç]*\.?\s*\/\s*(\d{2,4})$/))){ const i=MESES.indexOf(m[1]); if(i>=0){ let y=+m[2]; if(y<100) y+=2000; return `${y}-${d2(i+1)}`; } }
  return null;
}
const vigRot=k=>{ const m=String(k||'').match(/^(\d{4})-(\d{2})$/); return m?`${MESES[+m[2]-1]}/${m[1].slice(2)}`:String(k||''); };
const vigIdx=k=>{ const m=String(k||'').match(/^(\d{4})-(\d{2})$/); return m?(+m[1])*12+(+m[2]-1):null; };
/* unidade: código base + tier pelo projeto (mesma regra do fca-preenchimento / disp_unit_cod) */
const CIDADE2COD={'CUIABA':'CBA','CACHOEIRAS DE MACACU':'MCC','MACACU':'MCC','CAMPO GRANDE':'CGR','RIO DE JANEIRO':'CGR','BALNEARIO CAMBORIU':'BLC','CAMBORIU':'BLC',
  'FLORIANOPOLIS':'FLP','GUARULHOS':'GRL','NOVA FRIBURGO':'NFR','PELOTAS':'PLT','RONDONOPOLIS':'RON','PIRAI':'PIR','ANHANGUERA':'ANG','SEARA':'ANG','GOIANIA':'GNA'};
function comTier(cod,proj){
  const p=NK(proj);
  if(cod==='CBA'){ if(/EMPURRAD/.test(p)) return 'CBA T1'; if(/APOIO|ARMAZEM|EMPILHADEIRA|\bWH\b/.test(p)) return 'CBA T1 WH'; return 'CBA T2'; }
  if(cod==='MCC'){ return /EMPURRAD/.test(p)?'MCC T1':'MCC T2'; }
  return cod;
}
function todas(tabela,sel,ordem){
  return (async()=>{ const out=[];
    for(let off=0;off<60000;off+=1000){
      let q=SB.from(tabela).select(sel); if(ordem) q=q.order(ordem,{ascending:true});
      const {data,error}=await q.range(off,off+999); if(error) throw new Error(error.message);
      out.push(...(data||[])); if(!data||data.length<1000) break;
    }
    return out; })();
}
/* gviz por fetch (o shim assets/gviz-cache.js responde do banco) */
async function gviz(id,aba){
  const url=`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(aba)}`;
  const txt=await (await fetch(url)).text();
  const m=txt.match(/setResponse\(([\s\S]*)\)\s*;?\s*$/); if(!m) throw new Error('resposta gviz inesperada');
  const j=JSON.parse(m[1]); if(j.status!=='ok') throw new Error('gviz: '+((j.errors&&j.errors[0]&&j.errors[0].message)||j.status));
  const cols=(j.table.cols||[]).map(c=>String((c&&(c.label||c.id))||''));
  const rows=(j.table.rows||[]).map(r=>(r.c||[]).map(c=>c?c.v:null));
  return {cols,rows};
}
const idxRot=(cols,...nomes)=>{ const n=cols.map(NK); for(const x of nomes){ const i=n.indexOf(NK(x)); if(i>=0) return i; } for(const x of nomes){ const i=n.findIndex(c=>c.includes(NK(x))); if(i>=0) return i; } return -1; };
const num=v=>{ if(v==null||v==='') return null; if(typeof v==='number') return isFinite(v)?v:null; let s=String(v).replace(/\s|R\$/g,''); if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.'); const f=parseFloat(s); return isNaN(f)?null:f; };

/* ═══════════════════════════════════════════════════════════════════
   VARIÁVEIS — id, rótulo, abreviação (matriz), grupo, formato, nota.
   'uni' = unidade × mês · 'placa' = placa × mês · 'mot' = motorista × mês
   ═══════════════════════════════════════════════════════════════════ */
const FMT={
  pct:v=>br(v,1)+'%', brl:v=>'R$ '+br(v,0), num:v=>br(v,0), d1:v=>br(v,1), d2:v=>br(v,2), kml:v=>br(v,2)+' km/L', rskm:v=>'R$ '+br(v,2)+'/km', mm:v=>br(v,2)+' mm', h:v=>br(v,1)+' h', anos:v=>br(v,1)+' anos', l:v=>br(v,0)+' L', dias:v=>br(v,1)+' d',
};
const VARS={
 uni:[
  {id:'receita',b:['rec'],dir:'up',rot:'Receita líquida realizada',ab:'Receita',g:'Receita (DRE)',f:'brl',nota:'aba Receita Líquida do DRE, por unidade × mês'},
  {id:'rec_km',b:['rec','km'],dir:'up',rot:'Receita por km realizado',ab:'R$/km Rec',g:'Receita (DRE)',f:'rskm',nota:'receita líquida ÷ km realizado da Dispersão'},
  {id:'custo_real',b:['custo'],dir:'down',rot:'Custo total realizado (Frota)',ab:'Custo R',g:'Custos (DRE)',f:'brl'},
  {id:'desvio_custo',b:['custo'],dir:'down',rot:'Desvio do custo vs remunerado',ab:'Δ Custo %',g:'Custos (DRE)',f:'pct',nota:'realizado ÷ remunerado − 1; positivo = gastou mais que o remunerado'},
  {id:'comb_real',b:['comb','custo'],dir:'down',rot:'Combustíveis realizado',ab:'Comb R',g:'Custos (DRE)',f:'brl'},
  {id:'desvio_comb',b:['comb'],dir:'down',rot:'Desvio Combustíveis vs remunerado',ab:'Δ Comb %',g:'Custos (DRE)',f:'pct'},
  {id:'manut_real',b:['manut','custo'],dir:'down',rot:'Manutenções realizado',ab:'Manut R',g:'Custos (DRE)',f:'brl'},
  {id:'desvio_manut',b:['manut'],dir:'down',rot:'Desvio Manutenções vs remunerado',ab:'Δ Manut %',g:'Custos (DRE)',f:'pct'},
  {id:'pneus_real',b:['pneus','custo'],dir:'down',rot:'Pneus realizado',ab:'Pneus R',g:'Custos (DRE)',f:'brl'},
  {id:'desvio_pneus',b:['pneus'],dir:'down',rot:'Desvio Pneus vs remunerado',ab:'Δ Pneus %',g:'Custos (DRE)',f:'pct'},
  {id:'rskm_real',b:['custo','km'],dir:'down',rot:'R$/km realizado (custo total ÷ km real)',ab:'R$/km',g:'Custos (DRE)',f:'rskm',nota:'custo total realizado da Frota ÷ km realizado da Dispersão'},
  {id:'comb_rskm',b:['comb','km'],dir:'down',rot:'R$/km de Combustíveis',ab:'R$/km Comb',g:'Custos (DRE)',f:'rskm'},
  {id:'manut_rskm',b:['manut','km'],dir:'down',rot:'R$/km de Manutenções',ab:'R$/km Manut',g:'Custos (DRE)',f:'rskm'},
  {id:'pneus_rskm',b:['pneus','km'],dir:'down',rot:'R$/km de Pneus',ab:'R$/km Pneus',g:'Custos (DRE)',f:'rskm'},
  {id:'km_real',b:['km'],rot:'Km realizado',ab:'Km Real',g:'Dispersão de km',f:'num'},
  {id:'dispersao',b:['km'],dir:'down',rot:'Dispersão de km (real ÷ rem − 1)',ab:'Disp km %',g:'Dispersão de km',f:'pct',nota:'meta do Painel KM: 10%'},
  {id:'viagens',b:['km'],rot:'Viagens realizadas',ab:'Viagens',g:'Dispersão de km',f:'num'},
  {id:'km_viagem',b:['km'],rot:'Km por viagem',ab:'Km/viag',g:'Dispersão de km',f:'d1'},
  {id:'disp',b:['disp'],dir:'up',rot:'Disponibilidade (Ginfo)',ab:'Dispon.',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'prev',b:['prev'],dir:'up',rot:'Aderência a preventivas',ab:'Prevent.',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'pneus',b:['pneusAd'],dir:'up',rot:'Aderência aferição de pneus',ab:'Pneus %',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'checkT',b:['checkT'],dir:'up',rot:'Checklist T1/T2',ab:'Check T',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'checkWH',b:['checkWH'],dir:'up',rot:'Checklist WH',ab:'Check WH',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'conf',b:['conf'],dir:'up',rot:'Conformidade',ab:'Conform.',g:'Frota de Elite / Gerot',f:'pct',nota:'a régua do Ginfo mudou em ago/26; antes e depois não são comparáveis'},
  {id:'stVeic',b:['stV'],dir:'up',rot:'Stress Test veículos',ab:'ST Veíc',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'stEmp',b:['stE'],dir:'up',rot:'Stress Test empilhadeiras',ab:'ST Emp',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'civf',b:['civf'],dir:'up',rot:'CIVF',ab:'CIVF',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'sla',b:['sla'],dir:'up',rot:'SLA de manutenção',ab:'SLA',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'comb',b:['kml'],dir:'up',rot:'Km/L realizado',ab:'Km/L',g:'Frota de Elite / Gerot',f:'kml'},
  {id:'mtbf',b:['mtbf'],dir:'up',rot:'MTBF',ab:'MTBF',g:'Frota de Elite / Gerot',f:'h'},
  {id:'mttr',b:['mttr'],dir:'down',rot:'MTTR',ab:'MTTR',g:'Frota de Elite / Gerot',f:'h'},
  {id:'osVenc',b:['osV'],dir:'down',rot:'OS vencidas',ab:'OS Venc',g:'Frota de Elite / Gerot',f:'num'},
  {id:'osCritica',b:['osC'],dir:'down',rot:'Saídas com OS crítica',ab:'OS Crít',g:'Frota de Elite / Gerot',f:'num'},
  {id:'blitz',b:['blitz'],dir:'up',rot:'Blitz de segurança',ab:'Blitz',g:'Frota de Elite / Gerot',f:'pct'},
  {id:'disp_app',b:['disp'],dir:'up',rot:'Disponibilidade (app, média do mês)',ab:'Disp app',g:'Indisponibilidade',f:'pct',nota:'foto diária do disp_snapshot; histórico da planilha antes de 14/08/26'},
  {id:'indisp_med',b:['disp'],dir:'down',rot:'Veículos indisponíveis (média diária)',ab:'Indisp',g:'Indisponibilidade',f:'d1'},
 ],
 placa:[
  {id:'km_mes',b:['km'],rot:'Km no mês (ERP)',ab:'Km',g:'Contrato de manutenção',f:'num'},
  {id:'custo_mes',b:['custo'],dir:'down',rot:'Custo do contrato no mês',ab:'Custo',g:'Contrato de manutenção',f:'brl',nota:'nota da VW quando existe; senão km × taxa (contrato fixo = valor fixo)'},
  {id:'rskm',b:['custo','km'],dir:'down',rot:'R$/km do contrato',ab:'R$/km',g:'Contrato de manutenção',f:'rskm',nota:'só placas de contrato variável com km no mês'},
  {id:'taxa_km',b:['custo'],dir:'down',rot:'Taxa contratual por km',ab:'Taxa',g:'Contrato de manutenção',f:'rskm'},
  {id:'faixas',b:['faixa'],rot:'Faixas cobradas no mês',ab:'Faixas',g:'Contrato de manutenção',f:'num'},
  {id:'litros',b:['lit'],rot:'Litros abastecidos',ab:'Litros',g:'Abastecimento (ERP)',f:'l'},
  {id:'km_l',b:['km','lit'],dir:'up',rot:'Km/L (ERP)',ab:'Km/L',g:'Abastecimento (ERP)',f:'kml'},
  {id:'preco_l',b:['preco'],dir:'down',rot:'Preço médio do litro',ab:'R$/L',g:'Abastecimento (ERP)',f:'d2'},
  {id:'abast',b:['lit'],rot:'Abastecimentos no mês',ab:'Abast',g:'Abastecimento (ERP)',f:'num'},
  {id:'idade',b:['idade'],rot:'Idade do veículo',ab:'Idade',g:'Ativos (Ginfo)',f:'anos'},
  {id:'dias_indisp',b:['disp'],dir:'down',rot:'Dias indisponível no mês',ab:'Dias ind',g:'Indisponibilidade',f:'dias',nota:'eventos do app; 0 quando a unidade lança e não há evento'},
 ],
 mot:[
  {id:'nota',b:['nota'],dir:'up',rot:'Nota de condução (0–100)',ab:'Nota',g:'Condução Econômica',f:'d1'},
  {id:'rpm',b:['nota','rpm'],dir:'up',rot:'Uso da faixa verde (pontos)',ab:'RPM',g:'Condução Econômica',f:'d1'},
  {id:'idle',b:['nota','idle'],dir:'up',rot:'Motor ligado sem rodar (pontos)',ab:'Idle',g:'Condução Econômica',f:'d1'},
  {id:'acel',b:['nota','acel'],dir:'up',rot:'Acelerações bruscas (pontos)',ab:'Acel',g:'Condução Econômica',f:'d1'},
  {id:'vel',b:['nota','vel'],dir:'up',rot:'Velocidade (pontos)',ab:'Vel',g:'Condução Econômica',f:'d1'},
  {id:'km',b:['km'],rot:'Km no mês',ab:'Km',g:'Condução Econômica',f:'num'},
  {id:'dias',b:['dias'],rot:'Dias com dado',ab:'Dias',g:'Condução Econômica',f:'num'},
  {id:'viagens',b:['km'],rot:'Viagens (ciclos de ignição)',ab:'Viag',g:'Condução Econômica',f:'num'},
  {id:'excessos',b:['exc'],dir:'down',rot:'Excessos de velocidade por 100 km',ab:'Exc/100',g:'Condução Econômica',f:'d2'},
  {id:'litros',b:['lit'],rot:'Litros (telemetria)',ab:'Litros',g:'Condução Econômica',f:'l'},
  {id:'km_l',b:['km','lit'],dir:'up',rot:'Km/L (viagens com combustível)',ab:'Km/L',g:'Condução Econômica',f:'kml',nota:'km só das viagens com FuelUsed ÷ litros'},
 ],
};
const varDe=(grao,id)=>VARS[grao].find(v=>v.id===id);
const fmtVar=(v,x)=>fin(x)?(FMT[v.f]||FMT.num)(x):'—';

/* ═══════════════════════════════════════════════════════════════════
   TABELA-FATO — uma linha por entidade × vigência, com os valores
   FATO[grao] = [{ent, uni, vig, v:{id:valor}}]
   ═══════════════════════════════════════════════════════════════════ */
let FONTES=[];          // [{nome, grao, estado:'ok'|'vazio'|'erro', linhas, msg}]
function linha(mapa,ent,uni,vig){ const k=ent+'|'+vig; return mapa[k]||(mapa[k]={ent,uni,vig,cod:uni,v:{}}); }
function fonte(nome,grao,estado,linhas,msg){ FONTES.push({nome,grao,estado,linhas:linhas||0,msg:msg||''}); }

/* DRE Frota → custo por pacote, por unidade × mês (mapeado por rótulo) */
const DRE_ID='1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';
const PACOTE={'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS':'comb','COMBUSTIVEIS':'comb','FLUIDOS (ARLA)':'comb','ARLA':'comb',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS':'manut','MANUTENCAO DE VEICULOS E EQUIP.':'manut','MATERIAIS E FERRAMENTAS DE OFICINA':'manut','LAVACAO DE VEICULOS':'manut',
  'MANUTENCAO DE CARROCERIAS':'manut','PERSONALIZACAO/PADRONIZACAO DE VEICULOS':'manut','PERSONALIZACAO/PADRONIZACAO':'manut','PERSONALIZACAO E PADRONIZACAO DE VEICULOS':'manut',
  'CONTRATOS DE MANUTENCAO FABRICANTE':'manut','CONSERTOS E RECAPAGENS DE PNEUS':'pneus','PNEUS E CAMARAS':'pneus','RECAPAGENS E OUTROS SERVICOS':'pneus','PNEUS NOVOS':'pneus'};
async function loadDRE(mapa){
  const {cols,rows}=await gviz(DRE_ID,'Frota');
  const iVig=idxRot(cols,'vigência','vigencia'), iUni=idxRot(cols,'unidade'), iN3=idxRot(cols,'nível 3','nivel 3'), iCta=idxRot(cols,'conta gerencial','conta'),
        iRem=idxRot(cols,'remunerado'), iReal=idxRot(cols,'realizado');
  if([iVig,iUni,iN3,iRem,iReal].some(i=>i<0)) throw new Error('rótulos da aba Frota não encontrados: '+cols.join(' | '));
  const acc={}; let n=0;
  rows.forEach(r=>{
    const vig=vigKey(r[iVig]); if(!vig) return;
    const cod=CIDADE2COD[NK(String(r[iUni]||'').replace(/\s*\(INATIVO\)\s*/i,''))]; if(!cod) return;
    const uni=comTier(cod,String(r[iN3]||'').split('-')[0]);
    const pac=PACOTE[NK(r[iCta])]||null;
    // CUSTO NA DRE É NEGATIVO (bug real, 23/09/2026: "quando km real sobe custo desce?"): a
    // despesa vem com sinal de menos, como no Painel KM (-(valor)) e no fca-preenchimento.
    // Sem inverter, "gastou mais" virava "número mais negativo" e toda correlação com custo
    // saía de cabeça para baixo. Aqui custo é sempre POSITIVO (crédito, como o ICMS, abate).
    const rem=-(num(r[iRem])||0), real=-(num(r[iReal])||0);
    const a=acc[uni+'|'+vig]||(acc[uni+'|'+vig]={uni,vig,rem:0,real:0,comb_rem:0,comb_real:0,manut_rem:0,manut_real:0,pneus_rem:0,pneus_real:0});
    a.rem+=rem; a.real+=real; if(pac){ a[pac+'_rem']+=rem; a[pac+'_real']+=real; } n++;
  });
  Object.values(acc).forEach(a=>{
    const L=linha(mapa,a.uni,a.uni,a.vig).v;
    if(a.real) L.custo_real=a.real; if(a.rem) L.custo_rem=a.rem;
    if(a.rem>0&&a.real>0) L.desvio_custo=(a.real/a.rem-1)*100;
    if(a.comb_real) L.comb_real=a.comb_real; if(a.comb_rem>0&&a.comb_real>0) L.desvio_comb=(a.comb_real/a.comb_rem-1)*100;
    if(a.manut_real) L.manut_real=a.manut_real; if(a.manut_rem>0&&a.manut_real>0) L.desvio_manut=(a.manut_real/a.manut_rem-1)*100;
    if(a.pneus_real) L.pneus_real=a.pneus_real; if(a.pneus_rem>0&&a.pneus_real>0) L.desvio_pneus=(a.pneus_real/a.pneus_rem-1)*100;
  });
  fonte('DRE · aba Frota','uni',n?'ok':'vazio',n);
}
/* DRE Receita Líquida → receita por unidade × mês (mesmos rótulos da Frota; a receita vem POSITIVA na aba) */
async function loadReceita(mapa){
  const {cols,rows}=await gviz(DRE_ID,'Receita Líquida');
  const iVig=idxRot(cols,'vigência','vigencia'), iUni=idxRot(cols,'unidade'), iN3=idxRot(cols,'nível 3','nivel 3'), iReal=idxRot(cols,'realizado');
  if([iVig,iUni,iN3,iReal].some(i=>i<0)) throw new Error('rótulos da aba Receita Líquida não encontrados: '+cols.join(' | '));
  const acc={}; let n=0;
  rows.forEach(r=>{
    const vig=vigKey(r[iVig]); if(!vig) return;
    const cod=CIDADE2COD[NK(String(r[iUni]||'').replace(/\s*\(INATIVO\)\s*/i,''))]; if(!cod) return;
    const uni=comTier(cod,String(r[iN3]||'').split('-')[0]);
    const real=num(r[iReal])||0; if(!real) return;
    const a=acc[uni+'|'+vig]||(acc[uni+'|'+vig]={uni,vig,real:0}); a.real+=real; n++;
  });
  Object.values(acc).forEach(a=>{ if(a.real>0) linha(mapa,a.uni,a.uni,a.vig).v.receita=a.real; });
  fonte('DRE · aba Receita Líquida','uni',n?'ok':'vazio',n);
}
/* Dispersão de km (base do Painel KM): km rem/real e viagens por unidade × mês */
const DISP_ID='1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
async function loadDispKm(mapa){
  const {rows}=await gviz(DISP_ID,'Dispersão de km');
  const acc={}; let n=0;
  rows.forEach(r=>{
    const vig=vigKey(r[0]); if(!vig) return;
    const s14=String(r[14]||''), proj=s14.split('-')[0].trim(), cod=s14.includes('-')?s14.split('-').slice(1).join('-').trim():String(r[13]||'').trim();
    if(!cod) return;
    const uni=comTier(NK(cod).replace(/\s*\(INATIVO\)\s*/,''),proj);
    const rem=num(r[31])||0, real=num(r[32])||0, viag=num(r[22])||0;
    if(!(rem>0||real>0)) return;
    const a=acc[uni+'|'+vig]||(acc[uni+'|'+vig]={uni,vig,rem:0,real:0,viag:0}); a.rem+=rem; a.real+=real; a.viag+=viag; n++;
  });
  Object.values(acc).forEach(a=>{
    const L=linha(mapa,a.uni,a.uni,a.vig).v;
    if(a.rem) L.km_rem=a.rem; if(a.real) L.km_real=a.real;
    if(a.rem>0&&a.real>0) L.dispersao=(a.real/a.rem-1)*100;
    if(a.viag) L.viagens=a.viag; if(a.viag>0&&a.real>0) L.km_viagem=a.real/a.viag;
  });
  fonte('Dispersão de km','uni',n?'ok':'vazio',n);
}
/* Frota de Elite / Gerot: o próprio assets/gerot-base.js */
async function loadGerot(mapa){
  if(!window.GerotBase) throw new Error('gerot-base.js não carregou');
  const recs=await GerotBase.load({});
  const campos=new Set(VARS.uni.map(v=>v.id)); let n=0, semUni=new Set();
  recs.forEach(r=>{
    if(r.snapshot) return;                                  // amplitude/calibragem: só a última vigência
    if(!campos.has(r.field)||!fin(r.real)) return;
    const vig=vigKey(r.vig); if(!vig) return;
    const uni=GerotBase.FIL2COD[NK(r.unit)]||null; if(!uni){ semUni.add(r.unit); return; }
    linha(mapa,uni,uni,vig).v[r.field]=r.real; n++;
  });
  if(semUni.size) console.warn('Gerot: unidade sem código no FIL2COD:',[...semUni]);
  fonte('Frota de Elite / Gerot (elite_snapshot)','uni',n?'ok':'vazio',n,semUni.size?`sem de-para: ${[...semUni].join(', ')}`:'');
}
/* Disponibilidade do app: foto diária agregada por dia × unidade */
async function loadDispApp(mapa){
  const rows=await todas('disp_resumo','data,unidade,ativos,indisponiveis','data');
  const acc={};
  rows.forEach(r=>{ if(!(r.ativos>0)) return; const vig=vigKey(r.data); if(!vig) return;
    const a=acc[r.unidade+'|'+vig]||(acc[r.unidade+'|'+vig]={uni:r.unidade,vig,s:0,ind:0,n:0}); a.s+=1-(r.indisponiveis||0)/r.ativos; a.ind+=(r.indisponiveis||0); a.n++; });
  Object.values(acc).forEach(a=>{ const L=linha(mapa,a.uni,a.uni,a.vig).v; L.disp_app=a.s/a.n*100; L.indisp_med=a.ind/a.n; });
  fonte('Indisponibilidade (disp_resumo)','uni',rows.length?'ok':'vazio',rows.length);
}
/* derivadas que cruzam duas fontes (R$/km = custo ÷ km da Dispersão) */
function derivaUni(mapa){
  Object.values(mapa).forEach(L=>{ const v=L.v; if(v.km_real>0){
    if(fin(v.custo_real)) v.rskm_real=v.custo_real/v.km_real;
    if(fin(v.comb_real)) v.comb_rskm=v.comb_real/v.km_real;
    if(fin(v.manut_real)) v.manut_rskm=v.manut_real/v.km_real;
    if(fin(v.pneus_real)) v.pneus_rskm=v.pneus_real/v.km_real;
    if(fin(v.receita)) v.rec_km=v.receita/v.km_real; } });
}

/* ── grão PLACA: custo_vigencia_mv + ativos (idade) + indisponibilidade ── */
async function loadPlaca(mapa){
  let rows;
  try{ rows=await todas('custo_vigencia_mv','vig_km,placa,unidade,projeto,tipo,taxa_km,km_vig,custo_vig,litros,valor_diesel,abastecimentos,modelo,valor_vw,faixas_vw,previa'); }
  catch(e){ rows=await todas('custo_vigencia_mv','vig_km,placa,unidade,projeto,tipo,taxa_km,km_vig,custo_vig,litros,valor_diesel,abastecimentos,modelo'); }
  let n=0;
  rows.forEach(r=>{ const vig=vigKey(r.vig_km); if(!vig||!r.placa||r.previa) return;
    const L=linha(mapa,r.placa,r.unidade||'—',vig); L.tipo=r.tipo; L.cod=r.unidade||null; const v=L.v;
    if(r.km_vig>0) v.km_mes=+r.km_vig;
    const custo=r.valor_vw!=null?+r.valor_vw:(r.custo_vig!=null?+r.custo_vig:null);
    if(fin(custo)&&custo>0) v.custo_mes=custo;
    if(r.tipo!=='fixo'&&fin(custo)&&custo>0&&r.km_vig>0) v.rskm=custo/r.km_vig;
    if(r.taxa_km>0) v.taxa_km=+r.taxa_km;
    if(r.faixas_vw!=null) v.faixas=+r.faixas_vw;
    if(r.litros>0){ v.litros=+r.litros; if(r.km_vig>0) v.km_l=r.km_vig/r.litros; if(r.valor_diesel>0) v.preco_l=r.valor_diesel/r.litros; }
    if(r.abastecimentos>0) v.abast=+r.abastecimentos;
    n++; });
  fonte('Contrato de manutenção (custo_vigencia_mv)','placa',n?'ok':'vazio',n);
  // idade pela base Ativos do Ginfo
  try{
    const {data:g}=await SB.from('ginfo_snapshot').select('data').eq('chave','ativos').maybeSingle();
    const ano={}; ((g&&g.data)||[]).forEach(a=>{ const p=NK(a['Placa']).replace(/[^A-Z0-9]/g,''); const y=+a['Ano Fabricação']; if(p&&y>1980) ano[p]=y; });
    let k=0; Object.values(mapa).forEach(L=>{ const y=ano[NK(L.ent).replace(/[^A-Z0-9]/g,'')]; if(y){ L.v.idade=(+L.vig.slice(0,4)+(+L.vig.slice(5,7)-1)/12)-y; k++; } });
    fonte('Ativos (Ginfo) → idade','placa',k?'ok':'vazio',k);
  }catch(e){ fonte('Ativos (Ginfo) → idade','placa','erro',0,e.message); }
  // dias indisponível no mês (eventos do app)
  try{
    const ev=await todas('indisponibilidade','placa,data_parada,data_retorno,unidade');
    const dias={}; const hoje=new Date();
    ev.forEach(e=>{ if(!e.placa||!e.data_parada) return; const p=NK(e.placa).replace(/[^A-Z0-9]/g,'');
      const ini=new Date(e.data_parada+'T12:00:00'), fim=e.data_retorno?new Date(e.data_retorno+'T12:00:00'):hoje;
      for(let d=new Date(ini);d<=fim;d.setDate(d.getDate()+1)){ const k=p+'|'+d.getFullYear()+'-'+d2(d.getMonth()+1); dias[k]=(dias[k]||0)+1; } });
    const unisApp=new Set(ev.map(e=>e.unidade)); let k=0;
    Object.values(mapa).forEach(L=>{ if(!unisApp.has(L.uni)) return; const d=dias[NK(L.ent).replace(/[^A-Z0-9]/g,'')+'|'+L.vig]||0; L.v.dias_indisp=d; k++; });
    fonte('Indisponibilidade (eventos) → dias parado','placa',k?'ok':'vazio',k);
  }catch(e){ fonte('Indisponibilidade (eventos) → dias parado','placa','erro',0,e.message); }
}
/* ── grão MOTORISTA: ce_scores_mensais ── */
async function loadMot(mapa){
  const rows=await todas('ce_scores_mensais','competencia,chave,motorista,unidade,km,dias,rpm_pontos,idle_pontos,acel_pontos,vel_pontos,pontuacao,viagens,vel_excessos,litros,km_litros');
  let n=0;
  rows.forEach(r=>{ const vig=vigKey(r.competencia); if(!vig||!r.chave) return; if(/^(teste|semlogin):/.test(r.chave)) return;
    const L=linha(mapa,r.chave,r.unidade||'—',vig); L.nome=r.motorista; L.cod=uniCodCE(r.unidade); const v=L.v;
    if(fin(+r.pontuacao)&&r.pontuacao!=null) v.nota=+r.pontuacao;
    if(r.rpm_pontos!=null) v.rpm=+r.rpm_pontos; if(r.idle_pontos!=null) v.idle=+r.idle_pontos; if(r.acel_pontos!=null) v.acel=+r.acel_pontos; if(r.vel_pontos!=null) v.vel=+r.vel_pontos;
    if(r.km>0) v.km=+r.km; if(r.dias>0) v.dias=+r.dias; if(r.viagens>0) v.viagens=+r.viagens;
    if(r.km>0&&r.vel_excessos!=null) v.excessos=r.vel_excessos/r.km*100;
    if(r.litros>0){ v.litros=+r.litros; if(r.km_litros>0) v.km_l=r.km_litros/r.litros; }
    n++; });
  fonte('Condução Econômica (ce_scores_mensais)','mot',n?'ok':'vazio',n);
}

async function carregar(sb){
  SB=sb;
  FONTES=[];
  const mU={}, mP={}, mM={};
  const passos=[
    ['DRE · aba Frota','uni',()=>loadDRE(mU)], ['DRE · aba Receita Líquida','uni',()=>loadReceita(mU)], ['Dispersão de km','uni',()=>loadDispKm(mU)], ['Frota de Elite / Gerot (elite_snapshot)','uni',()=>loadGerot(mU)],
    ['Indisponibilidade (disp_resumo)','uni',()=>loadDispApp(mU)],
    ['Contrato de manutenção (custo_vigencia_mv)','placa',()=>loadPlaca(mP)], ['Condução Econômica (ce_scores_mensais)','mot',()=>loadMot(mM)],
  ];
  const res=await Promise.allSettled(passos.map(p=>p[2]()));
  res.forEach((r,i)=>{ if(r.status==='rejected'){ console.error(passos[i][0],r.reason); fonte(passos[i][0],passos[i][1],'erro',0,String((r.reason&&r.reason.message)||r.reason)); } });
  derivaUni(mU);
  return {FATO:{uni:Object.values(mU),placa:Object.values(mP),mot:Object.values(mM)},FONTES:FONTES.slice()};
}
/* uma linha por ENTIDADE (média dos meses do recorte em cada variável) — é o ponto do quadrante */
function porEntidade(rows){
  const m={};
  rows.forEach(r=>{ const e=m[r.ent]||(m[r.ent]={ent:r.ent,uni:r.uni,cod:r.cod,nome:r.nome,tipo:r.tipo,vigs:new Set(),s:{},k:{}});
    e.vigs.add(r.vig); if(r.nome) e.nome=r.nome;
    Object.entries(r.v).forEach(([id,x])=>{ if(!fin(x)) return; e.s[id]=(e.s[id]||0)+x; e.k[id]=(e.k[id]||0)+1; }); });
  return Object.values(m).map(e=>{ const v={}; Object.keys(e.s).forEach(id=>{ v[id]=e.s[id]/e.k[id]; }); return {ent:e.ent,uni:e.uni,cod:e.cod,nome:e.nome,tipo:e.tipo,meses:e.vigs.size,v}; });
}
/* par TRIVIAL: as duas variáveis saem da mesma conta (rem × real, custo total × combustível,
   desvio × o próprio custo, R$/km × km…) — a ligação é automática, não é achado
   (Renan, 23/09/2026: "Não faz sentido correlacionar remunerado com realizado") */
const trivial=(vx,vy)=>!!(vx&&vy&&vx.id!==vy.id&&(vx.b||[]).some(b=>(vy.b||[]).includes(b)));
global.CorrDados={VARS,FMT,varDe,fmtVar,vigKey,vigRot,vigIdx,CIDADE2COD,comTier,uniCodCE,carregar,porEntidade,trivial,NK};
})(typeof window!=='undefined'?window:globalThis);
