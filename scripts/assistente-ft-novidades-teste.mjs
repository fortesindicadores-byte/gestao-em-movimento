// Teste das novidades da Edge Function assistente-ft (17/11/2026), SEM Postgres: a API do modelo,
// o login e a porta assistente_sql são dublados. Confere:
//   · imagem da pergunta chega ao modelo como bloco image/base64 e o evento "ver" diz quantas leu;
//   · o título da conversa sai num evento "titulo" quando a tela pede;
//   · as consultas já feitas na conversa vão na mensagem de sistema do fim;
//   · tempo esgotado: a consulta não roda, o modelo é chamado de novo com tool_choice none e
//     a resposta fecha com "fim" (limite: true) em vez de morrer sem texto;
//   · a tela cancela (Parar): a função para de chamar o modelo e não manda "fim".
// Uso: AFT_DIR=<pasta com @anthropic-ai/sdk@1.3.0 instalado>
//   node --experimental-strip-types scripts/assistente-ft-novidades-teste.mjs
import http from 'node:http'; import fs from 'node:fs';
const SRC = new URL('../supabase/functions/assistente-ft/index.ts', import.meta.url);
const AFT = (process.env.AFT_DIR || '.').replace(/\/$/, '');
const FN = AFT + '/fn-novidades.ts';
fs.writeFileSync(FN, fs.readFileSync(SRC, 'utf8').replace('npm:@anthropic-ai/sdk@1.3.0', '@anthropic-ai/sdk'));
let ok = 0, falha = 0; const chk = (c, m) => { if (c) { ok++; console.log('ok  ', m); } else { falha++; console.log('FALHA', m); } };

const pedidosIA = []; const sqls = []; const logs = []; let roteiro = []; let atrasoMs = 0;
function sse(res, msg) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const w = (e, d) => res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
  w('message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 1000, output_tokens: 1 } } });
  msg.blocos.forEach((b, i) => {
    if (b.type === 'text') { w('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      for (const p of b.text.match(/.{1,8}/gs)) w('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: p } }); }
    else { w('content_block_start', { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      w('content_block_delta', { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } }); }
    w('content_block_stop', { type: 'content_block_stop', index: i }); });
  w('message_delta', { type: 'message_delta', delta: { stop_reason: msg.stop }, usage: { output_tokens: 300 } });
  w('message_stop', { type: 'message_stop' }); res.end();
}
const srv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
  if (req.url === '/auth/v1/user') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ email: 'fortesindicadores@gmail.com' })); }
  if (req.url === '/rest/v1/rpc/assistente_sql') { sqls.push(JSON.parse(b).p_sql); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ linhas: 1, truncado: false, dados: [{ n: 42 }] })); }
  if (req.url === '/rest/v1/assistente_log') { logs.push(JSON.parse(b)); res.writeHead(201); return res.end(); }
  if (req.url.startsWith('/v1/messages')) {
    const corpo = JSON.parse(b); pedidosIA.push({ b: corpo });
    if (!corpo.stream) {   // a chamada curta do título (sem stream)
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ id: 't', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: '"Desconto de lavagem de outubro."' }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 8 } }));
    }
    const prox = roteiro.shift();
    return setTimeout(() => { if (!res.destroyed) sse(res, prox); }, atrasoMs);
  }
  res.writeHead(404); res.end(); }); }).listen(0);
await new Promise(r => srv.on('listening', r)); const URLB = 'http://127.0.0.1:' + srv.address().port;
Object.assign(process.env, { SUPABASE_URL: URLB, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'srv', ANTHROPIC_API_KEY: 'sk-teste', ANTHROPIC_BASE_URL: URLB, ASSISTENTE_TEMPO_S: process.env.ASSISTENTE_TEMPO_S || '240' });
let handler; globalThis.Deno = { env: { get: k => process.env[k] }, serve: h => { handler = h; } };
await import(FN);
const pede = corpo => handler(new Request('http://x/', { method: 'POST', headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }));
const eventos = async r => (await r.text()).split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => e.t !== 'ping');
const PNG = 'iVBORw0KGgo' + 'A'.repeat(400);
const consulta = (id, sql) => ({ stop: 'tool_use', blocos: [{ type: 'tool_use', id, name: 'consultar_banco', input: { sql, motivo: 'teste' } }] });
const texto = t => ({ stop: 'end_turn', blocos: [{ type: 'text', text: t }] });

