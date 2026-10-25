# ============================================================
# Números do Manual Freightech de frota: um exemplo real por custo (placa,
# trecho, unidade) e a conferência de cada fórmula contra os dados.
# Grava manual.json (fora do repositório).
#   PYTHONPATH=. python3 manual.py     (na pasta com pq/)
# ============================================================
import json, os
from comum import *
VIG = dict(_ano=2026, _mes=int(os.environ.get('MES', 9)), _qz=1)
def q(d): return d[(d._ano == VIG['_ano']) & (d._mes == VIG['_mes']) & (d._qz == VIG['_qz'])]
def num(v, n=2): return None if pd.isna(v) else round(float(v), n)
out = {'vig': f"{VIG['_qz']}ª quinzena de {VIG['_mes']:02d}/{VIG['_ano']}"}
err = lambda a, b: round(float(((a - b).abs() / b.abs().replace(0, np.nan)).median() * 100), 2)

# ── T2 · caminhão da Rota: a placa exemplo (financiada, com contrato, fora da carência) ──
c = q(ft('ROTA', 'Caminhao')); ca = c[c.Ativo == True].copy()
ex = ca[(ca['FINAME Modelo Novo'] > 0) & (ca['Período FINAME'] > 0) & (ca['Taxa FINAME'] > 0) & (ca['Manutenção R$/KM'] > 0) & (ca['Consumo KM/L'] > 0) & (ca['IPVA Licenciamento'] > 0)
        & (ca.statusFinanciamentoShared.astype(str).str.contains('FINANCIADO')) & (ca['Unidade - Nome'] == 'CDD CUIABA')].iloc[0]
K = ['Placa', 'Unidade - Nome', 'Modelo do Cavalo', 'Montadora', 'Ano Cavalo', 'Capacidade de Pallets', 'KM Mês Roadshow', 'Consumo KM/L', 'Consumo R$/KM', 'Benchmark Consumo',
     'Fator Correção Região', 'Perda Ano Veículo', 'Manutenção R$/KM', 'manutencaoReaisKm', 'manutencaoBid', 'manutencaoContrato', 'manutencaoVidaMeses', 'freeMaintenance',
     'Manutenção Carroceria R$/KM', 'Material', 'Perfil', 'Tipo', 'Pneu por KM', 'Quantidade de Pneus', 'Preço Liso', 'Preço Tração', 'Preço Recapagem', 'Quantidade de Recapagem',
     'Vida Pneus KM', 'Medida Pneu', 'Total Custo Variável', 'Valor de Compra Cavalo', 'Valor de Compra Carroceria', 'Valor PIS COFINS Cavalo', 'Valor PIS COFINS Carroceria',
     'Entrada (%)', 'Taxa FINAME', 'TJLP (%)', 'Período FINAME', 'Carência', 'Mês da Parcela', 'FINAME Modelo Novo', 'Seguro', 'IPVA Licenciamento', 'IPVA Licenciamento Cavalo',
     'Rastreador', 'Faixa Reflexiva', 'Lavagem', 'Total Custo Fixo', 'statusFinanciamentoShared', 'tipoCombustivelShared']
out['placa'] = {k: (num(ex[k], 4) if isinstance(ex[k], (int, float, np.floating, np.integer)) else str(ex[k]).replace('Descrição: ', '')) for k in K}
cb = q(ft('ROTA', 'CombustivelRota')); cb['tipo'] = cb.tipoCombustivelShared.str.replace('Descrição: ', '')
cu = cb[cb['Unidade - Nome'] == ex['Unidade - Nome']]
out['comb_unid'] = {r['tipo']: {'op': num(r.precoOperadora), 'anp': num(r.precoAnp), 'pago': num(r.precoCreditoImpostos)} for _, r in cu.iterrows()}
mc = q(ft('ROTA', 'ManutencaoCarroceria'))
m1 = mc[(mc['Unidade - Nome'] == ex['Unidade - Nome']) & (mc.Material.astype(str).str.strip() == str(ex.Material).strip()) & (mc.Perfil.astype(str).str.strip() == str(ex.Perfil).strip()) & (mc.Tipo.astype(str).str.strip() == str(ex.Tipo).strip())]
out['carroceria'] = {'ano': num(m1['Valor por Ano'].iloc[0]) if len(m1) else None, 'mes': num(m1['Valor por Mês'].iloc[0]) if len(m1) else None}

