/* ══════════════════════════════════════════════════════════════════════════
   BALANÇO DE MASSA — a conta NOVA, conta a conta (Renan, 09/10/2026)

   O balanço de massa são viagens das EMPURRADAS que não emitiram CTE e foram
   cobradas depois. O valor cobrado entra no DRE como lançamento de ajuste
   ("AJUSTES CONTÁBEIS - BALANÇO DE MASSA"), por CONTA (Combustíveis, Arla,
   Pneus Novos, Recapagens…), e esse valor tem de voltar ao km remunerado.

   Regras dele (09/10/2026), uma por linha:
     1. "some o valor trimestre e proporcionalize de acordo com rem" — o
        balanço de cada conta é somado no TRIMESTRE e rateado entre os meses
        pelo remunerado da conta em cada mês.
     2. "conta a conta de acordo com seu R$/km para recompor, mas usaremos o
        valor total na hora de compor o km" — cada conta vira km pelo PRÓPRIO
        R$/km (remunerado da conta ÷ km remunerado original), e o km da
        unidade é a soma das contas.
     3. "Não estão a nível de lançamento, estão a nível de conta" — a aba
        Frota do DRE JÁ carrega o balanço dentro do remunerado da conta. Por
        isso o R$/km da conta é calculado sobre o remunerado LÍQUIDO do
        balanço (rem − balanço do mês), senão a taxa sai inflada e o km, menor.
     4. "Por unidade empurrada" e "Deve valer de agosto em diante" — o
        trimestre considera só os meses a partir de `inicio` (ago/26 → o 3º
        trimestre de 2026 é ago + set). Antes disso vale a regra antiga (aba do
        Sheets, Valor 85%), que fica no painel.

   A álgebra que sai disso: com o rateio pelo remunerado líquido, a fração
   balanço ÷ remunerado é a MESMA em todos os meses do trimestre
   (índice_c = Σbalanço_c ÷ Σrem líquido_c), e o km recomposto de cada mês é
   km0_mês × Σ_c índice_c. É isso que `recompoe` devolve, mais o detalhe por
   conta para a tela e para a auditoria.

   Sem dependências. Vale no navegador (window.BalancoMassa) e no Node (require).
   ══════════════════════════════════════════════════════════════════════════ */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.BalancoMassa = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 'MM/AAAA' → número ordenável AAAAMM (0 quando não parseia)
  function ym(vig) {
    const m = String(vig || '').match(/^(\d{2})\/(\d{4})$/);
    return m ? (+m[2]) * 100 + (+m[1]) : 0;
  }
  // 'MM/AAAA' → 'AAAA-Tn'
  function trimestre(vig) {
    const m = String(vig || '').match(/^(\d{2})\/(\d{4})$/);
    return m ? m[2] + '-T' + (Math.floor((+m[1] - 1) / 3) + 1) : '';
  }
  // chave 'MM/AAAA|…resto…' → { vig, grupo }
  function parte(chave) {
    const i = String(chave).indexOf('|');
    return i < 0 ? { vig: String(chave), grupo: '' } : { vig: chave.slice(0, i), grupo: chave.slice(i + 1) };
  }

  /**
   * @param {object} o
   * @param {object} o.bal     { 'MM/AAAA|grupo': { CONTA: valor } }  valor POSITIVO = custo cobrado no balanço
   * @param {object} o.remCta  { 'MM/AAAA|grupo': { CONTA: rem } }    remunerado da conta na Frota, POSITIVO, JÁ COM o balanço dentro
   * @param {object} o.km0     { 'MM/AAAA|grupo': km }                km remunerado ORIGINAL da chave
   * @param {string} o.inicio  'MM/AAAA' — primeira vigência em que a regra vale
   * @returns {{ porChave: object, avisos: string[] }}
   *   porChave[chave] = { km, valor, taxa, contas: { CONTA: { bal, balApp, remBruto, remNet, indice, km } } }
   *   `valor` é o balanço RATEADO no mês (a soma do trimestre bate com o lançado).
   */
  function recompoe(o) {
    const bal = o.bal || {}, remCta = o.remCta || {}, km0 = o.km0 || {};
    const ini = ym(o.inicio || '08/2026');
    const avisos = [];
    const porChave = {};

    // 1) trimestres com balanço, por grupo (unidade|projeto)
    const tri = {};   // 'grupo|AAAA-Tn' → { grupo, tri, meses:Set('MM/AAAA'), contas:Set }
    Object.keys(bal).forEach(ch => {
      const p = parte(ch); if (!p.grupo || ym(p.vig) < ini) return;
      const t = trimestre(p.vig); if (!t) return;
      const id = p.grupo + '|' + t;
      const e = tri[id] || (tri[id] = { grupo: p.grupo, tri: t, meses: new Set(), contas: new Set() });
      e.meses.add(p.vig);
      Object.keys(bal[ch] || {}).forEach(c => { if (bal[ch][c]) e.contas.add(c); });
    });
    // meses do trimestre com km (a chave pode ter km sem balanço lançado nela)
    Object.keys(km0).forEach(ch => {
      const p = parte(ch); if (!p.grupo || ym(p.vig) < ini || !(km0[ch] > 0)) return;
      const id = p.grupo + '|' + trimestre(p.vig);
      if (tri[id]) tri[id].meses.add(p.vig);
    });

    // 2) por trimestre × conta: índice = Σbalanço ÷ Σ remunerado líquido
    Object.values(tri).forEach(t => {
      const meses = [...t.meses].sort((a, b) => ym(a) - ym(b));
      const chaveDe = v => v + '|' + t.grupo;
      const comKm = meses.filter(v => km0[chaveDe(v)] > 0);
      if (!comKm.length) { avisos.push(`${t.grupo} ${t.tri}: balanço lançado mas nenhum mês do trimestre tem km remunerado — não recomposto`); return; }

      // remunerado líquido TOTAL do mês (todas as contas), para o plano B.
      // SÓ OS MESES COM KM recebem rateio: mês com balanço lançado e sem km na
      // Dispersão (aba ainda não colada) não tem onde pôr o km — o valor dele
      // vai para os meses do trimestre que têm, em vez de se perder.
      const netTot = {};
      comKm.forEach(v => {
        const ch = chaveDe(v); let s = 0;
        const rc = remCta[ch] || {}, bc = bal[ch] || {};
        new Set([...Object.keys(rc), ...Object.keys(bc)]).forEach(c => { s += Math.max(0, (+rc[c] || 0) - (+bc[c] || 0)); });
        netTot[v] = s;
      });

      [...t.contas].forEach(c => {
        let Q = 0, R = 0; const net = {};
        meses.forEach(v => { Q += +((bal[chaveDe(v)] || {})[c]) || 0; });
        comKm.forEach(v => {
          const ch = chaveDe(v);
          const b = +((bal[ch] || {})[c]) || 0, r = +((remCta[ch] || {})[c]) || 0;
          net[v] = Math.max(0, r - b); R += net[v];
        });
        if (!Q) return;
        let planoB = false;
        if (!(R > 0)) {
          // a conta tem balanço mas nenhum remunerado líquido no trimestre:
          // rateia pelo remunerado total do mês e converte pelo R$/km de todas as contas
          planoB = true; R = comKm.reduce((s, v) => s + netTot[v], 0);
          avisos.push(`${t.grupo} ${t.tri} · ${c}: sem remunerado líquido da conta no trimestre — rateado pelo remunerado total`);
          if (!(R > 0)) { avisos.push(`${t.grupo} ${t.tri} · ${c}: sem remunerado nenhum no trimestre — não recomposto`); return; }
        }
        const indice = Q / R;
        comKm.forEach(v => {
          const ch = chaveDe(v), k0 = +km0[ch] || 0;
          const base = planoB ? netTot[v] : net[v];
          const balApp = indice * base;
          const km = k0 > 0 && base > 0 ? balApp / (base / k0) : 0;   // = indice × k0
          const e = porChave[ch] || (porChave[ch] = { km: 0, valor: 0, taxa: 0, contas: {} });
          e.contas[c] = { bal: +((bal[ch] || {})[c]) || 0, balApp, remBruto: +((remCta[ch] || {})[c]) || 0, remNet: net[v], indice, km, planoB };
          e.km += km; e.valor += balApp;
        });
      });
    });
    Object.values(porChave).forEach(e => { e.taxa = e.km ? e.valor / e.km : 0; });
    return { porChave, avisos };
  }

  return { recompoe, trimestre, ym, parte, INICIO: '08/2026' };
});
