# ============================================================
# Análise 2026 estrutural: as camadas de investigação que a Análise 2026 refeita
# em 26/10/2026 mostra (erros · gaps · oportunidades · custos discrepantes), por
# unidade e por placa, mais o "porquê" do remunerado da DRE acima do FT.
# Lê os parquet (load.py/sh.py), o pkl do completa.py e o dump das tabelas do portal.
#   INI=2026-01 FIM=2026-08 ROTULO=2026 D2=../dump3 PYTHONPATH=. python3 analise2.py  → analise2-2026.json
# Só o código vai para o repositório; o JSON tem placas e fica fora.
# ============================================================
import os, json, gzip
from comum import *
INI = os.environ.get('INI', '2026-01'); FIM = os.environ.get('FIM', '2026-08'); ROT = os.environ.get('ROTULO', '2026'); D2 = os.environ.get('D2', '../dump3')
S = pd.read_pickle(f'completa-{ROT}.pkl'); cam, J, B, F, jv = S['cam'], S['J'], S['B'], S['F'], S['jv']
def tb(n): return pd.DataFrame([json.loads(l) for l in gzip.open(f'{D2}/tb-{n}.ndjson.gz', 'rt') if l.strip()])
def per(df, col='vig'): return df[(df[col] >= INI) & (df[col] <= FIM)]
R0 = lambda v: round(float(v), 0); R2 = lambda v: round(float(v), 2); R3 = lambda v: round(float(v), 3)
def merc(p):
    p = str(p or '').upper().replace('-', '').strip()
    if len(p) == 7 and p[4].isdigit(): p = p[:4] + 'ABCDEFGHIJ'[int(p[4])] + p[5:]
    return p
T2 = ['ROTA', 'ROTA (VAN)', 'UDC', 'AUTO SERVIÇO']
out = {'INI': INI, 'FIM': FIM}
Fp = per(F); VAR = ['comb', 'manut', 'carr', 'pneu']
Fp = Fp.assign(var_pago=Fp[[c + '_pago' for c in VAR]].sum(axis=1), var_teto=Fp[VAR].sum(axis=1))

# ── 1) km por unidade: pago (Dispersão) · rodado (Dispersão) · abastecido (aba Km/L), com o R$ de cada diferença ao R$/km pago ──
bu = B.groupby(level='cod').sum()
ku = Fp.groupby('cod')[['Km Rem. TT', 'Km Rodado TT', 'var_pago', 'Viagens - Real', 'Frota Ativa']].sum()
ku['ativos_mes'] = Fp.groupby('cod').apply(lambda g: g.groupby('vig').ativos.sum().mean())
nm = Fp.vig.nunique()
km = {}
for u, r in ku.iterrows():
    rkm = r.var_pago / r['Km Rem. TT'] if r['Km Rem. TT'] else 0
    ab = bu.loc[u, 'km'] if u in bu.index else None
    km[u] = {'pago': R0(r['Km Rem. TT']), 'rodado': R0(r['Km Rodado TT']), 'abastecido': None if ab is None else R0(ab), 'rskm_pago': R3(rkm),
             'disp_km': R0(r['Km Rodado TT'] - r['Km Rem. TT']), 'disp_rs': R0((r['Km Rodado TT'] - r['Km Rem. TT']) * rkm),
             'inat_km': None if ab is None else R0(ab - r['Km Rodado TT']), 'inat_rs': None if ab is None else R0((ab - r['Km Rodado TT']) * rkm),
             'viagens': R0(r['Viagens - Real']), 'ativos_mes': R2(r.ativos_mes), 'viag_ativo_mes': R2(r['Viagens - Real'] / (r.ativos_mes * nm)) if r.ativos_mes else None}
