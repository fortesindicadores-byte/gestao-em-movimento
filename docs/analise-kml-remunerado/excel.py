# ============================================================
# Planilha de cobrança — Consumo remunerado Km/L (Renan, 21/10/2026:
# "Além do material, traga um arquivo em excel com a base que mandei, e abas
# para mostrar os gaps e cobrarmos a ambev, estratificando").
#
#   python3 excel.py <planilha do FT .xlsx> <gaps.json do analise.mjs> <saída .xlsx>
#
# A base vai como veio (6 colunas, mesma ordem) + colunas derivadas ao lado.
# Cada gap é uma aba de detalhe placa a placa (Tabela do Excel com filtro);
# "Estratificação" e "Resumo" são FÓRMULAS sobre essas abas, então mudar ou
# filtrar o detalhe muda os totais. Campo Grande (outra pauta), as elétricas e
# Pelotas AS ficam fora das abas de gap, mas continuam na base, marcados.
# ============================================================
import json, sys
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter as L
from openpyxl.comments import Comment

SRC, GAPS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
G = json.load(open(GAPS, encoding='utf8'))
MES = G['MESES']
QZL = {q['t']: q['label'] for q in G['QZ']}

F = 'Arial'
f_txt = Font(name=F, size=10)
f_b = Font(name=F, size=10, bold=True)
f_tit = Font(name=F, size=16, bold=True, color='0F1A20')
f_kick = Font(name=F, size=9, bold=True, color='F22C05')
f_nota = Font(name=F, size=9, italic=True, color='4A5563')
f_hdr = Font(name=F, size=10, bold=True, color='FFFFFF')
fill_hdr = PatternFill('solid', fgColor='0F1A20')
fill_tot = PatternFill('solid', fgColor='E3E6EA')
fill_in = PatternFill('solid', fgColor='FFFF00')
fill_ruim = PatternFill('solid', fgColor='FCE0DA')
fill_bom = PatternFill('solid', fgColor='DCE8FC')
fill_pale = PatternFill('solid', fgColor='F3F4F6')
fino = Side(style='thin', color='D0D4DA')
FMT_KML = '0.00'
FMT_INT = '#,##0;-#,##0;-'
FMT_PCT = '+0.0%;-0.0%;0.0%'

wb = Workbook()
wb.remove(wb.active)

def up_split(up):
    u, p = up.split(' · ')
    return u, p

def titulo(ws, kicker, tit, nota=None, linha=1):
    ws.cell(linha, 1, kicker).font = f_kick
    ws.cell(linha + 1, 1, tit).font = f_tit
    if nota:
        ws.cell(linha + 2, 1, nota).font = f_nota
    return linha + (4 if nota else 3)

def tabela(ws, nome, r0, cab, linhas, fmts=None, larg=None, estilo='TableStyleMedium2'):
    """Escreve uma Tabela do Excel a partir da linha r0. Valor que começa com '=' vira fórmula
    (use {r} para a linha atual). Devolve a última linha."""
    for j, c in enumerate(cab, 1):
        ws.cell(r0, j, c).font = f_hdr
    for i, lin in enumerate(linhas, r0 + 1):
        for j, v in enumerate(lin, 1):
            if isinstance(v, str) and v.startswith('='):
                v = v.replace('{r}', str(i))
            c = ws.cell(i, j, v)
            c.font = f_txt
            if fmts and fmts[j - 1]:
                c.number_format = fmts[j - 1]
    fim = r0 + max(len(linhas), 1)
    t = Table(displayName=nome, ref=f'A{r0}:{L(len(cab))}{fim}')
    t.tableStyleInfo = TableStyleInfo(name=estilo, showRowStripes=True)
    ws.add_table(t)
    for j, w in enumerate(larg or [], 1):
        ws.column_dimensions[L(j)].width = w
    ws.freeze_panes = ws.cell(r0 + 1, 1)
    return fim

# ───────────────────────── Base FT ─────────────────────────
src = load_workbook(SRC, read_only=True).worksheets[0]
orig = [r for r in src.iter_rows(min_row=2, values_only=True) if any(v is not None for v in r)]
base = G['base']
assert len(orig) == len(base), (len(orig), len(base))
ws = wb.create_sheet('Base FT')
cab = ['Projeto', 'Vigencia', 'Unidade - Nome', 'Consumo KM/L', 'Placa', 'Ativo',
       'Unidade', 'Unidade · Projeto', 'Ano', 'Mês', 'Quinzena', 'Trimestre', 'Placa (Mercosul)', 'Modelo', 'Fora da análise']
linhas = []
for o, b in zip(orig, base):
    assert str(o[4]).strip() == b['placaOrig'], (o, b['placaOrig'])
    linhas.append(list(o[:6]) + [b['uni'], b['up'], b['ano'], MES[b['mes'] - 1], QZL[b['t']], f"Q{b['q']}", b['placa'], b['modelo'], b['fora'] or ''])
fim = tabela(ws, 'BaseFT', 1, cab, linhas,
             fmts=[None, None, None, FMT_KML] + [None] * 11,
             larg=[12, 18, 22, 14, 11, 8, 10, 18, 7, 7, 10, 10, 15, 20, 26])

