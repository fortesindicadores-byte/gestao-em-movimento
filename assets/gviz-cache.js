// ============================================================
// gviz-cache — NENHUM PAINEL LÊ O GOOGLE SHEETS (Renan, 18/09/2026:
// "NÃO QUERO MAIS A MERDA DE NENHUM PAINEL LENDO DO GOOGLE SHEETS!!!")
//
// Intercepta TODO pedido ao gviz do Google Sheets — fetch e JSONP — e responde
// a partir do BANCO: as tabelas sh_<slug> que o robô do Sheets (sheets-robot)
// mantém no Supabase, uma por aba, com as linhas tipadas. O payload do gviz é
// RECONSTRUÍDO a partir delas (cols com label/type, rows com {v}), então o
// painel recebe exatamente o que receberia do Google e não precisa mudar uma
// linha. A conferência de que a reconstrução é idêntica ao gviz, célula a
// célula, é o workflow Sheets Gviz Check (scripts/sheets-gviz-check.mjs).
//
// Ordem de resposta:
//   1. BANCO   — sh_<slug> (a aba em tabela; é a fonte oficial)
//   2. SNAPSHOT — gviz_snapshot (a foto crua do gviz-robot), só se a aba ainda
//                 não tem tabela ou a leitura do banco falhou
//   3. GOOGLE  — só se nem o snapshot existir. É o caminho que NÃO deveria
//                 acontecer: fica contado em GvizCache.google e no console.
//
// Não há mais a janela de 15s: o botão "Atualizar dados" e os setInterval
// também leem do banco. O dado do banco é o da última carga do robô (de hora
// em hora) — quem colou agora na aba usa "Atualizar agora" no hub.
//
// window.GvizCache.fontes[chave] diz de onde cada aba veio nesta página.
// ============================================================
(function () {
  'use strict';
  var SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
  var KEY = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
  var MAX_IDADE = 12 * 60 * 60 * 1000;   // idade máxima do SNAPSHOT (o banco não tem teto)
  var PAG = 1000;                        // teto de linhas por leitura do PostgREST
  var fetchOrig = window.fetch ? window.fetch.bind(window) : null;

  // ── reconstrução do payload gviz a partir das linhas tipadas ────────────
  // Exposta em window.GvizRebuild porque o Sheets Gviz Check roda ESTE mesmo
  // código em node:vm contra o banco real — conferir com outra cópia mediria
  // a diferença entre duas cópias, não entre o banco e o gviz.
  function letra(i) { var s = ''; i = i + 1; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function cel(v, tipo) {
    if (v == null || v === '') return null;
    var m;
    if (tipo === 'date') {
      m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return null;
      return { v: 'Date(' + (+m[1]) + ',' + (+m[2] - 1) + ',' + (+m[3]) + ')', f: m[3] + '/' + m[2] + '/' + m[1] };
    }
    if (tipo === 'datetime') {
      m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
      if (!m) return null;
      return { v: 'Date(' + (+m[1]) + ',' + (+m[2] - 1) + ',' + (+m[3]) + ',' + (+m[4]) + ',' + (+m[5]) + ',' + (+m[6]) + ')',
               f: m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] + ':' + m[6] };
    }
    if (tipo === 'timeofday') { var p = String(v).split(':').map(Number); return { v: [p[0] || 0, p[1] || 0, p[2] || 0, 0] }; }
    if (tipo === 'number') { var n = typeof v === 'number' ? v : +v; return isFinite(n) ? { v: n } : null; }
    if (tipo === 'boolean') return { v: v === true || v === 'true' };
    return { v: String(v) };
  }
  // colunas = sh_base.colunas [{i,label,col,tipo}] · linhas = as linhas de sh_<slug>, em ordem
  function tabela(colunas, linhas) {
    var cols = colunas.slice().sort(function (a, b) { return a.i - b.i; });
    return {
      cols: cols.map(function (c) { return { id: letra(c.i), label: c.label || '', type: c.tipo || 'string' }; }),
      rows: linhas.map(function (l) { return { c: cols.map(function (c) { return cel(l[c.col], c.tipo); }) }; })
    };
  }
  function payload(colunas, linhas) { return { version: '0.6', reqId: '0', status: 'ok', sig: 'banco', table: tabela(colunas, linhas) }; }
  // o prefixo tem 47 caracteres, como o do Google — há painel que faz substr(47)
  function corpo(obj) { return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(obj) + ');'; }
  window.GvizRebuild = { cel: cel, tabela: tabela, payload: payload, corpo: corpo, letra: letra };

  if (!fetchOrig) return;
  window.GvizCache = { hits: 0, misses: 0, banco: 0, snapshot: 0, google: 0, fontes: {} };

  // Duas abas são pedidas por DOIS endereços (gid e nome) e têm UMA tabela —
  // ver `apelidos` em scripts/sheets-bases.mjs. A chave do apelido aponta para
  // a chave principal, que é a que está em sh_base.gviz_chave.
  var APELIDOS = {
    '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY|s=|g=0|q=|h=': '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY|s=Base RPM|g=|q=|h=1',
    '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=|g=216663799|q=|h=': '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=FCA Total|g=|q=|h=1'
  };

  // chave normalizada — TEM de bater com a do scripts/sheets-bases.mjs
  function chaveDe(url) {
    try {
      var u = new URL(url, location.href);
      if (u.hostname !== 'docs.google.com') return null;
      var m = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)\/gviz\/tq$/);
      if (!m) return null;
      var p = u.searchParams;
      return m[1] + '|s=' + (p.get('sheet') || '') + '|g=' + (p.get('gid') || '') +
             '|q=' + (p.get('tq') || '') + '|h=' + (p.get('headers') || '');
    } catch (e) { return null; }
  }

  // As sh_* têm leitura para `authenticated`: manda o JWT do login do hub
  // (supabase-js guarda a sessão no localStorage desta mesma origem). Sem
  // sessão válida vai a chave pública — serve se a policy de anon existir.
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
  function rest(path, extra) {
    var h = { apikey: KEY, Authorization: 'Bearer ' + auth() };
    if (extra) for (var k in extra) h[k] = extra[k];
    return fetchOrig(SUPA + '/rest/v1/' + path, { headers: h });
  }

  // ── 1) banco ───────────────────────────────────────────────
  var basesP = null;
  function bases() {
    if (!basesP) {
      basesP = rest('sh_base?select=slug,gviz_chave,colunas,linhas,erro,carregado_em')
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          var m = {};
          (rows || []).forEach(function (b) { if (b.gviz_chave && b.colunas && b.linhas > 0) m[b.gviz_chave] = b; });
          return m;
        })
        .catch(function () { return {}; });
    }
    return basesP;
  }
  function buscaBanco(key) {
    return bases().then(function (m) {
      var b = m[APELIDOS[key] || key];
      if (!b) return null;
      var pags = Math.ceil(b.linhas / PAG), ps = [];
      for (var i = 0; i < pags; i++) {
        ps.push(rest('sh_' + b.slug + '?select=*&order=linha.asc', { Range: (i * PAG) + '-' + (i * PAG + PAG - 1) })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }));
      }
      return Promise.all(ps).then(function (pp) {
        var linhas = [].concat.apply([], pp);
        if (!linhas.length) return null;
        return payload(b.colunas, linhas);
      });
    }).catch(function (e) { try { console.warn('gviz-cache: banco falhou p/', key, e && e.message); } catch (_) {} return null; });
  }

  // ── 2) snapshot cru (reserva) ──────────────────────────────
  function buscaSnapshot(key) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctl && setTimeout(function () { ctl.abort(); }, 1500);
    return fetchOrig(SUPA + '/rest/v1/gviz_snapshot?key=eq.' + encodeURIComponent(key) + '&select=body,updated_at', {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) return null;
      return r.json();
    }).then(function (rows) {
      var row = rows && rows[0];
      if (!row || !row.body) return null;
      if (Date.now() - new Date(row.updated_at).getTime() > MAX_IDADE) return null;
      return row.body;
    }).catch(function () { if (timer) clearTimeout(timer); return null; });
  }
  // Extrai o objeto entre o 1º "(" e o último ")" da resposta gviz crua.
  function parseGviz(body) {
    var a = body.indexOf('('), b = body.lastIndexOf(')');
    if (a < 0 || b <= a) return null;
    return JSON.parse(body.slice(a + 1, b));
  }

  // devolve {obj, corpo} ou null; anota a fonte
  function resolve(key) {
    return buscaBanco(key).then(function (obj) {
      if (obj) { window.GvizCache.hits++; window.GvizCache.banco++; window.GvizCache.fontes[key] = 'banco'; return { obj: obj, corpo: corpo(obj) }; }
      return buscaSnapshot(key).then(function (body) {
        if (body != null) {
          var o = null; try { o = parseGviz(body); } catch (e) { o = null; }
          if (o) { window.GvizCache.hits++; window.GvizCache.snapshot++; window.GvizCache.fontes[key] = 'snapshot'; return { obj: o, corpo: body }; }
        }
        window.GvizCache.misses++; window.GvizCache.google++; window.GvizCache.fontes[key] = 'google';
        try { console.warn('gviz-cache: SEM TABELA NO BANCO — indo ao Google Sheets:', key); } catch (_) {}
        return null;
      });
    });
  }

  // ── fetch ──────────────────────────────────────────────────
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url);
      var key = url ? chaveDe(url) : null;
      if (key) {
        return resolve(key).then(function (r) {
          if (r) return new Response(r.corpo, { status: 200, headers: { 'Content-Type': 'text/plain' } });
          return fetchOrig(input, init);
        });
      }
    } catch (e) { /* segue o fluxo normal */ }
    return fetchOrig(input, init);
  };

  // ── JSONP (script com responseHandler) ─────────────────────
  var appendOrig = Element.prototype.appendChild;
  Element.prototype.appendChild = function (node) {
    try {
      if (node && node.tagName === 'SCRIPT' && node.src) {
        var key = chaveDe(node.src);
        var fnm = (node.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        if (key && fnm) {
          var el = this;
          resolve(key).then(function (r) {
            if (r && typeof window[fnm] === 'function') { window[fnm](r.obj); return; }
            appendOrig.call(el, node);      // sem banco nem snapshot: JSONP normal
          });
          return node;                       // contrato do appendChild
        }
      }
    } catch (e) { /* segue o fluxo normal */ }
    return appendOrig.call(this, node);
  };
})();
