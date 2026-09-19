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

console.log('\n═══ o caso que motivou tudo: lida agora, conteúdo congelado ═══');
{
  // aba da Disponibilidade depois de o Apps Script ser desligado: o robô a lê
  // de hora em hora (carregado_em = agora) e o conteúdo não muda há 5 dias
  const congelada = { fonte:'sh', atualizado_em: atras(0.5), mudou_em: atras(120), impressao:'abc' };
  af(est(congelada).t === 'Parada', 'aba lida há 30 min mas sem dado novo há 5 dias = Parada', est(congelada).t);
  af(est(congelada).c === 'r', 'e em vermelho', est(congelada).c);

  // O LADO ERRADO: é o que a tela mostrava antes, medindo a leitura
  const comoEraAntes = { ...congelada };
  delete comoEraAntes.mudou_em;
  comoEraAntes.mudou_em = null; comoEraAntes.impressao = null;   // sem impressão cai no atualizado_em
  af(est(comoEraAntes).t === 'Em dia',
     'medindo pela LEITURA a mesma base diria "Em dia" — o defeito que isto conserta', est(comoEraAntes).t);
}

console.log('\n═══ dado novo chegando: nada muda para pior ═══');
{
  af(est({ fonte:'sh', atualizado_em: atras(0.2), mudou_em: atras(1), impressao:'a' }).t === 'Em dia',
     'aba do Sheets com dado novo há 1h (limite 6h)');
  af(est({ fonte:'sh', atualizado_em: atras(0.2), mudou_em: atras(9), impressao:'a' }).t === 'Atrasada',
     'sem dado novo há 9h = Atrasada');
  af(est({ fonte:'ginfo', atualizado_em: atras(0.2), mudou_em: atras(20), impressao:'a' }).t === 'Em dia',
     'Ginfo tem 30h de folga: 20h ainda é Em dia');
  af(est({ fonte:'ginfo', atualizado_em: atras(0.2), mudou_em: atras(40), impressao:'a' }).t === 'Atrasada',
     'e 40h já é Atrasada');
  af(est({ fonte:'elite', atualizado_em: atras(30*24), mudou_em: atras(30*24), impressao:null }).t === 'Em dia',
     'Frota de Elite: 30 dias é normal (limite 45)');
}

console.log('\n═══ a 1ª coleta não pode fingir que está tudo bem ═══');
{
  const semRef = { fonte:'sh', atualizado_em: atras(0.2), mudou_em: null, impressao:'a' };
  af(est(semRef).t === 'Aguardando 2ª coleta',
     'base com impressão mas sem referência ainda diz isso, em vez de "Em dia"', est(semRef).t);
  af(est(semRef).c === 'c', 'e fica em cinza, nem verde nem vermelho', est(semRef).c);
}

console.log('\n═══ quem já media o conteúdo continua como estava ═══');
{
  // elite e app não têm impressão: o robô copia o atualizado_em, que nessas
  // fontes JÁ é a data do próprio dado
  af(est({ fonte:'app', atualizado_em: atras(500), mudou_em: atras(500), impressao:null }).t === '—',
     'tabela de aplicativo é informativa (sem limite)');
  af(est({ fonte:'app', atualizado_em: null, mudou_em: null, impressao:null }).t === 'Sem data',
     'sem data nenhuma diz "Sem data"');
}

console.log('\n═══ erro na carga ganha do resto ═══');
{
  af(est({ fonte:'sh', erro:'FALHOU: …', atualizado_em: atras(0.2), mudou_em: atras(0.2), impressao:'a' }).t === 'Erro na carga',
     'erro registrado aparece como erro, mesmo com dado fresco');
  af(est({ fonte:'sh', erro:'RECUSADA: aba filtrada', atualizado_em: atras(0.2), mudou_em: atras(80), impressao:'a' }).c === 'r',
     'e a recusa da guarda também é vermelho');
}

console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);
