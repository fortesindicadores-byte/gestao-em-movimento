/* ============================================================
   REMUNERADO POR VIAGEM: o 2artd (T2) e a base de CT-e (T1)
   (Renan, 17–18/11/2026: "Os mapas do 2art é só para saber sobre Qtde de
   viagens. O km remunerado por viagem deve vir da regra do FT que buscamos via
   robô… cada mapa gera km e outras variáveis" · "Aí não dependo mais de
   nenhuma base manual")

   T2 · 2artd (export do Promax, uma linha por mapa):
     - entra a frota PRÓPRIA (Frota Padrão e Fixo); Spot é freteiro e a frota
       Espec. não recebe;
     - tipo: Roteriz, Extra, MKT e Recolha = 1ª viagem; Recarga; Noturna;
     - operação: placa da tabela Van do FT = Van; Entrega AS = Auto Serviço
       (Pelotas AS conta como Rota); o resto, Rota;
     - km por viagem e valor por mapa = FT da QUINZENA do mapa:
         Rota  Parâmetros Operação: KM Mensal Primeira Viagem ÷ 25,
               KM Recarga por Viagem, KM Mensal Noturna ÷ 25;
               Resumo - SRTrans: Custo Variável Padrão ÷ 25 (Marketing ÷ 25),
               Custo Variável Recarga, Custo Variável Noturna
         Van   kmMensalRemuneradoVan ÷ 25, Recarga Van, a noturna da Rota;
               Resumo - SRTrans Van
         AS    Parâmetros Operação AS; Resumo - SRTrans AS
     - mapa virado = a entrega cai num dia depois da saída, fora as noturnas;
     - mapa com valor zero conta (rodamos) e vira aviso ("não deveria ter").
   T1 · base de CT-e (aba Base_CT-es_T1 / Variável_de_Fretes da planilha de
   validação): cada CT-e autorizado é uma viagem, o km é o KM Total da perna e a
   frota são os cavalos ATIVO do FT (aba FT_CAVALO da própria planilha).
   Sai no formato da dispersao_km / dispersao_placa / dispersao_placa_viagem.
   ============================================================ */
