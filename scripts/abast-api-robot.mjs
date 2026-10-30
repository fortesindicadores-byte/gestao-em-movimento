/*******************************************************************************
 * Robô das APIs de abastecimento → Supabase (abast_api)  — Renan, 28/10/2026
 *
 *   Pró-Frotas  postos externos   POST api-portal.profrotas.com.br/api/frotista/abastecimento/pesquisa
 *   SUMA        tanque interno    GET  pitstop.sumaconnect.com/api/integrate_systems/shipper/
 *   Gasola      postos            api.gasola.net  (relatório de abastecimentos da empresa)
 *
 * Uma linha por ITEM abastecido (Diesel e Arla na mesma parada = 2 linhas),
 * chave (sistema, id_origem, item): rodar de novo corrige, não duplica.
 * CPF e nome do motorista NÃO são gravados e nunca vão para o log (o log do
 * Actions é público): o log só tem unidade, contagens, somas e NOMES de campos.
 *
 * Credenciais:
 *   Pró-Frotas  chaves na aba "Base CNPJ" da planilha do time (como o robô do hodômetro)
 *   SUMA        secret SUMA_USER_TOKEN · CNPJs = os da Base CNPJ + SUMA_CNPJS (CSV opcional)
 *   Gasola      secret GASOLA_TOKENS (JSON, um token por conta) ou GASOLA_TOKEN (vai no header Authorization)
 *
 * Modos (ABAST_MODO):
 *   sonda   testa cada sistema e imprime os NOMES dos campos do 1º registro
 *   ensaio  coleta a janela e imprime o resumo, sem gravar
 *   gravar  coleta e grava em abast_api (+ abast_api_base)
 * Env: ABAST_DIAS (janela, padrão 10) · ABAST_DE / ABAST_ATE (AAAA-MM-DD) ·
 *      ABAST_SISTEMAS (CSV, padrão todos) · GEM_SUPABASE_SERVICE_KEY
 ******************************************************************************/

const MODO = (process.env.ABAST_MODO || 'ensaio').trim();
const DIAS = Number(process.env.ABAST_DIAS || 10);
const SIS  = (process.env.ABAST_SISTEMAS || 'PROFROTAS,SUMA,GASOLA').toUpperCase().split(/[,;\s]+/).filter(Boolean);
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = (process.env.GEM_SUPABASE_SERVICE_KEY || '').trim();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const esperar = ms => new Promise(r => setTimeout(r, ms));
const iso = d => d.toISOString().slice(0, 10);

/* ── janela ───────────────────────────────────────────────────────────────── */
const hojeBR = () => new Date(Date.now() - 3 * 3600e3);
const ATE = process.env.ABAST_ATE ? new Date(process.env.ABAST_ATE + 'T12:00:00Z') : hojeBR();
const DE  = process.env.ABAST_DE  ? new Date(process.env.ABAST_DE  + 'T12:00:00Z') : new Date(ATE.getTime() - DIAS * 864e5);
// fatias de N dias (as APIs não aguentam pedido grande)
function fatias(passo) {
  const out = [];
  for (let a = new Date(DE); a <= ATE; a = new Date(a.getTime() + passo * 864e5)) {
    const b = new Date(Math.min(a.getTime() + (passo - 1) * 864e5, ATE.getTime()));
    out.push([iso(a), iso(b)]);
  }
  return out;
}

