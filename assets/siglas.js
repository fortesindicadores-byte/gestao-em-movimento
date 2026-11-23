/* Siglas de unidade iguais às do FP&A (Renan, 23/11/2026: "Siglas deixe igual a deles"):
   na TELA, ANG aparece como ANH (Anhanguera) e GNA como GOI (Goiânia). Só o que se
   vê muda: o código gravado no banco, nas regras de acesso e nos filtros (data-v,
   value) continua ANG/GNA, porque ele mora em mais de vinte tabelas e nas policies.
   Carregado pelo assets/mobile.js (todas as páginas) e direto pelo app do celular. */
(function(){
  if(window.__siglas) return; window.__siglas=true;
  var d=document, SIG={ANG:'ANH',GNA:'GOI'}, RE=/ANG|GNA/g, LET=/[A-Za-zÀ-ÿ0-9_]/, PULA={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,NOSCRIPT:1};
  function troca(s){
    if(!s||(s.indexOf('ANG')<0&&s.indexOf('GNA')<0)) return s;
    return s.replace(RE,function(m,i,str){
      var a=str.charAt(i-1), b=str.charAt(i+3);
      if((a&&LET.test(a))||(b&&LET.test(b))) return m;            // pedaço de outra palavra ou de uma placa (ANG1B23)
      if(b==='-'&&/\d/.test(str.charAt(i+4))) return m;           // placa com hífen (ANG-1234)
      return SIG[m];
    });
  }
  window.SiglaTela=troca;
  function varre(){
    if(!d.body) return; var tx=d.body.textContent; if(tx.indexOf('ANG')<0&&tx.indexOf('GNA')<0) return;
    var w=d.createTreeWalker(d.body,NodeFilter.SHOW_TEXT,null), n, v, t, p;
    while((n=w.nextNode())){
      v=n.nodeValue; if(!v||(v.indexOf('ANG')<0&&v.indexOf('GNA')<0)) continue;
      p=n.parentNode; if(!p||PULA[p.nodeName]||(p.closest&&p.closest('[contenteditable],[data-sigla-crua]'))) continue;
      t=troca(v); if(t===v) continue;
      // <option> sem value usa o texto como valor: guarda o código antes de trocar o que se vê
      if(p.nodeName==='OPTION'&&!p.hasAttribute('value')) p.setAttribute('value',p.textContent);
      n.nodeValue=t;
    }
    // dicas (title) também são lidas na tela
    var q=d.querySelectorAll('[title*="ANG"],[title*="GNA"]'), i, a, b;
    for(i=0;i<q.length;i++){ a=q[i].getAttribute('title'); b=troca(a); if(b!==a) q[i].setAttribute('title',b); }
  }
  var t0=null; function agenda(){ clearTimeout(t0); t0=setTimeout(varre,60); }
  /* gráficos: só o rótulo DESENHADO no eixo e o título da dica; os dados do gráfico não mudam */
  function grafico(){
    if(!window.Chart||!Chart.register||Chart._siglas) return; Chart._siglas=true;
    var um=function(l){ return typeof l==='string'?troca(l):Array.isArray(l)?l.map(um):l; };
    try{ Chart.register({id:'siglasTela',
      afterLayout:function(c){ try{ Object.keys(c.scales||{}).forEach(function(k){ var tk=c.scales[k].ticks||[]; for(var i=0;i<tk.length;i++) tk[i].label=um(tk[i].label); }); }catch(e){} },
      beforeTooltipDraw:function(c,a){ try{ var t=a&&a.tooltip; if(t&&t.title) t.title=t.title.map(um); }catch(e){} }
    }); }catch(e){}
  }
  function inicia(){
    grafico(); varre();
    new MutationObserver(agenda).observe(d.documentElement,{childList:true,subtree:true,characterData:true});
  }
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded',inicia); else inicia();
})();
