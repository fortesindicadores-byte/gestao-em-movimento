// ============================================================
// Robô gviz → Supabase (Renan, 19/08/2026: "pode fazer todos")
//
// Baixa as abas do Google Sheets que os painéis usam na abertura e grava
// o TEXTO CRU da resposta gviz em gviz_snapshot. O assets/gviz-cache.js
// serve esses snapshots aos painéis (~200ms) em vez do gviz (1–4s/aba).
//
// A chave TEM de bater com a do gviz-cache.js:
//   "<sheet_id>|s=<aba>|g=<gid>|q=<tq>|h=<headers>"
//
// Alvo fora desta lista NÃO quebra nada: o painel simplesmente segue
// para o Google, como sempre. financeiro-pessoal fica FORA de propósito
// (dados pessoais não entram no snapshot compartilhado).
// ============================================================
import { createHash } from 'node:crypto';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE_KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const HDRS = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY };

const DRE  = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';   // DRE (Visão Financeira e cia.)
const DISP = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';   // Base Dispersão de km
const KML  = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';   // Consumo (Km/L, R$/L)
const TERM = '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o';   // DPO/Demarco/FCA Total
const RPM  = '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY';   // Gerot / Base RPM / ICs
const TERM2 = '10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac';  // Termômetro (tiers)
const SEARA = '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE';  // Seara (3 abas)
const ELITE = '1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M';  // Frota de Elite (aba Pneus)
const MANUT = '1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k';  // Manutenção
const TEND  = '1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0';  // Tendência/Comparativos (aba Base)
const MTDIR = '1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8';  // Painel de Metas do Diretor
const FAROL = '1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY';  // Farol Semanal (aba Custos)

const ALVOS = [
  // DRE
  { id: DRE, sheet: 'Frota' },
  { id: DRE, sheet: 'EBITDA' },
  { id: DRE, sheet: 'Receita Líquida' },
  { id: DRE, sheet: 'Frota', headers: '1' },     // a Árvore da Seara pede a Frota com headers=1
  // Dispersão de km
  { id: DISP, sheet: 'Dispersão de km' },
  { id: DISP, sheet: 'Balanço de Massa' },
  { id: DISP, sheet: 'Abertura' },              // Painel KM · visão Placas (ago/2026 em diante)
  { id: KML, sheet: 'Base Remunerado Modelo' },   // Eficiência Km/L e Consumo Km/L Análise
  // Consumo
  { id: KML, sheet: 'Km/L' },
  { id: KML, sheet: 'R$/L' },
  // DPO / Demarco / FCA
  { id: TERM, sheet: 'DPO' },
  { id: TERM, sheet: 'Demarco' },
  { id: TERM, sheet: 'FCA Total', headers: '1' },
  { id: TERM, gid: '216663799' },
  { id: TERM, gid: '199351909' },
  { id: TERM, sheet: 'Disponibilidade' },        // painel /disponibilidade/ (antigo) e a migração
  { id: TERM, sheet: 'Indisponibilidade' },
  { id: TERM, sheet: 'Ativos' },
  // Gerot / RPM
  { id: RPM, gid: '0' },
  { id: RPM, sheet: 'De-Para', headers: '0' },
  { id: RPM, sheet: 'Base RPM', headers: '1' },
  { id: RPM, sheet: 'Consolidado ICs' },
  // Termômetro / MPR (mês + acumulado por tier)
  ...['Transportes T1', 'Transportes T2', 'WH T1', 'WH T2']
    .flatMap(t => [{ id: TERM2, sheet: t }, { id: TERM2, sheet: t + ' - Acum' }]),
  { id: TERM2, sheet: 'Regras', headers: '0' },   // termômetro · regras de pontuação
  // Seara (mesmos parâmetros que o painel pede)
  { id: SEARA, gid: '0', headers: '1' },
  { id: SEARA, gid: '1672208132', headers: '1', tq: 'select B, C, D, J' },
  { id: SEARA, gid: '1982300845', headers: '1' },
  // consultas agregadas dos painéis (levantadas pelo gviz-inventario.mjs) — cada
  // uma é uma chave própria, com os MESMOS parâmetros que o painel manda
  { id: SEARA, sheet: 'Remunerado', headers: '1', tq: 'select A, B, D' },
  { id: SEARA, sheet: 'Remunerado', tq: 'select A, sum(D) group by A' },
  { id: SEARA, sheet: 'Remunerado', headers: '1', tq: 'select A, sum(D) group by A' },
  { id: SEARA, gid: '1672208132', tq: 'select B, year(D), month(D), count(A) group by B, year(D), month(D)' },
  { id: SEARA, gid: '1982300845', tq: 'select F, G, sum(K) group by F, G' },
  // Frota de Elite / Manutenção / Tendência
  { id: ELITE, sheet: 'Pneus' },
  { id: MANUT, gid: '0', headers: '1' },
  { id: TEND, sheet: 'Base' },
  // Painel de Metas do Diretor e a aba Custos do Farol: tinham tabela no banco
  // mas NÃO tinham foto, então o Sheets Gviz Check não tinha com que comparar
  // — e é a foto que prova que a reconstrução do banco bate com o gviz.
  { id: MTDIR, gid: '0' },
  { id: MTDIR, gid: '410676465' },
  { id: MTDIR, gid: '1055877945' },
  { id: MTDIR, gid: '1358349252' },
  { id: MTDIR, gid: '1177655149' },
  { id: MTDIR, gid: '523073816' },
  { id: FAROL, sheet: 'Custos', headers: '1' },
];