# conferências das fórmulas (erro mediano em % sobre todas as placas ativas da quinzena)
A = ca[ca['KM Mês Roadshow'] > 0]
out['conf'] = {
  'variavel': err(A['Consumo R$/KM'] + A['Manutenção R$/KM'] + A['Manutenção Carroceria R$/KM'] + A['Pneu por KM'], A['Total Custo Variável']),
  'pneu': err((A['Quantidade de Pneus'] * A['Preço Liso'] + A['Quantidade de Pneus'] * A['Quantidade de Recapagem'] * A['Preço Recapagem']) / A['Vida Pneus KM'], A['Pneu por KM']),
  'seguro': err(0.0075 * (A['Valor de Compra Cavalo'] + A['Valor de Compra Carroceria']) / 12, A['Seguro']),
  'ipva': err(A['IPVA Licenciamento Cavalo'] / 12, A['IPVA Licenciamento']),
  'fixo': err(A[['FINAME Modelo Novo', 'Seguro', 'IPVA Licenciamento', 'Rastreador', 'Faixa Reflexiva', 'Lavagem', 'Depreciação Cavalo', 'Depreciação Carroceria', 'Remuneração K',
                 'Remuneração K Impostos', 'Lucro FINAME', 'Lucro Fixo']].fillna(0).sum(axis=1), A['Total Custo Fixo']),
}
# FINAME: duas regras, conferidas placa a placa
#  FINANCIADO: PMT(taxa equivalente mensal de Taxa FINAME, Período − Carência, (compra cavalo + carroceria) × (1 − Entrada) capitalizado na carência)
#  FINAME:     PMT(TJLP + Spread BNDES + Spread Banco ÷ 12, Período − Carência, compra cavalo + carroceria)
def finame(x):
    V = x['Valor de Compra Cavalo'] + x['Valor de Compra Carroceria']; n = x['Período FINAME'] - x['Carência']
    if n <= 0 or x['Taxa FINAME'] <= 0: return np.nan
    if 'FINANCIADO' in str(x.statusFinanciamentoShared):
        r = (1 + x['Taxa FINAME'] / 100) ** (1 / 12) - 1; pv = V * (1 - x['Entrada (%)'] / 100) * (1 + r) ** x['Carência']
    else:
        r = (x['TJLP (%)'] + x['Spread BNDES'] + x['Spread Banco (%)']) / 100 / 12; pv = V * (1 + r) ** x['Carência']
    return pv * r / (1 - (1 + r) ** (-n))
f = A[(A['FINAME Modelo Novo'] > 0) & A.statusFinanciamentoShared.astype(str).str.contains('FINAN|FINAME')]
for st in ['FINANCIADO', 'FINAME']:
    g = f[f.statusFinanciamentoShared.astype(str).str.contains(st + '$', regex=True)]
    out['conf']['finame_' + st] = err(g.apply(finame, axis=1), g['FINAME Modelo Novo']) if len(g) else None
r_ = (1 + ex['Taxa FINAME'] / 100) ** (1 / 12) - 1
out['finame_ex'] = {'V': num(ex['Valor de Compra Cavalo'] + ex['Valor de Compra Carroceria']), 'pv': num((ex['Valor de Compra Cavalo'] + ex['Valor de Compra Carroceria']) * (1 - ex['Entrada (%)'] / 100)),
                    'r': num(r_ * 100, 3), 'n': num(ex['Período FINAME'] - ex['Carência'], 0), 'calc': num(finame(ex)), 'restam': num(ex['Período FINAME'] - ex['Mês da Parcela'], 1)}
