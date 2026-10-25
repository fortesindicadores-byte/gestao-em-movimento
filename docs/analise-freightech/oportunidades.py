# ============================================================
# Oportunidades de questionamento com a Ambev (FT × nossas bases), 2022→2026
# Roda na pasta com pq/ (load.py/sh.py). Lê também o dump das tabelas do portal
# (D2=<pasta com tb-*.ndjson.gz>) e o dados.json da análise do Km/L remunerado
# (KML=<caminho>). Grava opo.json e opo_det.pkl (detalhe para a planilha).
# Nada disso vai para o repositório: só este código.
#   D2=... KML=... python3 oportunidades.py
# ============================================================
import os, json, gzip
from comum import *
D2 = os.environ.get('D2', 'dump2'); KML = os.environ.get('KML', 'kml.json')
def tb(n): return pd.DataFrame([json.loads(l) for l in gzip.open(f'{D2}/tb-{n}.ndjson.gz', 'rt') if l.strip()])
def merc(p):
    p = str(p or '').upper().replace('-', '').strip()
    if len(p) == 7 and p[4].isdigit(): p = p[:4] + 'ABCDEFGHIJ'[int(p[4])] + p[5:]
    return p
def vigcol(d): return d._ano.astype(str) + '-' + d._mes.astype(str).str.zfill(2)
R = lambda v: round(float(v), 0)
out = {}; det = {}

# ── placas da Rota e do AS no FT (uma linha por placa × quinzena) ──
cam = []
for canal, tab in [('ROTA', 'Caminhao'), ('AS', 'CaminhaoAS')]:
    c = ft(canal, tab).copy(); c['canal'] = canal; c['vig'] = vigcol(c); cam.append(c)
