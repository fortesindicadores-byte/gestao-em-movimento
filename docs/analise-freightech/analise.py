# ============================================================
# Análise do Freightech (remuneração da Ambev) × nossa remuneração
# Lê as tabelas montadas por load.py/sh.py (FT_DIR/pq) e grava dados.json
# com os números do deck. Nada daqui vai para o repositório além do código:
# o dump, os parquet e o dados.json ficam fora (remuneração é sensível).
#   FT_DIR=<pasta com pq/> python3 analise.py
# ============================================================
import os, json, re, pandas as pd, numpy as np
DIR = os.environ.get('FT_DIR', '.')
def ft(c, t): return pd.read_parquet(f'{DIR}/pq/{c}__{t}.parquet')
def sh(s): return pd.read_parquet(f'{DIR}/pq/sh_{s}.parquet')
FTU = {'CDD CAMBORIU':'BLC','CDD CUIABA':'CBA','CDD FLORIANOPOLIS':'FLP','CDD GUARULHOS':'GRL','CDD NOVA FRIBURGO':'NFR','CDD PELOTAS':'PLT','CDD RIO DE JANEIRO':'CGR','CDD RONDONOPOLIS':'RON','MACACU':'MCC','UDC GUARULHOS':'GRL'}
NOME = {'BLC':'Camboriú','CBA':'Cuiabá','FLP':'Florianópolis','GRL':'Guarulhos','NFR':'Nova Friburgo','PLT':'Pelotas','CGR':'Rio de Janeiro','RON':'Rondonópolis','MCC':'Macacu'}
PAC = {'Combustíveis':'comb','Arla':'comb','Manutenção de Veículos e Equipamentos':'manut','Contratos de Manutenção Fabricante':'manut','Manutenção de Carrocerias':'manut','Materiais e Ferramentas de Oficina':'manut','Personalização e Padronização de Veículos':'manut','Pneus Novos':'pneu','Recapagens e Outros Serviços':'pneu','Lavação de Veículos':'lav','IPVA e Licenciamento de Veículos':'ipva','Seguro de Veículos e Equipamentos':'seguro'}
INI, FIM = '2026-01', '2026-09'   # meses fechados na DRE
out = {'INI': INI, 'FIM': FIM, 'NOME': NOME}

def vigcol(d): return d._ano.astype(str)+'-'+d._mes.astype(str).str.zfill(2)

def dre():
    d = sh('dre_frota').copy()
    d['vig'] = pd.to_datetime(d['VIGÊNCIA']).dt.strftime('%Y-%m')
    n3 = d['NÍVEL 3'].str.replace(r'\s*\(INATIVO\)', '', regex=True)
    d['proj'] = n3.str.split(' - ').str[0].str.strip(); d['cod'] = n3.str.split(' - ').str[-1].str.strip()
    d['pac'] = d['CONTA GERENCIAL'].map(PAC).fillna('outro'); d['rem'] = -d['REMUNERADO']
    return d

# ── 1) Resumo Rota (caminhão + van): composição e componentes variáveis ──
r = ft('ROTA', 'Resumo'); v = ft('ROTA', 'ResumoVan')
v = v.rename(columns={'combustivelReaisKm':'Combustível R$/KM','manutencaoCaminhaoReaisKm':'Manutenção Caminhão R$/KM','manutencaoCarroceriaReaisKm':'Manutenção Carroceria R$/KM','pneuReaisKm':'Pneu R$/KM','kmRemunerado':'KM Remunerado','totalCaminhaoAtivo':'Total Caminhão Ativo','totalViagens':'Total Viagens','lavagem':'Lavagem','totalFrotaAtiva':'Total Frota Ativa','totalFrotaParada':'Total Frota Parada','totalEquipeEntrega':'Total Equipe Entrega','totalQlpAdm':'Total QLP ADM','totalOutrasDespesas':'Total Outras Despesas','totalCaminhaoParado':'Total Caminhão Parado','ipvaLicencMensal':'IPVA Licen. Mensal','ipvaLicencMensalParado':'IPVA Licenc. Mensal Parado','totalReaisKm':'Total R$/KM'})
r['tipo'] = 'CAMINHAO'; v['tipo'] = 'VAN'
x = pd.concat([r, v], ignore_index=True)
x['cod'] = x['Unidade - Nome'].map(FTU); x['vig'] = vigcol(x)
n = x['Total Caminhão Ativo']; km = x['KM Remunerado']
x['comb'] = x['Combustível R$/KM']*km*n; x['manut'] = (x['Manutenção Caminhão R$/KM']+x['Manutenção Carroceria R$/KM'])*km*n
x['pneu'] = x['Pneu R$/KM']*km*n; x['lav'] = x['Lavagem']*n
x['ipva'] = x['IPVA Licen. Mensal']*n + x['IPVA Licenc. Mensal Parado']*x['Total Caminhão Parado']
x['kmtot'] = km*n; x['rskm_w'] = x['Total R$/KM']*km*n
# identidades conferidas
rr = x[x.tipo == 'CAMINHAO']
soma = rr[['Combustível R$/KM','Manutenção Caminhão R$/KM','Manutenção Carroceria R$/KM','Pneu R$/KM']].sum(axis=1)
out['ident'] = {
  'rskm_max': float((soma - rr['Total R$/KM']).abs().max()),
  'viagens_med': float((rr['Total R$/KM']*rr['KM Remunerado']*rr['Total Caminhão Ativo'] - rr['Total Viagens']).abs().median()),
  'viagens_p95': float((rr['Total R$/KM']*rr['KM Remunerado']*rr['Total Caminhão Ativo'] - rr['Total Viagens']).abs().quantile(.95)),
  'registros': int(len(rr)),
}
COMP = ['Total Frota Ativa','Total Frota Parada','Total Equipe Entrega','Total QLP ADM','Total Outras Despesas','Total Viagens']
# cada quinzena repete o valor do MÊS: mês = média das duas quinzenas
mes = x.groupby(['vig','_qz'])[COMP].sum().groupby('vig').mean()
mes26 = mes[(mes.index >= INI) & (mes.index <= '2026-10')]
out['comp'] = {'meses': list(mes26.index), 'linhas': {c: [round(float(z), 0) for z in mes26[c]] for c in COMP}}

