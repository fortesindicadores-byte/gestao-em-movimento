# ============================================================
# Análise completa do Freightech × nossa DRE (frota), por período.
# Lê os parquet (load.py/sh.py) e o dump das tabelas do portal (D2) e grava
# completa-<ROTULO>.json. Só este código vai para o repositório.
#   INI=2026-01 FIM=2026-09 ROTULO=2026 D2=../dump2 python3 completa.py
# Regras do FT conferidas nos dados (ver CLAUDE.md, seção Freightech):
#  · variável da placa = Consumo R$/KM + Manutenção R$/KM + Manutenção Carroceria R$/KM + Pneu por KM
#    (o campo "R$/KM" é o contrato da placa e NÃO entra no pagamento);
#  · Resumo da Rota: cada quinzena repete o valor do mês (mês = média das quinzenas);
#  · teto do variável = R$/km × km da placa × ativos; o pago = R$/km × km da Dispersão (mapas rodados).
# ============================================================
import os, json, gzip
from comum import *
INI = os.environ.get('INI', '2026-01'); FIM = os.environ.get('FIM', '2026-09'); ROT = os.environ.get('ROTULO', INI[:4])
D2 = os.environ.get('D2', '../dump2')
def tb(n): return pd.DataFrame([json.loads(l) for l in gzip.open(f'{D2}/tb-{n}.ndjson.gz', 'rt') if l.strip()])
def vigcol(d): return d._ano.astype(str) + '-' + d._mes.astype(str).str.zfill(2)
def per(df, col='vig'): return df[(df[col] >= INI) & (df[col] <= FIM)]
def merc(p):
    p = str(p or '').upper().replace('-', '').strip()
    if len(p) == 7 and p[4].isdigit(): p = p[:4] + 'ABCDEFGHIJ'[int(p[4])] + p[5:]
    return p
R0 = lambda v: round(float(v), 0)
out = {'INI': INI, 'FIM': FIM, 'ROT': ROT}
T2 = ['ROTA', 'ROTA (VAN)', 'UDC', 'AUTO SERVIÇO']

# ── 1) FT do T2 por unidade × mês: peças do variável (teto) e fixo de frota ──
rs = resumo_rota()
rs['proj'] = np.where(rs.tipo == 'VAN', 'ROTA (VAN)', np.where(rs['Unidade - Nome'] == 'UDC GUARULHOS', 'UDC', 'ROTA'))
v = ft('ROTA', 'ResumoVan').rename(columns={'seguro': 'Seguro', 'seguroParado': 'Seguro Parado', 'finameModeloNovo': 'FINAME Modelo Novo',
     'finameModeloNovoParado': 'FINAME Modelo Novo Parado', 'rastreador': 'Rastreador', 'totalFrotaAtiva': 'Total Frota Ativa', 'totalFrotaParada': 'Total Frota Parada'})
n, np_ = rs['Total Caminhão Ativo'], rs['Total Caminhão Parado']
rs['carr'] = rs['Manutenção Carroceria R$/KM'] * rs['KM Remunerado'] * n
rs['manut'] = rs['Manutenção Caminhão R$/KM'] * rs['KM Remunerado'] * n          # resumo_rota() juntava a carroceria
rs['seguro'] = rs['Seguro'].fillna(0) * n + rs['Seguro Parado'].fillna(0) * np_
rs['finame'] = rs['FINAME Modelo Novo'].fillna(0) * n + rs['FINAME Modelo Novo Parado'].fillna(0) * np_
rs['fixo_at'] = rs['Total Frota Ativa']; rs['fixo_par'] = rs['Total Frota Parada']
rs['ativos'] = n; rs['parados'] = np_
C = ['comb', 'manut', 'carr', 'pneu', 'kmtot', 'lav', 'ipva', 'seguro', 'finame', 'fixo_at', 'fixo_par', 'ativos', 'parados', 'Total Viagens',
     'Total Equipe Entrega', 'Total QLP ADM', 'Total Outras Despesas']
