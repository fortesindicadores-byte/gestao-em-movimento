// TCC (Renan, 10/10/2026): os DADOS BRUTOS que a seção de resultados do artigo
// pede — Tabela A (score por unidade e vigência), Tabela B (aderência ao FCA),
// Tabela C (causas recorrentes) e Tabela D (contexto). Tudo em TSV, impresso no
// log entre marcadores e salvo em docs/tcc-dados/ (artefato do workflow).
//
// O Scorecard NÃO é reimplementado: roda o `assets/gerot-base.js` de verdade
// (o mesmo do Frota de Elite, Gerot, Scorecard e FCAs da RPM) em node:vm, como o
// scorecard-ics-check.mjs, e aplica a MESMA pontuação do programa-reconhecimento
// (FIELD_WEIGHTS + calcScore_, copiados palavra por palavra). O FCA sai da tabela
// `fca` com as MESMAS réguas do fca-consolidado: preenchimento (causa E ação,
// `preOK`), aderência das ações ((concluídas×100 + andamento×50) ÷ total, a conta
// do assets/aderencia-view.js) e prazo (`prazoState`).
//
// Duas colunas de atingimento, de propósito:
//   atg      = a própria aderência (é o que o Frota de Elite PONTUA)
//   atgMeta  = real ÷ meta, teto 100 (é o que o Gerot mostra e o que gera FCA)
// A pontuação sai das duas réguas (pont_programa com atg, pont_meta com atgMeta).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = process.env.GEM_SUPABASE_SERVICE_KEY
            || 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
const OUT = process.env.TCC_OUT || 'docs/tcc-dados';
fs.mkdirSync(OUT, { recursive: true });

// ── gerot-base em node:vm (igual ao scorecard-ics-check.mjs) ──
const ctx = vm.createContext({ console, fetch, setTimeout, clearTimeout });
vm.runInContext('globalThis.window = globalThis;', ctx);
ctx.supabase = {
  createClient: () => ({
    from(tab) {
      const st = { tab, sel: '*', qs: [] };
      const run = async () => {
        const url = `${SB_URL}/rest/v1/${st.tab}?select=${encodeURIComponent(st.sel)}`
                  + (st.qs.length ? '&' + st.qs.join('&') : '');
        const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
        if (!r.ok) return { data: null, error: new Error(r.status + ' ' + (await r.text()).slice(0, 200)) };
        return { data: await r.json(), error: null };
      };
      const api = {
        select(s) { st.sel = s; return api; },
        eq(c, v) { st.qs.push(`${c}=eq.${encodeURIComponent(v)}`); return api; },
        in(c, arr) { st.qs.push(`${c}=in.(${arr.map(x => '"' + x + '"').join(',')})`); return api; },
        then(res, rej) { return run().then(res, rej); },
      };
      return api;
    },
  }),
};
ctx.document = {
  createElement: () => ({ remove() {} }),
  head: {
    appendChild(el) {
      fetch(el.src)
        .then(r => (r.ok ? r.text() : Promise.reject(new Error('http ' + r.status))))
        .then(t => vm.runInContext(t, ctx))
        .catch(() => { if (el.onerror) el.onerror(); });
    },
  },
};
vm.runInContext(fs.readFileSync(new URL('../assets/gerot-base.js', import.meta.url), 'utf8'), ctx);
const GerotBase = ctx.window.GerotBase;
if (!GerotBase) { console.log('GerotBase não carregou'); process.exit(1); }

// ── pontuação do programa-reconhecimento, palavra por palavra ──
const FIELD_WEIGHTS = { disp:20, prev:15, comb:10, pneus:10, checkT:10, checkWH:10, conf:5, stVeic:5, stEmp:5, sla:5, civf:5 };
const FIELD_ORDER   = Object.keys(FIELD_WEIGHTS);
function calcScore_(fields){ let num=0,den=0;
  for(const f of FIELD_ORDER){ const w=FIELD_WEIGHTS[f]/100; const v=fields[f];
    if(v==null) continue; den+=w; let v01=v/100; if(v01>1)v01=1; num+=w*v01; }
  return den>0?(num/den)*100:null; }

