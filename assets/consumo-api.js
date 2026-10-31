/* ══════════════════════════════════════════════════════════════
   CONSUMO PELAS APIs (Renan, 31/10/2026: "Faça um painel Preço e Km/L ali
   também, igual o que vem do ERP" → "Cadê remunerado? Cadê padrão").

   Os painéis Eficiência Km/L e Preço R$/L leem a aba Km/L (montada do ERP pelo
   consumo automático). Com ?fonte=api na URL, este arquivo troca SÓ O REALIZADO
   pelo dos sistemas de abastecimento (tabela abast_api: Pró-Frotas, SUMA,
   Gasola) e mantém o remunerado, o projeto, o modelo e o resto da linha da aba
   — então hero, cards, gráficos, tabelas, impacto e YTD são os mesmos do painel.
   A Integração Abastecimentos abre os dois painéis assim, dentro dela
   (?fonte=api&embed=1: sem a lateral e sem a moldura).

   Regras (as mesmas do consumo do ERP):
   · só DIESEL, só abastecimento válido, de 2026;
   · km = hodômetro do abastecimento − hodômetro do diesel anterior da mesma
     placa (os três sistemas juntos), valendo de 1 a 3.000 km; o 1º
     abastecimento de cada placa não tem anterior e fica fora;
   · Km/L: Σ km ÷ Σ litros dos abastecimentos que têm km;
   · R$/L: Σ valor ÷ Σ litros de todos os abastecimentos de diesel (menos o 1º
     de cada placa); preço fora de R$ 1,50 a 12 entra pelo mediano do mesmo
     combustível, unidade e mês (a regra da Carta);
   · projeto, modelo, tipo e remunerado vêm da linha da aba da mesma placa e
     mês; placa que não está na aba naquele mês usa a linha mais próxima da
     placa e o remunerado do projeto no mês; placa que nunca esteve na aba
     (Seara, por exemplo) fica fora, contada em info.semProjeto.
   ══════════════════════════════════════════════════════════════ */