fr = rs.groupby(['proj', 'cod', 'vig', '_qz'])[C].sum().groupby(['proj', 'cod', 'vig']).mean().reset_index()
# AS placa a placa: o variável é R$/km × km da placa ativa; lavagem é por km; o fixo vem da própria placa
s = ft('AS', 'CaminhaoAS'); s['cod'] = s['Unidade - Nome'].map(FTU).fillna('GNA'); s['vig'] = vigcol(s)
sa = s[s.Ativo == True].copy(); km = sa['KM Mês Roadshow'].fillna(0)
sa['comb'] = sa['Consumo R$/KM'] * km; sa['manut'] = sa['Manutenção R$/KM'] * km; sa['carr'] = sa['Manutenção Carroceria R$/KM'] * km
sa['pneu'] = sa['Pneu por KM'] * km; sa['kmtot'] = km; sa['lav'] = sa['Lavagem por KM'].fillna(0) * km
sa['ipva'] = sa['IPVA Licenciamento'].fillna(0); sa['seguro'] = sa['Seguro'].fillna(0); sa['finame'] = sa['FINAME Modelo Novo'].fillna(0)
sa['fixo_at'] = sa['Total Custo Fixo'].fillna(0); sa['ativos'] = 1; sa['proj'] = 'AUTO SERVIÇO'
fa = sa.groupby(['proj', 'cod', 'vig', '_qz'])[[c for c in C if c in sa.columns]].sum().groupby(['proj', 'cod', 'vig']).mean().reset_index()
F = pd.concat([fr, fa], ignore_index=True).fillna(0)

# km pago (mapas rodados) e km rodado: Dispersão de km
dp = sh('dispersao_km'); dp['vig'] = pd.to_datetime(dp['Vigência'], errors='coerce').dt.strftime('%Y-%m')
dp['proj'] = dp['PROJ.'].astype(str).str.split(' - ').str[0].str.strip(); dp['cod'] = dp['PROJ.'].astype(str).str.split(' - ').str[-1].str.strip()
dk = dp.groupby(['proj', 'cod', 'vig'])[['Km Rem. TT', 'Km Rodado TT', 'Frota Ativa', 'Viagens - Real']].sum().reset_index()
F = F.merge(dk, on=['proj', 'cod', 'vig'], how='left')
F['rat'] = (F['Km Rem. TT'] / F.kmtot).where(F.kmtot > 0)
VAR = ['comb', 'manut', 'carr', 'pneu']
for c in VAR: F[c + '_pago'] = F[c] * F.rat
Fp = per(F)
out['t2_teto'] = {c: R0(Fp[c].sum()) for c in VAR + ['kmtot']}
out['t2_pago'] = {c: R0(Fp[c + '_pago'].sum()) for c in VAR} | {'km': R0(Fp['Km Rem. TT'].sum()), 'rodado': R0(Fp['Km Rodado TT'].sum())}
out['t2_fixo'] = {c: R0(Fp[c].sum()) for c in ['lav', 'ipva', 'seguro', 'finame', 'fixo_at', 'fixo_par', 'Total Equipe Entrega', 'Total QLP ADM', 'Total Outras Despesas']}
out['t2_frota'] = {'ativos_mes': round(float(Fp.groupby('vig').ativos.sum().mean()), 1), 'parados_mes': round(float(Fp.groupby('vig').parados.sum().mean()), 1)}

# ── 2) DRE do T2 (remunerado do planejamento e realizado), por peça ──
d = dre()
PAC2 = {'Combustíveis': 'comb', 'Arla': 'comb', 'Manutenção de Veículos e Equipamentos': 'manut', 'Contratos de Manutenção Fabricante': 'manut',
        'Materiais e Ferramentas de Oficina': 'manut', 'Personalização e Padronização de Veículos': 'manut', 'Manutenção de Carrocerias': 'carr',
        'Pneus Novos': 'pneu', 'Recapagens e Outros Serviços': 'pneu', 'Lavação de Veículos': 'lav', 'IPVA e Licenciamento de Veículos': 'ipva',
        'Seguro de Veículos e Equipamentos': 'seguro', 'ICMS Crédito Presumido': 'icms', 'Estorno de ICMS não Aproveitado': 'icms'}