// unidade do Gerot → código do portal (o mesmo que a tabela `fca` usa)
const UNI2COD = {
  'CDD CAMBORIU':'BLC', 'CDD CUIABA':'CBA T2', 'CUIABA':'CBA T1 WH', 'CUIABA EMPURRADA':'CBA T1',
  'CDD FLORIANOPOLIS':'FLP', 'CDD GUARULHOS':'GRL', 'CDD NOVA FRIBURGO':'NFR', 'CDD PELOTAS':'PLT',
  'CDD RIO DE JANEIRO':'CGR', 'CDD RONDONOPOLIS':'RON', 'CDI MACACU':'MCC T2', 'MACACU EMPURRADA':'MCC T1',
  'PIRAI EMPURRADA':'PIR', 'MACACU':'MCC', 'CDD GOIANIA':'GNA',
};
const LABEL = GerotBase.fieldLabels;
const fmt = v => v == null || !isFinite(v) ? '' : String(Math.round(v * 1000) / 1000).replace('.', ',');
const mmaaaa = v => { const m = String(v || '').match(/^(\d{4})-(\d{2})$/); return m ? `${m[2]}/${m[1]}` : v; };

// TCC_SO=<nome> imprime no log SÓ essa tabela (o leitor de log guarda ~5.000
// linhas e a Tabela A por tier sozinha tem ~2.000); os arquivos saem todos.
const SO = (process.env.TCC_SO || '').trim();
const tsv = (nome, cab, linhas) => {
  const txt = [cab.join('\t'), ...linhas.map(l => l.map(x => x == null ? '' : String(x).replace(/[\t\n\r]+/g, ' ')).join('\t'))].join('\n');
  fs.writeFileSync(path.join(OUT, nome + '.tsv'), txt + '\n');
  if (SO && SO !== nome) { console.log(`(${nome}: ${linhas.length} linhas, não impressa — TCC_SO=${SO})`); return; }
  console.log(`\n=== TSV ${nome} (${linhas.length} linhas) ===`);
  console.log(txt);
  console.log(`=== FIM ${nome} ===`);
};

// ── Tabela A: indicadores por unidade × vigência × escopo ──
async function tabelaA(fundir) {
  const recs = await GerotBase.load({ fundir });
  const chave = recs.filter(r => !r.soGerot && r.atg != null && isFinite(r.atg) && /^\d{4}-\d{2}$/.test(String(r.vig || '')));
  const vigs = [...new Set(chave.map(r => r.vig))].sort();
  const linhas = [];
  const push = (r, escopo, vigFim) => linhas.push({
    unidade: r.unit, cod: UNI2COD[r.unit] || '', vig: vigFim, escopo, field: r.field,
    real: r.real, meta: r.meta, atg: r.atg, atgMeta: r.atgMeta, approx: r.approx ? 'aproximado' : (r.metades === 2 ? 'média das 2 réguas' : ''),
  });
  chave.forEach(r => push(r, 'mes', r.vig));
  // acumulado jan→M por vigência (o mesmo acumFor do Frota de Elite com várias vigências marcadas)
  vigs.forEach(fim => {
    const jan = vigs.filter(v => v.slice(0, 4) === fim.slice(0, 4) && v <= fim);
    if (jan.length < 2) return;
    GerotBase.acumFor(jan).forEach(r => { if (r.atg != null && isFinite(r.atg)) push(r, 'ano', fim); });
  });
  // pontuação por unidade × vigência × escopo, nas duas réguas
  const por = new Map();
  linhas.forEach(l => {
    const k = `${l.unidade}|${l.vig}|${l.escopo}`;
    if (!por.has(k)) por.set(k, { unidade: l.unidade, cod: l.cod, vig: l.vig, escopo: l.escopo, fA: {}, fM: {} });
    por.get(k).fA[l.field] = l.atg; por.get(k).fM[l.field] = l.atgMeta;
  });
  const pont = [...por.values()].map(o => ({ ...o, n: Object.keys(o.fA).length,
    pontA: calcScore_(o.fA), pontM: calcScore_(o.fM),
    faltam: FIELD_ORDER.filter(f => o.fA[f] == null).join(',') }));
  return { linhas, pont, vigs, unidades: [...new Set(chave.map(r => r.unit))].sort() };
}

