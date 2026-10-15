/* ══════════════════════════════════════════════════════════════
   DISPERSÃO DE KM — leitura da planilha "Dispersão de KM - Consolidado"
   e o km rodado completado pela aba Km/L (Renan, 14/10/2026: "Consigo
   importar essa planilha para o banco sempre e o km rodado que já está lá
   completa?" → "Use os projetos que estão na minha planilha. Com exceção das
   Vans. UDC vira Van" → "sempre transformar tudo em Mercosul por trás do
   De-Para. No painel deve aparecer a placa como está").

   Funções puras (sem banco nem tela), usadas pela página de importação
   (/painel-km/dispersao/) e pelo teste:

     · lePlanilha(XLSX, wb, nome) → { ano, linhas (01-BD), placas (02-ABERT.
       PLACA + a parte T1 da 02-Dinamica), avisos }
     · kmRodado(placas, kml) → km rodado por vigência × unidade × projeto,
       placa a placa, com a regra:
         1. Van vem da aba Km/L (projeto VAN / ROTA (VAN) / UDC);
         2. o resto, o projeto da planilha naquele mês; placa em duas
            operações vai para a de mais km remunerado (em Pelotas, AS vence:
            a Km/L não separa AS de Rota lá);
         3. placa fora da lista do mês fica com o projeto do último mês em que
            apareceu na planilha;
         4. senão, o projeto da aba Km/L;
       e o km é UMA linha por placa e mês da aba Km/L (ela tem placa repetida).
     · monta(linhas, km) → a tabela final: km rodado da planilha quando ela
       tem, senão o completado.

   A PLACA SE COMPARA SEMPRE EM MERCOSUL (merc): a aba Km/L grava CUC9F14 e a
   planilha CUC9514 — é a mesma placa. Na tela vai a placa como veio.
   ══════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  const NK = s => String(s == null ? '' : s).toUpperCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const norm = s => NK(s).replace(/[^A-Z0-9]/g, '');

  /* placa antiga LLLNNNN → Mercosul LLLNLNN (5º caractere: 0=A … 9=J) */
  function merc(p) {
    let s = String(p == null ? '' : p).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{3}\d{4}$/.test(s)) s = s.slice(0, 4) + 'ABCDEFGHIJ'[+s[4]] + s.slice(5);
    return s;
  }

  /* nome da unidade na planilha → código do portal (sem tier: o tier sai do projeto) */
  const UNI = {
    'PIRAI': 'PIR', 'MACACU': 'MCC', 'CACHOEIRAS DE MACACU': 'MCC', 'BALNEARIO': 'BLC', 'CAMBORIU': 'BLC',
    'CUIABA': 'CBA', 'FLORIANOPOLIS': 'FLP', 'FLORIPA': 'FLP', 'GUARULHOS': 'GRL', 'NOVA FRIBURGO': 'NFR',
    'PELOTAS': 'PLT', 'CAMPO GRANDE': 'CGR', 'RIO DE JANEIRO': 'CGR', 'RONDONOPOLIS': 'RON',
    'ANHANGUERA': 'ANG', 'GOIANIA': 'GNA',
  };
  function unidadeDe(nome) {
    const n = NK(nome);
    for (const k of Object.keys(UNI).sort((a, b) => b.length - a.length)) if (n.includes(k)) return UNI[k];
    return null;
  }

  /* projeto, com o nome que a planilha usa. "Van - UDC" e "UDC" viram Van. */
  const PROJ = ['Empurrada - 28 Palets', 'Empurrada - 42 Palets', 'Empurrada - Insumos', 'Rota', 'Auto Serviço', 'Van'];
  function projetoDe(txt) {
    const n = NK(txt);
    if (!n) return null;
    if (/INSUMO/.test(n)) return 'Empurrada - Insumos';
    if (/42/.test(n) && /EMPURR/.test(n)) return 'Empurrada - 42 Palets';
    if (/EMPURR/.test(n)) return 'Empurrada - 28 Palets';
    if (/^AUTO|^AS$/.test(n)) return 'Auto Serviço';
    if (/VAN|UDC/.test(n)) return 'Van';
    if (/ROTA/.test(n)) return 'Rota';
    return null;
  }
  /* projeto da aba Km/L ('ROTA - CBA', 'VAN - GRL', 'ROTA (VAN) - GRL', 'UDC - GRL',
     'EMPURRADA - PIR', 'INSUMOS - PIR', 'AUTO SERVIÇO - CGR') → { proj, uni } */
  function projetoKml(o) {
    const s = String(o == null ? '' : o).trim();
    const i = s.lastIndexOf(' - ');
    if (i < 0) return null;
    let uni = s.slice(i + 3).trim().toUpperCase(); const pre = NK(s.slice(0, i));
    if (uni === 'GOI') uni = 'GNA';   // a Km/L escreve 'AUTO SERVIÇO - GOI'; a planilha e o portal usam GNA (15/10/2026)
    let proj = null;
    if (/VAN|UDC/.test(pre)) proj = 'Van';
    else if (/INSUMO/.test(pre)) proj = 'Empurrada - Insumos';
    else if (/EMPURR/.test(pre)) proj = 'Empurrada - 28 Palets';
    else if (/AUTO/.test(pre)) proj = 'Auto Serviço';
    else if (/ROTA/.test(pre)) proj = 'Rota';
    return proj && uni ? { proj, uni } : null;
  }

  const MES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
  const mesDe = t => MES[NK(t).slice(0, 3)] || null;
  const vig = (ano, m) => ano + '-' + String(m).padStart(2, '0');
  /* a célula do mês: DATA (o Renan passou o Mês da 01-BD para 01/09/2026, 14/10/2026),
     serial do Excel, 'set/26', 'MM/AAAA' ou o nome do mês ("Setembro", "AGOSTO") —
     esse último leva o ano do nome do arquivo. */
  function vigCel(c, ano) {
    if (c instanceof Date && !isNaN(c)) return vig(c.getFullYear(), c.getMonth() + 1);
    if (typeof c === 'number' && c > 20000 && c < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30)); d.setUTCDate(d.getUTCDate() + Math.round(c));
      return vig(d.getUTCFullYear(), d.getUTCMonth() + 1);
    }
    const t = String(c == null ? '' : c).trim();
    let m = t.match(/^Date\((\d{4}),(\d{1,2})/); if (m) return vig(+m[1], +m[2] + 1);   // gviz: "Date(2026,8,1)" = set/26
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return vig(+m[3], +m[2]);
    m = t.match(/^(\d{4})-(\d{2})/); if (m) return vig(+m[1], +m[2]);
    m = t.match(/^(\d{1,2})\/(\d{4})$/); if (m) return vig(+m[2], +m[1]);
    m = t.match(/^([A-Za-zçÇ]{3})[a-zçÇ]*\/(\d{2,4})$/); if (m && mesDe(m[1])) return vig(m[2].length === 2 ? 2000 + +m[2] : +m[2], mesDe(m[1]));
    const n = mesDe(t); if (n && ano) return vig(ano, n);
    return null;
  }
  const numero = v => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
    if (!s) return 0;
    const u = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const casas = u < 0 ? 0 : s.length - u - 1;
    const x = parseFloat((u < 0 || casas === 3) ? s.replace(/[.,]/g, '') : s.slice(0, u).replace(/[.,]/g, '') + '.' + s.slice(u + 1));
    return isFinite(x) ? x : 0;
  };
  const r2 = x => Math.round(x * 100) / 100;

  /* acha a coluna pelo RÓTULO, a partir de uma posição */
  function col(hdr, de, ...alvos) {
    const h = hdr.map(norm);
    for (const a of alvos) { const i = h.findIndex((x, j) => j >= de && x === norm(a)); if (i >= 0) return i; }
    for (const a of alvos) { const i = h.findIndex((x, j) => j >= de && x.includes(norm(a))); if (i >= 0) return i; }
    return -1;
  }

  /* SÓ DE SET/2026 EM DIANTE (Renan, 14/10/2026: "Mas traga só de set/2026 em
     diante" · "Não mude resultados anteriores"): jan a ago continuam vindo da
     aba Dispersão de km de sempre. Cortar os meses anteriores não muda setembro
     (conferido: 0 casas diferentes com ou sem a lista de placas de agosto). */
  const INICIO = '2026-09';

  /* ── leitura da planilha ── */
  function lePlanilha(XLSX, wb, nome, inicio) {
    const ini = inicio || INICIO;
    const avisos = [];
    const am = String(nome || '').match(/(20\d{2})/);
    const ano = am ? +am[1] : null;   // só para mês escrito por extenso; data já traz o ano
    const aba = n => { const k = wb.SheetNames.find(s => norm(s) === norm(n)); return k ? wb.Sheets[k] : null; };
    const grade = sh => XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, blankrows: false, raw: true });

    // 01-BD: uma linha por mês × unidade × projeto
    const bd = aba('01-BD');
    if (!bd) throw new Error('não achei a aba 01-BD');
    const g = grade(bd);
    const iC = g.findIndex(l => (l || []).some(c => /km remunerado por m[eê]s/i.test(String(c || ''))) && (l || []).some(c => /^unidade$/i.test(String(c || '').trim())));
    if (iC < 0) throw new Error('na 01-BD não achei o cabeçalho (Mês · Unidade · Projeto · Km remunerado por mês)');
    const h = (g[iC] || []).map(v => String(v == null ? '' : v).trim());
    const C = {
      mes: col(h, 0, 'Mês'), uni: col(h, 0, 'Unidade'), proj: col(h, 0, 'Projeto'), frota: col(h, 0, 'Frota Ativa'),
      vPri: col(h, 0, '[Roteirizado]Quantidade de viagens realizadas'), kPri: col(h, 0, '[Roteirizado] Km remunerado por mês'),
      vRec: col(h, 0, '[Recarga]Quantidade de viagens realizadas'), kRec: col(h, 0, '[Recarga]Km remunerado por mês'),
      vNot: col(h, 0, '[Noturna] Quantidade de viagens realizadas'), kNot: col(h, 0, '[Noturna] Km remunerado por mês'),
      kRem: col(h, 0, '[Consolidado]Km remunerado por mês'), kReal: col(h, 0, '[Consolidado]Km rodado por mês'),
      fator: col(h, 0, 'Fator de remuneração'), mapa: col(h, 0, 'Viagens Mapa Aberto'),
    };
    const falta = ['mes', 'uni', 'proj', 'kRem', 'kReal'].filter(k => C[k] < 0);
    if (falta.length) throw new Error('na 01-BD faltam as colunas: ' + falta.join(', '));
    const L = new Map(); const semUni = new Set(), semProj = new Set(), semMes = new Set();
    for (let i = iC + 1; i < g.length; i++) {
      const l = g[i] || [];
      const vg = vigCel(l[C.mes], ano);
      if (!vg) { if (l[C.mes] != null && String(l[C.mes]).trim()) semMes.add(String(l[C.mes])); continue; }
      const u = unidadeDe(l[C.uni]); const p = projetoDe(l[C.proj]);
      if (!u) { semUni.add(String(l[C.uni])); continue; }
      if (!p) { semProj.add(String(l[C.proj])); continue; }
      const k = vg + '|' + u + '|' + p;
      const a = L.get(k) || { vigencia: vg, unidade: u, projeto: p, unidade_orig: String(l[C.uni]).trim(),
        projetos_orig: [], frota_ativa: 0, viagens_prim: 0, km_rem_prim: 0, viagens_rec: 0, km_rem_rec: 0,
        viagens_not: 0, km_rem_not: 0, km_rem: 0, km_real: 0, _fat: 0, viagens_mapa_aberto: 0 };
      const po = String(l[C.proj]).trim(); if (!a.projetos_orig.includes(po)) a.projetos_orig.push(po);
      const v = c => C[c] >= 0 ? numero(l[C[c]]) : 0;
      a.frota_ativa += v('frota'); a.viagens_prim += v('vPri'); a.km_rem_prim += v('kPri');
      a.viagens_rec += v('vRec'); a.km_rem_rec += v('kRec'); a.viagens_not += v('vNot'); a.km_rem_not += v('kNot');
      a.km_rem += v('kRem'); a.km_real += v('kReal'); a._fat += v('fator') * v('kRem'); a.viagens_mapa_aberto += v('mapa');
      L.set(k, a);
    }
    if (semMes.size) avisos.push('mês sem ano (escreva a data, ex.: 01/09/2026, ou ponha o ano no nome do arquivo): ' + [...semMes].slice(0, 5).join(', '));
    if (semUni.size) avisos.push('unidade fora do de-para (linha ignorada): ' + [...semUni].join(', '));
    if (semProj.size) avisos.push('projeto não reconhecido (linha ignorada): ' + [...semProj].join(', '));
    const linhas = [...L.values()].map(a => {
      const o = { ...a, fator_rskm: a.km_rem ? r2(a._fat / a.km_rem) : null, projetos_orig: a.projetos_orig.join(' + ') };
      delete o._fat;
      ['frota_ativa', 'viagens_prim', 'km_rem_prim', 'viagens_rec', 'km_rem_rec', 'viagens_not', 'km_rem_not', 'km_rem', 'viagens_mapa_aberto'].forEach(c => { o[c] = r2(o[c]); });
      o.km_real = o.km_real > 0 ? r2(o.km_real) : null;   // vazio/zero = o mês ainda não tem km rodado
      return o;
    });

    // placas: 02-ABERT. PLACA (T2) + a parte T1 (Empurrada) da 02-Dinamica. Placa
    const P = new Map();
    const pushP = (vg, uniTxt, opTxt, placa, km, entrega) => {
      const u = unidadeDe(uniTxt), p = projetoDe(opTxt), pm = merc(placa);
      if (!vg || !u || !p || !pm) return false;
      const k = vg + '|' + u + '|' + p + '|' + pm;
      const a = P.get(k) || { vigencia: vg, unidade: u, projeto: p, placa: pm, placa_origem: String(placa).trim(), entrega: entrega || null, km_rem: 0 };
      a.km_rem = r2(a.km_rem + numero(km)); P.set(k, a); return true;
    };
    const ab = aba('02-ABERT. PLACA');
    if (ab) {
      const ga = grade(ab);
      const iA = ga.findIndex(l => (l || []).some(c => /^opera[cç][aã]o$/i.test(String(c || '').trim())) && (l || []).some(c => /^placa$/i.test(String(c || '').trim())));
      if (iA < 0) avisos.push('na 02-ABERT. PLACA não achei o cabeçalho (OPERAÇÃO · Placa)');
      else {
        const ha = (ga[iA] || []).map(v => String(v == null ? '' : v).trim());
        const A = { op: col(ha, 0, 'OPERAÇÃO'), pl: col(ha, 0, 'Placa'), mes: col(ha, 0, 'MÊS'), uni2: col(ha, 0, 'UNIDADE2'),
          uni: col(ha, 0, 'UNIDADE'), ent: col(ha, 0, 'Entrega'), km: col(ha, 0, '[Consolidado]Km remunerado por mês') };
        let n = 0;
        for (let i = iA + 1; i < ga.length; i++) {
          const l = ga[i] || []; const vg = vigCel(l[A.mes], ano); if (!vg || !l[A.pl]) continue;
          if (pushP(vg, A.uni2 >= 0 && l[A.uni2] ? l[A.uni2] : l[A.uni], l[A.op], l[A.pl], A.km >= 0 ? l[A.km] : 0, A.ent >= 0 ? String(l[A.ent] || '').trim() : null)) n++;
        }
        if (!n) avisos.push('a 02-ABERT. PLACA não trouxe nenhuma placa');
      }
    } else avisos.push('não achei a aba 02-ABERT. PLACA (sem a lista de placas, o projeto sai só da aba Km/L)');
    const di = aba('02-Dinamica. Placa');
    if (di) {
      const gd = grade(di);
      const iD = gd.findIndex(l => (l || []).some(c => /^projeto$/i.test(String(c || '').trim())) && (l || []).some(c => /km total/i.test(String(c || ''))));
      if (iD >= 0) {
        const hd = (gd[iD] || []).map(v => String(v == null ? '' : v).trim());
        const ip = col(hd, 0, 'PROJETO');
        const back = (de, rot) => { for (let j = de; j >= 0; j--) if (norm(hd[j]) === norm(rot)) return j; return -1; };
        const D = { proj: ip, uni: back(ip, 'UNIDADE'), mes: back(ip, 'MÊS'), pl: col(hd, ip, 'Placa'), km: col(hd, ip, 'KM Total') };
        if (D.uni >= 0 && D.mes >= 0 && D.pl >= 0) {
          for (let i = iD + 1; i < gd.length; i++) {
            const l = gd[i] || []; const vg = vigCel(l[D.mes], ano); if (!vg || !l[D.pl]) continue;
            pushP(vg, l[D.uni], l[D.proj], l[D.pl], D.km >= 0 ? l[D.km] : 0, 'T1');
          }
        }
      }
    }
    const antes = new Set([...linhas.map(l => l.vigencia), ...[...P.values()].map(x => x.vigencia)].filter(v => v < ini));
    if (!linhas.length) throw new Error(ano ? 'a 01-BD não trouxe nenhuma linha com mês, unidade e projeto' : 'a 01-BD não trouxe linha com mês legível: escreva o Mês como data (01/09/2026) ou ponha o ano no nome do arquivo');
    return { ano, inicio: ini, antes: [...antes].sort(),
      linhas: linhas.filter(l => l.vigencia >= ini), placas: [...P.values()].filter(x => x.vigencia >= ini), avisos };
  }

  /* ── km rodado pela aba Km/L, placa a placa ──
     kml: [{ vigencia:'AAAA-MM', projeto:'ROTA - CBA', placa, km }] */
  const AS_PELA_PLANILHA = ['PLT'];   // onde a Km/L junta AS e Rota (no DRE as duas são uma)
  function kmRodado(placas, kml) {
    // planilha: por vigência e placa (Mercosul), as operações (sem Van) com o km rem de cada uma
    const ops = new Map(), hist = new Map();
    placas.forEach(p => {
      if (p.projeto === 'Van') return;
      const k = p.vigencia + '|' + p.placa;
      const m = ops.get(k) || new Map(); const kk = p.unidade + '|' + p.projeto;
      m.set(kk, (m.get(kk) || 0) + (+p.km_rem || 0)); ops.set(k, m);
      const h = hist.get(p.placa) || []; if (!h.includes(p.vigencia)) h.push(p.vigencia); hist.set(p.placa, h);
    });
    hist.forEach(h => h.sort());
    const escolhe = m => {
      const it = [...m.entries()];
      const asPlt = it.find(([k]) => AS_PELA_PLANILHA.includes(k.split('|')[0]) && k.endsWith('|Auto Serviço'));
      if (asPlt) return asPlt[0];
      return it.sort((a, b) => b[1] - a[1])[0][0];
    };
    const vistos = new Set(); const det = []; let repetidas = 0, semProjeto = 0;
    kml.forEach(r => {
      const pm = merc(r.placa); if (!pm || !r.vigencia) return;
      const chave = r.vigencia + '|' + pm;
      if (vistos.has(chave)) { repetidas++; return; }       // uma linha por placa e mês
      vistos.add(chave);
      const pk = projetoKml(r.projeto); if (!pk) { semProjeto++; return; }
      let uni = pk.uni, proj = pk.proj, origem = 'Km/L';
      if (pk.proj === 'Van') origem = 'Van pela Km/L';
      else {
        let m = ops.get(chave);
        if (m) origem = 'planilha';
        else {
          const ant = (hist.get(pm) || []).filter(v => v < r.vigencia).pop();
          if (ant) { m = ops.get(ant + '|' + pm); origem = 'planilha (' + ant + ')'; }
        }
        if (m) { const [u, p] = escolhe(m).split('|'); uni = u; proj = p; }
      }
      det.push({ vigencia: r.vigencia, unidade: uni, projeto: proj, placa: pm, placa_origem: String(r.placa).trim(),
        km: +r.km || 0, origem, projeto_kml: String(r.projeto || '').trim() });
    });
    const tot = new Map();
    det.forEach(d => { const k = d.vigencia + '|' + d.unidade + '|' + d.projeto; tot.set(k, (tot.get(k) || 0) + d.km); });
    return { det, tot, repetidas, semProjeto };
  }

  /* ── a tabela final: o km rodado da planilha quando ela tem; senão, o completado ── */
  function monta(linhas, km) {
    const out = linhas.map(l => {
      const k = l.vigencia + '|' + l.unidade + '|' + l.projeto;
      const kmKml = km.tot.has(k) ? Math.round(km.tot.get(k)) : null;
      const real = l.km_real != null ? +l.km_real : kmKml;
      const fonte = l.km_real != null ? 'planilha' : (kmKml != null ? 'Km/L' : null);
      const disp = real != null ? real - (+l.km_rem || 0) : null;
      return { ...l, km_kml: kmKml, km_rodado: real, fonte, disp_km: disp,
        disp_pct: real != null && +l.km_rem ? disp / +l.km_rem : null };
    });
    return out;
  }

  /* ── O KM REMUNERADO POR PLACA DA ABA ABERTURA, DE SET/26 EM DIANTE (Renan, 15/10/2026:
     "a partir de setembro você consegue ler apenas essas colunas para subir remunerado por
     placa? Realizado e R$/km por placa já estão no banco"). Da aba Abertura (Base Dispersão
     de km) valem só UNIDADE · MÊS · PROJETO · Placa · Remunerado; o realizado sai da aba
     Km/L (kmRodado) e o R$/km da chave. A tabela vem como { cols:[rótulos], rows:[[valores]] }.
     → a lista de placas no formato da dispersao_placa, só dos meses ≥ INICIO. */
  function placasAbertura(tab) {
    const cols = ((tab && tab.cols) || []).map(c => NK(c));
    const ac = (...t) => { for (const x of t) { const i = cols.findIndex(c => c === x); if (i >= 0) return i; }
      for (const x of t) { const i = cols.findIndex(c => c.includes(x)); if (i >= 0) return i; } return -1; };
    const C = { uni: ac('UNIDADE'), mes: ac('MES'), proj: ac('PROJETO'), pl: ac('PLACA'), rem: ac('REMUNERADO') };
    if (Object.values(C).some(i => i < 0)) return [];
    const P = new Map();
    ((tab && tab.rows) || []).forEach(l => {
      const vg = vigCel(l[C.mes]); if (!vg || vg < INICIO) return;
      const u = unidadeDe(l[C.uni]), p = projetoDe(l[C.proj]), pm = merc(l[C.pl]);
      if (!u || !p || !pm) return;
      const k = vg + '|' + u + '|' + p + '|' + pm;
      const a = P.get(k) || { vigencia: vg, unidade: u, projeto: p, placa: pm, placa_origem: String(l[C.pl]).trim(), km_rem: 0, fonte: 'Abertura' };
      a.km_rem = r2(a.km_rem + numero(l[C.rem])); P.set(k, a);
    });
    return [...P.values()];
  }
  /* ══ KM REMUNERADO POR PLACA PELA PLANILHA DE VIAGENS (Renan, 15/10/2026: "Use essa planilha
     para subir remunerado por placa Rota, AS e Van. Deixe T1 fora") ══
     Uma linha por VIAGEM (export do Roadshow). Regras dele:
       · C Entrega = AS ou Rota; na Rota, A Tipo = VAN é o projeto Van (De-Para dele pela placa);
         Pelotas: AS conta como Rota ("Pelotas o AS pode considerar como Rota");
       · D Carga Atual = Extra e Roteriz são 1ª viagem; Recarga e Noturna têm km próprio;
         MKT e Recolha ficam fora;
       · E Frota = Spot é freteiro e fica fora (e o projeto TERCEIROS também).
     O km de cada viagem é o km por viagem do tipo na 01-BD da unidade × projeto × mês,
     então a soma das placas bate com o km remunerado da 01-BD quando as viagens batem. */
  const AS_COMO_ROTA = ['PLT'];
  const UNI_COD = ['BLC', 'CBA', 'CGR', 'FLP', 'GNA', 'GRL', 'MCC', 'NFR', 'PLT', 'RON', 'PIR', 'ANG'];
  const CARGA = { EXTRA: 'prim', ROTERIZ: 'prim', RECARGA: 'rec', NOTURNA: 'not' };
  function vigViagem(c, data) {
    const t = String(c == null ? '' : c).trim();
    let m = t.match(/_(\d{1,2})_(\d{4})$/); if (m) return vig(+m[2], +m[1]);   // ROTA_1_9_2026 = 1ª quinzena de set/26
    const v = vigCel(c); if (v) return v;
    m = String(data == null ? '' : data).trim().match(/^(\d{1,2})(\d{2})(\d{4})$/);   // Data 1092026 = 01/09/2026
    return m ? vig(+m[3], +m[2]) : null;
  }
  function leViagens(XLSX, wb, nome, inicio) {
    const ini = inicio || INICIO;
    let g = null, iH = -1, h = null;
    for (const sn of wb.SheetNames) {
      const gg = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, blankrows: false, raw: true });
      const i = gg.slice(0, 15).findIndex(l => { const n = (l || []).map(norm); return n.includes('PLACA') && n.includes('CARGAATUAL') && n.includes('ENTREGA') && n.includes('PROJETO'); });
      if (i >= 0) { g = gg; iH = i; h = (gg[i] || []).map(v => String(v == null ? '' : v)); break; }
    }
    if (!g) return null;   // não é a planilha de viagens
    const C = { tipo: col(h, 0, 'Tipo'), vig: col(h, 0, 'Vigência'), ent: col(h, 0, 'Entrega'), carga: col(h, 0, 'Carga Atual'),
      frota: col(h, 0, 'Frota'), proj: col(h, 0, 'Projeto'), uni: col(h, 0, 'Nome - Unidade'), data: col(h, 0, 'Data'), pl: col(h, 0, 'Placa') };
    const falta = ['tipo', 'vig', 'ent', 'carga', 'frota', 'proj', 'pl'].filter(k => C[k] < 0);
    if (falta.length) throw new Error('na planilha de viagens faltam as colunas: ' + falta.join(', '));
    const P = new Map(), fora = {}, antes = new Set(); let lidas = 0;
    const conta = m => { fora[m] = (fora[m] || 0) + 1; };
    for (let i = iH + 1; i < g.length; i++) {
      const l = g[i] || []; if (!l.some(v => v != null && String(v).trim() !== '')) continue;
      lidas++;
      const vg = vigViagem(l[C.vig], C.data >= 0 ? l[C.data] : null); if (!vg) { conta('sem vigência'); continue; }
      if (vg < ini) { antes.add(vg); continue; }
      if (NK(l[C.frota]) === 'SPOT') { conta('Spot (freteiro)'); continue; }
      const tc = CARGA[NK(l[C.carga])]; if (!tc) { conta(String(l[C.carga] || '(vazio)').trim() || '(vazio)'); continue; }
      const pj = String(l[C.proj] == null ? '' : l[C.proj]).trim(), k3 = pj.lastIndexOf(' - ');
      const pre = NK(k3 >= 0 ? pj.slice(0, k3) : pj);
      if (/TERCEIRO/.test(pre)) { conta('projeto TERCEIROS'); continue; }
      if (/EMPURR|INSUMO/.test(pre)) { conta('T1 (Empurrada)'); continue; }
      let u = k3 >= 0 ? pj.slice(k3 + 3).trim().toUpperCase() : ''; if (u === 'GOI') u = 'GNA';
      if (!UNI_COD.includes(u)) u = C.uni >= 0 ? unidadeDe(l[C.uni]) : null;
      if (!u) { conta('unidade não reconhecida'); continue; }
      const pm = merc(l[C.pl]); if (!pm) { conta('sem placa'); continue; }
      let p = NK(l[C.ent]) === 'AS' ? 'Auto Serviço' : (NK(l[C.tipo]) === 'VAN' ? 'Van' : 'Rota');
      if (p === 'Auto Serviço' && AS_COMO_ROTA.includes(u)) p = NK(l[C.tipo]) === 'VAN' ? 'Van' : 'Rota';
      const k = vg + '|' + u + '|' + p + '|' + pm;
      const a = P.get(k) || { vigencia: vg, unidade: u, projeto: p, placa: pm, placa_origem: String(l[C.pl]).trim(), viagens_prim: 0, viagens_rec: 0, viagens_not: 0 };
      a['viagens_' + tc]++; P.set(k, a);
    }
    return { linhas: [...P.values()], fora, lidas, antes: [...antes].sort(), inicio: ini };
  }

  /* viagens × 01-BD → km remunerado por placa. 1ª viagem = km da 1ª ÷ viagens da 1ª da 01-BD;
     recarga + noturna dividem o resto do km remunerado da 01-BD (km rem − km da 1ª), na proporção
     das viagens de cada placa pesadas pelo km por viagem de cada tipo (sem viagem do tipo na 01-BD,
     pesa como a 1ª). conf: a conferência por unidade × projeto (viagens e km, placas × 01-BD). */
  function remPlacas(viagens, linhas) {
    const bd = new Map(); (linhas || []).forEach(l => bd.set(l.vigencia + '|' + l.unidade + '|' + l.projeto, l));
    const grupos = new Map();
    (viagens || []).forEach(v => { const k = v.vigencia + '|' + v.unidade + '|' + v.projeto; (grupos.get(k) || grupos.set(k, []).get(k)).push(v); });
    const placas = [], conf = [];
    grupos.forEach((vs, k) => {
      const l = bd.get(k), [vg, u, p] = k.split('|');
      const v1 = vs.reduce((s, v) => s + (+v.viagens_prim || 0), 0), vr = vs.reduce((s, v) => s + (+v.viagens_rec || 0), 0), vn = vs.reduce((s, v) => s + (+v.viagens_not || 0), 0);
      const c = { vigencia: vg, unidade: u, projeto: p, placas: vs.length, v1, vr, vn, v1BD: null, vrBD: null, vnBD: null, kmBD: null, km: null, semLinha: !l };
      if (!l) { vs.forEach(v => placas.push({ ...v, km_rem: null })); conf.push(c); return; }
      const t1 = (+l.viagens_prim || 0) > 0 ? (+l.km_rem_prim || 0) / +l.viagens_prim : 0;
      const tr = (+l.viagens_rec || 0) > 0 && +l.km_rem_rec > 0 ? +l.km_rem_rec / +l.viagens_rec : t1;
      const tn = (+l.viagens_not || 0) > 0 && +l.km_rem_not > 0 ? +l.km_rem_not / +l.viagens_not : t1;
      const resto = Math.max(0, (+l.km_rem || 0) - (+l.km_rem_prim || 0));
      const peso = v => (+v.viagens_rec || 0) * tr + (+v.viagens_not || 0) * tn, pT = vs.reduce((s, v) => s + peso(v), 0);
      // sem recarga nem noturna na planilha e com resto na 01-BD: o resto vai pelas viagens de 1ª (a soma bate)
      const pesoF = pT > 0 ? peso : v => +v.viagens_prim || 0, pF = pT > 0 ? pT : v1;
      let km = 0;
      vs.forEach(v => { const kr = (+v.viagens_prim || 0) * t1 + (pF > 0 ? resto * pesoF(v) / pF : 0); km += kr; placas.push({ ...v, km_rem: r2(kr) }); });
      Object.assign(c, { v1BD: +l.viagens_prim || 0, vrBD: +l.viagens_rec || 0, vnBD: +l.viagens_not || 0, kmBD: +l.km_rem || 0, km: r2(km), restoPela1a: pT > 0 ? 0 : r2(resto) });
      conf.push(c);
    });
    // linha da 01-BD (Rota, AS, Van) dos meses da planilha sem nenhuma viagem: fica na conferência
    const vigs = new Set((viagens || []).map(v => v.vigencia));
    (linhas || []).forEach(l => { const k = l.vigencia + '|' + l.unidade + '|' + l.projeto;
      if (!vigs.has(l.vigencia) || grupos.has(k) || /^Empurrada/.test(l.projeto)) return;
      conf.push({ vigencia: l.vigencia, unidade: l.unidade, projeto: l.projeto, placas: 0, v1: 0, vr: 0, vn: 0,
        v1BD: +l.viagens_prim || 0, vrBD: +l.viagens_rec || 0, vnBD: +l.viagens_not || 0, kmBD: +l.km_rem || 0, km: 0, semViagem: true }); });
    return { placas, conf };
  }

  /* o REALIZADO de cada placa: o km dela na aba Km/L no mês (det do kmRodado), repartido entre as
     linhas dela na proporção do km remunerado. A parte T1 (lista de placas do banco, Empurrada) entra
     na conta e fica de fora (Renan, 15/10/2026: "Deixe T1 fora"), senão a placa que roda Empurrada e
     faz umas viagens de Rota levaria o mês inteiro para a Rota. Placa da Km/L num projeto T2 sem
     nenhuma viagem na planilha entra com remunerado 0 (rodou sem viagem remunerada). */
  function realPlacas(rem, det, lista) {
    const kmPl = new Map(); (det || []).forEach(d => { const k = d.vigencia + '|' + d.placa; kmPl.set(k, (kmPl.get(k) || 0) + (+d.km || 0)); });
    const t1 = new Map(); (lista || []).forEach(p => { if (!/^Empurrada/.test(p.projeto)) return; const k = p.vigencia + '|' + p.placa; t1.set(k, (t1.get(k) || 0) + (+p.km_rem || 0)); });
    // placa que a aba Km/L põe na Empurrada (T1) e fez umas viagens de Rota: a lista de placas do banco
    // pode não ter a parte T1 dela (set/26 não tem), e ela levaria o mês inteiro para a Rota (JBL5H95 em
    // MCC: +11.116 km sobre 138 remunerados). É placa T1: fica fora da análise por placa de T2.
    const t1Kml = new Set(); (det || []).forEach(d => { const pk = projetoKml(d.projeto_kml); if (pk && /^Empurrada/.test(pk.proj)) t1Kml.add(d.vigencia + '|' + d.placa); });
    const porPl = new Map(); (rem || []).forEach(r => { const k = r.vigencia + '|' + r.placa; (porPl.get(k) || porPl.set(k, []).get(k)).push(r); });
    const out = []; out.t1Fora = [];
    porPl.forEach((rs, k) => {
      if (t1Kml.has(k) && !t1.has(k)) { rs.forEach(r => out.t1Fora.push(r)); return; }
      const km = kmPl.get(k) || 0, w1 = t1.get(k) || 0, wT = rs.reduce((s, r) => s + (+r.km_rem || 0), 0) + w1;
      rs.forEach(r => out.push({ ...r, km_real: r2(wT > 0 ? km * (+r.km_rem || 0) / wT : (w1 > 0 ? 0 : km / rs.length)), t1: w1 > 0 }));
    });
    const vigs = new Set((rem || []).map(r => r.vigencia));
    (det || []).forEach(d => { if (!vigs.has(d.vigencia) || /^Empurrada/.test(d.projeto) || t1Kml.has(d.vigencia + '|' + d.placa) || porPl.has(d.vigencia + '|' + d.placa)) return;
      out.push({ vigencia: d.vigencia, unidade: d.unidade, projeto: d.projeto, placa: d.placa, placa_origem: d.placa_origem,
        viagens_prim: 0, viagens_rec: 0, viagens_not: 0, km_rem: 0, km_real: r2(+d.km || 0), semViagem: true }); });
    return out;
  }
  raiz.DispersaoKm = { merc, unidadeDe, projetoDe, projetoKml, lePlanilha, kmRodado, monta, vigCel, placasAbertura,
    leViagens, remPlacas, realPlacas, PROJ, AS_PELA_PLANILHA, AS_COMO_ROTA, INICIO };
})(typeof window !== 'undefined' ? window : globalThis);