f = x.groupby(['cod','vig','_qz'])[['comb','manut','pneu','lav','ipva','kmtot','rskm_w','Total Caminhão Ativo']].sum().groupby(['cod','vig']).mean()
f['rskm'] = f.rskm_w/f.kmtot
def per(df, a, b): return df[(df.index.get_level_values('vig') >= a) & (df.index.get_level_values('vig') <= b)]
# AS placa a placa (tabela Caminhão AS): o variável é R$/km × KM Mês da placa ativa
s = ft('AS', 'CaminhaoAS'); s['cod'] = s['Unidade - Nome'].map(FTU).fillna('GNA'); s['vig'] = vigcol(s)
sa = s[s.Ativo == True].copy(); kmc = 'KM Mês Roadshow'
sa['comb'] = sa['Consumo R$/KM']*sa[kmc]; sa['manut'] = (sa['R$/KM']+sa['Manutenção Carroceria R$/KM'])*sa[kmc]; sa['pneu'] = sa['Pneu por KM']*sa[kmc]; sa['kmtot'] = sa[kmc]
fa = sa.groupby(['cod','vig','_qz'])[['comb','manut','pneu','kmtot']].sum().groupby(['cod','vig']).mean()
# placa AS roda mapa de Rota e vice-versa: a comparação é Rota + Van + UDC + AS juntos
d = dre(); dr = d[d.proj.isin(['ROTA','ROTA (VAN)','UDC','AUTO SERVIÇO'])]
g = per(dr.pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0), INI, FIM)
# lavagem e IPVA são por caminhão: o FT só os traz no Resumo da Rota, então a DRE delas é só a da Rota
gr = per(dr[dr.proj != 'AUTO SERVIÇO'].pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0), INI, FIM)
V = ['comb','manut','pneu']
F = per(f[V+['lav','ipva']], INI, FIM).add(per(fa[V], INI, FIM), fill_value=0)
G = g[V].join(gr[['lav','ipva']], how='left').fillna(0)
j = F.join(G.add_suffix('_dre'), how='inner')
tm = j.groupby(level='vig').sum()
out['ftdre_mes'] = {k: [round(float(z), 0) for z in tm[k]] for k in tm.columns}; out['ftdre_mes']['vig'] = list(tm.index)
yu = j.groupby(level='cod').sum()
out['ftdre_uni'] = {c: {k: round(float(yu.loc[c, k]), 0) for k in yu.columns} for c in yu.index}
out['ftdre_canal'] = {nm: {k: round(float(per(FF, INI, FIM)[k].sum()), 0) for k in V} | {k+'_dre': round(float(per(GG, INI, FIM)[k].sum()), 0) for k in V}
                      for nm, FF, GG in [('rota', f, d[d.proj.isin(['ROTA','ROTA (VAN)','UDC'])].pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0)),
                                         ('as', fa, d[d.proj == 'AUTO SERVIÇO'].pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0))]}
