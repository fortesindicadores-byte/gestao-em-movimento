# ============================================================
# Manual Freightech, 3ª camada: o que as fórmulas exportadas do FT (modo
# `formulas` do robô) dizem, conferido contra os dados da quinzena do exemplo:
# parâmetros da unidade, pacote do SRTrans (a "DRE do mapa"), lucro por HL,
# Faturamento, recarga, Van e AS, e a regra exata da manutenção e da carroceria.
#   MES=9 PYTHONPATH=. python3 manual3.py   (na pasta com pq/)  → manual3.json
# ============================================================
import json, os
from comum import *
MES = int(os.environ.get('MES', 9)); UNI = os.environ.get('UNI', 'CDD CUIABA')
def q(d, qz=1): return d[(d._ano == 2026) & (d._mes == MES) & (d._qz == qz)]
def num(v, n=2):
    try: return None if pd.isna(v) else round(float(v), n)
    except Exception: return None
def row(d, **f):
    x = d
    for k, v in f.items(): x = x[x[k] == v]
    return x.iloc[0] if len(x) else None
out = {'vig': f'1ª quinzena de {MES:02d}/2026', 'uni': UNI}
# ── parâmetros gerais da unidade ──
p = row(q(ft('ROTA', 'ParametrosGeraisRota')), **{'Unidade - Nome': UNI})
out['param'] = {'risco': num(p['Risco']), 'seguro_fixo': num(p['Seguro']), 'faixa': num(p['Faixa Reflexiva']), 'rastreador': num(p['Rastreador']), 'km1v': num(p['KM Mensal Primeira Viagem']),
                'km_noturna': num(p['KM Mensal Noturna']), 'km_recarga': num(p['KM Recarga por Viagem']), 'km_van': num(p['kmMensalRemuneradoVan']), 'pis': num(p['PIS Real']), 'cofins': num(p['COFINS Real']),
                'iss': num(p['ISS']), 'icms': num(p['ICMS']), 'dentro': num(p['Frota Fixa Dentro do Município']), 'fora': num(p['Frota Fixa Fora do Município']), 'dias': int(p['Quantidade Mês']),
                'lavagem': {k: num(p[f'custoLavagem{k}p']) for k in [4, 6, 8, 10, 12, 14, 28]} | {'van': num(p['custoLavagemVan'])}, 'regiao': str(p['Região'])}
# rastreador por unidade (parâmetro)
pp = q(ft('ROTA', 'ParametrosGeraisRota'))
out['rastreador_uni'] = {FTU.get(r['Unidade - Nome'], r['Unidade - Nome']): num(r['Rastreador']) for _, r in pp.iterrows()}
out['km1v_uni'] = {FTU.get(r['Unidade - Nome'], r['Unidade - Nome']): num(r['KM Mensal Primeira Viagem']) for _, r in pp.iterrows()}
# ── Resumo e SRTrans (pacote por caminhão) ──
r = row(q(ft('ROTA', 'Resumo')), **{'Unidade - Nome': UNI})
RK = ['Total por Caminhão Frota Ativa', 'Total por Caminhão Frota Parada', 'Total por Caminhão Equipe de Entrega', 'Total por Caminhão QLP ADM', 'Total por Caminhão Outras Despesas', 'Total por Caminhão Viagens',
      'Total por Caminhão Operacional Previsto', 'Lucro Fixo Modelo Novo', 'Lavagem', 'KM Remunerado', 'Total R$/KM', 'Combustível R$/KM', 'Manutenção Caminhão R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu R$/KM',
      'Total Caminhão Ativo', 'Total Caminhão Parado', 'FINAME Modelo Novo', 'Seguro', 'IPVA Licen. Mensal', 'Rastreador', 'Faixa Reflexiva', 'FINAME Modelo Novo Parado', 'Seguro Parado', 'IPVA Licenc. Mensal Parado',
      'Faixa Reflexiva Parado', 'Rastreador Parado', 'Lucro Fixo Modelo Novo Parado', 'Total Viagens', 'Total Frota Ativa', 'Total Frota Parada', 'Total Equipe Entrega', 'Total QLP ADM', 'Total Outras Despesas', 'Salário', 'Encargos e Provisões', 'Benefícios', 'FAD', 'Incentivo']
