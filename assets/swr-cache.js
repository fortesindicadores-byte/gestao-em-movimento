// ============================================================
// SwrCache — cache "pinta na hora" em IndexedDB (Renan, 21/08/2026:
// "Os faróis e o Scorecard e Diagnóstico ainda demoram um pouco").
//
// localStorage NÃO serve para esses painéis: o pacote de dados (DRE +
// Ginfo + Frota de Elite…) passa dos ~5MB e o setItem falha em silêncio
// — era por isso que o Scorecard "tinha" cache e continuava abrindo
// frio. IndexedDB não tem esse teto e guarda os objetos como são,
// inclusive Date (structured clone).
//
//   SwrCache.get(chave) → Promise<{t, v} | null>
//   SwrCache.put(chave, valor)                    (carimba t = agora)
//
// Qualquer erro vira null/no-op: o painel segue como se não houvesse
// cache — comportamento idêntico ao de antes.
// ============================================================
(function () {
  'use strict';
  function db() {
    return new Promise(function (res, rej) {
      var q = indexedDB.open('gem_swr', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('kv'); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
  }
  // Dentro de um painel aberto por outra página do portal (Apresentações,
  // Check de Metas, app do celular: a mãe expõe window.__gvizMem), o cache
  // não é lido nem gravado: a mãe lia o resultado antigo antes de o dado novo
  // chegar (Scorecard sem out/26 na apresentação, 27/11/2026).
  function naMae() { try { var p = window.parent; return !!(p && p !== window && p.__gvizMem); } catch (e) { return false; } }
  window.SwrCache = {
    get: function (k) {
      if (naMae()) return Promise.resolve(null);
      return db().then(function (d) {
        return new Promise(function (res) {
          var r = d.transaction('kv').objectStore('kv').get(k);
          r.onsuccess = function () { res(r.result || null); d.close(); };
          r.onerror = function () { res(null); d.close(); };
        });
      }).catch(function () { return null; });
    },
    put: function (k, v) {
      if (naMae()) return Promise.resolve();
      return db().then(function (d) {
        var tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ t: Date.now(), v: v }, k);
        tx.oncomplete = function () { d.close(); };
        tx.onerror = function () { d.close(); };
      }).catch(function () {});
    }
  };
})();