def detalhe_up(lin):
    return [x for x in lin]

# ───────────────────── G1 · Revisão do Q4 ─────────────────────
ws = wb.create_sheet('G1 Revisão Q4')
r0 = titulo(ws, '1 · REVISÃO DO 3º PARA O 4º TRIMESTRE', 'Placa a placa: o valor da 2ª quinzena de setembro contra a 1ª de outubro',
            'A revisão trimestral entra na 1ª quinzena do trimestre (1ª abr e 1ª jul mudaram 185 e 241 placas). Em 1ª out nenhuma mudou: o Q4 roda com a régua do Q3.')
lin = []
for x in sorted(G['q3q4Placas'], key=lambda x: (x['up'], x['modelo'], x['placa'])):
    u, p = up_split(x['up'])
    lin.append([x['up'], u, p, x['placa'], x['modelo'], x['set2'], x['out1'],
                '=IF(OR(F{r}="",G{r}=""),"",G{r}-F{r})', x['situacao']])
tabela(ws, 'G1_RevisaoQ4', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Modelo', 'Km/L 2ª set', 'Km/L 1ª out', 'Variação (km/L)', 'Situação'],
       lin, fmts=[None, None, None, None, None, FMT_KML, FMT_KML, '+0.00;-0.00;0.00', None], larg=[18, 10, 12, 11, 20, 12, 12, 14, 16])

# por revisão (fronteiras): quantas placas mudaram em cada 1ª quinzena do trimestre
fr = G['fronteiras']
ws2 = ws
c0 = 11
ws2.cell(r0 - 1, c0, 'Quantas placas mudaram em cada revisão').font = f_b
for j, h in enumerate(['Revisão', 'Quinzena', 'Ativas nas duas quinzenas', 'Mudaram', 'Mesmo valor'], c0):
    c = ws2.cell(r0, j, h); c.font = f_hdr; c.fill = fill_hdr
for i, (rot, t) in enumerate([('Q2', 6), ('Q3', 12), ('Q4', 18)], r0 + 1):
    f = fr[str(t)]
    vals = [rot, QZL[t], f['iguais'] + f['mudaram'], f['mudaram'], f['iguais']]
    for j, v in enumerate(vals, c0):
        c = ws2.cell(i, j, v); c.font = f_txt
    if rot == 'Q4':
        for j in range(c0, c0 + 5):
            ws2.cell(i, j).fill = fill_ruim
for j, w in enumerate([10, 10, 22, 10, 12], c0):
    ws2.column_dimensions[L(j)].width = w

# ───────────────────── G2 · Mesmo modelo, valores diferentes ─────────────────────
ws = wb.create_sheet('G2 Mesmo modelo')
r0 = titulo(ws, '2 · MESMO MODELO, VALORES DIFERENTES', 'Placa × mês contra a mediana do próprio modelo na operação',
            'Litros vs mediana = km rodado da placa no mês (aba Km/L) × (1/mediana − 1/valor). Positivo = a placa recebe MENOS litros que a mediana do modelo pagaria (contra nós). Negativo = recebe mais (a favor).')
lin = []
for x in sorted(G['dispPlacas'], key=lambda x: (x['up'], x['modelo'], x['mes'], x['placa'])):
    u, p = up_split(x['up'])
    lin.append([x['up'], u, p, x['mes'], MES[x['mes'] - 1], x['modelo'], x['placa'], x['v'], x['mediana'], x['min'], x['max'], x['n'],
                '=IF(I{r}=0,"",H{r}/I{r}-1)', round(x['km']),
                '=IF(OR(H{r}=0,I{r}=0),0,N{r}*(1/I{r}-1/H{r}))',
                '=IF(K{r}-J{r}>0.005,"sim","não")',
                '=IF(ABS(O{r})<0.5,"—",IF(O{r}>0,"contra nós","a favor"))'])
fim_g2 = tabela(ws, 'G2_MesmoModelo', r0,
       ['Unidade · Projeto', 'Unidade', 'Projeto', 'Mês nº', 'Mês', 'Modelo', 'Placa', 'Km/L da placa', 'Mediana do modelo', 'Menor do modelo', 'Maior do modelo', 'Placas do modelo', 'Desvio vs mediana', 'Km rodado (aba Km/L)', 'Litros vs mediana', 'Modelo com valores diferentes?', 'Lado'],
       lin, fmts=[None, None, None, '0', None, None, None, FMT_KML, FMT_KML, FMT_KML, FMT_KML, '0', FMT_PCT, FMT_INT, FMT_INT, None, None],
       larg=[18, 10, 12, 7, 6, 20, 11, 11, 12, 11, 11, 10, 12, 14, 13, 14, 12])

# ───────────────────── G3 · Ativação ─────────────────────
ws = wb.create_sheet('G3 Ativação')
r0 = titulo(ws, '3 · ATIVAÇÃO', 'Cada placa que entrou ou saiu do ativo, com o valor dela contra a média da operação',
            'Média da operação = média simples das placas ativas na quinzena anterior (a régua "burra" do FT). Se a Ambev ativasse as melhores, as ativações ficariam acima da média e as desativações abaixo. Acaso = 50%.')
