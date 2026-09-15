// ============================================================
// Robô Volks|Total (VW Caminhões e Ônibus) — contrato de manutenção por km
//
// O portal da VW (volkstotal.vwco.com.br) tem, em Consulta Valor da Nota
// Fiscal, o que hoje é digitado à mão na planilha "Contratos Man.": por
// contrato e por mês, uma linha por chassi com km anterior, km atual, km
// rodado e o valor cobrado.
//
// MODOS (env VT_MODE):
//   sonda  (padrão) — só olha: alcança o portal? o login passa? o que tem no
//                     DOM (campos, lista de contratos, botões)? Não coleta.
//   teste           — coleta de verdade e IMPRIME o resumo, sem gravar.
//   gravar          — coleta e sobe para `vw_contrato_km`.
//
// RECORTE (env, todos opcionais): VT_CONTRATO (lista separada por vírgula) ·
// VT_VIG (AAAA-MM, lista) · VT_ANO. Sem nada: todos os contratos do seletor,
// de janeiro ao mês corrente.
//
// POR QUE A SONDA VEIO PRIMEIRO: o robô do Qlik foi 100% codificado e só
// então descobrimos que o servidor não era acessível de fora. Aqui essa era a
// primeira pergunta, e custou 30 segundos — o portal responde (HTTP 302 em
// 577 ms) e o login passa.
//
// O QUE A SONDA ACHOU, e que teria custado rodadas de tentativa:
//  · o login IGNORA a ReturnUrl e cai em Index.aspx — e a home TAMBÉM tem o
//    seletor de contratos, então a primeira sonda fotografou a página errada
//    sem dar erro nenhum. A navegação para a consulta é explícita;
//  · marcar o checkbox do contrato ESCREVE o código em txtContrato — é por
//    esse campo que se confere se o clique pegou, não pela marca do checkbox;
//  · os avisos são SweetAlert2 (.swal2-popup), inclusive o "sem dados";
//  · o "44º contrato" que aparecia era o swal2-checkbox do próprio modal.
//
// Segredos: VOLKSTOTAL_USER · VOLKSTOTAL_PASS (Secrets do Actions, nunca no
// código — o repositório é público). O log NUNCA imprime a senha.
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE  = 'https://volkstotal.vwco.com.br';
const ALVO  = `${BASE}/ConsultaValorNotaFiscal.aspx`;
const MODE  = (process.env.VT_MODE || 'sonda').toLowerCase();
const USER  = process.env.VOLKSTOTAL_USER || '';
const PASS  = process.env.VOLKSTOTAL_PASS || '';
const SHOTS = 'volkstotal-shots';
const DEBUG = process.env.VT_DEBUG === '1';
/* O `let` MORA AQUI EM CIMA, não junto da função que o usa (bug real,
   15/09/2026). A coleta roda num `await` de topo de módulo; `function` é
   içada, mas `let` declarado DEPOIS desse bloco continua na zona morta
   enquanto ele executa — e a leitura do xlsx morria com "Cannot access
   '_cabLogado' before initialization", um erro que não tem nada a ver com o
   portal nem com o arquivo. É o mesmo parentesco do `const` que não vira
   propriedade de contexto no node:vm, já anotado no CLAUDE.md. */
let _cabLogado = false;

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const log  = (...a) => console.log(hora(), ...a);
fs.mkdirSync(SHOTS, { recursive: true });

const brl   = v => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numBR = v => Math.round(+v || 0).toLocaleString('pt-BR');
const LISTA = s => { const l = String(s || '').split(/[,\s;]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                     return l.length ? l : null; };

/* AS VIGÊNCIAS VÃO ATÉ O MÊS CORRENTE, NÃO ATÉ DEZEMBRO (Renan, 15/09/2026:
   "quero gerar ano todo"). Pedir mês que ainda não aconteceu só gasta uma
   busca para receber o modal de "sem dados" — 43 contratos × 3 meses futuros
   seriam 129 buscas à toa, ~20 minutos. */
function vigsDoAno() {
  const hoje = new Date();
  const ano = +(process.env.VT_ANO || hoje.getFullYear());
  const ate = ano < hoje.getFullYear() ? 12 : hoje.getMonth() + 1;
  return Array.from({ length: ate }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
}
// o portal quer MMAAAA digitado; a máscara põe a barra sozinha
const paraMMAAAA = vig => vig.slice(5, 7) + vig.slice(0, 4);

/* "R$ 1.234,56" / "1.234,56" / "1234.56" / "12.000" → número. O portal é
   pt-BR, mas o xlsx pode entregar a célula já numérica.

   O PONTO DE MILHAR É A ARMADILHA (pego no teste dos helpers, 15/09/2026):
   "o último separador é o decimal" transforma **12.000 km em 12 km** — e o km
   é justamente o que multiplica a taxa, então o valor do contrato viria 1.000
   vezes menor sem erro nenhum na tela. A regra tem de olhar o conjunto:
    · os dois separadores presentes → o ÚLTIMO é o decimal, o outro é milhar;
    · um só, repetido            → todos são milhar (1.234.567);
    · um só, seguido de 3 dígitos → milhar, porque a base é pt-BR (12.000);
    · o resto                    → decimal (0,7542 · 1234.56). */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).replace(/[R$\s ]/g, '');
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  const pts = (s.match(/\./g) || []).length, vgs = (s.match(/,/g) || []).length;
  const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (ult >= 0) {
    const casas = s.length - ult - 1;
    const misto = pts > 0 && vgs > 0;
    const soUm  = (pts + vgs) === 1;
    const milhar = !misto && (!soUm || casas === 3);
    s = milhar ? s.replace(/[.,]/g, '')
               : s.slice(0, ult).replace(/[.,]/g, '') + '.' + s.slice(ult + 1);
  }
  const n = parseFloat(s);
  return isFinite(n) ? (neg ? -n : n) : 0;
}
// data da planilha: serial do Excel, Date, ou dd/mm/aaaa
function dataISO(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  const m = String(v).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v);
  return isFinite(d) ? d.toISOString().slice(0, 10) : null;
}
// acha a coluna pelo RÓTULO, não pela posição: o portal pode inserir coluna
const acha = (obj, ...pedacos) => {
  const ks = Object.keys(obj);
  for (const p of pedacos) {
    const k = ks.find(x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .includes(p.toLowerCase()));
    if (k) return k;
  }
  return null;
};