out['km_uni'] = km
out['km_tot'] = {'pago': R0(ku['Km Rem. TT'].sum()), 'rodado': R0(ku['Km Rodado TT'].sum()), 'abastecido': R0(bu.km.sum()), 'var_pago': R0(ku.var_pago.sum()),
                 'disp_rs': R0(sum(x['disp_rs'] for x in km.values())), 'inat_rs': R0(sum(x['inat_rs'] or 0 for x in km.values())), 'n_meses': int(nm),
                 'teto_km': R0(Fp.kmtot.sum()), 'teto_var': R0(Fp.var_teto.sum()), 'viag_ativo_mes': R2(ku['Viagens - Real'].sum() / (ku.ativos_mes.sum() * nm))}

# ── 2) placas inativas no FT que rodam (aba Km/L × Caminhão do FT), placa a placa ──
kl = sh('consumo_km_litro'); kl['vig'] = pd.to_datetime(kl['Vigência'], errors='coerce').dt.strftime('%Y-%m')
kl['proj'] = kl.Projeto.astype(str).str.split(' - ').str[0].str.strip().replace({'VAN': 'ROTA (VAN)'}); kl['cod'] = kl.Projeto.astype(str).str.split(' - ').str[-1].str.strip().replace({'GOI': 'GNA'})
kl = per(kl[kl.proj.isin(T2)]).copy(); kl['pl'] = kl.Placa.map(merc)
for c, s in [('km', 'KM Rodado / Horas trabalhadas'), ('lit', 'QTD Total de Litros'), ('rs', 'TOTAS R$'), ('plr', 'R$/L Rem'), ('kmlr', 'KM/l Rem Médio')]: kl[c] = pd.to_numeric(kl[s], errors='coerce').fillna(0)
ca = ft('ROTA', 'Caminhao'); ca['vig'] = ca._ano.astype(str) + '-' + ca._mes.astype(str).str.zfill(2); ca = per(ca).copy(); ca['pl'] = ca.Placa.map(merc); ca['cod'] = ca['Unidade - Nome'].map(FTU)
# a placa está "ativa no FT" se está ativa em QUALQUER canal T2 (Rota, Van ou AS) naquele mês
def status(df, pcol, acol, mcol):
    d = df.copy(); d['vig'] = d._ano.astype(str) + '-' + d._mes.astype(str).str.zfill(2); d = per(d); d['pl'] = d[pcol].map(merc); d['cod'] = d['Unidade - Nome'].map(FTU)
    d['at'] = d[acol].astype(str).str.lower().isin(['true', '1', 'ativo']); d['modelo'] = d[mcol].astype(str) if mcol in d.columns else ''
    return d[['pl', 'vig', 'cod', 'at', 'modelo']]
va = ft('ROTA', 'Van'); sa = ft('AS', 'CaminhaoAS')
ST = pd.concat([status(ca, 'Placa', 'Ativo', 'Modelo do Cavalo'), status(va, 'placa' if 'placa' in va.columns else 'Placa', 'ativo' if 'ativo' in va.columns else 'Ativo', 'modelo' if 'modelo' in va.columns else 'Modelo do Cavalo'),
                status(sa, 'Placa', 'Ativo', 'Modelo do Cavalo')], ignore_index=True)
st = ST.groupby(['pl', 'vig']).agg(ativo=('at', 'any'), uni=('cod', 'last'), modelo=('modelo', 'last')).reset_index()
g = kl.groupby(['pl', 'vig', 'cod']).agg(km=('km', 'sum'), lit=('lit', 'sum'), rs=('rs', 'sum')).reset_index().merge(st, on=['pl', 'vig'], how='left')
g['no_ft'] = g.ativo.notna(); g['inativa'] = g.ativo.eq(False)
ina = g[g.inativa]
# R$ ao R$/km pago da unidade do abastecimento
rkmu = {u: x['rskm_pago'] for u, x in km.items()}
ina = ina.assign(rs_km=lambda d: d.km * d.cod.map(rkmu).fillna(0))
pl = ina.groupby('pl').agg(km=('km', 'sum'), meses=('vig', 'nunique'), uni=('cod', 'last'), uni_ft=('uni', 'last'), modelo=('modelo', 'last'), rs=('rs_km', 'sum'), lit=('lit', 'sum')).sort_values('km', ascending=False)
out['inativas'] = {'placas': int(len(pl)), 'km': R0(pl.km.sum()), 'rs': R0(pl.rs.sum()), 'lit': R0(pl.lit.sum()), 'km_pct_abast': R2(pl.km.sum() / g.km.sum() * 100) if g.km.sum() else 0,
                   'fora_ft': {'placas': int(g[~g.no_ft].pl.nunique()), 'km': R0(g[~g.no_ft].km.sum())},
                   'top': [[p, r.uni, str(r.modelo)[:28], R0(r.km), int(r.meses), R0(r.rs)] for p, r in pl.head(12).iterrows()],
                   'uni': {u: {'placas': int(x.pl.nunique()), 'km': R0(x.km.sum()), 'rs': R0(x.rs_km.sum())} for u, x in ina.groupby('cod')}}

