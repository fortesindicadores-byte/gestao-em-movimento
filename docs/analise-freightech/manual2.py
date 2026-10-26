# ============================================================
# Medições extras do Manual Freightech (26/10/2026, feedback do Renan):
# rastreador por unidade, os três casos do combustível (S10 + Arla, S/ Arla,
# diesel comum), o calendário das revisões do Km/L, as regras da manutenção
# com os grupos todos, a carroceria (ajuste por unidade/capacidade) e um
# exemplo de placa do Rio (com rastreador). Grava manual2.json (fora do repo).
#   PYTHONPATH=. python3 manual2.py     (na pasta com pq/)
# ============================================================
import json, os
from comum import *
VIG = dict(_ano=2026, _mes=int(os.environ.get('MES', 9)), _qz=1)
def q(d): return d[(d._ano == VIG['_ano']) & (d._mes == VIG['_mes']) & (d._qz == VIG['_qz'])]
num = lambda s: pd.to_numeric(s, errors='coerce')
R = lambda v, n=2: None if pd.isna(v) else round(float(v), n)
out = {}
c = ft('ROTA', 'Caminhao'); c['vig'] = c._ano.astype(str) + '-' + c._mes.astype(str).str.zfill(2) + '-' + c._qz.astype(str)
c['cod'] = c['Unidade - Nome'].map(FTU)
a26 = c[(c.Ativo == True) & (c._ano == 2026)].copy()

# ── rastreador: pago só no RJ ──
r = num(a26['Rastreador']).fillna(0)
g = a26.assign(r=r).groupby('cod').agg(placas=('Placa', 'nunique'), com=('r', lambda s: int((s > 0).sum())), val=('r', lambda s: R(s[s > 0].median()) if (s > 0).any() else 0))
g['placas_com'] = a26.assign(r=r)[a26.assign(r=r).r > 0].groupby('cod').Placa.nunique().reindex(g.index).fillna(0).astype(int)
out['rastreador'] = {u: {'placas': int(x.placas), 'placas_com': int(x.placas_com), 'valor': x.val} for u, x in g.iterrows()}
hist = {}
for y, gy in c[c.Ativo == True].groupby('_ano'):
    ry = num(gy['Rastreador']).fillna(0); hist[int(y)] = {'placas': int(gy.Placa.nunique()), 'com': int(gy[ry > 0].Placa.nunique()), 'valor': R(ry[ry > 0].median()) if (ry > 0).any() else 0}
out['rastreador_ano'] = hist