/* ── normalização ─────────────────────────────────────────────────────────── */
const MERCOSUL = 'ABCDEFGHIJ';
const placaKey = p => {
  const s = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(s) ? s.slice(0, 4) + MERCOSUL[+s[4]] + s.slice(5) : s;
};
const semAc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function produto(s) {
  const n = semAc(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/ARLA/.test(n)) return 'ARLA 32';
  if (/DIESEL|S10|S500|S 10|S 500/.test(n)) return /500/.test(n) ? 'DIESEL S500' : 'DIESEL S10';
  if (/GASOLINA/.test(n)) return 'GASOLINA';
  if (/ETANOL|ALCOOL/.test(n)) return 'ETANOL';
  if (/GNV/.test(n)) return 'GNV';
  return n || null;
}
// nome da unidade (como a Base CNPJ / os sistemas escrevem) → sigla do portal
const UNI_REGRAS = [
  [/ANHANGUERA|SEARA/, 'ANG'], [/FRIBURGO/, 'NFR'], [/ITAJAI|CAMBORIU/, 'BLC'], [/PELOTAS/, 'PLT'],
  [/CAMPO GRANDE|RIO DE JANEIRO/, 'CGR'], [/RONDONOPOLIS/, 'RON'], [/CUIABA/, 'CBA'], [/GUARULHOS/, 'GRL'],
  [/PIRAI/, 'PIR'], [/MACACU/, 'MCC'], [/GOIANIA/, 'GNA'], [/FLORIANOPOLIS|FLORIPA|SAO JOSE|PALHOCA/, 'FLP'],
];
const sigla = nome => { const n = semAc(nome); for (const [re, s] of UNI_REGRAS) if (re.test(n)) return s; return null; };
// número: 1234.5 · "120.000" (SUMA: ponto é decimal) · "1.234,56" (BR, com vírgula)
const num = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const x = Number(s); return isFinite(x) ? x : null;
};
// "09/09/2026 - 20:51" ou "09/09/2026 20:51:00" (hora de Brasília) → Date
function dataBR(s) {
  const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})\D*(\d{2})?:?(\d{2})?:?(\d{2})?/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}-03:00`);
}
const diaBR = d => iso(new Date(d.getTime() - 3 * 3600e3));
const cnpjDig = v => String(v || '').replace(/\D/g, '').padStart(14, '0').slice(-14);
const mascara = c => c ? c.slice(0, 2) + '…' + c.slice(-4) : '—';

// nomes dos campos (só os NOMES, nunca os valores) para o modo sonda
function campos(o, pre = '', out = new Set()) {
  if (Array.isArray(o)) { if (o.length) campos(o[0], pre + '[]', out); return out; }
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) campos(o[k], pre ? pre + '.' + k : k, out); return out; }
  out.add(pre + ':' + (o === null ? 'null' : typeof o)); return out;
}
const val = (o, cam) => cam.split('.').reduce((x, k) => (x == null ? null : x[k]), o);
const primeiro = (o, cams) => { for (const c of cams) { const v = val(o, c); if (v != null && v !== '') return v; } return null; };

/* ── Base CNPJ (planilha do time, gviz) ───────────────────────────────────── */
const SHEET_ID = '1GKJM516l_Z-wM_KTgjAPzNVa4DEn8dmB66zW1UPuBL8';
async function lerBaseCnpj() {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('Base CNPJ')}`);
  if (!r.ok) throw new Error(`Base CNPJ: HTTP ${r.status}`);
  const m = (await r.text()).match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!m) throw new Error('Base CNPJ: resposta fora do formato');
  const v = c => (c && c.v != null ? String(c.v).trim() : '');
  const out = [];
  for (const l of JSON.parse(m[1]).table.rows || []) {
    const c = l.c || [];
    const cnpj = v(c[0]).replace(/\D/g, ''), unidade = v(c[1]), chave = v(c[2]);
    if (!unidade || /^unidade$/i.test(unidade)) continue;
    out.push({ cnpj: cnpj ? cnpjDig(cnpj) : '', unidade, chave });
  }
  return out;
}

