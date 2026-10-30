// ============================================================
// Visão Financeira — "Gerar apresentação" (Renan, 30/10/2026)
//
// O fechamento do DRE em PDF, no layout clean do DriverPro
// (assets/apresentacao-base.js), com as linhas que a Visão Financeira JÁ leu
// (allRows: Frota + Receita Líquida; ebitdaRows) e as mesmas funções dela
// (getPac, getUniLabel, getNv3Prefix, aggEbitda). Mês de referência = o último
// com realizado (ou a última vigência marcada no filtro); o acumulado vai de
// janeiro até ele. Unidade, projeto, pacote e conta seguem o filtro da tela.
// Custo: a aba Frota guarda a despesa negativa; aqui custo = −valor, então
// desvio positivo (real acima da referência) é ruim.
// ============================================================
(function () {
  const ACC = '#F97316';

  async function montar(o) {
    o = o || {};
    const F = ApresBase.f;
    const f0 = getF();
    // mês de referência: a última vigência marcada ou a última com realizado
    let VU = (f0.vig && f0.vig.length) ? f0.vig.slice().sort().pop() : lastRealVigKey();
    if (!VU) throw new Error('nenhum mês com realizado');
    const ANO = +VU.slice(0, 4), MI = +VU.slice(5) - 1;
    const VA = MI ? `${ANO}-${String(MI).padStart(2, '0')}` : `${ANO - 1}-12`;
    const VY = `${ANO - 1}-${VU.slice(5)}`;
    const ytd = Array.from({ length: MI + 1 }, (_, i) => `${ANO}-${String(i + 1).padStart(2, '0')}`);
    const ytdAA = ytd.map(v => `${ANO - 1}-${v.slice(5)}`);
    const Mes = F.MESN[MI][0].toUpperCase() + F.MESN[MI].slice(1);
    const m3 = v => F.MES3[+v.slice(5) - 1] + '/' + v.slice(2, 4);
    const base = { ano: [], vig: [], uni: f0.uni, nv3: f0.nv3, pac: f0.pac, cta: f0.cta };
    const recorte = [f0.uni.length ? f0.uni.join(', ') : '', f0.nv3.length ? f0.nv3.join(', ') : '', f0.pac.length ? f0.pac.join(', ') : ''].filter(Boolean).join(' · ');
    const B = ApresBase.deck({ acc: ACC, rodape: `Visão Financeira · Fechamento ${Mes}/${ANO}${recorte ? ' · ' + recorte : ''}`, titulo: `Visão Financeira · ${Mes}/${ANO}`, img: o.img });

    const isRec = r => (r[C.cta] || '') === 'Receita Líquida';
    const linhas = vs => allRows.filter(r => { const d = parseVig(r[C.vig]); return d && vs.includes(vigKey(d)) && applyFilters(r, base); });
    // soma: receita como vem; custo = −valor (a aba guarda a despesa negativa)
    const soma = (rs, filtro) => { const a = { orc: 0, rem: 0, real: 0 }; rs.forEach(r => { if (filtro && !filtro(r)) return; const s = isRec(r) ? 1 : -1; a.orc += s * (+r[C.orc] || 0); a.rem += s * (+r[C.rem] || 0); a.real += s * (+r[C.real] || 0); }); return a; };
    const rec = vs => soma(linhas(vs), isRec), cus = vs => soma(linhas(vs), r => !isRec(r));
    const ebi = vs => typeof aggEbitda === 'function' ? aggEbitda({ ano: [], vig: vs, uni: f0.uni, nv3: f0.nv3 }) : null;
    const pct = (a, b) => b ? (a - b) / Math.abs(b) * 100 : null;
    const cd = (bom, v) => v == null || Math.abs(v) < 0.05 ? '' : `color:${(bom ? v > 0 : v < 0) ? F.VERDE : F.VERM};font-weight:700`;
    const dC = v => ({ v: F.brlInt(v), style: cd(false, v) }), dCp = v => ({ v: F.sgnPct(v), style: cd(false, v) });
    const dR = v => ({ v: F.brlInt(v), style: cd(true, v) }), dRp = v => ({ v: F.sgnPct(v), style: cd(true, v) });

    const RM = rec([VU]), CM = cus([VU]), RY = rec(ytd), CY = cus(ytd), RAA = rec([VY]), CAA = cus([VY]), RYA = rec(ytdAA), CYA = cus(ytdAA);
    const EM = ebi([VU]), EY = ebi(ytd);
    const av = (c, r) => r ? c / r * 100 : null;

    // ═══ capa ═══
    B.capa({ kicker: 'Visão Financeira', h1: `Fechamento<br>${Mes}/${ANO}`, texto: `DRE de frota de ${F.MESN[MI]} e o acumulado de janeiro a ${F.MESN[MI]}: receita, custos por pacote, unidade e conta, contra o remunerado e o orçado${recorte ? `. Recorte: ${F.esc(recorte)}` : ''}.` });

    // ═══ resumo do mês e do ano ═══
    const dCRm = CM.real - CM.rem, dCRy = CY.real - CY.rem;
    B.slide(`${B.head('Resumo', `${Mes}: custos ${dCRm > 0 ? 'acima' : 'abaixo'} do remunerado em ${F.brl(Math.abs(dCRm))} (${F.sgnPct(pct(CM.real, CM.rem))})`, `Receita Líquida e custos de frota no mês e no acumulado de ${F.MES3[0]} a ${F.MES3[MI]}/${String(ANO).slice(2)}.`)}
      ${B.cards([
        { k: `Receita Líquida · ${m3(VU)}`, n: F.brl(RM.real), acc: 1, p: `${F.seta(pct(RM.real, RM.orc), F.sgnPct(pct(RM.real, RM.orc)).replace(/^[+−]/, ''))} contra o orçado · ${F.seta(pct(RM.real, RAA.real), F.sgnPct(pct(RM.real, RAA.real)).replace(/^[+−]/, ''))} contra ${m3(VY)}.` },
        { k: `Custos de frota · ${m3(VU)}`, n: F.brl(CM.real), p: `Remunerado ${F.brl(CM.rem)} · orçado ${F.brl(CM.orc)}. ${F.seta(pct(CM.real, CM.rem), F.sgnPct(pct(CM.real, CM.rem)).replace(/^[+−]/, ''), false)} contra o remunerado.` },
        { k: `Custo sobre a receita · ${m3(VU)}`, n: F.pct1(av(CM.real, RM.real)), p: `Remunerado ${F.pct1(av(CM.rem, RM.rem))} · orçado ${F.pct1(av(CM.orc, RM.orc))} · ${m3(VY)} ${F.pct1(av(CAA.real, RAA.real))}.` },
        { k: `EBITDA · ${m3(VU)}`, n: EM ? F.brl(EM.real) : '—', p: EM ? `Margem ${F.pct1(av(EM.real, RM.real))} · orçado ${F.brl(EM.orc)} (${F.sgnPct(pct(EM.real, EM.orc))}).` : 'Sem a aba EBITDA no recorte.' },
      ], 4)}
      ${B.cards([
        { k: `Receita acumulada ${F.MES3[0]}–${F.MES3[MI]}`, n: F.brl(RY.real), p: `${F.sgnPct(pct(RY.real, RY.orc))} contra o orçado · ${F.sgnPct(pct(RY.real, RYA.real))} contra ${ANO - 1}.` },
        { k: `Custos acumulados`, n: F.brl(CY.real), p: `Remunerado ${F.brl(CY.rem)}: ${dCRy > 0 ? 'acima' : 'abaixo'} em ${F.brl(Math.abs(dCRy))} (${F.sgnPct(pct(CY.real, CY.rem))}).` },
        { k: `Custo sobre a receita no ano`, n: F.pct1(av(CY.real, RY.real)), p: `Remunerado ${F.pct1(av(CY.rem, RY.rem))} · ${ANO - 1} ${F.pct1(av(CYA.real, RYA.real))}.` },
        { k: `EBITDA acumulado`, n: EY ? F.brl(EY.real) : '—', p: EY ? `Margem ${F.pct1(av(EY.real, RY.real))} · orçado ${F.brl(EY.orc)} (${F.sgnPct(pct(EY.real, EY.orc))}).` : '' },
      ], 4)}`);

    // ═══ mês a mês ═══
    const MM = ytd.map(v => ({ v, r: rec([v]), c: cus([v]), e: ebi([v]) }));
    B.slide(`${B.head('Mês a mês', `Custos contra o remunerado de ${F.MESN[0]} a ${F.MESN[MI]}`, 'Desvio dos custos de frota contra o remunerado em cada mês (acima = custou mais que o remunerado).')}
      ${B.colunas(MM.map(x => F.MES3[+x.v.slice(5) - 1]), MM.map(x => x.c.real - x.c.rem), { h: 220, lo: Math.min(0, ...MM.map(x => x.c.real - x.c.rem)) * 1.15, fmt: v => F.brl(v).replace('R$ ', ''), cor: v => v > 0 ? F.VERM : F.VERDE })}
      ${B.tabela({ cols: [{ t: 'Mês' }, { t: 'Receita', n: 1 }, { t: 'Custo rem.', n: 1 }, { t: 'Custo real', n: 1 }, { t: 'Δ vs rem.', n: 1 }, { t: 'Δ %', n: 1 }, { t: 'Custo / receita', n: 1 }, { t: 'EBITDA', n: 1 }, { t: 'Margem', n: 1 }],
        rows: MM.map(x => [`<b>${m3(x.v)}</b>`, F.brlInt(x.r.real), F.brlInt(x.c.rem), F.brlInt(x.c.real), dC(x.c.real - x.c.rem), dCp(pct(x.c.real, x.c.rem)), F.pct1(av(x.c.real, x.r.real)), x.e ? F.brlInt(x.e.real) : '—', x.e ? F.pct1(av(x.e.real, x.r.real)) : '—'])
          .concat([{ cls: 'sep', c: ['Acumulado', F.brlInt(RY.real), F.brlInt(CY.rem), F.brlInt(CY.real), dC(dCRy), dCp(pct(CY.real, CY.rem)), F.pct1(av(CY.real, RY.real)), EY ? F.brlInt(EY.real) : '—', EY ? F.pct1(av(EY.real, RY.real)) : '—'] }]) })}`, { top: true });

    // ═══ pacotes ═══
    const dimTab = (keyFn, vsM, vsY) => {
      const g = {}; const add = (rs, cam) => rs.forEach(r => { if (isRec(r)) return; const k = keyFn(r); if (!k || k === '-') return; const a = g[k] = g[k] || { k, m: { orc: 0, rem: 0, real: 0 }, y: { orc: 0, rem: 0, real: 0 } }; a[cam].orc -= +r[C.orc] || 0; a[cam].rem -= +r[C.rem] || 0; a[cam].real -= +r[C.real] || 0; });
      add(linhas(vsM), 'm'); add(linhas(vsY), 'y');
      return Object.values(g).filter(x => x.m.real || x.m.rem || x.y.real || x.y.rem);
    };
    const pac = dimTab(getPac, [VU], ytd).sort((a, b) => Math.abs(b.y.real) - Math.abs(a.y.real));
    const pacPior = pac.slice().sort((a, b) => (b.m.real - b.m.rem) - (a.m.real - a.m.rem));
    B.slide(`${B.head('Pacotes', `${pacPior[0] && pacPior[0].m.real - pacPior[0].m.rem > 0 ? `${pacPior[0].k} puxa o desvio de ${F.MESN[MI]}: ${F.brl(pacPior[0].m.real - pacPior[0].m.rem)} acima do remunerado` : `Pacotes dentro do remunerado em ${F.MESN[MI]}`}`, 'Custo por pacote no mês e no acumulado, contra o remunerado e o orçado.')}
      ${B.tabela({ cols: [{ t: 'Pacote' }, { t: `Rem. ${F.MES3[MI]}`, n: 1 }, { t: `Real ${F.MES3[MI]}`, n: 1 }, { t: 'Δ vs rem.', n: 1 }, { t: 'Δ %', n: 1 }, { t: 'Δ vs orç. %', n: 1 }, { t: 'Rem. no ano', n: 1 }, { t: 'Real no ano', n: 1 }, { t: 'Δ ano', n: 1 }, { t: 'Δ ano %', n: 1 }],
        rows: pac.map(x => [`<b>${F.esc(x.k)}</b>`, F.brlInt(x.m.rem), F.brlInt(x.m.real), dC(x.m.real - x.m.rem), dCp(pct(x.m.real, x.m.rem)), dCp(pct(x.m.real, x.m.orc)), F.brlInt(x.y.rem), F.brlInt(x.y.real), dC(x.y.real - x.y.rem), dCp(pct(x.y.real, x.y.rem))])
          .concat([{ cls: 'sep', c: ['Total', F.brlInt(CM.rem), F.brlInt(CM.real), dC(CM.real - CM.rem), dCp(pct(CM.real, CM.rem)), dCp(pct(CM.real, CM.orc)), F.brlInt(CY.rem), F.brlInt(CY.real), dC(dCRy), dCp(pct(CY.real, CY.rem))] }]) })}
      ${B.concBlocos(pacPior.slice(0, 3).map(x => ({ t: x.k, v: `${F.sgnPct(pct(x.m.real, x.m.rem))} no mês`, s: `${F.brl(x.m.real)} contra ${F.brl(x.m.rem)} remunerado; no ano ${F.sgnPct(pct(x.y.real, x.y.rem))} (${x.y.real - x.y.rem > 0 ? '+' : '−'}${F.brl(Math.abs(x.y.real - x.y.rem)).replace('R$ ', 'R$ ')}).` })), 'Leitura', 3)}`, { top: true });

    // ═══ unidades ═══
    const uni = dimTab(r => getUniLabel(r[C.nv3]), [VU], ytd).sort((a, b) => (b.m.real - b.m.rem) - (a.m.real - a.m.rem));
    const recU = {}; linhas([VU]).filter(isRec).forEach(r => { const k = getUniLabel(r[C.nv3]); recU[k] = (recU[k] || 0) + (+r[C.real] || 0); });
    const piorU = uni.filter(x => x.m.real - x.m.rem > 0).slice(0, 3), melhorU = uni.filter(x => x.m.real - x.m.rem < 0).slice(-3).reverse();
    const pgU = B.paginas(uni, 16);
    pgU.forEach((pg, ix) => B.slide(`${B.head('Unidades', ix ? `Unidades (${ix + 1}/${pgU.length})` : `${uni.filter(x => x.m.real - x.m.rem > 0).length} de ${uni.length} unidades com custo acima do remunerado em ${F.MESN[MI]}`, ix ? '' : 'Da que mais passou do remunerado para a que mais economizou, no mês, com o acumulado do ano ao lado.')}
      ${B.tabela({ cols: [{ t: 'Unidade' }, { t: `Rem. ${F.MES3[MI]}`, n: 1 }, { t: `Real ${F.MES3[MI]}`, n: 1 }, { t: 'Δ vs rem.', n: 1 }, { t: 'Δ %', n: 1 }, { t: 'Custo / receita', n: 1 }, { t: 'Δ ano', n: 1 }, { t: 'Δ ano %', n: 1 }],
        rows: pg.map(x => [`<b>${F.esc(x.k)}</b>`, F.brlInt(x.m.rem), F.brlInt(x.m.real), dC(x.m.real - x.m.rem), dCp(pct(x.m.real, x.m.rem)), recU[x.k] ? F.pct1(x.m.real / recU[x.k] * 100) : '—', dC(x.y.real - x.y.rem), dCp(pct(x.y.real, x.y.rem))]) })}
      ${ix === pgU.length - 1 ? B.concBlocos([
        { t: 'Mais acima do remunerado', s: piorU.length ? piorU.map(x => `${F.esc(x.k)} ${F.brl(x.m.real - x.m.rem)} (${F.sgnPct(pct(x.m.real, x.m.rem))})`).join('<br>') : 'Nenhuma unidade acima.' },
        { t: 'Mais abaixo do remunerado', s: melhorU.length ? melhorU.map(x => `${F.esc(x.k)} ${F.brl(x.m.real - x.m.rem)} (${F.sgnPct(pct(x.m.real, x.m.rem))})`).join('<br>') : 'Nenhuma unidade abaixo.' },
      ], 'Leitura', 2) : ''}`, { top: true }));

    // ═══ um slide por pacote principal: unidade × desvio ═══
    ['Combustíveis', 'Manutenção', 'Pneus'].forEach(p => {
      const pu = dimTab(r => getPac(r) === p ? getUniLabel(r[C.nv3]) : null, [VU], ytd).sort((a, b) => (b.m.real - b.m.rem) - (a.m.real - a.m.rem));
      if (!pu.length) return;
      const T = pac.find(x => x.k === p) || { m: { rem: 0, real: 0, orc: 0 }, y: { rem: 0, real: 0 } };
      // as contas que mais desviaram no pacote
      const ct = dimTab(r => getPac(r) === p ? (CONTAS_ALIAS[r[C.cta]] || r[C.cta]) : null, [VU], ytd).sort((a, b) => (b.m.real - b.m.rem) - (a.m.real - a.m.rem));
      B.slide(`${B.head(p, `${p}: ${F.brl(T.m.real)} em ${F.MESN[MI]}, ${F.sgnPct(pct(T.m.real, T.m.rem))} contra o remunerado`, `Por unidade no mês e no ano · as contas do pacote que mais desviaram no mês.`)}
        <div class="duas" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)"><div>
        ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Rem.', n: 1 }, { t: 'Real', n: 1 }, { t: 'Δ', n: 1 }, { t: 'Δ %', n: 1 }, { t: 'Δ ano %', n: 1 }],
          rows: pu.slice(0, 16).map(x => [`<b>${F.esc(x.k)}</b>`, F.brlInt(x.m.rem), F.brlInt(x.m.real), dC(x.m.real - x.m.rem), dCp(pct(x.m.real, x.m.rem)), dCp(pct(x.y.real, x.y.rem))]) })}</div>
        <div>${B.tabela({ cols: [{ t: 'Conta' }, { t: 'Real', n: 1 }, { t: 'Δ vs rem.', n: 1 }], rows: ct.slice(0, 8).map(x => [F.esc(String(x.k).slice(0, 34)), F.brlInt(x.m.real), dC(x.m.real - x.m.rem)]) })}
        ${B.conc(`No ano, ${p} está ${F.sgnPct(pct(T.y.real, T.y.rem))} contra o remunerado (${F.brl(T.y.real - T.y.rem)}). ${pu[0] && pu[0].m.real - pu[0].m.rem > 0 ? `${F.esc(pu[0].k)} é a maior diferença do mês (${F.brl(pu[0].m.real - pu[0].m.rem)}).` : ''}`, 'Leitura')}</div></div>`, { top: true });
    });

    // ═══ conclusão ═══
    const fecha = [
      { t: 'Mês', v: `${F.sgnPct(pct(CM.real, CM.rem))} contra o remunerado`, s: `Custos de ${F.brl(CM.real)} para ${F.brl(CM.rem)} remunerado; custo sobre a receita em ${F.pct1(av(CM.real, RM.real))}.` },
      { t: 'Ano', v: `${F.sgnPct(pct(CY.real, CY.rem))} contra o remunerado`, s: `${dCRy > 0 ? 'Acima' : 'Abaixo'} em ${F.brl(Math.abs(dCRy))} de janeiro a ${F.MESN[MI]}.` },
    ];
    if (pacPior[0] && pacPior[0].m.real - pacPior[0].m.rem > 0) fecha.push({ t: 'Pacote a atacar', v: pacPior[0].k, s: `${F.brl(pacPior[0].m.real - pacPior[0].m.rem)} acima do remunerado no mês.` });
    if (piorU.length) fecha.push({ t: 'Unidades a atacar', v: F.lista(piorU.map(x => x.k)), s: piorU.map(x => `${F.esc(x.k)} ${F.brl(x.m.real - x.m.rem)}`).join(' · ') + '.' });
    B.slide(`${B.head('Conclusão', `Fechamento de ${F.MESN[MI]}`)}${B.concBlocos(fecha, 'Próximos passos', 2)}`);

    return { doc: B.doc(), slides: B.n(), nome: `Visao_Financeira_Fechamento_${Mes}${ANO}.pdf` };
  }

  async function gerar(o) {
    o = o || {};
    const aviso = o.aviso || (() => {});
    aviso('Montando os slides…');
    const r = await montar(o);
    const n = await ApresBase.pdf(r.doc, r.nome, aviso);
    return { slides: n, nome: r.nome };
  }
  window.VfApresentacao = { montar, gerar };
})();