// ── 1) imagem + título + consultas anteriores ──
{ pedidosIA.length = 0; sqls.length = 0; roteiro = [consulta('c1', 'select 42 as n'), texto('O desconto foi R$ 42.')];
  const ev = await eventos(await pede({ titulo: true, contexto: 'x', mensagens: [
    { role: 'user', content: 'Qual o desconto de lavagem?' },
    { role: 'assistant', content: 'Foram R$ 10.', consultas: [{ motivo: 'lavagem out/26', sql: 'select sum(valor)\n  from carta_custos' }] },
    { role: 'user', content: 'E este print?', imagens: [{ tipo: 'image/png', b64: PNG }, { tipo: 'application/pdf', b64: PNG }] }] }));
  const principal = pedidosIA.filter(p => p.b.stream), tit = pedidosIA.filter(p => !p.b.stream);
  const ult = principal[0].b.messages.filter(m => m.role === 'user').at(-1);
  chk(ev[0].t === 'ver' && ev[0].v >= 2 && ev[0].img === 1, 'evento "ver" diz que leu 1 imagem (o PDF é recusado) — ' + JSON.stringify(ev[0]));
  chk(Array.isArray(ult.content) && ult.content[0].type === 'image' && ult.content[0].source.type === 'base64' && ult.content[0].source.media_type === 'image/png' && ult.content[0].source.data === PNG && ult.content.at(-1).text === 'E este print?', 'a imagem vai ao modelo como bloco image/base64, antes do texto');
  chk(ult.content.filter(b => b.type === 'image').length === 1, 'só tipos de imagem aceitos entram');
  const sis = principal[0].b.messages.find(m => m.role === 'system');
  chk(sis && /Consultas que você já rodou/.test(sis.content) && /lavagem out\/26: select sum\(valor\) from carta_custos/.test(sis.content), 'as consultas já feitas vão na mensagem de sistema do fim');
  chk(!/consultas/.test(JSON.stringify(principal[0].b.messages.filter(m => m.role === 'assistant')[0])), 'a resposta anterior vai só com o texto');
  chk(tit.length === 1 && tit[0].b.model === principal[0].b.model && tit[0].b.max_tokens === 1024 && tit[0].b.output_config.effort === 'low' && tit[0].b.messages[0].content === 'Qual o desconto de lavagem?', 'chamada curta do título com a 1ª mensagem da conversa');
  const et = ev.find(e => e.t === 'titulo');
  chk(et && et.d === 'Desconto de lavagem de outubro', 'evento "titulo" sem aspas nem ponto final — ' + (et && et.d));
  const fim = ev.find(e => e.t === 'fim');
  chk(fim && fim.consultas === 1 && fim.limite === false && ev.filter(e => e.t === 'txt').map(e => e.d).join('') === 'O desconto foi R$ 42.', 'resposta completa, com fim e sem limite');
  chk(principal.every(p => !p.b.tool_choice), 'sem tool_choice enquanto há tempo');
  chk(logs.at(-1).pergunta === 'E este print?' && !JSON.stringify(logs.at(-1)).includes(PNG), 'o registro guarda a pergunta e não a imagem');
}
// sem pedir título: não há chamada extra
{ pedidosIA.length = 0; roteiro = [texto('ok')];
  const ev = await eventos(await pede({ mensagens: [{ role: 'user', content: 'oi' }] }));
  chk(pedidosIA.length === 1 && !ev.some(e => e.t === 'titulo'), 'sem titulo:true não há chamada de título'); }
// só imagem, sem texto
{ pedidosIA.length = 0; roteiro = [texto('vi')];
  const ev = await eventos(await pede({ mensagens: [{ role: 'user', content: '', imagens: [{ tipo: 'image/jpeg', b64: PNG }] }] }));
  const u = pedidosIA[0].b.messages[0];
  chk(ev[0].img === 1 && u.content.at(-1).text === 'Veja a imagem.', 'pergunta só com imagem é aceita'); }

// arquivos: PDF em base64 e planilha em texto viram blocos document antes do texto
{ pedidosIA.length = 0; roteiro = [texto('li')];
  const PDF = 'JVBERi0xLjQK' + 'A'.repeat(400);
  const ev = await eventos(await pede({ titulo: true, mensagens: [{ role: 'user', content: 'Compare com o banco', arquivos: [
    { tipo: 'application/pdf', b64: PDF, nome: 'fatura.pdf' },
    { tipo: 'text/plain', texto: '=== Aba: Plan1 ===\nunidade,valor\nGRL,10', nome: 'base.xlsx' },
    { tipo: 'application/zip', b64: PDF, nome: 'x.zip' }] }] }));
  const principal = pedidosIA.filter(p => p.b.stream), tit = pedidosIA.filter(p => !p.b.stream);
  const u = principal[0].b.messages[0].content;
  chk(ev[0].v === 3 && ev[0].arq === 2, 'evento "ver" v3 diz que leu 2 arquivos (o zip é recusado) — ' + JSON.stringify(ev[0]));
  chk(u[0].type === 'document' && u[0].source.type === 'base64' && u[0].source.media_type === 'application/pdf' && u[0].title === 'fatura.pdf', 'PDF vai como document base64 com o nome');
  chk(u[1].type === 'document' && u[1].source.type === 'text' && /GRL,10/.test(u[1].source.data) && u[1].title === 'base.xlsx', 'planilha vai como document de texto');
  chk(u.at(-1).type === 'text' && u.at(-1).text === 'Compare com o banco', 'o texto da pergunta vem depois dos arquivos');
  chk(tit.length === 1 && typeof tit[0].b.messages[0].content === 'string' && !tit[0].b.messages[0].content.includes(PDF) && /fatura\.pdf/.test(tit[0].b.messages[0].content), 'o título não leva o PDF, só o nome');
  chk(!JSON.stringify(logs.at(-1)).includes(PDF), 'o registro não guarda o arquivo'); }
