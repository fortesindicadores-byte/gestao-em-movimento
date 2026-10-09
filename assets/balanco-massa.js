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
   (índice = Σbalanço ÷ Σrem líquido), e o km recomposto de cada mês é
   km0_mês × índice.

   ⚠ O KM SAI DO VALOR TOTAL, NÃO DA SOMA DAS CONTAS (bug real, 09/10/2026:
   o 1º deploy somava o km de cada conta e PIR ago/26 saiu com +277 mil km
   para R$ 263 mil — R$ 0,95/km). O balanço é o MESMO km cobrado em sete
   contas; converter cada conta pelo próprio R$/km e somar recupera o mesmo km
   sete vezes. Por isso: índice da unidade no trimestre = Σ balanço de todas
   as contas ÷ Σ remunerado líquido DAS CONTAS QUE TÊM BALANÇO, e o km do mês
   é km0 × esse índice (= valor rateado ÷ R$/km dessas contas). O R$/km e o
   índice de cada conta continuam no detalhe, para a auditoria enxergar
   conta que destoa — mas não entram na soma.

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
   * @param {object} o.remCta  { 'MM/AAAA|grupo': { CONTA: rem } }    remunerado da conta, POSITIVO
   * @param {object} o.km0     { 'MM/AAAA|grupo': km }                km remunerado ORIGINAL da chave
   * @param {string} o.inicio  'MM/AAAA' — primeira vigência em que a regra vale (inclusive)
   * @param {string} [o.fim]   'MM/AAAA' — primeira vigência em que a regra NÃO vale mais (exclusive)
   * @param {string} [o.janela] 'trimestre' (padrão) ou 'tudo' (um bloco só, do início ao fim)
   * @param {boolean} [o.liquido] true (padrão): o remunerado da conta JÁ carrega o balanço e
   *                             é descontado (rem − balanço); false: o remunerado entra bruto
   *                             (é a regra antiga, até jul/26, com a taxa dos 3 pacotes)
   * @returns {{ porChave: object, avisos: string[] }}
   *   porChave[chave] = { km, valor, taxa, indice, contas: { CONTA: { bal, balApp, remBruto, remNet, indice, rsKm, km } } }
   *   `valor` é o balanço RATEADO no mês (a soma da janela bate com o lançado);
   *   `km` = km0 × índice da unidade (valor total ÷ R$/km das contas com balanço);
   *   `contas[c].km` é o que a conta SOZINHA diria — só para auditoria, não soma.
   */
  function recompoe(o) {
    const bal = o.bal || {}, remCta = o.remCta || {}, km0 = o.km0 || {};
    const ini = ym(o.inicio || '08/2026'), fimY = o.fim ? ym(o.fim) : Infinity;
    const janela = o.janela === 'tudo' ? 'tudo' : 'trimestre';
    const liquido = o.liquido !== false;
    const avisos = [];
    const porChave = {};
    const dentro = v => { const y = ym(v); return y >= ini && y < fimY; };
    const bloco = v => janela === 'tudo' ? 'tudo' : trimestre(v);
    const net = (ch, c) => { const r = +((remCta[ch] || {})[c]) || 0, b = +((bal[ch] || {})[c]) || 0; return Math.max(0, liquido ? r - b : r); };

    // 1) blocos (trimestre ou tudo) com balanço, por grupo (unidade|projeto)
    const blocos = {};   // 'grupo|bloco' → { grupo, bloco, meses:Set('MM/AAAA'), contas:Set }
    Object.keys(bal).forEach(ch => {
      const p = parte(ch); if (!p.grupo || !dentro(p.vig)) return;
      const b = bloco(p.vig); if (!b) return;
      const id = p.grupo + '|' + b;
      const e = blocos[id] || (blocos[id] = { grupo: p.grupo, bloco: b, meses: new Set(), contas: new Set() });
      e.meses.add(p.vig);
      Object.keys(bal[ch] || {}).forEach(c => { if (bal[ch][c]) e.contas.add(c); });
    });
    // meses do bloco com km (a chave pode ter km sem balanço lançado nela)
    Object.keys(km0).forEach(ch => {
      const p = parte(ch); if (!p.grupo || !dentro(p.vig) || !(km0[ch] > 0)) return;
      const id = p.grupo + '|' + bloco(p.vig);
      if (blocos[id]) blocos[id].meses.add(p.vig);
    });

    // 2) por bloco: índice da unidade = Σ balanço (todas as contas) ÷ Σ remunerado líquido DAS CONTAS COM BALANÇO
    Object.values(blocos).forEach(t => {
      const meses = [...t.meses].sort((a, b) => ym(a) - ym(b));
      const chaveDe = v => v + '|' + t.grupo;
      const comKm = meses.filter(v => km0[chaveDe(v)] > 0);
      const rot = `${t.grupo} ${t.bloco}`;
      if (!comKm.length) { avisos.push(`${rot}: balanço lançado mas nenhum mês do bloco tem km remunerado — não recomposto`); return; }
      const contas = [...t.contas];

      // SÓ OS MESES COM KM recebem rateio: mês com balanço lançado e sem km na
      // Dispersão (aba ainda não colada) não tem onde pôr o km — o valor dele
      // vai para os meses do bloco que têm, em vez de se perder.
      let Q = 0, R = 0; const det = {};   // det[c] = { Q, R }
      contas.forEach(c => {
        let qc = 0, rc = 0;
        meses.forEach(v => { qc += +((bal[chaveDe(v)] || {})[c]) || 0; });
        comKm.forEach(v => { rc += net(chaveDe(v), c); });
        det[c] = { Q: qc, R: rc }; Q += qc; R += rc;
      });
      if (!Q) return;
      let planoB = false;
      if (!(R > 0)) {
        // nenhuma das contas com balanço tem remunerado líquido no bloco: usa o remunerado de TODAS as contas
        planoB = true;
        comKm.forEach(v => { const ch = chaveDe(v); Object.keys(remCta[ch] || {}).forEach(c => { R += net(ch, c); }); });
        avisos.push(`${rot}: contas do balanço sem remunerado líquido no bloco — rateado pelo remunerado de todas as contas`);
        if (!(R > 0)) { avisos.push(`${rot}: sem remunerado nenhum no bloco — não recomposto`); return; }
      }
      const indice = Q / R;
      comKm.forEach(v => {
        const ch = chaveDe(v), k0 = +km0[ch] || 0;
        let base = 0;
        if (planoB) Object.keys(remCta[ch] || {}).forEach(c => { base += net(ch, c); });
        else contas.forEach(c => { base += net(ch, c); });
        const balApp = indice * base;                      // valor do mês, rateado pelo remunerado
        const km = base > 0 ? balApp / (base / k0) : 0;    // = indice × k0: valor ÷ R$/km das contas do balanço
        const e = porChave[ch] || (porChave[ch] = { km: 0, valor: 0, taxa: 0, indice, bloco: t.bloco, planoB, contas: {} });
        e.km += km; e.valor += balApp;
        contas.forEach(c => {
          const n = net(ch, c), ic = det[c].R > 0 ? det[c].Q / det[c].R : null;
          e.contas[c] = { bal: +((bal[ch] || {})[c]) || 0, balApp: ic != null ? ic * n : 0, remBruto: +((remCta[ch] || {})[c]) || 0, remNet: n,
            indice: ic, rsKm: k0 > 0 ? n / k0 : 0, km: ic != null ? ic * k0 : 0 };
        });
      });
    });
    Object.values(porChave).forEach(e => { e.taxa = e.km ? e.valor / e.km : 0; });
    return { porChave, avisos };
  }

  return { recompoe, trimestre, ym, parte, INICIO: '08/2026' };
});