(function (raiz) {
  'use strict';
  const NK = s => String(s == null ? '' : s).toUpperCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const merc = p => {
    let s = String(p == null ? '' : p).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{3}\d{4}$/.test(s)) s = s.slice(0, 4) + 'ABCDEFGHIJ'[+s[4]] + s.slice(5);
    return s;
  };
  const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return v;
    const s = String(v).trim(); const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); return isFinite(n) ? n : 0; };
  const r2 = v => Math.round(v * 100) / 100;

  // nome da unidade no FT / sufixo do projeto → código do portal
  const UNI = { CAMBORIU: 'BLC', CUIABA: 'CBA', FLORIANOPOLIS: 'FLP', GUARULHOS: 'GRL', 'NOVA FRIBURGO': 'NFR',
    PELOTAS: 'PLT', 'RIO DE JANEIRO': 'CGR', RONDONOPOLIS: 'RON', MACACU: 'MCC', GOIANIA: 'GNA', PIRAI: 'PIR' };
  const SUF = { GOI: 'GNA' };
  function uniFT(nome) {
    const n = NK(nome); if (/^UDC/.test(n)) return null;
    for (const k of Object.keys(UNI).sort((a, b) => b.length - a.length)) if (n.includes(k)) return UNI[k];
    return null;
  }
  const uniProj = p => { const s = NK(p).split(' - ').pop(); return SUF[s] || s; };
  const AS_COMO_ROTA = ['PLT'];
  const INICIO = '2026-10';   // de out/26 em diante a importação vale no lugar da aba (Renan, 18/11/2026)
  const PROJ = { ROTA: 'Rota', VAN: 'Van', AS: 'Auto Serviço' };

  // vigência do FT: ROTA_1_10_2026 → { q:1, vig:'2026-10' }
  function vigFT(v) {
    const m = String(v || '').match(/_(\d)_(\d{1,2})_(\d{4})$/);
    return m ? { q: +m[1], vig: m[3] + '-' + String(m[2]).padStart(2, '0') } : null;
  }

  /* ── o FT do mês, das linhas da ft_linha já com os nomes das colunas ──
     rows: [{ canal, tabela, vigencia, unidade, placa, o:{coluna:valor} }] */
  function ftIndice(rows) {
    const P = {}, V = {}, FR = {}, vans = new Set(), vigs = {};
    const pega = (k, q) => (P[k] = P[k] || {})[q] = P[k][q] || {};
    rows.forEach(r => {
      const vq = vigFT(r.vigencia); if (!vq) return; const o = r.o || {};
      const u = uniFT(r.unidade || o['Unidade - Nome']); vigs[r.canal + '|' + vq.q] = vq.vig;
      const ativo = x => x === true || NK(x) === 'TRUE' || NK(x) === 'ATIVO';
      switch (r.tabela) {
        case 'ParametrosGeraisRota': if (!u) break;
          Object.assign(pega('ROTA|' + u, vq.q), { prim: num(o['KM Mensal Primeira Viagem']) / 25, rec: num(o['KM Recarga por Viagem']), not: num(o['KM Mensal Noturna']) / 25 });
          Object.assign(pega('VAN|' + u, vq.q), { prim: num(o.kmMensalRemuneradoVan) / 25, not: num(o['KM Mensal Noturna']) / 25 });
          break;
        case 'RecargaVan': if (u) pega('VAN|' + u, vq.q).rec = num(o.kmPorViagem); break;
        case 'ParametrosGeraisAS': if (!u) break;
          Object.assign(pega('AS|' + u, vq.q), { prim: num(o.kmMensalPrimeiraViagem) / 25, rec: num(o.kmRecargaPorViagem), not: num(o.kmMensalNoturna) / 25 });
          break;
        case 'ResumoSrtrans': if (u) (V['ROTA|' + u] = V['ROTA|' + u] || {})[vq.q] = { prim: num(o['Custo Variável Padrão']) / 25,
          mkt: num(o['Custo Variável Marketing']) / 25, rec: num(o['Custo Variável Recarga']), not: num(o['Custo Variável Noturna']) }; break;
        case 'ResumoSrtransVan': if (u) (V['VAN|' + u] = V['VAN|' + u] || {})[vq.q] = { prim: num(o.custoVariavelPadrao) / 25,
          mkt: num(o.custoVariavelPadrao) / 25, rec: num(o.custoVariavelRecarga), not: num(o.custoVariavelNoturna) }; break;
        case 'ResumoSrtransAS': if (u) (V['AS|' + u] = V['AS|' + u] || {})[vq.q] = { prim: num(o.custoVariavelPadrao) / 25,
          mkt: num(o.custoVariavelMkt) / 25, rec: num(o.custoVariavelRecarga), not: num(o.custoVariavelNoturna) }; break;
        case 'Van': { const p = merc(r.placa || o.placa); if (p) vans.add(p);
          if (u && ativo(o.ativo)) ((FR['VAN|' + u] = FR['VAN|' + u] || {})[vq.q] = (FR['VAN|' + u][vq.q] || 0) + 1); break; }
        case 'Caminhao': if (u && ativo(o.Ativo)) ((FR['ROTA|' + u] = FR['ROTA|' + u] || {})[vq.q] = (FR['ROTA|' + u][vq.q] || 0) + 1); break;
        case 'CaminhaoAS': if (u && ativo(o.Ativo)) ((FR['AS|' + u] = FR['AS|' + u] || {})[vq.q] = (FR['AS|' + u][vq.q] || 0) + 1); break;
      }
    });
    return { P, V, FR, vans, vigs };
  }
  // as tabelas do FT que a conta lê
  const FT_TABELAS = [['ROTA', 'ParametrosGeraisRota'], ['ROTA', 'RecargaVan'], ['ROTA', 'ResumoSrtrans'], ['ROTA', 'ResumoSrtransVan'],
    ['ROTA', 'Van'], ['ROTA', 'Caminhao'], ['AS', 'ParametrosGeraisAS'], ['AS', 'ResumoSrtransAS'], ['AS', 'CaminhaoAS']];

  /* ── leitura das planilhas ── */
  function linhas(XLSX, ws) {
    const m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    let hi = m.findIndex(r => r && r.some(c => NK(c) === 'PLACA'));
    if (hi < 0) return null;
    const h = m[hi].map(c => String(c == null ? '' : c).trim());
    const ix = {}; h.forEach((c, i) => { if (!(c in ix)) ix[c] = i; });
    return { h, ix, rows: m.slice(hi + 1).filter(r => r && r.some(c => c != null && c !== '')) };
  }
  const dia = v => {   // número do dia (serial do Excel) de um campo data/hora
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Math.floor(v);
    if (v instanceof Date) return Math.floor(v.getTime() / 864e5 - new Date(1899, 11, 30).getTime() / 864e5);
    const s = String(v).trim(); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { const a = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return Math.round((Date.UTC(a, +m[2] - 1, +m[1]) - Date.UTC(1899, 11, 30)) / 864e5); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5);
    return null;
  };
  // data e hora de um campo do 2artd (serial do Excel, Date ou texto dd/mm/aaaa hh:mm) → 'AAAA-MM-DDTHH:MM:SS' (hora local, sem fuso)
  const dataHora = v => {
    if (v == null || v === '') return null; const p2 = n => String(n).padStart(2, '0');
    if (typeof v === 'number') { if (!(v > 20000 && v < 80000)) return null; const ms = Math.round(v * 86400) * 1000, d = new Date(Date.UTC(1899, 11, 30) + ms);
      return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()); }
    if (v instanceof Date) return isNaN(v) ? null : v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate()) + 'T' + p2(v.getHours()) + ':' + p2(v.getMinutes()) + ':' + p2(v.getSeconds());
    const s = String(v).trim(); let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return (+m[3] < 100 ? 2000 + +m[3] : +m[3]) + '-' + p2(m[2]) + '-' + p2(m[1]) + 'T' + p2(m[4] || 0) + ':' + p2(m[5] || 0) + ':' + p2(m[6] || 0);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00') : null;
  };
  const dataDeSerial = n => { const d = new Date(Date.UTC(1899, 11, 30) + n * 864e5); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };

  /* 2artd → mapas da frota própria + o que ficou fora */
  function le2artd(XLSX, wb) {
    const ws = wb.Sheets['2artd'] || wb.Sheets[wb.SheetNames.find(n => NK(n) === '2ARTD')];
    if (!ws) return null;
    const L = linhas(XLSX, ws); if (!L) return null;
    const need = ['Vigência', 'Carga Atual', 'Frota', 'Projeto', 'Placa', 'CustoVariavel'];
    if (need.some(c => !(c in L.ix))) return null;
    const g = c => L.ix[c];
    const mapas = [], fora = {}; let vig = null;
    const opc = (r, c) => { if (!(c in L.ix)) return null; const v = r[L.ix[c]]; if (v == null || v === '') return null; const n = num(v); return isFinite(n) ? n : null; };
    L.rows.forEach(r => {
      const vq = vigFT(r[g('Vigência')]); if (!vq) return; vig = vig || vq.vig;
      const frota = NK(r[g('Frota')]), carga = NK(r[g('Carga Atual')]);
      if (frota !== 'PADRAO' && frota !== 'FIXO') { const k = 'Frota ' + (String(r[g('Frota')] || '').trim() || 'vazia'); fora[k] = (fora[k] || 0) + 1; return; }
      const tipo = { ROTERIZ: 'prim', EXTRA: 'prim', MKT: 'mkt', RECOLHA: 'mkt', RECARGA: 'rec', NOTURNA: 'not' }[carga];
      if (!tipo) { const k = 'Carga ' + (String(r[g('Carga Atual')] || '').trim() || 'vazia'); fora[k] = (fora[k] || 0) + 1; return; }
      const sai = dia(r[g('HrSai')]), ent = dia(r[g('HrEntr')]);
      mapas.push({ vig: vq.vig, q: vq.q, unidade: uniProj(r[g('Projeto')]), projeto_orig: String(r[g('Projeto')] || '').trim(),
        entrega: NK(r[g('Entrega')]) === 'AS' ? 'AS' : 'ROTA', frota, carga, tipo,
        placa: merc(r[g('Placa')]), placa_origem: String(r[g('Placa')] || '').trim(), mapa: r[g('Mapa')],
        virado: tipo !== 'not' && sai != null && ent != null && ent > sai,
        valor: num(r[g('CustoVariavel')]), faturado: num(r[g('ValorFaturado')]),
        // o mapa em si (remun_mapa): horários, hodômetros digitados e o km que o Roadshow previu
        hrSai: dataHora(r[g('HrSai')]), hrEntr: dataHora(r[g('HrEntr')]), kmSai: opc(r, 'KmSai'), kmEntr: opc(r, 'KmEntr'),
        kmPrev: opc(r, 'KmPrevistoRoad'), kmLaco: opc(r, 'KmLaco'), kmDesl: opc(r, 'KmDeslocamento') });
    });
    return { vig, mapas, fora };
  }

  /* base de CT-e da Empurrada / Insumos */
  function leCtes(XLSX, wb) {
    const nome = wb.SheetNames.find(n => /BASE_CT-?ES_T1/i.test(n.replace(/\s/g, '_'))) || wb.SheetNames.find(n => /VARI[AÁ]VEL_DE_FRETES/i.test(n));
    if (!nome) return null;
    const L = linhas(XLSX, wb.Sheets[nome]); if (!L || !('KM Total da perna' in L.ix)) return null;
    const g = c => L.ix[c];
    const cData = Object.keys(L.ix).find(c => /^DATA\s+DE\s+EMISS/i.test(NK(c)));
    const cSit = Object.keys(L.ix).find(c => NK(c) === 'SITUACAO');
    const ctes = [], ignorados = {};
    L.rows.forEach(r => {
      const sit = cSit ? NK(r[g(cSit)]) : 'AUTORIZADO';
      if (sit && sit !== 'AUTORIZADO') { ignorados[sit] = (ignorados[sit] || 0) + 1; return; }
      const d = dia(r[g(cData)]); if (d == null) { ignorados['sem data'] = (ignorados['sem data'] || 0) + 1; return; }
      const dt = dataDeSerial(d), proj = NK(r[g('nome_projeto')] || r[g('Projeto ')] || '');
      const cap = NK(r[g('Capacidade')] || '');
      const projeto = /INSUMO/.test(proj) ? 'Empurrada - Insumos' : /42/.test(cap) ? 'Empurrada - 42 Palets' : 'Empurrada - 28 Palets';
      ctes.push({ vig: dt.a + '-' + String(dt.m).padStart(2, '0'), q: dt.d > 15 ? 2 : 1, unidade: uniProj(proj), projeto,
        placa: merc(r[g('Placa')]), placa_origem: String(r[g('Placa')] || '').trim(),
        km: num(r[g('KM Total da perna')]), valor: num(r[g('Vl. Frete Liquido')]) });
    });
    // frota: cavalos ATIVO na aba FT_CAVALO da própria planilha, na última quinzena dela
    let frota = null;
    const wc = wb.Sheets['FT_CAVALO'];
    if (wc) {
      const m = XLSX.utils.sheet_to_json(wc, { header: 1, raw: true, defval: null });
      const h = (m[0] || []).map(c => String(c || '').trim()); const iv = h.indexOf('Vigencia'), ia = h.indexOf('ativo'), ic = h.indexOf('combustivelCapacidade');
      if (iv >= 0 && ia >= 0) {
        // por capacidade (28 / 42 pallets), na última quinzena da aba
        const cont = {}; m.slice(1).forEach(r => { const vq = vigFT(r && r[iv]); if (!vq || NK(r[ia]) !== 'ATIVO') return;
          const cap = ic >= 0 && /42/.test(String(r[ic])) ? '42' : '28'; const k = vq.vig + '|' + vq.q;
          (cont[k] = cont[k] || { '28': 0, '42': 0 })[cap]++; });
        const ult = Object.keys(cont).sort().pop(); if (ult) frota = cont[ult];
      }
    }
    return { aba: nome, ctes, ignorados, frota };
  }

  /* ── a conta: T2 ── */
  function calculaT2(art, ft, arquivo) {
    const acc = new Map(), placas = new Map(), viag = new Map(), avisos = [], conf = new Map(), semFT = new Map(), mapas = [];
    art.mapas.filter(x => x.vig >= INICIO).forEach(x => {
      let op = ft.vans.has(x.placa) ? 'VAN' : x.entrega;
      if (op === 'AS' && AS_COMO_ROTA.includes(x.unidade)) op = 'ROTA';
      const projeto = PROJ[op], kp = op + '|' + x.unidade;
      const par = ((ft.P[kp] || {})[x.q]) || null, val = ((ft.V[kp] || {})[x.q]) || null;
      const tipoKm = x.tipo === 'mkt' ? 'prim' : x.tipo;
      const km = par && par[tipoKm] != null ? par[tipoKm] : null;
      if (km == null) semFT.set(kp + '|' + x.q, (semFT.get(kp + '|' + x.q) || 0) + 1);
      const k = x.vig + '|' + x.unidade + '|' + projeto;
      const a = acc.get(k) || { vigencia: x.vig, unidade: x.unidade, projeto, unidade_orig: x.unidade, projetos: new Set(),
        frota_ativa: 0, viagens_prim: 0, km_rem_prim: 0, viagens_rec: 0, km_rem_rec: 0, viagens_not: 0, km_rem_not: 0,
        km_rem: 0, km_real: null, _valor: 0, viagens_mapa_aberto: 0 };
      a.projetos.add(x.projeto_orig);
      const kk = km || 0;
      if (x.tipo === 'rec') { a.viagens_rec++; a.km_rem_rec += kk; }
      else if (x.tipo === 'not') { a.viagens_not++; a.km_rem_not += kk; }
      else { a.viagens_prim++; a.km_rem_prim += kk; }
      a.km_rem += kk; a._valor += x.valor; if (x.virado) a.viagens_mapa_aberto++;
      acc.set(k, a);
      if (x.placa && !/^(REC|HUB)\d/.test(x.placa)) {
        const kpl = k + '|' + x.placa;
        const p = placas.get(kpl) || { vigencia: x.vig, unidade: x.unidade, projeto, placa: x.placa, placa_origem: x.placa_origem, entrega: op === 'AS' ? 'AS' : 'Rota', km_rem: 0, arquivo };
        p.km_rem += kk; placas.set(kpl, p);
        const v = viag.get(kpl) || { vigencia: x.vig, unidade: x.unidade, projeto, placa: x.placa, placa_origem: x.placa_origem, viagens_prim: 0, viagens_rec: 0, viagens_not: 0, arquivo };
        if (x.tipo === 'rec') v.viagens_rec++; else if (x.tipo === 'not') v.viagens_not++; else v.viagens_prim++;
        viag.set(kpl, v);
      }
      // detalhe por unidade × projeto × quinzena × tipo: viagens, km, valor pago × valor do FT
      const kc = k + '|' + x.q + '|' + x.tipo;
      const c = conf.get(kc) || { vigencia: x.vig, quinzena: x.q, unidade: x.unidade, projeto, tipo: x.tipo, viagens: 0, virados: 0,
        sem_valor: 0, km_rem: 0, valor_pago: 0, valor_ft: 0, km_viagem: km, valor_viagem_ft: val ? val[x.tipo] : null, pago_diferente: 0, dif_valor: 0 };
      c.viagens++; if (x.virado) c.virados++; if (!x.valor) c.sem_valor++;
      c.km_rem += kk; c.valor_pago += x.valor;
      if (val && val[x.tipo] != null) { c.valor_ft += val[x.tipo]; if (Math.abs(x.valor - val[x.tipo]) > 0.02) { c.pago_diferente++; c.dif_valor += x.valor - val[x.tipo]; } }
      conf.set(kc, c);
      // cada mapa (remun_mapa): é o que deixa medir depois o rodado por tipo de viagem
      mapas.push({ vigencia: x.vig, quinzena: x.q, unidade: x.unidade, projeto, tipo: x.tipo, carga: x.carga, frota: x.frota, placa: x.placa || null, placa_origem: x.placa_origem || null,
        mapa: x.mapa != null && x.mapa !== '' ? String(x.mapa) : null, hr_sai: x.hrSai || null, hr_entr: x.hrEntr || null, km_sai: x.kmSai != null ? x.kmSai : null, km_entr: x.kmEntr != null ? x.kmEntr : null,
        km_previsto: x.kmPrev != null ? r2(x.kmPrev) : null, km_laco: x.kmLaco != null ? r2(x.kmLaco) : null, km_desloc: x.kmDesl != null ? r2(x.kmDesl) : null,
        km_ft: km != null ? r2(km) : null, valor_pago: r2(x.valor), valor_ft: val && val[x.tipo] != null ? r2(val[x.tipo]) : null, virado: !!x.virado, arquivo });
    });
    // frota ativa: a do FT na 2ª quinzena (a 1ª, se só ela existir)
    const linhasKm = [...acc.values()].map(a => {
      const op = Object.keys(PROJ).find(o => PROJ[o] === a.projeto), fr = ft.FR[op + '|' + a.unidade] || {};
      const o = { ...a, frota_ativa: fr[2] != null ? fr[2] : (fr[1] || 0), projetos_orig: [...a.projetos].join(' + '),
        fator_rskm: a.km_rem ? r2(a._valor / a.km_rem) : null, arquivo };
      delete o.projetos; delete o._valor;
      ['km_rem_prim', 'km_rem_rec', 'km_rem_not', 'km_rem'].forEach(c => { o[c] = r2(o[c]); });
      return o;
    });
    semFT.forEach((n, k) => avisos.push(`${n} mapa(s) de ${k.split('|').slice(0, 2).join(' ')} na ${k.split('|')[2]}ª quinzena sem o parâmetro de km no FT (contaram 0 km)`));
    return { linhas: linhasKm, placas: [...placas.values()].map(p => ({ ...p, km_rem: r2(p.km_rem) })), viagens: [...viag.values()], mapas,
      conf: [...conf.values()].map(c => ({ ...c, km_rem: r2(c.km_rem), valor_pago: r2(c.valor_pago), valor_ft: r2(c.valor_ft), dif_valor: r2(c.dif_valor),
        km_viagem: c.km_viagem != null ? r2(c.km_viagem) : null, valor_viagem_ft: c.valor_viagem_ft != null ? r2(c.valor_viagem_ft) : null })),
      avisos };
  }

  /* ── a conta: T1 ── */
  function calculaT1(b, arquivo) {
    const acc = new Map(), placas = new Map(), viag = new Map(), conf = new Map();
    b.ctes.filter(x => x.vig >= INICIO).forEach(x => {
      const k = x.vig + '|' + x.unidade + '|' + x.projeto;
      const a = acc.get(k) || { vigencia: x.vig, unidade: x.unidade, projeto: x.projeto, unidade_orig: x.unidade, projetos_orig: x.projeto,
        frota_ativa: !b.frota ? 0 : x.projeto === 'Empurrada - 42 Palets' ? b.frota['42'] : x.projeto === 'Empurrada - 28 Palets' ? b.frota['28'] : b.frota['28'] + b.frota['42'], viagens_prim: 0, km_rem_prim: 0, viagens_rec: 0, km_rem_rec: 0, viagens_not: 0, km_rem_not: 0,
        km_rem: 0, km_real: null, _valor: 0, viagens_mapa_aberto: 0 };
      a.viagens_prim++; a.km_rem_prim += x.km; a.km_rem += x.km; a._valor += x.valor; acc.set(k, a);
      if (x.placa) {
        const kpl = k + '|' + x.placa;
        const p = placas.get(kpl) || { vigencia: x.vig, unidade: x.unidade, projeto: x.projeto, placa: x.placa, placa_origem: x.placa_origem, entrega: 'Empurrada', km_rem: 0, arquivo };
        p.km_rem += x.km; placas.set(kpl, p);
        const v = viag.get(kpl) || { vigencia: x.vig, unidade: x.unidade, projeto: x.projeto, placa: x.placa, placa_origem: x.placa_origem, viagens_prim: 0, viagens_rec: 0, viagens_not: 0, arquivo };
        v.viagens_prim++; viag.set(kpl, v);
      }
      const kc = k + '|' + x.q + '|prim';
      const c = conf.get(kc) || { vigencia: x.vig, quinzena: x.q, unidade: x.unidade, projeto: x.projeto, tipo: 'prim', viagens: 0, virados: 0,
        sem_valor: 0, km_rem: 0, valor_pago: 0, valor_ft: null, km_viagem: null, valor_viagem_ft: null, pago_diferente: 0, dif_valor: 0 };
      c.viagens++; if (!x.valor) c.sem_valor++; c.km_rem += x.km; c.valor_pago += x.valor; conf.set(kc, c);
    });
    const linhasKm = [...acc.values()].map(a => { const o = { ...a, fator_rskm: a.km_rem ? r2(a._valor / a.km_rem) : null, arquivo };
      delete o._valor; o.km_rem_prim = r2(o.km_rem_prim); o.km_rem = r2(o.km_rem); return o; });
    return { linhas: linhasKm, placas: [...placas.values()].map(p => ({ ...p, km_rem: r2(p.km_rem) })), viagens: [...viag.values()],
      conf: [...conf.values()].map(c => ({ ...c, km_rem: r2(c.km_rem), valor_pago: r2(c.valor_pago), km_viagem: c.viagens ? r2(c.km_rem / c.viagens) : null })),
      avisos: [] };
  }

  raiz.RemunMapas = { le2artd, leCtes, ftIndice, calculaT2, calculaT1, FT_TABELAS, INICIO, vigFT, uniFT, merc };
})(typeof window !== 'undefined' ? window : globalThis);