cm = dr[(dr['CONTA GERENCIAL'] == 'Contratos de Manutenção Fabricante') & (dr.vig >= '2025-01') & (dr.vig <= FIM)].groupby('vig').rem.sum()
out['dre_contrato'] = {k: round(float(z), 0) for k, z in cm.items()}

# ── 2) km: o km remunerado do FT × o da Dispersão ──
# FT: KM Remunerado (por caminhão, mês) = km por mapa × 25 dias úteis; × caminhões ativos = o teto (1 mapa por dia útil)
# Dispersão: Km Rem. TT = km/viagem × viagens realizadas (+ recargas e noturnas) = o que foi pago
dp = sh('dispersao_km'); dp['vig'] = pd.to_datetime(dp['Vigência'], errors='coerce').dt.strftime('%Y-%m')
dp['proj'] = dp['PROJ.'].astype(str).str.split(' - ').str[0].str.strip(); dp['cod'] = dp['PROJ.'].astype(str).str.split(' - ').str[-1].str.strip()
x['dproj'] = np.where(x.tipo == 'VAN', 'ROTA (VAN)', np.where(x['Unidade - Nome'] == 'UDC GUARULHOS', 'UDC', 'ROTA'))
gp = x.groupby(['dproj','cod','vig','_qz']).agg(n=('Total Caminhão Ativo','sum'), km=('kmtot','sum')).groupby(['dproj','cod','vig']).mean()
sa['dproj'] = 'AUTO SERVIÇO'
ga2 = sa.groupby(['dproj','cod','vig','_qz']).agg(n=('Placa','nunique'), km=('kmtot','sum')).groupby(['dproj','cod','vig']).mean()
DC = ['Frota Ativa','Dias Úteis','Viagens Rem.','Viagens - Real','Km/Viagem Real','Km Rem. Mês','Km Rem. TT']
dd = dp[dp.proj.isin(['ROTA','ROTA (VAN)','UDC','AUTO SERVIÇO'])].rename(columns={'proj':'dproj'}).groupby(['dproj','cod','vig'])[DC].sum()
kk = pd.concat([gp, ga2]).join(dd, how='outer')
kk = kk[(kk.index.get_level_values('vig') >= INI) & (kk.index.get_level_values('vig') <= FIM) & kk['Frota Ativa'].notna()].fillna(0)
# decomposição do Δ km: frota, km por mapa, mapas não feitos (25 dias úteis), recargas/noturnas
w = kk[kk.n > 0]; kv = (w.km/w.n)/25
dec = pd.DataFrame({'frota': (w.n-w['Frota Ativa'])*kv*25, 'kmmapa': w['Frota Ativa']*25*(kv-w['Km/Viagem Real']),
                    'mapas': w['Km/Viagem Real']*(w['Frota Ativa']*25-w['Viagens - Real']), 'recarga': -(w['Km Rem. TT']-w['Km Rem. Mês'])})
out['km_meses'] = sorted(set(kk.index.get_level_values('vig')))
out['km_kmv'] = {'mediana': float((kv/w['Km/Viagem Real']).replace([np.inf,-np.inf], np.nan).median()), 'n': int(len(w))}
out['km_dec'] = {c: round(float(dec[c].sum()), 0) for c in dec.columns}
cn = kk.groupby(level='dproj')[['n','Frota Ativa','km','Km Rem. TT','Viagens Rem.','Viagens - Real']].sum()
out['km_canal'] = {c: {q: round(float(cn.loc[c, q]), 0) for q in cn.columns} for c in cn.index}
cu = kk.groupby(level=['dproj','cod'])[['Frota Ativa','Viagens Rem.','Viagens - Real']].sum()
out['km_canal_uni'] = {c: {u: {q: round(float(cu.loc[(c, u), q]), 0) for q in cu.columns} for u in cu.loc[c].index} for c in cu.index.get_level_values(0).unique()}
un = kk.groupby(level='cod')[['n','Frota Ativa','km','Km Rem. TT','Viagens Rem.','Viagens - Real']].sum()
out['km_uni'] = {c: {q: round(float(un.loc[c, q]), 0) for q in un.columns} for c in un.index}
mm = kk.groupby(level='vig')[['km','Km Rem. TT','Viagens Rem.','Viagens - Real']].sum()
out['km_mes'] = {c: [round(float(z), 0) for z in mm[c]] for c in mm.columns}; out['km_mes']['vig'] = list(mm.index)
# o FT ao km PAGO: componentes × (km da Dispersão ÷ km teto do FT), por unidade e mês
rt = kk.groupby(level=['cod','vig'])[['km','Km Rem. TT']].sum(); rt['rat'] = rt['Km Rem. TT']/rt.km
jp = j.join(rt[['rat']], how='inner')
for c in V: jp[c+'_pago'] = jp[c]*jp.rat
tp = jp.sum()
cf = dr[(dr['CONTA GERENCIAL'] == 'Contratos de Manutenção Fabricante') & (dr.vig >= INI) & (dr.vig <= max(out['km_meses']))].rem.sum()
out['ftdre_pago'] = {c: {'teto': round(float(tp[c]), 0), 'pago': round(float(tp[c+'_pago']), 0), 'dre': round(float(tp[c+'_dre']), 0)} for c in V}
out['ftdre_pago']['contrato_fab'] = round(float(cf), 0)
up = jp.groupby(level='cod').sum()
out['ftdre_pago_uni'] = {u: {c: round(float((up.loc[u, c+'_dre']/up.loc[u, c+'_pago']-1)*100), 0) for c in V} for u in up.index}

