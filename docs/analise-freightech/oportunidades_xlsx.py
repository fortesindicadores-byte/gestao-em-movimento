# Planilha das oportunidades com a Ambev (detalhe do deck-oportunidades).
# Uso: na pasta onde rodou oportunidades.py:  python3 oportunidades_xlsx.py  →  out/Oportunidades_Ambev_FT.xlsx
# O .xlsx NÃO vai para o repositório (placas e remuneração).
import os, json, pandas as pd, numpy as np
from openpyxl import Workbook
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.styles import Font, Alignment
from openpyxl.utils import get_column_letter
O = json.load(open('opo.json')); D = pd.read_pickle('opo_det.pkl')
NOME = {'BLC': 'Camboriú', 'CBA': 'Cuiabá', 'FLP': 'Florianópolis', 'GRL': 'Guarulhos', 'NFR': 'Nova Friburgo', 'PLT': 'Pelotas', 'CGR': 'Rio de Janeiro', 'RON': 'Rondonópolis', 'MCC': 'Macacu', 'PIR': 'Piraí', 'GNA': 'Goiânia'}
wb = Workbook(); wb.remove(wb.active); NT = [0]

def aba(nome, df, fmt=None, larg=None, nota=None):
    ws = wb.create_sheet(nome); r0 = 1
    if nota:
        ws.cell(1, 1, nota).font = Font(italic=True, color='555555'); r0 = 3
    cols = list(df.columns)
    for j, c in enumerate(cols, 1):
        ws.cell(r0, j, c).font = Font(bold=True)
    for i, row in enumerate(df.itertuples(index=False), r0 + 1):
        for j, v in enumerate(row, 1):
            if isinstance(v, (np.floating, float)) and not np.isfinite(v): v = None
            elif isinstance(v, np.generic): v = v.item()
            ws.cell(i, j, v)
    n = r0 + len(df)
    if len(df):
        NT[0] += 1
        t = Table(displayName=f'T{NT[0]}', ref=f'A{r0}:{get_column_letter(len(cols))}{n}')
        t.tableStyleInfo = TableStyleInfo(name='TableStyleMedium2', showRowStripes=True); ws.add_table(t)
    for j, c in enumerate(cols, 1):
        L = get_column_letter(j); f = (fmt or {}).get(c)
        if f:
            for i in range(r0 + 1, n + 1): ws[f'{L}{i}'].number_format = f
        ws.column_dimensions[L].width = (larg or {}).get(c, max(12, min(40, len(str(c)) + 4)))
    ws.freeze_panes = ws.cell(r0 + 1, 1)
    return ws

R2, R0, R3, P1 = '#,##0.00', '#,##0', '0.000', '0.0%'

# ── Resumo ──
VW = O['vw']['ano']; Z = O['zero']['ano']; FI = O['fator']['impacto']
res = pd.DataFrame([
  [1, 'Contrato da montadora acima do que o FT paga de manutenção', '2025–2026', VW['2025']['gap'] + VW['2026']['gap'], 'Média', 'O1 VW x FT', 'Rever o R$/km de manutenção das placas com contrato VW; incluir as que estão com zero.'],
  [2, 'Manutenção zero no FT fora da carência (sem fatura VW)', '2022–2026', sum(z['sem_vw_bid'] for z in Z.values()), 'Média', 'O2 Manut zero', 'Regra para caminhão fora da carência sem contrato; pagar ao menos o BID.'],
  [3, 'Diesel de Macacu lançado a R$ 1,85 (1ª ago/25), Rota', '2025', O['preco']['valor'], 'Alta', 'O3 Diesel ago25', 'Retroativo ao preço da ANP.'],
  [3, 'Diesel de Macacu lançado a R$ 1,85 (1ª ago/25), Empurrada (estimativa)', '2025', O['preco']['emp']['perda'], 'Média', 'O3 Diesel ago25', 'Conferir com o planejamento o que foi pago nos trechos.'],
  [4, 'Fator de crédito de imposto da Empurrada (Cuiabá 2026, Macacu × Piraí)', '2025–2026', sum(x['imp'] for x in FI.values()), 'Baixa', 'O4 Fator credito', 'Fiscal confirma o crédito recuperado antes de levar.'],
  [5, 'Km/L remunerado: revisão do Q4 não feita, mudança fora da revisão, ativas zeradas', '2026', O['kml']['disp_rs'], 'Alta', 'PDF/planilha do Km/L', 'Valor = só a dispersão do mesmo modelo; a revisão do Q4 define o resto.'],
  [6, 'Caminhão que roda sem estar ativo no FT', '2026', None, 'Baixa', 'O6 Km', f"{O['kml']['km_inat']:,.0f} km em {O['kml']['pl_inat']} placas; cruzar com as paradas."],
], columns=['#', 'Oportunidade', 'Período', 'Ordem de grandeza (R$)', 'Confiança', 'Aba', 'O que pedir / fazer'])
res['Status'] = None; res['Resposta da Ambev'] = None
aba('Resumo', res, {'Ordem de grandeza (R$)': R0}, {'Oportunidade': 70, 'O que pedir / fazer': 70, 'Aba': 20, 'Resposta da Ambev': 40})