/* ════════════════════════ PRÓ-FROTAS ════════════════════════ */
const PF_URL = 'https://api-portal.profrotas.com.br';
async function pfPagina(chave, per, pagina) {
  const r = await fetch(PF_URL + '/api/frotista/abastecimento/pesquisa', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + chave, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagina, dataInicial: per[0] + 'T00:00:00.000-03:00', dataFinal: per[1] + 'T23:59:59.999-03:00' }),
  });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function pfUnidade(u) {
  const regs = [];
  let falhas = 0;
  const fs = fatias(15);
  for (const per of fs) {
    let ok = false, ult = '';
    for (let t = 1; t <= 3 && !ok; t++) {
      try {
        for (let pag = 1; pag <= 50; pag++) {
          const j = await pfPagina(u.chave, per, pag);
          if (!j) break;
          const rs = j.registros || [];
          regs.push(...rs);
          const tam = j.tamanhoPagina || rs.length || 0;
          if (!tam || !rs.length || pag >= Math.ceil((j.totalItems || 0) / tam)) break;
          await esperar(400);
        }
        ok = true;
      } catch (e) { ult = e.message; if (t < 3) await esperar(/429/.test(ult) ? t * 15000 : t * 3000); }
    }
    if (!ok) { falhas++; log(`   Pró-Frotas ${u.unidade}: fatia ${per[0]}→${per[1]} falhou (${ult})`); }
    await esperar(400);
  }
  if (falhas && falhas === fs.length) throw new Error(`todas as ${fs.length} fatias falharam`);
  return { regs, falhas };
}
function pfLinhas(regs, u) {
  const out = [];
  for (const r of regs) {
    const id = primeiro(r, ['identificador', 'id', 'codigoAutorizacao', 'numCupom', 'numeroCupom', 'identificador', 'numeroTransacao']);
    const dt = new Date(primeiro(r, ['data', 'dataHora', 'dataAbastecimento', 'dataTransacao', 'dataCriacao']));
    if (id == null || isNaN(dt)) continue;
    const st = String(primeiro(r, ['statusAutorizacao', 'statusAutorizacao.codigo']) ?? '');
    const placa = primeiro(r, ['veiculo.placa', 'placa', 'placaVeiculo', 'veiculoPlaca']);
    const items = Array.isArray(r.items) ? r.items : (() => { try { return JSON.parse(r.items || '[]'); } catch { return []; } })();
    items.forEach((it, i) => {
      const litros = num(it.quantidade), valor = num(it.valorTotal);
      out.push({
        sistema: 'PROFROTAS', id_origem: String(id), item: i + 1, data: dt.toISOString(), dia: diaBR(dt),
        unidade: sigla(u.unidade), unidade_origem: u.unidade,
        placa: placaKey(placa), placa_origem: placa ? String(placa) : null,
        produto: produto(it.nome), produto_origem: it.nome ?? null,
        litros, preco: num(it.valorUnitario) ?? (litros ? valor / litros : null), valor,
        posto: primeiro(r, ['pontoVenda.razaoSocial', 'pontoVenda.nome', 'posto.razaoSocial', 'posto.nome', 'estabelecimento.nome']),
        cnpj_posto: (c => c ? cnpjDig(c) : null)(primeiro(r, ['pontoVenda.cnpj', 'posto.cnpj', 'estabelecimento.cnpj', 'cnpjPosto'])),
        hodometro: num(primeiro(r, ['odometro', 'hodometro', 'quilometragem', 'veiculo.odometro'])),
        valido: st === '1' && !r.abastecimentoEstornado && litros > 0 && valor > 0, status_origem: (r.abastecimentoEstornado ? 'estornado' : st) || null,
        modo: r.pontoVenda && r.pontoVenda.postoInterno ? 'POSTO INTERNO' : null, bomba: null, editado_origem: r.dataAtualizacao ? new Date(r.dataAtualizacao).toISOString() : null,
      });
    });
  }
  return out;
}
async function proFrotas(base) {
  const uns = base.filter(u => u.chave);
  log(`Pró-Frotas: ${uns.length} unidade(s) com chave`);
  const linhas = [], res = [];
  for (const u of uns) {
    try {
      const { regs, falhas } = await pfUnidade(u);
      if (MODO === 'sonda') { log(`   ${u.unidade}: ${regs.length} registro(s)`); if (regs[0]) log('   campos:', [...campos(regs[0])].join(' · ')); if (regs.length) return { linhas: [], res }; continue; }
      const ls = pfLinhas(regs, u);
      linhas.push(...ls);
      res.push({ unidade: u.unidade, registros: regs.length, itens: ls.length, falhas });
      log(`   ${u.unidade} (${sigla(u.unidade) || 'sem sigla'}): ${regs.length} abastecimento(s) → ${ls.length} item(ns)${falhas ? ` · ${falhas} fatia(s) com falha` : ''}`);
    } catch (e) { log(`   ERRO ${u.unidade}: ${e.message}`); res.push({ unidade: u.unidade, erro: e.message }); }
  }
  return { linhas, res };
}

/* ════════════════════════ SUMA ════════════════════════ */
// homologação (SUMA_HML=1): ambiente de testes da SUMA, só com o CNPJ de teste deles e sem gravar
const SUMA_HML = process.env.SUMA_HML === '1' || process.env.SUMA_HML === 'true';
const SUMA_URL = SUMA_HML
  ? 'https://pitstop-qa.sumaconnect.com/api/integrate_systems/shipper/'
  : 'https://pitstop.sumaconnect.com/api/integrate_systems/shipper/';
