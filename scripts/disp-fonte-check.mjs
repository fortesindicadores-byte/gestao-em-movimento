// ============================================================
// Disp Fonte Check — a PLANILHA e o BANCO lado a lado
//
// O app de Indisponibilidade entrou em 14/08/2026 e as unidades
// lançam nele. Mas o Gestão à Vista (farol-core.js, loadDisp/loadInd)
// ainda lê as abas `Disponibilidade` e `Indisponibilidade` do
// Consolidado Geral, alimentadas pelo Apps Script. Resultado: a
// unidade preenche num lugar e o coordenador olha outro — foi a
// queixa do coordenador do GRL em 19/09/2026 ("placas que não estão
// lançadas aparecem e placas lançadas faltam").
//
// Este script mede os dois lados ANTES de trocar a fonte do painel:
//   - PLANILHA: a foto do último dia presente na aba (é exatamente o
//     recorte que a tela faz hoje: rs.filter(r => r.dt === mx));
//   - BANCO: os eventos abertos (data_retorno is null) da tabela
//     `indisponibilidade`, que é o que a unidade lança no app.
//
// Imprime, por unidade: quantas placas cada lado tem, quantas batem,
// quais só a planilha tem e quais só o banco tem — e a idade de cada
// fonte, porque "a planilha está velha" e "a placa não foi lançada"
// parecem a mesma coisa na tela e não são.
//
// Não imprime chave nenhuma. Roda no Actions (o sandbox não alcança
// nem o Supabase nem o docs.google).
// ============================================================
const URL_SB  = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!SERVICE) { console.error('Falta o secret GEM_SUPABASE_SERVICE_KEY.'); process.exit(1); }

const DISP_SHEET_ID = '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o';   // Consolidado Geral

const sb = async path => {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const txt = await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  return { ok: r.ok, status: r.status, body };
};

/* ---------- gviz (o MESMO pedido que o painel faz) ---------- */
const gviz = async sheet => {
  const u = `https://docs.google.com/spreadsheets/d/${DISP_SHEET_ID}/gviz/tq`
          + `?sheet=${encodeURIComponent(sheet)}&headers=1&tqx=out:json`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`gviz ${sheet}: HTTP ${r.status}`);
  const t = await r.text();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  const o = JSON.parse(t.slice(i, j + 1));
  const cols = (o.table.cols || []).map(c => c.label || c.id || '');
  const rows = (o.table.rows || []).map(r => (r.c || []).map(c => (c ? (c.v != null ? c.v : c.f) : null)));
  return { cols, rows };
};

/* ---------- de-para de unidade: as MESMAS regras do farol-core ---------- */
const _n = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const IND_CITY = { RONDONOPOLIS:'RON', GUARULHOS:'GRL', FLORIANOPOLIS:'FLP', PELOTAS:'PLT',
                   'NOVA FRIBURGO':'NFR', 'BALNEARIO CAMBORIU':'BLC', 'CAMPO GRANDE':'CGR', PIRAI:'PIR' };