const sufixo = f => f ? '_programa_macacu_unido' : '_por_tier';
for (const fundir of [false, true]) {
  console.log(`\n#### Scorecard ${fundir ? 'FUNDIDO (Frota de Elite: CDI MACACU + MACACU EMPURRADA = MACACU)' : 'POR TIER (Gerot/FCA: 13 unidades)'} ####`);
  const A = await tabelaA(fundir);
  console.log('vigências:', A.vigs.join(' '), '· unidades:', A.unidades.length);
  tsv('A_indicadores' + sufixo(fundir),
    ['unidade', 'codigo', 'vigencia', 'escopo', 'indicador', 'campo', 'real', 'meta', 'atingimento_aderencia(atg)', 'atingimento_meta(real/meta,teto100)', 'peso', 'obs'],
    A.linhas.sort((a, b) => a.unidade.localeCompare(b.unidade) || a.vig.localeCompare(b.vig) || a.escopo.localeCompare(b.escopo) || FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field))
      .map(l => [l.unidade, l.cod, mmaaaa(l.vig), l.escopo, LABEL[l.field] || l.field, l.field, fmt(l.real), fmt(l.meta), fmt(l.atg), fmt(l.atgMeta), FIELD_WEIGHTS[l.field], l.approx]));
  tsv('A_pontuacao' + sufixo(fundir),
    ['unidade', 'codigo', 'vigencia', 'escopo', 'indicadores_presentes', 'pontuacao_programa(atg)', 'pontuacao_meta(real/meta)', 'indicadores_ausentes'],
    A.pont.sort((a, b) => a.unidade.localeCompare(b.unidade) || a.vig.localeCompare(b.vig) || a.escopo.localeCompare(b.escopo))
      .map(p => [p.unidade, p.cod, mmaaaa(p.vig), p.escopo, p.n, fmt(p.pontA), fmt(p.pontM), p.faltam]));
}

