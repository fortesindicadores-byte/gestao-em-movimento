/* ══════════════════════════════════════════════════════════════════════════
   CartaCalc — a CONTA da Carta de Custos, num lugar só (Renan, 13/10/2026).

   "Farol semanal custos: deve ser substituída pela carta de custos" → "Pode
   trocar". A visão Custos do Gestão à Vista deixou de ler a aba "Custos" da
   planilha Farol Semanal e passou a mostrar os MESMOS números do Resumo
   Gerencial da Carta (mês corrente; pacotes Combustíveis, Manutenção e Pneus).
   Para isso a conta saiu de dentro do carta-custos/index.html e veio para cá,
   e as DUAS telas leem daqui — refazer a leitura numa cópia daria dois números
   para o mesmo indicador (mesmo motivo do assets/correlacoes-dados.js).

   O que mora aqui (tudo sem estado de tela — filtro, seleção e HTML ficam em
   quem chama):
   · unidades e Nível 3 do DRE: UNIT_BASE, UNIT_TIER, tierOfPrefix,
     unitMatchNv3, getUniLabel, getNv3Prefix;
   · contas e pacotes: CONTAS, PACOTES, pacoteDaConta, pacDe, CONTAS_ALIAS,
     canonConta, counts (o lançamento que vale: NF preenchida e valor > 0);
   · DRE (aba Frota): leitura pelo gviz (o assets/gviz-cache.js responde do
     banco), mapTab/ebIdx e accDre — Orç do mês e Rem (tend.) = Orç do mês ×
     (Rem ÷ Orç acumulados no ano), conta a conta;
   · Combustíveis: abastecimentos ENCERRADOS do ERP, só diesel e Arla, preço
     absurdo trocado pelo mediano, PIS/COFINS fora (menos CGR e o diesel de FLP);
   · contrato de manutenção: leitura em degraus da custo_vigencia(_mv), a
     sobreposição portal VW (de fev/26) → planilha → fixo do mês anterior, e a
     prévia (unidade+vigência que a planilha ainda não fechou);
   · resumoPacotes: o bloco por pacote do Resumo Gerencial (conta → Orç, Rem,
     Real), e cartaMes: a Carta de um mês inteiro, por unidade e por projeto,
     montada com essas mesmas peças (é o que o Gestão à Vista usa).
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // unidades da Carta (mesmo mapa do FCA) — CBA e MCC separadas por projeto/tier.
  // É o universo do admin na Carta, e por isso também o da planilha do contrato
  // no cartaMes (o "fixo do mês anterior" é por placa, de qualquer unidade).
  const DEPARA={CGR:'CAMPO GRANDE',BLC:'BALNEARIO CAMBORIU','CBA T1':'CUIABA — EMPURRADA (T1)','CBA T1 WH':'CUIABA — APOIO (T1 WH)','CBA T2':'CUIABA — CDD (T2)',FLP:'FLORIANOPOLIS',GRL:'GUARULHOS',NFR:'NOVA FRIBURGO',PLT:'PELOTAS',RON:'RONDONOPOLIS','MCC T1':'MACACU — EMPURRADA (T1)','MCC T2':'MACACU — CDI (T2)',PIR:'PIRAI',ANG:'ANHANGUERA',GNA:'GOIANIA'};
  // ── unidades × Nível 3 do DRE ('ROTA - CBA') ──
  const UNIT_BASE=c=>{c=String(c||'');return c.startsWith('CBA ')?'CBA':c.startsWith('MCC ')?'MCC':c;};
  const UNIT_TIER=c=>{c=String(c||'');return (c.startsWith('CBA ')||c.startsWith('MCC '))?c.slice(4):'';};
  const tierOfPrefix=(base,p)=>{p=String(p||'').toUpperCase();if(/EMPURRAD/.test(p))return 'T1';if(base==='CBA'&&/APOIO/.test(p))return 'T1 WH';return 'T2';};
  const getUniLabel=v=>{if(!v)return '';v=String(v);const i=v.lastIndexOf('-');const s=i>=0?v.slice(i+1).trim():v.trim();return s.replace(/\s*\(INATIVO\)\s*/i,'').trim();};
  const getNv3Prefix=v=>v?String(v).split('-')[0].trim():'';
  const unitMatchNv3=(unit,nv3)=>{const b=UNIT_BASE(unit),t=UNIT_TIER(unit);if(getUniLabel(nv3).toUpperCase().trim()!==b)return false;return !t||tierOfPrefix(b,getNv3Prefix(nv3).toUpperCase())===t;};

  /* a ordem das chaves é a ordem dos blocos no Resumo e das opções do filtro
     Pacote — Combustíveis primeiro (Renan, 09/10/2026: "Combustível deve ser a
     primeira linha") */
  const CONTAS={
    /* COMBUSTÍVEIS (Renan, 09/10/2026): o realizado NÃO é lançado — vem sozinho
       dos abastecimentos ENCERRADOS do ERP (erp_abastecimentos, carga diária do
       PowerShell), sem PIS/COFINS, como o DRE. Ver montaComb(). */
    'Combustíveis':['Combustíveis','Arla'],
    'Manutenção':['Manutenção de Veículos e Equip.','Materiais e Ferramentas de Oficina','Lavação de Veículos','Manutenção de Carrocerias','Personalização/Padronização','Contratos de Manutenção Fabricante'],
    'Pneus':['Pneus Novos','Recapagens e Outros Serviços']
  };
  const PACOTES=Object.keys(CONTAS);
  const pacoteDaConta=c=>PACOTES.find(p=>CONTAS[p].includes(c))||'';
  // linha antiga sem pacote gravado: a conta diz qual é; sem conta conhecida, Manutenção
  const pacDe=r=>(r&&r.pacote)||pacoteDaConta(r&&r.conta)||'Manutenção';
  const CONTAS_ALIAS={'Manutenção de Veículos e Equipamentos':'Manutenção de Veículos e Equip.','Consertos e Recapagens de Pneus':'Recapagens e Outros Serviços','Pneus e Camaras':'Pneus Novos','Personalização/Padronização de Veículos':'Personalização/Padronização','Personalização e Padronização de Veículos':'Personalização/Padronização','Combustíveis Veiculos e Equipamentos':'Combustíveis','Combustíveis Veículos e Equipamentos':'Combustíveis','Fluídos (Arla)':'Arla'};
  const canonConta=c=>CONTAS_ALIAS[c]||c;
  // o lançamento só sobe para o Real com NF e valor (o resto ainda está no processo)
  const counts=r=>!!(r&&r.nf&&String(r.nf).trim())&&r.valor>0;
  function doBanco(d){return{id:d.id,origem:d.origem||'',unidade:d.unidade,vigencia:d.vigencia,pacote:d.pacote,data:d.data||'',projeto:d.projeto||'',equipamento:(d.equipamento||''),fornecedor:(d.fornecedor||''),rc:d.rc||'',oc:d.oc||'',nf:d.nf||'',conta:d.conta||'',grupo:d.grupo||'',descricao:d.descricao||'',valor:+d.valor||0,aprovado:!!d.aprovado,aprovado_oc:!!d.aprovado_oc};}

  // ── DRE (Orçado / Remunerado por unidade × conta × vigência) ──
  const SHEET_ID='1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8', TAB_FROTA='Frota';
  const _normEb=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  function ebIdx(h,...names){const nc=h.map(_normEb);for(const n of names){const i=nc.indexOf(_normEb(n));if(i>=0)return i;}for(const n of names){const nn=_normEb(n);const i=nc.findIndex(c=>c.includes(nn));if(i>=0)return i;}return -1;}
  const _numBR=v=>{if(v==null||v==='')return null;if(typeof v==='number')return v;let s=String(v).replace(/\s|R\$/g,'');if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');const f=parseFloat(s);return isNaN(f)?null:f;};
  const _MESN={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
  function _mesNum(m){if(m==null)return null;if(typeof m==='number'&&m>=1&&m<=12)return m;const s=_normEb(m).slice(0,3);if(_MESN[s])return _MESN[s];const n=parseInt(m);return n>=1&&n<=12?n:null;}
  function parseVigD(v){if(v==null)return null;if(v instanceof Date)return v;const s=String(v);let m=s.match(/(\d{1,2})[\/\-](\d{4})/);if(m)return new Date(+m[2],+m[1]-1,1);m=s.match(/(\d{4})[\/\-](\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,1);const d=new Date(s);return isNaN(d)?null:d;}
  function mapTab(h){return{orc:ebIdx(h,'orçado','orcado'),rem:ebIdx(h,'remunerado'),real:ebIdx(h,'realizado'),vig:ebIdx(h,'vigência','vigencia'),nv3:ebIdx(h,'nível 3','nivel 3','nivel3'),cta:ebIdx(h,'conta gerencial','conta'),mes:ebIdx(h,'mês','mes'),ano:ebIdx(h,'ano')};}
  // a URL é a do gviz do Google; nas páginas do portal o assets/gviz-cache.js
  // intercepta o fetch e responde da tabela do banco (sh_dre_frota)
  async function lerAba(sheetId,tab){
    const url=`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
    const res=await fetch(url); const raw=await res.text();
    const json=JSON.parse(raw.replace(/^[\s\S]*?\(/,'').replace(/\);?\s*$/,''));
    let header=(json.table.cols||[]).map(c=>c&&c.label?c.label:'');
    let rows=json.table.rows.map(r=>r.c.map(c=>c&&c.v!=null?c.v:null));
    if(!header.some(x=>_normEb(x).includes('realizado'))&&rows.length){header=rows[0].map(x=>x==null?'':String(x));rows=rows.slice(1);}
    return {header,rows};
  }
  // a aba Frota fica 1 h no localStorage (chave cc_frota_v1, a mesma da Carta
  // desde sempre — as duas telas são da mesma origem e dividem a cópia)
  async function frota(){
    try{const c=JSON.parse(localStorage.getItem('cc_frota_v1')||'null');if(c&&Date.now()-c.t<36e5)return c.d;}catch(e){}
    const d=await lerAba(SHEET_ID,TAB_FROTA);
    try{localStorage.setItem('cc_frota_v1',JSON.stringify({t:Date.now(),d}));}catch(e){}
    return d;
  }
  /* Orç e Rem (tend.) de UMA unidade, somados em `alvo` (objeto conta →
     {orc,rem}). Orç = orçado das vigências pedidas; Rem (tend.) = esse orçado ×
     (remunerado ÷ orçado acumulados nos anos pedidos, só meses com remunerado),
     conta a conta; conta sem histórico usa a proporção geral da unidade. */
  function accDre(rows,m,unit,vigSet,years,projs,alvo){
    const orcMes={}, remAcc={}, orcAcc={};
    (rows||[]).forEach(r=>{
      const nv3=m.nv3>=0?String(r[m.nv3]||''):'';
      if(!unitMatchNv3(unit,nv3))return;
      if(projs && !projs.includes(getNv3Prefix(nv3).toUpperCase()))return;
      let ry=m.ano>=0?parseInt(r[m.ano]):null, rm=m.mes>=0?_mesNum(r[m.mes]):null;
      if((!ry||!rm)&&m.vig>=0){const d=parseVigD(r[m.vig]);if(d){ry=d.getFullYear();rm=d.getMonth()+1;}}
      if(!ry||!rm)return;
      const conta=canonConta(m.cta>=0?(r[m.cta]||''):'');
      const o=Math.abs(_numBR(m.orc>=0?r[m.orc]:null)||0);
      const rr=_numBR(m.rem>=0?r[m.rem]:null);
      const ym=ry+'-'+String(rm).padStart(2,'0');
      if(vigSet.has(ym)) orcMes[conta]=(orcMes[conta]||0)+o;
      if(years.has(String(ry)) && rr!=null){ orcAcc[conta]=(orcAcc[conta]||0)+o; remAcc[conta]=(remAcc[conta]||0)+Math.abs(rr); }
    });
    let tR=0,tO=0; for(const c in remAcc){tR+=remAcc[c];tO+=orcAcc[c];}
    const overall=tO?tR/tO:1;
    for(const c in orcMes){
      const ratio=orcAcc[c]?remAcc[c]/orcAcc[c]:overall;
      if(!alvo[c])alvo[c]={orc:0,rem:0};
      alvo[c].orc+=orcMes[c];
      alvo[c].rem+=orcMes[c]*ratio;
    }
    return alvo;
  }

  // ── banco ──
  // o PostgREST corta a resposta em 1.000 linhas e ignora um limit maior;
  // a 1ª página traz a contagem e as outras saem TODAS de uma vez
  async function pgAll(sb,tabela,select,ordem,ajuste){
    const passo=1000;
    const q=()=>{ let x=sb.from(tabela).select(select,{count:'exact'});
      if(ajuste) x=ajuste(x);
      if(ordem) ordem.forEach(o=>{ x=x.order(o[0],{ascending:o[1]!==false}); }); return x; };
    const p0=await q().range(0,passo-1);
    if(p0.error) throw p0.error;
    const total=p0.count||0, out=p0.data||[];
    const resto=[]; for(let off=passo;off<total;off+=passo) resto.push(q().range(off,off+passo-1));
    for(const r of await Promise.all(resto)){ if(r.error) throw r.error; out.push(...(r.data||[])); }
    return out;
  }
  /* LANÇAMENTOS — PAGINADO (bug real, 05/09/2026): o PostgREST devolve no
     máximo 1.000 linhas por pedido, sem erro. Devolve {data, erro}: as linhas
     já no formato da tela (doBanco). */
  async function lerLancamentos(sb,units,vigs){
    const data=[]; let erro=null;
    for(let off=0;;off+=1000){
      const r=await sb.from('carta_custos').select('*').in('unidade',units).in('vigencia',vigs)
        .order('data',{ascending:false}).order('created_at',{ascending:false}).range(off,off+999);
      if(r.error){ erro=r.error; break; }
      data.push(...(r.data||[]));
      if(!r.data||r.data.length<1000) break;
    }
    return {data:erro?[]:data.map(doBanco), erro};
  }

  /* ── COMBUSTÍVEIS — realizado dos abastecimentos do ERP (Renan, 09/10/2026)
     Validado contra o Qlik (relatório de OS encerradas) e o DRE, jan→ago/2026:
     só OS ENCERRADAS, o ERP bate com o Qlik (100,9% diesel · 101,0% Arla) e,
     sem PIS/COFINS, com o DRE (101,6% · 100,8%). As regras:
     · só encerrada = 'S' (a OS aberta ainda muda);
     · unidade e projeto pelo PROJETO DA OS ('ROTA - CBA'), o mesmo formato do
       Nível 3 do DRE — por isso o unitMatchNv3 e o tier de CBA/MCC valem igual;
     · SÓ DIESEL E ARLA: Arla → conta Arla, diesel → conta Combustíveis;
     · PREÇO ABSURDO (R$/L fora de 1,50 a 12) entra por litros × preço mediano
       do mesmo combustível na mesma filial e mês (r.corrigido);
     · PIS/COFINS 9,25% sai de tudo, MENOS Campo Grande (diesel e Arla) e o
       diesel de Florianópolis — as duas têm tanque interno. ── */
  const PISCOFINS=0.0925;
  const COMB_RL_MIN=1.5, COMB_RL_MAX=12;
  const semPisCofins=(unit,conta)=>{const b=UNIT_BASE(unit);return b==='CGR'||(b==='FLP'&&conta==='Combustíveis');};
  function combProduto(t){
    const n=_normEb(t);
    if(!n) return null;
    if(n.includes('arla')) return {conta:'Arla',grupo:'Arla 32'};
    if(n.includes('diesel')){
      const adit=n.includes('adit');
      return {conta:'Combustíveis',grupo:n.includes('s10')?(adit?'Diesel S10 Aditivado':'Diesel S10'):(adit?'Diesel Aditivado':'Diesel')};
    }
    return null;   // gasolina, GLP, etc.: fora
  }
  // o projeto da OS de Goiânia vem com o código GOI; no portal é GNA
  const combNv3=p=>String(p||'').replace(/-\s*GOI\s*$/i,'- GNA');
  // [ini, fim) das datas que cobrem as vigências (AAAA-MM)
  function combJanela(vigs){
    vigs=vigs.slice().sort();
    const ini=vigs[0]+'-01';
    const [ay,am]=vigs[vigs.length-1].split('-').map(Number);
    const fim=am===12?(ay+1)+'-01-01':ay+'-'+String(am+1).padStart(2,'0')+'-01';
    return {ini,fim};
  }
  // linhas cruas do erp_abastecimentos → uma linha por abastecimento que entra
  function montaComb(lin,units,vigs){
    const out=[];
    const vigSet=new Set(vigs);
    const base=[];
    (lin||[]).forEach(r=>{
      const vig=String(r.data||'').slice(0,7); if(!vigSet.has(vig)) return;
      const pr=combProduto(r.tipo_combustivel); if(!pr) return;
      const nv3=combNv3(r.projeto_os);
      const unit=units.find(u=>unitMatchNv3(u,nv3)); if(!unit) return;
      const litros=+r.litros||0, valor=+r.valor||0;
      base.push({r,vig,pr,nv3,unit,litros,valor,rl:litros>0?valor/litros:null});
    });
    // preço mediano por filial × combustível × mês, para os preços absurdos
    const med=xs=>{ if(!xs.length) return null; const s=xs.slice().sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
    const fora=b=>(b.rl==null||b.rl<COMB_RL_MIN||b.rl>COMB_RL_MAX);
    const pf=new Map(), pg=new Map();
    base.forEach(b=>{ if(fora(b)||b.rl==null) return;
      const k1=b.r.filial+'|'+b.pr.grupo+'|'+b.vig, k2=b.pr.grupo+'|'+b.vig;
      (pf.get(k1)||pf.set(k1,[]).get(k1)).push(b.rl); (pg.get(k2)||pg.set(k2,[]).get(k2)).push(b.rl); });
    base.forEach(b=>{
      let valor=b.valor, corrigido=false;
      if(fora(b)){
        const p=med(pf.get(b.r.filial+'|'+b.pr.grupo+'|'+b.vig)||[])||med(pg.get(b.pr.grupo+'|'+b.vig)||[]);
        if(p==null||!(b.litros>0)) return;
        valor=b.litros*p; corrigido=true;
      }
      const liq=semPisCofins(b.unit,b.pr.conta)?valor:valor*(1-PISCOFINS);
      out.push({origem:'erp-combustivel',unidade:b.unit,vigencia:b.vig,pacote:'Combustíveis',
        data:String(b.r.data||'').slice(0,10),projeto:getNv3Prefix(b.nv3).toUpperCase(),
        equipamento:String(b.r.placa_origem||b.r.placa||'').toUpperCase(),fornecedor:'',
        conta:b.pr.conta,grupo:b.pr.grupo,litros:b.litros,valor:liq,
        os:b.r.ordem_servico,corrigido,valorErp:b.valor,filial:b.r.filial||''});
    });
    return out;
  }
  // lê e monta; erro do banco SOBE (quem chama decide como avisar)
  async function lerComb(sb,units,vigs){
    vigs=vigs.slice().sort();
    const {ini,fim}=combJanela(vigs);
    const lin=await pgAll(sb,'erp_abastecimentos','ordem_servico,data,placa_origem,placa,filial,projeto_os,litros,valor,tipo_combustivel',
      [['data'],['ordem_servico']], q=>q.eq('encerrada','S').gte('data',ini).lt('data',fim));
    return montaComb(lin,units,vigs);
  }

  /* ── CONTRATO DE MANUTENÇÃO ──
     A conta "Contratos de Manutenção Fabricante" tem duas origens, e elas NÃO
     se somam no mesmo mês: mês FECHADO = linhas da planilha Contratos Man. já
     gravadas em carta_custos (origem 'contratos-planilha'); mês ainda SEM
     fechamento = a prévia pelo km real do ERP (view custo_vigencia). */
  const CONTA_CONTRATO='Contratos de Manutenção Fabricante';
  /* AS COLUNAS NOVAS PODEM NÃO ESTAR NO BANCO AINDA — pedir coluna que não
     existe faz o PostgREST devolver 400 e a leitura toda falharia. Por isso
     ela desce em degraus: tudo, só o número do contrato, e o mínimo. */
  const DEGRAUS_CONTRATO=[['contrato','hodo_abast','hodo_contrato','km_vw','valor_vw','faixas_vw','faixa_vw'],
                          ['contrato','hodo_abast','hodo_contrato','km_vw','valor_vw','faixas_vw'],
                          ['contrato'],
                          []];
  /* lê a custo_vigencia_mv (pronta, instantânea) e cai na view se ela não
     existir. Devolve {rows, num, vw, fx}: quais degraus o banco aceitou. */
  async function lerContratos(sb,o){
    const ordem=[['vig_cobranca',false],['custo_vig',false]];
    const ajuste=o&&o.ajuste;
    const leTudo=async(cols)=>{
      try{ return await pgAll(sb,'custo_vigencia_mv',cols,ordem,ajuste); }
      catch(e){ if(e.code==='42703') throw e;   // coluna que não existe: nem tenta a view
        console.warn('custo_vigencia_mv indisponível, usando a view:',e.message);
        return await pgAll(sb,'custo_vigencia',cols,ordem,ajuste); }
    };
    let rows=[], num=false, vw=false, fx=false;
    for(const extra of DEGRAUS_CONTRATO){
      try{
        rows=await leTudo(o.base+extra.map(c=>','+c).join(''));
        num=extra.includes('contrato');
        vw =extra.includes('hodo_abast');
        fx =extra.includes('faixa_vw');
        break;
      }catch(e){
        rows=[];
        if(e.code!=='42703' && !/column .* does not exist/i.test(e.message||'')){
          console.warn('custo_vigencia:',e.message); break;
        }
        console.warn(`custo_vigencia ainda sem [${extra.join(', ')}] — seguindo sem elas:`,e.message);
      }
    }
    return {rows,num,vw,fx};
  }
  // as linhas da planilha Contratos Man. (por vigência, da mais antiga à mais nova)
  function lerPlanilhaContrato(sb,units){
    return pgAll(sb,'carta_custos','unidade,vigencia,equipamento,valor',[['vigencia',true]],
      q=>q.eq('origem','contratos-planilha').in('unidade',units));
  }
  /* SOBREPOSIÇÃO (muda as linhas no lugar):
     · O PORTAL DA VW MANDA, DE FEVEREIRO EM DIANTE (Renan, 15/09/2026): o valor
       é o da nota que a VW emitiu. Janeiro não existe no portal (causa
       desconhecida), por isso o corte é explícito (VW_INI).
     · MÊS QUE A PLANILHA TEM, VALE A PLANILHA — sem conta (Renan, 05/09/2026):
       custo da placa = o da planilha (zero se ela não está lá) e deixa de ser
       prévia.
     · O FIXO DA PRÉVIA É O DO MÊS ANTERIOR (Renan, 05/09/2026): o último valor
       que a planilha cobrou na placa (`plan` vem ordenado por vigência). */
  const VW_INI='2026-02';
  function sobrepoeContrato(rows,plan,vw){
    const cobre=new Set(), val=new Map(), ultFixo=new Map();
    plan.forEach(r=>{ cobre.add(r.unidade+'|'+r.vigencia);
      const pl=String(r.equipamento||'').toUpperCase();
      val.set(r.vigencia+'|'+pl,(val.get(r.vigencia+'|'+pl)||0)+(+r.valor||0)); });
    plan.forEach(r=>ultFixo.set(String(r.equipamento||'').toUpperCase(),+r.valor||0));
    rows.forEach(r=>{
      const pl=String(r.placa_origem||r.placa).toUpperCase();
      if(vw && r.valor_vw!=null && r.vig_cobranca>=VW_INI){
        r.custo_vig=+r.valor_vw||0; r.previa=false; r.origem='portal VW';
      }else if(cobre.has(r.unidade+'|'+r.vig_cobranca)){
        r.custo_vig=val.get(r.vig_cobranca+'|'+pl)||0; r.previa=false; r.origem='planilha';
      }else if(r.tipo==='fixo' && ultFixo.has(pl)){
        r.custo_vig=ultFixo.get(pl); r.origem='fixo do mês anterior';
      }
    });
    return rows;
  }
  // recorte do contrato: unidades, vigências (de cobrança), projetos e contratos.
  // Placa sem projeto entra em qualquer filtro de projeto (é assim na Carta).
  function contrDoRecorte(rows,{units,vigs,projs,contratos}){
    const u=new Set(units), v=new Set(vigs), p=projs;
    return rows.filter(r=>u.has(r.unidade) && v.has(r.vig_cobranca)
      && (!p || !r.projeto || p.includes(String(r.projeto).toUpperCase()))
      && (!contratos || !contratos.size || contratos.has(r.contrato||'—')));
  }
  // prévia = placas do recorte cuja unidade+vigência a planilha ainda não fechou
  // (o fechamento se vê nos lançamentos da Carta com origem 'contratos-planilha')
  function previaLinhas(contrRecorte,lancamentos){
    const fechados=new Set((lancamentos||[]).filter(r=>r.origem==='contratos-planilha').map(r=>r.unidade+'|'+r.vigencia));
    return contrRecorte.filter(r=>!fechados.has(r.unidade+'|'+r.vig_cobranca));
  }
  const somaPrevia=linhas=>linhas.reduce((s,r)=>s+(+r.custo_vig||0),0);

  /* ── O RESUMO GERENCIAL ──
     Um bloco por pacote: as contas do pacote (mais as que aparecerem nos
     lançamentos), Real = lançamentos que contam + a prévia do contrato (só em
     Manutenção) + o combustível do ERP (só em Combustíveis); Orç e Rem do DRE
     (null quando a conta não tem DRE). `rows` e `comb` já vêm recortados por
     quem chama (projeto e filtros da tela). */
  function resumoPacotes({pacs,rows,comb,previa,dre}){
    pacs=pacs||PACOTES;
    return pacs.map(pac=>{
      const byC=new Map(CONTAS[pac].map(c=>[c,0]));
      (rows||[]).filter(r=>pacDe(r)===pac&&counts(r)).forEach(r=>byC.set(r.conta,(byC.get(r.conta)||0)+r.valor));
      if(pac==='Manutenção'){
        const prev=+previa||0;
        if(prev>0) byC.set(CONTA_CONTRATO,(byC.get(CONTA_CONTRATO)||0)+prev);
      }
      if(pac==='Combustíveis') (comb||[]).forEach(r=>byC.set(r.conta,(byC.get(r.conta)||0)+r.valor));
      let tR=0,tO=0,tRe=0,tHas=false;
      const contas=[...byC.entries()].map(([conta,real])=>{
        const d=dre&&dre[conta]; const orc=d?d.orc:null, rem=d?d.rem:null;
        tR+=real; if(d){tO+=orc;tRe+=rem;tHas=true;}
        return {conta,orc,rem,real};
      });
      return {pac,contas,tot:{orc:tHas?tO:null,rem:tHas?tRe:null,real:tR,has:tHas}};
    });
  }

  // mês corrente no horário de Brasília (AAAA-MM)
  function mesCorrenteBR(agora){
    try{
      const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(agora||new Date());
      return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value;
    }catch(e){ const d=agora||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  }

  /* ── A CARTA DE UM MÊS INTEIRO (o que o Gestão à Vista mostra) ──
     Para cada unidade, o Resumo Gerencial da Carta com AQUELA unidade e AQUELA
     vigência no filtro e nada mais (porUnidade); e, dentro dela, o mesmo
     Resumo com o filtro Projeto em cada projeto (porProjeto). As leituras são
     as da Carta (lançamentos, DRE, abastecimentos, contrato) e a conta é a
     resumoPacotes. Cada fonte que falha vira um aviso em `erros` e o resto
     segue (como na Carta: banco fora no combustível não some com Manutenção).
     ATENÇÃO à soma dos projetos: ela NÃO precisa bater com a unidade — o Rem
     (tend.) usa a proporção rem ÷ orç de cada recorte, lançamento sem projeto
     só entra na unidade e placa de contrato sem projeto entra em todo projeto
     (é o que a Carta mostra quando se filtra o projeto). */
  async function cartaMes(sb,{units,vig,planUnits}){
    const erros=[];
    const vigs=[vig], vigSet=new Set(vigs), years=new Set([vig.slice(0,4)]);
    const [fr,lanc,comb,contr]=await Promise.all([
      frota().catch(e=>{erros.push('DRE (aba Frota): '+(e&&e.message||e));return null;}),
      lerLancamentos(sb,units,vigs).then(r=>{if(r.erro)erros.push('lançamentos: '+r.erro.message);return r.data;}),
      lerComb(sb,units,vigs).catch(e=>{erros.push('abastecimentos do ERP: '+(e&&e.message||e));return [];}),
      (async()=>{
        // só a vigência pedida: a sobreposição é linha a linha, então ler as
        // outras vigências não muda nada aqui (a Carta lê todas para a visão
        // Placas Contrato)
        const c=await lerContratos(sb,{base:'vig_cobranca,vig_km,placa,placa_origem,unidade,projeto,tipo,custo_vig,previa',ajuste:q=>q.eq('vig_cobranca',vig)});
        const uni=planUnits||units, perm=new Set(uni);
        const rows=c.rows.filter(r=>!r.unidade||perm.has(r.unidade));
        try{ sobrepoeContrato(rows,await lerPlanilhaContrato(sb,uni),c.vw); }
        catch(e){ console.warn('planilha do contrato indisponível, ficou o cálculo:',e.message); }
        return rows;
      })().catch(e=>{erros.push('contrato: '+(e&&e.message||e));return [];})
    ]);
    const m=fr?mapTab(fr.header):null;
    const dreDe=(u,projs)=>{const d={};if(fr)accDre(fr.rows,m,u,vigSet,years,projs,d);return d;};
    const um=(u,projs)=>{
      const ls=lanc.filter(r=>r.unidade===u&&(!projs||projs.includes(r.projeto)));
      const cb=comb.filter(r=>r.unidade===u&&(!projs||projs.includes(r.projeto)));
      // a prévia olha o fechamento em TODOS os lançamentos da unidade no mês
      const pv=somaPrevia(previaLinhas(contrDoRecorte(contr,{units:[u],vigs,projs}),lanc.filter(r=>r.unidade===u)));
      return resumoPacotes({pacs:PACOTES,rows:ls,comb:cb,previa:pv,dre:dreDe(u,projs)});
    };
    const vazio=bl=>bl.every(b=>!b.tot.real&&!b.tot.orc&&!b.tot.rem);
    const porUnidade={}, porProjeto={};
    units.forEach(u=>{
      const bl=um(u,null); if(vazio(bl)) return;
      porUnidade[u]=bl;
      // projetos do mês: os do DRE com linha na vigência, dos lançamentos, do
      // combustível e do contrato
      const ps=new Set();
      if(fr) fr.rows.forEach(r=>{const nv3=m.nv3>=0?String(r[m.nv3]||''):'';if(!unitMatchNv3(u,nv3))return;
        let ry=m.ano>=0?parseInt(r[m.ano]):null, rm=m.mes>=0?_mesNum(r[m.mes]):null;
        if((!ry||!rm)&&m.vig>=0){const d=parseVigD(r[m.vig]);if(d){ry=d.getFullYear();rm=d.getMonth()+1;}}
        if(ry&&rm&&vigSet.has(ry+'-'+String(rm).padStart(2,'0'))){const p=getNv3Prefix(nv3).toUpperCase();if(p)ps.add(p);}});
      lanc.forEach(r=>{if(r.unidade===u&&r.projeto)ps.add(r.projeto);});
      comb.forEach(r=>{if(r.unidade===u&&r.projeto)ps.add(r.projeto);});
      contr.forEach(r=>{if(r.unidade===u&&r.projeto)ps.add(String(r.projeto).toUpperCase());});
      const pp={};
      [...ps].sort().forEach(p=>{const b=um(u,[p]); if(!vazio(b)) pp[p]=b;});
      porProjeto[u]=pp;
    });
    return {vig,porUnidade,porProjeto,erros};
  }

  window.CartaCalc={
    DEPARA,UNIT_BASE,UNIT_TIER,tierOfPrefix,getUniLabel,getNv3Prefix,unitMatchNv3,
    CONTAS,PACOTES,pacoteDaConta,pacDe,CONTAS_ALIAS,canonConta,counts,doBanco,
    SHEET_ID,TAB_FROTA,_normEb,ebIdx,_numBR,_MESN,_mesNum,parseVigD,mapTab,lerAba,frota,accDre,
    pgAll,lerLancamentos,
    PISCOFINS,COMB_RL_MIN,COMB_RL_MAX,semPisCofins,combProduto,combNv3,combJanela,montaComb,lerComb,
    CONTA_CONTRATO,DEGRAUS_CONTRATO,VW_INI,lerContratos,lerPlanilhaContrato,sobrepoeContrato,contrDoRecorte,previaLinhas,somaPrevia,
    resumoPacotes,mesCorrenteBR,cartaMes
  };
})();