function mapIndCT(uni, proj, tipo) {
  const u = _n(uni), p = _n(proj), t = _n(tipo);
  if (u === 'CUIABA') {
    if (p === 'APOIO' || t.includes('EMPILHADEIRA')) return 'CBA T1 WH';
    if (p === 'EMPURRADA') return 'CBA T1';
    return 'CBA T2';
  }
  if (u === 'CACHOEIRAS DE MACACU' || u === 'MACACU') return p === 'EMPURRADA' ? 'MCC T1' : 'MCC T2';
  return IND_CITY[u] || u;          // desconhecido fica com o nome, como na tela
}
const idxDe = (cols, ...names) => {
  const N = cols.map(_n);
  for (const nm of names) { const i = N.indexOf(_n(nm)); if (i >= 0) return i; }
  for (const nm of names) { const t = _n(nm); const i = N.findIndex(c => c.includes(t)); if (i >= 0) return i; }
  return -1;
};
const dnum = v => {                  // "Date(2026,8,18)" ou "18/09/2026" → 20260918
  const s = String(v || '');
  const m = s.match(/Date\((\d+),(\d+),(\d+)/);
  if (m) return +m[1] * 1e4 + (+m[2] + 1) * 100 + +m[3];
  const p = s.split('/');
  return p.length >= 3 ? +p[2] * 1e4 + +p[1] * 100 + +p[0] : 0;
};
const dTxt = n => (!n ? '—' : `${String(n % 100).padStart(2,'0')}/${String(Math.floor(n/100)%100).padStart(2,'0')}/${Math.floor(n/1e4)}`);
const pad = (s, n) => String(s).padEnd(n);
const npad = (v, n) => String(v).padStart(n);

/* ═════════ lado PLANILHA ═════════ */
console.log('\n═══ PLANILHA · aba Indisponibilidade do Consolidado Geral ═══');
let plan = [], planVig = 0, planErro = null;
try {
  const T = await gviz('Indisponibilidade');
  const c = T.cols;
  const i = {
    dt:   idxDe(c, 'Data'),
    uni:  idxDe(c, 'Unidade'),
    proj: idxDe(c, 'Projeto'),
    tipo: idxDe(c, 'Tipo Veículo', 'Tipo'),
    plaM: idxDe(c, 'Placa Mercosul'),
    pla:  idxDe(c, 'Placa'),
    st:   idxDe(c, 'Status'),
  };
  const todas = T.rows.map(r => ({
    dt: dnum(r[i.dt]),
    cod: mapIndCT(r[i.uni], r[i.proj], r[i.tipo]),
    uniNome: String(r[i.uni] || '').trim(),
    placa: String((i.plaM >= 0 && r[i.plaM]) || r[i.pla] || '').trim().toUpperCase(),
    st: String(r[i.st] || '').trim(),
  })).filter(r => r.cod && r.placa);
  planVig = Math.max(0, ...todas.map(r => r.dt));
  plan = planVig > 0 ? todas.filter(r => r.dt === planVig) : todas;
  console.log(`  linhas na aba: ${todas.length}  ·  última data presente: ${dTxt(planVig)}`);
  console.log(`  a TELA mostra só essa data: ${plan.length} placa(s)`);
  const idade = planVig ? Math.round((Date.now() - new Date(Math.floor(planVig/1e4), Math.floor(planVig/100)%100 - 1, planVig%100).getTime()) / 864e5) : null;
  if (idade != null) console.log(`  idade da foto: ${idade} dia(s)${idade > 1 ? '   ← o Apps Script não rodou desde então' : ''}`);
} catch (e) { planErro = e.message; console.log(`  FALHOU: ${e.message}`); }

/* ═════════ lado BANCO ═════════ */
console.log('\n═══ BANCO · tabela indisponibilidade (o que a unidade lança no app) ═══');
const rb = await sb('indisponibilidade?select=unidade,unidade_nome,projeto,placa,status,data_parada,previsao_retorno,data_retorno,updated_at&data_retorno=is.null&limit=2000');
if (!rb.ok) { console.error(`  não deu para ler: ${rb.status} ${JSON.stringify(rb.body)}`); process.exit(1); }
const banco = (rb.body || []).map(r => ({ ...r, placa: String(r.placa || '').trim().toUpperCase() }));
console.log(`  eventos ABERTOS: ${banco.length}`);
const ult = banco.map(r => r.updated_at).filter(Boolean).sort().pop();
if (ult) console.log(`  lançamento mais recente: ${new Date(ult).toLocaleString('pt-BR')}`);

/* quem está usando o app, e desde quando */
const tot = await sb('indisponibilidade?select=id&limit=1', );
const hist = await sb('indisponibilidade?select=unidade,created_at&order=created_at.desc&limit=2000');
if (hist.ok) {
  const porUni = {};
  (hist.body || []).forEach(r => { (porUni[r.unidade] = porUni[r.unidade] || { n: 0, ult: null }); porUni[r.unidade].n++;
    if (!porUni[r.unidade].ult || r.created_at > porUni[r.unidade].ult) porUni[r.unidade].ult = r.created_at; });
  console.log('\n  quem lançou no app (todos os eventos, abertos e fechados):');
  console.log('  ' + pad('UNIDADE', 12) + npad('EVENTOS', 8) + '   ÚLTIMO LANÇAMENTO');
  Object.keys(porUni).sort().forEach(u => {
    const o = porUni[u];
    console.log('  ' + pad(u, 12) + npad(o.n, 8) + '   ' + (o.ult ? new Date(o.ult).toLocaleString('pt-BR') : '—'));
  });
}

if (planErro) { console.log('\nSem o lado da planilha não há comparação. Fim.'); process.exit(1); }

/* ═════════ comparação por unidade ═════════ */
console.log('\n═══ LADO A LADO, por unidade ═══');
const unis = [...new Set([...plan.map(r => r.cod), ...banco.map(r => r.unidade)])].sort();
console.log('  ' + pad('UNIDADE', 12) + npad('PLANILHA', 9) + npad('BANCO', 7) + npad('BATEM', 7)
          + npad('SÓ PLAN', 9) + npad('SÓ BANCO', 10));
let sp = 0, sb_ = 0, ig = 0;
const detalhe = [];
unis.forEach(u => {
  const P = new Set(plan.filter(r => r.cod === u).map(r => r.placa));
  const B = new Set(banco.filter(r => r.unidade === u).map(r => r.placa));
  const soP = [...P].filter(p => !B.has(p)), soB = [...B].filter(p => !P.has(p));
  const iguais = [...P].filter(p => B.has(p));
  sp += soP.length; sb_ += soB.length; ig += iguais.length;
  console.log('  ' + pad(u, 12) + npad(P.size, 9) + npad(B.size, 7) + npad(iguais.length, 7)
            + npad(soP.length, 9) + npad(soB.length, 10));
  if (soP.length || soB.length) detalhe.push({ u, soP, soB });
});
console.log('  ' + pad('TOTAL', 12) + npad(plan.length, 9) + npad(banco.length, 7) + npad(ig, 7)
          + npad(sp, 9) + npad(sb_, 10));

console.log('\n═══ AS PLACAS QUE NÃO BATEM ═══');
if (!detalhe.length) console.log('  nenhuma — os dois lados dizem a mesma coisa.');
detalhe.forEach(d => {
  console.log(`\n  ${d.u}`);
  if (d.soP.length) console.log(`    só na PLANILHA (aparecem na tela e não estão lançadas no app): ${d.soP.join(' ')}`);
  if (d.soB.length) console.log(`    só no BANCO (a unidade lançou e a tela NÃO mostra):            ${d.soB.join(' ')}`);
});

/* ═════════ o denominador: ativos ═════════ */
console.log('\n═══ O HERO (%) — de onde sai o denominador ═══');
try {
  const T = await gviz('Disponibilidade');
  const c = T.cols;
  const i = { dt: idxDe(c, 'Data'), at: idxDe(c, 'Ativos'), ind: idxDe(c, 'Indisponíveis', 'Indisponiveis', 'Indisp') };
  const vg = v => { const s = String(v||''); const m = s.match(/Date\((\d+),(\d+),(\d+)/);
    if (m) return +m[1]*100 + (+m[2]+1); const p = s.split('/'); return p.length>=3 ? +p[2]*100 + +p[1] : 0; };
  const rs = T.rows.map(r => ({ vig: vg(r[i.dt]), at: +r[i.at] || 0, ind: +r[i.ind] || 0 }));
  const mx = Math.max(0, ...rs.map(r => r.vig));
  const f = rs.filter(r => r.vig === mx);
  const at = f.reduce((s, r) => s + r.at, 0), ind = f.reduce((s, r) => s + r.ind, 0);
  console.log(`  PLANILHA (aba Disponibilidade, vigência ${String(mx%100).padStart(2,'0')}/${Math.floor(mx/100)}): `
            + `${at} ativos · ${ind} indisponíveis · ${at ? ((at-ind)/at*100).toFixed(1) : '—'}%`);
} catch (e) { console.log(`  planilha: FALHOU (${e.message})`); }

const ds = await sb('disp_snapshot?select=data,unidade,ativos,indisponiveis&order=data.desc&limit=400');
if (ds.ok && (ds.body || []).length) {
  const d0 = ds.body[0].data;
  const f = ds.body.filter(r => r.data === d0);
  const at = f.reduce((s, r) => s + (r.ativos || 0), 0), ind = f.reduce((s, r) => s + (r.indisponiveis || 0), 0);
  console.log(`  BANCO (disp_snapshot, foto de ${d0}): ${at} ativos · ${ind} indisponíveis · ${at ? ((at-ind)/at*100).toFixed(1) : '—'}%`);
  const dias = Math.round((Date.now() - new Date(d0 + 'T12:00:00').getTime()) / 864e5);
  if (dias > 1) console.log(`    ⚠ a foto do pg_cron tem ${dias} dias — o job disp-snapshot-diario pode não estar rodando`);
} else {
  console.log('  BANCO (disp_snapshot): vazio ou ilegível — o hero não pode sair do banco ainda');
}

console.log('\nFim. A tela hoje mostra o lado PLANILHA; o app escreve no lado BANCO.');