d['p2'] = d['CONTA GERENCIAL'].map(PAC2).fillna('outro')
dt = per(d[d.proj.isin(T2)])
G = dt.groupby(['cod', 'vig', 'p2'])[['rem', 'real']].sum().unstack('p2').fillna(0)
P = ['comb', 'manut', 'carr', 'pneu', 'lav', 'ipva', 'seguro']
Fu = Fp.groupby(['cod', 'vig'])[[c + '_pago' for c in VAR] + ['lav', 'ipva', 'seguro']].sum()
Fu.columns = [c.replace('_pago', '') for c in Fu.columns]
J = Fu.join(G['rem'].add_suffix('_rem'), how='inner').join(G['real'].add_suffix('_real'), how='left').fillna(0)
out['peca'] = {c: {'ft': R0(J[c].sum()), 'rem': R0(J.get(c + '_rem', pd.Series(0)).sum()), 'real': R0(J.get(c + '_real', pd.Series(0)).sum())} for c in P}
out['icms'] = {'rem': R0(G['rem'].get('icms', pd.Series(0)).sum()), 'real': R0(G['real'].get('icms', pd.Series(0)).sum())}
cu = J.groupby(level='cod').sum()
out['peca_uni'] = {u: {c: {'ft': R0(cu.loc[u, c]), 'rem': R0(cu.loc[u].get(c + '_rem', 0)), 'real': R0(cu.loc[u].get(c + '_real', 0))} for c in P} for u in cu.index}
cm = J.groupby(level='vig').sum()
out['peca_mes'] = {'vig': list(cm.index)} | {f'{c}_{k}': [R0(x) for x in cm.get(f'{c}{"" if k == "ft" else "_" + k}', pd.Series(0, index=cm.index))] for c in P for k in ['ft', 'rem', 'real']}

# ── 3) combustível: ponte do pago ao real (km · eficiência · preço · base) ──
kl = sh('consumo_km_litro'); kl['vig'] = pd.to_datetime(kl['Vigência'], errors='coerce').dt.strftime('%Y-%m')
kl['proj'] = kl.Projeto.astype(str).str.split(' - ').str[0].str.strip().replace({'VAN': 'ROTA (VAN)'}); kl['cod'] = kl.Projeto.astype(str).str.split(' - ').str[-1].str.strip().replace({'GOI': 'GNA'})
kl = per(kl[kl.proj.isin(T2)]).copy()
kl['km'] = pd.to_numeric(kl['KM Rodado / Horas trabalhadas'], errors='coerce').fillna(0); kl['lit'] = pd.to_numeric(kl['QTD Total de Litros'], errors='coerce').fillna(0)
kl['rs'] = pd.to_numeric(kl['TOTAS R$'], errors='coerce').fillna(0); kl['kmlr'] = pd.to_numeric(kl['KM/l Rem Médio'], errors='coerce'); kl['plr'] = pd.to_numeric(kl['R$/L Rem'], errors='coerce')
kl['lit_esp'] = (kl.km / kl.kmlr).where(kl.kmlr > 0, kl.lit)
kl['ef'] = (kl.lit - kl.lit_esp) * kl.plr.fillna(kl.rs / kl.lit.replace(0, np.nan))
kl['pr'] = (kl.rs / kl.lit.replace(0, np.nan) - kl.plr).fillna(0) * kl.lit
kc = kl.groupby(['cod', 'vig'])[['km', 'lit', 'rs', 'lit_esp', 'ef', 'pr']].sum()
B = Fp.groupby(['cod', 'vig'])[['comb_pago', 'comb', 'Km Rem. TT', 'Km Rodado TT', 'kmtot']].sum().join(kc, how='inner')
B['rk'] = B.comb / B.kmtot
B['km_ef'] = (B['Km Rodado TT'] - B['Km Rem. TT']) * B.rk
B = B.join(G['real']['comb'].rename('dre_real'), how='left').fillna(0)
B['base'] = B.dre_real - (B.comb_pago + B.km_ef + B.ef + B.pr)
out['comb_ponte'] = {k: R0(B[k].sum()) for k in ['comb_pago', 'km_ef', 'ef', 'pr', 'base', 'dre_real', 'rs', 'lit', 'lit_esp', 'km']}
bu = B.groupby(level='cod').sum()
out['comb_ponte_uni'] = {u: {k: R0(bu.loc[u, k]) for k in ['comb_pago', 'km_ef', 'ef', 'pr', 'base', 'dre_real', 'lit', 'lit_esp', 'km', 'Km Rem. TT', 'Km Rodado TT']} for u in bu.index}

