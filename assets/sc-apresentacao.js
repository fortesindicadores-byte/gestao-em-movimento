// ============================================================
// Scorecard — "Gerar apresentação" (Renan, 30/10/2026)
//
// O Scorecard em PDF, no layout clean do DriverPro
// (assets/apresentacao-base.js), com as contas do próprio painel: cardVals()
// (os 20 indicadores da rede), unitScores() + scoreFromNotes() (pontuação por
// unidade com os pesos SCORE_PESOS) e o topo que ele já escreveu (melhor,
// a recuperar, maior evolução T1/T2). Período e unidades = os filtros da tela.
// ============================================================
(function () {
  const ACC = '#F97316';
  const LBL = { custos: 'Custos Frota', disp: 'Disponibilidade', dpo: 'DPO/VPO Sustentável', kmAt: 'Atingimento KM', prev: 'Preventivas', kml: 'Consumo Km/L', saude: 'Saúde dos Pneus', conf: 'Conformidade Frota', sla: 'SLA Atendimento', chkT: 'Checklist T1/T2', stCam: 'Stress Test Cam.', rkm: 'R$/km', pressao: 'Pressão dos Pneus', fcaC: 'FCA Conclusão', fcaP: 'FCA Prazo', rl: 'R$/L', chkApoio: 'Checklist Apoio', stEmp: 'Stress Test Emp.', afer: 'Aferições', civf: 'CIVF' };
  const RR = new Set(['custos', 'kmAt', 'kml', 'rkm', 'rl']);            // real ÷ remunerado
  const NOME = { 'CDD CAMBORIU': 'CDD Camboriú', 'CDD CUIABA': 'CDD Cuiabá', 'CDD FLORIANOPOLIS': 'CDD Florianópolis', 'CDD GUARULHOS': 'CDD Guarulhos', 'CDD NOVA FRIBURGO': 'CDD Nova Friburgo', 'CDD PELOTAS': 'CDD Pelotas', 'CDD RIO DE JANEIRO': 'CDD Rio de Janeiro', 'CDD RONDONOPOLIS': 'CDD Rondonópolis', 'CDI MACACU': 'CDI Macacu', 'CUIABA': 'Cuiabá Armazém', 'CUIABA EMPURRADA': 'Cuiabá Empurrada', 'MACACU EMPURRADA': 'Macacu Empurrada', 'PIRAI EMPURRADA': 'Piraí Empurrada' };
  const nm = u => NOME[u] || u;
  // faixas do painel: pontuação g ≥ 90 · y ≥ 80 · o ≥ 70 · r; real/rem g ≥ 100 · y ≥ 98 · o ≥ 95
  const bd = (k, v) => v == null ? 'm' : (RR.has(k) ? bandCost(v) : (k === 'prev' ? bandG(v, 95) : bandG(v))) || 'm';
  const bdS = v => v == null ? 'm' : band(v) || 'm';

  async function montar(o) {
    o = o || {};
    const F = ApresBase.f;
    if (!ICS.length) throw new Error('o Scorecard ainda está carregando');
    let selVig = getMsValues('ms-vig'); const selUni = getMsValues('ms-uni');
    // a vigência que o painel marcou sozinho ao abrir (a última) não é escolha de quem gera
    if (typeof _vigAuto !== 'undefined' && _vigAuto && selVig.length === 1 && selVig[0] === _vigAuto) selVig = [];
    const unis0 = selUni.length ? selUni.filter(u => UNI_LIST.includes(u)) : UNI_LIST.slice();
    // sem vigência marcada: o último mês FECHADO (12 dos 20 indicadores apurados).
    // O mês corrente abre com poucos indicadores e a pontuação dele não diz nada ainda.
    const apurados = d => { const v = cardVals(new Set([vigKeyN(d)]), d.getFullYear(), d.getMonth(), unis0); return Object.keys(SCORE_PESOS).filter(k => v[k] != null).length; };
    let cands = (selVig.length ? VIGS.filter(d => selVig.includes(vigLbl(d))) : VIGS.slice()).sort((a, b) => vigKeyN(a) - vigKeyN(b));
    if (!selVig.length) { const fech = cands.filter(d => apurados(d) >= 12); cands = fech.length ? [fech[fech.length - 1]] : cands.slice(-1); }
    const selD = cands[cands.length - 1] || VIGS[VIGS.length - 1];
    const perKeys = new Set(cands.map(vigKeyN));
    const yr = selD.getFullYear(), mi = selD.getMonth();
    const unis = unis0;
    const periodo = cands.length <= 1 ? vigLbl(selD) : `${vigLbl(cands[0])} a ${vigLbl(selD)}`;
    const Mes = F.MESN[mi][0].toUpperCase() + F.MESN[mi].slice(1);
    const B = ApresBase.deck({ acc: ACC, rodape: `Scorecard · ${periodo}${selUni.length ? ' · ' + selUni.length + ' unidade(s)' : ''}`, titulo: `Scorecard · ${periodo}`, img: o.img });

    const CV = cardVals(perKeys, yr, mi, unis);
    const rk = unis.map(u => { const notes = unitScores(u, perKeys, yr, mi); return { u, notes, score: scoreFromNotes(notes) }; }).filter(x => x.score != null).sort((a, b) => b.score - a.score);
    const rede = scoreFromNotes(CV);
    // maior evolução T1/T2: o período contra o anterior com o mesmo nº de meses (regra do painel)
    const evol = (() => { const n = cands.length, k0 = vigKeyN(cands[0]); let y = Math.floor(k0 / 100), m = k0 % 100; const kk = []; for (let i = 0; i < n; i++) { m--; if (m < 0) { m = 11; y--; } kk.push(y * 100 + m); }
      if (!ICS.some(o => kk.includes(vigKeyN(o.vigD)))) return null; const ant = new Set(kk), ay = Math.floor(kk[0] / 100), am = kk[0] % 100;
      return rk.map(x => { const a = scoreFromNotes(unitScores(x.u, ant, ay, am)); return a == null ? null : { u: x.u, d: x.score - a }; }).filter(Boolean); })();
    const melhorEv = t1 => { const l = (evol || []).filter(e => UNI_T1.has(e.u) === t1).sort((a, b) => b.d - a.d); return l[0] ? `${nm(l[0].u)} ${l[0].d >= 0 ? '+' : '−'}${F.f1(Math.abs(l[0].d))}` : '—'; };
    const ks = Object.keys(SCORE_PESOS);
    const crit = ks.filter(k => CV[k] != null && CV[k] < 70);
    const sc = (v, c) => F.cel(v == null ? '—' : Math.round(v), c);

    // ═══ capa ═══
    B.capa({ kicker: 'Scorecard', h1: `Scorecard<br>${cands.length <= 1 ? Mes + '/' + yr : F.esc(periodo)}`, texto: `Pontuação das ${rk.length} unidades em 20 indicadores ponderados (custos, disponibilidade, DPO, km, consumo, pneus, checklists, stress test, SLA, CIVF e FCA)${cands.length > 1 ? ', na média do período' : ''}.` });

    // ═══ resumo ═══
    B.slide(`${B.head('Resumo', `Pontuação da rede em ${F.f1(rede)} · ${periodo}`, 'Os 20 indicadores da rede com os pesos do Scorecard; o peso de quem não tem o indicador é redistribuído.')}
      ${B.cards([
        { k: 'Pontuação da rede', n: F.f1(rede), acc: 1, p: `${rk.filter(x => x.score >= 90).length} unidades com 90 ou mais · ${rk.filter(x => x.score < 70).length} abaixo de 70.` },
        { k: 'Melhor unidade', n: rk[0] ? Math.round(rk[0].score) : '—', p: rk[0] ? nm(rk[0].u) : '' },
        { k: 'A recuperar', n: rk.length > 1 ? Math.round(rk[rk.length - 1].score) : '—', p: rk.length > 1 ? nm(rk[rk.length - 1].u) : '' },
        { k: 'Indicadores críticos (< 70)', n: crit.length, cor: crit.length ? F.VERM : F.VERDE, p: crit.length ? F.lista(crit.map(k => `${LBL[k]} ${Math.round(CV[k])}`)) + '.' : 'Nenhum indicador da rede abaixo de 70.' },
      ], 4)}
      ${B.concBlocos([
        { t: 'Maior evolução T1', v: melhorEv(true), s: 'Armazém e Empurradas: pontuação do período contra o período anterior.' },
        { t: 'Maior evolução T2', v: melhorEv(false), s: 'CDDs e CDI: pontuação do período contra o período anterior.' },
        { t: 'Mais pesa', s: (() => { const l = ks.filter(k => CV[k] != null).map(k => ({ k, g: SCORE_PESOS[k] * (100 - CV[k]) })).sort((a, b) => b.g - a.g).slice(0, 3); return l.length ? `Os indicadores que mais tiram pontos da rede (peso × distância de 100): ${F.lista(l.map(x => `${LBL[x.k]} (${Math.round(CV[x.k])}, peso ${SCORE_PESOS[x.k]})`))}.` : '—'; })() },
      ], 'Leitura', 3)}`);

    // ═══ indicadores da rede ═══
    const IND = ks.map(k => ({ k, v: CV[k], p: SCORE_PESOS[k] })).sort((a, b) => (a.v == null ? 999 : a.v) - (b.v == null ? 999 : b.v));
    const meio = Math.ceil(IND.length / 2);
    const tabInd = l => B.tabela({ cols: [{ t: 'Indicador' }, { t: 'Peso', n: 1 }, { t: 'Atingimento', c: 1 }, { t: 'Régua' }], rows: l.map(x => [`<b>${LBL[x.k]}</b>`, x.p, sc(x.v, bd(x.k, x.v)), RR.has(x.k) ? 'real ÷ remunerado' : x.k === 'prev' ? 'meta 95' : 'meta 90']) });
    B.slide(`${B.head('Indicadores da rede', `${IND.filter(x => x.v != null && bd(x.k, x.v) === 'g').length} de ${IND.filter(x => x.v != null).length} indicadores no verde`, 'Atingimento da rede em cada indicador, do menor para o maior. Real ÷ remunerado: 100 = dentro do remunerado (verde ≥ 100 · amarelo ≥ 98 · laranja ≥ 95).')}
      <div class="duas" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><div>${tabInd(IND.slice(0, meio))}</div><div>${tabInd(IND.slice(meio))}</div></div>`, { top: true });

    // ═══ ranking ═══
    B.slide(`${B.head('Ranking', 'Pontuação por unidade, da melhor para a pior', `${periodo} · faixas: ≥ 90 verde · 80 a 89 amarelo · 70 a 79 laranja · < 70 vermelho.`)}
      ${B.tabela({ classe: 'densa', style: 'margin-top:6px', cols: [{ t: '#' }, { t: 'Unidade' }, { t: 'Score', c: 1 }].concat(RK_COLS.map(c => ({ t: c.l, c: 1 }))),
        rows: rk.map((x, i) => [i + 1, `<b>${nm(x.u)}</b>`, F.cel(`<b>${Math.round(x.score)}</b>`, bdS(x.score))].concat(RK_COLS.map(c => sc(x.notes[c.k], bd(c.k, x.notes[c.k]))))) })}
      <p class="note">Colunas na ordem do peso: ${RK_COLS.map(c => `${c.l} = ${LBL[c.k]} (${SCORE_PESOS[c.k]})`).join(' · ')}.</p>`, { top: true });

    // ═══ evolução mês a mês (do ano do mês de referência) ═══
    const meses = VIGS.filter(d => d.getFullYear() === yr && vigKeyN(d) <= vigKeyN(selD));
    if (meses.length > 1) {
      const pm = meses.map(d => { const k = new Set([vigKeyN(d)]); return { d, rede: scoreFromNotes(cardVals(k, d.getFullYear(), d.getMonth(), unis)), u: Object.fromEntries(rk.map(x => [x.u, scoreFromNotes(unitScores(x.u, k, d.getFullYear(), d.getMonth()))])) }; });
      const ini = pm[0], fim = pm[pm.length - 1];
      const ev = rk.map(x => ({ u: x.u, d: (fim.u[x.u] != null && ini.u[x.u] != null) ? fim.u[x.u] - ini.u[x.u] : null })).filter(x => x.d != null).sort((a, b) => b.d - a.d);
      B.slide(`${B.head('Mês a mês', `Rede de ${F.f1(ini.rede)} em ${vigLbl(ini.d)} para ${F.f1(fim.rede)} em ${vigLbl(fim.d)}`, 'Pontuação de cada unidade em cada mês, pela mesma conta do ranking.')}
        ${B.tabela({ classe: 'densa', cols: [{ t: 'Unidade' }].concat(pm.map(x => ({ t: F.MES3[x.d.getMonth()], c: 1 })), [{ t: `Δ ${F.MES3[ini.d.getMonth()]}→${F.MES3[fim.d.getMonth()]}`, n: 1 }]),
          rows: rk.map(x => [`<b>${nm(x.u)}</b>`].concat(pm.map(m => sc(m.u[x.u], bdS(m.u[x.u]))), [(() => { const e = ev.find(y => y.u === x.u); return e ? F.seta(e.d, F.f1(Math.abs(e.d))) : '—'; })()]))
            .concat([{ cls: 'sep', c: ['Rede'].concat(pm.map(m => sc(m.rede, bdS(m.rede))), [F.seta(fim.rede - ini.rede, F.f1(Math.abs(fim.rede - ini.rede)))]) }]) })}
        ${ev.length ? B.concBlocos([
          { t: 'Mais subiram', s: ev.slice(0, 3).map(x => `${nm(x.u)} ${x.d >= 0 ? '+' : '−'}${F.f1(Math.abs(x.d))}`).join(' · ') },
          { t: 'Mais caíram', s: ev.slice().reverse().filter(x => x.d < 0).slice(0, 3).map(x => `${nm(x.u)} −${F.f1(Math.abs(x.d))}`).join(' · ') || 'Nenhuma unidade caiu.' },
        ], 'Leitura', 2) : ''}`, { top: true });
    }

    // ═══ ofensores por unidade ═══
    const ofs = rk.map(x => ({ x, l: ks.filter(k => x.notes[k] != null && x.notes[k] < (RR.has(k) ? 95 : 70)).sort((a, b) => SCORE_PESOS[b] * (100 - x.notes[b]) - SCORE_PESOS[a] * (100 - x.notes[a])) })).filter(y => y.l.length);
    if (ofs.length) B.slide(`${B.head('Ofensores', 'O que mais tira ponto de cada unidade', 'Indicadores abaixo de 70 (ou abaixo de 95 nos de real ÷ remunerado), do que mais pesa para o que menos pesa.')}
      ${B.tabela({ cols: [{ t: 'Unidade' }, { t: 'Score', c: 1 }, { t: 'Abaixo da régua', w: 1 }],
        rows: ofs.map(y => [`<b>${nm(y.x.u)}</b>`, F.cel(Math.round(y.x.score), bdS(y.x.score)), y.l.map(k => `<span style="white-space:nowrap">${LBL[k]} <b style="color:${F.VERM}">${Math.round(y.x.notes[k])}</b></span>`).join(' · ')]) })}`, { top: true });

    // ═══ conclusão ═══
    const fecha = [{ t: 'Rede', v: F.f1(rede), s: `${rk.filter(x => x.score >= 90).length} de ${rk.length} unidades com 90 ou mais.` }];
    if (crit.length) fecha.push({ t: 'Indicadores a atacar', v: F.lista(crit.slice(0, 3).map(k => LBL[k])), s: crit.map(k => `${LBL[k]} ${Math.round(CV[k])}`).join(' · ') + '.' });
    const baixo = rk.filter(x => x.score < 80);
    if (baixo.length) fecha.push({ t: 'Unidades abaixo de 80', v: F.lista(baixo.map(x => nm(x.u))), s: baixo.map(x => `${nm(x.u)} ${Math.round(x.score)}`).join(' · ') + '.' });
    B.slide(`${B.head('Conclusão', `Scorecard · ${periodo}`)}${B.concBlocos(fecha, 'Próximos passos', fecha.length > 2 ? 3 : 2)}`);

    return { doc: B.doc(), slides: B.n(), nome: `Scorecard_${cands.length <= 1 ? Mes + yr : vigLbl(cands[0]).replace('/', '') + '_' + vigLbl(selD).replace('/', '')}.pdf` };
  }

  async function gerar(o) {
    o = o || {};
    const aviso = o.aviso || (() => {});
    aviso('Montando os slides…');
    const r = await montar(o);
    const n = await ApresBase.pdf(r.doc, r.nome, aviso);
    return { slides: n, nome: r.nome };
  }
  window.ScApresentacao = { montar, gerar };
})();
