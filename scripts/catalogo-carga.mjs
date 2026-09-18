// ============================================================
// Catálogo → Supabase (cat_item · cat_modelo · cat_aplicacao · cat_sinonimo)
//
// Lê docs/catalogo/{itens,aplicacoes,modelos,sinonimos}.json e faz upsert.
// O JSON no repositório é a FONTE (é o que o Renan lê de casa e o que o painel
// usa de reserva); o banco é a cópia que o painel consulta primeiro.
//
// Regras:
//  · upsert por chave; depois apaga da cat_aplicacao o que NÃO veio no JSON
//    (linha removida da pesquisa some do banco) — mas só se a carga inteira
//    entrou, para nunca deixar a tabela pela metade;
//  · CATALOGO_DRY=1 só conta;
//  · falha em qualquer tabela = exit 1 (o job fica vermelho e o Saude Robot vê).
//
// Uso: node scripts/catalogo-carga.mjs   (workflow Catalogo Carga)
// ============================================================
import fs from 'node:fs';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = (process.env.GEM_SUPABASE_SERVICE_KEY || '').trim();
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const DRY = process.env.CATALOGO_DRY === '1';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const ler = f => JSON.parse(fs.readFileSync('docs/catalogo/' + f, 'utf8'));
const itens = ler('itens.json').itens;
const apl = ler('aplicacoes.json').linhas;
const cad = ler('pesquisa/modelos-cadastro.json');
const sin = fs.existsSync('docs/catalogo/sinonimos.json') ? ler('sinonimos.json').sinonimos : [];

// cat_modelo: do cadastro + notas de cadastro achadas na pesquisa
const notas = fs.existsSync('docs/catalogo/modelos-notas.json') ? ler('modelos-notas.json') : {};
const modelos = [...cad.mot.map(m => ({ ...m, motorizado: true })), ...cad.nao.map(m => ({ ...m, motorizado: false }))].map(m => {
  const [marca, modelo] = m.modelo.split(' | ');
  const anos = (m.anos || []).filter(Number);
  return { marca, modelo, tipo: (m.tipos || []).join(' / ') || null, n_ativos: m.n, ano_min: anos.length ? Math.min(...anos) : null,
           ano_max: anos.length ? Math.max(...anos) : null, motorizado: m.motorizado, nota: notas[m.modelo] || null, updated_at: new Date().toISOString() };
});

const linhas = apl.map(l => {
  const [marca, modelo] = l.modelo.split(' | ');
  return { marca, modelo, ano_de: l.anos ? l.anos[0] : null, ano_ate: l.anos ? l.anos[1] : null, sistema: l.sistema, item: l.item,
           especificacao: l.especificacao, quantidade: l.quantidade, unidade: l.unidade, intervalo: l.intervalo, codigo_ref: l.codigo_ref,
           status: l.status, fonte: l.fonte, nota: l.nota, rodada: l.rodada || null, arquivo: l.arquivo || null, updated_at: new Date().toISOString() };
});
// a chave única usa coalesce(ano,…): duas linhas iguais no JSON derrubariam o lote inteiro
const vistos = new Set();
const unicas = linhas.filter(l => { const k = [l.marca, l.modelo, l.sistema, l.item, l.ano_de ?? 0, l.ano_ate ?? 9999].join('|'); if (vistos.has(k)) return false; vistos.add(k); return true; });
if (unicas.length !== linhas.length) log(`aviso: ${linhas.length - unicas.length} linha(s) repetida(s) no JSON foram descartadas`);

async function upsert(tabela, rows, onConflict) {
  if (DRY) { log(`[DRY] ${tabela}: ${rows.length} linha(s)`); return; }
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB_URL}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`${tabela} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
  log(`${tabela}: ${rows.length} linha(s) gravada(s)`);
}
async function todas(tabela, sel) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${tabela}?select=${sel}`, { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${tabela} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json(); out.push(...p); if (p.length < 1000) return out;
  }
}

try {
  await upsert('cat_item', itens.map(i => ({ ...i, updated_at: new Date().toISOString() })), 'n');
  await upsert('cat_modelo', modelos, 'marca,modelo');
  await upsert('cat_sinonimo', sin.map(s => ({ ...s, updated_at: new Date().toISOString() })), 'termo');
  // cat_aplicacao: a chave única é um índice com coalesce, que o PostgREST não
  // aceita em on_conflict. Então: apaga o que não está no JSON e insere o que
  // falta, comparando pela mesma chave lida do banco.
  const chave = l => [l.marca, l.modelo, l.sistema, l.item, l.ano_de ?? 0, l.ano_ate ?? 9999].join('|');
  const banco = await todas('cat_aplicacao', 'id,marca,modelo,sistema,item,ano_de,ano_ate');
  const noBanco = new Map(banco.map(b => [chave(b), b.id]));
  const noJson = new Set(unicas.map(chave));
  const sobra = banco.filter(b => !noJson.has(chave(b))).map(b => b.id);
  const novas = unicas.filter(l => !noBanco.has(chave(l)));
  const atualiza = unicas.filter(l => noBanco.has(chave(l)));
  log(`cat_aplicacao: banco ${banco.length} · json ${unicas.length} · novas ${novas.length} · atualizar ${atualiza.length} · apagar ${sobra.length}`);
  if (!DRY) {
    if (sobra.length) for (let i = 0; i < sobra.length; i += 300) {
      const r = await fetch(`${SB_URL}/rest/v1/cat_aplicacao?id=in.(${sobra.slice(i, i + 300).join(',')})`, { method: 'DELETE', headers: H });
      if (!r.ok) throw new Error(`delete → ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    for (const l of atualiza) {
      const r = await fetch(`${SB_URL}/rest/v1/cat_aplicacao?id=eq.${noBanco.get(chave(l))}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(l) });
      if (!r.ok) throw new Error(`patch → ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    for (let i = 0; i < novas.length; i += 500) {
      const r = await fetch(`${SB_URL}/rest/v1/cat_aplicacao`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(novas.slice(i, i + 500)) });
      if (!r.ok) throw new Error(`insert → ${r.status} ${(await r.text()).slice(0, 300)}`);
    }
    log(`cat_aplicacao: ${unicas.length} linha(s) no banco depois da carga`);
  }
  const cont = {}; unicas.forEach(l => { cont[l.status] = (cont[l.status] || 0) + 1; });
  log('por status:', JSON.stringify(cont));
  log('✓ carga concluída');
} catch (e) {
  console.error('ERRO:', e.message);
  if (/relation .* does not exist|PGRST205|schema cache/i.test(e.message)) console.error('  → as tabelas cat_* ainda não existem: rodar scripts/catalogo-supabase.sql no SQL Editor.');
  process.exit(1);
}