lin = []
for e in sorted(G['eventos'], key=lambda e: (e['up'], e['t'], e['placa'])):
    u, p = up_split(e['up'])
    modelo = next((b['modelo'] for b in base if b['placa'] == e['placa']), '(sem modelo)')
    lin.append([e['up'], u, p, e['placa'], modelo, e['t'], QZL[e['t']], e['tipo'], e['v'], e['media'],
                '=IF(I{r}<J{r},"abaixo da média","acima ou igual")', '=I{r}-J{r}'])
tabela(ws, 'G3_Ativacao', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Modelo', 'Quinzena nº', 'Quinzena', 'Evento', 'Km/L da placa', 'Média da operação', 'Posição', 'Diferença (km/L)'],
       lin, fmts=[None, None, None, None, None, '0', None, None, FMT_KML, FMT_KML, None, '+0.00;-0.00;0.00'],
       larg=[18, 10, 12, 11, 20, 10, 10, 11, 12, 13, 15, 13])

ws = wb.create_sheet('G3b Km inativas')
r0 = titulo(ws, '3 · ATIVAÇÃO', 'Placas que rodaram (aba Km/L) num mês em que estavam INATIVAS no FT',
            'Km sem régua remunerada: a placa rodou e consumiu, mas não entra na média que nos paga. Inativa = todas as quinzenas do mês marcadas inativas no FT.')
lin = []
for x in sorted(G['kmInatLinhas'], key=lambda x: (x['up'], x['mes'], -x['km'])):
    u, p = up_split(x['up'])
    lin.append([x['up'], u, p, x['mes'], MES[x['mes'] - 1], x['placa'], x['modelo'], round(x['km'])])
tabela(ws, 'G3b_KmInativas', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Mês nº', 'Mês', 'Placa', 'Modelo', 'Km rodado'],
       lin, fmts=[None, None, None, '0', None, None, None, FMT_INT], larg=[18, 10, 12, 7, 6, 11, 20, 12])

# ───────────────────── G4 · Ativas com consumo zero ─────────────────────
ws = wb.create_sheet('G4 Ativas zeradas')
r0 = titulo(ws, '4 · PLACAS ATIVAS COM CONSUMO ZERO', 'Todas na 1ª quinzena de abril (revisão do Q2), nas Empurradas: o valor novo chegou uma quinzena depois',
            'Se o FT conta o zero na média simples, a operação cai; se ignora, a placa rodou a quinzena sem régua. Irmãs = placas do mesmo modelo, na mesma operação e quinzena, ativas com valor.')
lin = []
for x in sorted(G['erros']['ativasZeroDet'], key=lambda x: (x['up'], x['modelo'], x['placa'])):
    u, p = up_split(x['up'])
    lin.append([x['up'], u, p, x['placa'], x['modelo'], x['t'],
                x['ant']['v'] if x['ant'] else None, x['prox']['v'] if x['prox'] else None,
                x['irmas'], x['irmasMin'], x['irmasMax'],
                '=IF(I{r}=0,"modelo inteiro zerado","irmãs com valor")'])
tabela(ws, 'G4_AtivasZeradas', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Modelo', 'Quinzena', 'Km/L 2ª mar', 'Km/L 2ª abr', 'Irmãs ativas com valor', 'Menor das irmãs', 'Maior das irmãs', 'Situação'],
       lin, fmts=[None, None, None, None, None, None, FMT_KML, FMT_KML, '0', FMT_KML, FMT_KML, None], larg=[18, 10, 12, 11, 20, 10, 12, 12, 12, 12, 12, 22])

# ───────────────────── G5 · Mudanças fora da revisão ─────────────────────
ws = wb.create_sheet('G5 Fora da revisão')
r0 = titulo(ws, '5 · MUDANÇAS DE VALOR FORA DA REVISÃO', 'Placa ativa cujo consumo remunerado mudou fora da 1ª quinzena do trimestre',
            'A régua só deveria mudar na revisão trimestral. Litros = km da placa (aba Km/L) enquanto o valor novo valeu, até set, × (1/antes − 1/depois). Positivo = menos litros remunerados (contra nós).')
lin = []
for x in sorted([m for m in G['mudancas'] if not m['revisao']], key=lambda x: (x['t'], x['up'], x['placa'])):
    u, p = up_split(x['up'])
    lin.append([x['up'], u, p, x['placa'], x['modelo'], x['t'], x['quinzena'], x['de'], x['para'],
                '=IF(H{r}=0,"",I{r}/H{r}-1)', '=IF(I{r}>H{r},"subiu (contra nós)","caiu (a favor)")',
                x['tipo'], x['quinzenaDe'], x['ate'], x['km'], '=IF(OR(H{r}=0,I{r}=0),0,O{r}*(1/H{r}-1/I{r}))'])