# ── 3) diesel acima da ANP no ERP, por unidade (2026): litros × (preço pago − ANP da unidade no mês) ──
try:
    er = tb('erp_abastecimentos'); er['vig'] = er.data.astype(str).str[:7]; er = per(er)
    er = er[er.tipo_combustivel.astype(str).str.upper().str.contains('DIESEL')].copy()
    er['proj'] = er.projeto_os.astype(str).str.split(' - ').str[0].str.strip(); er['cod'] = er.projeto_os.astype(str).str.split(' - ').str[-1].str.strip().replace({'GOI': 'GNA'})
    er = er[er.proj.str.upper().isin(['ROTA', 'ROTA (VAN)', 'VAN', 'UDC', 'AUTO SERVIÇO', 'AUTO SERVICO'])]
    er['litros'] = pd.to_numeric(er.litros, errors='coerce'); er['valor'] = pd.to_numeric(er.valor, errors='coerce'); er = er[(er.litros > 0) & (er.valor > 0)]
    er['pl'] = er.valor / er.litros; er = er[(er.pl > 1.5) & (er.pl < 12)]
    cb = ft('ROTA', 'CombustivelRota'); cb = cb[cb.tipoCombustivelShared.astype(str).str.contains('S10')].copy(); cb['vig'] = cb._ano.astype(str) + '-' + cb._mes.astype(str).str.zfill(2); cb['cod'] = cb['Unidade - Nome'].map(FTU)
    anp = cb.groupby(['cod', 'vig'])[['precoAnp', 'precoCreditoImpostos']].mean().reset_index()
    e2 = er.merge(anp, on=['cod', 'vig'], how='left'); e2 = e2[e2.precoAnp.notna()]
    e2['acima'] = ((e2.pl - e2.precoAnp).clip(lower=0) * e2.litros)
    e2['acima_rem'] = ((e2.pl - e2.precoCreditoImpostos).clip(lower=0) * e2.litros)
    au = e2.groupby('cod').agg(lit=('litros', 'sum'), rs=('valor', 'sum'), acima=('acima', 'sum'), acima_rem=('acima_rem', 'sum'), n=('valor', 'count'))
    au['pl'] = au.rs / au.lit; au['anp'] = e2.groupby('cod').apply(lambda x: (x.precoAnp * x.litros).sum() / x.litros.sum())
    au['lit_acima_pct'] = e2.groupby('cod').apply(lambda x: x.litros[x.pl > x.precoAnp].sum() / x.litros.sum() * 100)
    out['anp'] = {u: {'lit': R0(r.lit), 'pl': R2(r.pl), 'anp': R2(r.anp), 'acima': R0(r.acima), 'lit_acima_pct': R0(r.lit_acima_pct), 'n': int(r.n)} for u, r in au.iterrows()} | {'_tot': R0(au.acima.sum())}
except Exception as e:
    out['anp'] = {'_erro': str(e)[:120]}

