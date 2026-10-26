# ============================================================
# Histórico 2022→2026, segunda camada: o PORQUÊ de cada premissa (mesmas placas ×
# troca de frota, coorte de idade, modelo) e os índices de mercado (macro.json do
# workflow Macro Indices) ao lado das premissas, base 2022 = 100.
#   MACRO=../macro/macro.json PYTHONPATH=. python3 historico2.py   → historico2.json
# ============================================================
import os, json
from comum import *
MACRO = os.environ.get('MACRO', '../macro/macro.json')
ANOS = [2022, 2023, 2024, 2025, 2026]
R2 = lambda v: round(float(v), 2); R3 = lambda v: round(float(v), 3); R0 = lambda v: round(float(v), 0)
def med(s): s = s.dropna(); return R3(s.median()) if len(s) else None
def merc(p):
    p = str(p or '').upper().replace('-', '').strip()
    if len(p) == 7 and p[4].isdigit(): p = p[:4] + 'ABCDEFGHIJ'[int(p[4])] + p[5:]
    return p
out = {}
c = ft('ROTA', 'Caminhao'); c = c[c.Ativo == True].copy(); c['pl'] = c.Placa.map(merc)
c['st'] = c.statusFinanciamentoShared.astype(str).str.replace('Descrição: ', '')
c['mod'] = c['Modelo do Cavalo'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
c['carencia'] = c.manutencaoVidaMeses <= c.freeMaintenance
K = {'manut': 'Manutenção R$/KM', 'comb': 'Consumo R$/KM', 'pneu': 'Pneu por KM', 'carr': 'Manutenção Carroceria R$/KM', 'var': 'Total Custo Variável', 'kml': 'Consumo KM/L', 'fixo': 'Total Custo Fixo', 'finame': 'FINAME Modelo Novo', 'compra': None, 'vida': 'manutencaoVidaMeses'}
c['compra'] = c['Valor de Compra Cavalo'] + c['Valor de Compra Carroceria']
# mediana por placa e ano (cada placa pesa 1 no ano)
def porPlaca(a):
    g = c[c._ano == a].groupby('pl')
    d = pd.DataFrame({k: g[(v or k)].median() for k, v in K.items()})
    d['carencia'] = g.carencia.mean() > 0.5; d['mod'] = g['mod'].agg(lambda s: s.mode().iloc[0] if len(s.mode()) else s.iloc[-1]); d['st'] = g.st.agg(lambda s: s.mode().iloc[0] if len(s.mode()) else s.iloc[-1])
    d['bid'] = g.manutencaoBid.median(); d['contrato'] = g['R$/KM'].median()
    return d
P = {a: porPlaca(a) for a in ANOS}
# ── 1) decomposição mesmas placas × troca de frota, ano a ano e 2022→2026 ──
def decomp(a, b):
    A, Bb = P[a], P[b]; comum = A.index.intersection(Bb.index); saiu = A.index.difference(Bb.index); entrou = Bb.index.difference(A.index)
    r = {'placas_a': int(len(A)), 'placas_b': int(len(Bb)), 'comum': int(len(comum)), 'saiu': int(len(saiu)), 'entrou': int(len(entrou))}
    for k in ['manut', 'comb', 'pneu', 'carr', 'var', 'kml', 'fixo', 'finame', 'vida', 'compra']:
        ma, mb = A[k].median(), Bb[k].median()
        r[k] = {'de': R3(ma), 'para': R3(mb), 'mesmas_de': R3(A.loc[comum, k].median()), 'mesmas_para': R3(Bb.loc[comum, k].median()),
                'saiu': R3(A.loc[saiu, k].median()) if len(saiu) else None, 'entrou': R3(Bb.loc[entrou, k].median()) if len(entrou) else None}
    r['carencia_entrou_pct'] = R0(Bb.loc[entrou, 'carencia'].mean() * 100) if len(entrou) else None
    r['carencia_b_pct'] = R0(Bb.carencia.mean() * 100)
    r['manut_sem_carencia'] = {'de': R3(A[~A.carencia].manut.median()), 'para': R3(Bb[~Bb.carencia].manut.median()), 'mesmas_de': R3(A.loc[[p for p in comum if not A.loc[p, 'carencia']], 'manut'].median()), 'mesmas_para': R3(Bb.loc[[p for p in comum if not Bb.loc[p, 'carencia']], 'manut'].median())}
    r['bid_entrou'] = R3(Bb.loc[entrou, 'bid'].median()) if len(entrou) else None; r['bid_saiu'] = R3(A.loc[saiu, 'bid'].median()) if len(saiu) else None
    return r
out['decomp'] = {f'{a}-{b}': decomp(a, b) for a, b in [(2022, 2023), (2023, 2024), (2024, 2025), (2025, 2026), (2022, 2026)]}
# ── 2) mix de modelo e coorte de idade por ano ──
out['modelos'] = {a: P[a]['mod'].value_counts().head(8).to_dict() for a in ANOS}
out['kml_modelo'] = {a: {m: R2(P[a][P[a]['mod'] == m].kml.median()) for m in P[a]['mod'].value_counts().head(6).index} for a in ANOS}
out['manut_modelo'] = {a: {m: R2(P[a][(P[a]['mod'] == m) & (~P[a].carencia)].manut.median()) for m in P[a]['mod'].value_counts().head(6).index} for a in ANOS}
def coorte(a):
    d = P[a]; f = pd.cut(d.vida, [-1, 12, 36, 60, 84, 1e9], labels=['0–12', '13–36', '37–60', '61–84', '85+'])
    return {str(k): {'placas': int(len(x)), 'manut': R2(x.manut.median()), 'kml': R2(x.kml.median()), 'fixo': R0(x.fixo.median())} for k, x in d.groupby(f, observed=False)}
out['coorte'] = {a: coorte(a) for a in ANOS}
out['status'] = {a: P[a].st.value_counts().to_dict() for a in ANOS}
out['tjlp'] = {int(a): med(g.loc[g['TJLP (%)'] > 0, 'TJLP (%)']) for a, g in c.groupby('_ano')}
out['taxa_finame'] = {int(a): med(g.loc[g['Taxa FINAME'] > 0, 'Taxa FINAME']) for a, g in c.groupby('_ano')}
out['fixo_status'] = {a: {s: R0(x.fixo.median()) for s, x in P[a].groupby('st')} for a in ANOS}
# ── 3) pneu: medida dominante e preço do 275 por ano ──
c['med'] = c['Medida Pneu'].astype(str).str.extract(r'(\d{3})')[0]
out['pneu'] = {a: {'medidas': g.groupby('med').pl.nunique().sort_values(ascending=False).head(3).to_dict(), 'preco_275': med(g[g.med == '275']['Preço Tração']), 'recap': med(g['Preço Recapagem']), 'vida': med(g['Vida Pneus KM']), 'rk': med(g['Pneu por KM'])} for a, g in c.groupby('_ano')}
# ── 4) índices de mercado (BCB SGS) ──
try:
    M = json.load(open(MACRO)); S = M['series']
    out['macro'] = {k: {'nome': v.get('nome'), 'ano': v.get('ano'), 'erro': v.get('erro')} for k, v in S.items()}
    # IPCA e IGP-M acumulados: índice base 2022 = 100 e 2019 = 100 (variação do ano composta; 2026 parcial = acumulado até o último mês)
    def idx(k, base):
        a = S[k]['ano']; anos = sorted(a); i = {}; acc = 100.0
        for y in anos:
            if int(y) > base: acc *= 1 + a[y] / 100
            i[y] = R2(acc) if int(y) >= base else None
        return i
    for k in ['ipca', 'igpm', 'ipa_m', 'inpc']:
        if k in S and S[k].get('ano'): out['macro'][k]['idx22'] = idx(k, 2022); out['macro'][k]['idx19'] = idx(k, 2019)
    out['macro_ok'] = True
except Exception as e:
    out['macro'] = {}; out['macro_ok'] = False; out['macro_erro'] = str(e)[:120]
def limpa(v):  # NaN não é JSON: vira null
    if isinstance(v, dict): return {k: limpa(x) for k, x in v.items()}
    if isinstance(v, list): return [limpa(x) for x in v]
    try:
        if v != v: return None
    except Exception: pass
    return v
json.dump(limpa(out), open('historico2.json', 'w'), ensure_ascii=False, indent=1, default=float)
print(json.dumps(out['decomp']['2022-2026'], ensure_ascii=False)[:2500]); print(out['modelos'][2026], out.get('macro_ok'))
