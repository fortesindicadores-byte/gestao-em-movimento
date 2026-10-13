/* ============================================================================
   Seara · remunerado (KmPorLitro / PrecoDiesel) pelo MODELO quando a placa não
   está na Base Remunerado (Renan, 13/10/2026: "use a base de preventivas para
   pegar modelo e trazer").

   A Base Remunerado traz uma lista fixa de placas por mês (50 em 2026). Placa
   nova que já roda (aparece na aba Combustível) ficava sem remunerado: "—" na
   coluna REM e fora do Km/L remunerado da unidade. Agora, quando a placa não tem
   valor no mês nem no mês anterior, ela recebe a MÉDIA das placas do MESMO
   MODELO naquela vigência (ou na anterior, se a vigência ainda não foi colada).

   Modelo da placa, nesta ordem:
     1. base das preventivas (tabela ativos_manual, a frota da Anhanguera);
     2. o modelo da própria linha (ModeloVeiculo da Base Remunerado / Modelo da
        aba Combustível), para a placa que ainda não está na base das preventivas.
   Os nomes são casados pelo número do modelo (VW/11.180 DRC 4X2 = VW 11.180).

   Uso (por painel):
     const prev = SearaBenchModelo.modelos();          // em paralelo com o gviz
     const M = SearaBenchModelo.nova(await prev);
     M.add(placaKey, 'AAAA-MM', modeloDaLinha, {kmL, preco, rsKm});  // cada linha da Base Remunerado
     M.media(placaKey, 'AAAA-MM', modeloDaLinha) -> {kmL, preco, rsKm, n, vig, modelo} | null
   ========================================================================== */
(function () {
  var SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
  var KEY = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
  function auth() {
    try {
      var raw = localStorage.getItem('sb-lozwipoeacpvplgkrxkq-auth-token');
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 30000)) return s.access_token;
      }
    } catch (e) { /* sem sessão */ }
    return KEY;
  }
  var MERC = 'ABCDEFGHIJ';
  function placaKey(s) {
    var p = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]{3}[0-9]{4}$/.test(p) ? p.slice(0, 4) + MERC[+p[4]] + p.slice(5) : p;
  }
  // chave do modelo: o número (11.180, 9.170, 17.190); sem número, o texto sem a marca
  function chave(s) {
    var t = String(s == null ? '' : s).toUpperCase();
    var m = t.match(/(\d{1,2})[.,]?(\d{3})\b/);
    if (m) return m[1] + '.' + m[2];
    return t.replace(/VOLKSWAGEN|\bVW\b|MERCEDES[- ]?BENZ|M\.?\s*BENZ|\bMB\b/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function mesAnt(ym) {
    var a = ym.split('-').map(Number), d = new Date(a[0], a[1] - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // placa -> modelo, da base das preventivas. Falha (sem sessão, banco fora) = {}:
  // aí vale o modelo da própria linha.
  function modelos() {
    return fetch(SUPA + '/rest/v1/ativos_manual?select=placa,modelo', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + auth() }
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var m = {};
        (rows || []).forEach(function (a) { var p = placaKey(a.placa); if (p && a.modelo) m[p] = a.modelo; });
        return m;
      })
      .catch(function () { return {}; });
  }

  function nova(prev) {
    prev = prev || {};
    var soma = {};   // chaveModelo|AAAA-MM -> {kmL, nK, preco, nP}
    function modDe(placa, modLinha) { return chave(prev[placa] || modLinha || ''); }
    return {
      modDe: modDe,
      // v = {kmL, preco, rsKm…}: cada campo > 0 entra na média do modelo
      add: function (placa, ym, modLinha, v) {
        var mk = modDe(placa, modLinha); if (!mk || !ym) return;
        var k = mk + '|' + ym, o = soma[k] || (soma[k] = {});
        Object.keys(v).forEach(function (c) {
          if (+v[c] > 0) { var x = o[c] || (o[c] = { s: 0, n: 0 }); x.s += +v[c]; x.n++; }
        });
      },
      // média do modelo na vigência; se a vigência não tem, a anterior.
      // Campos sem valor voltam 0 (kmL/preco sempre presentes).
      media: function (placa, ym, modLinha) {
        var mk = modDe(placa, modLinha); if (!mk || !ym) return null;
        var vs = [ym, mesAnt(ym)];
        for (var i = 0; i < vs.length; i++) {
          var o = soma[mk + '|' + vs[i]];
          if (!o || !Object.keys(o).length) continue;
          var r = { kmL: 0, preco: 0, n: 0, vig: vs[i], modelo: mk };
          Object.keys(o).forEach(function (c) { r[c] = o[c].s / o[c].n; r.n = Math.max(r.n, o[c].n); });
          return r;
        }
        return null;
      }
    };
  }

  window.SearaBenchModelo = { modelos: modelos, nova: nova, chave: chave, placaKey: placaKey };
})();