# ── 4) contrato VW × FT placa a placa (quem custa mais que o pago) ──
jp = jv.groupby('pl').agg(uni=('cod', 'last'), km=('kmv', 'sum'), fat=('fat', 'sum'), ft=('ft', 'sum'), meses=('vig', 'nunique'), regra=('regra', 'last'))
jp['dif'] = jp.fat - jp.ft; jp = jp.sort_values('dif', ascending=False)
out['vw_placa'] = {'placas': int(len(jp)), 'acima': int((jp.dif > 0).sum()), 'dif_acima': R0(jp.dif[jp.dif > 0].sum()), 'dif_total': R0(jp.dif.sum()),
                   'top': [[p, r.uni, R0(r.km), R3(r.fat / r.km) if r.km else 0, R3(r.ft / r.km) if r.km else 0, R0(r.dif), str(r.regra)] for p, r in jp.head(10).iterrows()],
                   'uni': {u: {'placas': int(len(x)), 'fat': R0(x.fat.sum()), 'ft': R0(x.ft.sum()), 'dif': R0(x.dif.sum())} for u, x in jp.groupby('uni')}}

# ── 5) manutenção da DRE por conta e mês (o que a oficina faz mês a mês) e "porquê" do remunerado acima do FT ──
d = dre(); d = per(d[d.proj.isin(T2)])
CTA = {'Contratos de Manutenção Fabricante': 'contrato', 'Manutenção de Veículos e Equipamentos': 'oficina', 'Personalização e Padronização de Veículos': 'personaliz',
       'Personalização/Padronização de Veículos': 'personaliz', 'Materiais e Ferramentas de Oficina': 'materiais', 'Pneus Novos': 'pneu_novo', 'Recapagens e Outros Serviços': 'recap',
       'Consertos e Recapagens de Pneus': 'recap', 'Combustíveis': 'diesel', 'Combustíveis Veiculos e Equipamentos': 'diesel', 'Arla': 'arla', 'Fluídos (Arla)': 'arla',
       'Lavação de Veículos': 'lav', 'Seguro de Veículos e Equipamentos': 'seguro', 'ICMS Crédito Presumido': 'icms', 'Estorno de ICMS não Aproveitado': 'icms', 'Manutenção de Carrocerias': 'carr', 'IPVA e Licenciamento de Veículos': 'ipva'}
d['ct'] = d['CONTA GERENCIAL'].map(CTA).fillna('outro')
cm = d.groupby(['vig', 'ct'])[['rem', 'real']].sum().unstack('ct').fillna(0)
out['dre_mes'] = {'vig': list(cm.index)} | {f'{c}_{k}': [R0(x) for x in cm[k].get(c, pd.Series(0, index=cm.index))] for c in ['contrato', 'oficina', 'materiais', 'personaliz', 'pneu_novo', 'recap', 'diesel', 'arla', 'lav', 'seguro', 'icms', 'carr', 'ipva'] for k in ['rem', 'real']}
# candidatos para o remunerado de manutenção lançado na DRE, por unidade × mês:
#  (a) pago FT (Manutenção R$/KM × km pago)  (b) teto (Manutenção R$/KM × km da placa × ativos)  (c) contrato da placa (R$/KM × km pago)  (d) contrato × km teto
cu = cam.copy(); cu['km_t'] = cu['KM Mês Roadshow'].fillna(0) / 2
cu['ft_t'] = cu['Manutenção R$/KM'].fillna(0) * cu.km_t; cu['ctr_t'] = cu['R$/KM'].fillna(0) * cu.km_t
tt = cu.groupby(['cod', 'vig'])[['ft_t', 'ctr_t', 'km_t']].sum()
Fm = Fp.groupby(['cod', 'vig'])[['manut_pago', 'manut', 'Km Rem. TT', 'kmtot']].sum()
dm = d[d.ct.isin(['contrato', 'oficina', 'materiais', 'personaliz'])].groupby(['cod', 'vig'])[['rem', 'real']].sum()
X = Fm.join(tt, how='left').join(dm, how='inner').fillna(0)
X['ctr_pago'] = X.ctr_t * (X['Km Rem. TT'] / X.km_t.replace(0, np.nan)).fillna(0)
cand = {'pago FT (Manutenção R$/KM × km pago)': 'manut_pago', 'teto FT (Manutenção R$/KM × km da placa × ativos)': 'ft_t', 'contrato da placa (R$/KM) × km pago': 'ctr_pago', 'contrato da placa (R$/KM) × km da placa × ativos': 'ctr_t'}
out['rem_manut_porque'] = {k: {'soma': R0(X[c].sum()), 'razao': R3(X.rem.sum() / X[c].sum()) if X[c].sum() else None, 'r': R3(X.rem.corr(X[c])) if X[c].std() else None,
                               'erro_med_pct': R0(((X.rem - X[c]).abs() / X.rem.replace(0, np.nan)).median() * 100)} for k, c in cand.items()} | {'rem_dre': R0(X.rem.sum()), 'real_dre': R0(X.real.sum())}