(function(){
  const q=location.search;
  const API=/[?&]fonte=api\b/.test(q), EMBED=/[?&]embed=1\b/.test(q);
  if(EMBED){
    document.documentElement.classList.add('embed');
    const st=document.createElement('style');
    st.textContent='html.embed,html.embed body{background:transparent!important;}'
      +'html.embed body::after,html.embed .app::before,html.embed .side{display:none!important;}'
      +'html.embed .app{inset:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}'
      +'html.embed .board{padding-left:4px!important;}'
      // embutido, o painel fica uns 280 px mais estreito (sem a lateral) e cairia no corte de 1100 px dos cards
      +'@media(min-width:861px){html.embed .kpis.k4{grid-template-columns:repeat(4,minmax(0,1fr))!important;}}';
    document.head.appendChild(st);
  }
  const SB='https://lozwipoeacpvplgkrxkq.supabase.co', KEY='sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
  function token(){ try{ const t=JSON.parse(localStorage.getItem('sb-lozwipoeacpvplgkrxkq-auth-token')||'null'); return t&&t.access_token||null; }catch(e){ return null; } }
  async function leApi(){
    const tk=token(); if(!tk) throw new Error('sem login do hub');
    const h={apikey:KEY,Authorization:'Bearer '+tk};
    const cols='sistema,id_origem,item,dia,unidade,placa,produto,litros,valor,hodometro';
    const out=[]; let passo=null;
    for(let off=0;off<400000;){
      const u=`${SB}/rest/v1/abast_api?select=${cols}&valido=eq.true&dia=gte.2026-01-01&order=sistema,id_origem,item&offset=${off}&limit=10000`;
      const r=await fetch(u,{headers:h}); if(!r.ok) throw new Error('abast_api: HTTP '+r.status);
      const d=await r.json(); out.push(...d);
      if(passo==null) passo=d.length||1;
      if(d.length<passo||!d.length) break;
      off+=d.length;
    }
    return out;
  }
  const MERC='ABCDEFGHIJ';
  const placaKey=p=>{ const x=String(p||'').toUpperCase().replace(/[^A-Z0-9]/g,''); return /^[A-Z]{3}\d{4}$/.test(x)?x.slice(0,4)+MERC[+x[4]]+x.slice(5):x; };
  const MESES={jan:0,fev:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,out:9,nov:10,dez:11};
  function ymDe(v){
    if(!v) return null;
    if(v instanceof Date) return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0');
    const s=String(v); let m;
    if((m=s.match(/^Date\((\d+),(\d+)/))) return m[1]+'-'+String(+m[2]+1).padStart(2,'0');
    if((m=s.match(/^(\d{4})-(\d{2})/))) return m[1]+'-'+m[2];
    if((m=s.match(/^(\d{1,2})\/(\d{4})$/))) return m[2]+'-'+String(+m[1]).padStart(2,'0');
    if((m=s.match(/^([a-zç]+)\.?\/(\d{4})$/i))&&MESES[m[1].toLowerCase().slice(0,3)]!=null) return m[2]+'-'+String(MESES[m[1].toLowerCase().slice(0,3)]+1).padStart(2,'0');
    if(typeof v==='number'){ const d=new Date(1899,11,30); d.setDate(d.getDate()+Math.round(v)); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
    return null;
  }
  const vigCel=ym=>`Date(${+ym.slice(0,4)},${+ym.slice(5,7)-1},1)`;
  const med=xs=>{ if(!xs||!xs.length) return null; const s=xs.slice().sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  const media=xs=>xs&&xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:null;
  const r4=v=>v==null||!isFinite(v)?null:Math.round(v*1e4)/1e4;

  // a conta, separada da leitura (o teste chama direto)
  function calcula(linhasApi, src, modo){
    // posições da aba Km/L (A…Z), as mesmas nos dois painéis
    const C={vig:0,rskmRem:1,rskmReal:2,dRskm:3,rem:4,remM:5,real:6,dKml:7,rslRem:8,rslReal:9,dRsl:10,proj:14,placa:16,fuel:20,km:22,lit:23,vmed:24,tot:25};
    // 1) abastecimentos de diesel com preço saneado
    const ab=[];
    linhasApi.forEach(x=>{ const dia=String(x.dia||'').slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
      const prod=String(x.produto||'').toUpperCase(); if(!/DIESEL/.test(prod)) return;
      const lit=+x.litros||0, val=+x.valor||0; if(!(lit>0)) return;
      ab.push({pk:placaKey(x.placa),dia,ym:dia.slice(0,7),uni:x.unidade||'',prod,lit,val,hod:+x.hodometro>0?+x.hodometro:null}); });
    const fora=a=>{ const p=a.val/a.lit; return !(p>=1.5&&p<=12); };
    const pf=new Map(), pg=new Map();
    ab.forEach(a=>{ if(fora(a)) return; const k1=a.prod+'|'+a.uni+'|'+a.ym, k2=a.prod+'|'+a.ym;
      (pf.get(k1)||pf.set(k1,[]).get(k1)).push(a.val/a.lit); (pg.get(k2)||pg.set(k2,[]).get(k2)).push(a.val/a.lit); });
    let corrigidos=0;
    ab.forEach(a=>{ if(!fora(a)) return; const p=med(pf.get(a.prod+'|'+a.uni+'|'+a.ym))||med(pg.get(a.prod+'|'+a.ym)); if(p!=null){ a.val=a.lit*p; corrigidos++; } else a.semPreco=true; });
    // 2) km pelo hodômetro, por placa, em ordem de dia e hodômetro
    const porPlaca=new Map(); ab.forEach(a=>{ if(a.pk) (porPlaca.get(a.pk)||porPlaca.set(a.pk,[]).get(a.pk)).push(a); });
    porPlaca.forEach(xs=>{ xs.sort((a,b)=>a.dia.localeCompare(b.dia)||((a.hod==null)-(b.hod==null))||(a.hod-b.hod));
      let ant=null, primeiro=true;
      xs.forEach(a=>{ a.primeiro=primeiro; primeiro=false; a.km=null;
        if(a.hod!=null){ if(ant!=null){ const d=a.hod-ant; if(d>0&&d<=3000) a.km=d; } ant=a.hod; } }); });
    // 3) placa × mês
    const pm=new Map(); let ate='';
    ab.forEach(a=>{ if(a.primeiro) return; const k=a.pk+'|'+a.ym; const g=pm.get(k)||{pk:a.pk,ym:a.ym,km:0,litKm:0,valKm:0,lit:0,val:0,n:0};
      g.n++; if(!a.semPreco){ g.lit+=a.lit; g.val+=a.val; } if(a.km!=null){ g.km+=a.km; g.litKm+=a.lit; g.valKm+=a.val; } pm.set(k,g); if(a.dia>ate) ate=a.dia; });
    // 4) a aba: placa × mês, placa, projeto × mês
    const byPY=new Map(), byP=new Map(), pj=new Map();
    (src.rows||[]).forEach(r=>{ const ym=ymDe(r[C.vig]), pk=placaKey(r[C.placa]); if(!ym||!pk) return;
      byPY.set(pk+'|'+ym,r); (byP.get(pk)||byP.set(pk,[]).get(pk)).push({ym,r});
      const p=String(r[C.proj]||'').trim(); if(!p) return; const k=p+'|'+ym; const g=pj.get(k)||{rem:[],rsl:[]};
      if(+r[C.rem]>0) g.rem.push(+r[C.rem]); if(+r[C.rslRem]>0) g.rsl.push(+r[C.rslRem]); pj.set(k,g); });
    const semProj=new Set(); const rows=[];
    pm.forEach(g=>{
      let t=byPY.get(g.pk+'|'+g.ym), proprio=!!t;
      if(!t){ const xs=byP.get(g.pk); if(!xs){ semProj.add(g.pk); return; }
        // a linha mais próxima: o mês anterior mais recente; senão o primeiro depois
        const ant=xs.filter(x=>x.ym<g.ym).sort((a,b)=>b.ym.localeCompare(a.ym))[0], dep=xs.filter(x=>x.ym>g.ym).sort((a,b)=>a.ym.localeCompare(b.ym))[0];
        t=(ant||dep).r; }
      const r=t.slice(); r[C.vig]=vigCel(g.ym);
      if(!proprio){ const pr=pj.get(String(r[C.proj]||'').trim()+'|'+g.ym);
        r[C.rem]=pr?r4(media(pr.rem)):null; r[C.rslRem]=pr?r4(media(pr.rsl)):null; r[C.remM]=null; }
      const kmlMode=modo!=='preco';
      const lit=kmlMode?g.litKm:g.lit, val=kmlMode?g.valKm:g.val;
      const real=g.litKm>0?g.km/g.litKm:null, rsl=lit>0?val/lit:null, rskm=g.km>0?g.valKm/g.km:null;
      r[C.km]=Math.round(g.km*100)/100; r[C.lit]=Math.round(lit*100)/100; r[C.tot]=Math.round(val*100)/100;
      r[C.real]=r4(real); r[C.rslReal]=r4(rsl); r[C.vmed]=r4(rsl); r[C.rskmReal]=r4(rskm);
      const rem=+r[C.rem]||null, rslRem=+r[C.rslRem]||null;
      r[C.rskmRem]=(rem&&rslRem)?r4(rslRem/rem):null;
      r[C.dKml]=(rem&&real!=null)?r4(real-rem):null;
      r[C.dRsl]=(rslRem&&rsl!=null)?r4(rsl-rslRem):null;
      r[C.dRskm]=(r[C.rskmRem]!=null&&rskm!=null)?r4(rskm-r[C.rskmRem]):null;
      if(!r[C.fuel]) r[C.fuel]='DIESEL S10';
      rows.push(r);
    });
    rows.sort((a,b)=>String(ymDe(a[C.vig])).localeCompare(String(ymDe(b[C.vig])))||String(a[C.proj]).localeCompare(String(b[C.proj]))||String(a[C.placa]).localeCompare(String(b[C.placa])));
    return {cols:src.cols,rows,info:{abastecimentos:ab.length,placaMes:pm.size,linhas:rows.length,semProjeto:semProj.size,corrigidos,ate}};
  }
  async function monta(src,opt){ const a=await leApi(); return calcula(a,src,(opt&&opt.modo)||'kml'); }
  window.ConsumoApi={ativo:API,embed:EMBED,monta,calcula,placaKey,ymDe};
})();