tabela(ws, 'G5_ForaRevisao', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Modelo', 'Quinzena nº', 'Quinzena', 'Km/L antes', 'Km/L depois', 'Variação', 'Sentido',
                                  'Tipo', 'Valor antigo da', 'Valor novo valeu até', 'Km com o valor novo (até set)', 'Litros (+ contra nós)'],
       lin, fmts=[None, None, None, None, None, '0', None, FMT_KML, FMT_KML, FMT_PCT, None, None, None, None, FMT_INT, FMT_INT],
       larg=[18, 10, 12, 11, 20, 10, 10, 11, 11, 10, 18, 16, 12, 14, 14, 14])

# ───────────────────── G6 · Cadastro e valores incompatíveis ─────────────────────
ws = wb.create_sheet('G6 Cadastro')
r0 = titulo(ws, '6 · ERROS DE CADASTRO E VALORES INCOMPATÍVEIS', 'Placa de teste, placa com valor fora do modelo e operação sem placa ativa',
            'Valor incompatível = placa a mais de 25% da mediana do próprio modelo na operação, no mês. Litros = km da placa no mês × (1/mediana − 1/valor): positivo = contra nós.')
lin = []
for x in G['erros']['placaTeste']:
    u, p = up_split(x['up'])
    lin.append(['Placa "TESTE" ativa', x['up'], u, p, 'TESTE', x['t'], x['v'], None, f"ativo: {x['ativo']}", 0])
disp_lit = {(d['up'], d['placa'], d['mes']): d for d in G['dispPlacas']}
for x in sorted(G['erros']['outliers'], key=lambda x: (x['up'], x['placa'], x['mes'])):
    u, p = up_split(x['up'])
    d = disp_lit.get((x['up'], x['placa'], x['mes']), {})
    lin.append(['Valor incompatível com o modelo', x['up'], u, p, x['placa'], MES[x['mes'] - 1], x['v'], x['mediana'],
                f"{x['modelo']}: {x['pct']:+.0f}% da mediana (faixa {d.get('min', 0):.2f}–{d.get('max', 0):.2f})".replace('.', ','), round(d.get('litros', 0))])
for x in G['erros']['upSemAtivas']:
    if x['up'].startswith('CGR') or x['up'] == 'PLT · AS':
        continue
    u, p = up_split(x['up'])
    lin.append(['Operação sem placa ativa com consumo', x['up'], u, p, '', x['t'], None, None, f"{x['nAt']} ativas, {x['nInat']} inativas", 0])
tabela(ws, 'G6_Cadastro', r0, ['Tipo', 'Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Quando', 'Km/L', 'Mediana do modelo', 'Detalhe', 'Litros (+ contra nós)'], lin,
       fmts=[None, None, None, None, None, None, FMT_KML, FMT_KML, None, FMT_INT], larg=[32, 18, 10, 12, 11, 10, 9, 12, 48, 14])

# ───────────────────── G7 · Revisão de julho placa a placa ─────────────────────
ws = wb.create_sheet('G7 Revisão julho')
r0 = titulo(ws, '7 · REVISÃO DE JULHO (Q3), PLACA A PLACA', 'O valor antes e depois da revisão, os litros que ela tirou ou deu até setembro e a régua do mesmo modelo nas outras operações',
            'Inclui a placa que estava inativa quando a revisão passou e voltou com valor novo (tipo "volta do inativo"). Litros = km da placa (aba Km/L) até set × (1/antes − 1/depois): positivo = contra nós. Faixa da frota = menor e maior média do modelo entre as operações no Q3.')
faixa = {}
for mo, xs in G['modEntreUps'].items():
    v3 = [x['q']['3']['media'] for x in xs if x['q'].get('3')]
    if v3:
        faixa[mo] = (min(v3), max(v3), len(v3))
lin = []
for x in sorted([m for m in G['mudancas'] if m['revQ'] == 'Q3'], key=lambda x: (x['up'], x['modelo'], x['placa'])):
    u, p = up_split(x['up'])
    f = faixa.get(x['modelo'])
    lin.append([x['up'], u, p, x['placa'], x['modelo'], x['tipo'], x['quinzenaDe'], x['quinzena'], x['de'], x['para'],
                '=IF(I{r}=0,"",J{r}/I{r}-1)', x['ate'], x['km'], '=IF(OR(I{r}=0,J{r}=0),0,M{r}*(1/I{r}-1/J{r}))',
                f[0] if f else None, f[1] if f else None, '=IF(J{r}>I{r},"subiu (contra nós)","caiu (a favor)")'])
tabela(ws, 'G7_RevisaoJulho', r0, ['Unidade · Projeto', 'Unidade', 'Projeto', 'Placa', 'Modelo', 'Tipo', 'Valor antigo da', 'Valor novo desde', 'Km/L antes', 'Km/L depois',
                                   'Variação', 'Valor novo valeu até', 'Km com o valor novo (até set)', 'Litros (+ contra nós)', 'Menor média do modelo na frota (Q3)', 'Maior média do modelo na frota (Q3)', 'Sentido'],
       lin, fmts=[None, None, None, None, None, None, None, None, FMT_KML, FMT_KML, FMT_PCT, None, FMT_INT, FMT_INT, FMT_KML, FMT_KML, None],
       larg=[18, 10, 12, 11, 20, 16, 12, 12, 10, 10, 10, 14, 14, 14, 14, 14, 18])

