/* ============================================================
   Rem Meta — o que deveríamos ter recebido pelos mapas × Freightech
   (Renan, 18/11/2026: "Rem Meta × Rem DRE, ▲ e ▲%, mês e YTD"; feito em 23/11).

   É a MESMA conta do "Pago FT (reconstr.)" da Árvore do Custo (arvores/custo.js,
   que usa o `pago` daqui): por operação × unidade × mês,
     componente variável = R$/km do FT (componente do ft_rem_mes ÷ km_teto)
                           × km remunerado (mapas do 2art e CT-e de out/26 em
                           diante, aba Dispersão de km antes; nas Empurradas,
                           com o km do balanço de massa);
     componente fixo (seguro, IPVA, lavação fixa) = o valor do mês no FT.
   Reconstruído: não é a fatura.

   Funções puras (indexaFT, indexaKm, bmKm, pago, calcula) + a leitura (carrega).
   ============================================================ */
(function (g) {
  'use strict';
  const nu = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const UNIS = ['ANG', 'BLC', 'CBA', 'CGR', 'FLP', 'GNA', 'GRL', 'MCC', 'NFR', 'PIR', 'PLT', 'RON'];
  const OPN = { ROTA: 'ROTA', VAN: 'ROTA (VAN)', AS: 'AUTO SERVIÇO', EMP: 'EMPURRADA', INS: 'INSUMOS', ARM: 'APOIO' };
  const DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM', DISP_TAB = 'Dispersão de km';

  /* projeto do DRE (o prefixo do Nível 3) → operação */
  function opDe(p) {
    p = nu(p).replace(/\s*\(INATIVO\)\s*$/, '');
    return /^(ROTA|UDC)$/.test(p) ? 'ROTA' : /^(ROTA \(VAN\)|VAN)$/.test(p) ? 'VAN' : p === 'AUTO SERVICO' ? 'AS' : /^EMPURRADA/.test(p) ? 'EMP' : p === 'INSUMOS' ? 'INS' : p === 'APOIO' ? 'ARM' : null;
  }
  const uniDe = u => { u = nu(u); return u === 'GOI' ? 'GNA' : u; };
  /* "ROTA (VAN) - BLC", "Auto Serviço - GOI" → {op, uni}; fora do Freightech (Seara, Terceiros, Corporativo…) = null */
  function opUni(s) {
    s = nu(s).replace(/\s*\(INATIVO\)\s*$/, ''); const i = s.lastIndexOf(' - '); if (i < 0) return null;
    const op = opDe(s.slice(0, i)), uni = uniDe(s.slice(i + 3));
    return op && uni !== 'ANG' && UNIS.includes(uni) ? { op, uni } : null;
  }

  /* componentes do FT e as contas do DRE que cada um paga */
  const COMP = [
    { id: 'comb', nome: 'Combustível e Arla', pac: 'Combustíveis', ft: ['comb'], re: /^(COMBUSTIVEIS( VEICULOS E EQUIPAMENTOS)?|FLUIDOS \(ARLA\)|ARLA)$/ },
    { id: 'manut', nome: 'Manutenção de veículos e contrato', pac: 'Manutenções', ft: ['manut'], re: /^(MANUTENCAO DE VEICULOS.*|CONTRATOS DE MANUTENCAO FABRICANTE)$/ },
    { id: 'carroc', nome: 'Manutenção de carrocerias', pac: 'Manutenções', ft: ['carroc'], re: /^MANUTENCAO DE CARROCERIAS$/ },
    { id: 'lav', nome: 'Lavação', pac: 'Manutenções', ft: ['lavagem_var', 'lavagem'], re: /^LAVACAO DE VEICULOS$/ },
    { id: 'pneu', nome: 'Pneus e recapagens', pac: 'Pneus', ft: ['pneu'], re: /^(PNEUS NOVOS|PNEUS E CAMARAS|RECAPAGENS E OUTROS SERVICOS|CONSERTOS E RECAPAGENS DE PNEUS)$/ },
    { id: 'seguro', nome: 'Seguro', pac: 'Seguros e licenças', ft: ['seguro'], re: /SEGURO/ },
    { id: 'ipva', nome: 'IPVA e licenciamento', pac: 'Seguros e licenças', ft: ['ipva'], re: /IPVA|LICENCIAMENTO/ },
  ];
  const _cc = {};
  function compDe(conta) { const n = nu(conta); if (n in _cc) return _cc[n]; const c = COMP.find(x => x.re.test(n)) || null; _cc[n] = c ? c.id : null; return _cc[n]; }

  /* ── Freightech por mês (ft_rem_mes) → 'AAAA-MM|op|uni' ── */
  const FTOP = { ROTA: 'ROTA', UDC: 'ROTA', VAN: 'VAN', AS: 'AS', 'AUTO SERVICO': 'AS', EMPURRADA: 'EMP', INSUMOS: 'INS', ARMAZEM: 'ARM' };
  const FT_CAMPOS = ['comb', 'manut', 'carroc', 'pneu', 'lavagem_var', 'lavagem', 'seguro', 'ipva', 'ativos', 'parados'];
  const FT_VAR = ['comb', 'manut', 'carroc', 'pneu', 'lavagem_var'];   // por km; o resto é fixo do mês
  function indexaFT(rows) {
    const o = {};
    (rows || []).forEach(r => {
      let op = FTOP[nu(r.operacao)]; const u = uniDe(r.unidade); if (!op || !UNIS.includes(u)) return; if (op === 'AS' && u === 'PLT') op = 'ROTA';
      const k = r.vigencia + '|' + op + '|' + u, x = o[k] = o[k] || { km: 0 };
      FT_CAMPOS.forEach(c => { x[c] = (x[c] || 0) + (+r[c] || 0); }); x.km += +r.km_teto || 0;
    });
    return o;
  }

  /* ── km remunerado e rodado da Dispersão de km (payload do gviz, já com os meses do banco) ── */
  function vigCel(v) {
    let m = String(v == null ? '' : v).match(/Date\((\d{4}),\s*(\d{1,2})/); if (m) return m[1] + '-' + String(+m[2] + 1).padStart(2, '0');
    m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})/); if (m) return m[1] + '-' + m[2];
    m = String(v == null ? '' : v).match(/^(\d{1,2})\/(\d{4})$/); return m ? m[2] + '-' + m[1].padStart(2, '0') : '';
  }
  function kmOp(p) { p = nu(p); return /INSUMO/.test(p) ? 'INS' : /^(ROTA|UDC)$/.test(p) ? 'ROTA' : /^(ROTA \(VAN\)|VAN)/.test(p) ? 'VAN' : p === 'AUTO SERVICO' ? 'AS' : /^EMPURRADA/.test(p) ? 'EMP' : null; }
  /* bancoVigs: meses que vieram do banco (lá Insumos é linha própria; na aba fica dentro da Empurrada) */
  function indexaKm(json, bancoVigs) {
    const out = [], cols = (json && json.table && json.table.cols) || [], doBanco = new Set(bancoVigs || []);
    let iProj = cols.findIndex(c => c && nu(c.label) === 'PROJETO'); if (iProj < 0) iProj = 19;
    ((json && json.table && json.table.rows) || []).forEach(row => {
      const c = row.c || []; const v = i => { const x = c[i] && c[i].v; return typeof x === 'number' ? x : parseFloat(x) || 0; }, s = i => c[i] && c[i].v != null ? String(c[i].v).trim() : '';
      const vig = vigCel(c[0] && c[0].v), pc = s(14); if (!vig || !pc.includes('-')) return;
      const uni = uniDe(pc.split('-').slice(1).join('-')); let op = kmOp(pc.split('-')[0]);
      if (doBanco.has(vig)) { const o2 = kmOp(s(iProj)); if (o2) op = o2; }
      if (!op) return; const rem = v(31), real = v(32); if (!(rem > 0 || real > 0)) return;
      out.push({ vig, uni, op, rem, real });
    });
    return out;
  }

  /* ── balanço de massa: o km recomposto das Empurradas (a mesma conta da Árvore do Custo) ── */
  const CTA_BM = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'COMBUSTIVEIS', 'FLUIDOS (ARLA)': 'ARLA',
    'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO',
    'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'MANUTENCAO DE VEICULOS E EQUIP.', 'CONSERTOS E RECAPAGENS DE PNEUS': 'RECAPAGENS E OUTROS SERVICOS', 'PNEUS E CAMARAS': 'PNEUS NOVOS' };
  const ctaNK = c => { const n = nu(c); return CTA_BM[n] || n; };
  const BR = v => v.slice(5, 7) + '/' + v.slice(0, 4);
  /* remCta['MM/AAAA|EMPURRADA - UNI'][conta] = remunerado (custo positivo) da aba Frota do DRE */
  function bmKm(B, balRows, KM, remCta) {
    const out = {}; if (!B || !balRows || !balRows.length || !KM) return out;
    const bal = {}; balRows.forEach(x => { const v = vigCel(x.vigencia); if (!v) return; const k = BR(v) + '|' + nu(x.projeto) + ' - ' + nu(x.unidade), c = ctaNK(x.conta); (bal[k] = bal[k] || {})[c] = (bal[k][c] || 0) + (+x.valor || 0); });
    const ini = B.inicioDoBanco(bal, '08/2026'), km0 = {}, kmRe = {};
    KM.forEach(r => { if (r.op !== 'EMP' && r.op !== 'INS') return; const k = BR(r.vig) + '|EMPURRADA - ' + r.uni; km0[k] = (km0[k] || 0) + r.rem; kmRe[k] = (kmRe[k] || 0) + r.real; });
    const novC = B.comRealizado(bal, kmRe), nov = B.recompoe({ bal: novC.bal, remCta: remCta || {}, km0, inicio: ini }), anu = B.porAno([nov.porChave], km0, kmRe);
    Object.entries(anu.porChave || {}).forEach(([k, e]) => { const i = k.indexOf('|'), v = vigCel(k.slice(0, i)), u = k.slice(i + 1).split(' - ').pop(); if (!v) return;
      const o = out[v + '|' + u] = out[v + '|' + u] || { km: 0, valor: 0 }; o.km += +e.km || 0; o.valor += +e.valor || 0; });
    return out;
  }

  /* ── o pago de uma chave ('AAAA-MM|op|uni') num conjunto de campos do FT ──
     kmDe(v, op, u) = km remunerado da chave. Variável: R$/km do FT × km remunerado; sem km (Armazém, mês sem
     Dispersão) = o próprio componente. Nos meses da aba o km de Insumos vem DENTRO da Empurrada: as duas são
     pagas juntas (componentes ÷ km do FT das duas × km da aba) e o valor é repartido pelo componente de cada uma;
     pagar a Empurrada pelo km das duas e Insumos pelo teto contaria Insumos duas vezes. */
  function pago(mapa, k, campos, kmDe) {
    const x = mapa && mapa[k]; if (!x || !campos || !campos.length) return null;
    const sv = y => campos.filter(f => FT_VAR.includes(f)).reduce((a, f) => a + (y[f] || 0), 0);
    const cv = sv(x), cf = campos.filter(f => !FT_VAR.includes(f)).reduce((a, f) => a + (x[f] || 0), 0);
    if (!cv && !cf) return null; if (!cv) return cf;
    const p = k.split('|'), v = p[0], op = p[1], u = p[2], kmR = kmDe(v, op, u) || 0, par = op === 'EMP' ? 'INS' : op === 'INS' ? 'EMP' : null;
    if (par) {
      const y = mapa[v + '|' + par + '|' + u], kmP = y ? (kmDe(v, par, u) || 0) : 0, kmI = op === 'INS' ? kmR : kmP, kmE = op === 'EMP' ? kmR : kmP;
      if (y && !(kmI > 0) && kmE > 0) { const tot = cv + sv(y), kmT = (x.km || 0) + (y.km || 0); if (tot > 0 && kmT > 0) return tot / kmT * kmE * (cv / tot) + cf; }
    }
    return (x.km > 0 && kmR > 0 ? cv / x.km * kmR : cv) + cf;
  }

  /* ── Rem Meta por chave e componente: meta['AAAA-MM|op|uni'][componente] ── */
  function calcula(d) {
    const ft = d.ft || {}, KM = d.km || [], BM = d.bm || {}, ix = {};
    KM.forEach(r => { const k = r.vig + '|' + r.op + '|' + r.uni; ix[k] = (ix[k] || 0) + r.rem; });
    const kmDe = (v, op, u) => (ix[v + '|' + op + '|' + u] || 0) + (op === 'EMP' && BM[v + '|' + u] ? BM[v + '|' + u].km : 0);
    const meta = {};
    Object.keys(ft).forEach(k => { COMP.forEach(c => { const p = pago(ft, k, c.ft, kmDe); if (p == null) return; (meta[k] = meta[k] || {})[c.id] = p; }); });
    return { meta, vigsKm: new Set(KM.map(r => r.vig)), vigsFT: new Set(Object.keys(ft).map(k => k.split('|')[0])), kmDe };
  }

  /* ── leitura: Freightech, Dispersão de km e balanço de massa ── */
  async function todas(q) { const out = []; for (let i = 0; ; i += 1000) { const { data, error } = await q().range(i, i + 999); if (error) throw new Error(error.message); out.push(...(data || [])); if (!data || data.length < 1000) break; } return out; }
  async function carrega(sb, opt) {
    opt = opt || {}; const erros = {};
    const ftRows = await todas(() => sb.from('ft_rem_mes').select('*').gte('vigencia', '2025-01').order('vigencia').order('operacao').order('unidade'));
    if (!ftRows.length) throw new Error('o Freightech (ft_rem_mes) veio vazio: só administradores leem, e o login do hub pode ter vencido');
    const txt = await fetch(`https://docs.google.com/spreadsheets/d/${DISP_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(DISP_TAB)}`).then(r => r.text());
    const json = JSON.parse(txt.match(/setResponse\(([\s\S]*)\)/)[1]);
    const db = g.GvizCache && g.GvizCache.dispBanco, km = indexaKm(json, db && db.vigs);
    if (!km.length) throw new Error('a Dispersão de km veio vazia');
    let bm = {};
    try { const bal = await todas(() => sb.from('balanco_massa').select('unidade,projeto,vigencia,conta,valor').order('vigencia').order('unidade').order('conta'));
      if (!bal.length) throw new Error('a tabela balanco_massa veio vazia');
      if (!g.BalancoMassa) throw new Error('assets/balanco-massa.js não carregou');
      bm = bmKm(g.BalancoMassa, bal, km, opt.remCta);
    } catch (e) { erros.bm = (e && e.message) || String(e); }
    return Object.assign(calcula({ ft: indexaFT(ftRows), km, bm }), { erros, bancoVigs: (db && db.vigs) || [] });
  }

  g.RemMeta = { COMP, OPN, UNIS, nu, opDe, uniDe, opUni, compDe, ctaNK, BR, vigCel, indexaFT, indexaKm, bmKm, pago, calcula, carrega, FT_VAR };
})(typeof window !== 'undefined' ? window : globalThis);