out['resumo'] = {k: num(r[k]) for k in RK if k in r.index}
s = row(q(ft('ROTA', 'ResumoSrtrans')), **{'Unidade - Nome': UNI})
SK = ['Custo Fixo Padrão', 'Custo Fixo FINAME', 'Custo Variável Padrão', 'Custos Indiretos Padrão', 'Custo Equipe de Entrega Padrão', 'Lucro Padrão', 'Número Mínimo de Viagens', 'Total Veículo Padrão', 'Total Veículos Inativos FINAME', 'Custo Variável Recarga', 'Custo Equipe de Entrega Noturna', 'Custo Variável Noturna', 'Meta']
out['srtrans'] = {k: num(s[k]) for k in SK if s is not None and k in s.index}
l = row(q(ft('ROTA', 'LucroNovo')), **{'Unidade - Nome': UNI})
out['lucro'] = {'lucro': num(l['Lucro']), 'rshl': num(l['R$/HL']), 'volume': num(l['Volume Atual'])} if l is not None else {}
f = row(q(ft('ROTA', 'Faturamento')), **{'Unidade - Nome': UNI})
FK = {'fixo_ativo_cam': 'Remuneração Fixa Frota Ativa Líquido Por Caminhão', 'fixo_parado_cam': 'Remuneração Fixa Frota Parada Líquido por Caminhão', 'var_cam': 'Custo Variável Líquido por Caminhão',
      'equipe_cam': 'Remuneração Fixa Equipe de Entrega Líquido por Caminhão', 'qlp_cam': 'Remuneração Fixa QLP ADM Líquido por Caminhão', 'outras_cam': 'Remuneração Outras Despesas Líquido por Caminhão',
      'lucro_var_cam': 'Lucro Operacional Variável Líquido por Caminhão', 'rv_cam': 'Remuneração Variável Líquido por Caminhão', 'total_liq_cam': 'Total Líquido por Caminhão', 'imp_dentro': 'Imposto Dentro Município Bruto',
      'imp_fora': 'Imposto Fora Município Bruto', 'dentro': 'Dentro do Município Bruto', 'fora': 'Fora do Município Bruto', 'total_bruto': 'Total', 'total_liq': 'Total Líquido', 'var_liq': 'Custo Variável Líquido',
      'fixo_ativo': 'Remuneração Fixa Frota Ativa Líquido', 'fixo_parado': 'Remuneração Fixa Frota Parada Líquido', 'ativos': 'Total Caminhão Ativo', 'parados': 'Total Caminhão Parado'}
out['fat'] = {k: num(f[v]) for k, v in FK.items() if f is not None and v in f.index}
rc = row(q(ft('ROTA', 'Recarga')), **{'Unidade - Nome': UNI})
out['recarga'] = {'km': num(rc['KM por Viagem']), 'var_cam': num(rc['Custo Variável Caminhão']), 'lucro': num(rc['Lucro']), 'equipe': num(rc['Custo Variável Equipe de Entrega']), 'total': num(rc['Custo Variável Recarga']), 'rskm': num(rc['Custo Variável por KM'])} if rc is not None else {}
# ── Van e AS: um exemplo cada ──
v = q(ft('ROTA', 'Van')); v = v[(v.ativo.astype(str).str.lower() == 'true') & (v['Unidade - Nome'] == UNI)]
if len(v):
    x = v.iloc[0]; out['van'] = {k: num(x[k]) for k in ['kmMesRoadShow', 'kmTotal', 'consumoKMPorLitro', 'consumoReaisPorKm', 'manutencaoReaisPorKm', 'manutencaoCarroceriaReaisPorKm', 'pneuPorKm', 'lavagemPorKm', 'totalCustoVariavel', 'totalCustoFixo', 'finameModeloNovo', 'seguro', 'ipvaLicenciamento', 'lavagem', 'rastreador', 'faixaReflexiva'] if k in v.columns} | {'placa': str(x.placa), 'placas': int(v.placa.nunique())}