# ───────────────────── G8 · O mesmo modelo entre unidades ─────────────────────
ws = wb.create_sheet('G8 Modelo entre unidades')
r0 = titulo(ws, '8 · O MESMO MODELO ENTRE UNIDADES', 'Média do consumo remunerado do modelo em cada operação, trimestre a trimestre',
            'O mesmo caminhão recebendo réguas diferentes em operações diferentes. Ex.: VW 26.260 (baú roll-up 10 pallets) estava a 2,70 em quase toda a Rota no Q2 e foi de 2,64 a 4,45 na revisão de julho.')
lin = []
for mo in sorted(G['modEntreUps']):
    for x in sorted(G['modEntreUps'][mo], key=lambda x: x['up']):
        u, p = up_split(x['up'])
        q = x['q']
        g = lambda k, c: (q.get(k) or {}).get(c)
        lin.append([mo, x['up'], u, p, g('1', 'media'), g('2', 'media'), g('3', 'media'), g('4', 'media'),
                    '=IF(OR(F{r}="",G{r}=""),"",G{r}/F{r}-1)', g('3', 'min'), g('3', 'max'),
                    '=IF(G{r}="","",_xlfn.MINIFS(G:G,A:A,A{r}))', '=IF(G{r}="","",_xlfn.MAXIFS(G:G,A:A,A{r}))',
                    '=IF(OR(G{r}="",L{r}=""),"",G{r}/L{r}-1)'])
tabela(ws, 'G8_ModeloEntreUnidades', r0, ['Modelo', 'Unidade · Projeto', 'Unidade', 'Projeto', 'Q1', 'Q2', 'Q3', 'Q4', 'Variação Q2→Q3', 'Menor placa no Q3', 'Maior placa no Q3',
                                          'Menor média do modelo na frota (Q3)', 'Maior média do modelo na frota (Q3)', 'Acima da menor da frota'],
       lin, fmts=[None, None, None, None, FMT_KML, FMT_KML, FMT_KML, FMT_KML, FMT_PCT, FMT_KML, FMT_KML, FMT_KML, FMT_KML, FMT_PCT],
       larg=[20, 18, 10, 12, 8, 8, 8, 8, 12, 12, 12, 14, 14, 14])

# ───────────────────── Estratificação ─────────────────────
UPS = [up for up in G['UPS'] if not up.startswith('CGR') and up != 'PLT · AS']
ws = wb.create_sheet('Estratificação', 0)
r0 = titulo(ws, 'ESTRATIFICAÇÃO DOS GAPS', 'Por unidade · projeto, por modelo e por mês',
            'Tudo aqui é fórmula sobre as abas G1 a G7: filtrar ou corrigir uma linha do detalhe muda o total. Campo Grande fica fora (outra pauta), assim como as elétricas e Pelotas AS.')
q = lambda s: "'" + s + "'"
G1, G2, G3, G3b, G4, G5, G6, G7 = (q(s) for s in ['G1 Revisão Q4', 'G2 Mesmo modelo', 'G3 Ativação', 'G3b Km inativas', 'G4 Ativas zeradas', 'G5 Fora da revisão', 'G6 Cadastro', 'G7 Revisão julho'])
cab = ['Unidade · Projeto', 'G1 · Placas sem revisão em out', 'G2 · Placa-mês com valor ≠ do modelo', 'G2 · Litros contra nós', 'G2 · Litros a favor', 'G2 · Saldo (L)',
       'G3 · Desativações abaixo da média', 'G3 · Ativações acima da média', 'G3b · Km de placas inativas', 'G4 · Placas ativas zeradas', 'G5 · Mudanças fora da revisão', 'G5 · Das quais subiram', 'G6 · Erros de cadastro e valores incompatíveis', 'G5 · Litros (+ contra nós)', 'G7 · Placas mudadas na revisão de julho', 'G7 · Litros (+ contra nós)']
for j, h in enumerate(cab, 1):
    c = ws.cell(r0, j, h); c.font = f_hdr; c.fill = fill_hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
ws.row_dimensions[r0].height = 42
def bloco_up(r, chave_col, chave):
    return [
        chave,
        f'=COUNTIFS({G1}!$A:$A,{chave_col}{r},{G1}!$I:$I,"mesmo valor")',
        f'=COUNTIFS({G2}!$A:$A,{chave_col}{r},{G2}!$P:$P,"sim")',
        f'=SUMIFS({G2}!$O:$O,{G2}!$A:$A,{chave_col}{r},{G2}!$O:$O,">0")',
        f'=-SUMIFS({G2}!$O:$O,{G2}!$A:$A,{chave_col}{r},{G2}!$O:$O,"<0")',
        f'=D{r}-E{r}',
        f'=COUNTIFS({G3}!$A:$A,{chave_col}{r},{G3}!$H:$H,"desativou",{G3}!$K:$K,"abaixo da média")',
        f'=COUNTIFS({G3}!$A:$A,{chave_col}{r},{G3}!$H:$H,"ativou",{G3}!$K:$K,"acima ou igual")',
        f'=SUMIFS({G3b}!$H:$H,{G3b}!$A:$A,{chave_col}{r})',
        f'=COUNTIFS({G4}!$A:$A,{chave_col}{r})',
        f'=COUNTIFS({G5}!$A:$A,{chave_col}{r})',
        f'=COUNTIFS({G5}!$A:$A,{chave_col}{r},{G5}!$K:$K,"subiu (contra nós)")',
        f'=COUNTIFS({G6}!$B:$B,{chave_col}{r})',
        f'=SUMIFS({G5}!$P:$P,{G5}!$A:$A,{chave_col}{r})',
        f'=COUNTIFS({G7}!$A:$A,{chave_col}{r})',
        f'=SUMIFS({G7}!$N:$N,{G7}!$A:$A,{chave_col}{r})',
    ]