cam = pd.concat(cam, ignore_index=True)
cam['pl'] = cam.Placa.map(merc); cam['cod'] = cam['Unidade - Nome'].map(FTU).fillna('GNA')
cam['mod'] = cam['Modelo do Cavalo'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
at = cam[cam.Ativo == True].copy()
out['frota_ano'] = {str(a): int(n) for a, n in at.groupby('_ano').pl.nunique().items()}

# ── O1 · contrato da montadora (fatura VW) × manutenção que o FT paga ──
vw = tb('vw_contrato_km'); vw['pl'] = vw.placa.map(merc)
vwp = vw[vw.pl != ''].groupby(['pl', 'vigencia']).agg(km=('km_rodado', 'sum'), valor=('valor', 'sum'), contr=('contrato', 'first')).reset_index()
vwp['rk_vw'] = vwp.valor / vwp.km.replace(0, np.nan)
ftm = at[at._ano >= 2025].groupby(['pl', 'vig']).agg(rk_ft=('R$/KM', 'mean'), bid=('manutencaoBid', 'mean'), cod=('cod', 'last'),
        mod=('mod', 'last'), canal=('canal', 'last'), vida=('manutencaoVidaMeses', 'last')).reset_index().rename(columns={'vig': 'vigencia'})
j = vwp.merge(ftm, on=['pl', 'vigencia'], how='inner')
j['gap'] = (j.rk_vw - j.rk_ft) * j.km; j['ano'] = j.vigencia.str[:4]; j['ft0'] = j.rk_ft.fillna(0) == 0
out['vw'] = {
  'linhas_vw': int(len(vwp)), 'casadas': int(len(j)), 'placas': int(j.pl.nunique()),
  'ano': {a: {'placas': int(g.pl.nunique()), 'km': R(g.km.sum()), 'fatura': R(g.valor.sum()), 'gap': R(g.gap.sum()),
              'gap_ft0': R(g[g.ft0].gap.sum()), 'pl_ft0': int(g[g.ft0].pl.nunique()), 'gap_pos': R(g[g.gap > 0].gap.sum()),
              'gap_neg': R(g[g.gap < 0].gap.sum()), 'rk_vw': round(float(g.valor.sum() / g.km.sum()), 3),
              'rk_ft': round(float((g.rk_ft.fillna(0) * g.km).sum() / g.km.sum()), 3)} for a, g in j.groupby('ano')},
  'uni26': {u: {'placas': int(g.pl.nunique()), 'gap': R(g.gap.sum()), 'gap_ft0': R(g[g.ft0].gap.sum())}
            for u, g in j[j.ano == '2026'].groupby('cod')},
  'mes': {m: R(g.gap.sum()) for m, g in j.groupby('vigencia')},
}
pl26 = j[j.ano == '2026'].groupby('pl').agg(cod=('cod', 'last'), mod=('mod', 'last'), km=('km', 'sum'), fat=('valor', 'sum'),
        gap=('gap', 'sum'), ft0=('ft0', 'mean'), rk_ft=('rk_ft', 'median')).sort_values('gap', ascending=False)
out['vw']['top26'] = [{'pl': p, 'cod': r['cod'], 'mod': r['mod'], 'km': R(r['km']), 'rk_vw': round(r['fat'] / r['km'], 3) if r['km'] else 0,
                       'rk_ft': round(float(r['rk_ft'] or 0), 3), 'gap': R(r['gap'])} for p, r in pl26.head(8).iterrows()]
det['vw'] = j

# ── O2 · manutenção zero no FT fora da carência (> 24 meses de vida) ──
k = ['cod', 'vig', 'mod']
pay = at[at['R$/KM'].fillna(0) > 0].groupby(k).agg(irm=('pl', 'nunique'), rk_irm=('R$/KM', 'median')).reset_index()
z = at[(at['R$/KM'].fillna(0) == 0) & (at.manutencaoVidaMeses > 24) & (at.canal == 'ROTA')].copy()
z['km_q'] = z['KM Mês Roadshow'] / 2
z['pot'] = z.manutencaoBid.fillna(0) * z.km_q
z = z.merge(pay, on=k, how='left')
z['pot_irm'] = z.rk_irm.fillna(0) * z.km_q
vwset = set(zip(vwp.pl, vwp.vigencia)); z['tem_vw'] = [(p, v) in vwset for p, v in zip(z.pl, z.vig)]
zz = z[~z.tem_vw]   # o que tem fatura VW já está no O1
out['zero'] = {
  'ano': {str(a): {'placas': int(g.pl.nunique()), 'pot_bid': R(g.pot.sum()), 'irm_pl': int(g[g.irm.notna()].pl.nunique()),
                   'pot_irm': R(g.pot_irm.sum()), 'sem_vw_pl': int(g[~g.tem_vw].pl.nunique()), 'sem_vw_bid': R(g[~g.tem_vw].pot.sum()),
                   'sem_vw_irm': R(g[~g.tem_vw].pot_irm.sum())} for a, g in z.groupby('_ano')},
  'uni26': {u: {'placas': int(g.pl.nunique()), 'pot_bid': R(g.pot.sum()), 'pot_irm': R(g.pot_irm.sum())}
            for u, g in zz[zz._ano == 2026].groupby('cod')},
  'vida26': round(float(z[z._ano == 2026].groupby('pl').manutencaoVidaMeses.last().median()), 1),
}
det['zero'] = z

# ── O3 · preço do diesel lançado muito abaixo da ANP (fora do tanque interno) ──
pr = []
for canal, tab, dc in [('ROTA', 'CombustivelRota', 'tipoCombustivelShared'), ('EMPURRADA', 'CombustivelEmpurrada', 'descricao')]:
    cb = ft(canal, tab).copy(); cb['tipo'] = cb[dc].astype(str).str.replace('Descrição: ', ''); cb['canal'] = canal
    cb['cod'] = cb['Unidade - Nome'].map(lambda u: {'CUIABA': 'CBA', 'PIRAI': 'PIR', 'MACACU': 'MCC'}.get(u, FTU.get(u)))
    pr.append(cb[['canal', 'cod', 'Unidade - Nome', '_ano', '_mes', '_qz', 'tipo', 'precoOperadora', 'precoAnp'] +
                 (['precoCreditoImpostos'] if 'precoCreditoImpostos' in cb else [])])
pr = pd.concat(pr, ignore_index=True)
pr = pr[pr.tipo.str.contains('S10|DIESEL', na=False)]
out['preco'] = {'registros': int(len(pr)), 'pago_min': int(((pr[['precoOperadora', 'precoAnp']].min(axis=1)) > 0).sum())}
# só o S10: o 'DIESEL' comum da Empurrada é um item parado em R$ 2,99 que nenhum trecho usa
bx = pr[(pr.precoOperadora < 0.6 * pr.precoAnp) & (pr.precoOperadora > 0) & ~pr.cod.isin(['FLP', 'CGR']) & pr.tipo.str.contains('S10')]
out['preco']['baixo'] = [{'canal': r['canal'], 'cod': r['cod'], 'ano': int(r['_ano']), 'mes': int(r['_mes']), 'qz': int(r['_qz']), 'tipo': r['tipo'],
                          'op': round(r['precoOperadora'], 2), 'anp': round(r['precoAnp'], 2)} for r in bx.to_dict('records')]
# litros da quinzena do erro (Rota: placas ativas do FT, km ÷ km/L)
b = pd.read_pickle(os.environ.get('PB', 'preco_baixo_hist.pkl'))
b = b[~b.tanque]; out['preco']['valor'] = R(b.dif.sum()); out['preco']['lit'] = R(b.lit.sum())
# o mesmo erro na Empurrada de Macacu: o diesel do trecho (R$/km) da quinzena × o normal
t = ft('EMPURRADA', 'TrechoEmpurrada'); t = t[t['Unidade - Nome'] == 'MACACU']
tq = t.groupby(['_ano', '_mes', '_qz']).freteReaisKMDiesel.median()
nor = float(tq.loc[(2025, 7)].median()); err = float(tq.loc[(2025, 8, 1)])
dm = dre(); dm = dm[(dm.proj == 'EMPURRADA') & (dm.cod == 'MCC') & (dm['CONTA GERENCIAL'] == 'Combustíveis')]
meia = float(dm[dm.vig == '2025-07'].rem.sum()) / 2
out['preco']['emp'] = {'rskm_normal': round(nor, 2), 'rskm_erro': round(err, 2), 'meia_qz': R(meia), 'perda': R(meia * (1 - err / nor)),
                       'dre_jul': R(dm[dm.vig == '2025-07'].rem.sum()), 'dre_ago': R(dm[dm.vig == '2025-08'].rem.sum())}
ac = pd.read_pickle(os.environ.get('PA', 'preco_acima_hist.pkl'))
out['preco']['acima_ano'] = {str(a): R(g.dif.sum()) for a, g in ac.groupby('_ano')}

# ── O4 · fator de crédito de imposto no preço da Empurrada ──
e = pr[(pr.canal == 'EMPURRADA') & pr.tipo.str.contains('S10')].copy()
e['f'] = e.precoCreditoImpostos / e[['precoOperadora', 'precoAnp']].min(axis=1)
e = e[(e.f > 0.5) & (e.f < 1.05)]
fa = e.groupby(['cod', '_ano']).f.median().unstack()
out['fator'] = {'ano': {c: {str(a): round(float(v), 3) for a, v in r.dropna().items()} for c, r in fa.iterrows()}}
fm = e.groupby(['cod', '_ano', '_mes']).f.median().reset_index()
fm['vig'] = fm._ano.astype(str) + '-' + fm._mes.astype(str).str.zfill(2)
d = dre(); em = d[d.proj.isin(['EMPURRADA', 'INSUMOS']) & (d['CONTA GERENCIAL'] == 'Combustíveis') & (d.vig <= '2026-09')]
em = em.groupby(['cod', 'vig']).rem.sum().reset_index().merge(fm[['cod', 'vig', 'f']], on=['cod', 'vig'], how='inner')
fpir = fm[fm.cod == 'PIR'].set_index('vig').f
em['f_pir'] = em.vig.map(fpir)
em['ref'] = np.where(em.cod == 'CBA', 0.94, em.f_pir)       # CBA: o fator dela até dez/25; MCC: o de Piraí (mesmo estado)
em['imp'] = np.where(em.f < em.ref - 0.01, em.rem * (em.ref / em.f - 1), 0)
em['ano'] = em.vig.str[:4]
out['fator']['impacto'] = {f'{c}|{a}': {'rem': R(g.rem.sum()), 'f': round(float((g.f * g.rem).sum() / g.rem.sum()), 3),
                                        'ref': round(float((g.ref * g.rem).sum() / g.rem.sum()), 3), 'imp': R(g.imp.sum())}
                           for (c, a), g in em[em.cod.isin(['CBA', 'MCC'])].groupby(['cod', 'ano'])}
out['fator']['dre_ini'] = em.vig.min()

# ── O5 · Km/L remunerado (análise de 21/10/2026) ──
kd = json.load(open(KML))
imp = kd['impDisp']
out['kml'] = {'q3q4_iguais': kd['q3q4']['iguais'], 'q3q4_mudaram': kd['q3q4']['mudaram'],
  'grupos': kd['dispRes']['grupos'], 'comDif': kd['dispRes']['comDif'],
  'disp_lit': R(sum(v['perde'] - v['ganha'] for v in imp.values())), 'disp_rs': R(sum(v['rsPerde'] - v['rsGanha'] for v in imp.values())),
  'fora': len(kd['foraMatriz']), 'zeradas': len(kd['erros']['ativasZero']), 'teste_qz': kd['erros']['placaTeste'],
  'km_inat': R(kd['kmInatFTTot']['km']), 'pl_inat': kd['kmInatFTTot']['placas'],
  'km_inat_pct': round(kd['kmInatFTTot']['km'] / kd['kmInatTot']['total'] * 100, 1)}

# ── O6 · km: o teto do FT × o que a Ambev pagou (mapas rodados) ──
x = resumo_rota()
x['dproj'] = np.where(x.tipo == 'VAN', 'ROTA (VAN)', np.where(x['Unidade - Nome'] == 'UDC GUARULHOS', 'UDC', 'ROTA'))
x['var_rs'] = x.comb + x.manut + x.pneu
gv = x.groupby(['dproj', 'cod', 'vig', '_qz'])[['var_rs', 'kmtot']].sum().groupby(['dproj', 'cod', 'vig']).mean()
dp = sh('dispersao_km'); dp['vig'] = pd.to_datetime(dp['Vigência'], errors='coerce').dt.strftime('%Y-%m')
dp['dproj'] = dp['PROJ.'].astype(str).str.split(' - ').str[0].str.strip(); dp['cod'] = dp['PROJ.'].astype(str).str.split(' - ').str[-1].str.strip()
dd = dp.set_index(['dproj', 'cod', 'vig'])[['Frota Ativa', 'Viagens - Real', 'Km/Viagem Real', 'Km Rem. TT', 'Km Rodado TT']]
kk = gv.join(dd, how='inner'); kk = kk[kk.index.get_level_values('vig') <= '2026-08']
kk['rskm'] = kk.var_rs / kk.kmtot
kk['mapas_pos'] = kk['Frota Ativa'] * 25
kk['nao_rod'] = (kk.mapas_pos - kk['Viagens - Real']).clip(lower=0)
kk['rs_nao'] = kk.nao_rod * kk['Km/Viagem Real'] * kk.rskm
kk['ano'] = kk.index.get_level_values('vig').str[:4]
out['km'] = {a: {'teto': R(q.kmtot.sum()), 'pago': R(q['Km Rem. TT'].sum()), 'rodado': R(q['Km Rodado TT'].sum()),
                 'mapas_pos': R(q.mapas_pos.sum()), 'viagens': R(q['Viagens - Real'].sum()),
                 'aprov': round(float(q['Viagens - Real'].sum() / q.mapas_pos.sum() * 100), 1), 'rs_nao': R(q.rs_nao.sum()),
                 'meses': int(q.index.get_level_values('vig').nunique())} for a, q in kk.groupby('ano')}

# ── para o material das unidades ──
c26 = at[(at._ano == 2026) & (at.canal == 'ROTA')]
med = lambda col: round(float(c26[col].median()), 3)
out['ex'] = {k: med(v) for k, v in {'kml': 'Consumo KM/L', 'comb': 'Consumo R$/KM', 'manut': 'R$/KM', 'carr': 'Manutenção Carroceria R$/KM',
  'pneu': 'Pneu por KM', 'var': 'Total Custo Variável', 'fixo': 'Total Custo Fixo', 'km_mes': 'KM Mês Roadshow', 'qpneu': 'Quantidade de Pneus',
  'preco_pneu': 'Preço Tração', 'qrecap': 'Quantidade de Recapagem', 'preco_recap': 'Preço Recapagem', 'vida_pneu': 'Vida Pneus KM',
  'bid': 'manutencaoBid', 'contrato': 'manutencaoContrato', 'vida_meses': 'manutencaoVidaMeses', 'benchmark': 'Benchmark Consumo'}.items()}
out['ex']['placas'] = int(c26.pl.nunique())
k26 = kk[kk.ano == '2026']
out['uni'] = {u: {'mapas_pos': R(q.mapas_pos.sum()), 'viagens': R(q['Viagens - Real'].sum()), 'nao_rod': R(q.nao_rod.sum()),
                  'rs_nao': R(q.rs_nao.sum()), 'pago': R(q['Km Rem. TT'].sum()), 'rodado': R(q['Km Rodado TT'].sum()),
                  'disp': round(float((q['Km Rodado TT'].sum() / q['Km Rem. TT'].sum() - 1) * 100), 1)}
              for u, q in k26.groupby(level='cod')}
dz = pd.read_pickle(os.environ.get('DZ', 'diesel.pkl'))
out['diesel26'] = {f'{cn}|{u}': {'lit': R(q.lit.sum()), 'real': round(float(q.val.sum() / q.lit.sum()), 2),
                                 'anp': round(float((q.precoAnp * q.lit).sum() / q.lit.sum()), 2), 'acima': R(q.acima_anp.sum()),
                                 'perda': R(q.perda_real.sum())} for (cn, u), q in dz.groupby(['canal', 'cod'])}
fq = e.groupby(['cod', '_ano', '_mes', '_qz']).f.median().reset_index()
fq = fq[fq._ano >= 2024]; fq['k'] = fq._ano.astype(str) + '-' + fq._mes.astype(str).str.zfill(2) + '-' + fq._qz.astype(str)
ks = sorted(fq.k.unique())
out['fator']['serie'] = {'k': ks, **{c: [None if pd.isna(v) else round(float(v), 3) for v in fq[fq.cod == c].set_index('k').f.reindex(ks)] for c in ['CBA', 'MCC', 'PIR']}}

tr = ft('EMPURRADA', 'TrechoEmpurrada'); tr = tr[(tr._ano == 2026) & (tr.previsaoViagens > 0)].copy()
tr['w'] = tr.kmRodado * tr.previsaoViagens
TC = {'diesel': 'freteReaisKMDiesel', 'manut_cav': 'freteReaisKMManutencaoCavalo', 'manut_carr': 'freteReaisKMManutencaoCarreta', 'pneu': 'freteReaisKMPneu',
      'lav': 'freteReaisKMLavagem', 'salario': 'freteReaisKMSalarioVariavel', 'lucro': 'freteReaisKMLucroVariavel', 'kml': 'dieselConsumoKmL'}
out['trecho'] = {FTU.get(u, {'CUIABA': 'CBA', 'PIRAI': 'PIR', 'MACACU': 'MCC'}.get(u)): {k: round(float((q[c] * q.w).sum() / q.w.sum()), 3) for k, c in TC.items()}
                 for u, q in tr.groupby('Unidade - Nome')}

# ── conferências que mostram que o FT está certo (credibilidade) ──
dj = json.load(open(os.environ.get('DADOS', 'dados.json')))
out['ok'] = {'ident': dj['ident'], 'km_kmv': dj['km_kmv'], 'comb_regra': dj.get('comb_regra'), 'ftdre_mes': None}

json.dump(out, open('opo.json', 'w'), ensure_ascii=False, indent=1, default=float)
det.update({'fator_mes': em, 'fator_qz': fq, 'km': kk.reset_index(), 'diesel': dz})
pd.to_pickle(det, 'opo_det.pkl')
print(json.dumps(out, ensure_ascii=False, default=float)[:6000])
