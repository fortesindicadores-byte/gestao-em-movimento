// ============================================================================
// FCA Resp Gestor — o responsável das ações ANTIGAS vira o gestor de frota da
// unidade (Renan, 16/10/2026: "As ações antigas quero substituir também os
// responsáveis pelo De-para que enviei" — o de-para é a tabela de gestores de
// 15/10, a mesma GESTOR_FROTA que a geração usa; "Será sempre o gestor de frota").
//
// Regras:
//   · vale para toda linha da tabela fca cuja unidade está na tabela de gestores;
//   · linha SEM causa e SEM ação fica como está (fato ainda vazio): dar dono a ela
//     faria a geração do FCA de Custos tratá-la como escrita à mão e pular o fato;
//   · só troca quando o nome é diferente; o log traz o par antigo → novo por unidade
//     e, no modo gravar, a cópia (id, antigo) de cada linha trocada, para desfazer.
// MODO=ensaio (padrão) só mostra; MODO=gravar grava.
// ============================================================================
import fs from 'node:fs';
import vm from 'node:vm';

const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('sem GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const MODO = (process.env.MODO || 'ensaio').trim();
const API = 'https://lozwipoeacpvplgkrxkq.supabase.co/rest/v1/';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };

// a MESMA tabela de gestores do motor (assets/fca-auto.js), sem cópia
const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../assets/fca-auto.js', import.meta.url), 'utf8'), ctx);
const FA = ctx.window.FcaAuto; const GESTOR = FA.GESTOR_FROTA;
const uniDe = u => String(u || '').replace(/\s*\(INATIVO\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();

const linhas = [];
for (let de = 0; ; de += 1000) {
  const r = await fetch(API + 'fca?select=id,unidade,vigencia,origem,fato,causa,acao,responsavel,auto_chave&order=id', { headers: { ...H, range: `${de}-${de + 999}` } });
  if (!r.ok) { console.error('leitura da fca falhou', r.status, await r.text()); process.exit(1); }
  const b = await r.json(); linhas.push(...b); if (b.length < 1000) break;
}
console.log(`fca: ${linhas.length} linhas lidas · modo ${MODO}`);
console.log('gestores:', Object.entries(GESTOR).map(([u, n]) => u + ' ' + n).join(' · '));

const tem = s => !!String(s || '').trim();
const troca = [], pares = {}, semGestor = {}, vazias = { n: 0 };
linhas.forEach(r => {
  const u = uniDe(r.unidade), g = GESTOR[u];
  if (!g) { semGestor[u] = (semGestor[u] || 0) + 1; return; }
  if (!tem(r.causa) && !tem(r.acao)) { vazias.n++; return; }
  const ant = String(r.responsavel || '').trim();
  if (ant === g) return;
  troca.push({ id: r.id, unidade: u, antigo: ant, novo: g });
  const k = u + ' | ' + (ant || '(vazio)') + ' → ' + g; pares[k] = (pares[k] || 0) + 1;
});
console.log(`\ntrocariam ${troca.length} linha(s) · ${vazias.n} linha(s) sem causa e sem ação ficam como estão`);
if (Object.keys(semGestor).length) console.log('unidades fora da tabela de gestores (não mexidas):', JSON.stringify(semGestor));
console.log('\nunidade | antigo → novo · linhas');
Object.entries(pares).sort().forEach(([k, n]) => console.log(`   ${k} · ${n}`));

if (MODO !== 'gravar') { console.log('\nENSAIO: nada gravado.'); process.exit(0); }
console.log('\nCÓPIA PARA DESFAZER (id → responsável antigo):');
console.log(JSON.stringify(troca.map(t => [t.id, t.antigo])));
const porNovo = {}; troca.forEach(t => (porNovo[t.novo] = porNovo[t.novo] || []).push(t.id));
let ok = 0;
for (const [novo, ids] of Object.entries(porNovo)) {
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const r = await fetch(API + 'fca?id=in.(' + lote.map(encodeURIComponent).join(',') + ')', { method: 'PATCH', headers: { ...H, prefer: 'return=minimal' }, body: JSON.stringify({ responsavel: novo }) });
    if (!r.ok) { console.error('gravação falhou', novo, r.status, await r.text()); process.exit(1); }
    ok += lote.length;
  }
}
console.log(`\nGRAVADO: ${ok} linha(s) com o gestor de frota da unidade.`);