# ── combustível: três casos, medidos placa a placa ──
cb = ft('ROTA', 'CombustivelRota'); cb['tipo'] = cb.tipoCombustivelShared.astype(str).str.replace('Descrição: ', '')
k = ['Unidade - Nome', '_ano', '_mes', '_qz']
p = cb.pivot_table(index=k, columns='tipo', values='precoCreditoImpostos', aggfunc='first').reset_index()
a = c[(c.Ativo == True) & (c['Consumo KM/L'] > 0) & (c['Consumo R$/KM'] > 0)].copy()
a['imp'] = a['Consumo R$/KM'] * a['Consumo KM/L']; a['comb'] = a.tipoCombustivelShared.astype(str).str.replace('Descrição: ', '')
m = a.merge(p, on=k, how='left')
casos = {}
for t, g in m.groupby('comb'):
    g = g.dropna(subset=['DIESEL S10']); n = len(g)
    if n < 30: continue
    if t == 'DIESEL S10':
        calc = ((g['DIESEL S10'] + 0.05 * g['ARLA']) / g['Consumo KM/L']).round(2); bate = float((abs(calc - g['Consumo R$/KM']) <= 0.011).mean())
        so = ((g['DIESEL S10'] / g['Consumo KM/L']).round(2)); bate_so = float((abs(so - g['Consumo R$/KM']) <= 0.011).mean())
        casos[t] = {'linhas': n, 'placas': int(g.Placa.nunique()), 'regra': 'diesel S10 + 5% do preço do Arla, ÷ Km/L', 'bate': R(bate * 100, 1), 'so_diesel_bate': R(bate_so * 100, 1), 'razao': R((g.imp / g['DIESEL S10']).median(), 3)}
    elif 'S/ ARLA' in t:
        calc = (g['DIESEL S10'] / g['Consumo KM/L']).round(2); casos[t] = {'linhas': n, 'placas': int(g.Placa.nunique()), 'regra': 'só o diesel S10 ÷ Km/L', 'bate': R(float((abs(calc - g['Consumo R$/KM']) <= 0.011).mean()) * 100, 1), 'razao': R((g.imp / g['DIESEL S10']).median(), 3)}
    elif t == 'DIESEL' and 'DIESEL' in g:
        gg = g.dropna(subset=['DIESEL']); calc = (gg['DIESEL'] / gg['Consumo KM/L']).round(2)
        casos[t] = {'linhas': n, 'placas': int(g.Placa.nunique()), 'regra': 'diesel comum ÷ Km/L (2022–24)', 'bate': R(float((abs(calc - gg['Consumo R$/KM']) <= 0.011).mean()) * 100, 1) if len(gg) else None, 'razao': R((g.imp / g['DIESEL S10']).median(), 3)}
    else: casos[t] = {'linhas': n, 'placas': int(g.Placa.nunique()), 'regra': 'à parte', 'razao': R((g.imp / g['DIESEL S10']).median(), 3)}
out['comb_casos'] = casos
out['comb_tipos_2026'] = a26.tipoCombustivelShared.astype(str).str.replace('Descrição: ', '').value_counts().to_dict()

# ── Km/L: benchmark × ajustes × placa, e o calendário das revisões ──
b = a['Benchmark Consumo']; f = a['Fator Correção Região'].fillna(0); pe = a['Perda Ano Veículo'].fillna(0); kk = a['Consumo KM/L']
out['kml'] = {'linhas': int(len(a)), 'igual_bench': R(float((abs(kk - b) <= 0.005).mean()) * 100, 1),
              'bench_x_ajustes': R(float((abs(kk - b * (1 - pe / 100) * (1 + f / 100)) <= 0.006).mean()) * 100, 1),
              'razao_bench': {'mediana': R((kk / b).median(), 3), 'p10': R((kk / b).quantile(.1), 3), 'p90': R((kk / b).quantile(.9), 3)},
              'perda_valores': {str(k_): int(v) for k_, v in pe.round(1).value_counts().head(6).items()}, 'fator_valores': {str(k_): int(v) for k_, v in f.round(1).value_counts().head(6).items()}}
bm = a[a._ano == 2026].groupby(a['Modelo do Cavalo'].astype(str)).agg(bench=('Benchmark Consumo', 'median'), kml=('Consumo KM/L', 'median'), placas=('Placa', 'nunique')).sort_values('placas', ascending=False).head(8)
out['kml']['modelos'] = {mo: {'benchmark': R(x.bench), 'kml_mediana': R(x.kml), 'placas': int(x.placas)} for mo, x in bm.iterrows()}
a = a.sort_values(['Placa', '_ano', '_mes', '_qz']); a['prev'] = a.groupby('Placa')['Consumo KM/L'].shift(1)
ch = a[(a._ano >= 2025) & a.prev.notna()].assign(mud=lambda d: (abs(d['Consumo KM/L'] - d.prev) > 0.005))
cal = {}
for v, g in ch.groupby('vig'):
    d = (g['Consumo KM/L'] / g.prev - 1) * 100
    cal[v] = {'placas': int(len(g)), 'mudaram': int(g.mud.sum()), 'pct': R(g.mud.mean() * 100, 1), 'delta_med': R(d[g.mud].median(), 1) if g.mud.any() else None, 'sobe': int((d[g.mud] > 0).sum()), 'desce': int((d[g.mud] < 0).sum())}
