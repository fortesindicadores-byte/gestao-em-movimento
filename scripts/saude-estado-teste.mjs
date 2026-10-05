// ============================================================
// SAÚDE · a idade que vale é a do DADO, não a da leitura
//
// O painel /saude/ marcava base "Atrasada"/"Parada" desde o primeiro dia —
// pela data da LEITURA. E essa data mente: o sheets-robot reescreve
// `carregado_em` mesmo quando o md5 da aba é igual, e o gviz-robot dá PATCH no
// `updated_at` quando o hash não mudou. Uma aba que alguém parou de atualizar
// (ou cujo Apps Script foi desligado, como o da Disponibilidade em 19/09/2026)
// ficaria "Em dia" para sempre.
//
// O teste roda o `estadoBase` DO PRÓPRIO saude/index.html em node:vm — extrair
// as regras para cá mediria a minha cópia, não o painel. E roda os DOIS LADOS
// no caso que importa: com `mudou_em` (o conserto) e sem ele (o defeito),
// porque um teste que só exercita o lado consertado não prova nada.
//
// Uso: node scripts/saude-estado-teste.mjs
// ============================================================
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = readFileSync(new URL('../saude/index.html', import.meta.url), 'utf8');

/* pega do arquivo real o bloco que vai de LIM_BASE até o fim do estadoBase,
   mais os dois helpers de que ele depende */
function trecho(de, ate) {
  const i = HTML.indexOf(de);
  if (i < 0) throw new Error(`não achei no painel: ${de}`);
  const j = HTML.indexOf(ate, i);
  if (j < 0) throw new Error(`não achei o fim: ${ate}`);
  return HTML.slice(i, j + ate.length);
}

// AGORA_FOTO é o instante da coleta do robô: o painel mede a idade contra ele,
// não contra o relógio de quem abre a tela. No teste vale "agora".
const ctx = { console, Date, AGORA_FOTO: null };
vm.createContext(ctx);
// helpers do painel usados pelas regras, tirados do arquivo real
vm.runInContext(trecho('const relogioDaFoto=', '\n'), ctx);
vm.runInContext(trecho('function horas(', 'return isFinite(h)?h:null; }'), ctx);
vm.runInContext(trecho('const LIM_BASE=', '\n}'), ctx);

const H = 3600e3;
const atras = h => new Date(Date.now() - h * H).toISOString();

let ok = 0, ruim = 0;
const af = (c, t, d) => { if (c) { ok++; console.log('  ok   ' + t); }
  else { ruim++; console.log('  FALHA ' + t + (d != null ? '  → ' + d : '')); } };
const est = b => ctx.estadoBase(b);

console.log('\n═══ duas réguas no Sheets: LEITURA (6h) e CONTEÚDO (35/60 dias) ═══');
{
  // o caso que motivou a régua de conteúdo (19/09): lida agora, conteúdo congelado
  const congelada = { fonte:'sh', atualizado_em: atras(0.5), mudou_em: atras(70*24), impressao:'abc' };
  af(est(congelada).t === 'Parada', 'aba lida há 30 min mas sem dado novo há 70 dias = Parada', est(congelada).t);
  af(est(congelada).c === 'r', 'e em vermelho', est(congelada).c);
  af(est({ ...congelada, mudou_em: atras(40*24) }).t === 'Atrasada', 'sem dado novo há 40 dias = Atrasada');

  // o caso que motivou ESTA mudança (05/10): aba manual mensal, sem mudança há 5 dias
  const mensal = { fonte:'sh', atualizado_em: atras(0.5), mudou_em: atras(5*24), impressao:'abc' };
  af(est(mensal).t === 'Em dia', 'aba manual sem mudança há 5 dias continua Em dia (antes: Parada)', est(mensal).t);
  af(est({ ...mensal, fonte:'gviz' }).t === 'Em dia', 'idem para a foto do gviz');

  // o robô parou de LER: isso continua alarmando em horas, não em semanas
  af(est({ fonte:'sh', atualizado_em: atras(9), mudou_em: atras(1), impressao:'a' }).t === 'Leitura atrasada',
     'lida há 9h = Leitura atrasada, mesmo com dado novo');
  af(est({ fonte:'sh', atualizado_em: atras(30), mudou_em: atras(1), impressao:'a' }).t === 'Leitura parada',
     'lida há 30h = Leitura parada (vermelho)');

  // O LADO ERRADO: medir só pela leitura diria "Em dia" para a congelada
  const comoEraAntes = { ...congelada, mudou_em: null, impressao: null };
  af(est(comoEraAntes).t === 'Em dia',
     'medindo só pela LEITURA a base congelada diria "Em dia" — por isso o conteúdo continua medido', est(comoEraAntes).t);
}

console.log('\n═══ as outras fontes não mudaram ═══');
{
  af(est({ fonte:'ginfo', atualizado_em: atras(0.2), mudou_em: atras(20), impressao:'a' }).t === 'Em dia',
     'Ginfo tem 30h de folga: 20h ainda é Em dia');
  af(est({ fonte:'ginfo', atualizado_em: atras(0.2), mudou_em: atras(40), impressao:'a' }).t === 'Atrasada',
     'e 40h já é Atrasada');
  af(est({ fonte:'elite', atualizado_em: atras(30*24), mudou_em: atras(30*24), impressao:null }).t === 'Em dia',
     'Frota de Elite: 30 dias é normal (limite 45)');
  af(est({ fonte:'sh', atualizado_em: atras(0.2), mudou_em: null, impressao:'a' }).t === 'Aguardando coleta',
     'linha de robô antigo fica em cinza, nunca "Em dia" pela leitura');
  af(est({ fonte:'app', atualizado_em: atras(500), mudou_em: atras(500), impressao:null }).t === '—',
     'tabela de aplicativo é informativa (sem limite)');
  af(est({ fonte:'app', atualizado_em: null, mudou_em: null, impressao:null }).t === 'Sem data',
     'sem data nenhuma diz "Sem data"');
}

console.log('\n═══ erro e recusa ═══');
{
  af(est({ fonte:'sh', erro:'FALHOU: …', atualizado_em: atras(0.2), mudou_em: atras(0.2), impressao:'a' }).t === 'Erro na carga',
     'carga que falhou é erro (vermelho), mesmo com dado fresco');
  const rec = est({ fonte:'sh', erro:'RECUSADA: aba filtrada', atualizado_em: atras(0.2), mudou_em: atras(80), impressao:'a' });
  af(rec.c === 'a' && /filtrada/.test(rec.t), 'recusa da guarda é ÂMBAR "aba filtrada?" — a tabela guarda a versão boa', JSON.stringify(rec));
}

console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);