# ── O1 ──
j = D['vw'].copy()
o1 = pd.DataFrame({'Vigência': j.vigencia, 'Unidade': j.cod.map(lambda c: NOME.get(c, c)), 'Placa': j.pl, 'Modelo': j['mod'], 'Canal FT': j.canal,
  'Contrato VW': j.contr, 'Km faturado': j.km, 'Fatura VW (R$)': j.valor, 'R$/km VW': j.rk_vw, 'R$/km manutenção FT': j.rk_ft,
  'BID FT': j.bid, 'Vida (meses)': j.vida, 'FT zero?': np.where(j.ft0, 'Sim', 'Não'), 'Diferença (R$)': j.gap}).sort_values(['Vigência', 'Diferença (R$)'], ascending=[True, False])
aba('O1 VW x FT', o1, {'Km faturado': R0, 'Fatura VW (R$)': R2, 'R$/km VW': R3, 'R$/km manutenção FT': R3, 'BID FT': R3, 'Vida (meses)': '0.0', 'Diferença (R$)': R2},
    nota='Diferença = (R$/km da fatura VW − R$/km de manutenção do FT na placa e mês) × km faturado. FT = média das quinzenas do mês, placa ativa.')

# ── O2 ──
z = D['zero'].copy()
o2 = pd.DataFrame({'Ano': z._ano, 'Vigência': z.vig, 'Quinzena': z._qz, 'Unidade': z.cod.map(lambda c: NOME.get(c, c)), 'Placa': z.pl, 'Modelo': z['mod'],
  'Vida (meses)': z.manutencaoVidaMeses, 'BID R$/km': z.manutencaoBid, 'Km da quinzena (FT)': z.km_q, 'Potencial ao BID (R$)': z.pot,
  'Placas irmãs com contrato': z.irm, 'R$/km das irmãs': z.rk_irm, 'Potencial às irmãs (R$)': z.pot_irm,
  'Tem fatura VW no mês?': np.where(z.tem_vw, 'Sim (está no O1)', 'Não')}).sort_values(['Ano', 'Unidade', 'Placa', 'Vigência', 'Quinzena'])
o2['Validação da unidade'] = None
aba('O2 Manut zero', o2, {'Vida (meses)': '0.0', 'BID R$/km': R3, 'Km da quinzena (FT)': R0, 'Potencial ao BID (R$)': R2, 'R$/km das irmãs': R3, 'Potencial às irmãs (R$)': R2},
    nota='Placas da Rota ativas no FT, com mais de 24 meses de vida e R$/km de manutenção zero. O total do deck soma só as linhas sem fatura VW no mês.')

# ── O3 ──
o3 = pd.DataFrame(O['preco']['baixo']).rename(columns={'canal': 'Canal', 'cod': 'Unidade', 'ano': 'Ano', 'mes': 'Mês', 'qz': 'Quinzena', 'tipo': 'Combustível', 'op': 'Nosso preço no FT', 'anp': 'ANP no FT'})
e = O['preco']['emp']
o3['Base do valor'] = ['Rota: litros das placas ativas (km ÷ km/L) × (ANP − nosso preço)' if c == 'ROTA' else f"Empurrada: meia quinzena de diesel de jul/25 (R$ {e['meia_qz']:,.0f}) × (1 − R$/km do trecho {e['rskm_erro']} ÷ {e['rskm_normal']})" for c in o3.Canal]
o3['Valor estimado (R$)'] = [O['preco']['valor'] if c == 'ROTA' else e['perda'] for c in o3.Canal]
aba('O3 Diesel ago25', o3, {'Nosso preço no FT': R2, 'ANP no FT': R2, 'Valor estimado (R$)': R0}, {'Base do valor': 90})

