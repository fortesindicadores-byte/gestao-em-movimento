/* ══════════════════════════════════════════════════════════════════════════
   ÁRVORE DO CUSTO (Renan, 21/11/2026)
   "A árvore do ROIC eu acho que pode aumentar… começando pelo custo total frota,
   abrindo pros pacotes, pacotes pras contas, contas pra R$/km em km" → proposta
   em PDF → "Existe uma lógica bem desenhada do combustível, na árvore do
   combustível. Essa lógica pode ser base. Manutenção… SLA, Conformidade, OS
   Vencidas etc" → decisões: (1) referência padrão = remunerado da DRE, com o FT
   sempre ao lado; (2) lavação, carroceria e materiais = contas mistas; (3) a
   Árvore do ROIC fica como está e o custo vira esta visão; (4) todas as fases.

   Custo total → pacote → conta → quadrante:
     · variável  = Km (volume) + R$/km (taxa)        ▲ = os dois somados
     · fixa      = Ativos (volume) + R$/ativo (taxa)
     · mista     = as duas leituras do mesmo ▲ (cada uma fecha sozinha)
   Combustíveis (diesel) = a lógica da Árvore de Combustível: km com o balanço de
   massa, R$/km → R$/L (preço) · Km/L (eficiência) · diferença DRE × bases, pela
   mesma ponte (assets/arvore-impacto.js). Manutenção: pago pelo FT × gasto na
   Carta, e os indicadores do Gerot/Ginfo por família, com a ligação de cada um
   com o desvio nas unidades (sinal, não soma). Clicar num nó abre ou recolhe;
   o ícone de tabela abre por unidade, projeto e mês.

   Este arquivo usa as globais do index.html (sb, KM, FR, FRC, CAP, agKm…).
   ══════════════════════════════════════════════════════════════════════════ */

/* ── estado ── */
let CT_CMP=(()=>{ try{ const v=localStorage.getItem('arvores_ct_cmp'); return v==='orc'||v==='ft'?v:'rem'; }catch(e){ return 'rem'; } })();
let CT_ROIC=(()=>{ try{ return localStorage.getItem('arvores_ct_roic')==='1'; }catch(e){ return false; } })();
// o que está aberto vale só enquanto a página está aberta: entrar de novo começa do custo total com os pacotes
// (Renan, 21/11/2026: "Deve sempre voltar do início, ou ter um expandir e recolher tudo")
const CT_AB=new Set(['tot']); let CT_TUDO=false;
try{ localStorage.removeItem('arvores_ct_abertos'); }catch(e){}
const ctGuardaAb=()=>{};
const CT={cons:null,rsl:null,ft:null,ger:null,carta:null,anom:null,ce:null,bm:null,api:{}};
const CT_P={}, CT_ERR={};
let CT_BM={}, CT_BM_INI=null, CT_CTX=null, _ctRedes=null;
const CT_REF_ROT=()=>CT_CMP==='orc'?'Orç.':CT_CMP==='ft'?'FT':'Rem.';
const CT_REF_NOME=()=>CT_CMP==='orc'?'orçado':CT_CMP==='ft'?'pago do FT':'remunerado';

/* ── contas da aba Frota do DRE e o quadrante de cada uma ──
   q: comb (diesel, com a ponte do combustível) · var · manut · pneu · mis (mista) · fix · imp (imposto, sem abertura)
   ft: campos do ft_rem_mes que pagam a conta (o "FT pago" reconstruído) */
const CT_CTA=[
  {id:'COMB',nome:'Combustíveis (diesel)',pac:'C',q:'comb',ft:['comb'],fc:['COMB','ARLA'],rotFt:'Real com o Arla − FT',al:['COMBUSTIVEIS VEICULOS E EQUIPAMENTOS','COMBUSTIVEIS']},
  {id:'ARLA',nome:'Arla',pac:'C',q:'var',al:['FLUIDOS (ARLA)','ARLA']},
  {id:'MANV',nome:'Manutenção de veículos',pac:'M',q:'manut',ft:['manut'],fc:['MANV','CONT'],rotFt:'Real com o contrato − FT',al:['MANUTENCAO DE VEICULOS E EQUIPAMENTOS','MANUTENCAO DE VEICULOS E EQUIP.','MANUTENCAO DE VEICULOS']},
  {id:'CONT',nome:'Contratos do fabricante',pac:'M',q:'mis',al:['CONTRATOS DE MANUTENCAO FABRICANTE']},
  {id:'CARR',nome:'Manutenção de carrocerias',pac:'M',q:'mis',ft:['carroc'],al:['MANUTENCAO DE CARROCERIAS']},
  {id:'LAV',nome:'Lavação',pac:'M',q:'mis',ft:['lavagem_var','lavagem'],al:['LAVACAO DE VEICULOS']},
  {id:'MAT',nome:'Materiais de oficina',pac:'M',q:'mis',al:['MATERIAIS E FERRAMENTAS DE OFICINA']},
  {id:'PERS',nome:'Personalização',pac:'M',q:'fix',al:['PERSONALIZACAO/PADRONIZACAO DE VEICULOS','PERSONALIZACAO/PADRONIZACAO','PERSONALIZACAO E PADRONIZACAO DE VEICULOS']},
  {id:'PNEU',nome:'Pneus novos',pac:'P',q:'pneu',al:['PNEUS NOVOS','PNEUS E CAMARAS']},
  {id:'RECAP',nome:'Recapagens',pac:'P',q:'pneu',al:['RECAPAGENS E OUTROS SERVICOS','CONSERTOS E RECAPAGENS DE PNEUS']},
];
const CT_PAC_FT={C:['comb'],M:['manut','carroc','lavagem_var','lavagem'],P:['pneu'],O:['seguro','ipva']};
const CT_ALIAS={}; CT_CTA.forEach(c=>c.al.forEach(a=>{ CT_ALIAS[a]=c.id; }));
/* id da conta: as conhecidas pelo apelido; as outras pelo próprio nome (vão para "Demais contas") */
function ctId(nome){ const n=nu(nome); return CT_ALIAS[n]||'X:'+n; }
function ctDef(id){ const c=CT_CTA.find(x=>x.id===id); if(c) return c;
  const n=id.slice(2), imp=/ICMS|ESTORNO/.test(n), ftC=/IPVA|LICENCIAMENTO/.test(n)?['ipva']:/SEGURO/.test(n)?['seguro']:null;
  return {id,nome:CT_NOMES[id]||n,pac:PAC_FR[n]||'O',q:imp?'imp':'fix',ft:ftC}; }
const CT_NOMES={};

