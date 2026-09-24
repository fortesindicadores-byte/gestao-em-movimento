/* ============================================================================
   correlacoes-quadrante.js — o gráfico de QUADRANTES dos painéis de Correlações
   (Renan, 23/09/2026: "um gráfico com quadrantes e duas variáveis, a exemplo
   do CTO/ROB… quatro quadrantes e onde é melhor estar… dá para escolher as
   variáveis").

   Duas variáveis à escolha (X e Y), UM PONTO POR ENTIDADE (unidade, placa ou
   motorista — a média dos meses do recorte, via CorrDados.porEntidade), duas
   linhas de referência (média ou mediana da rede) cortando o gráfico em quatro
   quadrantes, e "onde é melhor estar" sai da DIREÇÃO de cada variável
   (`dir:'up'` maior é melhor · `dir:'down'` menor é melhor — está no catálogo
   do correlacoes-dados.js). Variável sem direção (km rodado, viagens…) mostra
   os quadrantes sem apontar o melhor.

   Quem usa: /correlacoes/ (admin, todas as unidades em laranja) e
   /correlacoes-operacao/ (a unidade do perfil em laranja, a rede em cinza).
   Uso:
     const q = CorrQuad.monta(CorrDados.porEntidade(rows), vx, vy, {ref:'media'|'mediana'});
     CorrQuad.desenha(canvas, q, vx, vy, {Chart, estilo, fmtVar, destaque:p=>bool, rotulo:p=>string, plugDL});
   ============================================================================ */