Xm = X.groupby(level='vig').sum()
out['rem_manut_mes'] = {'vig': list(Xm.index), 'rem': [R0(x) for x in Xm.rem], 'pago': [R0(x) for x in Xm.manut_pago], 'teto': [R0(x) for x in Xm.ft_t], 'ctr_pago': [R0(x) for x in Xm.ctr_pago], 'real': [R0(x) for x in Xm.real]}
Xu = X.groupby(level='cod').sum()
out['rem_manut_uni'] = {u: {'rem': R0(r.rem), 'pago': R0(r.manut_pago), 'teto': R0(r.ft_t), 'ctr_pago': R0(r.ctr_pago), 'real': R0(r.real)} for u, r in Xu.iterrows()}
# pneu: remunerado DRE × pago × teto por mês
pn = d[d.ct.isin(['pneu_novo', 'recap'])].groupby('vig')[['rem', 'real']].sum()
Fpn = Fp.groupby('vig')[['pneu_pago', 'pneu']].sum().join(pn, how='inner').fillna(0)
out['rem_pneu_mes'] = {'vig': list(Fpn.index), 'rem': [R0(x) for x in Fpn.rem], 'pago': [R0(x) for x in Fpn.pneu_pago], 'teto': [R0(x) for x in Fpn.pneu], 'real': [R0(x) for x in Fpn.real]}
# combustível: remunerado DRE × pago × teto × abastecido por mês
cbm = d[d.ct.isin(['diesel', 'arla'])].groupby('vig')[['rem', 'real']].sum()
Fcb = Fp.groupby('vig')[['comb_pago', 'comb']].sum().join(cbm, how='inner').join(B.groupby(level='vig')[['rs', 'lit', 'lit_esp', 'km']].sum(), how='left').fillna(0)
out['comb_mes'] = {'vig': list(Fcb.index), 'rem': [R0(x) for x in Fcb.rem], 'pago': [R0(x) for x in Fcb.comb_pago], 'teto': [R0(x) for x in Fcb.comb], 'real': [R0(x) for x in Fcb.real], 'abastecido': [R0(x) for x in Fcb.rs], 'lit': [R0(x) for x in Fcb.lit], 'lit_esp': [R0(x) for x in Fcb.lit_esp]}
# seguro e ICMS, lavagem AS: o que a DRE tem e o FT não (ou o contrário)
out['contas_fora'] = {'seguro': {'ft': R0(Fp.seguro.sum()), 'rem': R0(d[d.ct == 'seguro'].rem.sum()), 'real': R0(d[d.ct == 'seguro'].real.sum())},
                      'icms': {'rem': R0(d[d.ct == 'icms'].rem.sum()), 'real': R0(d[d.ct == 'icms'].real.sum())},
                      'arla': {'rem': R0(d[d.ct == 'arla'].rem.sum()), 'real': R0(d[d.ct == 'arla'].real.sum())},
                      'outro': {'rem': R0(d[d.ct == 'outro'].rem.sum()), 'real': R0(d[d.ct == 'outro'].real.sum()), 'contas': d[d.ct == 'outro'].groupby('CONTA GERENCIAL').real.sum().sort_values(ascending=False).head(8).round(0).to_dict()},
                      'finame_ft': R0(Fp.finame.sum()), 'fixo_at': R0(Fp.fixo_at.sum()), 'fixo_par': R0(Fp.fixo_par.sum())}

