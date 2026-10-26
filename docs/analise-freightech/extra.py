# Cruzamentos por unidade que a análise usa nas conclusões (lê o pkl do completa.py).
#   INI=2026-01 FIM=2026-08 ROTULO=2026 python3 extra.py  → extra-2026.json
import os, json
from comum import *
INI = os.environ.get('INI', '2026-01'); FIM = os.environ.get('FIM', '2026-08'); ROT = os.environ.get('ROTULO', '2026')
S = pd.read_pickle(f'completa-{ROT}.pkl'); cam, J, B, F, jv = S['cam'], S['J'], S['B'], S['F'], S['jv']
def per(df, col='vig'): return df[(df[col] >= INI) & (df[col] <= FIM)]
R0 = lambda v: round(float(v), 0)
out = {}
d = dre(); d = per(d[d.proj.isin(['ROTA', 'ROTA (VAN)', 'UDC', 'AUTO SERVIÇO'])])

# 1) manutenção por unidade: frota, idade, carência, contrato, pago FT, DRE por conta, VW
cam = cam[cam.vig <= FIM]
CTA = {'Contratos de Manutenção Fabricante': 'contrato', 'Manutenção de Veículos e Equipamentos': 'oficina', 'Personalização e Padronização de Veículos': 'personaliz',
       'Personalização/Padronização de Veículos': 'personaliz', 'Materiais e Ferramentas de Oficina': 'materiais'}
dm = d[d['CONTA GERENCIAL'].isin(CTA)].copy(); dm['ct'] = dm['CONTA GERENCIAL'].map(CTA)
mu = {}
for u, g in cam.groupby('cod'):
    ul = g.sort_values('vig').groupby('pl').last()
    dg = dm[dm.cod == u].groupby('ct')[['rem', 'real']].sum()
    mu[u] = {'placas': int(len(ul)), 'vida_med': round(float(ul.manutencaoVidaMeses.median()), 0), 'carencia_km_pct': round(float(g[g.regra == 'carência'].km.sum() / g.km.sum() * 100), 0) if g.km.sum() else 0,
             'contrato_pct': round(float(ul.contrato.mean() * 100), 0), 'bid_pct': round(float((ul.regra == 'BID da montadora').mean() * 100), 0),
             'rk_ft': round(float(g.pago.sum() / g.km.sum()), 3) if g.km.sum() else 0, 'km_ft': R0(g.km.sum()), 'pago_ft': R0(g.pago.sum()),
             'dre': {c: {'rem': R0(dg.loc[c, 'rem']) if c in dg.index else 0, 'real': R0(dg.loc[c, 'real']) if c in dg.index else 0} for c in ['contrato', 'oficina', 'personaliz', 'materiais']},
             'real_placa_mes': R0(dg.real.sum() / len(ul) / cam[cam.cod == u].vig.nunique()) if len(ul) else 0}
out['manut_uni'] = mu
# contas de manutenção da DRE (total T2)
dt = dm.groupby('ct')[['rem', 'real']].sum()
out['manut_contas'] = {c: {'rem': R0(dt.loc[c, 'rem']), 'real': R0(dt.loc[c, 'real'])} for c in dt.index}
# manutenção real por mês (volatilidade) e por placa: top placas pela DRE não existe (DRE é por projeto); usa a Carta? não disponível aqui.

# 2) saldo por unidade (todas as contas): real − ft e rem − ft
P = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro']
cu = J.groupby(level='cod').sum()
out['saldo_uni'] = {u: {'ft': R0(sum(cu.loc[u, c] for c in P)), 'rem': R0(sum(cu.loc[u].get(c + '_rem', 0) for c in P)), 'real': R0(sum(cu.loc[u].get(c + '_real', 0) for c in P))} for u in cu.index}
# saldo por mês
cm = J.groupby(level='vig').sum()
out['saldo_mes'] = {v: {'ft': R0(sum(cm.loc[v, c] for c in P)), 'real': R0(sum(cm.loc[v].get(c + '_real', 0) for c in P)), 'rem': R0(sum(cm.loc[v].get(c + '_rem', 0) for c in P))} for v in cm.index}

# 3) combustível por unidade: Km/L real × previsto, R$/L real × rem, litros, km, e a dispersão (rodado/pago)
bu = B.groupby(level='cod').sum()
kl = sh('consumo_km_litro'); kl['vig'] = pd.to_datetime(kl['Vigência'], errors='coerce').dt.strftime('%Y-%m')
kl['cod'] = kl.Projeto.astype(str).str.split(' - ').str[-1].str.strip().replace({'GOI': 'GNA'}); kl['proj'] = kl.Projeto.astype(str).str.split(' - ').str[0].str.strip().replace({'VAN': 'ROTA (VAN)'})
kl = per(kl[kl.proj.isin(['ROTA', 'ROTA (VAN)', 'UDC', 'AUTO SERVIÇO'])]).copy()
for c, s in [('km', 'KM Rodado / Horas trabalhadas'), ('lit', 'QTD Total de Litros'), ('rs', 'TOTAS R$'), ('plr', 'R$/L Rem'), ('kmlr', 'KM/l Rem Médio')]: kl[c] = pd.to_numeric(kl[s], errors='coerce')
kl['pl'] = kl.Placa.astype(str).str.upper().str.replace('-', '')
cb = {}
for u, g in kl.groupby('cod'):
    g = g[(g.km > 0) & (g.lit > 0)]
    pm = g.groupby('pl').agg(km=('km', 'sum'), lit=('lit', 'sum'), kmlr=('kmlr', 'mean'))
    pm['kml'] = pm.km / pm.lit; pm['gap'] = pm.kml / pm.kmlr - 1
    pm = pm[pm.km >= 3000]
    pior = pm.sort_values('gap').head(3)
    conc = pm[pm.gap < -0.15]
    cb[u] = {'placas': int(len(pm)), 'placas_abaixo15': int(len(conc)), 'km_abaixo15_pct': round(float(conc.km.sum() / pm.km.sum() * 100), 0) if pm.km.sum() else 0,
             'lit_extra_abaixo15': R0((conc.lit - conc.km / conc.kmlr).sum()), 'pior': [[p, round(float(r.kml), 2), round(float(r.kmlr), 2), R0(r.km)] for p, r in pior.iterrows()],
             'pl_rem': round(float((g.plr * g.lit).sum() / g.lit.sum()), 2) if g.lit.sum() else 0, 'pl_real': round(float(g.rs.sum() / g.lit.sum()), 2) if g.lit.sum() else 0}
out['comb_uni_placa'] = cb

# 4) pneu por unidade: ft × real × rem
out['pneu_uni'] = {u: {'ft': R0(cu.loc[u, 'pneu']), 'rem': R0(cu.loc[u].get('pneu_rem', 0)), 'real': R0(cu.loc[u].get('pneu_real', 0))} for u in cu.index}

# 5) fixo: fixo parado por unidade (Resumo)
fp = per(F[F.proj != 'AUTO SERVIÇO']).groupby('cod')[['fixo_at', 'fixo_par', 'ativos', 'parados']].sum()
nm = per(F).vig.nunique()
out['fixo_uni'] = {u: {'fixo_at': R0(r.fixo_at), 'fixo_par': R0(r.fixo_par), 'ativos': round(float(r.ativos / nm), 1), 'parados': round(float(r.parados / nm), 1)} for u, r in fp.iterrows()}

json.dump(out, open(f'extra-{ROT}.json', 'w'), ensure_ascii=False, indent=1, default=float)
print(json.dumps(out, ensure_ascii=False, default=float)[:6000])