/* ── leituras (cada uma na sua vez; a árvore se redesenha quando cada uma chega) ── */
let _ctRe=null; function ctRedesenha(){ clearTimeout(_ctRe); _ctRe=setTimeout(()=>{ if(VW==='custo') renderCusto(); },60); }
function ctCarga(nome,fn){
  if(CT_P[nome]) return CT_P[nome];
  CT_P[nome]=fn().then(v=>{ CT[nome]=v; delete CT_ERR[nome]; ctRedesenha(); return v; })
    .catch(e=>{ console.warn('Árvore do Custo · '+nome+' indisponível:',e); CT_ERR[nome]=(e&&e.message)||String(e); ctRedesenha(); return null; });
  return CT_P[nome];
}
const ctVig=s=>{ s=String(s||''); let m=s.match(/^(\d{4})-(\d{2})/); if(m) return m[1]+'-'+m[2]; m=s.match(/^(\d{1,2})\/(\d{4})$/); if(m) return m[2]+'-'+m[1].padStart(2,'0');
  m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0'); return ''; };
const ctBR=v=>v.slice(5,7)+'/'+v.slice(0,4);
const ctNf=s=>{ let x=String(s||''); const i=x.indexOf(':'); if(i>=0) x=x.slice(i+1); return nu(x); };
const CTA_ALIAS_BM={'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS':'COMBUSTIVEIS','FLUIDOS (ARLA)':'ARLA',
  'PERSONALIZACAO/PADRONIZACAO DE VEICULOS':'PERSONALIZACAO/PADRONIZACAO','PERSONALIZACAO E PADRONIZACAO DE VEICULOS':'PERSONALIZACAO/PADRONIZACAO',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS':'MANUTENCAO DE VEICULOS E EQUIP.','CONSERTOS E RECAPAGENS DE PNEUS':'RECAPAGENS E OUTROS SERVICOS','PNEUS E CAMARAS':'PNEUS NOVOS'};
const ctaNK=c=>{ const n=nu(c); return CTA_ALIAS_BM[n]||n; };

/* consumo (aba Km/L do ERP: placa × mês) — a mesma base da Árvore de Combustível e do painel Km/L */
const ctLeCons=()=>ctCarga('cons',async()=>{
  const t=await tabDre('consumo_km_litro');
  const rows=await todas(sb.from(t).select('vigencia,projeto,placa,modelo,tipo_combustivel,km_rodado_horas_trabalhadas,qtd_total_de_litros,totas_rs,km_l_rem_medio,km_l_rem_modelo').gte('vigencia_orig','2025-01-01'));
  const out=[]; rows.forEach(r=>{ const ou=opUni(r.projeto), vig=ctVig(r.vigencia); if(!ou||!vig) return;
    out.push({vig,op:ou.op,uni:ou.uni,n3:nu(r.projeto),placa:String(r.placa||'').toUpperCase(),modelo:r.modelo||'',fuel:ctNf(r.tipo_combustivel),
      km:+r.km_rodado_horas_trabalhadas||0,lit:+r.qtd_total_de_litros||0,tot:+r.totas_rs||0,remMed:+r.km_l_rem_medio||0,remMod:+r.km_l_rem_modelo||0}); });
  if(!out.length) throw new Error('a aba Km/L veio vazia');
  return out; });
/* R$/L remunerado (aba R$/L = Combustível do FT): preço da operadora e ANP por projeto × mês × combustível */
const ctLeRsl=()=>ctCarga('rsl',async()=>{
  const t=await tabDre('consumo_rs_litro');
  const rows=await todas(sb.from(t).select('unidade_benner,vigencia_data,vigencia_data_3,precooperadora,precoanp,tipocombustivelshared'));
  const L1=new Map(), L2=new Map(), A1=new Map(), A2=new Map();
  const add=(M,k,v)=>{ if(!(v>0)) return; const e=M.get(k)||{s:0,n:0}; e.s+=v; e.n++; M.set(k,e); };
  rows.forEach(r=>{ const p=nu(r.unidade_benner); const ym=ctVig(r.vigencia_data_3)||ctVig(r.vigencia_data); if(!p||!ym) return; const fu=ctNf(r.tipocombustivelshared);
    add(L1,p+'|'+ym+'|'+fu,+r.precooperadora); add(L2,p+'|'+ym,+r.precooperadora); add(A1,p+'|'+ym+'|'+fu,+r.precoanp); add(A2,p+'|'+ym,+r.precoanp); });
  return {L1,L2,A1,A2}; });
function ctPreco(M1,M2,r){ if(!M1) return null; const vr=n3=>{ let e=M1.get(n3+'|'+r.vig+'|'+r.fuel)||M2.get(n3+'|'+r.vig); return e&&e.n?e.s/e.n:null; };
  let p=vr(r.n3); if(p==null){ const m=r.n3.match(/^(?:ROTA \(VAN\)|VAN)\s*-\s*(.+)$/); if(m) p=vr('ROTA - '+m[1]); } return p; }
/* FT por mês (ft_rem_mes, montado do Freightech pelo robô): o pago de cada componente no km do FT */
const CT_FTOP={ROTA:'ROTA',UDC:'ROTA',VAN:'VAN',AS:'AS','AUTO SERVICO':'AS',EMPURRADA:'EMP',INSUMOS:'INS',ARMAZEM:'ARM'};
const ctLeFT=()=>ctCarga('ft',async()=>{
  const rows=await todas(sb.from('ft_rem_mes').select('*').gte('vigencia','2025-01'));
  const o={}; rows.forEach(r=>{ let op=CT_FTOP[nu(r.operacao)]; let u=nu(r.unidade); if(u==='GOI') u='GNA'; if(!op||!UNIS.includes(u)) return; if(op==='AS'&&u==='PLT') op='ROTA';
    const k=r.vigencia+'|'+op+'|'+u, x=o[k]=o[k]||{km:0};
    ['comb','manut','carroc','pneu','lavagem_var','lavagem','seguro','ipva','ativos','parados'].forEach(c=>{ x[c]=(x[c]||0)+(+r[c]||0); }); x.km+=+r.km_teto||0; });
  if(!Object.keys(o).length) throw new Error('ft_rem_mes vazia');
  return o; });
/* indicadores do Frota de Elite / Gerot (assets/gerot-base.js) */
const CT_IND={
  disp:{t:'Disponibilidade',fmt:'pct',dir:'higher'},prev:{t:'Preventivas · aderência',fmt:'pct',dir:'higher'},conf:{t:'Conformidade (preditiva)',fmt:'pct',dir:'higher'},
  checkT:{t:'Checklist T1 · T2',fmt:'pct',dir:'higher'},checkWH:{t:'Checklist WH',fmt:'pct',dir:'higher'},stVeic:{t:'Stress test veículos',fmt:'pct',dir:'higher'},
  stEmp:{t:'Stress test empilhadeiras',fmt:'pct',dir:'higher'},civf:{t:'CIVF',fmt:'pct',dir:'higher'},sla:{t:'SLA de manutenção',fmt:'pct',dir:'higher'},
  pneus:{t:'Aferição de pneus',fmt:'pct',dir:'higher'},mttr:{t:'MTTR',fmt:'time',dir:'lower'},mtbf:{t:'MTBF',fmt:'time',dir:'higher'},
  osVenc:{t:'OS vencida',fmt:'count',dir:'lower'},osCritica:{t:'Saída com OS crítica',fmt:'count',dir:'lower'},blitz:{t:'Blitz de segurança',fmt:'pct',dir:'higher'},
  pneuAmp:{t:'Amplitude dos pneus',fmt:'mm',dir:'lower'},pneuCalib:{t:'Calibragem OK',fmt:'pct',dir:'higher'}};
function ctOpsDoCod(cod){ const s=cod.split(' ')[0], tier=cod.slice(s.length).trim();
  if(tier==='T1') return ['EMP','INS']; if(tier==='T1 WH') return ['ARM']; if(s==='PIR') return ['EMP','INS']; return ['ROTA','VAN','AS']; }
const ctLeGer=()=>ctCarga('ger',async()=>{
  if(!window.GerotBase) throw new Error('assets/gerot-base.js não carregou');
  const recs=await GerotBase.load(), F=GerotBase.FIL2COD||{}, out=[];
  recs.forEach(r=>{ if(!CT_IND[r.field]||r.snapshot) return; const cod=F[nu(r.unit)]||F[r.unit]; if(!cod) return; const vig=ctVig(r.vig); if(!vig) return;
    const real=+r.real; if(!isFinite(real)) return;
    out.push({field:r.field,uni:cod.split(' ')[0],ops:ctOpsDoCod(cod),vig,real,meta:r.meta!=null&&isFinite(+r.meta)?+r.meta:null}); });
  return out; });
/* Carta de Custos: os lançamentos (grupo, placa, fornecedor, RC/OC/NF) */
const CT_CARTA_UNI=['BLC','CBA T1','CBA T1 WH','CBA T2','CGR','FLP','GNA','GRL','MCC T1','MCC T2','NFR','PIR','PLT','RON'];
const ctLeCarta=()=>ctCarga('carta',async()=>{
  if(!window.CartaCalc) throw new Error('assets/carta-calc.js não carregou');
  const vigs=VIGS.filter(v=>v>='2026-01');
  const r=await CartaCalc.lerLancamentos(sb,CT_CARTA_UNI,vigs); if(r.erro) throw r.erro;
  return r.data.map(l=>{ const s=String(l.unidade||'').split(' ')[0]; const ou=l.projeto?opUni(l.projeto+' - '+s):null;
    return {vig:l.vigencia,uni:s,op:ou?ou.op:null,cta:ctId(l.conta),grupo:l.grupo||'(sem grupo)',placa:String(l.equipamento||'').toUpperCase(),forn:l.fornecedor||'(sem fornecedor)',
      valor:+l.valor||0,nf:!!String(l.nf||'').trim(),rc:!!String(l.rc||'').trim(),oc:!!String(l.oc||'').trim(),robo:!!l.origem}; }); });
/* anomalias de combustível (placa × mês) */
const ctLeAnom=()=>ctCarga('anom',async()=>{
  const rows=await todas(sb.from('comb_anomalia').select('ym,unidade,projeto,situacao,impacto_rs,impacto_l'));
  return rows.map(r=>{ const ou=opUni(r.projeto); let u=ou?ou.uni:nu(r.unidade); return {vig:r.ym,op:ou?ou.op:null,uni:u,sit:r.situacao||'erro',rs:+r.impacto_rs||0,l:+r.impacto_l||0}; }); });
/* DriverPro: nota mensal por motorista (só onde há telemetria com motorista) */
const CT_CE_UNI={PIRAI:'PIR',MACACU:'MCC',CUIABA:'CBA'};
const ctLeCe=()=>ctCarga('ce',async()=>{
  const rows=await todas(sb.from('ce_scores_mensais').select('competencia,unidade,km,pontuacao').gte('competencia','2025-01-01'));
  return rows.map(r=>{ const u=nu(r.unidade); const m=u.match(/^(EMP|INS)\s+(?:LATA\s+)?(.+)$/); const uni=m?CT_CE_UNI[m[2]]:null;
    return uni?{vig:String(r.competencia).slice(0,7),uni,op:m[1]==='INS'?'INS':'EMP',km:+r.km||0,nota:+r.pontuacao}:null; }).filter(x=>x&&isFinite(x.nota)); });
/* abastecimentos das APIs (Pró-Frotas, Gasola, SUMA) do mês */
function ctLeApi(vig){ const k='api:'+vig; if(CT_P[k]) return CT_P[k];
  const [a,m]=vig.split('-').map(Number), fim=m===12?(a+1)+'-01-01':a+'-'+String(m+1).padStart(2,'0')+'-01';
  CT_P[k]=todas(sb.from('abast_api').select('sistema,unidade,produto,litros,valor').eq('valido',true).gte('dia',vig+'-01').lt('dia',fim))
    .then(rows=>{ CT.api[vig]=rows.filter(r=>/^DIESEL/.test(nu(r.produto))); ctRedesenha(); return CT.api[vig]; })
    .catch(e=>{ console.warn('abast_api indisponível:',e); CT_ERR.api=(e&&e.message)||String(e); CT.api[vig]=null; return null; });
  return CT_P[k]; }
/* balanço de massa: a MESMA conta da Árvore de Combustível e do Painel KM (assets/balanco-massa.js), conta a conta,
   rateada no ano pela diferença do mês. O km recomposto volta ao km remunerado das Empurradas. */
const ctLeBM=()=>ctCarga('bm',async()=>{
  const rows=await todas(sb.from('balanco_massa').select('unidade,projeto,vigencia,conta,valor'));
  if(!rows.length) throw new Error('a tabela balanco_massa veio vazia (login do hub vencido?)');
  const bal={}; rows.forEach(x=>{ const v=ctVig(x.vigencia); if(!v) return; const k=ctBR(v)+'|'+nu(x.projeto)+' - '+nu(x.unidade), c=ctaNK(x.conta);
    (bal[k]=bal[k]||{})[c]=(bal[k][c]||0)+(+x.valor||0); });
  return bal; });
function ctRecompoe(){ try{ ctRecompoe0(); }catch(e){ console.warn('Árvore do Custo: balanço de massa não recomposto',e); CT_BM={}; CT_ERR.bm=(e&&e.message)||String(e); } }
function ctRecompoe0(){
  CT_BM={}; const B=window.BalancoMassa, bal=CT.bm; if(!B||!bal||!KM) return;
  const ini=B.inicioDoBanco(bal,'08/2026'); CT_BM_INI=ini;
  const km0={}, kmRe={}, remCta={};
  KM.forEach(r=>{ if(r.op!=='EMP'&&r.op!=='INS') return; const k=ctBR(r.vig)+'|EMPURRADA - '+r.uni; km0[k]=(km0[k]||0)+r.rem; kmRe[k]=(kmRe[k]||0)+r.real; });
  Object.entries(FRN).forEach(([k,o])=>{ const [vig,n3]=k.split('|'); if(!/^EMPURRADA - /.test(n3)) return; const kk=ctBR(vig)+'|'+n3;
    Object.entries(o).forEach(([c,x])=>{ const cc=ctaNK(c); (remCta[kk]=remCta[kk]||{})[cc]=(remCta[kk][cc]||0)+x.rem; }); });
  const novC=B.comRealizado(bal,kmRe), nov=B.recompoe({bal:novC.bal,remCta,km0,inicio:ini}), anu=B.porAno([nov.porChave],km0,kmRe);
  Object.entries(anu.porChave||{}).forEach(([k,e])=>{ const i=k.indexOf('|'); const v=ctVig(k.slice(0,i)), u=k.slice(i+1).split(' - ').pop(); if(!v) return;
    const kk=v+'|'+u, o=CT_BM[kk]=CT_BM[kk]||{km:0,valor:0}; o.km+=+e.km||0; o.valor+=+e.valor||0; });
}

/* ── contas de um recorte ── */
const ctRf=()=>CT_CMP==='orc'?'orc':'rem';
/* custo das contas num recorte (vigências × filtro): real, ref (rem/orç) e o FT pago reconstruído */
function ctCusto(vigs,filtro,ids){
  const S={real:0,rem:0,orc:0}, rf=ctRf();
  Object.entries(FRC).forEach(([k,o])=>{ const [v,op,u]=k.split('|'); if(!vigs.includes(v)||!filtro(op,u)) return;
    Object.entries(o).forEach(([c,x])=>{ if(ids&&!ids.includes(c)) return; S.real+=x.real; S.rem+=x.rem; S.orc+=x.orc; }); });
  S.ref=S[rf]; return S; }
/* km remunerado da chave (com o balanço de massa nas Empurradas) */
function ctKmChave(v,op,u){ let km=0; (KM||[]).forEach(r=>{ if(r.vig===v&&r.op===op&&r.uni===u) km+=r.rem; }); if(op==='EMP'){ const b=CT_BM[v+'|'+u]; if(b) km+=b.km; } return km; }
/* FT pago reconstruído: R$/km do FT (componente ÷ km do FT) × km remunerado da Dispersão; sem km (Armazém, fixo) = o próprio componente */
const CT_FT_VAR=['comb','manut','carroc','pneu','lavagem_var'];   // variáveis por km; o resto é fixo do mês
function ctFT(vigs,filtro,campos){
  if(!CT.ft||!campos||!campos.length) return null; let s=0, tem=false;
  Object.entries(CT.ft).forEach(([k,x])=>{ const [v,op,u]=k.split('|'); if(!vigs.includes(v)||!filtro(op,u)) return;
    const cv=campos.filter(f=>CT_FT_VAR.includes(f)).reduce((a,f)=>a+(x[f]||0),0), cf=campos.filter(f=>!CT_FT_VAR.includes(f)).reduce((a,f)=>a+(x[f]||0),0);
    if(!cv&&!cf) return; tem=true;
    const kmR=cv?ctKmChave(v,op,u):0;
    s+=(cv&&x.km>0&&kmR>0?cv/x.km*kmR:cv)+cf; });
  return tem?s:null; }
/* a referência da comparação: remunerado, orçado ou o FT */
function ctRef(C,ft){ return CT_CMP==='ft'?ft:C.ref; }

/* volume × taxa em km: as linhas da Dispersão do recorte, o custo das contas nas mesmas chaves.
   A aba Frota do DRE lança o custo da Van dentro de "ROTA - X": sem custo próprio, Rota e Van
   dividem o custo da Rota na proporção do km remunerado. Nos meses da aba, Insumos fica dentro da Empurrada. */
function ctKm(vigs,filtro,ids){
  if(!KM) return null; const rf=ctRf();
  const L=KM.filter(r=>vigs.includes(r.vig)&&filtro(r.op,r.uni)); if(!L.length) return null;
  const temIns=new Set(KM.filter(r=>r.op==='INS').map(r=>r.vig+'|'+r.uni)), ch=new Set();
  const K={rem:0,real:0,bm:0,bmV:0,viag:0,frota:0,cReal:0,cRef:0,cRem:0,L};
  L.forEach(r=>{ K.rem+=r.rem; K.real+=r.real; K.viag+=r.vPrim+r.vRec+r.vNot; K.frota+=r.frota; ch.add(r.vig+'|'+r.op+'|'+r.uni); });
  const vu=new Set(); ch.forEach(k=>{ const [v,op,u]=k.split('|'); if(op==='EMP'&&!vu.has(v+u)){ vu.add(v+u); const b=CT_BM[v+'|'+u]; if(b){ K.bm+=b.km; K.bmV+=b.valor; } } });
  K.rem+=K.bm;
  const custo=k=>{ const o=FRC[k]; let real=0,ref=0,rem=0; if(o) Object.entries(o).forEach(([c,x])=>{ if(ids&&!ids.includes(c)) return; real+=x.real; ref+=x[rf]; rem+=x.rem; }); return {real,ref,rem}; };
  const kmDe=(v,op,u)=>KM.filter(r=>r.vig===v&&r.op===op&&r.uni===u).reduce((a,r)=>a+r.rem,0);
  const soma=(c,f)=>{ K.cReal+=c.real*f; K.cRef+=c.ref*f; K.cRem+=c.rem*f; };
  const feito=new Set();
  ch.forEach(k=>{ const [v,op,u]=k.split('|');
    if(op==='ROTA'||op==='VAN'){ const cv=custo(v+'|VAN|'+u);
      if(cv.real||cv.ref){ soma(custo(k),1); return; }               // Van com custo próprio
      if(feito.has(v+'|RV|'+u)) return; feito.add(v+'|RV|'+u);
      const kr=kmDe(v,'ROTA',u), kv=kmDe(v,'VAN',u), tot=kr+kv, cr=custo(v+'|ROTA|'+u); if(!tot){ soma(cr,op==='ROTA'?1:0); return; }
      const f=(ch.has(v+'|ROTA|'+u)?kr:0)/tot+(ch.has(v+'|VAN|'+u)?kv:0)/tot; soma(cr,f); return; }
    soma(custo(k),1); if(op==='EMP'&&!temIns.has(v+'|'+u)) soma(custo(v+'|INS|'+u),1); });
  return K.rem>0&&K.real>0?K:null; }
/* ativos do FT no recorte (média dos meses): equipamentos, operando e parados */
function ctAtivos(vigs,filtro){ let at=0,op=0,par=0,idade=0,n=0; const nv=vigs.length;
  vigs.forEach(v=>(CAP[v]||[]).forEach(e=>{ if(!filtro(e.op,e.uni)) return; at+=1/nv; if(e.ativo) op+=1/nv; else par+=1/nv; idade+=e.meses; n++; }));
  return {at,op,par,idade:n?idade/n:null}; }

/* ── formatos ── */
const fR2=v=>v==null||!isFinite(v)?'—':'R$ '+br(v,2), fR3=v=>v==null||!isFinite(v)?'—':'R$ '+br(v,3);
function ctFmtInd(f){ return f==='pct'?(v=>v==null||!isFinite(v)?'—':br(v,1)+'%'):f==='time'?(v=>v==null||!isFinite(v)?'—':br(v/3600,1)+' h'):f==='mm'?(v=>v==null||!isFinite(v)?'—':br(v,1)+' mm'):(v=>v==null||!isFinite(v)?'—':br(v,1)); }
/* linhas do FT no nó: o pago e a diferença */
function ctFtRows(ft,real,n,rot){ if(ft==null||!isFinite(ft)) return [];
  const d=(real-ft)/n; return [['Pago FT (reconstr.)',fmtR(ft/n)],[rot||'Real − FT',fmtSig(fmtR,d),corV(d,false)]]; }
/* gap de custo (menos é melhor): o impacto é o ▲ com o sinal trocado */
function ctGapCusto(ref,real,n,R){ if(ref==null) return {ref:null,real:real/n,bom:false,rot:CT_REF_ROT()};
  const imp=-(real-ref)/n; return {ref:ref/n,real:real/n,bom:false,rot:CT_REF_ROT(),imp,pp:R&&R.cap?imp*(1-IR)*12/R.cap:null}; }

/* ── nó: id único, clique abre/recolhe; o ícone de tabela abre por unidade, projeto e mês ── */
function ctNo(o,kidsFn){
  o.ab=o.ab||(kidsFn||o.abv?'x':null); o.kl=((o.kl||'')+' ctx').trim();
  const tab=o.abv?`<span class="tn-tab" title="Abrir por unidade, projeto e mês">⊞</span>`:'';
  if(kidsFn){ if(CT_TUDO) CT_AB.add(o.id); const on=CT_AB.has(o.id); o.temKids=true; o.tag=`<span class="tn-x">${on?'−':'+'}</span>`+tab; if(on){ o.kids=kidsFn().filter(Boolean); if(!o.kids.length) delete o.kids; } }
  else o.tag=tab;
  return o; }

/* ═════ galho do km (composição: Dispersão de km, a mesma conta da Árvore de Km) ═════ */
function ctKmKids(px,vigs,filtro,K){
  const F=KM.filter(r=>vigs.includes(r.vig)&&filtro(r.op,r.uni)); if(!F.length) return [];
  const rev=CT_CTX&&CT_CTX.rev||{}, S=agKm(F,rev), n=S.n;
  const prim=ctNo({id:px+'|prim',t:'1ª viagem',v:fmtKm(S.kmPrim),s:'mapas × km por mapa do FT',rows:[['Mapas rodados',fmtN(S.vPrim)],['Km por mapa',S.vPrim?br(S.kmPrim/S.vPrim,1):'—'],['Mapas por ativo no mês',r1(dv(S.vPrim,S.frota))]]},()=>[
    {id:px+'|teto',t:'Teto da 1ª viagem (T2)',v:fmtKm(S.tetoT2),s:`${MAPAS_MES} mapas × ativos × km por mapa`,g:{rot:'Teto',ref:S.tetoT2,real:S.kmPrimT2,bom:true,pot:true,fmt:fmtKmC,cols:['real','d','p'],imp:S.impNao/n,potRot:'Variável não recebido:'},rows:[['Ativos (média)',fmtN(S.frotaT2/n)],['Mapas possíveis',fmtN(S.possT2)]]},
    {id:px+'|nao',t:'Mapas que não rodaram (T2)',v:fmtKm(-S.kmNaoT2),cls:S.kmNaoT2>0?'cr':'',s:'possíveis − rodados, ao km por mapa',rows:[['Mapas',fmtN(S.naoT2)],['% dos possíveis',fmtP(S.possT2?S.naoT2/S.possT2:null)],['Por ativo no mês',r1(dv(S.naoT2,S.frotaT2))]]},
    {id:px+'|revi',t:'Revisão do km por mapa (T2)',v:S.mapRev?(S.revKm>=0?'+':'')+fmtKm(S.revKm):'—',cls:corV(S.revKm,true),s:'2ªQ − 1ªQ, sobre os mapas da 2ª quinzena',
      g:S.mapRev?{rot:'1ªQ',ref:S.km1,real:S.km2,bom:true,fmt:fmtKmC,cols:['ref','real','p'],imp:S.impRev/n}:null,rows:[['Km por mapa 1ªQ · 2ªQ',S.mapRev?br(S.km1/S.mapRev,1)+' · '+br(S.km2/S.mapRev,1):'—']]},
    {id:px+'|ptipo',t:'Rodado da 1ª viagem',v:'falta dado',kl:'falta',s:'o hodômetro só aparece no abastecimento: sem o km rodado por tipo de viagem'}]);
  const remK=[prim,
    {id:px+'|rec',t:'Recarga',v:fmtKm(S.kmRec),rows:[['Recargas',fmtN(S.vRec)],['Km por recarga',S.vRec?br(S.kmRec/S.vRec,1):'—'],['Recargas por mapa',r2(dv(S.vRec,S.vPrim))]]},
    {id:px+'|not',t:'Noturna',v:fmtKm(S.kmNot),rows:[['Noturnas',fmtN(S.vNot)],['Km por noturna',S.vNot?br(S.kmNot/S.vNot,1):'—'],['Noturnas por mapa',r2(dv(S.vNot,S.vPrim))]]}];
  if(K&&K.bm) remK.push({id:px+'|bm',t:'Balanço de massa',v:fmtKm(K.bm),s:'viagem sem CT-e, cobrada depois (Empurradas)',rows:[['Valor no remunerado',fmtR(K.bmV/n)],['R$/km do balanço',r2(dv(K.bmV,K.bm))],['Regra',`conta a conta desde ${CT_BM_INI||'—'}, rateado no ano`]]});
  const outros=S.rem-S.kmPrim-S.kmRec-S.kmNot; if(Math.abs(outros)>Math.max(1,S.rem*0.002)) remK.push({id:px+'|out',t:'Outros no remunerado',v:fmtKm(outros),s:'o que a Dispersão soma além de 1ª, recarga e noturna'});
  return [
    ctNo({id:px+'|rem',t:'Km remunerado',v:fmtKm(S.rem+(K?K.bm:0)),s:'o que o FT paga',rows:[['Ativos (média)',fmtN(S.frota/n)],['Por ativo no mês',fmtN(dv(S.rem,S.frota))],['Viagens por ativo no mês',r1(dv(S.viag,S.frota))],['Km por viagem',r1(dv(S.rem,S.viag))]]},()=>remK),
    {id:px+'|real',t:'Km rodado',v:fmtKm(S.real),s:'hodômetro do diesel (ERP) e a Dispersão',rows:[['Por ativo no mês',fmtN(dv(S.real,S.frota))],['Por viagem',r1(dv(S.real,S.viag))],['Placas que rodaram',S.plMes?r1(S.plMes/n):'—'],['Km por placa no mês',fmtN(dv(S.plKm,S.plMes))]]}];
}

/* ═════ volume × taxa de uma conta variável ═════ */
function ctNoKm(px,vigs,filtro,ids,R,taxaKids,ftC){
  const K=ctKm(vigs,filtro,ids); if(!K) return null;
  const n=vigs.length, ref=CT_CMP==='ft'?(ftC?ctFT(vigs,filtro,ftC):null):K.cRef, rkR=ref!=null?ref/K.rem:null, rk=K.cReal/K.real, pp=v=>R&&R.cap?v*(1-IR)*12/R.cap:null;
  const iVol=rkR!=null?-(K.real-K.rem)*rkR/n:null, iPre=rkR!=null?-(rk-rkR)*K.real/n:null;
  const kmNo=ctNo({id:px+'|km',t:'Km',v:fmtKmG(K.real),s:`volume · ▲ km × R$/km ${CT_REF_ROT().toLowerCase()}`,g:{ref:K.rem,real:K.real,bom:false,fmt:fmtKmC,rot:'Km rem.',cols:['ref','d','p'],imp:iVol,pp:iVol==null?null:pp(iVol)},
    rows:[['Viagens no mês',fmtN(K.viag/n)],['Km/viagem rem. · real',r1(dv(K.rem,K.viag))+' · '+r1(dv(K.real,K.viag))],...(K.bm?[['Balanço de massa no rem.',fmtKmG(K.bm)]]:[])],
    abv:(vv,ff)=>{ const k=ctKm(vv,ff,ids); return k?{ref:k.rem,real:k.real,fmt:fmtKmC,bom:false,rotRef:'Km rem.',rotReal:'Km rodado',km:true}:null; }},()=>ctKmKids(px+'|km',vigs,filtro,K));
  const rkNo=ctNo({id:px+'|rk',t:'R$/km',v:fR3(rk),s:'custo ÷ km rodado',g:{ref:rkR,real:rk,bom:false,fmt:fR3,rot:CT_REF_ROT(),imp:iPre,pp:iPre==null?null:pp(iPre)},
    rows:[[`R$/viagem ${CT_REF_ROT().toLowerCase()} · real`,K.viag&&ref!=null?fmtR(ref/K.viag).replace('R$ ','')+' · '+fmtR(K.cReal/K.viag).replace('R$ ',''):'—'],[`R$/ativo ${CT_REF_ROT().toLowerCase()} · real`,K.frota&&ref!=null?fmtR(ref/K.frota).replace('R$ ','')+' · '+fmtR(K.cReal/K.frota).replace('R$ ',''):'—']],
    abv:(vv,ff)=>{ const k=ctKm(vv,ff,ids); if(!k) return null; const rf=CT_CMP==='ft'?(ftC?ctFT(vv,ff,ftC):null):k.cRef; return {ref:rf!=null?rf/k.rem:null,real:k.cReal/k.real,fmt:fR3,bom:false}; }},taxaKids?()=>taxaKids(K,px+'|rk'):null);
  return {K,kids:[kmNo,rkNo]}; }
/* ═════ volume × taxa de uma conta fixa: ativos × R$/ativo ═════ */
function ctNoAtivo(px,vigs,filtro,ids,ftC){
  const A=ctAtivos(vigs,filtro); if(!A.at) return null; const C=ctCusto(vigs,filtro,ids), n=vigs.length, ref=ctRef(C,ftC?ctFT(vigs,filtro,ftC):null);
  const ra=C.real/n/A.at, rr=ref!=null?ref/n/A.at:null;
  return [
    {id:px+'|at',t:'Ativos',v:fmtN(A.at),s:'equipamentos no FT (média do mês)',rows:[['Operando',fmtN(A.op)],['Parados ou inativos',fmtN(A.par)],['Idade média',A.idade==null?'—':br(A.idade/12,1)+' anos']]},
    ctNo({id:px+'|ra',t:'R$ por ativo',v:fmtR(ra),s:'custo do mês ÷ ativos',g:{ref:rr,real:ra,bom:false,fmt:fmtR,rot:CT_REF_ROT(),imp:rr!=null?-(ra-rr)*A.at:null},
      abv:(vv,ff)=>{ const a=ctAtivos(vv,ff), c=ctCusto(vv,ff,ids), r=ctRef(c,ftC?ctFT(vv,ff,ftC):null); return a.at?{ref:r!=null?r/vv.length/a.at:null,real:c.real/vv.length/a.at,fmt:fmtR,bom:false}:null; }})]; }

/* ═════ combustível: a lógica da Árvore de Combustível ═════ */
function ctCombAgg(vigs,filtro){
  const C=CT.cons; if(!C) return null; const P=CT.rsl;
  let km=0,lit=0,tot=0,rxl=0,litR=0; const proj={}, uni={};
  C.forEach(r=>{ if(!vigs.includes(r.vig)||!filtro(r.op,r.uni)) return;
    km+=r.km; lit+=r.lit; if(r.tot>0) tot+=r.tot;
    const pr=P?ctPreco(P.L1,P.L2,r):null; if(pr>0){ rxl+=pr*r.lit; litR+=r.lit; }
    const pk=r.n3+'|'+r.vig, pp=proj[pk]=proj[pk]||{s:0,c:0,km:0}; if(r.remMed>0){ pp.s+=r.remMed; pp.c++; } pp.km+=r.km;
    const o=uni[r.uni]=uni[r.uni]||{km:0,lit:0,pkm:0,kmp:0,proj:{}}; o.km+=r.km; o.lit+=r.lit;
    const rsl=r.lit>0?r.tot/r.lit:0, prc=pr>0?pr:rsl; if(r.km>0&&prc>0){ o.pkm+=prc*r.km; o.kmp+=r.km; }
    const q=o.proj[pk]=o.proj[pk]||{s:0,c:0,km:0}; if(r.remMed>0){ q.s+=r.remMed; q.c++; } q.km+=r.km; });
  let litEsp=0; Object.values(proj).forEach(v=>{ const rp=v.c?v.s/v.c:null; if(rp>0&&v.km>0) litEsp+=v.km/rp; });
  let efic=0, nE=0; Object.values(uni).forEach(o=>{ let le=0; Object.values(o.proj).forEach(v=>{ const rp=v.c?v.s/v.c:null; if(rp>0&&v.km>0) le+=v.km/rp; });
    const pr=o.kmp>0?o.pkm/o.kmp:0; if(le>0&&o.lit>0&&o.km>0&&pr>0){ efic+=(o.lit-le)*pr; nE++; } });
  return {km,lit,tot,kmLRem:litEsp>0?km/litEsp:null,kmLReal:lit>0?km/lit:null,rsLRem:litR>0?rxl/litR:null,rsLReal:lit>0?tot/lit:null,
    preco:litR>0?tot-rxl:null,efic:nE?efic:null}; }
function ctCombKids(px,vigs,filtro,K,R){
  const n=vigs.length, B=ctCombAgg(vigs,filtro);
  if(!B) return [{id:px+'|carr',t:'Km/L e R$/L',v:CT_ERR.cons?'sem leitura':'carregando…',s:CT_ERR.cons||'aba Km/L do consumo'}];
  const b=window.ArvImpacto?ArvImpacto.calc({custoRem:K.cRem,custoReal:K.cReal,kmRem:K.rem,kmReal:K.real,rsLRem:B.rsLRem,rsLReal:B.rsLReal,kmLRem:B.kmLRem,kmLReal:B.kmLReal,
    impPrecoBase:B.preco,impEficBase:B.efic,kmBase:B.km,litBase:B.lit,totBase:B.tot}):null;
  const pp=v=>R&&R.cap&&v!=null?v*(1-IR)*12/R.cap:null, im=v=>v==null?null:-v/n;
  const rsl=ctNo({id:px+'|rsl',t:'R$/L · preço',v:fR3(B.rsLReal),s:'R$ abastecido ÷ litros (ERP)',g:{ref:B.rsLRem,real:B.rsLReal,bom:false,fmt:fR3,rot:'Rem. FT',imp:im(b&&b.preco),pp:pp(im(b&&b.preco))},
    rows:[['Litros no mês',fmtN(B.lit/n)],['R$ abastecido no mês',fmtR(B.tot/n)]],abv:(vv,ff)=>{ const x=ctCombAgg(vv,ff); return x?{ref:x.rsLRem,real:x.rsLReal,fmt:fR3,bom:false}:null; }},()=>ctRslKids(px+'|rsl',vigs,filtro,B));
  const kml=ctNo({id:px+'|kml',t:'Km/L · eficiência',v:B.kmLReal==null?'—':br(B.kmLReal,2),s:'km ÷ litros (ERP) · rem. pela régua de litros',g:{ref:B.kmLRem,real:B.kmLReal,bom:true,fmt:x=>br(x,2),rot:'Rem. FT',imp:im(b&&b.efic),pp:pp(im(b&&b.efic))},
    rows:[['Km com abastecimento',fmtKmG(B.km/n)]],abv:(vv,ff)=>{ const x=ctCombAgg(vv,ff); return x?{ref:x.kmLRem,real:x.kmLReal,fmt:x2=>br(x2,2),bom:true}:null; }},()=>ctKmlKids(px+'|kml',vigs,filtro,B));
  const out=[rsl,kml];
  if(b&&b.dif!=null) out.push({id:px+'|dif',t:'Diferença DRE × bases',v:fmtSig(fmtR,b.dif/n),cls:corV(-b.dif,true),s:'o que preço e eficiência não explicam no R$/km',
    rows:[['Lado remunerado',fmtSig(fmtR,b.difRem/n)],['Lado realizado',fmtSig(fmtR,b.difReal/n)],['R$/km pelas bases · rem.',r2(b.rkBaseRem)]]});
  return out; }
function ctRslKids(px,vigs,filtro,B){
  const n=vigs.length, C=CT.cons, P=CT.rsl, out=[];
  if(C&&P){ let lit=0,acima=0,litAc=0,anpS=0,anpL=0;
    C.forEach(r=>{ if(!vigs.includes(r.vig)||!filtro(r.op,r.uni)||!(r.lit>0)) return; const anp=ctPreco(P.A1,P.A2,r); if(!(anp>0)) return; const pr=r.tot/r.lit;
      lit+=r.lit; anpS+=anp*r.lit; anpL+=r.lit; if(pr>anp){ acima+=(pr-anp)*r.lit; litAc+=r.lit; } });
    out.push({id:px+'|anp',t:'Preço pago × ANP',v:fmtR(acima/n),cls:acima>0?'cr':'',s:'o FT paga o menor dos dois; acima da ANP é nosso',
      rows:[['ANP média',fR3(anpL?anpS/anpL:null)],['R$/L pago',fR3(B.rsLReal)],['% dos litros acima da ANP',fmtP(lit?litAc/lit:null)]]}); }
  const unis=UNIS.filter(u=>OP_ORD.some(op=>filtro(op,u)));
  const api={}; let falta=false; vigs.forEach(v=>{ const a=CT.api[v]; if(a===undefined){ falta=true; ctLeApi(v); return; } (a||[]).forEach(r=>{ if(!unis.includes(r.unidade)) return; const s=r.sistema||'—', o=api[s]=api[s]||{l:0,v:0}; o.l+=+r.litros||0; o.v+=+r.valor||0; }); });
  const ss=Object.entries(api).sort((a,b)=>b[1].l-a[1].l);
  out.push({id:px+'|api',t:'Por sistema de abastecimento',v:falta?'carregando…':ss.length?fmtN(ss.reduce((a,x)=>a+x[1].l,0)/n)+' L':'—',s:'Pró-Frotas · Gasola · SUMA (por unidade)',
    rows:ss.map(([s,o])=>[{PROFROTAS:'Pró-Frotas',GASOLA:'Gasola',SUMA:'SUMA'}[s]||s,fR3(o.l?o.v/o.l:null)+' · '+fmtN(o.l/n)+' L']),kl:'sinal'});
  return out; }
function ctKmlKids(px,vigs,filtro,B){
  const n=vigs.length, C=CT.cons, out=[]; if(!C) return out;
  const pRem=B.rsLRem||B.rsLReal||0;
  // a régua do FT (média simples das placas ativas do projeto) × o Km/L do modelo de cada placa que rodou
  let litMed=0, litMod=0; const proj={};
  C.forEach(r=>{ if(!vigs.includes(r.vig)||!filtro(r.op,r.uni)) return; const pk=r.n3+'|'+r.vig, o=proj[pk]=proj[pk]||{s:0,c:0,km:0,lm:0,ok:true};
    if(r.remMed>0){ o.s+=r.remMed; o.c++; } o.km+=r.km; if(r.km>0){ if(r.remMod>0) o.lm+=r.km/r.remMod; else o.ok=false; } });
  Object.values(proj).forEach(o=>{ const rp=o.c?o.s/o.c:null; if(rp>0&&o.km>0&&o.ok){ litMed+=o.km/rp; litMod+=o.lm; } });
  if(litMed&&litMod){ const ef=(litMed-litMod)*pRem;
    out.push({id:px+'|regua',t:'Régua do FT (média simples)',v:fmtSig(fmtR,ef/n),cls:corV(ef,true),s:'litros pagos pela média × pelo modelo de cada placa que rodou',
      rows:[['Litros pela média simples',fmtN(litMed/n)],['Litros pelo modelo das placas',fmtN(litMod/n)]]}); }
  // placas que gastaram mais de 15% acima do Km/L do próprio modelo
  let nPl=0, kmPl=0, kmT=0, litA=0; const pls={};
  C.forEach(r=>{ if(!vigs.includes(r.vig)||!filtro(r.op,r.uni)||!(r.km>0)) return; kmT+=r.km; if(!(r.remMod>0)||!(r.lit>0)) return;
    const esp=r.km/r.remMod; if(r.lit>esp*1.15){ nPl++; kmPl+=r.km; litA+=r.lit-esp; const p=pls[r.placa]=pls[r.placa]||{l:0,m:r.modelo}; p.l+=r.lit-esp; } });
  const top=Object.entries(pls).sort((a,b)=>b[1].l-a[1].l).slice(0,3);
  out.push({id:px+'|plab',t:'Placas abaixo do modelo',v:fmtR(-litA*pRem/n),cls:litA>0?'cr':'',s:'Km/L real mais de 15% abaixo do modelo da placa',
    rows:[['Placa-mês',fmtN(nPl)],['% do km',fmtP(kmT?kmPl/kmT:null)],['Litros a mais no mês',fmtN(litA/n)],...top.map(([p,o])=>[p,fmtN(o.l/n)+' L'])]});
  // abastecimento com erro (Correção de Anomalias de Combustível)
  if(CT.anom){ let ab=0,aj=0,ok=0,rs=0; CT.anom.forEach(a=>{ if(!vigs.includes(a.vig)) return; if(a.op?!filtro(a.op,a.uni):!OP_ORD.some(op=>filtro(op,a.uni))) return;
      if(a.sit==='ajustado') aj++; else if(a.sit==='correto'||a.sit==='corrigido') ok++; else { ab++; rs+=a.rs; } });
    out.push({id:px+'|anom',t:'Abastecimento com erro',v:fmtN(ab)+' em aberto',cls:ab?'cr':'',s:'Km/L do mês fora de ±35% do modelo',rows:[['Ajustadas pelas APIs',fmtN(aj)],['Corrigidas ou certas',fmtN(ok)],['R$ em jogo (em aberto)',fmtR(rs)]],kl:'sinal'}); }
  // condução (DriverPro): só onde há telemetria com motorista
  const ce=(CT.ce||[]).filter(x=>vigs.includes(x.vig)&&filtro(x.op,x.uni));
  if(ce.length){ const km=ce.reduce((a,x)=>a+x.km,0), nota=km?ce.reduce((a,x)=>a+x.nota*x.km,0)/km:null;
    out.push({id:px+'|ce',t:'Condução (DriverPro)',v:nota==null?'—':br(nota,1),s:'nota média ponderada pelo km',g:{ref:75,real:nota,bom:true,rot:'Meta',fmt:x=>br(x,1),cols:['ref','d']},rows:[['Motorista-mês',fmtN(ce.length)]],kl:'sinal'}); }
  else out.push({id:px+'|ce',t:'Condução',v:'sem telemetria',kl:'falta',s:'DriverPro só na Empurrada de Piraí'});
  return out; }

/* ═════ indicadores (Gerot · Ginfo · Carta), com a ligação de cada um com o desvio do pacote nas unidades ═════ */
function ctIndAgg(field,vigs,filtro){ if(!CT.ger) return null;
  const L=CT.ger.filter(x=>x.field===field&&vigs.includes(x.vig)&&x.ops.some(op=>filtro(op,x.uni))); if(!L.length) return null;
  const real=L.reduce((a,x)=>a+x.real,0)/L.length, ms=L.filter(x=>x.meta!=null);
  return {real,meta:ms.length?ms.reduce((a,x)=>a+x.meta,0)/ms.length:null,n:L.length}; }
/* r de Pearson entre o indicador e o desvio do pacote, unidade × mês (todos os meses e unidades: a rede) */
function ctLiga(field,pac){
  _ctRedes=_ctRedes||{}; const k=field+'|'+pac; if(_ctRedes[k]!==undefined) return _ctRedes[k];
  if(!CT.ger||!window.Estat) return null;
  const x=[], y=[];
  CT.ger.filter(r=>r.field===field).forEach(r=>{ let real=0,rem=0; r.ops.forEach(op=>{ const o=FR[r.vig+'|'+op+'|'+r.uni]; if(o&&o[pac]){ real+=o[pac].real; rem+=o[pac].rem; } });
    if(rem>0){ x.push(r.real); y.push((real-rem)/rem); } });
  const p=x.length>=Estat.N_MIN?Estat.pearson(x,y):null;
  return _ctRedes[k]=p&&isFinite(p.r)?{r:p.r,n:p.n,p:p.p}:null; }
function ctLigaTxt(field,pac){ const L=ctLiga(field,pac), d=CT_IND[field]; if(!L) return 'ligação: poucos pontos';
  const a=Math.abs(L.r), f=a>=.5?'forte':a>=.3?'moderada':a>=.15?'fraca':'quase nenhuma';
  if(a<.15) return 'ligação com o desvio: quase nenhuma';
  const certo=d.dir==='higher'?L.r<0:L.r>0;
  return `ligação ${f} com o desvio${certo?'':' (sentido contrário)'}${L.p<0.05?'':' · pode ser acaso'}`; }
function ctNoInd(px,field,vigs,filtro,pac){ const d=CT_IND[field], A=ctIndAgg(field,vigs,filtro), f=ctFmtInd(d.fmt);
  if(!A) return {id:px+'|'+field,t:d.t,v:CT.ger?'sem dado':CT_ERR.ger?'sem leitura':'carregando…',kl:'sinal'};
  return ctNo({id:px+'|'+field,t:d.t,v:f(A.real),kl:'sinal',s:ctLigaTxt(field,pac),g:A.meta!=null?{ref:A.meta,real:A.real,bom:d.dir==='higher',rot:'Meta',fmt:f,cols:['ref','d']}:null,
    abv:(vv,ff)=>{ const x=ctIndAgg(field,vv,ff); return x?{ref:x.meta,real:x.real,fmt:f,bom:d.dir==='higher',ind:true}:null; }}); }
function ctFam(px,t,s,fields,vigs,filtro,pac,extra){ return ctNo({id:px,t,v:'',s,kl:'fam'},()=>[...fields.map(f=>ctNoInd(px,f,vigs,filtro,pac)),...(extra||[])]); }
/* Carta de Custos no recorte, nas contas pedidas */
function ctCarta(vigs,filtro,ids){ if(!CT.carta) return null;
  return CT.carta.filter(l=>vigs.includes(l.vig)&&(!ids||ids.includes(l.cta))&&(l.op?filtro(l.op,l.uni):OP_ORD.some(op=>filtro(op,l.uni)))); }
const pl=(n,um,mais)=>fmtN(n)+' '+(Math.round(n)===1?um:mais);
const ctTop=(L,k,n)=>{ const g={}; L.forEach(l=>{ g[l[k]]=(g[l[k]]||0)+l.valor; }); return Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,n); };
function ctCartaKids(px,vigs,filtro,ids,nome){ const n=vigs.length, L=ctCarta(vigs,filtro,ids);
  if(!L) return [{id:px+'|carta',t:'Carta de Custos',v:CT_ERR.carta?'sem leitura':'carregando…',s:CT_ERR.carta||''}];
  const tot=L.reduce((a,l)=>a+l.valor,0); if(!L.length) return [{id:px+'|carta',t:'Carta de Custos',v:'sem lançamento',s:'nada lançado no recorte'}];
  const pct=v=>tot?' ('+br(v/tot*100,0)+'%)':'';
  return [{id:px+'|grp',t:'Por grupo',v:fmtR(tot/n),s:`${nome} lançado na Carta`,rows:ctTop(L,'grupo',6).map(([g,v])=>[g,fmtR(v/n)+pct(v)])},
    {id:px+'|pla',t:'Por placa',v:pl(new Set(L.map(l=>l.placa).filter(Boolean)).size,'placa','placas'),s:'as que mais custaram',rows:ctTop(L.filter(l=>l.placa),'placa',6).map(([p,v])=>[p,fmtR(v/n)+pct(v)])},
    {id:px+'|for',t:'Por fornecedor',v:pl(new Set(L.map(l=>l.forn)).size,'fornecedor','fornecedores'),s:'concentração e preço',rows:ctTop(L,'forn',5).map(([f,v])=>[f,fmtR(v/n)+pct(v)])}]; }
/* pago pelo FT na manutenção, placa a placa: carência (FT paga zero), BID/contrato e zero fora da carência */
function ctManFT(px,vigs,filtro){ let car=0,rec=0,zero=0,soma=0,nv=vigs.length,tem=false;
  vigs.forEach(v=>(CAP[v]||[]).forEach(e=>{ if(!filtro(e.op,e.uni)||!e.ativo||e.man==null) return; tem=true;
    if(e.man>0){ rec+=1/nv; soma+=e.man/nv; } else if(e.free>0&&e.vida<=e.free) car+=1/nv; else zero+=1/nv; }));
  if(!tem) return {id:px+'|ftp',t:'R$/km pago (FT)',v:'—',s:'sem o campo de manutenção no FT do recorte'};
  return ctNo({id:px+'|ftp',t:'R$/km pago (FT)',v:fR3(rec?soma/rec:null),s:'média das placas ativas que recebem',rows:[['Placas recebendo',fmtN(rec)],['Em carência (FT paga 0)',fmtN(car)],['Zero fora da carência',fmtN(zero),zero>0?'cr':'']]},
    ()=>[{id:px+'|ftp|car',t:'Carência',v:pl(car,'placa','placas'),s:'placa nova: o fabricante cobre, o FT paga zero'},
      {id:px+'|ftp|bid',t:'BID ou contrato',v:pl(rec,'placa','placas'),s:'o menor dos dois por placa (Book do Operador)',rows:[['R$/km médio pago',fR3(rec?soma/rec:null)]]},
      {id:px+'|ftp|zero',t:'Zero fora da carência',v:pl(zero,'placa','placas'),cls:zero>0?'cr':'',s:'ativas, depois da carência e sem R$/km de manutenção',kl:zero>0?'':'sinal'}]); }
function ctManKids(px,vigs,filtro,ids,K){
  const n=vigs.length, L=ctCarta(vigs,filtro,ids)||[], A=ctAtivos(vigs,filtro), C=ctCusto(vigs,filtro,ids);
  const reinc=(()=>{ const g={}; L.forEach(l=>{ if(!l.placa) return; const k=l.placa+'|'+l.grupo; g[k]=(g[k]||0)+1; }); return Object.values(g).filter(c=>c>1).length; })();
  const man=L.filter(l=>!l.robo), forn=ctTop(L,'forn',1)[0], tot=L.reduce((a,l)=>a+l.valor,0);
  const sin=(pf,id,t,v,s,rows,cls)=>({id:px+'|ind|'+pf+'|'+id,t,v,s,rows,cls,kl:'sinal'});
  return [ctManFT(px,vigs,filtro),
    ctNo({id:px+'|gas',t:'R$/km gasto (Carta)',v:fmtR(tot/n),s:'lançado na Carta de Custos no mês'},()=>ctCartaKids(px+'|gas',vigs,filtro,ids,'manutenção')),
    ctNo({id:px+'|ind',t:'Indicadores',v:'6 famílias',s:'sinal: não soma no R$, explica',kl:'fam'},()=>[
      ctFam(px+'|ind|prev','Prevenção','o que evita a quebra',['prev','conf','checkT','checkWH','osCritica'],vigs,filtro,'M'),
      ctFam(px+'|ind|resp','Resposta da oficina','quanto demora para voltar',['sla','mttr','osVenc'],vigs,filtro,'M'),
      ctFam(px+'|ind|conf','Confiabilidade','quanto o caminhão quebra',['mtbf','disp'],vigs,filtro,'M',[sin('conf','reinc','Reincidência',fmtN(reinc)+' placa-grupo','mesmo grupo 2 vezes ou mais na mesma placa (Carta)',null,reinc?'cr':'')]),
      ctNo({id:px+'|ind|frota',t:'Frota',v:'',s:'idade e custo por ativo',kl:'fam'},()=>[
        sin('frota','idade','Idade média',A.idade==null?'—':br(A.idade/12,1)+' anos','desde a entrada no FT'),
        sin('frota','cativo','Custo por ativo',fmtR(A.at?C.real/n/A.at:null),'R$ da conta por equipamento no mês',[['Ativos (média)',fmtN(A.at)]])]),
      ctNo({id:px+'|ind|comp',t:'Compra',v:'',s:'quanto pagamos',kl:'fam'},()=>[
        sin('comp','conc','Concentração de fornecedor',forn&&tot?br(forn[1]/tot*100,0)+'%':'—',forn?'maior: '+forn[0]:'Carta de Custos'),
        sin('comp','tick','Ticket médio',fmtR(man.length?man.reduce((a,l)=>a+l.valor,0)/man.length:null),'por lançamento (sem os de robô)',[['Lançamentos no mês',fmtN(man.length/n)]]),
        sin('comp','proc','Processo RC → OC → NF',fmtP(man.length?man.filter(l=>l.nf).length/man.length:null),'lançamentos com NF',[['Com RC',fmtP(man.length?man.filter(l=>l.rc).length/man.length:null)],['Com OC',fmtP(man.length?man.filter(l=>l.oc).length/man.length:null)]])]),
      ctFam(px+'|ind|cob','Cobrança da Ambev','desconto na receita da frota',['civf','stVeic','stEmp','blitz'],vigs,filtro,'M')])]; }
function ctPneuKids(px,vigs,filtro,ids,K){ const n=vigs.length;
  const ftp=ctFT(vigs,filtro,['pneu']);
  return [{id:px+'|ftp',t:'R$/km pago (FT)',v:fR3(ftp!=null&&K&&K.rem?ftp/K.rem:null),s:'(pneus × preço + recapes × preço do recape) ÷ vida em km',rows:[['Pago FT no mês (pacote)',fmtR(ftp==null?null:ftp/n)]]},
    ctNo({id:px+'|gas',t:'R$/km gasto (Carta)',v:'',s:'lançado na Carta de Custos'},()=>ctCartaKids(px+'|gas',vigs,filtro,ids,'pneu')),
    ctFam(px+'|ind','Indicadores','Prolog e Frota de Elite: vida do pneu',['pneus','pneuCalib','pneuAmp'],vigs,filtro,'P')]; }

/* ═════ a árvore ═════ */
function ctNoConta(id,vigs,filtro,R){
  const d=ctDef(id), C=ctCusto(vigs,filtro,[id]); if(!C.real&&!C.ref) return null;
  const n=vigs.length, px='c:'+id, ids=[id];
  // o FT de algumas contas paga junto com outra (diesel + Arla; manutenção + contrato do fabricante): a diferença
  // compara o FT com as duas, e como referência o FT entra na proporção do real da conta
  const ftDe=(vv,ff,c)=>{ if(!d.ft) return {ft:null,ref:null,rFt:c.real}; const f=ctFT(vv,ff,d.ft); if(f==null) return {ft:null,ref:null,rFt:c.real};
    const rFt=d.fc?ctCusto(vv,ff,d.fc).real:c.real; return {ft:f,rFt,ref:d.fc&&rFt?f*c.real/rFt:f}; };
  const F0=ftDe(vigs,filtro,C), ref=ctRef(C,F0.ref);
  const base={id:px,t:d.nome,v:fmtR(C.real/n),kl:'conta',g:ctGapCusto(ref,C.real,n,R),rows:ctFtRows(F0.ft,F0.rFt,n,d.rotFt),
    abv:(vv,ff)=>{ const c=ctCusto(vv,ff,[id]), F=ftDe(vv,ff,c); return {ref:ctRef(c,F.ref),real:c.real,ft:F.ft,realFt:F.rFt,fmt:fmtR,bom:false,mes:true}; }};
  if(d.q==='imp'){ base.s='crédito de imposto sobre o diesel'; return ctNo(base); }
  const sKm=d.q==='mis'?'mista: por km e por ativo':d.q==='fix'?'fixa: R$/ativo × ativos':'variável: R$/km × km';
  base.s=sKm;
  return ctNo(base,()=>{
    if(d.q==='fix') return ctNoAtivo(px,vigs,filtro,[id],d.ft)||[{id:px+'|sem',t:'Sem ativos no FT',v:'—'}];
    if(d.q==='mis'){ const vk=ctNoKm(px+'|lk',vigs,filtro,[id],R,null,d.ft), va=ctNoAtivo(px+'|la',vigs,filtro,[id],d.ft);
      return [vk?ctNo({id:px+'|lk',t:'Leitura por km',v:'',s:'as duas leituras explicam o mesmo ▲ (não somam)',kl:'lente'},()=>vk.kids):null,
        va?ctNo({id:px+'|la',t:'Leitura por ativo',v:'',s:'as duas leituras explicam o mesmo ▲ (não somam)',kl:'lente'},()=>va):null]; }
    const taxa=d.q==='comb'?((K,p)=>ctCombKids(p,vigs,filtro,K,R)):d.q==='manut'?((K,p)=>ctManKids(p,vigs,filtro,['MANV','CONT'],K)):d.q==='pneu'?((K,p)=>ctPneuKids(p,vigs,filtro,['PNEU','RECAP'],K)):null;
    const vk=ctNoKm(px,vigs,filtro,ids,R,taxa,d.ft); if(!vk) return [{id:px+'|semkm',t:'Sem km no recorte',v:'—',s:'Armazém ou mês sem a Dispersão de km'}];
    const fora=C.real-vk.K.cReal; const out=vk.kids;
    if(Math.abs(fora)>Math.max(1,Math.abs(C.real)*0.002)) out.push({id:px+'|fora',t:'Fora da abertura em km',v:fmtR(fora/n),s:'custo de chave sem km (Armazém) ou sem a Dispersão'});
    return out; }); }
function ctNoPac(p,vigs,filtro,R){
  const ids=new Set(); Object.entries(FRC).forEach(([k,o])=>{ const [v,op,u]=k.split('|'); if(!vigs.includes(v)||!filtro(op,u)) return; Object.keys(o).forEach(c=>{ if(ctDef(c).pac===p) ids.add(c); }); });
  const L=[...ids], Cp=ctCusto(vigs,filtro,L), n=vigs.length, ft=ctFT(vigs,filtro,CT_PAC_FT[p]), ref=ctRef(Cp,ft); if(!Cp.real&&!Cp.ref) return null;
  return ctNo({id:'p:'+p,t:PAC_NOME[p],v:fmtR(Cp.real/n),kl:'pac',s:p==='C'?'diesel e Arla':p==='O'?'IPVA, seguros, ICMS e outras':undefined,g:ctGapCusto(ref,Cp.real,n,R),rows:ctFtRows(ft,Cp.real,n),
    abv:(vv,ff)=>{ const c=ctCusto(vv,ff,L), f=ctFT(vv,ff,CT_PAC_FT[p]); return {ref:ctRef(c,f),real:c.real,ft:f,fmt:fmtR,bom:false,mes:true}; }},
    ()=>L.map(id=>({id,C:ctCusto(vigs,filtro,[id])})).sort((a,b)=>b.C.real-a.C.real).map(x=>ctNoConta(x.id,vigs,filtro,R))); }
function ctRaiz(vigs,filtro,R){
  const C=ctCusto(vigs,filtro,null), n=vigs.length, ftAll=Object.values(CT_PAC_FT).flat(), ft=ctFT(vigs,filtro,ftAll), ref=ctRef(C,ft);
  return ctNo({id:'tot',t:'Custo total da frota',v:fmtR(C.real/n),raiz:!CT_ROIC,kl:'tot',s:n>1?'média do mês':'no mês',g:ctGapCusto(ref,C.real,n,R),rows:ctFtRows(ft,C.real,n),
    abv:(vv,ff)=>{ const c=ctCusto(vv,ff,null), f=ctFT(vv,ff,ftAll); return {ref:ctRef(c,f),real:c.real,ft:f,fmt:fmtR,bom:false,mes:true}; }},
    ()=>['C','M','P','O'].map(p=>ctNoPac(p,vigs,filtro,R))); }
/* o caminho até o ROIC, recolhido numa faixa em cima; expandido, vira o começo da árvore */
function ctComRoic(raizCusto,R,vigs){ const n=R.n, g=id=>gapDe(id,R);
  return {raiz:true,t:'ROIC anualizado',v:fmtP(R.roic),cls:corV(R.roic,true),s:'NOPAT anual ÷ capital líquido',g:{ref:R.roicRef,real:R.roic,bom:true,pct:true,rot:CMP_ROT(),fmt:fmtP},
    kids:[{t:'Margem NOPAT',v:fmtP(R.margem),s:'NOPAT ÷ receita líquida',g:{ref:R.margemRef,real:R.margem,bom:true,pct:true,fmt:fmtP},kids:[
      {t:'Receita líquida',v:fmtR(R.rec/n),g:g('rec')},
      {t:'EBITDA ajustado',v:fmtR(R.ebd/n),s:'receita − custos',g:g('ebd'),kids:[raizCusto,{t:'Demais custos',v:fmtR(R.dem/n),s:'o que não é frota (pessoal, adm…)',g:g('dem')}]},
      {t:'Depreciação',v:fmtR(-R.dep/n),s:'DRE do ERP ou FT'}]},
      {t:'Giro do capital',v:R.giro==null?'—':br(R.giro,2)+'×',s:'receita anual ÷ capital',rows:[['Capital líquido',fmtR(R.cap)]]}]}; }

/* ═════ render ═════ */
async function renderCusto(){
  const vigs=vigsSel(); if(!vigs.length) return;
  const per=vigs.length>1?`${vigRot(vigs[0])} a ${vigRot(vigs[vigs.length-1])}`:vigRot(vigs[0]);
  const area=$('arv-custo'); document.querySelectorAll('#modo-custo [data-ccmp]').forEach(b=>b.classList.toggle('on',b.dataset.ccmp===CT_CMP));
  set('titSub',`${per} · DRE Frota, Dispersão de km, Freightech, consumo, Carta e Gerot`);
  // as leituras saem em paralelo; a árvore é desenhada com o que já chegou e se refaz a cada uma
  ctLeFT(); ctLeCons(); ctLeRsl(); ctLeGer(); ctLeCarta(); ctLeAnom(); ctLeCe();
  if(!KM){ area.innerHTML='<div class="vazio">Carregando a Dispersão de km…</div>'; }
  try{ await Promise.all([carregaKm(),...vigs.map(capMes)]); }catch(e){ console.warn('Árvore do Custo: Dispersão de km ou FT indisponível',e); }
  if(CT.bm===null&&!CT_P.bm) ctLeBM().then(()=>{ ctRecompoe(); ctRedesenha(); });
  else if(CT.bm&&!Object.keys(CT_BM).length) ctRecompoe();
  let rev={}; try{ const anos=[...new Set(vigs.map(v=>+v.slice(0,4)))]; (await Promise.all(anos.map(carregaRev))).forEach(o=>Object.assign(rev,o)); }catch(e){}
  if(VW!=='custo') return;
  const filtro=(op,uni)=>passa(op,uni);
  CT_CTX={vigs,per,rev,filtro};
  const cm=CMP; if(CT_CMP!=='ft') CMP=CT_CMP; const R=roicDe(vigs,filtro); CMP=cm;
  const raiz=ctRaiz(vigs,filtro,R);
  const bc=$('ct-bc'); if(bc){ const C=ctCusto(vigs,filtro,null), n=R.n;
    bc.innerHTML=`<span class="bci" title="EBITDA ${esc(fmtR(R.ebd/n))} no mês">ROIC ${esc(fmtP(R.roic))}</span><span class="sep">›</span><span class="bci on">Custo ${esc(fmtR(C.real/n))}</span>`
      +`<button class="dimb${CT_ROIC?' on':''}" type="button" id="ct-roic">${CT_ROIC?'Recolher o ROIC':'Até o ROIC'}</button>`; }
  const pend=['cons','ft','ger','carta'].filter(k=>CT[k]==null&&!CT_ERR[k]);
  const NOME={cons:'consumo',rsl:'R$/L do FT',ft:'Freightech',ger:'indicadores',carta:'Carta',anom:'anomalias',ce:'DriverPro',bm:'balanço de massa',api:'APIs de abastecimento'};
  const err=Object.keys(CT_ERR).map(k=>NOME[k]||k), nm=k=>NOME[k]||k;
  set('titSub',`${per} · ${pend.length?'carregando '+pend.map(nm).join(', ')+'… · ':''}${err.length?'sem '+err.join(', ')+' · ':''}referência: ${CT_REF_NOME()}, com o FT ao lado`);
  const top=CT_ROIC?ctComRoic(raiz,R,vigs):raiz;
  arvore(area,top,(no,alvo)=>{
    if(alvo&&alvo.closest&&alvo.closest('.tn-tab')&&no.abv){ ctAbre(no); return; }
    if(no.temKids){ if(CT_AB.has(no.id)) [...CT_AB].forEach(k=>{ if(k===no.id||k.startsWith(no.id+'|')) CT_AB.delete(k); }); else CT_AB.add(no.id); ctGuardaAb(); renderCusto(); return; }
    if(no.abv) ctAbre(no); },{manter:true,extra:[['tudo','Abrir tudo','Abrir todos os nós da árvore'],['nada','Recolher','Voltar ao custo total com os pacotes']],
    acao:async k=>{ area._mexeu=false;
      if(k==='tudo'){ CT_TUDO=true; try{ await renderCusto(); } finally{ CT_TUDO=false; } }
      else { CT_AB.clear(); CT_AB.add('tot'); renderCusto(); } }});
  if(AB_KIND==='custo'&&AB_N&&$('ab-ov').classList.contains('on')&&CT_AB_NO) ctAbre(CT_AB_NO);
}

/* ── abertura de um nó do custo: por unidade e projeto, unidade, projeto ou mês ── */
let CT_AB_NO=null;
function ctAbre(no){ if(!CT_CTX||!no.abv) return; CT_AB_NO=no; AB_KIND='custo'; AB_N=no.id; if(AB_Q==='placa') AB_Q='up';
  const {vigs,per}=CT_CTX;
  $('ab-t').textContent=no.t; $('ab-s').textContent=per+' · contra o '+CT_REF_NOME()+((no.abv(vigs,(o,u)=>passa(o,u))||{}).mes?' · por mês':'');
  $('ab-q').innerHTML=QUEBRAS.filter(q=>q[0]!=='placa').map(q=>`<button class="dimb${AB_Q===q[0]?' on':''}" data-q="${q[0]}">${q[1]}</button>`).join('');
  const gr=[];
  if(AB_Q==='mes') vigs.forEach(v=>gr.push({lab:[vigRot(v)],vv:[v],f:(o,u)=>passa(o,u)}));
  else if(AB_Q==='uni') UNIS.forEach(u=>gr.push({lab:[u],vv:vigs,f:(o,uu)=>uu===u&&passa(o,uu)}));
  else if(AB_Q==='proj') OP_ORD.forEach(op=>gr.push({lab:[OPS[op]],vv:vigs,f:(o,u)=>o===op&&passa(o,u)}));
  else OP_ORD.forEach(op=>UNIS.forEach(u=>{ if(passa(op,u)) gr.push({lab:[u,OPS[op]],vv:vigs,f:(o,uu)=>o===op&&uu===u}); }));
  const L=gr.map(x=>({lab:x.lab,o:no.abv(x.vv,x.f),n:x.vv.length})).filter(x=>x.o&&(x.o.real||x.o.ref));
  const T={o:no.abv(vigs,(o,u)=>passa(o,u)),n:vigs.length};
  const div=(v,x)=>v==null?null:x.o.mes?v/x.n:v;
  const cls=(o,d)=>d==null||Math.abs(d)<1e-9?'':((d>0)===o.bom?'cg':'cr');
  const temFt=L.some(x=>x.o.ft!=null);
  const cols=[[x=>x.o.rotRef||(x.o.ind?'Meta':CT_REF_ROT()),x=>div(x.o.ref,x)],[x=>x.o.rotReal||'Real',x=>div(x.o.real,x)],
    ['▲',x=>x.o.ref==null||x.o.real==null?null:div(x.o.real-x.o.ref,x),true],['▲%',x=>x.o.ref?(x.o.real-x.o.ref)/Math.abs(x.o.ref):null,true,fmtPs]];
  if(temFt) cols.push(['Pago FT',x=>div(x.o.ft,x)],['Real − FT',x=>x.o.ft==null?null:div((x.o.realFt!=null?x.o.realFt:x.o.real)-x.o.ft,x),'ft']);
  const f=(T.o&&T.o.fmt)||fmtR, hl=AB_Q==='up'?['Unidade','Projeto']:[AB_Q==='uni'?'Unidade':AB_Q==='proj'?'Projeto':'Mês'];
  if(AB_Q!=='mes') L.sort((a,b)=>{ const da=a.o.ref==null?0:(a.o.real-a.o.ref)*(a.o.bom?1:-1)/(a.o.mes?a.n:1), db=b.o.ref==null?0:(b.o.real-b.o.ref)*(b.o.bom?1:-1)/(b.o.mes?b.n:1); return da-db; });
  const cel=(x,c)=>{ const v=c[1](x); const fm=c[3]||(c[2]?v2=>fmtSig(f,v2):f); const cl=c[2]==='ft'?(v==null?'':v>0?'cr':'cg'):c[2]?cls(x.o,c[0]==='▲%'?(x.o.real-x.o.ref):v):'';
    return `<td class="num ${cl}">${esc(v==null?'—':fm(v))}</td>`; };
  const th=c=>typeof c[0]==='function'?c[0](T.o?T:L[0]||{o:{}}):c[0];
  $('ab-tab').innerHTML=`<thead><tr>${hl.map(h=>`<th>${h}</th>`).join('')}${cols.map(c=>`<th class="num">${esc(th(c))}</th>`).join('')}</tr></thead>`
    +`<tbody>${L.map(x=>`<tr>${x.lab.map(t=>`<td class="conta">${esc(t)}</td>`).join('')}${cols.map(c=>cel(x,c)).join('')}</tr>`).join('')||`<tr><td class="conta" colspan="12">Sem dados no recorte.</td></tr>`}</tbody>`
    +(T.o?`<tfoot><tr class="total"><td class="conta">Total</td>${hl.length>1?'<td></td>':''}${cols.map(c=>cel(T,c)).join('')}</tr></tfoot>`:'');
  $('ab-pe').innerHTML=(T.o&&T.o.mes?'Valores por mês. ':'')+'Do maior gap contra nós para o maior a favor.'+(temFt?' Pago FT = R$/km do FT × km remunerado da Dispersão (fixo: o valor do FT).':'');
  $('ab-ov').classList.add('on'); }

/* ── seletores do topo da visão ── */
$('modo-custo').addEventListener('click',e=>{
  const b=e.target.closest('[data-ccmp]'); if(b){ CT_CMP=b.dataset.ccmp; try{ localStorage.setItem('arvores_ct_cmp',CT_CMP); }catch(x){} renderCusto(); return; }
  if(e.target.closest('#ct-roic')){ CT_ROIC=!CT_ROIC; try{ localStorage.setItem('arvores_ct_roic',CT_ROIC?'1':'0'); }catch(x){} renderCusto(); } });
$('arv-custo')._top=36;
function ctLimpa(){ Object.keys(CT_P).forEach(k=>delete CT_P[k]); Object.keys(CT_ERR).forEach(k=>delete CT_ERR[k]); Object.keys(CT).forEach(k=>{ CT[k]=k==='api'?{}:null; }); CT_BM={}; _ctRedes=null; }