// ── FCA: tabela inteira, paginada ──
async function fcaTudo() {
  const out = []; let de = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/fca?select=id,unidade,vigencia,origem,fato,projeto,causa,acao,responsavel,prazo,status,legado,created_at,updated_at&order=created_at.asc`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Range: `${de}-${de + 999}`, Prefer: 'count=exact' } });
    if (!r.ok) throw new Error('fca ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const page = await r.json(); out.push(...page);
    if (page.length < 1000) break; de += 1000;
  }
  return out;
}
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const vigNum = v => { const m = String(v || '').match(/^([a-zç]{3})\/(\d{2})$/i); if (!m) return 0; const i = MESES.indexOf(m[1].toLowerCase()); return (2000 + +m[2]) * 100 + (i < 0 ? 0 : i); };
const vigMM = v => { const n = vigNum(v); return n ? `${String(n % 100 + 1).padStart(2, '0')}/${Math.floor(n / 100)}` : v; };
const DEFAULT_STATUS = 'Não iniciada';
const preOK = o => !!(String(o.causa || '').trim() && String(o.acao || '').trim());
function prazoState(r) {
  const st = String(r.status || DEFAULT_STATUS);
  if (/conclu|cancel/i.test(st)) return 'No prazo';
  if (!r.prazo) return 'Sem prazo';
  const d = new Date(String(r.prazo).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return 'Sem prazo';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return d < hoje ? 'Vencida' : 'No prazo';
}
const concl = r => { const st = String(r.status || DEFAULT_STATUS); return /conclu/i.test(st) ? 'Concluída' : (/andamento/i.test(st) ? 'Andamento' : 'Não Iniciada'); };
const firstLine = s => String(s || '').split('\n')[0].trim();

function statB(rows) {
  const n = rows.length; if (!n) return null;
  let pre = 0, resp = 0, c = 0, a = 0, ni = 0, venc = 0, semP = 0, leg = 0, concPrazo = 0;
  rows.forEach(r => {
    if (preOK(r)) pre++;
    if (preOK(r) && String(r.responsavel || '').trim() && r.prazo) resp++;
    const k = concl(r); if (k === 'Concluída') c++; else if (k === 'Andamento') a++; else ni++;
    const p = prazoState(r); if (p === 'Vencida') venc++; else if (p === 'Sem prazo') semP++;
    if (r.legado) leg++;
    if (k === 'Concluída' && r.prazo && String(r.updated_at).slice(0, 10) <= String(r.prazo).slice(0, 10)) concPrazo++;
  });
  const pct = x => fmt(x / n * 100);
  return [n, pre, pct(pre), resp, pct(resp), c, a, ni, pct(c), fmt((c * 100 + a * 50) / n), venc, semP, pct(n - venc), concPrazo, leg];
}
const CAB_B = ['fcas_gerados', 'com_causa_e_acao', 'preenchimento_%', 'com_causa_acao_resp_prazo', 'completos_%', 'concluidas', 'em_andamento', 'nao_iniciadas', 'concluidas_%', 'aderencia_acoes_%(concl100+andam50)', 'vencidas_hoje', 'sem_prazo', 'no_prazo_%', 'concluidas_ate_o_prazo(updated_at<=prazo)', 'legado'];

const fca = await fcaTudo();
console.log(`\n#### FCA: ${fca.length} linhas (1 por ação) ####`);
const grp = (rows, key) => { const m = new Map(); rows.forEach(r => { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };
const linB = [];
grp(fca, r => `${r.unidade}|${r.vigencia}`).forEach((rows, k) => {
  const [uni, vig] = k.split('|');
  ['RPM', 'Custos', 'Todas'].forEach(o => {
    const sub = o === 'Todas' ? rows : rows.filter(r => r.origem === o);
    const s = statB(sub); if (s) linB.push([uni, vig, vigMM(vig), o, ...s]);
  });
});
linB.sort((a, b) => a[0].localeCompare(b[0]) || vigNum(a[1]) - vigNum(b[1]) || a[3].localeCompare(b[3]));
tsv('B_fca_aderencia', ['unidade', 'vigencia', 'vigencia_MM/AAAA', 'origem', ...CAB_B], linB);

// por vigência, todas as unidades (para o gráfico da evolução da aderência)
const linB2 = [];
grp(fca, r => r.vigencia).forEach((rows, vig) => { const s = statB(rows); if (s) linB2.push([vig, vigMM(vig), 'Todas', ...s]); });
linB2.sort((a, b) => vigNum(a[0]) - vigNum(b[0]));
tsv('B2_fca_por_vigencia', ['vigencia', 'vigencia_MM/AAAA', 'origem', ...CAB_B], linB2);

// ── Tabela C: causas recorrentes ──
const comCausa = fca.filter(r => String(r.causa || '').trim());
const linC = [];
grp(comCausa, r => `${r.origem}\u0001${firstLine(r.fato)}\u0001${String(r.causa).trim()}`).forEach((rows, k) => {
  const [o, f, c] = k.split('\u0001');
  linC.push([o, f, c, rows.length, [...new Set(rows.map(r => r.unidade))].sort().join(', '), [...new Set(rows.map(r => r.vigencia))].sort((a, b) => vigNum(a) - vigNum(b)).join(', ')]);
});
linC.sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
tsv('C_causas', ['origem', 'fato(indicador/conta)', 'causa', 'ocorrencias', 'unidades', 'vigencias'], linC);
// e o fato sozinho (quantos FCAs cada indicador/conta gerou)
const linC2 = [];
grp(fca, r => `${r.origem}\u0001${firstLine(r.fato)}`).forEach((rows, k) => { const [o, f] = k.split('\u0001'); linC2.push([o, f, rows.length, rows.filter(preOK).length, [...new Set(rows.map(r => r.unidade))].length]); });
linC2.sort((a, b) => b[2] - a[2]);
tsv('C2_fatos', ['origem', 'fato(indicador/conta)', 'fcas', 'com_causa_e_acao', 'unidades_distintas'], linC2);

// ── Tabela D: contexto ──
const Afull = await tabelaA(false);   // recarrega por tier para o contexto
const linD = [];
const porUni = grp(Afull.linhas.filter(l => l.escopo === 'mes'), l => l.unidade);
const fcaUni = grp(fca, r => r.unidade);
const todasUni = new Set([...[...porUni.keys()].map(u => UNI2COD[u] || u), ...fcaUni.keys()]);
[...todasUni].sort().forEach(cod => {
  const uni = Object.keys(UNI2COD).find(u => UNI2COD[u] === cod) || '';
  const sc = porUni.get(uni) || [];
  const vs = [...new Set(sc.map(l => l.vig))].sort();
  const fr = fcaUni.get(cod) || [];
  const fv = [...new Set(fr.map(r => r.vigencia))].sort((a, b) => vigNum(a) - vigNum(b));
  const fv1 = fr.length ? fr.reduce((m, r) => r.created_at < m ? r.created_at : m, fr[0].created_at).slice(0, 10) : '';
  linD.push([cod, uni, vs.length ? mmaaaa(vs[0]) : '', vs.length ? mmaaaa(vs[vs.length - 1]) : '', vs.length,
    vs.length === Afull.vigs.length ? 'sim' : 'não', fr.length, fv[0] ? vigMM(fv[0]) : '', fv.length ? vigMM(fv[fv.length - 1]) : '', fv1]);
});
tsv('D_contexto_unidades', ['codigo', 'unidade_gerot', 'score_1a_vigencia', 'score_ultima_vigencia', 'score_n_vigencias', 'score_em_todas_as_vigencias', 'fcas', 'fca_1a_vigencia', 'fca_ultima_vigencia', 'fca_1o_registro_criado_em'], linD);

console.log(`\n#### Resumo ####`);
console.log('Scorecard: vigências', Afull.vigs.map(mmaaaa).join(' '), '·', Afull.unidades.length, 'unidades por tier');
console.log('FCA:', fca.length, 'ações ·', comCausa.length, 'com causa ·', fca.filter(r => r.legado).length, 'legado ·',
  'vigências', [...new Set(fca.map(r => r.vigencia))].sort((a, b) => vigNum(a) - vigNum(b)).join(' '));
console.log('arquivos em', OUT, ':', fs.readdirSync(OUT).join(', '));