a = q(ft('AS', 'CaminhaoAS')); a = a[a.Ativo == True]
pa = q(ft('AS', 'ParametrosGeraisAS')) if 'ParametrosGeraisAS' in [p_.split('__')[1][:-8] for p_ in os.listdir('pq') if p_.startswith('AS__')] else None
if len(a):
    x = a.sort_values('KM Mês Roadshow', ascending=False).iloc[0]
    out['as'] = {k: num(x[k]) for k in ['KM Mês Roadshow', 'Consumo KM/L', 'Consumo R$/KM', 'Manutenção R$/KM', 'Manutenção Carroceria R$/KM', 'Pneu por KM', 'Lavagem por KM', 'Total Custo Variável', 'Total Custo Fixo', 'FINAME Modelo Novo', 'Seguro', 'IPVA Licenciamento'] if k in a.columns} | {'placa': str(x.Placa), 'uni': FTU.get(x['Unidade - Nome'], x['Unidade - Nome']), 'placas': int(a.Placa.nunique())}
    if pa is not None and len(pa):
        y = pa[pa['Unidade - Nome'] == x['Unidade - Nome']]; y = y.iloc[0] if len(y) else pa.iloc[0]
        out['as']['lavagem_custo'] = num(y.get('Custo de Lavagem', y.get('custoLavagem', None))); out['as']['lavagens'] = num(y.get('Quantidade de Lavagens', None), 0)
# ── carroceria: a fórmula exportada é valorPorMes ÷ kmTotal + 0,02 — conferência placa a placa ──
c = q(ft('ROTA', 'Caminhao')); ca = c[(c.Ativo == True) & (c['KM Total'] > 0)].copy()
mc = q(ft('ROTA', 'ManutencaoCarroceria')); mc['k'] = mc['Unidade - Nome'] + '|' + mc.Material.astype(str).str.strip() + '|' + mc.Perfil.astype(str).str.strip() + '|' + mc.Tipo.astype(str).str.strip()
vm = mc.groupby('k')['Valor por Mês'].first()
ca['k'] = ca['Unidade - Nome'] + '|' + ca.Material.astype(str).str.strip() + '|' + ca.Perfil.astype(str).str.strip() + '|' + ca.Tipo.astype(str).str.strip()
ca['vm'] = ca.k.map(vm); cc = ca[ca.vm.notna()].copy(); cc['calc'] = cc.vm / cc['KM Total'] + 0.02
out['carr_check'] = {'placas': int(len(cc)), 'bate_pct': round(float(((cc.calc - cc['Manutenção Carroceria R$/KM']).abs() < 0.006).mean() * 100), 1),
                     'sem_ajuste_pct': round(float(((cc.vm / cc['KM Total'] - cc['Manutenção Carroceria R$/KM']).abs() < 0.006).mean() * 100), 1)}
