// FCA Seguros Check: ainda há fato de Seguros e licenças na tabela fca? E quais contas do DRE Frota
// caem nesse pacote (alguma com grafia que a exclusão do FCA não pega)? Só leitura, com a service key.
// Imprime unidade, vigência, projeto, fato e datas; nunca o nome de ninguém.
const URL = process.env.SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function tudo(q) { const out = [];
  for (let o = 0; ; o += 1000) { const r = await fetch(URL + q + `&offset=${o}&limit=1000`, { headers: H }); const j = await r.json();
    if (!Array.isArray(j)) { console.error('erro', r.status, JSON.stringify(j).slice(0, 200)); process.exit(1); }
    out.push(...j); if (j.length < 1000) break; } return out; }
const NK = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const ehSeg = s => /SEGUR|LICEN|IPVA/.test(NK(s));

const fca = await tudo('/rest/v1/fca?select=id,unidade,vigencia,projeto,origem,fato,fato_desvio,causa,acao,created_at,updated_at,auto_chave&order=id');
console.log(`fca: ${fca.length} linhas`);
const seg = fca.filter(r => ehSeg(String(r.fato || '').split('\n')[0]));
const porVig = {};
seg.forEach(r => { const k = r.vigencia; (porVig[k] = porVig[k] || []).push(r); });
console.log(`\n== fatos de Seguros/IPVA/licenças na fca: ${seg.length} linhas`);
Object.keys(porVig).sort().forEach(v => { const rs = porVig[v];
  console.log(`\n${v}: ${rs.length} linha(s)`);
  rs.forEach(r => console.log(`  ${r.unidade} · ${r.projeto || '—'} · ${String(r.fato).split('\n')[0]} · criado ${String(r.created_at).slice(0, 16)} · alterado ${String(r.updated_at || '').slice(0, 16)} · ${r.auto_chave ? 'automática' : 'manual'} · causa ${r.causa ? 'preenchida' : 'vazia'} · ação ${r.acao ? 'preenchida' : 'vazia'}`)); });
// contas citadas DENTRO de outros fatos (Outros) que falam de seguro
const dentro = fca.filter(r => !ehSeg(String(r.fato || '').split('\n')[0]) && ehSeg(r.fato_desvio));
console.log(`\n== outros fatos com seguro/IPVA no desvio: ${dentro.length}`);
dentro.slice(0, 30).forEach(r => console.log(`  ${r.vigencia} · ${r.unidade} · ${r.projeto || '—'} · ${String(r.fato).split('\n')[0]} · criado ${String(r.created_at).slice(0, 16)} · ${String(r.fato_desvio || '').replace(/\n/g, ' | ').slice(0, 160)}`));

const dre = await tudo('/rest/v1/sh_dre_frota?select=conta_gerencial,vigencia&order=linha');
const contas = {};
dre.forEach(r => { if (!ehSeg(r.conta_gerencial)) return; const c = String(r.conta_gerencial); const k = JSON.stringify(c); contas[k] = contas[k] || { c, ck: NK(c), n: 0, vigs: new Set() }; contas[k].n++; if (r.vigencia) contas[k].vigs.add(String(r.vigencia).slice(0, 7)); });
const EXCL = new Set(['IPVA E LICENCIAMENTO DE VEICULOS', 'IPVA E LICENCIAMENTO', 'SEGURO DE VEICULOS E EQUIPAMENTOS', 'SEGUROS']);
console.log(`\n== contas do DRE Frota com seguro/IPVA/licença (${dre.length} linhas lidas)`);
Object.values(contas).forEach(x => console.log(`  ${JSON.stringify(x.c)} · ${x.n} linhas · ${[...x.vigs].sort().slice(-3).join(', ')} · ${EXCL.has(x.ck) ? 'FORA do FCA (excluída)' : 'NÃO excluída → gera fato'}`));