# ── O4 ──
fq = D['fator_qz']; fq = fq.assign(Unidade=fq.cod.map(NOME))[['Unidade', '_ano', '_mes', '_qz', 'f']].rename(columns={'_ano': 'Ano', '_mes': 'Mês', '_qz': 'Quinzena', 'f': 'Fator de crédito'})
ws = aba('O4 Fator credito', fq, {'Fator de crédito': R3}, nota='Fator = preço com crédito de imposto ÷ preço pago (menor entre nosso e ANP), diesel S10 da Empurrada. Quinzena de ago/25 de Macacu fora (erro da O3).')
em = D['fator_mes']
o4 = pd.DataFrame({'Unidade': em.cod.map(NOME), 'Vigência': em.vig, 'Remunerado diesel DRE (R$)': em.rem, 'Fator': em.f, 'Fator de referência': em.ref, 'Diferença estimada (R$)': em.imp})
aba('O4 Impacto mensal', o4[o4.Unidade.isin(['Cuiabá', 'Macacu', 'Piraí'])], {'Remunerado diesel DRE (R$)': R0, 'Fator': R3, 'Fator de referência': R3, 'Diferença estimada (R$)': R0},
    nota='Referência: Cuiabá = 0,94 (o fator dela em 2024–25); Macacu = o fator de Piraí no mês (mesmo estado). Ordem de grandeza: depende do fiscal.')

# ── O6 / km ──
k = D['km']
o6 = pd.DataFrame({'Projeto': k.dproj, 'Unidade': k.cod.map(lambda c: NOME.get(c, c)), 'Vigência': k.vig, 'Teto FT (km)': k.kmtot, 'Km pago (Dispersão)': k['Km Rem. TT'],
  'Km rodado': k['Km Rodado TT'], 'Frota ativa': k['Frota Ativa'], 'Mapas possíveis': k.mapas_pos, 'Viagens': k['Viagens - Real'], 'Mapas não rodados': k.nao_rod,
  'Km por viagem': k['Km/Viagem Real'], 'R$/km variável FT': k.rskm, 'Variável que não entrou (R$)': k.rs_nao})
o6['Dispersão'] = o6['Km rodado'] / o6['Km pago (Dispersão)'] - 1
aba('O6 Km e mapas', o6, {'Teto FT (km)': R0, 'Km pago (Dispersão)': R0, 'Km rodado': R0, 'Mapas possíveis': R0, 'Viagens': R0, 'Mapas não rodados': R0,
    'Km por viagem': '0.0', 'R$/km variável FT': R3, 'Variável que não entrou (R$)': R0, 'Dispersão': P1},
    nota='Lição de casa (não vai à Ambev): mapa que não rodou e dispersão são gestão nossa. Mapas possíveis = frota ativa × 25.')

# ── diesel ERP × ANP ──
dz = D['diesel']
o7 = pd.DataFrame({'Canal': dz.canal.replace({'T2': 'Rota/AS/Van'}), 'Unidade': dz.cod.map(lambda c: NOME.get(c, c)), 'Mês': dz.mes, 'Quinzena': dz.qz, 'Litros (ERP)': dz.lit,
  'R$/L real': dz.real, 'Nosso preço no FT': dz.precoOperadora, 'ANP no FT': dz.precoAnp, 'Acima da ANP (R$)': dz.acima_anp})
aba('Diesel acima ANP 2026', o7, {'Litros (ERP)': R0, 'R$/L real': R2, 'Nosso preço no FT': R2, 'ANP no FT': R2, 'Acima da ANP (R$)': R0},
    nota='Lição de casa: abastecimentos S10 do ERP (notas encerradas) × preço da ANP no FT. O FT paga a ANP; o que passa dela é nosso.')

ws = wb.create_sheet('Leia-me', 0)
for i, t in enumerate([
  'Oportunidades de questionamento com a Ambev · Freightech 2022–2026',
  'Base: robô do Freightech (todas as quinzenas desde jan/2022), fatura Volks|Total (jan/25 em diante), abastecimentos do ERP, DRE Frota, Dispersão de km, análise do Km/L remunerado de 21/10/2026.',
  'Resumo: uma linha por oportunidade, com colunas para Status e Resposta da Ambev.',
  'O1 a O4: detalhe para levar à Ambev. O6 e Diesel acima ANP: lição de casa (gestão nossa).',
  'O2 tem a coluna "Validação da unidade": a unidade confirma quem pagou a manutenção das placas zeradas.',
  'Valores em R$; "potencial" é teto (o pago seria proporcional aos mapas rodados, ~90%).'], 1):
    ws.cell(i, 1, t).font = Font(bold=(i == 1), size=13 if i == 1 else 11)
ws.column_dimensions['A'].width = 140
os.makedirs('out', exist_ok=True); wb.save('out/Oportunidades_Ambev_FT.xlsx'); print('ok out/Oportunidades_Ambev_FT.xlsx')