const SUMA_CNPJ_HML = '71864203000174';
async function suma(base) {
  const tok = ((SUMA_HML ? process.env.SUMA_HML_TOKEN : process.env.SUMA_USER_TOKEN) || '').trim();
  if (!tok) throw new Error((SUMA_HML ? 'SUMA_HML_TOKEN' : 'SUMA_USER_TOKEN') + ' não configurado (GitHub Secrets)');
  const extra = (process.env.SUMA_CNPJS || '').split(/[,;\s]+/).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 11).map(cnpjDig);
  const porCnpj = new Map(base.filter(u => u.cnpj).map(u => [u.cnpj, u.unidade]));
  const cnpjs = SUMA_HML ? [SUMA_CNPJ_HML] : [...new Set([...porCnpj.keys(), ...extra])];
  log(`SUMA${SUMA_HML ? ' (HOMOLOGAÇÃO)' : ''}: ${cnpjs.length} CNPJ(s) de filial no pedido`);
  const brd = s => s.split('-').reverse().join('/');
  const linhas = [], vistosCli = new Map();
  for (const per of fatias(15)) {
    for (let page = 1; page <= 500; page++) {
      const q = new URLSearchParams({ DataInicio: brd(per[0]), dataFim: brd(per[1]), cnpj: cnpjs.join(','), page: String(page) });
      let j = null, ult = '';
      for (let t = 1; t <= 3 && !j; t++) {
        try {
          const r = await fetch(SUMA_URL + '?' + q, { headers: { 'user-token': tok, Accept: 'application/json' } });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          j = await r.json();
        } catch (e) { ult = e.message; if (t < 3) await esperar(t * 3000); }
      }
      if (!j) throw new Error(`fatia ${per[0]}→${per[1]} página ${page}: ${ult}`);
      const its = j.itens || [];
      if (MODO === 'sonda') { log(`   ${per[0]}→${per[1]}: total ${j.total} · páginas ${j.pageSize}`); if (its[0]) { log('   campos:', [...campos(its[0])].join(' · ')); return { linhas: [], res: [] }; } break; }
      for (const r of its) {
        const dt = dataBR(r.dataOcorrencia);
        if (!r.numeroAbastecimento || !dt) continue;
        const cli = cnpjDig(r.cnpjCliente);
        const nome = porCnpj.get(cli) || null;
        vistosCli.set(cli, (vistosCli.get(cli) || 0) + 1);
        const litros = num(r.volume), valor = num(r.valorTotal);
        linhas.push({
          sistema: 'SUMA', id_origem: String(r.numeroAbastecimento), item: 1, data: dt.toISOString(), dia: diaBR(dt),
          unidade: nome ? sigla(nome) : null, unidade_origem: nome || ('CNPJ ' + mascara(cli)),
          placa: placaKey(r.placa), placa_origem: r.placa ?? null,
          produto: produto(r.nomeProduto || r.codigoProduto), produto_origem: r.nomeProduto ?? r.codigoProduto ?? null,
          litros, preco: num(r.valorUnitario) ?? (litros ? valor / litros : null), valor,
          posto: null, cnpj_posto: r.cnpjPosto ? cnpjDig(r.cnpjPosto) : null,
          hodometro: num(r.hodometro), valido: r.ativo !== false && litros > 0 && valor > 0, status_origem: r.ativo === false ? 'inativo' : 'ativo',
          modo: r.modo ?? null, bomba: r.bomba ?? null, editado_origem: dataBR(r.dataEdicao)?.toISOString() ?? null,
        });
      }
      if (!its.length || page >= (j.pageSize || 1)) break;
      await esperar(300);
    }
  }
  const res = [...vistosCli].map(([c, n]) => ({ cliente: porCnpj.get(c) || 'CNPJ ' + mascara(c), itens: n }));
  res.forEach(x => log(`   ${x.cliente}: ${x.itens} abastecimento(s)`));
  return { linhas, res };
}

/* ════════════════════════ GASOLA ════════════════════════ */
// GET api.gasola.net/v1/integration/report/supply?startDate&endDate (≤ 30 dias), header Authorization: {TOKEN}
// Resposta = lista; status CONCLUDED = concluído. dataConclusao "11/01/2024 03:40" (hora de Brasília).
const GASOLA_URL = 'https://api.gasola.net';
/* Vários tokens (Renan, 30/10/2026): o Gasola dá UM token de abastecimentos
   por conta (unidade), e Cuiabá e Macacu têm uma "Matriz" que enxerga as
   filiais. Secret GASOLA_TOKENS = JSON [{"nome","uni","abast"}] (o "nf" das
   notas fiscais fica guardado para depois). As contas de filial são lidas
   primeiro e dão a unidade; a Matriz só acrescenta o id que ninguém trouxe.
   Sem GASOLA_TOKENS, vale o GASOLA_TOKEN único de antes. */