// ── 1. o portal responde de fora? ────────────────────────────────────────
// Antes de subir browser: se o domínio não abre daqui, o resto não importa.
log('── 1. o portal responde ao Actions? ──');
let alcanca = false;
try {
  const t0 = Date.now();
  const r = await fetch(ALVO, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const ms = Date.now() - t0;
  const loc = r.headers.get('location') || '';
  log(`  HTTP ${r.status} em ${ms} ms${loc ? ' → ' + loc : ''}`);
  alcanca = true;
  if (r.status >= 300 && r.status < 400 && /login/i.test(loc)) {
    log('  redireciona para o login, como esperado (a ReturnUrl preserva o destino)');
  }
} catch (e) {
  log(`  ✘ NÃO alcança: ${e.message}`);
  log('');
  log('  O GitHub Actions não chega no portal. As saídas são as mesmas do Qlik:');
  log('   · a VW liberar acesso externo (se houver bloqueio por IP);');
  log('   · um runner self-hosted dentro da rede da Conlog;');
  log('   · rodar na máquina do Renan por tarefa agendada.');
  process.exit(1);
}

if (!USER || !PASS) {
  log('');
  log('  Portal alcançável. Falta cadastrar os segredos para testar o login:');
  log('    Settings → Secrets and variables → Actions → New repository secret');
  log('    VOLKSTOTAL_USER  e  VOLKSTOTAL_PASS');
  process.exit(0);
}

// ── 2. o login passa? ────────────────────────────────────────────────────
log('');
log('── 2. login (Acesso Clientes) ──');
const br = await chromium.launch();
const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 900 } });
const pg = await ctx.newPage();
const shot = async n => { await pg.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); log(`  screenshot: ${n}`); };

