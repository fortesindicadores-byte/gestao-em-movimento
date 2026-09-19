// ============================================================
// Banco Inventario — a foto do banco inteiro, para conferir que nada sumiu
//
// Nasceu em 19/09/2026, quando o Renan colou um Apps Script no SQL Editor do
// Supabase por engano e veio a dúvida legítima: "rodei o sql errado". Erro de
// sintaxe no Postgres aborta antes de executar, então o banco não muda — mas
// isso se PROVA, não se promete.
//
// Lista TODAS as tabelas e views que o PostgREST expõe (do schema OpenAPI, sem
// lista escrita à mão, que é justamente o que esconderia uma tabela sumida) e
// conta as linhas de cada uma com count=exact & limit=0 — o corpo não trafega.
//
// Não imprime chave nenhuma.
// ============================================================
const URL_SB  = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!SERVICE) { console.error('Falta o secret GEM_SUPABASE_SERVICE_KEY.'); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

/* 1) o catálogo do PostgREST: tudo que existe e está exposto */
const raiz = await fetch(`${URL_SB}/rest/v1/`, { headers: H });
if (!raiz.ok) { console.error(`Não consegui ler o catálogo: HTTP ${raiz.status}`); process.exit(1); }
const api = await raiz.json();
const nomes = Object.keys(api.paths || {})
  .filter(p => p.startsWith('/') && p.length > 1 && !p.includes('{') && !p.startsWith('/rpc/'))
  .map(p => p.slice(1))
  .sort();
const rpcs = Object.keys(api.paths || {}).filter(p => p.startsWith('/rpc/')).length;

console.log(`\n═══ O QUE O BANCO EXPÕE AGORA ═══`);
console.log(`tabelas e views: ${nomes.length}  ·  funções (rpc): ${rpcs}\n`);

/* 2) contagem de cada uma, sem trazer o corpo */
const conta = async t => {
  try {
    const r = await fetch(`${URL_SB}/rest/v1/${encodeURIComponent(t)}?select=*&limit=0`,
      { headers: { ...H, Prefer: 'count=exact' } });
    if (!r.ok) return { erro: `HTTP ${r.status}` };
    const cr = r.headers.get('content-range') || '';        // "*/1234"
    const n = +(cr.split('/')[1]);
    return { n: isFinite(n) ? n : null };
  } catch (e) { return { erro: e.message }; }
};

const br = v => (v == null ? '—' : v.toLocaleString('pt-BR'));
const pad = (s, n) => String(s).padEnd(n);
const npad = (v, n) => String(v).padStart(n);

let vazias = 0, comErro = 0, total = 0;
const linhas = [];
for (const t of nomes) {
  const c = await conta(t);
  if (c.erro) { comErro++; linhas.push({ t, txt: c.erro, ruim: true }); continue; }
  total += c.n || 0;
  if (!c.n) vazias++;
  linhas.push({ t, txt: br(c.n), n: c.n });
}

console.log('  ' + pad('TABELA / VIEW', 34) + npad('LINHAS', 12));
console.log('  ' + '─'.repeat(46));
linhas.forEach(l => console.log('  ' + pad(l.t, 34) + npad(l.txt, 12) + (l.ruim ? '   ←' : '')));

console.log('\n═══ RESUMO ═══');
console.log(`  ${nomes.length} objetos · ${br(total)} linhas somadas · ${vazias} vazios · ${comErro} ilegíveis`);

/* 3) as colunas que a mudança de hoje precisa (conferência do SQL da Saúde) */
console.log('\n═══ O SQL DA SAÚDE JÁ FOI RODADO? ═══');
const r = await fetch(`${URL_SB}/rest/v1/saude_base?select=chave,impressao,mudou_em&limit=1`, { headers: H });
if (r.ok) console.log('  saude_base.impressao / mudou_em: JÁ EXISTEM ✓');
else console.log(`  saude_base.impressao / mudou_em: ainda NÃO (HTTP ${r.status}) — é o SQL que falta rodar`);
const g = await fetch(`${URL_SB}/rest/v1/ginfo_impressao?select=chave&limit=1`, { headers: H });
console.log(g.ok ? '  view ginfo_impressao: JÁ EXISTE ✓'
                 : `  view ginfo_impressao: ainda NÃO (HTTP ${g.status}) — é o SQL que falta rodar`);

console.log('\nFim. Objeto que sumisse não apareceria na lista acima.');