fmts_e = [None] + [FMT_INT] * 15
r = r0 + 1
for up in UPS:
    for j, v in enumerate(bloco_up(r, '$A', up), 1):
        c = ws.cell(r, j, v); c.font = f_txt; c.number_format = fmts_e[j - 1] or 'General'
    r += 1
tot_up = r
ws.cell(r, 1, 'Total').font = f_b
for j in range(2, len(cab) + 1):
    c = ws.cell(r, j, f'=SUM({L(j)}{r0 + 1}:{L(j)}{r - 1})'); c.font = f_b; c.number_format = FMT_INT
for j in range(1, len(cab) + 1):
    ws.cell(r, j).fill = fill_tot
# realce: saldo contra nós e linhas com problema
for rr in range(r0 + 1, r):
    ws.cell(rr, 6).number_format = FMT_INT
ws.column_dimensions['A'].width = 20
for j in range(2, len(cab) + 1):
    ws.column_dimensions[L(j)].width = 15
ws.freeze_panes = ws.cell(r0 + 1, 2)

# por modelo (G2 saldo, G4, G5)
r += 3
ws.cell(r, 1, 'Por modelo').font = f_b
r += 1
cabm = ['Modelo', 'G2 · Placa-mês com valor ≠ do modelo', 'G2 · Saldo (L)', 'G4 · Placas ativas zeradas', 'G5 · Mudanças fora da revisão', 'G5 · Das quais subiram']
for j, h in enumerate(cabm, 1):
    c = ws.cell(r, j, h); c.font = f_hdr; c.fill = fill_hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
ws.row_dimensions[r].height = 42
mods = sorted({x['modelo'] for x in G['dispPlacas']} | {x['modelo'] for x in G['erros']['ativasZeroDet']} | {m['modelo'] for m in G['mudancas'] if not m['revisao']})
rm0 = r + 1
for i, mo in enumerate(mods, rm0):
    vals = [mo,
            f'=COUNTIFS({G2}!$F:$F,$A{i},{G2}!$P:$P,"sim")',
            f'=SUMIFS({G2}!$O:$O,{G2}!$F:$F,$A{i})',
            f'=COUNTIFS({G4}!$E:$E,$A{i})',
            f'=COUNTIFS({G5}!$E:$E,$A{i})',
            f'=COUNTIFS({G5}!$E:$E,$A{i},{G5}!$K:$K,"subiu (contra nós)")']
    for j, v in enumerate(vals, 1):
        c = ws.cell(i, j, v); c.font = f_txt; c.number_format = FMT_INT if j > 1 else 'General'
r = rm0 + len(mods)
ws.cell(r, 1, 'Total').font = f_b
for j in range(2, len(cabm) + 1):
    c = ws.cell(r, j, f'=SUM({L(j)}{rm0}:{L(j)}{r - 1})'); c.font = f_b; c.number_format = FMT_INT
for j in range(1, len(cabm) + 1):
    ws.cell(r, j).fill = fill_tot

# por mês (G2 saldo, G3b km)
r += 3
ws.cell(r, 1, 'Por mês').font = f_b
r += 1
cabmes = ['Mês nº', 'Mês', 'G2 · Litros contra nós', 'G2 · Litros a favor', 'G2 · Saldo (L)', 'G3b · Km de placas inativas']
for j, h in enumerate(cabmes, 1):
    c = ws.cell(r, j, h); c.font = f_hdr; c.fill = fill_hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
ws.row_dimensions[r].height = 30
rq0 = r + 1
meses = sorted({x['mes'] for x in G['dispPlacas']} | {x['mes'] for x in G['kmInatLinhas']})
for i, m in enumerate(meses, rq0):
    vals = [m, MES[m - 1],
            f'=SUMIFS({G2}!$O:$O,{G2}!$D:$D,$A{i},{G2}!$O:$O,">0")',
            f'=-SUMIFS({G2}!$O:$O,{G2}!$D:$D,$A{i},{G2}!$O:$O,"<0")',
            f'=C{i}-D{i}',
            f'=SUMIFS({G3b}!$H:$H,{G3b}!$D:$D,$A{i})']
    for j, v in enumerate(vals, 1):
        c = ws.cell(i, j, v); c.font = f_txt; c.number_format = FMT_INT if j > 2 else 'General'