// arquivo antigo além do teto vira nota no texto
{ pedidosIA.length = 0; roteiro = [texto('ok')];
  const A = n => ({ tipo: 'text/plain', texto: 'conteudo ' + n, nome: 'a' + n + '.csv' });
  await eventos(await pede({ mensagens: [
    { role: 'user', content: 'primeiro', arquivos: [A(1), A(2), A(3)] }, { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'segundo', arquivos: [A(4), A(5)] }] }));
  const ms = pedidosIA[0].b.messages.filter(m => m.role === 'user');
  const docs = m => Array.isArray(m.content) ? m.content.filter(b => b.type === 'document').length : 0;
  const txt = m => typeof m.content === 'string' ? m.content : m.content.at(-1).text;
  chk(docs(ms[1]) === 2 && docs(ms[0]) === 0 && /não reenviados: a1\.csv, a2\.csv, a3\.csv/.test(txt(ms[0])), 'só os 4 arquivos mais recentes vão; os antigos viram nota — ' + txt(ms[0])); }

// ── 2) tempo esgotado: fecha a resposta em vez de morrer ──
{ process.env.ASSISTENTE_TEMPO_S = '0';
  const FN2 = AFT + '/fn-novidades-tempo.ts'; fs.copyFileSync(FN, FN2); await import(FN2);   // relê a função com o tempo zerado
  pedidosIA.length = 0; sqls.length = 0; roteiro = [consulta('c1', 'select 1'), texto('Com o que tenho: 42. Faltou o ano.')];
  const ev = await eventos(await pede({ mensagens: [{ role: 'user', content: 'tabela do ano' }] }));
  const fim = ev.find(e => e.t === 'fim');
  chk(sqls.length === 0 && !ev.some(e => e.t === 'sql'), 'tempo esgotado: a consulta não roda');
  const tr = pedidosIA[1].b.messages.at(-1).content[0];
  chk(tr.type === 'tool_result' && tr.is_error === true && /tempo de consulta desta pergunta esgotado/.test(tr.content), 'o modelo recebe o aviso de tempo esgotado');
  chk(pedidosIA.length === 2 && pedidosIA[1].b.tool_choice && pedidosIA[1].b.tool_choice.type === 'none' && !pedidosIA[0].b.tool_choice, 'a volta seguinte vai com tool_choice none');
  chk(fim && fim.limite === true && /Faltou o ano/.test(ev.filter(e => e.t === 'txt').map(e => e.d).join('')), 'a resposta fecha com texto e fim (limite: true)');
  process.env.ASSISTENTE_TEMPO_S = '240'; }

// ── 3) a tela cancela (Parar) ──
{ const FN3 = AFT + '/fn-novidades-para.ts'; fs.copyFileSync(FN, FN3); await import(FN3);
  pedidosIA.length = 0; sqls.length = 0; logs.length = 0; atrasoMs = 1500; roteiro = [consulta('c1', 'select 1'), texto('não devia chegar aqui')];
  const r = await pede({ mensagens: [{ role: 'user', content: 'demora' }] });
  const rd = r.body.getReader(); const dec = new TextDecoder(); let lido = '';
  const { value } = await rd.read(); lido += dec.decode(value);     // o evento "ver"
  await new Promise(z => setTimeout(z, 300)); await rd.cancel();      // Parar, com o modelo ainda respondendo
  await new Promise(z => setTimeout(z, 2500)); atrasoMs = 0;
  chk(/"t":"ver"/.test(lido), 'a resposta começou');
  chk(pedidosIA.length === 1 && sqls.length === 0, 'depois do Parar: nenhuma consulta roda e o modelo não é chamado de novo — ' + pedidosIA.length + ' chamada(s), ' + sqls.length + ' consulta(s)');
  chk(logs.length === 1 && logs[0].erro === 'interrompido pelo usuário', 'o registro marca a pergunta como interrompida — ' + (logs[0] && logs[0].erro)); }

srv.close();
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);
