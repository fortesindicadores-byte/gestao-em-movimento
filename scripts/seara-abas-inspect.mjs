// Enumera TODAS as abas do workbook Seara e imprime o cabeçalho de cada uma.
//
// Por quê: a Base Remunerado foi enxugada (hoje termina na col O, ReaisPorKm) e
// levou junto KmPorLitro e PrecoDiesel — as colunas que os painéis Km/L · Seara
// e R$/L · Seara usavam para o REMUNERADO. Antes de reapontar os painéis é
// preciso ver ONDE esses dados vivem agora (aba nova? coluna renomeada?).
//
// O gviz não lista abas; o export xlsx (planilha link-readable) lista. Roda via
// GitHub Actions porque o sandbox não alcança docs.google.
const SEARA_ID = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const url = `https://docs.google.com/spreadsheets/d/${SEARA_ID}/export?format=xlsx`;
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
writeFileSync('/tmp/seara.xlsx', buf);
console.log(`xlsx: ${(buf.length/1024/1024).toFixed(1)} MB\n`);

execSync('pip install --quiet openpyxl', {stdio:'inherit'});
const py = `
import openpyxl
wb = openpyxl.load_workbook('/tmp/seara.xlsx', read_only=True)
A1 = lambda i: (chr(65+(i//26)-1) if i>=26 else '') + chr(65+i%26)
for name in wb.sheetnames:
    ws = wb[name]
    print(f"=== {name} · {ws.max_row} linhas × {ws.max_column} colunas ===")
    hdr = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())
    for i, v in enumerate(hdr):
        if v is not None:
            print(f"  {A1(i):>3} [{i:2}] {v}")
    # segunda linha como amostra (ajuda a ver se é fórmula viva ou coluna morta)
    smp = next(ws.iter_rows(min_row=2, max_row=2, values_only=True), ())
    vivos = sum(1 for v in smp if v is not None)
    print(f"  (linha 2: {vivos} células preenchidas)\\n")

# ── Base Remunerado por vigência: as colunas que o Km/L · Seara e o R$/L · Seara
# leem para o REMUNERADO (KmPorLitro, PrecoDiesel) e a do R$/km (ReaisPorKm).
# Conta, mês a mês, quantas linhas têm cada uma preenchida (> 0). Serve para
# distinguir "a aba não tem o mês" de "tem o mês, mas a coluna veio vazia".
import datetime, collections
ws = wb[wb.sheetnames[0]]
hdr = [str(v or '').lower().replace(' ','') for v in next(ws.iter_rows(min_row=1, max_row=1, values_only=True), ())]
def idx(alvo, default):
    for i, h in enumerate(hdr):
        if alvo in h: return i
    return default
iv, ip, ikl, ipd, irk = idx('vigencia',0), idx('placa',3), idx('kmporlitro',15), idx('precodiesel',17), idx('reaisporkm',14)
print(f"=== Base Remunerado ({wb.sheetnames[0]}) por vigência · colunas {A1(iv)} vig · {A1(ip)} placa · {A1(ikl)} KmPorLitro · {A1(ipd)} PrecoDiesel · {A1(irk)} ReaisPorKm ===")
def vig_de(v):
    if isinstance(v, (datetime.datetime, datetime.date)): return f"{v.month:02d}/{v.year}"
    s = str(v or '')
    import re
    m = re.match(r'^(\\d{1,2})/(\\d{1,2})/(\\d{4})', s)
    if m: return f"{int(m.group(2)):02d}/{m.group(3)}"
    m = re.match(r'^(\\d{4})-(\\d{2})', s)
    if m: return f"{m.group(2)}/{m.group(1)}"
    return s[:7] if s else ''
def num(v):
    try: return float(v)
    except: return 0.0
por = collections.OrderedDict()
for r in ws.iter_rows(min_row=2, values_only=True):
    if r is None or len(r) <= max(iv, ip): continue
    vig = vig_de(r[iv]); placa = str(r[ip] or '').strip()
    if not vig or not placa: continue
    o = por.setdefault(vig, {'linhas':0,'placas':set(),'kml':0,'preco':0,'rskm':0})
    o['linhas'] += 1; o['placas'].add(placa)
    if len(r) > ikl and num(r[ikl]) > 0: o['kml'] += 1
    if len(r) > ipd and num(r[ipd]) > 0: o['preco'] += 1
    if len(r) > irk and num(r[irk]) > 0: o['rskm'] += 1
print(f"  {'vigência':>8} | linhas | placas | KmPorLitro>0 | PrecoDiesel>0 | ReaisPorKm>0")
for vig, o in sorted(por.items(), key=lambda kv: kv[0][3:]+kv[0][:2]):
    print(f"  {vig:>8} | {o['linhas']:6} | {len(o['placas']):6} | {o['kml']:12} | {o['preco']:13} | {o['rskm']:12}")
`;
writeFileSync('/tmp/abas.py', py);
execSync('python3 /tmp/abas.py', {stdio:'inherit'});