r = rq0 + len(meses)
ws.cell(r, 1, 'Total').font = f_b
for j in range(3, len(cabmes) + 1):
    c = ws.cell(r, j, f'=SUM({L(j)}{rq0}:{L(j)}{r - 1})'); c.font = f_b; c.number_format = FMT_INT
for j in range(1, len(cabmes) + 1):
    ws.cell(r, j).fill = fill_tot

# ───────────────────── Resumo da cobrança ─────────────────────
E = q('Estratificação')
ws = wb.create_sheet('Resumo', 0)
ws.sheet_view.showGridLines = False
ws.cell(1, 1, 'FREIGHTECH · CONSUMO REMUNERADO KM/L · 2026').font = f_kick
ws.cell(2, 1, 'O que cobrar da Ambev').font = Font(name=F, size=20, bold=True, color='0F1A20')
ws.cell(3, 1, 'Base: planilha do FT que você mandou (aba Base FT, 1ª jan a 2ª out/26), sem Campo Grande (outra pauta), sem as 8 elétricas e sem Pelotas AS (entra em Rota). Os números são fórmulas sobre as abas de detalhe.').font = f_nota
ws.cell(4, 1, 'Preencher: as colunas em amarelo (Status e Resposta da Ambev), à medida que a cobrança andar. Exemplo: "Enviado 22/10" · "Ambev vai revisar na 1ª nov".').font = f_nota
cabr = ['#', 'Gap', 'O que é', 'Tamanho', 'Unidade da medida', 'Onde mais pesa', 'O que pedir à Ambev', 'Aba com o detalhe', 'Status da cobrança', 'Resposta da Ambev']
rr = 6
for j, h in enumerate(cabr, 1):
    c = ws.cell(rr, j, h); c.font = f_hdr; c.fill = fill_hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
T = tot_up
gaps = [
    ('1', 'Revisão do Q4 não aconteceu', 'Nenhuma placa mudou de valor na 1ª quinzena de outubro; o Q4 roda com a régua do Q3.',
     f'={E}!B{T}', 'placas sem revisão em out', 'Todas as operações',
     'Rodar a revisão do Q4 já, com o mesmo método trimestral; confirmar a data de entrada do valor novo.', 'G1 Revisão Q4'),
    ('2', 'Mesmo modelo com valores diferentes', 'Placas do mesmo modelo, na mesma operação e mês, recebendo consumo remunerado diferente.',
     f'={E}!F{T}', 'litros contra nós (saldo, jan a set)', 'PIR · EMPURRADA (Actros 2651; UGU5D17 a 0,67 km/L)',
     'Uma régua por modelo dentro da operação; corrigir UGU5D17 e explicar cada placa fora da mediana.', 'G2 Mesmo modelo'),
    ('3', 'Km de placas inativas', 'Placas que rodaram num mês em que estavam inativas no FT: consumo sem régua remunerada.',
     f'={E}!I{T}', 'km rodados (jan a set)', 'Ver Estratificação, coluna G3b',
     'Critério de ativação por escrito; reativar as placas que rodam.', 'G3b Km inativas'),
    ('4', 'Ativação sem padrão claro', 'Desativações abaixo da média e ativações acima dela mexem pouco na média.',
     f'={E}!G{T}+{E}!H{T}', 'eventos a favor da Ambev (desativou abaixo + ativou acima)', 'BLC · AS (+0,27 km/L na média)',
     'Acompanhar mês a mês; pedir a justificativa das ativações de BLC AS e PLT VAN.', 'G3 Ativação'),
    ('5', 'Placas ativas com consumo zero', 'Na 1ª abr (revisão do Q2), placas ativas das Empurradas entraram com consumo zero.',
     f'={E}!J{T}', 'placas', 'PIR · EMPURRADA',
     'Qual regra o FT aplicou ao zero e qual valor valeu na 1ª abr; valor novo junto com a 1ª quinzena.', 'G4 Ativas zeradas'),
    ('6', 'Mudanças fora da revisão', 'Consumo remunerado de placa mudando fora da 1ª quinzena do trimestre.',
     f'={E}!K{T}', 'mudanças no ano', 'CBA · ROTA e CBA · AS (2ª set)',
     'A trilha de cada mudança fora da revisão (quem, quando, por quê).', 'G5 Fora da revisão'),
    ('7', 'Cadastro e valores incompatíveis', 'Placa "TESTE" ativa o ano inteiro, placa com valor a mais de 25% da mediana do modelo (UGU5D17 a 0,67 km/L), operação sem placa ativa.',
     f'={E}!M{T}', 'ocorrências', 'PIR · EMPURRADA (UGU5D17) · GRL UDC · ROTA (TESTE)',
     'Corrigir o valor das placas fora do modelo e limpar o cadastro antes da base do Q1/27.', 'G6 Cadastro'),
    ('8', 'Revisão de julho', 'O que a revisão do Q3 mudou placa a placa e os litros que tirou ou deu até setembro.',
     f'={E}!P{T}', 'litros (saldo; + = contra nós)', 'PLT · ROTA e RON · ROTA (contra nós)',
     'O critério de cada valor novo do Q3; por que RON ROTA foi a 3,43/3,85 e MCC ROTA a 4,45 no VW 26.260.', 'G7 Revisão julho'),
    ('9', 'O mesmo modelo entre unidades', 'O mesmo caminhão com régua diferente em cada operação (VW 26.260 em Rota: 2,64 a 4,45 no Q3).',
     "=COUNTA('G8 Modelo entre unidades'!A:A)-4", 'linhas modelo × operação', 'VW 26.260 em Rota (RON, MCC, PLT)',
     'Justificar a régua de cada operação para o mesmo modelo, ou alinhar à da frota.', 'G8 Modelo entre unidades'),
]
for i, g in enumerate(gaps, rr + 1):
    for j, v in enumerate(g, 1):
        c = ws.cell(i, j, v); c.font = f_b if j in (2, 4) else f_txt
        c.alignment = Alignment(wrap_text=True, vertical='top')
        if j == 4:
            c.number_format = FMT_INT
    ws.cell(i, 8).hyperlink = f"#'{g[7]}'!A1"
    ws.cell(i, 8).font = Font(name=F, size=10, color='1F6FEB', underline='single')
    for j in (9, 10):
        c = ws.cell(i, j); c.fill = fill_in; c.font = f_txt; c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.row_dimensions[i].height = 48
