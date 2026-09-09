// ============================================================
// ATENDE OS PEDIDOS DE CARGA FEITOS NO HUB (Renan, 09/09/2026)
//
// O botão "Atualizar agora" do hub (cluster Administração → Bases do Sheets)
// não consegue chamar o GitHub: a página é pública e não pode guardar token.
// Ele grava uma linha em public.sh_pedido. Este script é o outro lado: roda
// de 5 em 5 minutos, vê se há pedido pendente, roda o robô de carga e
// escreve o resultado de volta na linha do pedido — que é o que o hub mostra.
//
// Sem pedido, sai em segundos e não toca em nada.
// ============================================================
import { spawn } from 'node:child_process';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const RUN_URL = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;

const api = async (caminho, init = {}) => {
  const r = await fetch(`${SUPA}/rest/v1/${caminho}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
};

// A tabela pode ainda não existir (o SQL é colado uma vez). Isso não é falha:
// sair vermelho de 5 em 5 minutos esconderia um vermelho de verdade.
const r0 = await fetch(`${SUPA}/rest/v1/sh_pedido?select=id&limit=1`, { headers: H });
if (r0.status === 404) {
  console.log('A tabela sh_pedido ainda não existe. Rode scripts/bases-pedido.sql'
    + ' no SQL Editor do Supabase e o botão do hub passa a funcionar.');
  process.exit(0);
}

// Pega o que está pendente e também o que ficou preso em "rodando": se a
// rodada anterior morreu no meio (runner cancelado, erro nosso), o pedido
// ficaria travado para sempre e o botão do hub nunca mais liberaria.
const PRESO_MIN = 25;
const preso = new Date(Date.now() - PRESO_MIN * 60000).toISOString();
const pend = await api('sh_pedido?select=id,pedido_nome,so,status'
  + `&or=(status.eq.pendente,and(status.eq.rodando,iniciado_em.lt.${preso}))&order=id.asc`);
if (!pend || !pend.length) { console.log('Nenhum pedido pendente.'); process.exit(0); }

const ids = pend.map(p => p.id);
// vários pedidos na fila viram UMA carga: o robô já recarrega só o que mudou
const so = pend.every(p => (p.so || '') === (pend[0].so || '')) ? (pend[0].so || '') : '';
const abandonados = pend.filter(p => p.status === 'rodando').length;
console.log(`${ids.length} pedido(s): ${ids.join(', ')}${so ? ` · só "${so}"` : ' · todas as bases'}`
  + (abandonados ? ` · ${abandonados} retomado(s) de uma rodada que não terminou` : ''));

// o "?" e o nome da tabela ficam AQUI: mandar só o filtro faz o PostgREST
// procurar uma tabela chamada "id=in.(1)" e devolver 404 (bug real, 09/09/2026)
const patch = (corpo) => api(`sh_pedido?id=in.(${ids.join(',')})`, {
  method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(corpo),
});
const fecha = (status, resultado) => patch({ status, resultado: String(resultado).slice(0, 900),
  terminado_em: new Date().toISOString() });

await patch({ status: 'rodando', iniciado_em: new Date().toISOString(), run_url: RUN_URL });

let saida;
try {
  // roda o robô de sempre e guarda o log para devolver ao hub
  saida = await new Promise(ok => {
    const p = spawn(process.execPath, ['scripts/sheets-robot.mjs'], {
      env: { ...process.env, SHEETS_MODO: 'run', SHEETS_SO: so },
    });
    let txt = '';
    const junta = d => { txt += d; process.stdout.write(d); };
    p.stdout.on('data', junta);
    p.stderr.on('data', junta);
    p.on('close', cod => ok({ cod, txt }));
  });
} catch (e) {
  // o pedido NUNCA fica preso: qualquer erro daqui volta como "erro" na linha
  await fecha('erro', e.message).catch(() => {});
  throw e;
}

// o hub mostra o rodapé do log: "N carregada(s) · … · X linha(s) gravada(s)"
const linhas = saida.txt.trim().split('\n').filter(Boolean);
const resumo = linhas.slice(-3).join('\n');

await fecha(saida.cod === 0 ? 'ok' : 'erro',
  resumo || (saida.cod === 0 ? 'sem saída' : `o robô saiu com código ${saida.cod}`));

console.log(`\npedido(s) ${ids.join(', ')} → ${saida.cod === 0 ? 'ok' : 'erro'}`);
process.exit(saida.cod === 0 ? 0 : 1);