ex = cc[cc.Placa == os.environ.get('PLACA', 'UDT2F07')]
if len(ex): e = ex.iloc[0]; out['carr_check']['ex'] = {'placa': e.Placa, 'vm': num(e.vm), 'km': num(e['KM Total']), 'calc': num(e.calc, 4), 'campo': num(e['Manutenção Carroceria R$/KM'])}
out['carr_tabela'] = [{'material': str(x.Material).strip(), 'perfil': str(x.Perfil).strip(), 'tipo': str(x.Tipo).strip(), 'ano': num(x['Valor por Ano']), 'mes': num(x['Valor por Mês'])} for _, x in mc[mc['Unidade - Nome'] == UNI].drop_duplicates(['Material', 'Perfil', 'Tipo']).iterrows()][:10]
# ── pneu: (0,8 liso + 0,2 tração + 2 recapagens + câmara + protetor + montagem) × pneus ÷ vida ──
pn = ca.copy()
pn['calc'] = ((pn['Quantidade de Pneus'] * 0.8 * pn['Preço Liso'] + pn['Quantidade de Pneus'] * 0.2 * pn['Preço Tração']) + pn['Quantidade de Pneus'] * pn['Quantidade de Recapagem'] * pn['Preço Recapagem']
              + pn['Quantidade de Pneus'] * (pn['Preço da Câmara'].fillna(0) + pn['Preço Protetor'].fillna(0) + pn['Preço Montagem'].fillna(0))) / pn['Vida Pneus KM']
out['pneu_check'] = {'placas': int(len(pn)), 'bate_pct': round(float(((pn.calc - pn['Pneu por KM']).abs() < 0.006).mean() * 100), 1), 'montagem_med': num(pn['Preço Montagem'].median())}
e = pn[pn.Placa == os.environ.get('PLACA', 'UDT2F07')]
if len(e): e = e.iloc[0]; out['pneu_check']['ex'] = {'liso': num(e['Preço Liso']), 'tracao': num(e['Preço Tração']), 'recap': num(e['Preço Recapagem']), 'montagem': num(e['Preço Montagem']), 'camara': num(e['Preço da Câmara']), 'protetor': num(e['Preço Protetor']), 'qtd': num(e['Quantidade de Pneus'], 0), 'nrec': num(e['Quantidade de Recapagem'], 0), 'vida': num(e['Vida Pneus KM'], 0), 'calc': num(e.calc, 4), 'campo': num(e['Pneu por KM'])}
# ── manutenção: a regra exata (manutencaoReaisKm) ──
m = ca.copy(); m['meses'] = m.manutencaoVidaMeses - m.freeMaintenance; m['manutencaoAno'] = pd.to_numeric(m.manutencaoAno, errors='coerce').fillna(0)
m['grupo'] = np.select([m.meses <= 0, (m.manutencaoContrato.fillna(0) > 0) & ((m.manutencaoCompraForaDoBidAutorizada.astype(str).str.lower().isin(['true', '1'])) | (m.manutencaoContrato < m.manutencaoBid)),
                        (m.manutencaoContrato.fillna(0) > 0) & (m.manutencaoBid.fillna(0) > 0), (m.manutencaoBid.fillna(0) > 0) & (m.manutencaoAno >= 2019), m.manutencaoBid.fillna(0) > 0],
                       ['carência', 'contrato (menor que o BID ou compra fora autorizada)', 'BID (contrato maior que o BID)', 'BID × 90% (sem contrato, BID 2019+)', 'BID × 100% (sem contrato, BID antigo)'], 'tabela por idade (sem BID)')
m['rk'] = m['Manutenção R$/KM']
grp = m.groupby('grupo').agg(placas=('Placa', 'nunique'), rk=('rk', 'median'), bid=('manutencaoBid', 'median'), contrato=('manutencaoContrato', 'median'), vida=('manutencaoVidaMeses', 'median'))
out['manut_grupos'] = {g: {'placas': int(x.placas), 'rk': num(x.rk, 3), 'bid': num(x.bid, 3), 'contrato': num(x.contrato, 3), 'vida': num(x.vida, 1)} for g, x in grp.iterrows()}
# conferência da regra: reproduz o Manutenção R$/KM nas placas com BID
def regra(x):
    if x.meses <= 0: return 0
    if x.manutencaoContrato > 0 and x.manutencaoBid > 0:
        return x.manutencaoContrato if (str(x.manutencaoCompraForaDoBidAutorizada).lower() in ('true', '1') or x.manutencaoContrato < x.manutencaoBid) else x.manutencaoBid
    if x.manutencaoBid > 0: return x.manutencaoBid * 0.9 if x.manutencaoAno >= 2019 else x.manutencaoBid
    return np.nan