out['status'] = A.statusFinanciamentoShared.astype(str).str.replace('Descrição: ', '').value_counts().to_dict()
P = A[A['Consumo KM/L'] > 0]
out['conf']['comb'] = err(P['Consumo R$/KM'] * P['Consumo KM/L'], P['Consumo R$/KM'] * P['Consumo KM/L'])  # placeholder (preço implícito)
out['preco_implicito'] = num((ex['Consumo R$/KM'] * ex['Consumo KM/L']))
# manutenção: regra de cada placa
A = A.copy(); A['regra'] = np.select([A.manutencaoVidaMeses <= A.freeMaintenance, A.manutencaoBid.fillna(0) > 0], ['carência', 'BID'], 'tabela por idade')
out['manut_regra'] = A.groupby('regra').agg(placas=('Placa', 'nunique'), rk=('Manutenção R$/KM', 'median')).round(3).to_dict('index')
W = A[(A.manutencaoVidaMeses > A.freeMaintenance) & (A.manutencaoBid > 0)].copy(); W['r'] = W['Manutenção R$/KM'] / W.manutencaoBid
W['grp'] = np.where((W.manutencaoCompraForaDoBidAutorizada == 1) & (W.manutencaoVidaMeses > 24), 'fora_24', np.where(W.manutencaoVidaMeses > 72, 'mais72', 'padrao'))
out['manut_bid'] = {g: {'n': int(len(x)), 'r': round(float(x.r.median()), 3)} for g, x in W.groupby('grp')}
S = A[(A.manutencaoVidaMeses > A.freeMaintenance) & (A.manutencaoBid.fillna(0) == 0)]
out['manut_sembid'] = {'n': int(S.Placa.nunique()), 'rk': round(float(S['Manutenção R$/KM'].median()), 3), 'ano': int(S.manutencaoAno.median()) if len(S) else None}
out['manut_igual_reaiskm'] = round(float(((A['Manutenção R$/KM'] - A.manutencaoReaisKm).abs() < 0.006).mean() * 100), 1)
bid = q(ft('ROTA', 'ManutencaoBidRota'))
out['bid_exemplo'] = bid[bid.ganhadorBid == 1][['ano', 'capacidadePallets', 'montadora', 'valorFaixa1', 'valorFaixa2', 'valorFaixa3', 'valorFaixa5', 'valorFaixa8', 'kmApartirDe2', 'kmApartirDe3', 'kmApartirDe5', 'kmApartirDe8']].head(6).astype(str).to_dict('records')
mcav = q(ft('ROTA', 'ManutencaoCavalo')); mcav = mcav[mcav['Unidade - Nome'] == ex['Unidade - Nome']]
mcav['cap'] = mcav['Capacidade Caminhão'].astype(str).str.extract(r'Capacidade: ([^|]+)')[0].str.strip()
out['tab_idade'] = mcav[mcav.cap == '10.0'][['Ano', 'KM 1500', 'KM 2000', 'KM 2500', 'KM 3000']].sort_values('Ano').head(10).round(2).to_dict('records')

# parado
r = q(ft('ROTA', 'Resumo')); rr = r[r['Unidade - Nome'] == ex['Unidade - Nome']].iloc[0]
PCOL = ['FINAME Modelo Novo Parado', 'Depreciação Caminhão Parado', 'Remuneração K Parado', 'Remuneração K Impostos Parado', 'Lucro Fixo Modelo Novo Parado', 'Lucro FINAME Parado',
        'Seguro Parado', 'IPVA Licenc. Mensal Parado', 'Rastreador Parado', 'Faixa Reflexiva Parado', 'Total por Caminhão Frota Parada', 'Total Caminhão Parado',
        'Total por Caminhão Frota Ativa', 'Total Caminhão Ativo', 'KM Remunerado', 'Total R$/KM', 'Total Viagens', 'Combustível R$/KM', 'Manutenção Caminhão R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu R$/KM', 'Lavagem']
out['resumo'] = {k: num(rr[k]) for k in PCOL}

# ── T1 · Empurrada: um trecho e os parâmetros de unidade ──
t = q(ft('EMPURRADA', 'TrechoEmpurrada')); t = t[t.previsaoViagens > 0]
te = t[t['Unidade - Nome'] == 'PIRAI'].sort_values('previsaoViagens', ascending=False).iloc[0]
TK = ['Origem', 'Destino', 'Capacidade', 'kmIda', 'kmVolta', 'kmRodado', 'previsaoViagens', 'dieselConsumoKmL', 'dieselConsumoDieselReaisKM', 'manutencaoCavalo', 'manutencaoImplementoReaiskm',
      'pneuCustoPneusCamarasReaisKm', 'pneuQuantidadeDePneus', 'pneuValorMedioPneus', 'pneuValorMedioDaRecapagem', 'pneuVidautilPneu', 'pneuValorDeVendaDaCarcaca', 'vidautilAjustadaPneu',
      'lavagemReaisKm', 'pedagio', 'pedagioReaisKM', 'seguro', 'seguroReaiskm', 'premioProdutividadeSalarioVariavelReaisKm', 'premioProdutividadeFatorMotorista', 'lucroVariavelReaisKm',
      'freteLiquido', 'freteCtrc', 'fretePisCofins', 'impostosIcmsIss', 'percentualIcmsIss', 'velocidadeMediaKmH', 'percentualPerdaKm', 'percentualPerdaRegiao']
