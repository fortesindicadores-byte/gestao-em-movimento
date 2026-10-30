// ============================================================
// Gestão à Vista — "Gerar apresentação" (Renan, 30/10/2026)
//
// PDF no layout clean do DriverPro (assets/apresentacao-base.js) com os
// números que a tela do Gestão à Vista JÁ carregou: unitStats() e as faixas
// do Ranking, as bases do farol-core (DATA), conformidade, FCA, blitz,
// documentos e a Carta de Custos do mês corrente. Nada é relido do banco
// além dos pneus, que a página só baixa sob demanda (garantePneus).
//
// Recorte = o da tela: no admin, as unidades do filtro (sem filtro, todas);
// dentro de uma unidade (?u=COD), a apresentação da unidade, com as placas.
// ============================================================
(function () {
  const ACC = '#F97316';
  // código do portal → nome na apresentação
  const NOME = { 'BLC': 'CDD Camboriú', 'CBA T1': 'Cuiabá Empurrada', 'CBA T1 WH': 'Cuiabá Armazém', 'CBA T2': 'CDD Cuiabá', 'CGR': 'CDD Rio de Janeiro', 'FLP': 'CDD Florianópolis', 'GRL': 'CDD Guarulhos', 'MCC T1': 'Macacu Empurrada', 'MCC T2': 'CDI Macacu', 'NFR': 'CDD Nova Friburgo', 'PIR': 'Piraí Empurrada', 'PLT': 'CDD Pelotas', 'RON': 'CDD Rondonópolis', 'GNA': 'Goiânia' };
  const nm = c => NOME[c] || c;
  // indicadores do Ranking, na ordem do painel, com a faixa de cada um
  const IND = [
    { k: 'sv', t: 'Stress Test Veículos', c: 'Stress V.', b: v => v >= 99.95 ? 'g' : v >= 95 ? 'y' : 'r' },
    { k: 'se', t: 'Stress Test Empilhadeiras', c: 'Stress E.', b: v => v >= 99.95 ? 'g' : v >= 95 ? 'y' : 'r' },
    { k: 'cf', t: 'CIVF', c: 'CIVF', b: v => v >= 99.95 ? 'g' : v >= 95 ? 'y' : 'r' },
    { k: 'pv', t: 'Preventivas', c: 'Prevent.', b: v => v >= 99.95 ? 'g' : v >= 95 ? 'y' : 'r' },
    { k: 'al', t: 'Alinhamento', c: 'Alinham.', b: v => v >= 80 ? 'g' : 'r' },
    { k: 'os', t: 'OS no prazo', c: 'OS prazo', b: v => v >= 90 ? 'g' : v >= 70 ? 'y' : 'r' },
    { k: 'dp', t: 'Disponibilidade', c: 'Disponib.', b: v => v >= 97 ? 'g' : v >= 93 ? 'y' : 'r' },
    { k: 'af', t: 'Pneus · Aferições', c: 'Aferições', b: v => v >= 95 ? 'g' : v >= 85 ? 'y' : 'r' },
    { k: 'mm', t: 'Pneus · Milimetragem', c: 'Milimetr.', b: v => v >= 90 ? 'g' : v >= 75 ? 'y' : 'r' },
    { k: 'ca', t: 'Pneus · Calibragem', c: 'Calibr.', b: v => v >= 90 ? 'g' : v >= 75 ? 'y' : 'r' },
  ];
  // informativos, fora da média (como no Ranking)
  const EXT = [
    { k: 'ck', t: 'Saída com OS crítica', c: 'Saída OS', b: v => v >= 100 ? 'g' : 'r' },
    { k: 'conf', t: 'Conformidade', c: 'Conform.', b: v => v >= 100 ? 'g' : v >= 90 ? 'y' : 'r' },
    { k: 'fca', t: 'FCA', c: 'FCA', b: v => v >= 85 ? 'g' : v >= 70 ? 'y' : 'r' },
    { k: 'blz', t: 'Blitz de Segurança', c: 'Blitz', b: v => v >= 100 ? 'g' : v >= 90 ? 'y' : 'r' },
  ];
  const bandMedia = v => v == null ? 'm' : v >= 90 ? 'g' : v >= 80 ? 'y' : 'r';
  const PLR = { prev: 'Preventiva', alinh: 'Alinhamento', conf: 'Conformidade', pneu: 'Aferição', mm: 'Milimetragem', ca: 'Calibragem', blitz: 'Blitz', docs: 'Documento', os: 'OS', disp: 'Parada', cifv: 'CIVF', st: 'Stress Test' };

  // tudo o que a página já tem em memória, por unidade
  function stats(cod) {
    const s = unitStats(cod);
    s.score = avgA([s.sv, s.se, s.cf, s.pv, s.al, s.os, s.dp, s.af, s.mm, s.ca]);
    s.conf = typeof confDoEscopo === 'function' ? confDoEscopo(cod) : null;
    s.fca = typeof fcaDoEscopo === 'function' ? fcaDoEscopo(cod) : null;
    const bz = (DATA.blitz || []).filter(r => r.cod === cod);
    s.blz = bz.length && typeof blzPct === 'function' ? blzPct(bz) : null;
    const prev = byCod(DATA.prev, cod), sv = byCod(DATA.stressV, cod), se = byCod(DATA.stressE, cod).filter(r => r.contratada), cf = byCod(DATA.cifv, cod);
    const al = byCod(DATA.alinh, cod), os = byCod(DATA.os, cod), dp = (DATA.disp || []).find(r => r.cod === cod);
    const par = (DATA.dispInd || []).filter(r => r.cod === cod).sort((a, b) => (b.dias || 0) - (a.dias || 0));
    const P = DATA.pneus, veic = P ? P.veic.filter(v => v.cod === cod) : [], tires = P ? P.tires.filter(t => t.cod === cod) : [];
    const docs = (DATA.docs || []).filter(r => r.cod === cod), pend = (DATA.docsPend || []).filter(r => r.cod === cod);
    const cfd = (typeof CONFD !== 'undefined' && CONFD) ? CONFD.filter(r => r.cod === cod) : [];
    s.n = {
      ativos: dp ? dp.ativos : 0, indisp: dp ? dp.indisp : 0, par,
      prevVenc: prev.filter(r => r.ad === 0), prevTot: prev.length,
      svDesc: sv.filter(r => r.desc > 0), svTot: sv.length, svR: sumA(sv.map(r => r.desc)),
      seDesc: se.filter(r => r.dt > 0), seTot: se.length, seR: sumA(se.map(r => r.dt)),
      cfDesc: cf.filter(r => (r.dt || 0) !== 0), cfTot: cf.length, cfR: sumA(cf.map(r => r.dt)),
      alVenc: al.filter(r => _n(r.st) === 'VENCIDO'), alTot: al.length,
      osAtr: os.filter(r => (r.dias || 0) > OS_META).sort((a, b) => (b.dias || 0) - (a.dias || 0)), osTot: os.length,
      afTot: veic.length, afOk: P ? veic.filter(v => (P.ult - v.dt.getTime()) <= 30 * 864e5).length : 0,
      pneus: tires.filter(t => t.st).length, crit: tires.filter(t => t.st === 'Bloquear' || t.st === 'Recapar').length,
      comP: tires.filter(t => t.pIdeal > 0 && t.desv != null).length, fora: tires.filter(t => t.pIdeal > 0 && t.desv != null && Math.abs(t.desv) > 10).length,
      docs, docVenc: docs.filter(r => r.dias != null && r.dias < 0), doc7: docs.filter(r => r.dias != null && r.dias >= 0 && r.dias <= 7), pend,
      confPend: cfd.filter(r => /NUNCA|NAO REALIZADO/.test(_n(r.status))), confTot: cfd.length,
      blzVenc: bz.filter(r => r.dias != null && r.dias < 0), blzTot: bz.length,
    };
    s.n.desc = s.n.svR + s.n.seR + s.n.cfR;
    return s;
  }

  async function montar(o) {
    o = o || {};
    const F = ApresBase.f;
    const aviso = o.aviso || (() => {});
    if (typeof garantePneus === 'function') { aviso('Lendo os pneus do Prolog…'); const p = garantePneus(); if (p) await p; }
    const H = new Date();
    const cods = (MODO === 'uni' && UNI) ? [UNI] : codsFiltrados().filter(c => c !== 'GNA' || byCod(DATA.prev, c).length);
    const uni = cods.length === 1 ? cods[0] : null;
    const MES = F.mesAno(H);
    const titulo = uni ? `Gestão à Vista · ${nm(uni)}` : 'Gestão à Vista';
    const B = ApresBase.deck({ acc: ACC, rodape: `${titulo} · ${MES} · foto de ${F.quando(H)}`, titulo: `${titulo} · ${MES}`, img: o.img });
    const S = cods.map(c => Object.assign({ cod: c }, stats(c)));
    const RK = S.slice().sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score));
    // a rede inteira, para a unidade se comparar (mesmas bases, sem o filtro)
    const REDE = uni ? Object.keys(UNIDADES).filter(c => c !== 'GNA').map(c => Object.assign({ cod: c }, stats(c))) : S;
    const ginfo = DATA.ginfoAtt ? F.quando(DATA.ginfoAtt) : null;
    const per = (DATA.stressV || []).map(r => r.per).filter(Boolean)[0];
    const perTxt = per ? F.MES3[per.getMonth()] + '/' + String(per.getFullYear()).slice(2) : '';
    const cel = (v, b) => v == null ? { v: '—', style: 'text-align:center;color:' + F.INK3 } : F.cel(F.pct0(v), b(v));
    const tot = (k) => F.sum(S.map(s => s.n[k]));
    const len = (k) => F.sum(S.map(s => s.n[k].length));

    // ═══ capa ═══
    B.capa({ kicker: 'Gestão à Vista', h1: `${uni ? F.esc(nm(uni)) : 'Rede'}<br>${MES}`,
      texto: `Foto do farol em ${F.quando(H)}${ginfo ? ` · última exportação do Ginfo em ${ginfo}` : ''}. ${uni ? 'As aderências da unidade contra a rede, as placas com pendência e onde agir.' : `Aderência das ${cods.length} unidades por indicador, frota parada, descontos, pneus, documentos, FCA e custos do mês.`}` });

    if (!uni) {
      // ═══ visão geral da rede ═══
      const med = F.avg(S.map(s => s.score)), ver = S.filter(s => s.score >= 90).length, ama = S.filter(s => s.score >= 80 && s.score < 90).length, vrm = S.filter(s => s.score != null && s.score < 80).length;
      const at = tot('ativos'), ind = tot('indisp');
      const desc = tot('desc');
      const verm = IND.map(i => ({ i, l: S.filter(s => s[i.k] != null && i.b(s[i.k]) === 'r') })).sort((a, b) => b.l.length - a.l.length);
      const pior = RK.filter(s => s.score != null).slice(-1)[0], melhor = RK[0];
      const piores = s => IND.filter(i => s[i.k] != null && i.b(s[i.k]) === 'r').sort((a, b) => s[a.k] - s[b.k]).slice(0, 3).map(i => `${i.t} ${F.pct0(s[i.k])}`);
      B.slide(`${B.head('Visão geral', `${MES}: média do farol em ${F.pct1(med)}`, `Média das aderências do Ranking (Stress Test, CIVF, Preventivas, Alinhamento, OS no prazo, Disponibilidade e Pneus) nas ${S.length} unidades.`)}
        ${B.cards([
          { k: 'Média do farol', n: F.pct1(med), acc: 1, p: `${ver} ${F.pl(ver, 'unidade')} com 90% ou mais · ${ama} entre 80% e 90% · ${vrm} abaixo de 80%.` },
          { k: 'Frota parada agora', n: `${F.f0(ind)} <small>de ${F.f0(at)}</small>`, p: at ? `${F.pct1((at - ind) / at * 100)} da frota disponível. Meta ${DISP_META}% · sonho ${DISP_SONHO}%.` : 'Sem a foto da frota ativa.' },
          { k: `Descontos ${perTxt ? '· ' + perTxt : 'do período'}`, n: F.brl(desc), p: `Stress Test Veículos ${F.brl(tot('svR'))} · Empilhadeiras ${F.brl(tot('seR'))} · CIVF ${F.brl(tot('cfR'))}.` },
          { k: 'Preventivas vencidas', n: F.f0(len('prevVenc')), p: `${F.f0(len('osAtr'))} OS abertas há mais de ${OS_META} dias · ${F.f0(len('alVenc'))} alinhamentos vencidos.` },
        ], 4)}
        ${B.concBlocos([
          { t: 'Melhor unidade', v: melhor ? `${nm(melhor.cod)} ${F.pct1(melhor.score)}` : '—', s: melhor ? (piores(melhor).length ? `Ainda fora: ${F.lista(piores(melhor))}.` : 'Nenhum indicador no vermelho.') : '' },
          { t: 'A recuperar', v: pior ? `${nm(pior.cod)} ${F.pct1(pior.score)}` : '—', s: pior ? (piores(pior).length ? `No vermelho: ${F.lista(piores(pior))}.` : 'Sem indicador no vermelho.') : '' },
          { t: 'Indicador mais crítico', v: verm[0] && verm[0].l.length ? verm[0].i.t : 'Nenhum', s: verm[0] && verm[0].l.length ? `${verm[0].l.length} de ${S.filter(s => s[verm[0].i.k] != null).length} unidades no vermelho: ${F.lista(verm[0].l.sort((a, b) => a[verm[0].i.k] - b[verm[0].i.k]).slice(0, 4).map(s => `${nm(s.cod)} ${F.pct0(s[verm[0].i.k])}`))}.` : 'Todos os indicadores fora do vermelho.' },
        ], 'Leitura', 3)}`);

      // ═══ ranking ═══
      const colsInd = IND.concat(EXT);
      B.slide(`${B.head('Ranking', 'Aderência por indicador, da melhor para a pior unidade', 'Mesmas faixas do Ranking do Gestão à Vista. A média não inclui Saída com OS crítica, Conformidade, FCA e Blitz (informativos).')}
        ${B.tabela({ classe: 'densa', style: 'margin-top:6px', cols: [{ t: '#' }, { t: 'Unidade' }, { t: 'Média', c: 1 }].concat(colsInd.map(i => ({ t: i.c, c: 1 }))),
          rows: RK.map((s, i) => [i + 1, `<b>${nm(s.cod)}</b>`, s.score == null ? '—' : F.cel(`<b>${F.pct1(s.score)}</b>`, bandMedia(s.score))].concat(colsInd.map(x => cel(s[x.k], x.b)))) })}
        <p class="note">Média: ≥ 90% verde · 80 a 89,9% amarelo · &lt; 80% vermelho. Stress Test, CIVF e Preventivas: 100% verde · 95 a 99,9% amarelo. Disponibilidade: ≥ ${DISP_SONHO}% verde · ${DISP_META} a ${DISP_SONHO}% amarelo. OS no prazo: ≥ 90% verde · 70 a 89,9% amarelo. Aferições: ≥ 95% verde · 85 a 94,9% amarelo. Milimetragem e Calibragem: ≥ 90% verde · 75 a 89,9% amarelo. Alinhamento: ≥ 80% verde. — = sem dado no período.</p>`, { top: true });

      // ═══ onde a rede está fora ═══
      const linhaInd = colsInd.map(i => { const c = S.filter(s => s[i.k] != null); const r = c.filter(s => i.b(s[i.k]) === 'r').sort((a, b) => a[i.k] - b[i.k]);
        return { i, med: F.avg(c.map(s => s[i.k])), g: c.filter(s => i.b(s[i.k]) === 'g').length, y: c.filter(s => i.b(s[i.k]) === 'y').length, r }; }).filter(x => x.g + x.y + x.r.length);
      linhaInd.sort((a, b) => b.r.length - a.r.length || (a.med || 0) - (b.med || 0));
      B.slide(`${B.head('Indicadores', 'Onde a rede está fora', 'Unidades por faixa em cada indicador e quem está no vermelho, do pior para o melhor.')}
        ${B.tabela({ cols: [{ t: 'Indicador' }, { t: 'Média', c: 1 }, { t: 'Verde', c: 1 }, { t: 'Amarelo', c: 1 }, { t: 'Vermelho', c: 1 }, { t: 'No vermelho', w: 1 }],
          rows: linhaInd.map(x => [`<b>${x.i.t}</b>`, F.cel(F.pct1(x.med), x.i.b(x.med)), x.g, x.y, x.r.length ? `<b style="color:${F.VERM}">${x.r.length}</b>` : 0, x.r.map(s => `<span style="white-space:nowrap">${nm(s.cod)} <b style="color:${F.VERM}">${F.pct0(s[x.i.k])}</b></span>`).join(' · ') || '—']) })}`, { top: true });

      // ═══ frota parada e manutenção ═══
      const parTop = S.flatMap(s => s.n.par.map(r => Object.assign({ cod: s.cod }, r))).sort((a, b) => (b.dias || 0) - (a.dias || 0)).slice(0, 3);
      const osTop = S.flatMap(s => s.n.osAtr.map(r => Object.assign({ cod: s.cod }, r))).sort((a, b) => (b.dias || 0) - (a.dias || 0)).slice(0, 3);
      const pvU = S.filter(s => s.n.prevVenc.length).sort((a, b) => b.n.prevVenc.length - a.n.prevVenc.length).slice(0, 3);
      const rowsM = S.slice().sort((a, b) => (b.n.indisp || 0) - (a.n.indisp || 0) || b.n.prevVenc.length - a.n.prevVenc.length);
      B.slide(`${B.head('Frota parada e manutenção', `${F.f0(ind)} ${F.pl(ind, 'veículo parado', 'veículos parados')} agora · ${F.f0(len('prevVenc'))} ${F.pl(len('prevVenc'), 'preventiva vencida', 'preventivas vencidas')}`, `Eventos abertos no app de Indisponibilidade, preventivas e alinhamentos do Ginfo e OS em aberto (prazo de ${OS_META} dias).`)}
        ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Ativos', n: 1 }, { t: 'Parados', n: 1 }, { t: 'Disponib.', c: 1 }, { t: 'Parado há mais tempo' }, { t: 'Prev. vencidas', n: 1 }, { t: 'OS abertas', n: 1 }, { t: `OS > ${OS_META} dias`, n: 1 }, { t: 'Alinh. vencidos', n: 1 }],
          rows: rowsM.map(s => [`<b>${nm(s.cod)}</b>`, F.f0(s.n.ativos), s.n.indisp ? `<b>${s.n.indisp}</b>` : 0, cel(s.dp, IND[6].b), s.n.par[0] ? `${F.esc(s.n.par[0].placa)} · ${s.n.par[0].dias} ${F.pl(s.n.par[0].dias, 'dia')}` : '—', s.n.prevVenc.length || 0, s.n.osTot, s.n.osAtr.length ? `<b style="color:${F.VERM}">${s.n.osAtr.length}</b>` : 0, s.n.alVenc.length || 0]) })}
        ${B.concBlocos([
          { t: 'Paradas há mais tempo', s: parTop.length ? parTop.map(r => `${F.esc(r.placa)} (${nm(r.cod)}) ${r.dias} ${F.pl(r.dias, 'dia')}${r.desc ? ' · ' + F.esc(r.desc.slice(0, 40)) : ''}`).join('<br>') : 'Nenhum veículo parado.' },
          { t: 'Preventivas vencidas', s: pvU.length ? `Mais em ${F.lista(pvU.map(s => `${nm(s.cod)} (${s.n.prevVenc.length})`))}.` : 'Nenhuma preventiva vencida.' },
          { t: `OS mais antigas`, s: osTop.length ? osTop.map(r => `OS ${F.esc(r.os)} · ${F.esc(r.placa)} (${nm(r.cod)}) ${r.dias} dias`).join('<br>') : `Nenhuma OS acima de ${OS_META} dias.` },
        ], 'Onde agir', 3)}`, { top: true });

      // ═══ descontos ═══
      const rowsD = S.filter(s => s.n.svTot || s.n.seTot || s.n.cfTot).sort((a, b) => b.n.desc - a.n.desc);
      const descTop = S.flatMap(s => s.n.svDesc.map(r => ({ cod: s.cod, placa: r.placa, v: r.desc, o: 'Stress Test Veículos' })).concat(s.n.seDesc.map(r => ({ cod: s.cod, placa: r.placa, v: r.dt, o: 'Stress Test Empilhadeiras' })), s.n.cfDesc.map(r => ({ cod: s.cod, placa: r.placa, v: r.dt, o: 'CIVF' })))).sort((a, b) => b.v - a.v);
      B.slide(`${B.head('Descontos', `${F.brl(desc)} de desconto${perTxt ? ` em ${perTxt}` : ''}`, `Stress Test (placa ou equipamento sem a rodagem exigida) e CIVF (fotos fora do padrão). Placas com desconto sobre as avaliadas.`)}
        ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Stress Veíc.', c: 1 }, { t: 'R$', n: 1 }, { t: 'Stress Emp.', c: 1 }, { t: 'R$', n: 1 }, { t: 'CIVF', c: 1 }, { t: 'R$', n: 1 }, { t: 'Total', n: 1 }],
          rows: rowsD.map(s => [`<b>${nm(s.cod)}</b>`, s.n.svTot ? `${s.n.svDesc.length} de ${s.n.svTot}` : '—', s.n.svR ? F.brlInt(s.n.svR) : '—', s.n.seTot ? `${s.n.seDesc.length} de ${s.n.seTot}` : '—', s.n.seR ? F.brlInt(s.n.seR) : '—', s.n.cfTot ? `${s.n.cfDesc.length} de ${s.n.cfTot}` : '—', s.n.cfR ? F.brlInt(s.n.cfR) : '—', s.n.desc ? `<b style="color:${F.VERM}">${F.brlInt(s.n.desc)}</b>` : '<b>R$ 0</b>'])
            .concat([{ cls: 'sep', c: ['Total', `${len('svDesc')}`, F.brlInt(tot('svR')), `${len('seDesc')}`, F.brlInt(tot('seR')), `${len('cfDesc')}`, F.brlInt(tot('cfR')), `<b>${F.brlInt(desc)}</b>`] }]) })}
        ${descTop.length ? B.conc(`Maiores descontos: ${descTop.slice(0, 5).map(r => `${F.esc(r.placa)} (${nm(r.cod)}, ${r.o}) ${F.brlInt(r.v)}`).join(' · ')}.`, 'Onde agir') : B.conc('Nenhum desconto no período.', 'Leitura')}`, { top: true });

      // ═══ pneus ═══
      if (DATA.pneus) {
        const rowsP = S.filter(s => s.n.afTot || s.n.pneus).sort((a, b) => (a.af == null ? 999 : a.af) - (b.af == null ? 999 : b.af));
        const semAf = F.sum(S.map(s => s.n.afTot - s.n.afOk));
        B.slide(`${B.head('Pneus', `${F.f0(semAf)} ${F.pl(semAf, 'placa', 'placas')} sem aferição nos últimos 30 dias`, `Foto do Prolog: aferição nos últimos 30 dias, sulco (Bloquear/Recapar = fora) e pressão dentro de ±10% da ideal.`)}
          ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Placas', n: 1 }, { t: 'Sem aferição', n: 1 }, { t: 'Aferições', c: 1 }, { t: 'Pneus', n: 1 }, { t: 'Bloquear/Recapar', n: 1 }, { t: 'Milimetr.', c: 1 }, { t: 'Fora de pressão', n: 1 }, { t: 'Calibr.', c: 1 }],
            rows: rowsP.map(s => [`<b>${nm(s.cod)}</b>`, s.n.afTot, s.n.afTot - s.n.afOk ? `<b>${s.n.afTot - s.n.afOk}</b>` : 0, cel(s.af, IND[7].b), s.n.pneus, s.n.crit, cel(s.mm, IND[8].b), s.n.fora, cel(s.ca, IND[9].b)]) })}
          <p class="note">A aferição vale por placa (a última leitura de qualquer pneu dela); milimetragem e calibragem valem por pneu.</p>`, { top: true });
      }

      // ═══ conformidade, blitz e documentos ═══
      const temDocs = DATA.docs || DATA.docsPend;
      const rowsC = S.slice().sort((a, b) => (a.conf == null ? 999 : a.conf) - (b.conf == null ? 999 : b.conf));
      const dv = len('docVenc'), d7 = len('doc7'), dp_ = len('pend');
      B.slide(`${B.head('Conformidade, Blitz e Documentos', `Conformidade média de ${F.pct1(F.avg(S.map(s => s.conf)))}${temDocs ? ` · ${F.f0(len('docs'))} documentos vencendo em até 30 dias` : ''}`, `Conformidade do mês (régua de prazo por equipamento), Blitz de Segurança do mês e documentos do Ginfo.`)}
        ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Conform.', c: 1 }, { t: 'Placas pendentes', n: 1 }, { t: 'Blitz', c: 1 }, { t: 'Blitz vencidas', n: 1 }].concat(temDocs ? [{ t: 'Docs até 30 dias', n: 1 }, { t: 'Até 7 dias', n: 1 }, { t: 'Vencidos', n: 1 }, { t: 'Sem vínculo', n: 1 }] : []),
          rows: rowsC.map(s => [`<b>${nm(s.cod)}</b>`, cel(s.conf, EXT[1].b), s.n.confPend.length || 0, cel(s.blz, EXT[3].b), s.n.blzVenc.length || 0].concat(temDocs ? [s.n.docs.length, s.n.doc7.length ? `<b style="color:#A87D00">${s.n.doc7.length}</b>` : 0, s.n.docVenc.length ? `<b style="color:${F.VERM}">${s.n.docVenc.length}</b>` : 0, s.n.pend.length ? `<b style="color:${F.VERM}">${s.n.pend.length}</b>` : 0] : [])) })}
        ${temDocs ? B.conc(`${dv ? `${dv} ${F.pl(dv, 'documento vencido', 'documentos vencidos')} desde a coleta. ` : ''}${d7} ${F.pl(d7, 'vence', 'vencem')} em até 7 dias e ${dp_} ${F.pl(dp_, 'documento está', 'documentos estão')} sem vínculo à placa. O Ginfo só lista o que vence em até 30 dias: o já vencido sai da lista.`, 'Leitura') : ''}`, { top: true });

      // ═══ FCA ═══
      if (typeof FCAR !== 'undefined' && FCAR && typeof fcaMetrics === 'function') {
        const lf = S.map(s => ({ s, m: fcaMetrics(FCAR.filter(r => r.cod === s.cod)) })).filter(x => x.m.tt).sort((a, b) => (a.m.total == null ? 999 : a.m.total) - (b.m.total == null ? 999 : b.m.total));
        if (lf.length) {
          const g = fcaMetrics(FCAR.filter(r => cods.includes(r.cod)));
          B.slide(`${B.head('FCA', `Aderência total de ${F.pct0(g.total)} · ${F.f0(g.venc)} ${F.pl(g.venc, 'ação vencida', 'ações vencidas')}`, 'Mesma conta do painel Aderência ao FCA: concluída vale 100%, em andamento 50%.')}
            ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Ações', n: 1 }, { t: 'Concluídas', n: 1 }, { t: 'Em andamento', n: 1 }, { t: 'Não iniciadas', n: 1 }, { t: 'Vencidas', n: 1 }, { t: 'Ader. prazo', c: 1 }, { t: 'Conclusão', c: 1 }, { t: 'Total', c: 1 }],
              rows: lf.map(x => [`<b>${nm(x.s.cod)}</b>`, x.m.tt, x.m.concl, x.m.andam, x.m.nini, x.m.venc ? `<b style="color:${F.VERM}">${x.m.venc}</b>` : 0, cel(x.m.pPrazo, EXT[2].b), cel(x.m.pConcl, EXT[2].b), cel(x.m.total, EXT[2].b)])
                .concat([{ cls: 'sep', c: ['Total', g.tt, g.concl, g.andam, g.nini, g.venc, cel(g.pPrazo, EXT[2].b), cel(g.pConcl, EXT[2].b), cel(g.total, EXT[2].b)] }]) })}`, { top: true });
        }
      }

      // ═══ custos do mês (Carta de Custos) ═══
      if (DATA.custos && DATA.custos.length) {
        const vigTx = DATA.custosVigTxt || '';
        const lc = S.map(s => { const a = DATA.custos.filter(r => r.cod === s.cod); return { s, orc: F.sum(a.map(r => r.orc)), rem: F.sum(a.map(r => r.rem)), rea: F.sum(a.map(r => r.rea)) }; }).filter(x => x.rea || x.rem || x.orc);
        const dR = x => Math.abs(x.rea) - Math.abs(x.rem), pR = x => Math.abs(x.rem) > 0 ? dR(x) / Math.abs(x.rem) * 100 : null, pO = x => Math.abs(x.orc) > 0 ? (Math.abs(x.rea) - Math.abs(x.orc)) / Math.abs(x.orc) * 100 : null;
        lc.sort((a, b) => (pR(b) == null ? -999 : pR(b)) - (pR(a) == null ? -999 : pR(a)));
        const T = { orc: F.sum(lc.map(x => x.orc)), rem: F.sum(lc.map(x => x.rem)), rea: F.sum(lc.map(x => x.rea)) };
        const cd = v => v == null ? '' : `color:${v > 0 ? F.VERM : F.VERDE};font-weight:700`;
        const pacs = [...new Set(DATA.custos.map(r => r.pac).filter(Boolean))];
        const pacB = pacs.map(p => { const a = DATA.custos.filter(r => r.pac === p && cods.includes(r.cod)); const x = { rem: F.sum(a.map(r => r.rem)), rea: F.sum(a.map(r => r.rea)) }; return { t: p, v: F.brl(Math.abs(x.rea)), s: `Remunerado ${F.brl(Math.abs(x.rem))} · ${Math.abs(x.rem) > 0 ? F.sgnPct((Math.abs(x.rea) - Math.abs(x.rem)) / Math.abs(x.rem) * 100) + ' contra o remunerado' : 'sem remunerado'}.` }; });
        B.slide(`${B.head('Custos do mês', `Realizado de ${F.brl(Math.abs(T.rea))} em ${vigTx || 'o mês corrente'} · ${F.sgnPct(pR(T))} contra o remunerado`, 'Carta de Custos do mês corrente (Combustíveis, Manutenção e Pneus): lançamentos com NF, prévia do contrato e combustível do ERP. O remunerado é a tendência do mês.')}
          ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Orçado', n: 1 }, { t: 'Remunerado', n: 1 }, { t: 'Realizado', n: 1 }, { t: 'Δ vs Rem.', n: 1 }, { t: 'Δ Rem. %', n: 1 }, { t: 'Δ Orç. %', n: 1 }],
            rows: lc.map(x => [`<b>${nm(x.s.cod)}</b>`, F.brlInt(Math.abs(x.orc)), F.brlInt(Math.abs(x.rem)), F.brlInt(Math.abs(x.rea)), { v: F.brlInt(dR(x)), style: cd(dR(x)) }, { v: F.sgnPct(pR(x)), style: cd(pR(x)) }, { v: F.sgnPct(pO(x)), style: cd(pO(x)) }])
              .concat([{ cls: 'sep', c: ['Total', F.brlInt(Math.abs(T.orc)), F.brlInt(Math.abs(T.rem)), F.brlInt(Math.abs(T.rea)), { v: F.brlInt(dR(T)), style: cd(dR(T)) }, { v: F.sgnPct(pR(T)), style: cd(pR(T)) }, { v: F.sgnPct(pO(T)), style: cd(pO(T)) }] }]) })}
          ${pacB.length ? B.concBlocos(pacB, 'Por pacote', pacB.length) : ''}`, { top: true });
      }

      // ═══ prioridades ═══
      const P = [];
      const vm = RK.filter(s => s.score != null && s.score < 80);
      if (vm.length) P.push({ t: 'Unidades abaixo de 80%', v: F.lista(vm.map(s => nm(s.cod))), s: vm.map(s => `${nm(s.cod)}: ${piores(s).join(', ') || 'sem indicador no vermelho'}`).join('<br>') });
      if (ind) P.push({ t: 'Frota parada', v: `${ind} ${F.pl(ind, 'veículo')}`, s: `Destravar as paradas mais longas: ${parTop.map(r => `${F.esc(r.placa)} (${r.dias} d)`).join(', ')}.` });
      if (len('prevVenc')) P.push({ t: 'Preventivas', v: `${len('prevVenc')} vencidas`, s: `Programar primeiro em ${F.lista(pvU.map(s => nm(s.cod)))}.` });
      if (len('osAtr')) P.push({ t: 'OS em aberto', v: `${len('osAtr')} acima de ${OS_META} dias`, s: 'Cobrar fornecedor e oficina pelas mais antigas.' });
      if (desc) P.push({ t: 'Descontos', v: F.brl(desc), s: `Tratar as placas sem rodagem e as fotos de CIVF antes da próxima janela.` });
      if (DATA.pneus) { const sa = F.sum(S.map(s => s.n.afTot - s.n.afOk)); if (sa) P.push({ t: 'Pneus', v: `${sa} sem aferição`, s: `Aferir as placas que passaram de 30 dias; ${F.f0(F.sum(S.map(s => s.n.crit)))} pneus em Bloquear/Recapar.` }); }
      if (temDocs && (dv || d7 || dp_)) P.push({ t: 'Documentos', v: `${d7} vencem em 7 dias`, s: `${dv} vencidos e ${dp_} sem vínculo à placa.` });
      if (P.length) B.slide(`${B.head('Prioridades', 'O que atacar até o próximo farol')}
        ${B.concBlocos(P.slice(0, 6), 'Próximos passos', P.length > 4 ? 3 : 2)}`);
    } else {
      // ═══════════ apresentação da UNIDADE ═══════════
      const s = S[0], cod = uni;
      const posR = (k, bom) => { const a = REDE.filter(x => x[k] != null).sort((x, y) => bom === false ? x[k] - y[k] : y[k] - x[k]); const i = a.findIndex(x => x.cod === cod); return i < 0 ? null : { p: i + 1, n: a.length }; };
      const rede = k => F.avg(REDE.map(x => x[k]));
      const pS = posR('score');
      const linhas = IND.concat(EXT).filter(i => s[i.k] != null || rede(i.k) != null);
      B.slide(`${B.head('Visão geral', `${nm(cod)}: média do farol em ${F.pct1(s.score)}${pS ? ` · ${pS.p}º de ${pS.n} na rede` : ''}`, 'Aderência da unidade em cada indicador contra a média das unidades da rede, com as mesmas faixas do Ranking.')}
        <div class="duas" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)"><div>
        ${B.tabela({ cols: [{ t: 'Indicador' }, { t: 'Unidade', c: 1 }, { t: 'Rede', c: 1 }, { t: 'Posição', c: 1 }],
          rows: linhas.map(i => { const p = posR(i.k); return [`<b>${i.t}</b>`, cel(s[i.k], i.b), { v: F.pct0(rede(i.k)), style: 'text-align:center;color:' + F.INK2 }, p ? `${p.p}º de ${p.n}` : '—']; }) })}</div>
        <div>${B.cards([
          { k: 'Frota parada agora', n: `${s.n.indisp} <small>de ${s.n.ativos}</small>`, p: s.n.ativos ? `${F.pct1(s.dp)} disponível.` : '' },
          { k: 'Descontos' + (perTxt ? ' · ' + perTxt : ''), n: F.brl(s.n.desc), p: `Stress Test ${F.brl(s.n.svR + s.n.seR)} · CIVF ${F.brl(s.n.cfR)}.` },
          { k: 'Preventivas vencidas', n: F.f0(s.n.prevVenc.length), p: `${s.n.osAtr.length} OS acima de ${OS_META} dias · ${s.n.alVenc.length} alinhamentos vencidos.` },
          { k: 'Documentos', n: F.f0(s.n.docs.length), p: `vencendo em até 30 dias · ${s.n.doc7.length} em até 7 · ${s.n.pend.length} sem vínculo.` },
        ], 2)}</div></div>`, { top: true });

      // placas com pendência (Placas do Gestão à Vista)
      const PL = (typeof placasLinhas === 'function' ? placasLinhas(cod) : []).filter(a => a.nok > 0)
        .sort((a, b) => (a.pior == null ? 9999 : a.pior) - (b.pior == null ? 9999 : b.pior) || b.nok - a.nok);
      if (PL.length) {
        const pend = a => PL_COLS.filter(c => a.cel[c.k] && a.cel[c.k].ok === false).map(c => { const x = a.cel[c.k]; const d = c.k === 'disp' ? (x.dias != null ? ` ${x.dias} d` : '') : (c.prazo && x.dias != null && x.dias < 0 ? ` ${-x.dias} d` : ''); return `${PLR[c.k] || c.t}${d}`; });
        const pgs = B.paginas(PL, 15).slice(0, 3);
        pgs.forEach((pg, ix) => B.slide(`${B.head('Placas', ix ? `Placas com pendência (${ix + 1}/${pgs.length})` : `${PL.length} ${F.pl(PL.length, 'placa', 'placas')} com pendência`, ix ? '' : 'Da mais vencida para a menos. Entre parênteses, os dias de atraso (ou parada).')}
          ${B.tabela({ cols: [{ t: 'Placa' }, { t: 'Projeto' }, { t: 'Pendências', n: 1 }, { t: 'O que está fora', w: 1 }],
            rows: pg.map(a => [`<b>${F.esc(a.placa)}</b>`, F.esc(a.proj || '—'), a.nok, pend(a).join(' · ')]) })}
          ${ix === pgs.length - 1 && PL.length > pgs.length * 15 ? `<p class="note">+ ${PL.length - pgs.length * 15} placas na visão Placas do Gestão à Vista.</p>` : ''}`, { top: true }));
      }

      // frota parada e manutenção
      if (s.n.par.length || s.n.prevVenc.length || s.n.osAtr.length) {
        const pv = s.n.prevVenc.slice().sort((a, b) => (a.dias == null ? 0 : a.dias) - (b.dias == null ? 0 : b.dias)).slice(0, 10);
        B.slide(`${B.head('Frota parada e manutenção', `${s.n.indisp} ${F.pl(s.n.indisp, 'veículo parado', 'veículos parados')} · ${s.n.prevVenc.length} ${F.pl(s.n.prevVenc.length, 'preventiva vencida', 'preventivas vencidas')} · ${s.n.osAtr.length} OS acima de ${OS_META} dias`)}
          <div class="duas" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><div>
            <div class="kicker" style="color:${F.INK2}">Paradas agora</div>
            ${s.n.par.length ? B.tabela({ cols: [{ t: 'Placa' }, { t: 'Desde' }, { t: 'Dias', n: 1 }, { t: 'Motivo', w: 1 }], rows: s.n.par.slice(0, 10).map(r => [`<b>${F.esc(r.placa)}</b>`, r.dPar, r.dias, F.esc((r.desc || r.grupo || '').slice(0, 60))]) }) : '<p>Nenhum veículo parado.</p>'}
          </div><div>
            <div class="kicker" style="color:${F.INK2}">Preventivas vencidas</div>
            ${pv.length ? B.tabela({ cols: [{ t: 'Placa' }, { t: 'Modelo' }, { t: 'Dias', n: 1 }, { t: 'Km', n: 1 }], rows: pv.map(r => [`<b>${F.esc(r.placa)}</b>`, F.esc((r.modelo || '').slice(0, 22)), r.dias == null ? '—' : F.f0(r.dias), r.km == null ? '—' : F.f0(r.km)]) }) : '<p>Nenhuma.</p>'}
            ${s.n.osAtr.length ? `<div class="kicker" style="color:${F.INK2};margin-top:12px">OS acima de ${OS_META} dias</div>${B.tabela({ cols: [{ t: 'OS' }, { t: 'Placa' }, { t: 'Dias', n: 1 }, { t: 'Fornecedor', w: 1 }], rows: s.n.osAtr.slice(0, 6).map(r => [F.esc(r.os), `<b>${F.esc(r.placa)}</b>`, r.dias, F.esc((r.forn || '').slice(0, 30))]) })}` : ''}
          </div></div>`, { top: true });
      }

      // descontos
      const dl = s.n.svDesc.map(r => ({ placa: r.placa, o: 'Stress Test Veículos', v: r.desc, x: r.jus || r.saida })).concat(s.n.seDesc.map(r => ({ placa: r.placa, o: 'Stress Test Empilhadeiras', v: r.dt, x: '' })), s.n.cfDesc.map(r => ({ placa: r.placa, o: 'CIVF', v: r.dt, x: r.st }))).sort((a, b) => b.v - a.v);
      if (dl.length) B.slide(`${B.head('Descontos', `${F.brl(s.n.desc)} de desconto${perTxt ? ` em ${perTxt}` : ''} em ${dl.length} ${F.pl(dl.length, 'placa')}`)}
        ${B.tabela({ cols: [{ t: 'Placa' }, { t: 'Origem' }, { t: 'Desconto', n: 1 }, { t: 'Observação', w: 1 }], rows: dl.slice(0, 15).map(r => [`<b>${F.esc(r.placa)}</b>`, r.o, F.brlInt(r.v), F.esc(String(r.x || '').slice(0, 70))]) })}
        ${dl.length > 15 ? `<p class="note">+ ${dl.length - 15} placas nas visões de Stress Test e CIVF.</p>` : ''}`, { top: true });

      // documentos
      if (s.n.docs.length || s.n.pend.length) {
        const dd = s.n.docs.slice().sort((a, b) => (a.dias == null ? 999 : a.dias) - (b.dias == null ? 999 : b.dias)).slice(0, 14);
        B.slide(`${B.head('Documentos', `${s.n.docs.length} ${F.pl(s.n.docs.length, 'documento vence', 'documentos vencem')} em até 30 dias · ${s.n.pend.length} sem vínculo`)}
          <div class="duas"><div>${dd.length ? B.tabela({ cols: [{ t: 'Placa' }, { t: 'Documento' }, { t: 'Vence em' }, { t: 'Dias', n: 1 }], rows: dd.map(r => [`<b>${F.esc(r.placa)}</b>`, F.esc(r.doc), r.prox ? r.prox.toLocaleDateString('pt-BR') : '—', { v: r.dias == null ? '—' : r.dias, style: r.dias != null && r.dias <= 7 ? `color:${r.dias < 0 ? F.VERM : '#A87D00'};font-weight:800` : '' }]) }) : '<p>Nenhum documento vencendo.</p>'}</div>
          <div>${s.n.pend.length ? `<div class="kicker" style="color:${F.INK2}">Sem vínculo à placa</div>${B.tabela({ cols: [{ t: 'Placa' }, { t: 'Documento', w: 1 }], rows: s.n.pend.slice(0, 12).map(r => [`<b>${F.esc(r.placa)}</b>`, F.esc(r.doc)]) })}` : ''}</div></div>`, { top: true });
      }

      // custos por projeto
      const cp = (DATA.custosProj || []).filter(r => r.cod === cod);
      if (cp.length) {
        const g = {}; cp.forEach(r => { const a = g[r.n3] = g[r.n3] || { orc: 0, rem: 0, rea: 0 }; a.orc += r.orc; a.rem += r.rem; a.rea += r.rea; });
        const cu = (DATA.custos || []).filter(r => r.cod === cod), T = { orc: F.sum(cu.map(r => r.orc)), rem: F.sum(cu.map(r => r.rem)), rea: F.sum(cu.map(r => r.rea)) };
        const pR = x => Math.abs(x.rem) > 0 ? (Math.abs(x.rea) - Math.abs(x.rem)) / Math.abs(x.rem) * 100 : null;
        const cd = v => v == null ? '' : `color:${v > 0 ? F.VERM : F.VERDE};font-weight:700`;
        B.slide(`${B.head('Custos do mês', `Realizado de ${F.brl(Math.abs(T.rea))} · ${F.sgnPct(pR(T))} contra o remunerado`, `Carta de Custos do mês corrente${DATA.custosVigTxt ? ` (${DATA.custosVigTxt})` : ''}, por projeto. A soma dos projetos pode não bater com a unidade: o remunerado usa a proporção de cada recorte.`)}
          ${B.tabela({ cols: [{ t: 'Projeto' }, { t: 'Orçado', n: 1 }, { t: 'Remunerado', n: 1 }, { t: 'Realizado', n: 1 }, { t: 'Δ vs Rem.', n: 1 }, { t: 'Δ Rem. %', n: 1 }],
            rows: Object.entries(g).sort().map(([p, x]) => [`<b>${F.esc(p)}</b>`, F.brlInt(Math.abs(x.orc)), F.brlInt(Math.abs(x.rem)), F.brlInt(Math.abs(x.rea)), { v: F.brlInt(Math.abs(x.rea) - Math.abs(x.rem)), style: cd(pR(x)) }, { v: F.sgnPct(pR(x)), style: cd(pR(x)) }])
              .concat([{ cls: 'sep', c: ['Unidade', F.brlInt(Math.abs(T.orc)), F.brlInt(Math.abs(T.rem)), F.brlInt(Math.abs(T.rea)), { v: F.brlInt(Math.abs(T.rea) - Math.abs(T.rem)), style: cd(pR(T)) }, { v: F.sgnPct(pR(T)), style: cd(pR(T)) }] }]) })}`, { top: true });
      }

      // prioridades da unidade
      const P = [];
      const verm = IND.filter(i => s[i.k] != null && i.b(s[i.k]) === 'r').sort((a, b) => s[a.k] - s[b.k]);
      if (verm.length) P.push({ t: 'Indicadores no vermelho', v: F.lista(verm.slice(0, 3).map(i => i.t)), s: verm.map(i => `${i.t} ${F.pct0(s[i.k])} (rede ${F.pct0(rede(i.k))})`).join(' · ') + '.' });
      if (s.n.indisp) P.push({ t: 'Frota parada', v: `${s.n.indisp} ${F.pl(s.n.indisp, 'veículo')}`, s: `Destravar primeiro ${F.lista(s.n.par.slice(0, 3).map(r => `${F.esc(r.placa)} (${r.dias} d)`))}.` });
      if (s.n.prevVenc.length) P.push({ t: 'Preventivas', v: `${s.n.prevVenc.length} vencidas`, s: `Programar ${F.lista(s.n.prevVenc.slice(0, 4).map(r => F.esc(r.placa)))}.` });
      if (s.n.osAtr.length) P.push({ t: 'OS em aberto', v: `${s.n.osAtr.length} acima de ${OS_META} dias`, s: `Cobrar a OS ${F.esc(s.n.osAtr[0].os)} (${F.esc(s.n.osAtr[0].placa)}, ${s.n.osAtr[0].dias} dias).` });
      if (s.n.desc) P.push({ t: 'Descontos', v: F.brl(s.n.desc), s: `Maior: ${dl[0] ? `${F.esc(dl[0].placa)} ${F.brlInt(dl[0].v)} (${dl[0].o})` : '—'}.` });
      if (s.n.afTot - s.n.afOk) P.push({ t: 'Pneus', v: `${s.n.afTot - s.n.afOk} sem aferição`, s: `${s.n.crit} pneus em Bloquear/Recapar e ${s.n.fora} fora de pressão.` });
      if (s.n.doc7.length || s.n.pend.length) P.push({ t: 'Documentos', v: `${s.n.doc7.length} vencem em 7 dias`, s: `${s.n.pend.length} sem vínculo à placa.` });
      if (P.length) B.slide(`${B.head('Prioridades', `O que ${nm(cod)} ataca até o próximo farol`)}
        ${B.concBlocos(P.slice(0, 6), 'Próximos passos', P.length > 4 ? 3 : 2)}`);
    }
    return { doc: B.doc(), slides: B.n(), nome: `Gestao_a_Vista_${uni ? uni.replace(/\s+/g, '_') + '_' : ''}${MES.replace('/', '')}.pdf` };
  }

  async function gerar(o) {
    o = o || {};
    const aviso = o.aviso || (() => {});
    aviso('Montando os slides…');
    const r = await montar(o);
    const n = await ApresBase.pdf(r.doc, r.nome, aviso);
    return { slides: n, nome: r.nome };
  }

  window.GavApresentacao = { montar, gerar, stats };
})();
