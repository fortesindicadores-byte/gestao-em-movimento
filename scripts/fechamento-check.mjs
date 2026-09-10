// ============================================================
// FECHAMENTO DO MÊS — o que já entrou e o que ainda depende de gente
// (Renan, 10/09/2026: "Agosto, falta alguma atualização manual ainda?")
//
// Percorre TODAS as fontes que alimentam os painéis e diz, para uma vigência,
// quais já têm o mês e quais pararam antes. Só leitura.
//
// A pergunta que ele faz todo fechamento é sempre a mesma, então a resposta
// vira workflow em vez de investigação: base do Sheets, indicadores do Frota
// de Elite, FCA, telemetria, contrato do ERP e coleta do Ginfo.
//
// Uso: GEM_SUPABASE_SERVICE_KEY=... [FECHA_VIG=2026-08] node scripts/fechamento-check.mjs
// ============================================================
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

// padrão: o mês anterior, que é o que se fecha
const hoje = new Date();
const ref = process.env.FECHA_VIG
  || `${hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()}-${String(hoje.getMonth() === 0 ? 12 : hoje.getMonth()).padStart(2, '0')}`;
const [ANO, MES] = ref.split('-');
const MMYYYY = `${MES}/${ANO}`;                       // sh_* e elite_snapshot
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MMMAA = `${MESES[+MES - 1]}/${ANO.slice(2)}`;   // fca
const DIA1 = `${ref}-01`;                             // ce_scores_mensais

console.log(`FECHAMENTO DE ${MMMAA.toUpperCase()}  (${MMYYYY})\n`);

// conta sem trazer linha: o total vem no cabeçalho Content-Range
async function conta(tabela, filtro) {
  const r = await fetch(`${SB}/rest/v1/${tabela}?select=*&limit=1${filtro ? '&' + filtro : ''}`,
    { headers: { ...H, Prefer: 'count=exact' } });
  if (!r.ok) return { erro: `${r.status} ${(await r.text()).slice(0, 80)}` };
  const cr = r.headers.get('content-range') || '';
  return { n: +(cr.split('/')[1] || 0) };
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const falta = [];

// ── 1) bases manuais do Sheets ──────────────────────────────────────────────
const rb = await fetch(`${SB}/rest/v1/sh_base?select=slug,nome,linhas,carregado_em,erro&order=slug`, { headers: H });
const bases = rb.ok ? await rb.json() : [];
console.log(`── BASES DO SHEETS (${bases.length}) ──`);
let comVig = 0, temMes = 0;
for (const b of bases) {
  const t = await conta('sh_' + b.slug, `vigencia=eq.${encodeURIComponent(MMYYYY)}`);
  if (t.erro) { console.log(`   ${b.slug.padEnd(26)} —  (${t.erro})`); continue; }
  const tot = await conta('sh_' + b.slug, '');
  const temCol = t.n > 0 || (await conta('sh_' + b.slug, 'vigencia=not.is.null')).n > 0;
  if (!temCol) continue;                       // aba sem vigência: não dá para cobrar mês
  comVig++;
  const ok = t.n > 0; if (ok) temMes++; else falta.push(`Sheets · ${b.nome || b.slug}`);
  console.log(`   ${ok ? '✔' : '✘'} ${(b.nome || b.slug).slice(0, 34).padEnd(36)}`
    + `${String(t.n).padStart(6)} linha(s) de ${String(tot.n).padStart(6)}`
    + (b.erro ? `   ⚠ ${b.erro.slice(0, 50)}` : ''));
}
console.log(`   → ${temMes} de ${comVig} bases com vigência já têm ${MMMAA}\n`);

// ── 2) indicadores do Frota de Elite / Gerot ────────────────────────────────
const re = await fetch(`${SB}/rest/v1/elite_snapshot?select=indicador,escopo&vigencia=eq.${encodeURIComponent(MMYYYY)}`, { headers: H });
const eli = re.ok ? await re.json() : [];
const rePrev = await fetch(`${SB}/rest/v1/elite_snapshot?select=indicador&escopo=eq.mes&vigencia=eq.${encodeURIComponent(`${String(+MES - 1).padStart(2, '0')}/${ANO}`)}`, { headers: H });
const prev = rePrev.ok ? await rePrev.json() : [];
const mes = eli.filter(x => x.escopo === 'mes').map(x => x.indicador);
console.log('── INDICADORES (elite_snapshot) ──');
console.log(`   ${mes.length ? '✔' : '✘'} ${mes.length} indicador(es) no mês · ${eli.filter(x => x.escopo === 'ano').length} no acumulado do ano`);
const sumiu = prev.map(x => x.indicador).filter(i => !mes.includes(i));
if (sumiu.length) { console.log(`   ⚠ tinha no mês anterior e não tem em ${MMMAA}: ${sumiu.join(', ')}`); falta.push(`Indicadores · ${sumiu.join(', ')}`); }
if (!mes.length) falta.push('Indicadores · nenhum coletado');
console.log('');

// ── 3) FCA ──────────────────────────────────────────────────────────────────
const f = await conta('fca', `vigencia=eq.${encodeURIComponent(MMMAA)}`);
console.log('── FCA ──');
console.log(`   ${f.n ? '✔' : '✘'} ${f.n || 0} fato(s) em ${MMMAA}`);
if (!f.n) { console.log('   → falta rodar a geração do mês (Custos e Desvios da RPM), que é manual e só admin'); falta.push('FCA · gerar os fatos do mês'); }
console.log('');

// ── 4) telemetria (DriverPro) ───────────────────────────────────────────────
const ce = await conta('ce_scores_mensais', `competencia=eq.${DIA1}`);
console.log('── TELEMETRIA ──');
console.log(`   ${ce.n ? '✔' : '✘'} ${ce.n || 0} motorista(s) com nota em ${MMMAA}`);
if (!ce.n) falta.push('Telemetria · nota mensal do mês');
console.log('');

// ── 5) contrato de manutenção (ERP) ─────────────────────────────────────────
let ct = await conta('custo_vigencia_mv', `vig_km=eq.${ref}`);
if (ct.erro) ct = await conta('custo_vigencia', `vig_km=eq.${ref}`);
console.log('── CONTRATO DE MANUTENÇÃO ──');
console.log(`   ${ct.n ? '✔' : '✘'} ${ct.n || 0} placa(s) com km de ${MMMAA}` + (ct.erro ? `  (${ct.erro})` : ''));
if (!ct.n) falta.push('Contrato · carga do ERP do mês');
console.log('');

// ── 6) coleta do Ginfo: não tem vigência, tem IDADE ─────────────────────────
const rg = await fetch(`${SB}/rest/v1/ginfo_snapshot?select=chave,updated_at&order=chave`, { headers: H });
const gin = rg.ok ? await rg.json() : [];
console.log('── COLETA DO GINFO (idade da última exportação) ──');
gin.forEach(g => {
  const h = (Date.now() - new Date(g.updated_at)) / 36e5;
  const velho = h > 36;
  if (velho) falta.push(`Ginfo · ${g.chave} parado há ${Math.round(h / 24)} d`);
  console.log(`   ${velho ? '✘' : '✔'} ${g.chave.padEnd(26)} ${h < 48 ? Math.round(h) + ' h' : Math.round(h / 24) + ' d'} atrás`);
});

// ── resumo ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(64));
if (!falta.length) console.log(`✔ ${MMMAA}: nada pendente de atualização manual.`);
else { console.log(`FALTA EM ${MMMAA.toUpperCase()} (${falta.length}):`); falta.forEach(x => console.log('   • ' + x)); }