function gasolaContas() {
  const raw = (process.env.GASOLA_TOKENS || '').trim();
  if (raw) {
    let l; try { l = JSON.parse(raw); } catch (e) { throw new Error('GASOLA_TOKENS não é um JSON válido'); }
    return l.filter(c => c && c.abast).map(c => ({ nome: String(c.nome || ''), uni: c.uni || null, tok: String(c.abast).trim(), matriz: /matriz/i.test(c.nome || '') }))
      .sort((x, y) => x.matriz - y.matriz);
  }
  const tok = (process.env.GASOLA_TOKEN || '').trim();
  if (!tok) throw new Error('GASOLA_TOKENS (ou GASOLA_TOKEN) não configurado (GitHub Secrets)');
  return [{ nome: 'Gasola', uni: null, tok, matriz: false }];
}
let GAS_FIX = 0;
async function gasola() {
  const contas = gasolaContas();
  const linhas = [], porUni = new Map(), vistos = new Set();
  for (const ct of contas) {
    let auth = ct.tok, n = 0, ok = true;                  // a doc manda o token cru; se der 401, tenta com Bearer
    for (const per of fatias(15)) {
      const q = new URLSearchParams({ startDate: per[0] + 'T00:00:00-03:00', endDate: per[1] + 'T23:59:59-03:00' });
      let lista = null, ult = '';
      // o Gasola limita pedidos (HTTP 429): espera o Retry-After (ou 30 s, 60 s, 90 s…) e tenta de novo
      for (let t = 1; t <= 6 && !lista; t++) {
        let ra = 0;
        try {
          let r = await fetch(`${GASOLA_URL}/v1/integration/report/supply?${q}`, { headers: { Authorization: auth, 'Content-Type': 'application/json' } });
          if (r.status === 401 && !/^Bearer /i.test(auth)) { auth = 'Bearer ' + ct.tok; r = await fetch(`${GASOLA_URL}/v1/integration/report/supply?${q}`, { headers: { Authorization: auth, 'Content-Type': 'application/json' } }); }
          if (r.status === 429) ra = (+r.headers.get('retry-after') || 0) * 1000;
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          lista = Array.isArray(j) ? j : (j.data || j.itens || j.items || []);
        } catch (e) { ult = e.message; if (t < 6) await esperar(/429/.test(ult) ? Math.max(ra, t * 30000) : t * 3000); }
      }
      // uma conta que falha não derruba as outras: fica no log e segue
      if (!lista) { log(`   ${ct.nome}: fatia ${per[0]}→${per[1]} falhou (${ult})`); ok = false; continue; }
      if (MODO === 'sonda') { log(`   ${ct.nome} · ${per[0]}→${per[1]}: ${lista.length} abastecimento(s)`); if (lista[0]) log('   campos:', [...campos(lista[0])].join(' · ')); break; }
      for (const r of lista) {
        const dt = dataBR(r.dataConclusao) || (r.emitidoEm ? new Date(r.emitidoEm) : null);
        if (!r.id || !dt || isNaN(dt) || vistos.has(String(r.id))) continue;
        vistos.add(String(r.id)); n++;
        const nome = r.unidade || ct.nome || null;
        const sg = ct.uni || sigla(r.unidade) || sigla(ct.nome);
        porUni.set(sg || nome, (porUni.get(sg || nome) || 0) + 1);
        const litros = num(r.totalLitros);
        let valor = num(r.valor);
        // valor que não bate com litros × preço cobrado (ex.: R$ 141 mi num tanque de 300 L): vale a conta
        const pc = num(r.precoCobrado) ?? num(r.valorLitroPago);
        if (litros > 0 && pc > 0 && !(valor > 0 && Math.abs(valor / (litros * pc) - 1) <= 0.2)) { valor = Math.round(litros * pc * 100) / 100; GAS_FIX++; }
        const st = String(r.status || '');
        linhas.push({
          sistema: 'GASOLA', id_origem: String(r.id), item: 1, data: dt.toISOString(), dia: diaBR(dt),
          unidade: sg, unidade_origem: nome,
          placa: placaKey(r.placa), placa_origem: r.placa ?? null,
          produto: produto(r.combustivel), produto_origem: r.combustivel ?? null,
          litros, preco: num(r.precoCobrado) ?? num(r.valorLitroPago) ?? (litros ? valor / litros : null), valor,
          posto: r.posto ?? null, cnpj_posto: r.cnpj ? cnpjDig(r.cnpj) : null,
          hodometro: num(r.km), valido: /CONCLU/i.test(st) && litros > 0 && valor > 0, status_origem: st || null,
          modo: r.categoria ?? null, bomba: null, editado_origem: null,
        });
      }
      await esperar(1500);
    }
    if (MODO !== 'sonda') log(`   conta ${ct.nome}${ct.uni ? ' (' + ct.uni + ')' : ''}: ${n} abastecimento(s) novo(s)${ok ? '' : ' · com falha'}`);
  }
  const res = [...porUni].map(([u, n]) => ({ unidade: u, sigla: u, itens: n }));
  res.forEach(x => log(`   ${x.unidade}: ${x.itens} abastecimento(s)`));
  if (GAS_FIX) log(`   ${GAS_FIX} abastecimento(s) com valor fora de litros × preço cobrado: gravados pela conta`);
  return { linhas, res };
}

