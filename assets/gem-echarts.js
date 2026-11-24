/* ============================================================
   Gestão em Movimento · tema dos gráficos (docs/DESIGN-ECHARTS.md).
   Registra os temas gem-dark e gem-light no ECharts e expõe o GEM:
     GEM.chart(id, fn)   cria/atualiza um gráfico; fn(t, el) devolve a opção
                         do ECharts a partir da paleta do tema atual. O gráfico
                         se redesenha sozinho na troca de tema e no resize.
     GEM.setTheme('light'|'dark')   troca o tema (fica salvo no navegador)
     GEM.theme() · GEM.palette()
     GEM.num(v, casas) · GEM.brl(v, casas) · GEM.pct(v, casas)
     GEM.variacao(v, fmt, bomSeSobe)   "▲ +4,2%" / "▼ −1,8%" com a classe
     GEM.truck   caminhão baú de lado para o pictorialBar
   Carregar DEPOIS do echarts (e do liquidfill, quando a página usa o tanque).
   ============================================================ */
(function () {
  'use strict';
  var FONTE = 'Poppins, system-ui, -apple-system, "Segoe UI", sans-serif';
  var PAL = {
    dark: { bg: '#0F172A', card: '#1E293B', ink: '#FFFFFF', muted: '#94A3B8', line: '#334155', off: '#334155',
      primary: '#F97316', secondary: '#FDBA74', accent: '#FB923C', target: '#94A3B8',
      series: ['#F97316', '#FDBA74', '#64748B', '#334155'], pos: '#34D399', neg: '#F87171', warn: '#FBBF24', foot: '#64748B' },
    light: { bg: '#F1F5F9', card: '#FFFFFF', ink: '#0F172A', muted: '#64748B', line: '#E2E8F0', off: '#CBD5E1',
      primary: '#EA580C', secondary: '#9A3412', accent: '#C2410C', target: '#64748B',
      series: ['#EA580C', '#9A3412', '#94A3B8', '#CBD5E1'], pos: '#047857', neg: '#DC2626', warn: '#B45309', foot: '#64748B' }
  };
  Object.keys(PAL).forEach(function (k) { PAL[k].font = FONTE; });

  function temaEc(t) {
    var eixoCat = { axisLine: { show: true, lineStyle: { color: t.line } }, axisTick: { show: false },
      axisLabel: { color: t.ink, fontFamily: FONTE, fontSize: 12 }, splitLine: { show: false } };
    var eixoVal = { axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: t.muted, fontFamily: FONTE, fontSize: 12 }, splitLine: { show: true, lineStyle: { color: t.line, type: 'dashed' } } };
    return {
      color: t.series, backgroundColor: 'transparent',
      textStyle: { fontFamily: FONTE, color: t.ink },
      categoryAxis: eixoCat, valueAxis: eixoVal, timeAxis: eixoCat,
      legend: { textStyle: { color: t.muted, fontFamily: FONTE, fontSize: 12 } },
      tooltip: { backgroundColor: t.card, borderColor: t.line, borderWidth: 1, textStyle: { color: t.ink, fontFamily: FONTE, fontSize: 12 },
        extraCssText: 'border-radius:10px;box-shadow:none;' },
      bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } },
      line: { symbol: 'circle', symbolSize: 7, lineStyle: { width: 2.5 } }
    };
  }
  if (window.echarts) { echarts.registerTheme('gem-dark', temaEc(PAL.dark)); echarts.registerTheme('gem-light', temaEc(PAL.light)); }

  /* ── tema ── */
  var CHAVE = 'bi_theme';   // a mesma chave do portal: a escolha vale nos dois
  var atual = 'dark';
  try { atual = localStorage.getItem(CHAVE) === 'light' ? 'light' : 'dark'; } catch (e) {}
  function aplica() {
    document.documentElement.setAttribute('data-theme', atual);
    if (document.body) document.body.classList.toggle('claro', atual === 'light');
  }
  aplica();

  /* ── gráficos ── */
  var REG = {}, OBS = null, pend = {};
  function desenha(id) {
    var r = REG[id], el = document.getElementById(id);
    if (!r || !el || !window.echarts || !el.clientWidth || !el.clientHeight) return null;
    var inst = echarts.getInstanceByDom(el);
    if (inst && el.getAttribute('data-gem-tema') !== atual) { inst.dispose(); inst = null; }
    if (!inst) { inst = echarts.init(el, 'gem-' + atual, { renderer: 'canvas' }); el.setAttribute('data-gem-tema', atual); }
    var op = r.fn(PAL[atual], el);
    if (op) inst.setOption(op, true); else inst.clear();
    r.w = el.clientWidth; r.h = el.clientHeight;
    return inst;
  }
  function observa(el) {
    if (!window.ResizeObserver) return;
    if (!OBS) OBS = new ResizeObserver(function (es) {
      es.forEach(function (e) { var id = e.target.id, r = REG[id]; if (!r) return;
        if (Math.abs(e.target.clientWidth - (r.w || 0)) < 1 && Math.abs(e.target.clientHeight - (r.h || 0)) < 1) return;
        clearTimeout(pend[id]); pend[id] = setTimeout(function () { var i = echarts.getInstanceByDom(e.target); if (i) i.resize(); desenha(id); }, 120); });
    });
    OBS.observe(el);
  }

  var GEM = {
    truck: 'path://M2,1 H27 A2,2 0 0 1 29,3 V20 H0 V3 A2,2 0 0 1 2,1 Z M31,7 H38.5 A2,2 0 0 1 40.1,7.8 L46.4,15 A2,2 0 0 1 47,16.5 V20 H31 Z M33.6,9.6 V14 H42.2 L38.4,9.6 Z M4.6,22.6 a4.4,4.4 0 1,1 8.8,0 a4.4,4.4 0 1,1 -8.8,0 Z M33.8,22.6 a4.4,4.4 0 1,1 8.8,0 a4.4,4.4 0 1,1 -8.8,0 Z',
    font: FONTE,
    theme: function () { return atual; },
    palette: function (n) { return PAL[n || atual]; },
    chart: function (id, fn) {
      var novo = !REG[id]; REG[id] = { fn: fn };
      var el = document.getElementById(id); if (el && novo) observa(el);
      return desenha(id);
    },
    redraw: function () { Object.keys(REG).forEach(desenha); },
    setTheme: function (n) {
      atual = n === 'light' ? 'light' : 'dark';
      try { localStorage.setItem(CHAVE, atual); } catch (e) {}
      aplica(); GEM.redraw();
      try { document.dispatchEvent(new CustomEvent('gem:tema', { detail: atual })); } catch (e) {}
    },
    /* ── formatos (padrão brasileiro; negativo com o sinal − de verdade) ── */
    num: function (v, casas) {
      if (v == null || !isFinite(v)) return '—';
      var c = casas || 0, s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
      return (v < 0 && +Math.abs(v).toFixed(c) !== 0 ? '−' : '') + s;
    },
    brl: function (v, casas) {
      if (v == null || !isFinite(v)) return '—';
      var c = casas || 0, zero = +Math.abs(v).toFixed(c) === 0;
      return (v < 0 && !zero ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
    },
    pct: function (v, casas) { return v == null || !isFinite(v) ? '—' : GEM.num(v, casas == null ? 1 : casas) + '%'; },
    /* variação com seta, sinal e classe: nunca só a cor */
    variacao: function (v, fmt, bomSeSobe) {
      if (v == null || !isFinite(v)) return { txt: '—', cls: 'gem-neutro', html: '<span class="gem-neutro">—</span>' };
      var f = fmt || function (x) { return GEM.pct(x); }, t = f(Math.abs(v)), zero = f(0) === t;
      var sobe = v > 0, cls = zero ? 'gem-neutro' : ((sobe === (bomSeSobe !== false)) ? 'gem-pos' : 'gem-neg');
      var txt = zero ? '= ' + t : (sobe ? '▲ +' : '▼ −') + t, curto = zero ? '= ' + t : (sobe ? '▲ ' : '▼ ') + t;
      return { txt: txt, curto: curto, cls: cls, pn: cls === 'gem-pos' ? 'pos' : (cls === 'gem-neg' ? 'neg' : ''), html: '<span class="' + cls + '">' + txt + '</span>' };
    }
  };
  window.GEM = GEM;
  document.addEventListener('DOMContentLoaded', aplica);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { GEM.redraw(); });
})();