# ── 3) manutenção R$/km zerada depois do free maintenance (placa a placa) ──
c = ft('ROTA', 'Caminhao'); c['vig'] = vigcol(c)
a = c[c.Ativo == True].copy()
out['manut_regra'] = {'rskm_igual_contrato': float((a.loc[a['R$/KM'] > 0, 'R$/KM'] - a.loc[a['R$/KM'] > 0, 'manutencaoContrato']).abs().quantile(.95))}
z = a[(a['R$/KM'].fillna(0) == 0) & (a['Consumo KM/L'] > 0)].copy()
z['apos'] = z.manutencaoVidaMeses >= z.freeMaintenance
z['pot'] = z.manutencaoBid*z['KM Mês Roadshow']/2
zz = z[z.apos]
zm = zz[(zz.vig >= '2025-01') & (zz.vig <= '2026-10')].groupby('vig').agg(placas=('Placa','nunique'), pot=('pot','sum'))
out['manut_zero_mes'] = {'vig': list(zm.index), 'placas': [int(q) for q in zm.placas], 'pot': [round(float(q), 0) for q in zm.pot]}
z26 = zz[(zz.vig >= INI) & (zz.vig <= '2026-10')]
zu = z26.groupby('Unidade - Nome').agg(placas=('Placa','nunique'), pot=('pot','sum'), fora=('manutencaoCompraForaDoBidAutorizada','mean'), vida=('manutencaoVidaMeses','median'))
out['manut_zero_uni'] = {FTU[u]: {'placas': int(zu.loc[u,'placas']), 'pot': round(float(zu.loc[u,'pot']), 0), 'vida': round(float(zu.loc[u,'vida']), 1)} for u in zu.index if u != 'UDC GUARULHOS'}
zmod = z26.assign(mod=z26['Modelo do Cavalo'].astype(str).str.replace('\u00a0',' ').str.replace(r'\.0$','',regex=True).str.strip()).groupby('mod').Placa.nunique().sort_values(ascending=False).head(5)
out['manut_zero_mod'] = {kk: int(q) for kk, q in zmod.items()}
out['manut_zero_free'] = {'dentro': int((~z[(z.vig >= INI)].apos).sum()), 'depois': int(z26.shape[0]), 'placas26': int(z26.Placa.nunique()), 'pot26': round(float(z26.pot.sum()), 0)}
# carência da montadora: placa nova vem zerada; o que sobra para conferir é a placa velha
zp = z26.sort_values(['vig','_qz']).groupby('Placa').agg(vida=('manutencaoVidaMeses','last'), pot=('pot','sum'), uni=('Unidade - Nome','last'),
        mod=('Modelo do Cavalo', 'last'), bid=('manutencaoBid','median'))
zp['mod'] = zp['mod'].astype(str).str.replace('\u00a0',' ').str.replace(r'\.0$','',regex=True).str.strip()
zp['faixa'] = pd.cut(zp.vida, [-1, 12, 24, 1e9], labels=['ate12','12a24','mais24'])
out['manut_faixa'] = {str(fx): {'placas': int(q.shape[0]), 'pot': round(float(q.pot.sum()), 0), 'vida': round(float(q.vida.median()), 1) if len(q) else 0}
                      for fx, q in zp.groupby('faixa', observed=False)}
v24 = zp[zp.faixa == 'mais24']
out['manut_velha_uni'] = {FTU[u]: {'placas': int(q.shape[0]), 'pot': round(float(q.pot.sum()), 0), 'vida': round(float(q.vida.median()), 1)} for u, q in v24.groupby('uni')}
out['manut_velha_mod'] = {k2: int(q) for k2, q in v24['mod'].value_counts().head(5).items()}
out['manut_velha_bid'] = round(float(v24.bid.median()), 2)