(function(global){
'use strict';
const fin=v=>typeof v==='number'&&isFinite(v);
const media=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const mediana=a=>{ const s=a.slice().sort((x,y)=>x-y), n=s.length; return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):NaN; };
const QUADS=['pp','pm','mp','mm'];   // 1º caractere = X (p = acima da referência) · 2º = Y

/* monta: pontos, referências, quadrante de cada ponto, melhor e pior */
function monta(ents,vx,vy,{ref='media'}={}){
  const pts=ents.filter(e=>fin(e.v[vx.id])&&fin(e.v[vy.id])).map(e=>Object.assign({},e,{x:e.v[vx.id],y:e.v[vy.id]}));
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const rx=ref==='mediana'?mediana(xs):media(xs), ry=ref==='mediana'?mediana(ys):media(ys);
  pts.forEach(p=>{ p.q=(p.x>=rx?'p':'m')+(p.y>=ry?'p':'m'); });
  const rot={}; QUADS.forEach(k=>{ rot[k]=`${k[0]==='p'?'+':'−'} ${vx.ab} · ${k[1]==='p'?'+':'−'} ${vy.ab}`; });
  let melhor=null, pior=null;
  if(vx.dir&&vy.dir){ const bx=vx.dir==='up'?'p':'m', by=vy.dir==='up'?'p':'m'; melhor=bx+by; pior=(bx==='p'?'m':'p')+(by==='p'?'m':'p'); }
  const cont={pp:0,pm:0,mp:0,mm:0}; pts.forEach(p=>{ cont[p.q]++; });
  const ordem=melhor?[melhor].concat(QUADS.filter(k=>k!==melhor&&k!==pior),[pior]):QUADS.slice();
  const semDir=[vx,vy].filter(v=>!v.dir).map(v=>v.ab);
  // "quão bem" cada ponto está: distância assinada à referência, na direção boa, em desvios-padrão (só para ordenar a tabela)
  const sd=a=>{ const m=media(a); return Math.sqrt(media(a.map(x=>(x-m)*(x-m))))||1; };
  const sx=sd(xs), sy=sd(ys);
  pts.forEach(p=>{ const gx=vx.dir?((p.x-rx)/sx)*(vx.dir==='up'?1:-1):0, gy=vy.dir?((p.y-ry)/sy)*(vy.dir==='up'?1:-1):0; p.escore=gx+gy; });
  return {pts,rx,ry,rot,melhor,pior,cont,ordem,ref,n:pts.length,semDir,QUADS};
}
/* classe de um quadrante: 'melhor' · 'pior' · '' */
const classe=(q,k)=>k===q.melhor?'melhor':k===q.pior?'pior':'';

/* plugin do Chart.js: tinta do melhor/pior, linhas de referência e rótulos nos cantos */
const plugin={ id:'quad',
  beforeDatasetsDraw(ch,args,o){
    if(!o||!fin(o.rx)||!fin(o.ry)) return;
    const {ctx,chartArea:a}=ch, x=ch.scales.x, y=ch.scales.y; if(!x||!y) return;
    const px=Math.min(a.right,Math.max(a.left,x.getPixelForValue(o.rx))), py=Math.min(a.bottom,Math.max(a.top,y.getPixelForValue(o.ry)));
    ctx.save(); ctx.beginPath(); ctx.rect(a.left,a.top,a.right-a.left,a.bottom-a.top); ctx.clip();
    const rect=(k,cor)=>{ const x0=k[0]==='p'?px:a.left, x1=k[0]==='p'?a.right:px, y0=k[1]==='p'?a.top:py, y1=k[1]==='p'?py:a.bottom; ctx.fillStyle=cor; ctx.fillRect(x0,y0,x1-x0,y1-y0); };
    if(o.melhor) rect(o.melhor,o.corMelhor||'rgba(59,179,59,.09)');
    if(o.pior) rect(o.pior,o.corPior||'rgba(255,82,82,.08)');
    ctx.strokeStyle=o.corLinha||'rgba(148,163,184,.55)'; ctx.setLineDash([5,4]); ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(px,a.top); ctx.lineTo(px,a.bottom); ctx.moveTo(a.left,py); ctx.lineTo(a.right,py); ctx.stroke();
    ctx.setLineDash([]); ctx.font='700 10px Montserrat, sans-serif'; ctx.textBaseline='alphabetic';
    QUADS.forEach(k=>{ const dx=k[0]==='p'?a.right-6:a.left+6, dy=k[1]==='p'?a.top+13:a.bottom-7;
      ctx.textAlign=k[0]==='p'?'right':'left';
      ctx.fillStyle=k===o.melhor?(o.corMelhorTxt||'#3BB33B'):k===o.pior?(o.corPiorTxt||'#FF5252'):(o.corTxt||'#94A3B8');
      ctx.fillText(o.rot[k]+(k===o.melhor?'  ✓ melhor':k===o.pior?'  ✗ pior':''),dx,dy); });
    ctx.restore();
  } };

/* desenha: dispersão com um ponto por entidade; `destaque(p)` separa a série laranja (unidade do perfil) da cinza */
function desenha(cv,q,vx,vy,o){
  const Chart=o.Chart||global.Chart, s=o.estilo||{}, fmt=o.fmtVar||((v,x)=>String(x));
  const rotulo=o.rotulo||(p=>p.nome||p.ent);
  const dest=o.destaque?q.pts.filter(o.destaque):q.pts, resto=o.destaque?q.pts.filter(p=>!o.destaque(p)):[];
  const muitos=q.n>40;
  // Receita × um custo em R$ → o índice Custo/Receita % entra na dica (Renan, 24/09/2026).
  const ehRec=v=>v&&v.id==='receita', ehCusto=v=>v&&v.f==='brl'&&(v.b||[]).indexOf('custo')>=0;
  const idx=ehRec(vx)&&ehCusto(vy)?{c:'y',r:'x',v:vy}:ehRec(vy)&&ehCusto(vx)?{c:'x',r:'y',v:vx}:null;
  const idxTxt=p=>{ const r=p[idx.r], c=p[idx.c]; return `${idx.v.ab}/Receita: ${r>0&&isFinite(c)?(c/r*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%':'—'}`; };
  const ds=[];
  if(resto.length) ds.push({type:'scatter',label:'rede',data:resto.map(p=>({x:p.x,y:p.y,p})),backgroundColor:(s.cinza||'#5B657C')+'99',borderColor:s.cinza||'#5B657C',borderWidth:0,pointRadius:s.isMobile?2.5:(muitos?3:5),pointHoverRadius:7,order:2});
  ds.push({type:'scatter',label:'destaque',data:dest.map(p=>({x:p.x,y:p.y,p})),backgroundColor:'#F97316',borderColor:'#FFFFFF',borderWidth:o.destaque?1:0,pointRadius:s.isMobile?3.5:(muitos?3.5:6),pointHoverRadius:8,order:1});
  return new Chart(cv,{type:'scatter',data:{datasets:ds},options:{responsive:true,maintainAspectRatio:false,animation:false,
    layout:{padding:{top:16,right:8,bottom:14,left:4}},
    plugins:{legend:{display:false},
      quad:{rx:q.rx,ry:q.ry,rot:q.rot,melhor:q.melhor,pior:q.pior,corLinha:s.isLight?'rgba(60,70,90,.45)':'rgba(148,163,184,.5)',corTxt:s.isLight?'#5B6478':'#94A3B8',corMelhor:s.isLight?'rgba(0,179,0,.10)':'rgba(59,179,59,.10)',corPior:s.isLight?'rgba(255,0,0,.07)':'rgba(255,82,82,.08)'},
      datalabels:{display:!muitos,align:'top',offset:3,color:s.dlColor||'#F1F5F9',font:{family:'Montserrat',size:s.isMobile?8:9.5,weight:'700'},formatter:v=>rotulo(v.p),clamp:true},
      tooltip:Object.assign({},s.tooltip||{},{callbacks:{title:i=>{ const p=i[0].raw.p; return `${rotulo(p)}${p.cod&&p.cod!==p.ent&&p.cod!==rotulo(p)?' · '+p.cod:''} · ${p.meses} ${p.meses===1?'mês':'meses'}`; },
        label:i=>{ const p=i.raw.p; return [`${vx.ab}: ${fmt(vx,p.x)}`,`${vy.ab}: ${fmt(vy,p.y)}`].concat(idx?[idxTxt(p)]:[]).concat([`quadrante: ${q.rot[p.q]}${p.q===q.melhor?' (melhor)':p.q===q.pior?' (pior)':''}`]); }}})},
    scales:{x:{type:'linear',ticks:Object.assign({},s.tick||{},{callback:v=>fmt(vx,v),maxTicksLimit:7}),grid:s.grid||{},border:{display:false}},
      y:{type:'linear',ticks:Object.assign({},s.tick||{},{callback:v=>fmt(vy,v),maxTicksLimit:7}),grid:s.grid||{},border:{display:false}}}},
    plugins:[plugin].concat(o.plugDL||[])});
}
global.CorrQuad={monta,desenha,classe,plugin,QUADS};
})(typeof window!=='undefined'?window:globalThis);