# ── 4) manutenção: o que o FT paga, por regra, e o que gastamos ──
cam = ft('ROTA', 'Caminhao'); cam['vig'] = vigcol(cam); cam = per(cam[cam.Ativo == True]).copy(); cam['cod'] = cam['Unidade - Nome'].map(FTU)
cam['regra'] = np.select([cam.manutencaoVidaMeses <= cam.manutencaoFreeMaintenance, cam['Manutenção R$/KM'].fillna(0) == 0,
                          cam.manutencaoBid.fillna(0) > 0], ['carência', 'zero fora da carência', 'BID da montadora'], 'tabela por idade')
cam['km'] = cam['KM Mês Roadshow'].fillna(0) / 2; cam['pago'] = cam['Manutenção R$/KM'].fillna(0) * cam.km
cam['contrato'] = cam.manutencaoContrato.fillna(0) > 0
mr = cam.groupby('regra').agg(pq=('Placa', 'count'), placas=('Placa', 'nunique'), km=('km', 'sum'), pago=('pago', 'sum'), vida=('manutencaoVidaMeses', 'median'))
out['manut_regra'] = {r: {'placas': int(x.placas), 'km': R0(x.km), 'pago': R0(x.pago), 'rk': round(float(x.pago / x.km), 3) if x.km else 0, 'vida': round(float(x.vida), 1)} for r, x in mr.iterrows()}
cam['faixa'] = pd.cut(cam.manutencaoVidaMeses, [-1, 6, 24, 48, 72, 1e9], labels=['0–6', '7–24', '25–48', '49–72', '73+'])
mf = cam.groupby('faixa', observed=False).agg(placas=('Placa', 'nunique'), km=('km', 'sum'), pago=('pago', 'sum'), ct=('contrato', 'mean'))
out['manut_idade'] = {str(f): {'placas': int(x.placas), 'rk': round(float(x.pago / x.km), 3) if x.km else 0, 'contrato': round(float(x.ct * 100), 0)} for f, x in mf.iterrows()}
vw = tb('vw_contrato_km'); vw['pl'] = vw.placa.map(merc)
vwp = per(vw[vw.pl != ''].rename(columns={'vigencia': 'vig'})).groupby(['pl', 'vig']).agg(kmv=('km_rodado', 'sum'), fat=('valor', 'sum')).reset_index()
cam['pl'] = cam.Placa.map(merc)
pm = cam.groupby(['pl', 'vig']).agg(mk=('Manutenção R$/KM', 'mean'), cod=('cod', 'last'), regra=('regra', 'last')).reset_index()
jv = vwp.merge(pm, on=['pl', 'vig']); jv['ft'] = jv.mk * jv.kmv
out['vw'] = {'placas': int(jv.pl.nunique()), 'km': R0(jv.kmv.sum()), 'fatura': R0(jv.fat.sum()), 'ft': R0(jv.ft.sum()),
             'rk_vw': round(float(jv.fat.sum() / jv.kmv.sum()), 3) if len(jv) else 0, 'rk_ft': round(float(jv.ft.sum() / jv.kmv.sum()), 3) if len(jv) else 0,
             'uni': {u: {'placas': int(g.pl.nunique()), 'fatura': R0(g.fat.sum()), 'ft': R0(g.ft.sum())} for u, g in jv.groupby('cod')}}