# ── 4) combustível: regra do preço e o preço que destoa ──
cb = ft('ROTA', 'CombustivelRota'); cb['tipo'] = cb.tipoCombustivelShared.str.replace('Descrição: ', '')
cb['mn'] = cb[['precoAnp','precoOperadora']].min(axis=1)
die = cb[cb.tipo.str.startswith('DIESEL')]
out['comb_regra'] = {'diesel_regs': int(len(die)), 'igual_min': float(((die.precoCreditoImpostos - die.mn).abs() < 0.006).mean()),
                     'acima26': int(((cb._ano == 2026) & cb.tipo.str.startswith('DIESEL') & (cb.precoOperadora > cb.precoAnp + 0.0005)).sum())}
a['tipo'] = a.tipoCombustivelShared.str.replace('Descrição: ', '').str.replace(' S/ ARLA', '')
a2 = a[a['Consumo KM/L'] > 0].merge(cb[['Unidade - Nome','_vig','tipo','precoOperadora','precoAnp','precoCreditoImpostos']], on=['Unidade - Nome','_vig','tipo'])
a2['preco'] = a2['Consumo R$/KM']*a2['Consumo KM/L']; a2['lit'] = a2['KM Mês Roadshow']/a2['Consumo KM/L']/2
L = a2.groupby(['Unidade - Nome','_vig','tipo','precoOperadora','precoAnp']).agg(lit=('lit','sum'), placas=('Placa','nunique'), pago=('preco','median')).reset_index()
bx = L[(L.precoOperadora < 0.88*L.precoAnp) & L.tipo.str.startswith('DIESEL')].copy()
bx['dif'] = (bx.precoAnp - bx.precoOperadora)*bx.lit
out['comb_baixo'] = bx.assign(cod=bx['Unidade - Nome'].map(FTU)).drop(columns=['Unidade - Nome']).round(2).to_dict('records')
ac = L[(L.precoOperadora > L.precoAnp + 0.0005) & L.tipo.str.startswith('DIESEL')].copy(); ac['dif'] = (ac.precoOperadora - ac.precoAnp)*ac.lit
ac['ano'] = ac._vig.astype(str).str[-4:]
out['comb_acima'] = {an: {'quinzenas': int(len(q)), 'dif': round(float(q.dif.sum()), 0), 'uni': sorted(q['Unidade - Nome'].map(FTU).unique().tolist())} for an, q in ac.groupby('ano')}
ele = a[a.tipo.str.contains('ELETRICO')]
out['eletricos'] = {'placas': int(ele[ele._ano == 2026].Placa.nunique()), 'placas_hist': int(ele.Placa.nunique()), 'unidade': sorted(ele['Unidade - Nome'].map(FTU).unique().tolist()), 'consumo_rs': float(ele['Consumo R$/KM'].max()),
                    'km_mes': round(float(ele[ele._ano == 2026].groupby('vig')['KM Mês Roadshow'].sum().div(2).mean()), 0) if len(ele) else 0}
out['pneu_formula'] = float(((a['Quantidade de Pneus']*a['Preço Liso'] + a['Quantidade de Pneus']*a['Quantidade de Recapagem']*a['Preço Recapagem'])/a['Vida Pneus KM'] - a['Pneu por KM']).abs().quantile(.9))

# ── 6) Empurrada / Armazém: estrutura e tamanho ──
fe = ft('EMPURRADA', 'FaturamentoEmpurrada')
out['emp_fixo'] = {u: round(float(q), 0) for u, q in fe[(fe._ano == 2026)].assign(t=lambda q: q[[c for c in q.columns if c.endswith('FreteCtrc')]].sum(axis=1)).groupby(['Unidade - Nome','_vig']).t.sum().groupby(level=0).mean().items()}
te = ft('EMPURRADA', 'TrechoEmpurrada')
out['emp_trechos'] = {u: int(q) for u, q in te[(te._ano == 2026) & (te._mes == 9) & (te._qz == 1)]['Unidade - Nome'].value_counts().items()}
cv = ft('EMPURRADA', 'CavaloEmpurrada'); cva = cv[(cv._ano == 2026) & (cv.ativo == 'ATIVO')]
zc = cva[cva.reaiskm.fillna(0) == 0]
out['emp_manut'] = {'regs': int(len(cva)), 'zero': int(len(zc)), 'zero_depois': int((zc.manutencaoVidaMeses >= zc.freeMaintenance).sum())}
out['tabelas'] = {}
json.dump(out, open(os.environ.get('FT_OUT', 'dados.json'), 'w'), ensure_ascii=False, indent=1, default=float)
print('ok')
