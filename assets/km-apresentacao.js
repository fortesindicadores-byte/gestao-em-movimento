// ============================================================
// Painel KM — "Gerar apresentação" (Renan, 30/10/2026)
//
// A Dispersão de km em PDF, no layout clean do DriverPro
// (assets/apresentacao-base.js), com as linhas que o Painel KM JÁ montou
// (ALL: km remunerado com o balanço de massa conforme o filtro BM/Sem BM, km
// rodado, impacto = Δ km × R$/km remunerado dos pacotes) e as placas (PLACAS).
// Mês de referência = a última vigência marcada ou a última com km rodado;
// o acumulado vai de janeiro até ele. Unidade e projeto seguem o filtro.
// Meta da dispersão na Ambev: 5%.
// ============================================================
(function () {
  const ACC = '#F97316', META = 5;

  async function montar(o) {
    o = o || {};
    const F = ApresBase.f;
    const unds = getSel('ms-und'), projs = getSel('ms-proj'), vigSel = getSel('ms-vig');
    const passa = r => (!unds.length || unds.includes(r.und)) && (!projs.length || projs.includes(r.proj));
    const base = ALL.filter(passa);
    const comReal = [...new Set(base.filter(r => r.real > 0).map(r => r.vig))].sort(sortVig);
    const VU = vigSel.length ? vigSel.slice().sort(sortVig).pop() : comReal[comReal.length - 1];
    if (!VU) throw new Error('nenhum mês com km rodado no recorte');
    const [mm, aa] = VU.split('/').map(Number), MI = mm - 1;
    let ytd = comReal.filter(v => v.split('/')[1] === String(aa) && sortVig(v, VU) <= 0);
    if (!ytd.length) ytd = [VU];
    const Mes = F.MESN[MI][0].toUpperCase() + F.MESN[MI].slice(1);
    const m3 = v => F.MES3[+v.split('/')[0] - 1] + '/' + v.split('/')[1].slice(2);
    const recorte = [unds.join(', '), projs.join(', ')].filter(Boolean).join(' · ');
    const B = ApresBase.deck({ acc: ACC, rodape: `Painel KM · Dispersão de km · ${Mes}/${aa}${recorte ? ' · ' + recorte : ''}${BM_MODO === 'Sem BM' ? ' · Sem BM' : ''}`, titulo: `Painel KM · ${Mes}/${aa}`, img: o.img });

    const soma = rs => { const a = { rem: 0, real: 0, imp: 0, via: 0, recomp: 0, bm: 0 }; rs.forEach(r => { a.rem += r.rem; a.real += r.real; a.imp += r.imp; a.via += r.viagens || 0; a.recomp += r.recomp || 0; a.bm += r.bmValor || 0; }); a.d = a.real - a.rem; a.p = a.rem ? a.d / a.rem * 100 : null; return a; };
    const de = vs => base.filter(r => vs.includes(r.vig));
    const M = soma(de([VU])), Y = soma(de(ytd));
    const corP = v => v == null ? '' : `color:${v > META ? F.VERM : F.VERDE};font-weight:700`;
    const corI = v => v == null || Math.abs(v) < 0.5 ? '' : `color:${v > 0 ? F.VERM : F.VERDE};font-weight:700`;
    const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + F.f0(Math.abs(v));
    const temBM = BM_MODO !== 'Sem BM';

    // ═══ capa ═══
    B.capa({ kicker: 'Painel KM', h1: `Dispersão de km<br>${Mes}/${aa}`, texto: `Km rodado contra o km remunerado em ${F.MESN[MI]} e no acumulado do ano, por unidade e projeto, com o impacto em reais${temBM ? ' e o balanço de massa das Empurradas' : ''}${recorte ? `. Recorte: ${F.esc(recorte)}` : ''}.` });

    // ═══ resumo ═══
    B.slide(`${B.head('Resumo', `${Mes}: dispersão de ${F.sgnPct(M.p)} · meta de ${META}%`, `Km rodado contra o km remunerado${temBM ? ' (com o balanço de massa)' : ' (sem o balanço de massa)'}. O impacto é o km a mais ou a menos ao R$/km remunerado dos pacotes Combustíveis, Manutenções e Pneus.`)}
      ${B.cards([
        { k: `Dispersão · ${m3(VU)}`, n: F.sgnPct(M.p), cor: M.p > META ? F.VERM : F.VERDE, p: `${sg(M.d)} km: ${F.num(M.real)} rodados para ${F.num(M.rem)} remunerados.` },
        { k: `Impacto · ${m3(VU)}`, n: F.brl(M.imp), cor: M.imp > 0 ? F.VERM : F.VERDE, p: M.imp > 0 ? 'Custo de rodar acima do remunerado.' : 'Rodou abaixo do remunerado.' },
        { k: `Dispersão no ano`, n: F.sgnPct(Y.p), cor: Y.p > META ? F.VERM : F.VERDE, p: `${sg(Y.d)} km de ${F.MES3[+ytd[0].split('/')[0] - 1]} a ${F.MES3[MI]} · impacto ${F.brl(Y.imp)}.` },
        { k: `Km por viagem · ${m3(VU)}`, n: M.via ? F.f0(M.real / M.via) : '—', p: `${F.f0(M.via)} viagens no mês.${temBM && M.recomp ? ` Balanço de massa: +${F.num(M.recomp)} km no remunerado.` : ''}` },
      ], 4)}
      ${(() => { const ms = ytd.map(v => ({ v, a: soma(de([v])) })); const fora = ms.filter(x => x.a.p > META); return B.concBlocos([
        { t: 'O mês', s: `${M.p > META ? `Acima da meta de ${META}%` : `Dentro da meta de ${META}%`}: ${F.sgnPct(M.p)}, com impacto de ${F.brl(M.imp)}.` },
        { t: 'O ano', s: `${fora.length} de ${ms.length} meses acima da meta${fora.length ? ` (${fora.map(x => m3(x.v)).join(', ')})` : ''}. Acumulado em ${F.sgnPct(Y.p)}.` },
        { t: 'Onde está', s: (() => { const g = {}; de([VU]).forEach(r => { const k = r.und; g[k] = g[k] || []; g[k].push(r); }); const l = Object.entries(g).map(([k, rs]) => ({ k, a: soma(rs) })).filter(x => x.a.imp > 0).sort((a, b) => b.a.imp - a.a.imp).slice(0, 3); return l.length ? `Maior impacto em ${F.lista(l.map(x => `${F.esc(x.k)} (${F.brl(x.a.imp)}, ${F.sgnPct(x.a.p)})`))}.` : 'Nenhuma unidade com impacto positivo.'; })() },
      ], 'Leitura', 3); })()}`);

    // ═══ mês a mês ═══
    const MS = ytd.map(v => ({ v, a: soma(de([v])) }));
    B.slide(`${B.head('Mês a mês', `Dispersão de ${F.MESN[+ytd[0].split('/')[0] - 1]} a ${F.MESN[MI]}`, `Dispersão de cada mês contra a meta de ${META}% (vermelho acima da meta).`)}
      ${B.colunas(MS.map(x => m3(x.v)), MS.map(x => x.a.p), { h: 220, lo: Math.min(0, ...MS.map(x => x.a.p || 0)) * 1.2, meta: META, metaTxt: `Meta ${META}%`, fmt: v => F.sgnPct(v), cor: v => v > META ? F.VERM : F.VERDE })}
      ${B.tabela({ cols: [{ t: 'Mês' }, { t: 'Km remunerado', n: 1 }, { t: 'Km rodado', n: 1 }, { t: 'Δ km', n: 1 }, { t: 'Dispersão', n: 1 }, { t: 'Impacto', n: 1 }, { t: 'Viagens', n: 1 }, { t: 'Km/viagem', n: 1 }].concat(temBM ? [{ t: 'Balanço de massa', n: 1 }] : []),
        rows: MS.map(x => [`<b>${m3(x.v)}</b>`, F.f0(x.a.rem), F.f0(x.a.real), sg(x.a.d), { v: F.sgnPct(x.a.p), style: corP(x.a.p) }, { v: F.brlInt(x.a.imp), style: corI(x.a.imp) }, F.f0(x.a.via), x.a.via ? F.f0(x.a.real / x.a.via) : '—'].concat(temBM ? [x.a.recomp ? '+' + F.f0(x.a.recomp) + ' km' : '—'] : []))
          .concat([{ cls: 'sep', c: ['Acumulado', F.f0(Y.rem), F.f0(Y.real), sg(Y.d), { v: F.sgnPct(Y.p), style: corP(Y.p) }, { v: F.brlInt(Y.imp), style: corI(Y.imp) }, F.f0(Y.via), Y.via ? F.f0(Y.real / Y.via) : '—'].concat(temBM ? [Y.recomp ? '+' + F.f0(Y.recomp) + ' km' : '—'] : []) }]) })}`, { top: true });

    // ═══ unidade × projeto ═══
    const g = {}; de([VU]).forEach(r => { const k = r.und + '|' + r.proj; (g[k] = g[k] || { und: r.und, proj: r.proj, m: [], y: [] }).m.push(r); });
    de(ytd).forEach(r => { const k = r.und + '|' + r.proj; if (g[k]) g[k].y.push(r); });
    const UP = Object.values(g).map(x => Object.assign(x, { a: soma(x.m), b: soma(x.y) })).filter(x => x.a.rem || x.a.real).sort((a, b) => b.a.imp - a.a.imp);
    const pg = B.paginas(UP, 16);
    pg.forEach((p, ix) => B.slide(`${B.head('Unidades e projetos', ix ? `Unidades e projetos (${ix + 1}/${pg.length})` : `${UP.filter(x => x.a.p > META).length} de ${UP.length} operações acima da meta em ${F.MESN[MI]}`, ix ? '' : 'Do maior para o menor impacto no mês, com o acumulado do ano ao lado.')}
      ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Projeto' }, { t: 'Km rem.', n: 1 }, { t: 'Km rodado', n: 1 }, { t: 'Δ km', n: 1 }, { t: 'Dispersão', n: 1 }, { t: 'Impacto', n: 1 }, { t: 'Disp. ano', n: 1 }, { t: 'Impacto ano', n: 1 }],
        rows: p.map(x => [`<b>${F.esc(x.und)}</b>`, F.esc(x.proj), F.f0(x.a.rem), F.f0(x.a.real), sg(x.a.d), { v: F.sgnPct(x.a.p), style: corP(x.a.p) }, { v: F.brlInt(x.a.imp), style: corI(x.a.imp) }, { v: F.sgnPct(x.b.p), style: corP(x.b.p) }, { v: F.brlInt(x.b.imp), style: corI(x.b.imp) }])
          .concat(ix === pg.length - 1 ? [{ cls: 'sep', c: ['Total', '', F.f0(M.rem), F.f0(M.real), sg(M.d), { v: F.sgnPct(M.p), style: corP(M.p) }, { v: F.brlInt(M.imp), style: corI(M.imp) }, { v: F.sgnPct(Y.p), style: corP(Y.p) }, { v: F.brlInt(Y.imp), style: corI(Y.imp) }] }] : []) })}`, { top: true }));

    // ═══ placas (abertura / planilha de viagens) ═══
    const PL = (typeof PLACAS !== 'undefined' ? PLACAS : []).filter(r => r.vig === VU && (!unds.length || unds.map(_nkBM).includes(_nkBM(r.und))) && (!projs.length || projs.map(_nkBM).includes(_nkBM(r.proj))));
    if (PL.length) {
      const top = PL.slice().sort((a, b) => b.delta - a.delta).filter(r => r.delta > 0).slice(0, 16);
      const tD = PL.reduce((s, r) => s + r.delta, 0);
      B.slide(`${B.head('Placas', `As ${top.length} placas que mais rodaram acima do remunerado em ${F.MESN[MI]}`, `${PL.length} placas no mês · ${sg(tD)} km no total das placas. Impacto ao R$/km remunerado da unidade e projeto.`)}
        ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Projeto' }, { t: 'Placa' }, { t: 'Km rem.', n: 1 }, { t: 'Km rodado', n: 1 }, { t: 'Δ km', n: 1 }, { t: 'Δ %', n: 1 }, { t: 'Impacto', n: 1 }],
          rows: top.map(r => [F.esc(r.und), F.esc(r.proj), `<b>${F.esc(r.placa)}</b>`, F.f0(r.rem), F.f0(r.real), sg(r.delta), r.rem ? F.sgnPct(r.delta / r.rem * 100) : '—', { v: F.brlInt(r.imp), style: corI(r.imp) }]) })}`, { top: true });
    }

    // ═══ balanço de massa ═══
    if (temBM && Y.recomp) {
      const bu = {}; de(ytd).filter(r => r.recomp).forEach(r => { const k = r.und + ' · ' + r.proj; const a = bu[k] = bu[k] || { k, km: 0, v: 0, rem0: 0, m: 0 }; a.km += r.recomp; a.v += r.bmValor || 0; a.rem0 += r.rem0 || 0; if (r.vig === VU) a.m += r.recomp; });
      const L = Object.values(bu).sort((a, b) => b.km - a.km);
      B.slide(`${B.head('Balanço de massa', `+${F.num(Y.recomp)} km devolvidos ao remunerado no ano`, 'Viagens das Empurradas cobradas depois, sem CTE: o valor volta ao km remunerado ao R$/km da operação, rateado no ano.')}
        ${B.tabela({ cols: [{ t: 'Operação' }, { t: 'Valor no ano', n: 1 }, { t: 'Km no ano', n: 1 }, { t: '% do remunerado', n: 1 }, { t: `Km em ${F.MES3[MI]}`, n: 1 }],
          rows: L.map(x => [`<b>${F.esc(x.k)}</b>`, F.brlInt(x.v), '+' + F.f0(x.km), x.rem0 ? F.pct1(x.km / (x.rem0 + x.km) * 100) : '—', x.m ? '+' + F.f0(x.m) : '—']) })}
        ${B.conc(`Sem o balanço de massa, a dispersão do ano seria ${F.sgnPct((Y.real - (Y.rem - Y.recomp)) / (Y.rem - Y.recomp) * 100)} em vez de ${F.sgnPct(Y.p)}.`, 'Leitura')}`, { top: true });
    }

    // ═══ conclusão ═══
    const piores = UP.filter(x => x.a.imp > 0).slice(0, 3);
    const fecha = [
      { t: 'Mês', v: F.sgnPct(M.p), s: `${M.p > META ? 'Acima' : 'Dentro'} da meta de ${META}%; impacto de ${F.brl(M.imp)}.` },
      { t: 'Ano', v: F.sgnPct(Y.p), s: `Impacto acumulado de ${F.brl(Y.imp)}.` },
    ];
    if (piores.length) fecha.push({ t: 'Operações a atacar', v: F.lista(piores.map(x => `${F.esc(x.und)} ${F.esc(x.proj)}`)), s: piores.map(x => `${F.esc(x.und)} ${F.esc(x.proj)}: ${F.sgnPct(x.a.p)}, ${F.brl(x.a.imp)}`).join(' · ') + '.' });
    B.slide(`${B.head('Conclusão', `Dispersão de km em ${F.MESN[MI]}`)}${B.concBlocos(fecha, 'Próximos passos', fecha.length > 2 ? 3 : 2)}`);

    return { doc: B.doc(), slides: B.n(), nome: `Painel_KM_Dispersao_${Mes}${aa}.pdf` };
  }

  async function gerar(o) {
    o = o || {};
    const aviso = o.aviso || (() => {});
    aviso('Montando os slides…');
    const r = await montar(o);
    const n = await ApresBase.pdf(r.doc, r.nome, aviso);
    return { slides: n, nome: r.nome };
  }
  window.KmApresentacao = { montar, gerar };
})();