out['kml']['calendario'] = cal

# ── manutenção: as regras, com todos os grupos ──
A = q(c); A = A[(A.Ativo == True) & (A['KM Mês Roadshow'] > 0)].copy()
A['regra'] = np.select([A.manutencaoVidaMeses <= A.freeMaintenance, A.manutencaoBid.fillna(0) > 0], ['carência', 'BID'], 'tabela por idade')
W = A[(A.regra == 'BID')].copy(); W['r'] = W['Manutenção R$/KM'] / W.manutencaoBid
W['grp'] = np.where((W.manutencaoCompraForaDoBidAutorizada == 1) & (W.manutencaoVidaMeses > 24), 'fora_24', np.where(W.manutencaoVidaMeses > 72, 'mais72', 'padrao'))
out['manut'] = {'quinzena': f"1ª quinzena de {VIG['_mes']:02d}/{VIG['_ano']}", 'ativas': int(A.Placa.nunique()),
    'carencia': {'placas': int(A[A.regra == 'carência'].Placa.nunique()), 'free': R(A.freeMaintenance.median(), 0)},
    'bid': {g_: {'placas': int(x.Placa.nunique()), 'r': R(x.r.median(), 3), 'rk': R(x['Manutenção R$/KM'].median(), 3), 'bid': R(x.manutencaoBid.median(), 3), 'vida': R(x.manutencaoVidaMeses.median(), 0)} for g_, x in W.groupby('grp')},
    'tabela': {'placas': int(A[A.regra == 'tabela por idade'].Placa.nunique()), 'rk': R(A[A.regra == 'tabela por idade']['Manutenção R$/KM'].median(), 3), 'ano': int(A[A.regra == 'tabela por idade'].manutencaoAno.median()) if (A.regra == 'tabela por idade').any() else None},
    'contrato_pct': R(float((A.manutencaoContrato.fillna(0) > 0).mean()) * 100, 0), 'zero_fora': int(A[(A.regra != 'carência') & (A['Manutenção R$/KM'].fillna(0) == 0)].Placa.nunique())}