/* ════════════════════════ Supabase ════════════════════════ */
async function sb(rota, metodo, corpo, prefer) {
  const r = await fetch(`${SB_URL}/rest/v1/${rota}`, {
    method: metodo,
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${rota}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}
async function grava(linhas) {
  const vistos = new Map();
  for (const l of linhas) vistos.set(`${l.sistema}|${l.id_origem}|${l.item}`, l);   // a mesma chave numa fatia e na seguinte
  const uni = [...vistos.values()];
  for (let i = 0; i < uni.length; i += 500)
    await sb('abast_api?on_conflict=sistema,id_origem,item', 'POST', uni.slice(i, i + 500).map(l => ({ ...l, coletado_em: new Date().toISOString() })), 'resolution=merge-duplicates');
  return uni.length;
}

/* ════════════════════════ main ════════════════════════ */
function resumo(nome, ls) {
  const g = new Map();
  for (const l of ls) {
    const k = `${l.unidade || '?'}|${l.dia.slice(0, 7)}|${l.produto}`;
    const a = g.get(k) || { n: 0, l: 0, v: 0, inv: 0 };
    a.n++; a.l += l.litros || 0; a.v += l.valor || 0; if (!l.valido) a.inv++;
    g.set(k, a);
  }
  log(`${nome}: ${ls.length} item(ns) · unidade | mês | produto → itens · litros · R$ · R$/L (inválidos)`);
  [...g].sort().forEach(([k, a]) => log(`   ${k.padEnd(28)} ${String(a.n).padStart(5)} · ${a.l.toFixed(0).padStart(8)} L · R$ ${a.v.toFixed(0).padStart(9)} · ${(a.l ? a.v / a.l : 0).toFixed(2)}${a.inv ? ` (${a.inv} inválidos)` : ''}`));
  const semUni = ls.filter(l => !l.unidade).length, semPlaca = ls.filter(l => !l.placa).length;
  if (semUni || semPlaca) log(`   sem unidade: ${semUni} · sem placa: ${semPlaca}`);
}

async function main() {
  log(`modo ${MODO} · janela ${iso(DE)} → ${iso(ATE)} · sistemas ${SIS.join(', ')}`);
  if (MODO === 'gravar' && !SB_KEY) throw new Error('GEM_SUPABASE_SERVICE_KEY ausente');
  if (MODO === 'gravar' && SUMA_HML) throw new Error('homologação da SUMA não grava: rode em sonda ou ensaio');
  const base = await lerBaseCnpj();
  log(`Base CNPJ: ${base.length} unidade(s) · ` + base.map(u => `${u.unidade}=${sigla(u.unidade) || '?'}`).join(' · '));
  const FN = { PROFROTAS: () => proFrotas(base), SUMA: () => suma(base), GASOLA: () => gasola() };
  let erros = 0;
  for (const s of SIS) {
    if (!FN[s]) { log(`sistema desconhecido: ${s}`); continue; }
    let r, erro = null;
    try { r = await FN[s](); } catch (e) { erro = e.message; log(`ERRO ${s}: ${erro}`); erros++; }
    if (MODO === 'sonda') continue;
    const ls = r ? r.linhas : [];
    if (r) resumo(s, ls);
    if (MODO === 'gravar') {
      let n = 0;
      if (ls.length) n = await grava(ls);
      await sb('abast_api_base?on_conflict=sistema', 'POST', [{ sistema: s, carregado_em: new Date().toISOString(), de: iso(DE), ate: iso(ATE), linhas: n, erro: erro, resumo: r ? r.res : null }], 'resolution=merge-duplicates');
      log(`${s}: ${n} linha(s) gravadas em abast_api`);
    }
  }
  if (erros) process.exit(1);
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