# ── 6) manutenção: meses fora da curva, unidade × mês (realizado ÷ pago) ──
mu = d[d.ct.isin(['contrato', 'oficina', 'materiais', 'personaliz'])].groupby(['cod', 'vig']).real.sum().unstack('vig').fillna(0)
pu = Fp.groupby(['cod', 'vig']).manut_pago.sum().unstack('vig').fillna(0)
rat = (mu / pu.replace(0, np.nan)).round(2)
out['manut_ratio'] = {'vig': list(rat.columns), 'uni': {u: [None if pd.isna(x) else float(x) for x in r] for u, r in rat.iterrows()}}
out['manut_mes_top'] = [[u, v, R0(mu.loc[u, v]), R0(pu.loc[u, v])] for u in mu.index for v in mu.columns if pu.loc[u, v] > 0 and mu.loc[u, v] / pu.loc[u, v] > 2.5][:12]

# ── 7) Km/L: placas 15% abaixo, por unidade (lista das piores com modelo), e mesmo modelo com valores diferentes ──
kp = kl[(kl.km > 0) & (kl.lit > 0)].groupby(['cod', 'pl']).agg(km=('km', 'sum'), lit=('lit', 'sum'), kmlr=('kmlr', 'mean'), plr=('plr', 'mean')).reset_index()
kp = kp[(kp.km >= 3000) & (kp.kmlr > 0)]; kp['kml'] = kp.km / kp.lit; kp['gap'] = kp.kml / kp.kmlr - 1; kp['lit_extra'] = kp.lit - kp.km / kp.kmlr; kp['rs_extra'] = kp.lit_extra * kp.plr
kp = kp.merge(st.groupby('pl').modelo.last().reset_index(), on='pl', how='left')
ruim = kp[kp.gap < -0.15].sort_values('rs_extra', ascending=False)
out['kml_ruim'] = {'placas': int(len(ruim)), 'de': int(len(kp)), 'lit': R0(ruim.lit_extra.sum()), 'rs': R0(ruim.rs_extra.sum()), 'km_pct': R2(ruim.km.sum() / kp.km.sum() * 100),
                   'top': [[r.pl, r.cod, str(r.modelo)[:26], R2(r.kml), R2(r.kmlr), R0(r.km), R0(r.lit_extra), R0(r.rs_extra)] for _, r in ruim.head(12).iterrows()],
                   'uni': {u: {'placas': int(len(x)), 'rs': R0(x.rs_extra.sum()), 'lit': R0(x.lit_extra.sum())} for u, x in ruim.groupby('cod')}}

# ── 8) FINAME que termina, frota quitada parada, fixo do parado por unidade ──
ul = cam.sort_values('vig').groupby('pl').last(); ul['st'] = ul.statusFinanciamentoShared.astype(str).str.replace('Descrição: ', '')
q = ul[ul.st == 'QUITADO']
out['quitado'] = {'placas': int(len(q)), 'ativas': int(q.Ativo.astype(str).str.lower().eq('true').sum()), 'fixo_med': R0(q['Total Custo Fixo'].median()), 'idade_med': R0(q.manutencaoVidaMeses.median()),
                  'rk_med': R2(q['Total Custo Variável'].median())}
out['fixo_par_uni'] = {u: {'ativos': R2(x.ativos.sum() / nm), 'parados': R2(x.parados.sum() / nm), 'fixo_par': R0(x.fixo_par.sum()), 'fixo_at': R0(x.fixo_at.sum())} for u, x in per(F[F.proj != 'AUTO SERVIÇO']).groupby('cod')}

# ── 9) síntese: valor por classe (erro · gap · oportunidade · discrepante) ──
json.dump(out, open(f'analise2-{ROT}.json', 'w'), ensure_ascii=False, indent=1, default=float)
print(json.dumps({k: out[k] for k in ['km_tot', 'inativas', 'vw_placa', 'rem_manut_porque', 'kml_ruim', 'quitado']}, ensure_ascii=False, default=float)[:4000])
print('anp', json.dumps(out['anp'], ensure_ascii=False)[:800])
