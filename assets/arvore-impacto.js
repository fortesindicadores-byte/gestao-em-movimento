/* ============================================================================
   Impactos e diagnóstico das Árvores de Combustível (Ambev e Seara)
   (Renan, 13/10/2026: "poderia ter os impactos reais (R$/km, R$/L e Km/L) e um
   diagnóstico abaixo da árvore")

   A ponte fecha com o Δ do custo da DRE, sem rateio nem número inventado:

     Δ custo        = Volume + Impacto R$/km
     Volume         = (km real − km rem) × R$/km rem          (R$/km da DRE)
     Impacto R$/km  = (R$/km real − R$/km rem) × km real      (R$/km da DRE)
     Impacto R$/km  = Preço + Eficiência + Diferença DRE × bases
       litros       = km real ÷ Km/L real
       Preço        = (R$/L real − R$/L rem) × litros
       Eficiência   = R$/L rem × (litros − km real ÷ Km/L rem)
       Diferença    = o que sobra: o R$/km da DRE não é R$/L ÷ Km/L das bases
         · lado remunerado = km real × (R$/L rem ÷ Km/L rem − R$/km rem)
         · lado realizado  = custo real − litros × R$/L real

   Sinal: positivo = custou a mais que o remunerado (vermelho); negativo =
   economizou (verde). Os custos chegam com o sinal da DRE (negativos) e são
   lidos em módulo, como a árvore sempre fez.
   ========================================================================== */
(function () {
  const abs = Math.abs;
  const num = v => (v == null || !isFinite(v) || v === 0) ? null : +v;

  function calc(d) {
    const cRem = abs(d.custoRem || 0), cReal = abs(d.custoReal || 0);
    const kmRem = abs(d.kmRem || 0), kmReal = abs(d.kmReal || 0);
    const pRem = num(d.rsLRem), pReal = num(d.rsLReal), eRem = num(d.kmLRem), eReal = num(d.kmLReal);
    const rkRem = kmRem ? cRem / kmRem : 0, rkReal = kmReal ? cReal / kmReal : 0;
    const b = { cRem, cReal, kmRem, kmReal, pRem, pReal, eRem, eReal, rkRem, rkReal,
      dCusto: cReal - cRem,
      vol: (kmReal - kmRem) * rkRem,
      rsKm: (rkReal - rkRem) * kmReal,
      preco: null, efic: null, dif: null, difRem: null, difReal: null,
      litros: null, rkBaseRem: null, rkBaseReal: null, custoBaseReal: null };
    if (pRem && pReal && eRem && eReal && kmReal) {
      const lit = kmReal / eReal;
      b.litros = lit;
      b.preco = (pReal - pRem) * lit;
      b.efic = pRem * (lit - kmReal / eRem);
      b.dif = b.rsKm - b.preco - b.efic;
      b.rkBaseRem = pRem / eRem;
      b.rkBaseReal = pReal / eReal;
      b.custoBaseReal = lit * pReal;
      b.difRem = kmReal * (b.rkBaseRem - rkRem);
      b.difReal = cReal - b.custoBaseReal;
    }
    return b;
  }

  // R$ com sinal, curto: +R$ 53,5 mil · −R$ 1,2 mi · +R$ 840
  function rs(v, semSinal) {
    if (v == null || !isFinite(v)) return '—';
    const a = abs(v), s = semSinal ? '' : (v < 0 ? '−' : '+');
    let t;
    if (a >= 1e6) t = (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    else if (a >= 1e3) t = (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    else t = Math.round(a).toLocaleString('pt-BR');
    return s + 'R$ ' + t;
  }
  const n2 = v => (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = v => Math.round(abs(v)).toLocaleString('pt-BR');
  const pct = (a, b) => b ? Math.round(abs((a - b) / b) * 100) + '%' : '—';
  const cor = v => v == null ? '' : (v > 0 ? 'cr' : v < 0 ? 'cg' : '');

  // caixa de impacto: valor em módulo, cor pelo sinal (mesma convenção das caixas antigas)
  function caixa(el, v) {
    if (!el) return;
    if (v == null || !isFinite(v)) { el.textContent = '—'; el.className = 'impact-value'; return; }
    el.textContent = Math.round(abs(v)).toLocaleString('pt-BR');
    el.className = v > 0 ? 'impact-value impact-bad' : 'impact-value impact-good';
  }

  function html(b) {
    if (!b || (!b.cRem && !b.cReal)) return '<div class="dg-vazio">Sem custo de combustível no recorte.</div>';
    const acima = b.dCusto >= 0;
    const cab = `<div class="dg-cab"><span class="dg-tit">Diagnóstico</span>`
      + `<span class="dg-res">O custo ficou <b class="${cor(b.dCusto)}">${rs(b.dCusto, true)} ${acima ? 'acima' : 'abaixo'}</b> do remunerado `
      + `(${rs(b.cReal, true)} realizado · ${rs(b.cRem, true)} remunerado)</span></div>`;
    const item = (rot, v, txt) => `<div class="dg-it"><div class="dg-rot">${rot}</div>`
      + `<div class="dg-v ${cor(v)}">${rs(v)}</div><div class="dg-txt">${txt}</div></div>`;
    const dKm = b.kmReal - b.kmRem;
    const its = [];
    its.push(item('Volume', b.vol,
      dKm === 0 ? 'Rodou o mesmo km do remunerado'
        : `Rodou ${int(dKm)} km ${dKm > 0 ? 'a mais' : 'a menos'} que o remunerado (${pct(b.kmReal, b.kmRem)}), a R$ ${n2(b.rkRem)}/km`));
    if (b.preco == null) {
      its.push(item('R$/km', b.rsKm, `R$ ${n2(b.rkReal)}/km realizado contra R$ ${n2(b.rkRem)}/km remunerado`));
      its.push(`<div class="dg-it dg-falta"><div class="dg-rot">Preço · Eficiência</div><div class="dg-txt">Sem R$/L ou Km/L no recorte: não dá para separar preço de eficiência</div></div>`);
    } else {
      const dp = b.pReal - b.pRem, de = b.eReal - b.eRem;
      its.push(item('Preço (R$/L)', b.preco,
        `Pagou R$ ${n2(b.pReal)}/L contra R$ ${n2(b.pRem)}/L remunerado (${dp > 0 ? 'mais caro' : dp < 0 ? 'mais barato' : 'igual'}) em ${int(b.litros)} L`));
      its.push(item('Eficiência (Km/L)', b.efic,
        `Fez ${n2(b.eReal)} km/L contra ${n2(b.eRem)} remunerado (${pct(b.eReal, b.eRem)} ${de < 0 ? 'abaixo' : de > 0 ? 'acima' : ''}): ${int(b.litros - b.kmReal / b.eRem)} L ${de < 0 ? 'a mais' : 'a menos'}`));
      its.push(item('Diferença DRE × bases', b.dif,
        `Remunerado: a DRE paga R$ ${n2(b.rkRem)}/km e as bases preveem R$ ${n2(b.rkBaseRem)}/km (${rs(b.difRem)}). `
        + `Realizado: a DRE lançou ${rs(b.cReal, true)} e os abastecimentos somam ${rs(b.custoBaseReal, true)} (${rs(b.difReal)})`));
    }
    return cab + `<div class="dg-its">${its.join('')}</div>`;
  }

  window.ArvImpacto = { calc, html, caixa, rs };
})();
