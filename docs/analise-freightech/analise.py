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
d = dre(); dr = d[d.proj.isin(['ROTA','ROTA (VAN)','UDC'])]
g = dr.pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0)
j = f.merge(g, left_index=True, right_index=True, suffixes=('', '_dre'))
jj = j[(j.index.get_level_values('vig') >= '2025-01') & (j.index.get_level_values('vig') <= FIM)]
tm = jj.groupby(level='vig')[['comb','comb_dre','manut','manut_dre','pneu','pneu_dre','lav','lav_dre','ipva','ipva_dre']].sum()
out['ftdre_mes'] = {k: [round(float(z), 0) for z in tm[k]] for k in tm.columns}; out['ftdre_mes']['vig'] = list(tm.index)
yu = jj[jj.index.get_level_values('vig') >= INI].groupby(level='cod')[['comb','comb_dre','manut','manut_dre','pneu','pneu_dre','lav','lav_dre','ipva','ipva_dre']].sum()
out['ftdre_uni'] = {c: {k: round(float(yu.loc[c, k]), 0) for k in yu.columns} for c in yu.index}
# contratos de manutenção do fabricante no remunerado da DRE
cm = dr[(dr['CONTA GERENCIAL'] == 'Contratos de Manutenção Fabricante') & (dr.vig >= '2025-01') & (dr.vig <= FIM)].groupby('vig').rem.sum()
out['dre_contrato'] = {k: round(float(z), 0) for k, z in cm.items()}

# ── 2) km: o que o FT prevê × o km remunerado da Dispersão ──
dp = sh('dispersao_km'); dp['vig'] = pd.to_datetime(dp['Vigência'], errors='coerce').dt.strftime('%Y-%m')
dp['proj'] = dp['PROJ.'].astype(str).str.split(' - ').str[0].str.strip(); dp['cod'] = dp['PROJ.'].astype(str).str.split(' - ').str[-1].str.strip()
gk = dp[dp.proj.str.startswith('ROTA') | (dp.proj == 'UDC')].groupby(['cod','vig'])[['Km Rem. TT','Km Rodado TT','Frota Ativa']].sum()
k = f[['kmtot','Total Caminhão Ativo','rskm']].merge(gk, left_index=True, right_index=True)
k['gap_km'] = k.kmtot - k['Km Rem. TT']; k['gap_rs'] = k.gap_km*k.rskm
def per(df, a, b): return df[(df.index.get_level_values('vig') >= a) & (df.index.get_level_values('vig') <= b)]
k26 = per(k, INI, FIM); k25 = per(k, '2025-01', '2025-12')
tmk = per(k, '2025-01', FIM).groupby(level='vig')[['kmtot','Km Rem. TT','Total Caminhão Ativo','Frota Ativa','gap_rs']].sum()
out['km_mes'] = {c: [round(float(z), 0) for z in tmk[c]] for c in tmk.columns}; out['km_mes']['vig'] = list(tmk.index)
uk = k26.groupby(level='cod')[['kmtot','Km Rem. TT','gap_km','gap_rs','Total Caminhão Ativo','Frota Ativa']].sum()
out['km_uni'] = {c: {kk: round(float(uk.loc[c, kk]), 0) for kk in uk.columns} for c in uk.index}
out['km_tot26'] = {kk: round(float(k26[kk].sum()), 0) for kk in ['kmtot','Km Rem. TT','gap_km','gap_rs']}
out['km_tot25'] = {kk: round(float(k25[kk].sum()), 0) for kk in ['kmtot','Km Rem. TT','gap_km','gap_rs']}
out['km_meses26'] = sorted(set(k26.index.get_level_values('vig')))

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
ele = a[a.tipo.str.contains('ELETRICO')]
out['eletricos'] = {'placas': int(ele[ele._ano == 2026].Placa.nunique()), 'placas_hist': int(ele.Placa.nunique()), 'unidade': sorted(ele['Unidade - Nome'].map(FTU).unique().tolist()), 'consumo_rs': float(ele['Consumo R$/KM'].max()),
                    'km_mes': round(float(ele[ele._ano == 2026].groupby('vig')['KM Mês Roadshow'].sum().div(2).mean()), 0) if len(ele) else 0}
out['pneu_formula'] = float(((a['Quantidade de Pneus']*a['Preço Liso'] + a['Quantidade de Pneus']*a['Quantidade de Recapagem']*a['Preço Recapagem'])/a['Vida Pneus KM'] - a['Pneu por KM']).abs().quantile(.9))

# ── 5) AS: km do FT × DRE e Dispersão ──
s = ft('AS', 'CaminhaoAS'); s['cod'] = s['Unidade - Nome'].map(FTU); s['vig'] = vigcol(s)
sa = s[s.Ativo == True].copy(); kmc = 'KM Mês Roadshow'
sa['comb'] = sa['Consumo R$/KM']*sa[kmc]; sa['manut'] = (sa['R$/KM']+sa['Manutenção Carroceria R$/KM'])*sa[kmc]; sa['pneu'] = sa['Pneu por KM']*sa[kmc]; sa['km'] = sa[kmc]; sa['n'] = 1
fa = sa.groupby(['cod','vig','_qz'])[['comb','manut','pneu','km','n']].sum().groupby(['cod','vig']).mean()
ga = d[d.proj == 'AUTO SERVIÇO'].pivot_table(index=['cod','vig'], columns='pac', values='rem', aggfunc='sum').fillna(0)
ka = dp[dp.proj.str.startswith('AUTO')].groupby(['cod','vig'])[['Km Rem. TT','Frota Ativa']].sum()
ja = per(fa.merge(ga, left_index=True, right_index=True, suffixes=('', '_dre')).merge(ka, left_index=True, right_index=True), INI, FIM)
ta = ja.groupby(level='cod')[['comb','comb_dre','km','Km Rem. TT','n','Frota Ativa']].sum()
out['as_uni'] = {cc: {kk: round(float(ta.loc[cc, kk]), 0) for kk in ta.columns} for cc in ta.index}

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