m['calc'] = m.apply(regra, axis=1); mm = m[m.calc.notna()]
out['manut_check'] = {'placas': int(len(mm)), 'bate_pct': round(float(((mm.calc - mm.rk).abs() < 0.006).mean() * 100), 1)}
exs = {}
for g, x in m.groupby('grupo'):
    x = x.sort_values('KM Mês Roadshow', ascending=False); e = x.iloc[0]
    exs[g] = {'placa': e.Placa, 'uni': FTU.get(e['Unidade - Nome']), 'modelo': str(e['Modelo do Cavalo'])[:26], 'vida': num(e.manutencaoVidaMeses, 1), 'bid': num(e.manutencaoBid), 'contrato': num(e.manutencaoContrato), 'rk': num(e.rk), 'ano_bid': num(e.manutencaoAno, 0), 'fora': str(e.manutencaoCompraForaDoBidAutorizada)}
out['manut_ex'] = exs
# tabela por idade (ManutencaoCavalo) da unidade, capacidade 10
mcav = q(ft('ROTA', 'ManutencaoCavalo')); mcav = mcav[mcav['Unidade - Nome'] == UNI].copy()
mcav['cap'] = mcav['Capacidade Caminhão'].astype(str).str.extract(r'Capacidade: ([^|]+)')[0].str.strip()
out['tab_idade'] = mcav[mcav.cap == '10.0'][['Ano', 'KM 1000', 'KM 1500', 'KM 2000', 'KM 2500', 'KM 3000']].sort_values('Ano').round(2).to_dict('records')
bid = q(ft('ROTA', 'ManutencaoBidRota')); bid['ano'] = pd.to_numeric(bid.ano, errors='coerce'); bid = bid[(bid.ganhadorBid == 1) & (bid.ano >= 2021)]
out['bid_tabela'] = bid[['ano', 'capacidadePallets', 'montadora', 'valorFaixa1', 'valorFaixa2', 'valorFaixa3', 'kmApartirDe2', 'kmApartirDe3']].drop_duplicates(['ano', 'capacidadePallets']).sort_values(['ano', 'capacidadePallets']).head(8).astype(str).to_dict('records')
# ── Km/L: benchmark por capacidade (CapacidadeCaminhao) e o campo fixo por placa ──
cap = q(ft('ROTA', 'CapacidadeCaminhao')); cap = cap[cap['Unidade - Nome'] == UNI]
out['bench_cap'] = {str(num(x.Capacidade, 0)): num(x.Consumo) for _, x in cap.iterrows()}
# ── FINAME: taxa composta e a conferência SAC × PRICE ──
e = ca[ca.Placa == os.environ.get('PLACA', 'UDT2F07')]
if len(e):
    e = e.iloc[0]; tj, sb, sk = e['TJLP (%)'], e['Spread BNDES'], e['Spread Banco (%)']
    out['finame'] = {'tjlp': num(tj), 'spread_bndes': num(sb), 'spread_banco': num(sk), 'taxa_calc': num(((1 + tj / 100) * (1 + sb / 100) * (1 + sk / 100) - 1) * 100), 'taxa_campo': num(e['Taxa FINAME']), 'mes_parcela': num(e['Mês da Parcela'], 0), 'odometro': num(e['KM Odômetro'], 0), 'odometro_prev': num(e['Odômetro Previsto'], 0), 'litragem': num(e['Litragem'])}
json.dump(out, open('manual3.json', 'w'), ensure_ascii=False, indent=1, default=str)
print(json.dumps({k: out[k] for k in ['param', 'srtrans', 'lucro', 'fat', 'recarga', 'carr_check', 'pneu_check', 'manut_grupos', 'manut_check', 'finame', 'bench_cap']}, ensure_ascii=False, default=str)[:3500])
print(out.get('van'), out.get('as'))