try {
  await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 });
  log(`  caiu em: ${pg.url()}`);
  await shot('01-entrada');

  // a escolha do perfil: Acesso Clientes (não Dealer, não CloudIDP)
  const btCliente = pg.getByRole('link', { name: /acesso\s*clientes/i })
    .or(pg.getByRole('button', { name: /acesso\s*clientes/i }))
    .or(pg.locator('a,input[type=submit],button').filter({ hasText: /acesso\s*clientes/i }));
  if (await btCliente.count()) {
    await btCliente.first().click();
    await pg.waitForLoadState('domcontentloaded');
    log(`  após "Acesso Clientes": ${pg.url()}`);
  } else {
    log('  ⚠ não achei "Acesso Clientes" — talvez já esteja na tela de usuário/senha');
  }
  await shot('02-login-cliente');

  // ASP.NET nomeia os campos com ids longos (ctl00_...): pega pelo tipo, que
  // é estável, e registra os nomes reais para o modo run usar depois
  const campos = await pg.$$eval('input', els => els.map(e => ({
    id: e.id, name: e.name, type: e.type, ph: e.placeholder || '',
  })).filter(c => ['text', 'password', 'submit', 'email'].includes(c.type)));
  log('  campos da tela de login:');
  campos.forEach(c => log(`    ${c.type.padEnd(8)} id=${c.id || '—'} name=${c.name || '—'}`));

  const inUser = pg.locator('input[type=text]:visible, input[type=email]:visible').first();
  const inPass = pg.locator('input[type=password]:visible').first();
  await inUser.fill(USER);
  await inPass.fill(PASS);                       // a senha nunca vai ao log
  const btLogar = pg.locator('input[type=submit], button, a').filter({ hasText: /logar|entrar/i }).first();
  await btLogar.click();
  await pg.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  log(`  depois de Logar: ${pg.url()}`);
  await shot('03-pos-login');

  const logado = !/login/i.test(pg.url());
  if (!logado) {
    const erro = await pg.locator('body').innerText().catch(() => '');
    log('  ✘ continuamos na tela de login — credencial recusada ou etapa a mais');
    log('    texto da tela: ' + erro.replace(/\s+/g, ' ').slice(0, 300));
    await br.close();
    process.exit(1);
  }
  log('  ✔ login OK');

  // ── 3. a tela de consulta ──────────────────────────────────────────────
  /* O LOGIN IGNORA A ReturnUrl (achado na 1ª sonda, 15/09/2026): depois do
     btnLogin o portal cai em Index.aspx, não no destino que a ReturnUrl
     carregava. A 1ª sonda fotografou a home achando que era a consulta — e a
     home TAMBÉM tem o seletor de contratos, então nada parecia errado. Por isso
     a navegação para a consulta é explícita e a URL é conferida. */
  log('');
  log('── 3. a tela de consulta ──');
  await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  log(`  url: ${pg.url()}`);
  if (!/ConsultaValorNotaFiscal/i.test(pg.url())) {
    log('  ✘ não é a tela de consulta — a sessão não seguiu para cá');
    await shot('04-nao-e-consulta');
    await br.close();
    process.exit(1);
  }
  await shot('04-consulta');

  const dump = async rot => {
    // os campos que interessam são os que NÃO são a lista de contratos
    const campos = await pg.$$eval('input,select,textarea', els => els.map(e => ({
      tag: e.tagName.toLowerCase(), id: e.id, name: e.name, type: e.type || '',
      ph: e.placeholder || '', val: (e.value || '').slice(0, 30),
      vis: !!(e.offsetParent || e.type === 'hidden'),
    })));
    const chk = campos.filter(c => c.type === 'checkbox');
    const resto = campos.filter(c => c.type !== 'checkbox' && c.type !== 'hidden' && (c.id || c.name));
    log(`  [${rot}] ${resto.length} campo(s) fora da lista de contratos:`);
    resto.forEach(c => log(`    ${c.tag}/${c.type} id=${c.id || '—'} name=${c.name || '—'}`
      + ` ph="${c.ph}" val="${c.val}"${c.vis ? '' : ' (oculto)'}`));
    // o código do contrato sai do id; desktop e mobile repetem o mesmo código
    const cods = [...new Set(chk.map(c => (c.id || '').replace(/^check-(mob-)?/, '')).filter(Boolean))];
    log(`  [${rot}] ${chk.length} checkbox(es) → ${cods.length} contrato(s): ${cods.join(' · ')}`);
    const clic = await pg.$$eval('input[type=submit],input[type=button],input[type=image],button,a', els =>
      els.map(e => ({ t: (e.value || e.innerText || e.title || e.alt || '').trim().replace(/\s+/g, ' '),
                      id: e.id, tag: e.tagName.toLowerCase(),
                      vis: !!e.offsetParent }))
        .filter(c => c.t && c.t.length < 60 && c.vis));
    log(`  [${rot}] clicáveis: ` + [...new Set(clic.map(c => `${c.t}${c.id ? '#' + c.id : ''}`))].join(' · '));
    return cods;
  };
  const cods = (await dump('consulta')).filter(c => !/^swal2/.test(c));

  if (MODE === 'sonda') {
    log('');
    log(`Sonda concluída: ${cods.length} contrato(s) no seletor.`);
    await br.close();
    process.exit(0);
  }

  // ── 4. a coleta ────────────────────────────────────────────────────────
  const alvoCt  = LISTA(process.env.VT_CONTRATO) || cods;
  const alvoVig = LISTA(process.env.VT_VIG) || vigsDoAno();
  const faltam  = alvoCt.filter(c => !cods.includes(c));
  if (faltam.length) log(`  ⚠ fora do seletor desta conta, serão pulados: ${faltam.join(' · ')}`);
  const paresCt = alvoCt.filter(c => cods.includes(c));
  log('');
  log(`── 4. coleta: ${paresCt.length} contrato(s) × ${alvoVig.length} vigência(s)`
    + ` = ${paresCt.length * alvoVig.length} busca(s) ──`);
  log(`   vigências: ${alvoVig.join(' · ')}`);

  const linhas = [];
  const semDado = [];
  const falhou = [];
  let feitas = 0, gravadasAte = 0;
  for (const ct of paresCt) {
    const antesDoCt = linhas.length;
    for (const vig of alvoVig) {
      feitas++;
      const rot = `${ct} ${vig}`;
      try {
        const r = await consulta(pg, ct, vig);
        if (r.semDado) { semDado.push(rot); continue; }
        linhas.push(...r.linhas);
        log(`  [${feitas}/${paresCt.length * alvoVig.length}] ${rot}: ${r.linhas.length} linha(s)`
          + ` · ${brl(r.linhas.reduce((s, l) => s + l.valor, 0))}`
          + (r.total != null ? ` · total da nota ${brl(r.total)}${r.confere ? '' : ' ⚠ NÃO BATE'}` : ''));
      } catch (e) {
        /* A MENSAGEM INTEIRA NAS PRIMEIRAS FALHAS (15/09/2026): o corte em 120
           caracteres decapitou justamente o cabeçalho que a mensagem carregava
           para explicar o erro. Nas primeiras vai inteira; das seguintes vai o
           resumo, senão 390 buscas ruins viram um log ilegível. */
        const msg = e.message.split('\n')[0];
        falhou.push(`${rot}: ${msg.slice(0, 200)}`);
        log(`  [${feitas}] ${rot}: ✘ ${falhou.length <= 3 ? msg : msg.slice(0, 160)}`);
        /* FOTO DA FALHA (15/09/2026): sem ela sobra deduzir do texto do erro o
           que estava na tela — foi o que aconteceu com o "Timeout" do Gerar
           Relatório, que não dizia que o botão achado era o invisível. Só das
           10 primeiras: 390 buscas com erro encheriam o artifact. */
        if (falhou.length <= 10) await shot(`erro-${rot.replace(/[^\w-]/g, '_')}`).catch(() => {});
        // uma falha não derruba o resto: volta para a tela limpa e segue
        await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      }
    }
    /* GRAVA A CADA CONTRATO (15/09/2026). A 1ª coleta do ano rodou 28 minutos,
       trouxe as 1.977 linhas certas, e PERDEU TUDO numa falha da gravação
       final. Salvar ao fim de cada contrato custa uma chamada a mais e faz o
       trabalho já feito sobreviver a qualquer tropeço do que vem depois — o
       upsert por chave torna a repetição inofensiva. */
    if (MODE === 'gravar' && linhas.length > antesDoCt) {
      try {
        await grava(linhas.slice(antesDoCt), true);
        gravadasAte = linhas.length;
      } catch (e) {
        log(`  ⚠ não gravou o contrato ${ct}: ${e.message.split('\n')[0].slice(0, 200)}`);
      }
    }
  }

  log('');
  log(`COLETADO: ${linhas.length} linha(s) · ${brl(linhas.reduce((s, l) => s + l.valor, 0))}`);
  log(`   ${semDado.length} par(es) sem dado (contrato não cobre o mês)`);
  if (falhou.length) {
    log(`   ${falhou.length} falha(s):`);
    falhou.slice(0, 20).forEach(f => log(`      ${f}`));
  }
  const porVig = new Map();
  linhas.forEach(l => {
    const t = porVig.get(l.vigencia) || { n: 0, v: 0, km: 0, ct: new Set() };
    t.n++; t.v += l.valor; t.km += l.km_rodado; t.ct.add(l.contrato); porVig.set(l.vigencia, t);
  });
  log('   por vigência:');
  [...porVig.entries()].sort().forEach(([v, t]) => log(`      ${v}  ${String(t.n).padStart(4)} linha(s)`
    + ` · ${t.ct.size} contrato(s) · ${numBR(t.km).padStart(11)} km · ${brl(t.v).padStart(16)}`));

  /* O MESMO CHASSI APARECE MAIS DE UMA VEZ NO MESMO CONTRATO+MÊS (achado na
     1ª coleta do ano, 15/09/2026): o Postgres recusou o upsert com "ON
     CONFLICT DO UPDATE command cannot affect row a second time" — duas linhas
     do MESMO lote disputando a mesma chave. A tabela assumia um veículo por
     mês, e o relatório tem coluna Faixa: a hipótese é que o km que atravessa
     faixas gera uma linha por faixa, com preço diferente em cada.

     O diagnóstico imprime as duplicatas INTEIRAS em vez de eu escolher uma
     chave no escuro — somar as linhas ou ficar com uma delas seria inventar
     regra de cobrança. */
  const porChave = new Map();
  linhas.forEach(l => {
    const k = `${l.contrato}|${l.vigencia}|${l.chassi}`;
    (porChave.get(k) || porChave.set(k, []).get(k)).push(l);
  });
  const dups = [...porChave.entries()].filter(([, v]) => v.length > 1);
  if (dups.length) {
    const comFaixa = dups.filter(([, v]) => new Set(v.map(l => l.faixa)).size === v.length).length;
    log('');
    log(`   ⚠ ${dups.length} chave(s) contrato+vigência+chassi com MAIS DE UMA linha`);
    log(`     ${comFaixa} delas têm uma FAIXA diferente em cada linha`
      + ` (é a coluna Faixa que as separa) · ${dups.length - comFaixa} repetem a faixa`);
    log('     as 3 primeiras, linha a linha:');
    dups.slice(0, 3).forEach(([k, v]) => {
      log(`        ${k}`);
      v.forEach(l => log(`           faixa "${l.faixa}" · km ${numBR(l.km_anterior)} → ${numBR(l.km_atual)}`
        + ` · rodado ${numBR(l.km_rodado)} · ${brl(l.valor)}`
        + ` · ${l.data_anterior || '—'} → ${l.data_atual || '—'}`));
    });
  } else {
    log('   nenhuma chave repetida: um chassi por contrato e mês.');
  }

  if (MODE !== 'gravar') {
    log('');
    log('modo teste — nada foi gravado. Rode com modo=gravar para subir.');
    await br.close();
    process.exit(0);
  }
  // o que sobrou (o último contrato falhou ao gravar, ou nada foi gravado ainda)
  if (linhas.length > gravadasAte) await grava(linhas.slice(gravadasAte));
  log('');
  log(`Coleta concluída. ${linhas.length} linha(s) no banco.`);
} catch (e) {
  log(`  ✘ falhou: ${e.message}`);
  await shot('99-erro');
  await br.close();
  process.exit(1);
}
await br.close();