# ── 5) pneus: premissas do FT × nossas compras ──
cam['med'] = cam['Medida Pneu'].astype(str).str.extract(r'(\d{3})')[0]
pf = cam.groupby('med').agg(placas=('Placa', 'nunique'), tracao=('Preço Tração', 'median'), liso=('Preço Liso', 'median'), recap=('Preço Recapagem', 'median'),
                            vida=('Vida Pneus KM', 'median'), qtd=('Quantidade de Pneus', 'median'), nrec=('Quantidade de Recapagem', 'median'), rk=('Pneu por KM', 'median'))
pp = tb('pneu_preco'); pp = pp[pp.ativo == True]; pc = pp.groupby('medida').valor.agg(['min', 'median', 'max'])
out['pneu'] = {m: {k: (round(float(x[k]), 2) if pd.notna(x[k]) else None) for k in pf.columns} | ({'compra_min': R0(pc.loc[m, 'min']), 'compra_med': R0(pc.loc[m, 'median'])} if m in pc.index else {})
               for m, x in pf.iterrows() if pd.notna(m)}

# ── 6) frota e fixo: status de financiamento, FINAME que termina, parados ──
ul = cam.sort_values('vig').groupby('pl').last()
ul['st'] = ul.statusFinanciamentoShared.astype(str).str.replace('Descrição: ', '')
out['frota_status'] = {s: {'placas': int(len(g)), 'fixo_med': R0(g['Total Custo Fixo'].median()), 'finame_med': R0(g['FINAME Modelo Novo'].median()), 'idade': round(float(g.manutencaoVidaMeses.median()), 0)}
                      for s, g in ul.groupby('st')}
ul['par_rest'] = (ul['Período FINAME'].fillna(0) - ul['Mês da Parcela'].fillna(0)).clip(lower=0)
fn = ul[(ul['FINAME Modelo Novo'] > 0)]
out['finame_fim'] = {k: {'placas': int(len(g)), 'finame_mes': R0(g['FINAME Modelo Novo'].sum())} for k, g in fn.groupby(pd.cut(fn.par_rest, [-1, 6, 12, 24, 36, 1e9], labels=['até 6', '7–12', '13–24', '25–36', '37+']), observed=False)}
out['locadora'] = {str(k).replace('EmpresaLocadora: ', ''): int(g) for k, g in ul['Empresa locadora'].value_counts().items()}

# ── 7) ponte do variável (teto) do 1º ao último mês do período: frota · km por placa · R$/km ──
mm = F[F.proj != 'AUTO SERVIÇO'].groupby('vig')[VAR + ['kmtot', 'ativos']].sum()
mm = mm[(mm.index >= INI) & (mm.index <= FIM)]
if len(mm) > 1:
    a, b = mm.iloc[0], mm.iloc[-1]; va, vb = a[VAR].sum(), b[VAR].sum()
    kpa, kpb = a.kmtot / a.ativos, b.kmtot / b.ativos; rka, rkb = va / a.kmtot, vb / b.kmtot
    out['ponte_var'] = {'de': mm.index[0], 'ate': mm.index[-1], 'ini': R0(va), 'fim': R0(vb), 'frota': R0((b.ativos - a.ativos) * kpa * rka),
                        'kmplaca': R0(b.ativos * (kpb - kpa) * rka), 'rskm': R0(b.kmtot * (rkb - rka)),
                        'pecas': {c: R0(b.kmtot * (b[c] / b.kmtot - a[c] / a.kmtot)) for c in VAR}}

json.dump(out, open(f'completa-{ROT}.json', 'w'), ensure_ascii=False, indent=1, default=float)
pd.to_pickle({'F': F, 'J': J, 'B': B, 'cam': cam, 'jv': jv}, f'completa-{ROT}.pkl')
print(json.dumps(out, ensure_ascii=False, default=float)[:5000])