out['trecho'] = {k: (num(te[k], 4) if isinstance(te[k], (int, float, np.floating, np.integer)) else str(te[k])[:80]) for k in TK}
ce = q(ft('EMPURRADA', 'CombustivelEmpurrada')); ce = ce[ce['Unidade - Nome'] == 'PIRAI']
out['comb_emp'] = {str(x.descricao): {'op': num(x.precoOperadora), 'anp': num(x.precoAnp), 'credito': num(x.precoCreditoImpostos)} for _, x in ce.iterrows()}
VC = ['dieselConsumoDieselReaisKM', 'manutencaoCavalo', 'manutencaoImplementoReaiskm', 'pneuCustoPneusCamarasReaisKm', 'lavagemReaisKm', 'pedagioReaisKM', 'seguroReaiskm',
      'premioProdutividadeSalarioVariavelReaisKm', 'lucroVariavelReaisKm']
VV = [x for x in t.columns if x.startswith('freteReaisViagem')]
out['trecho_viagem'] = {x.replace('freteReaisViagem', ''): num(te[x]) for x in VV}
out['conf']['trecho'] = err(t[VV].fillna(0).sum(axis=1), t.freteLiquido)
out['conf']['diesel_trecho'] = None
s10 = ce[ce.descricao.astype(str).str.contains('S10')]
if len(s10): out['conf']['diesel_trecho'] = err(pd.Series([float(s10.precoCreditoImpostos.iloc[0])] * len(t[t['Unidade - Nome'] == 'PIRAI'])) / t[t['Unidade - Nome'] == 'PIRAI'].dieselConsumoKmL.reset_index(drop=True), t[t['Unidade - Nome'] == 'PIRAI'].dieselConsumoDieselReaisKM.reset_index(drop=True))
cv = q(ft('EMPURRADA', 'CavaloEmpurrada')); cv = cv[(cv['Unidade - Nome'] == 'PIRAI') & (cv.ativo.astype(str) == 'ATIVO')]
cvx = cv.iloc[0]
out['cavalo'] = {k: (num(cvx[k], 4) if isinstance(cvx[k], (int, float, np.floating, np.integer)) else str(cvx[k])[:60]) for k in
                 ['Placa', 'modeloEmpurrada', 'ano', 'valorNfCompra', 'percentualEntrada', 'Taxa Finame (%)', 'periodoFiname', 'carencia', 'finameCavalo', 'amortizacaoCavalo', 'jurosFinameCavalo',
                  'ipvaLicenciamento', 'manutencaoReaisKm', 'reaiskm', 'manutencaoBid', 'manutencaoContrato', 'manutencaoVidaMeses', 'freeMaintenance', 'faixaKm', 'odometroEntrada',
                  'combustivelConsumoBenchmark', 'combustivelConsumoNeg', 'combustivelPercentualPerdaVida', 'valorPneu']}
cr = q(ft('EMPURRADA', 'CarretaEmpurrada')); cr = cr[cr['Unidade - Nome'] == 'PIRAI']
crx = cr.iloc[0]
out['carreta'] = {k: (num(crx[k], 4) if isinstance(crx[k], (int, float, np.floating, np.integer)) else str(crx[k])[:60]) for k in
                  ['Placa', 'modelo', 'ano', 'valorNfCompra', 'finame', 'finameImplemento', 'amortizacaoImplemento', 'jurosFinameImplemento', 'seguro', 'ipvaLicenciamentoMensal', 'rastreador',
                   'tacografo', 'faixaReflexiva', 'custoFixo', 'periodoFiname', 'carencia', 'valorPneus']}
fe = q(ft('EMPURRADA', 'FaturamentoEmpurrada')); fe = fe[fe['Unidade - Nome'] == 'PIRAI'].iloc[0]
out['fat_emp'] = {k: num(fe[k]) for k in fe.index if any(k.startswith(p) for p in ['equipamentoAtivo', 'equipamentoParado', 'equipeAtiva', 'estacionariaAtivo', 'outraDespesa', 'qlpAdm']) and k.endswith(('Quantidade', 'ValorUnitario', 'FreteLiquido', 'FreteCtrc'))}

# ── Armazém: uma empilhadeira ──
e = q(ft('ARMAZEM', 'EmpilhadeiraApoio')) if len(q(ft('ARMAZEM', 'EmpilhadeiraApoio'))) else ft('ARMAZEM', 'EmpilhadeiraApoio').query('_ano == 2026 and _mes == 9')
ee = e.iloc[0]
out['empilhadeira'] = {k: (num(ee[k], 4) if isinstance(ee[k], (int, float, np.floating, np.integer)) else str(ee[k])[:60]) for k in ee.index if not k.startswith(('Unidade', 'Operador', '_', 'Organizacao', 'Prazo'))}
json.dump(out, open('manual.json', 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps(out['conf'], ensure_ascii=False), out['placa']['Placa'], out['trecho']['Origem'][:40])