ex = {}
for g_, x in [('carência', A[A.regra == 'carência']), ('padrao', W[W.grp == 'padrao']), ('fora_24', W[W.grp == 'fora_24']), ('mais72', W[W.grp == 'mais72']), ('tabela', A[A.regra == 'tabela por idade'])]:
    if len(x):
        e = x.sort_values('KM Mês Roadshow', ascending=False).iloc[len(x) // 2]
        ex[g_] = {'placa': e.Placa, 'uni': e.cod, 'modelo': str(e['Modelo do Cavalo']), 'vida': R(e.manutencaoVidaMeses, 1), 'bid': R(e.manutencaoBid), 'rk': R(e['Manutenção R$/KM']), 'contrato': R(e.manutencaoContrato), 'km': R(e['KM Mês Roadshow'], 0), 'ano': int(e.manutencaoAno) if pd.notna(e.manutencaoAno) else None}
out['manut']['exemplos'] = ex
bid = q(ft('ROTA', 'ManutencaoBidRota')); bid = bid[bid.ganhadorBid == 1]
out['manut']['bid_tabela'] = bid[['ano', 'capacidadePallets', 'montadora', 'valorFaixa1', 'valorFaixa2', 'valorFaixa3', 'valorFaixa5', 'valorFaixa8', 'kmApartirDe2', 'kmApartirDe3', 'kmApartirDe5', 'kmApartirDe8']].head(8).astype(str).to_dict('records')
mcav = q(ft('ROTA', 'ManutencaoCavalo')); mcav = mcav[mcav['Unidade - Nome'] == 'CDD CUIABA'].copy()
mcav['cap'] = mcav['Capacidade Caminhão'].astype(str).str.extract(r'Capacidade: ([^|]+)')[0].str.strip()
out['manut']['tab_idade'] = mcav[mcav.cap == '10.0'][['Ano', 'KM 1500', 'KM 2000', 'KM 2500', 'KM 3000']].sort_values('Ano').round(2).to_dict('records')

# ── carroceria: tabela e o ajuste medido ──
mc = q(ft('ROTA', 'ManutencaoCarroceria')).copy()
for kk_ in ['Material', 'Perfil', 'Tipo']: A[kk_] = A[kk_].astype(str).str.strip(); mc[kk_] = mc[kk_].astype(str).str.strip()
mm = A.merge(mc[['Unidade - Nome', 'Material', 'Perfil', 'Tipo', 'Valor por Mês', 'Valor por Ano']], on=['Unidade - Nome', 'Material', 'Perfil', 'Tipo'], how='left')
mm['fat'] = num(mm['Manutenção Carroceria R$/KM']) * num(mm['KM Mês Roadshow']) / num(mm['Valor por Mês'])
tab = mc.groupby(['Material', 'Perfil', 'Tipo'])['Valor por Mês'].median().reset_index()
out['carroceria'] = {'tabela': [{'chave': f"{x.Material} · {x.Perfil} · {x.Tipo}", 'mes': R(x['Valor por Mês'])} for _, x in tab.iterrows()],
                     'fator': {'mediana': R(mm.fat.median(), 3), 'p10': R(mm.fat.quantile(.1), 3), 'p90': R(mm.fat.quantile(.9), 3)},
                     'fator_uni': {u: R(x, 3) for u, x in mm.groupby('cod').fat.median().items()},
                     'fator_cap': {str(k_): R(x, 3) for k_, x in mm.groupby(mm['Capacidade de Pallets'].astype(str)).fat.median().items()}}

# ── exemplo do Rio (com rastreador), mesma quinzena ──
rj = A[(A.cod == 'CGR') & (num(A['Rastreador']) > 0) & (A['FINAME Modelo Novo'] > 0)]
if len(rj):
    e = rj.sort_values('KM Mês Roadshow').iloc[len(rj) // 2]
    out['placa_rj'] = {k_: (R(e[k_], 4) if isinstance(e[k_], (int, float, np.floating, np.integer)) else str(e[k_]).replace('Descrição: ', '')) for k_ in ['Placa', 'Modelo do Cavalo', 'Rastreador', 'Faixa Reflexiva', 'Lavagem', 'Seguro', 'IPVA Licenciamento', 'FINAME Modelo Novo', 'Total Custo Fixo', 'manutencaoVidaMeses', 'statusFinanciamentoShared']}
# quitado da mesma unidade (Cuiabá), para o fixo quase zero
qt = A[(A.cod == 'CBA') & A.statusFinanciamentoShared.astype(str).str.contains('QUITADO')]
if len(qt):
    e = qt.sort_values('Total Custo Fixo').iloc[len(qt) // 2]
    out['placa_quitada'] = {k_: (R(e[k_], 2) if isinstance(e[k_], (int, float, np.floating, np.integer)) else str(e[k_]).replace('Descrição: ', '')) for k_ in ['Placa', 'Modelo do Cavalo', 'FINAME Modelo Novo', 'Depreciação Cavalo', 'Depreciação Carroceria', 'Remuneração K', 'Remuneração K Impostos', 'Lucro FINAME', 'Lucro Fixo', 'Seguro', 'IPVA Licenciamento', 'Rastreador', 'Faixa Reflexiva', 'Lavagem', 'Total Custo Fixo', 'manutencaoVidaMeses']}
# lavagem por unidade
out['lavagem_uni'] = {u: R(x) for u, x in A.groupby('cod')['Lavagem'].median().items()}
json.dump(out, open('manual2.json', 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps({k_: out[k_] for k_ in ['rastreador', 'comb_casos']}, ensure_ascii=False)[:1500])
