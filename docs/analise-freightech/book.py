# ============================================================
# Book do Operador do Freightech → book.json (os números que os decks citam)
#   BOOK=<book.ndjson decifrado> FTQ=<ft_ativos_q.json> python3 book.py
# Lê o dump do Book (66 registros + anexos com texto extraído), monta:
#   inv       — inventário (por categoria, anexos por tipo, datas)
#   regras    — índice dos registros de frota (título, categoria, atualização, blocos, anexos)
#   sizing    — o dimensionamento OFICIAL (anexo do registro "DIMENSIONAMENTO 2nd TIER E 3rd TIER")
#               das últimas quinzenas, por unidade da Conlog: caminhões, vans, FF total,
#               volume e dias úteis — e, ao lado, os ativos do FT (ft_ativos_q.json)
# Nada do texto do Book vai para o JSON além dos títulos: o deck cita as regras em prosa.
# ============================================================
import os, json, re, collections
BOOK = os.environ.get('BOOK', 'book.ndjson'); FTQ = os.environ.get('FTQ', 'ft_ativos_q.json')
regs = [json.loads(l) for l in open(BOOK)]
out = {'n': len(regs)}
cat = collections.Counter(r['categoria'] for r in regs)
tipos = collections.Counter(a['tipo'] for r in regs for a in r['anexos'])
out['inv'] = {'categorias': dict(cat), 'anexos': sum(len(r['anexos']) for r in regs), 'tipos': dict(tipos),
              'blocos': sum(r['n_blocos'] for r in regs), 'imagens': sum(r['n_imagens'] for r in regs),
              'sem_texto': sum(1 for r in regs for a in r['anexos'] if a['texto'] is None),
              'mb': round(sum((a['tamanho'] or 0) for r in regs for a in r['anexos']) / 1048576, 1),
              'mais_antigo': min(str(r['atualizado_em'])[:10] for r in regs), 'mais_novo': max(str(r['atualizado_em'])[:10] for r in regs),
              'chars': sum(len(r['texto']) for r in regs)}
FROTA = ['MANUTENÇÃO', 'PREÇO COMBUSTÍVEIS', 'CONSUMO DE COMBUSTÍVEIS', 'CONSUMO', 'CUSTO FIXO DE EQUIPAMENTOS', 'PNEU', 'ATIVAÇÃO E DESATIVAÇÃO FROTA',
         'INCLUSÃO E REMOÇÃO DE EQUIPAMENTOS', 'MOVIMENTAÇÃO DE FROTAS', 'CIVF - CONSERVAÇÃO DA IDENTIDADE VISUAL DA FROTA', 'STRESS TEST VEICULOS',
         'STRESS TEST EMPILHADEIRAS', 'DISPONIBILIDADE - ARMAZÉM', 'EMPILHADEIRAS', 'EMPRESTIMO DE FROTA T1', 'LUCRO - DISTRIBUIÇÃO', 'LUCRO - TRANSPORTES T1',
         'LUCRO - ARMAZÉM', 'RECARGA', 'DIMENSIONAMENTO 2nd TIER E 3rd TIER', 'FECHAMENTOS APOIO, 1st TIER E 2nd TIER', 'OUTROS CUSTOS', 'Outros Custos',
         'Book do operador', 'Modelo de precificação', 'EQUIPE DISTRIBUIÇÃO URBANA', 'QLP ADM', 'DESCONTO QLP ADM', 'DESCONTO FALTA DE MOTORISTAS - T1', 'BOOK VALE PEDÁGIO']
out['regras'] = [{'t': r['titulo'], 'cat': r['categoria'], 'sub': r['subtitulo'], 'atual': str(r['atualizado_em'])[:10], 'blocos': r['n_blocos'], 'anexos': r['n_anexos'], 'imgs': r['n_imagens'], 'chars': len(r['texto']), 'frota': r['titulo'] in FROTA}
                 for r in sorted(regs, key=lambda r: (r['categoria'] or '', r['ordem']))]
# ── dimensionamento oficial × ativos do FT ──
dim = [x for x in regs if x['titulo'].startswith('DIMENSIONAMENTO')]
siz = {}
if dim:
    r = dim[0]; byid = {}
    for b in r['blocos']:
        st = re.sub(r'<[^>]+>', '', b.get('subtitulo') or '').replace('&Ccedil;', 'Ç').strip()
        for a in (b.get('anexos') or []): byid[str(a.get('uuid'))] = st
    Q = {'1Q DE AGOSTO DE 2026': 'ROTA_1_8_2026', '2Q DE AGOSTO DE 2026': 'ROTA_2_8_2026', '1Q DE SETEMBRO DE 2026': 'ROTA_1_9_2026', '2Q DE SETEMBRO DE 2026': 'ROTA_2_9_2026', '1Q DE OUTUBRO DE 2026': 'ROTA_1_10_2026', '2Q DE OUTUBRO DE 2026': 'ROTA_2_10_2026'}
    SIG = {'CGR': 'CGR', 'PEL': 'PLT', 'FLO': 'FLP', 'BAL': 'BLC', 'GUA': 'GRL', 'CUI': 'CBA', 'MCI': 'MCC'}
    for a in r['anexos']:
        q = byid.get(a['id_storage'], ''); k = next((v for w, v in Q.items() if q.startswith(w)), None)
        if not k or not a['texto']: continue
        for s in ('\n' + a['texto']).split('\n## ')[1:]:
            rows = s.split('\n')
            if rows[0] != 'ROTA': continue
            for l in rows:
                c = [x.strip().replace('\n', ' ') for x in l.split('\t')]
                if len(c) < 15 or c[4] not in SIG: continue
                if c[4] in ('CUI', 'MCI') and 'CDI' not in c[5]: continue
                u = SIG[c[4]]
                if c[4] == 'CGR' and not c[3].startswith('Com CD RJ'): continue   # a 2ª linha do RJ é a UDC
                num = lambda x: float(x.replace(',', '')) if re.match(r'^-?[\d,]+(\.\d+)?$', x) else None
                siz.setdefault(k, {})[u] = {'arquivo': a['nome'], 'vol': num(c[8]), 'du': num(c[9]), 'cam': num(c[12]), 'van': num(c[13]), 'ff': num(c[14])}
            # o 2º arquivo da quinzena (o "2") é a versão revisada: fica o último lido
out['sizing'] = siz
try:
    ftq = json.load(open(FTQ))
    # o FT separa CDD GUARULHOS e UDC GUARULHOS; o book.py do deck soma as duas no GRL
    ftq2 = {}
    for k, us in ftq.items():
        for u, f in us.items():
            t = ftq2.setdefault(k, {}).setdefault(u, {'cam': 0, 'cam_at': 0, 'van': 0, 'van_at': 0})
            for c in t: t[c] += f.get(c, 0)
    out['ft_ativos'] = ftq2
    comp = {}
    for k, us in siz.items():
        for u, d in us.items():
            f = (ftq2.get(k) or {}).get(u)
            if f: comp.setdefault(k, {})[u] = {'siz_cam': d['cam'], 'siz_van': d['van'], 'ft_cam': f['cam_at'], 'ft_van': f['van_at'], 'ft_placas': f['cam'] + f['van']}
    out['comp'] = comp
except Exception as e:
    out['comp'] = {}; out['ft_erro'] = str(e)[:100]
json.dump(out, open('book.json', 'w'), ensure_ascii=False, indent=1)
print(out['inv']); print(json.dumps(out.get('comp', {}).get('ROTA_2_10_2026'), ensure_ascii=False))