// ════════════════════════════════════════════════════════════════════════
// UMA CONSULTA: contrato + mês → linhas do relatório
// ════════════════════════════════════════════════════════════════════════
/* O caminho é o que o Renan mostrou passo a passo: marcar o contrato, digitar
   o Mês/Ano, Pesquisar; se o contrato não cobre o mês, um modal avisa e o
   robô vai para o próximo; se cobre, "Gerar Relatório" baixa o xlsx. */
async function consulta(pg, contrato, vig) {
  /* CADA ETAPA TEM NOME (15/09/2026): a 1ª rodada da coleta ficou sete minutos
     numa única busca e o log não dizia onde — uma espera estourando o tempo
     limite em silêncio parece igual a um portal lento. Agora o erro diz a
     etapa, e com VT_DEBUG=1 cada passo aparece com o tempo que levou. */
  let etapa = 'abrir a consulta';
  const t0 = Date.now();
  let tp = t0;
  const passo = nome => {
    if (DEBUG) log(`      · ${etapa} (${((Date.now() - tp) / 1000).toFixed(1)}s)`);
    tp = Date.now(); etapa = nome;
  };
  const erro = e => { const m = e && e.message ? e.message.split('\n')[0] : String(e);
                      throw new Error(`[${etapa}] ${m.slice(0, 160)}`); };

  try {
    // TELA LIMPA A CADA BUSCA: o portal guarda o que já estava marcado, e sem
    // zerar o segundo contrato viria somado ao primeiro — dado trocado sem erro
    // nenhum, que é a pior espécie.
    await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 });
    /* 'networkidle' NÃO SERVE NUM PORTAL COM POLLING: se alguma chamada repete
       sozinha, a rede nunca fica ociosa e a espera vai até o teto — 30 s aqui,
       60 s depois da busca, por consulta. O que interessa é o campo estar de
       pé, e isso o próprio locator espera. */
    await pg.locator('#ctl00_cphMainContent_txtMesAno').waitFor({ state: 'visible', timeout: 30000 });
    passo('marcar o contrato');

    /* MARCAR O CONTRATO É POR EVENTO, NÃO POR CLIQUE (bug real, 15/09/2026).
       Os checkboxes moram num dropdown fechado, então `check({force:true})`
       marca o elemento mas o clique real não chega nele e o handler do site —
       que é quem escreve o código em txtContrato — não roda. O sintoma foi
       silencioso: a tela abre com um contrato JÁ na sessão (txtContrato vinha
       com A1783K num carregamento novo), então o campo nunca ficava vazio; o
       robô teria consultado o contrato errado achando que marcou o certo.
       Disparar click/change no próprio elemento roda o handler com o dropdown
       fechado. */
    const campoCt = pg.locator('#ctl00_cphMainContent_txtContrato');
    const antes = await campoCt.inputValue().catch(() => '');
    const marcou = await pg.evaluate(cod => {
      const todos = [...document.querySelectorAll('input[type=checkbox][id^="check-"]')];
      const meus = todos.filter(e => e.id.replace(/^check-(mob-)?/, '') === cod);
      if (!meus.length) return { achou: false };
      // DESMARCAR O QUE ESTAVA: o portal guarda a seleção, e um contrato
      // esquecido marcado somaria a nota de dois contratos numa consulta só
      todos.filter(e => e.checked && !meus.includes(e)).forEach(e => {
        e.checked = false;
        e.dispatchEvent(new Event('click',  { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      });
      meus.forEach(e => {
        if (!e.checked) {
          e.checked = true;
          e.dispatchEvent(new Event('click',  { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      return { achou: true };
    }, contrato);
    if (!marcou.achou) throw new Error(`contrato ${contrato} não está no seletor`);
    await pg.waitForTimeout(300);

    /* A CONFERÊNCIA É POR IGUALDADE, NÃO POR "CONTÉM": com dois contratos
       marcados o campo traria os dois e um `includes` passaria, consultando a
       soma de dois contratos como se fosse um. Se o handler não escreveu,
       escrever o valor direto é o plano B — o campo vai no post da busca. */
    let noCampo = (await campoCt.inputValue().catch(() => '')).trim();
    if (noCampo.toUpperCase() !== contrato) {
      if (DEBUG) log(`      campo do contrato veio "${noCampo}" (antes "${antes}") — escrevendo direto`);
      await campoCt.fill(contrato);
      noCampo = (await campoCt.inputValue().catch(() => '')).trim();
    }
    if (noCampo.toUpperCase() !== contrato) {
      throw new Error(`o contrato não entrou no campo (ficou "${noCampo}")`);
    }
    passo('digitar o mês');

    /* O CAMPO DO MÊS TEM MÁSCARA e fill() a ignora: ele escreve o valor de uma
       vez, sem disparar o keypress que a máscara escuta — o campo fica com o
       texto cru ou vazio e a busca sai no mês errado. Digitar caractere a
       caractere é o que o Renan descreveu ("092026 já preenche a barra"). */
    const cMes = pg.locator('#ctl00_cphMainContent_txtMesAno');
    await cMes.click();
    await cMes.fill('');
    await cMes.pressSequentially(paraMMAAAA(vig), { delay: 50 });
    const mes = await cMes.inputValue();
    const esperado = `${vig.slice(5, 7)}/${vig.slice(0, 4)}`;
    if (!mes.replace(/\s/g, '').includes(esperado)) {
      throw new Error(`o mês não aplicou: queria ${esperado}, o campo ficou "${mes}"`);
    }
    passo('pesquisar');

    /* O RESULTADO CHEGA POR POSTBACK, e esperar por 'networkidle' num portal
       com chamada periódica vai até o teto sempre. O que decide é: apareceu o
       modal de "sem dados" OU apareceu o "Gerar Relatório". Esperar pelos DOIS
       ao mesmo tempo termina assim que um deles vier. */
    /* O BOTÃO TEM DE SER O VISÍVEL (bug real, 15/09/2026): sem o `:visible`,
       `input[value*="Relat"]` casava também com um elemento escondido, o
       `.first()` escolhia esse, e o clique ficava 30 s esperando um elemento
       que nunca fica clicável. O log dizia "Timeout" sem dizer que o botão
       era o errado. */
    const btRel = pg.locator('input[value*="Relat" i]:visible')
      .or(pg.locator('button:visible, a:visible').filter({ hasText: /gerar\s*relat/i }));
    await pg.locator('#ctl00_cphMainContent_btnPesquisar').click();
    await Promise.race([
      pg.locator('.swal2-popup').first().waitFor({ state: 'visible', timeout: 45000 }),
      btRel.first().waitFor({ state: 'visible', timeout: 45000 }),
    ]).catch(() => {});                       // nenhum dos dois = trata como sem dado
    passo('ler o resultado');
    if (DEBUG) {
      const viz = await pg.$$eval('input[type=submit],input[type=button],button,a', els =>
        els.filter(e => e.offsetParent).map(e => (e.value || e.innerText || '').trim())
          .filter(t => t && t.length < 40));
      log(`      depois da busca, clicáveis visíveis: ${[...new Set(viz)].join(' · ')}`);
    }

    // O MODAL É O "SEM DADOS" — é SweetAlert2 (.swal2-popup), o mesmo que
    // reclamou do Mês/Ano em branco na sonda. Fechar no OK e seguir.
    const pop = pg.locator('.swal2-popup:visible');
    if (await pop.count()) {
      const txt = (await pop.first().innerText()).replace(/\s+/g, ' ').trim();
      await pg.locator('.swal2-confirm:visible').first().click().catch(() => {});
      await pg.waitForTimeout(300);
      /* A FRASE DO PORTAL É "Nenhum registro encontrado" (achado na 1ª coleta
         do ano, 15/09/2026) — não tem "não" nem "sem", que era o que meu
         filtro procurava. Resultado: o modal legítimo de mês sem contrato
         entrava como FALHA, e a contagem de falhas ficou cheia de pares que
         só não têm dado. Um modal que de fato não seja o de vazio continua
         virando erro, para não ser engolido como se fosse mês sem dado. */
      if (!/nenhum\s+(registro|resultado|dado)|n[ãa]o.*(encontr|localiz|registro|resultado|dado)|sem\s+(registro|dado|resultado)/i.test(txt)) {
        throw new Error(`modal inesperado: ${txt.slice(0, 160)}`);
      }
      return { semDado: true, linhas: [] };
    }
    if (!(await btRel.count())) return { semDado: true, linhas: [] };   // sem botão = sem resultado

    // o Valor Total é lido ANTES do download: depois do clique a tela pode
    // recarregar e o campo voltar a "R$ 0,00"
    const totTxt = await pg.locator('#ctl00_cphMainContent_lblTotalNota2').inputValue().catch(() => '');
    passo('gerar e baixar o relatório');

    const [dl] = await Promise.all([
      pg.waitForEvent('download', { timeout: 60000 }),
      btRel.first().click(),
    ]);
    // o portal manda sempre o mesmo nome ("ConsultaValorNotaFiscal"), por isso
    // o arquivo é salvo com contrato e mês — senão vira um monte de (1), (2)…
    const arq = `${SHOTS}/${contrato}_${vig}${(dl.suggestedFilename().match(/\.[a-z]+$/i) || ['.xlsx'])[0]}`;
    await dl.saveAs(arq);
    passo('ler o xlsx');

    const { cab, linhas: brutas } = await xlsx(arq);
    fs.unlinkSync(arq);                     // o dado vai para o banco, não para o artifact
    /* O CABEÇALHO REAL APARECE NO LOG, UMA VEZ (15/09/2026): a 1ª leitura
       falhou com "colunas não encontradas" e a mensagem — que carregava o
       cabeçalho — foi CORTADA em 120 caracteres pelo meu próprio resumo da
       falha. Sobrou o erro sem a informação que explicava o erro. */
    if (!_cabLogado) { _cabLogado = true; log(`   colunas do relatório: ${cab.join(' | ')}`); }
    if (!brutas.length) return { semDado: true, linhas: [] };

    const c0 = brutas[0];
    const K = {
      chassi: acha(c0, 'chassi'), placa: acha(c0, 'placa'),
      kmAnt: acha(c0, 'km anterior', 'quilometragem anterior'),
      dtAnt: acha(c0, 'data anterior'),
      kmAtu: acha(c0, 'km atual', 'quilometragem atual'),
      dtAtu: acha(c0, 'data atual'),
      faixa: acha(c0, 'faixa'),
      kmRod: acha(c0, 'km rodado', 'quilometragem rodada'),
      valor: acha(c0, 'valor km', 'valor'),
    };
    const faltando = Object.entries(K).filter(([, v]) => !v).map(([k]) => k);
    if (faltando.length) {
      throw new Error(`colunas não encontradas no relatório (${faltando.join(', ')})`
        + ` — o que veio foi: ${Object.keys(c0).join(' | ')}`);
    }

    /* A LINHA DE TOTAL DO RODAPÉ NÃO É UM VEÍCULO (pego no teste do parser,
       15/09/2026). O relatório fecha com "Total" na 1ª coluna e a soma nas
       colunas de km e valor. Como "Total" cai no campo Chassi, um filtro de
       "tem chassi ou placa" a mantinha — e ela entraria no banco como um
       veículo cujo valor é a soma de todos os outros, DOBRANDO o mês. É o
       mesmo fantasma do "Filtros aplicados" do robô do Ginfo, que chegou a
       fazer o Farol contar uma saída onde não havia nenhuma.

       A régua é a FORMA da chave: chassi tem 8+ caracteres alfanuméricos
       (o real tem 17), placa tem o formato de placa. "Total" não passa em
       nenhum dos dois. O que sobrar de fora é contado e aparece no log —
       descarte silencioso esconderia mudança de layout. */
    const ehChassi = s => /^[A-Z0-9]{8,20}$/.test(s);
    const ehPlaca  = s => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(s);
    const cand = brutas.map(b => ({
      contrato, vigencia: vig,
      chassi: String(b[K.chassi] || '').trim().toUpperCase(),
      placa:  String(b[K.placa]  || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
      km_anterior: num(b[K.kmAnt]), data_anterior: dataISO(b[K.dtAnt]),
      km_atual:    num(b[K.kmAtu]), data_atual:    dataISO(b[K.dtAtu]),
      faixa: String(b[K.faixa] == null ? '' : b[K.faixa]).trim(),
      km_rodado: num(b[K.kmRod]), valor: num(b[K.valor]),
    }));
    const linhas = cand.filter(l => ehChassi(l.chassi) || ehPlaca(l.placa));
    const fora = cand.filter(l => !linhas.includes(l) && (l.chassi || l.placa || l.valor));
    if (fora.length) {
      log(`      ${fora.length} linha(s) descartada(s) por não ter chassi nem placa`
        + ` (rodapé/total): ${fora.slice(0, 3).map(l => `"${l.chassi || l.placa}" ${brl(l.valor)}`).join(' · ')}`);
    }

    /* O VALOR TOTAL DA NOTA É A CONFERÊNCIA (o Renan mostrou os dois na tela):
       a soma das linhas tem de bater com o total. No caso que ele mostrou a
       soma deu R$ 6.060,01 contra R$ 6.060,00 de total — um centavo de
       arredondamento, então a folga é de um centavo POR LINHA, não fixa. */
    const total = totTxt && num(totTxt) ? num(totTxt) : null;
    const soma = linhas.reduce((s, l) => s + l.valor, 0);
    const confere = total == null || Math.abs(soma - total) <= Math.max(0.01 * linhas.length, 0.01);
    passo('fim');
    return { semDado: false, linhas, total, confere };
  } catch (e) { erro(e); }
}

/* O CABEÇALHO NÃO É A 1ª LINHA (bug real, 15/09/2026). `sheet_to_json` sem
   `header` usa a primeira linha da planilha como nome das colunas — e o
   relatório do portal abre com linhas de título, então as "colunas" viravam o
   texto do título e NENHUMA era encontrada. Achar a linha que tem "Chassi" ou
   "Placa" resolve os dois lados: pula o que vem antes e não depende de quantas
   linhas de enfeite o portal resolver pôr amanhã. */
async function xlsx(arq) {
  const XLSX = (await import('xlsx')).default;
  const wb = XLSX.readFile(arq);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const m = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const iCab = m.findIndex(l => (l || []).some(c => /chassi|placa/i.test(String(c == null ? '' : c))));
  if (iCab < 0) {
    // sem cabeçalho reconhecível: devolve as primeiras linhas como diagnóstico
    return { cab: (m.slice(0, 3).flat() || []).map(x => String(x == null ? '' : x)).filter(Boolean), linhas: [] };
  }
  const cab = (m[iCab] || []).map((c, i) => String(c == null ? '' : c).trim() || `col${i}`);
  const linhas = m.slice(iCab + 1)
    .filter(l => (l || []).some(c => c != null && String(c).trim() !== ''))
    .map(l => Object.fromEntries(cab.map((k, i) => [k, l[i] == null ? null : l[i]])));
  return { cab, linhas };
}

// ════════════════════════════════════════════════════════════════════════
// GRAVAÇÃO
// ════════════════════════════════════════════════════════════════════════
/* SÓ A FOTO CRUA, POR ENQUANTO. O destino é substituir a planilha "Contratos
   Man." como fonte da Carta — mas trocar a fonte antes de comparar é o erro
   que a migração do Km/L ensinou a não cometer (lá o comparador rodou antes e
   pegou o que a planilha escondia). Então: o robô grava o que o portal diz, e
   a troca da fonte vem depois de o comparador mostrar que bate. */
async function grava(linhas, parcial = false) {
  if (!SB_KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
  /* LEITURA VAZIA NÃO APAGA NADA (a mesma trava do contratos-robot, que já
     salvou 733 lançamentos): se o portal mudar e a coleta render zero, o robô
     aborta antes de encostar no banco. Numa gravação PARCIAL isso não vale —
     contrato sem linha nenhuma é normal, e não é motivo para derrubar o run. */
  if (!linhas.length) {
    if (parcial) return;
    console.error('\n⚠ NADA A GRAVAR: nenhuma linha coletada. Abortando sem tocar no banco.');
    process.exit(1);
  }
  const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  const agora = new Date().toISOString();
  /* A FAIXA FAZ PARTE DA CHAVE (Renan, 15/09/2026: "Importante ver isso,
     quando ultrapassa. Até ter um controle que indique que avançou de faixa").
     O mesmo chassi aparece mais de uma vez no mesmo contrato e mês quando o km
     atravessa a faixa do contrato: são duas cobranças, cada uma com o seu
     preço. Não é duplicata, e colapsar destruiria justamente o que interessa
     enxergar. O Postgres recusa duas linhas com a mesma chave NO MESMO LOTE
     ("ON CONFLICT DO UPDATE command cannot affect row a second time") — e foi
     isso que levou a 1ª coleta do ano inteira, 28 minutos, embora os dados
     estivessem certos. Com a faixa na chave, as duas linhas convivem; o que
     ainda colidir é contado e aparece no log em vez de derrubar a gravação. */
  const vistas = new Map();
  linhas.forEach(l => vistas.set(`${l.contrato}|${l.vigencia}|${l.chassi}|${l.faixa}`, l));
  const perdidas = linhas.length - vistas.size;
  if (perdidas) log(`   ⚠ ${perdidas} linha(s) com chave repetida (mesma faixa) — ficou a última de cada`);
  const corpo = [...vistas.values()].map(l => ({ ...l, coletado_em: agora }));
  let n = 0;
  for (let i = 0; i < corpo.length; i += 500) {
    const lote = corpo.slice(i, i + 500);
    const r = await fetch(`${SB_URL}/rest/v1/vw_contrato_km?on_conflict=contrato,vigencia,chassi,faixa`, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(lote),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 404) console.error('\nA tabela vw_contrato_km ainda não existe.'
        + ' Rode scripts/volkstotal-supabase.sql no SQL Editor e tente de novo.');
      throw new Error(`vw_contrato_km: ${r.status} ${t.slice(0, 300)}`);
    }
    n += lote.length;
  }
  log(`gravado: ${n} linha(s) em vw_contrato_km.`);
}