for j in range(1, len(cabr) + 1):
    for i in range(rr, rr + len(gaps) + 1):
        ws.cell(i, j).border = Border(bottom=fino)
for j, w in enumerate([4, 30, 46, 12, 22, 30, 46, 18, 22, 30], 1):
    ws.column_dimensions[L(j)].width = w
ws.freeze_panes = 'A7'
ws.cell(rr + 1, 4).comment = Comment('Conta as placas com o mesmo valor em 2ª set e 1ª out (aba G1, coluna Situação = "mesmo valor").', 'Análise')

# ───────────────────── Leia-me ─────────────────────
ws = wb.create_sheet('Leia-me')
ws.sheet_view.showGridLines = False
linhas_l = [
    ('COMO LER ESTA PLANILHA', f_kick),
    ('Consumo remunerado Km/L · Freightech · 2026', f_tit),
    ('', f_txt),
    ('Resumo: os nove gaps para cobrar a Ambev, com o tamanho de cada um (fórmula) e as colunas amarelas para acompanhar a cobrança.', f_txt),
    ('Estratificação: os mesmos gaps por unidade · projeto, por modelo e por mês, todos em fórmula sobre as abas de detalhe.', f_txt),
    ('G1 a G8: o detalhe placa a placa de cada gap, como Tabela do Excel (filtro em cada coluna, pronta para tabela dinâmica).', f_txt),
    ('Base FT: a planilha que você mandou, com as seis colunas como vieram, e ao lado as colunas derivadas (unidade, quinzena, trimestre, placa em Mercosul, modelo e o motivo de estar fora da análise).', f_txt),
    ('', f_txt),
    ('Regras usadas', f_b),
    ('A média do FT é a média simples das placas ativas com consumo, por unidade · projeto e quinzena.', f_txt),
    ('A revisão trimestral entra na 1ª quinzena do trimestre: 1ª jan (Q1), 1ª abr (Q2), 1ª jul (Q3), 1ª out (Q4).', f_txt),
    ('O modelo da placa não está na planilha do FT: vem da aba Km/L do Consumo (modelo mais frequente da placa) e, na falta, da base de ativos do Ginfo.', f_txt),
    ('Litros (abas G2, G5, G6 e G7) usam só o km rodado da placa, da aba Km/L, como peso. Nenhum gap compara com o consumo realizado.', f_txt),
    ('Fora das abas de gap: Campo Grande (tanque interno, tratado em outra pauta), as 8 VW Delivery elétricas e Pelotas AS (entra em Rota). Continuam na Base FT, marcados.', f_txt),
    ('', f_txt),
    ('Cores: fundo amarelo = preencher · vermelho em número = contra nós · linha cinza = total.', f_nota),
]
for i, (t, fnt) in enumerate(linhas_l, 1):
    c = ws.cell(i, 1, t); c.font = fnt; c.alignment = Alignment(wrap_text=True, vertical='top')
ws.column_dimensions['A'].width = 130

# ordem das abas: Resumo, Estratificação, G1…G8, Base FT, Leia-me
ordem = ['Resumo', 'Estratificação', 'G1 Revisão Q4', 'G2 Mesmo modelo', 'G3 Ativação', 'G3b Km inativas', 'G4 Ativas zeradas', 'G5 Fora da revisão', 'G6 Cadastro', 'G7 Revisão julho', 'G8 Modelo entre unidades', 'Base FT', 'Leia-me']
wb._sheets = [wb[n] for n in ordem]
for n, cor in [('Resumo', 'F22C05'), ('Estratificação', 'F22C05'), ('Base FT', '0F1A20'), ('Leia-me', '8A94A2')]:
    wb[n].sheet_properties.tabColor = cor
wb.active = 0
wb.save(OUT)
print('ok', OUT, 'base', len(linhas), 'G2', len(G['dispPlacas']))
