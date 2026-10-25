# ============================================================
# Série histórica do Freightech (2022→2026): premissas ano a ano e o resumo
# das análises por ano (completa-<ano>.json). Grava historico.json.
#   PYTHONPATH=. python3 historico.py      (na pasta com pq/ e os completa-*.json)
# ============================================================
import json, os
from comum import *
ANOS = [2022, 2023, 2024, 2025, 2026]
out = {'anos': ANOS, 'ano': {}}
for a in ANOS:
    f = f'completa-{a}.json'
    if os.path.exists(f): out['ano'][a] = json.load(open(f))

def med(s): return round(float(s.median()), 3) if len(s.dropna()) else None
c = ft('ROTA', 'Caminhao'); c = c[c.Ativo == True].copy()
c['st'] = c.statusFinanciamentoShared.astype(str).str.replace('Descrição: ', '')
P = {}
for a, g in c.groupby('_ano'):
    w = g['KM Mês Roadshow'].fillna(0)
    P[int(a)] = {
        'kml': round(float((w).sum() / (w / g['Consumo KM/L'].replace(0, np.nan)).sum()), 3),
        'comb': med(g['Consumo R$/KM']), 'manut': med(g['Manutenção R$/KM']), 'carr': med(g['Manutenção Carroceria R$/KM']), 'pneu': med(g['Pneu por KM']),
        'var': med(g['Total Custo Variável']), 'fixo': med(g['Total Custo Fixo']), 'finame': med(g.loc[g['FINAME Modelo Novo'] > 0, 'FINAME Modelo Novo']),
        'km_placa': med(g['KM Mês Roadshow']), 'vida': med(g.manutencaoVidaMeses), 'placas': int(g.Placa.nunique()),
        'status': g.groupby('st').Placa.nunique().to_dict(), 'compra': med(g['Valor de Compra Cavalo'] + g['Valor de Compra Carroceria']),
        'pneu_275': med(g.loc[g['Medida Pneu'].astype(str).str.startswith('275'), 'Preço Tração']),
        'recap': med(g['Preço Recapagem']), 'vida_pneu': med(g['Vida Pneus KM']), 'taxa': med(g.loc[g['Taxa FINAME'] > 0, 'Taxa FINAME']),
        'carencia_pl': int(g[g.manutencaoVidaMeses <= g.freeMaintenance].Placa.nunique()),
    }
out['premissas'] = P
cb = ft('ROTA', 'CombustivelRota'); cb = cb[cb.tipoCombustivelShared.astype(str).str.contains('S10')]
out['diesel'] = {int(a): {'op': med(g.precoOperadora), 'anp': med(g.precoAnp), 'pago': med(g.precoCreditoImpostos)} for a, g in cb.groupby('_ano')}
dm = cb.assign(v=cb._ano.astype(str) + '-' + cb._mes.astype(str).str.zfill(2)).groupby('v')[['precoOperadora', 'precoAnp', 'precoCreditoImpostos']].median()
out['diesel_mes'] = {'v': list(dm.index), 'op': [round(float(x), 2) for x in dm.precoOperadora], 'anp': [round(float(x), 2) for x in dm.precoAnp], 'pago': [round(float(x), 2) for x in dm.precoCreditoImpostos]}
r = resumo_rota(); r = r[r.tipo == 'CAMINHAO']
rm = r.groupby(['vig', '_qz'])[['Total Caminhão Ativo', 'Total Caminhão Parado']].sum().groupby('vig').mean()
out['frota_mes'] = {'v': list(rm.index), 'at': [round(float(x), 0) for x in rm['Total Caminhão Ativo']], 'par': [round(float(x), 0) for x in rm['Total Caminhão Parado']]}
# T1: R$/km do trecho por ano e unidade
TC = {'diesel': 'freteReaisKMDiesel', 'manut': 'freteReaisKMManutencaoCavalo', 'carr': 'freteReaisKMManutencaoCarreta', 'pneu': 'freteReaisKMPneu', 'salario': 'freteReaisKMSalarioVariavel', 'lucro': 'freteReaisKMLucroVariavel'}
t = ft('EMPURRADA', 'TrechoEmpurrada'); t = t[t.previsaoViagens > 0].copy(); t['w'] = t.kmRodado * t.previsaoViagens
t['cod'] = t['Unidade - Nome'].map({'CUIABA': 'CBA', 'PIRAI': 'PIR', 'MACACU': 'MCC'})
T1 = {}
for (a, u), g in t.groupby(['_ano', 'cod']):
    T1.setdefault(u, {})[int(a)] = {k: round(float((g[cc] * g.w).sum() / g.w.sum()), 3) for k, cc in TC.items()} | {'kml': round(float((g.dieselConsumoKmL * g.w).sum() / g.w.sum()), 3), 'trechos': int(g.chaveTrecho.nunique())}
out['t1'] = T1
json.dump(out, open('historico.json', 'w'), ensure_ascii=False, indent=1, default=float)
print(json.dumps(P, ensure_ascii=False, default=float)[:2500])