const chaveDe = a => `${a.id}|s=${a.sheet || ''}|g=${a.gid || ''}|q=${a.tq || ''}|h=${a.headers || ''}`;
function urlDe(a) {
  const p = [];
  if (a.sheet) p.push('sheet=' + encodeURIComponent(a.sheet));
  if (a.gid != null) p.push('gid=' + encodeURIComponent(a.gid));
  if (a.tq) p.push('tq=' + encodeURIComponent(a.tq));
  if (a.headers != null) p.push('headers=' + a.headers);
  p.push('tqx=out:json');
  return `https://docs.google.com/spreadsheets/d/${a.id}/gviz/tq?${p.join('&')}`;
}

// A coluna hash pode ainda não existir (SQL não rodado): detectar uma vez
// e, sem ela, cair no comportamento antigo (upsert sempre).
let temHash = false;
try {
  const r = await fetch(`${SUPA}/rest/v1/gviz_snapshot?select=key,hash&limit=1`, { headers: HDRS });
  temHash = r.ok;
  if (!temHash) console.log('coluna hash ausente (rodar o ALTER TABLE) — gravando sempre');
} catch (e) { console.log('não deu para checar a coluna hash: ' + e.message); }

// ABA FILTRADA NO SHEETS: o gviz devolve SÓ as linhas visíveis, sem erro
// nenhum. Zerou o Km/L duas vezes, a Árvore de Combustível uma, e em
// 18/09/2026 derrubou a Visão Financeira para uma unidade só (811 de 17.810
// linhas na aba Frota). O estrago que DURA é a foto: ela vira "a verdade" e o
// shim a serve por até 12h. Então o robô RECUSA a foto que encolher demais e
// mantém a anterior — a mesma guarda que o sheets-robot já faz nas tabelas
// tipadas, agora do lado que os 38 painéis realmente leem.
// A régua é o TAMANHO da resposta, não o nº de linhas: o `bytes` da foto
// anterior já está gravado, então comparar não custa baixar o corpo de MBs.
const QUEDA_MAX = 0.4;

let ok = 0, iguais = 0, falhas = 0, recusadas = 0;
for (const alvo of ALVOS) {
  const key = chaveDe(alvo);
  try {
    let body = null;
    for (let t = 0; t < 3 && body == null; t++) {           // 3 tentativas
      const r = await fetch(urlDe(alvo));
      const txt = r.ok ? await r.text() : '';
      if (txt.includes('setResponse') && txt.includes('"status":"ok"')) body = txt;
      else await new Promise(res => setTimeout(res, 1500));
    }
    if (body == null) throw new Error('resposta gviz inválida');
    const hash = createHash('md5').update(body).digest('hex');

    // A foto anterior, só nos metadados — o corpo de MBs NÃO é baixado.
    let ant = null;
    try {
      const q = await fetch(`${SUPA}/rest/v1/gviz_snapshot?key=eq.${encodeURIComponent(key)}`
        + `&select=${temHash ? 'hash,' : ''}bytes`, { headers: HDRS });
      ant = q.ok ? (await q.json())[0] || null : null;
    } catch (e) { /* sem foto anterior não há com o que comparar */ }

    // Conteúdo igual ao gravado? Só renova o updated_at (gravação minúscula:
    // não reescreve o corpo de MBs — poupa o Disk IO Budget do Supabase).
    if (temHash) {
      const row = ant;
      if (row && row.hash === hash) {
        const tk = await fetch(`${SUPA}/rest/v1/gviz_snapshot?key=eq.${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: { ...HDRS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ updated_at: new Date().toISOString() })
        });
        if (!tk.ok) throw new Error('touch HTTP ' + tk.status + ' ' + (await tk.text()).slice(0, 120));
        ok++; iguais++;
        console.log(`=   ${key}  sem mudança (${(body.length / 1024).toFixed(0)}KB poupados)`);
        continue;
      }
    }

    // encolheu demais? a aba está filtrada — fica a foto anterior
    if (ant && ant.bytes > 0 && body.length < ant.bytes * (1 - QUEDA_MAX)) {
      recusadas++;
      const msg = `${key}  veio com ${(body.length / 1024).toFixed(0)}KB contra `
        + `${(ant.bytes / 1024).toFixed(0)}KB da foto anterior `
        + `(-${Math.round((1 - body.length / ant.bytes) * 100)}%) — a aba parece FILTRADA no Sheets. `
        + `Foto anterior MANTIDA.`;
      console.log(`RECUSADA  ${msg}`);
      console.log(`::error::gviz-robot: ${msg}`);
      continue;
    }

    const reg = { key, body, bytes: body.length, updated_at: new Date().toISOString() };
    if (temHash) reg.hash = hash;
    const up = await fetch(`${SUPA}/rest/v1/gviz_snapshot?on_conflict=key`, {
      method: 'POST',
      headers: { ...HDRS, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([reg])
    });
    if (!up.ok) throw new Error('upsert HTTP ' + up.status + ' ' + (await up.text()).slice(0, 120));
    ok++;
    console.log(`ok  ${key}  ${(body.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    falhas++;
    console.log(`FALHOU  ${key}  ${e.message}`);
  }
}
console.log(`\n${ok} ok (${iguais} sem mudança) · ${recusadas} recusada(s) · ${falhas} falha(s) de ${ALVOS.length} alvos`);
if (recusadas) {
  console.log('\nAba filtrada no Sheets esconde dado do painel. A foto boa foi mantida,');
  console.log('mas quem abrir depois dos 15s iniciais (ou clicar em "Atualizar dados")');
  console.log('vai DIRETO ao Google e enxerga o filtro ao vivo. Tirar o filtro na aba');
  console.log('e redisparar este robô.');
}
if (ok === 0) process.exit(1);   // nada gravado = erro de verdade; falha parcial não derruba (o shim cai p/ o Google)
if (recusadas) process.exit(1);  // recusa é alarme: o job fica vermelho para alguém olhar
