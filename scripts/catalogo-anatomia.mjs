// ============================================================
// A LISTA POR ANATOMIA — consolida as 6 frentes e mede contra o BENNER
// (Renan, 18/09/2026: "Catálogo tem 1495 linhas? Está de sacanagem?" ·
//  "Vamos virar todas as peças e serviços que temos hoje, então precisamos de
//  algo assertivo")
//
// Por que existe: a lista de 1.191 nasceu do HISTÓRICO DE COMPRA do Benner, e
// peça coberta por garantia ou contrato nunca foi comprada — então nunca
// apareceu. A frota tem 14 famílias de motor e a lista não tinha UM
// virabrequim. A lista nova é montada da anatomia do equipamento (spec em
// docs/catalogo/pesquisa/anatomia-spec.md, uma frente por arquivo r3-*.json).
//
// Este script faz DUAS coisas, e a segunda é a que responde "ficou assertiva?":
//   1. CONSOLIDA as frentes em docs/catalogo/lista-anatomia.json, deduplicando
//      por peça+material (frentes se sobrepõem de propósito: rolamento aparece
//      em Motor e em Cubo);
//   2. MEDE a cobertura contra o que a empresa compra hoje — os 4.988 códigos
//      do DE_PARA, os itens com uso em 12 meses e os que aparecem em OS. Item
//      usado que não acha destino na lista nova é LACUNA, e sai nomeado.
//
// A régua do cruzamento NÃO é o nome bater: é o item do Benner cair numa
// FAMÍLIA+SISTEMA que a lista nova cobre, porque o cadastro velho tem nome
// sujo ("PARAFUSO COM OLHAL 1/2\" X 25mm SISTEMA TRAVA BAIA FACCHINI - REF…").
// Comparar string com string mediria a qualidade do cadastro antigo, não a
// cobertura da lista nova.
//
// Uso: node scripts/catalogo-anatomia.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const RAIZ = process.cwd();
const RAW = path.join(RAIZ, 'docs/catalogo/pesquisa/raw');
const XLS = path.join(RAIZ, 'docs/catalogo/pesquisa/Lista_de_Pecas_e_Servicos.xlsx');

const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// ── 1) consolida as frentes ────────────────────────────────────────────────
const frentes = fs.readdirSync(RAW).filter(f => /^r3-.*\.json$/.test(f)).sort();
const itens = [];
const vistos = new Map();          // peca+material → índice, para deduplicar
const porFrente = {};
for (const f of frentes) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  let novos = 0, dup = 0;
  for (const it of j.itens) {
    const k = nrm(it.peca) + '|' + nrm(it.material);
    if (vistos.has(k)) {
      // a mesma peça em duas frentes: junta os tipos de equipamento em que
      // ela se aplica, em vez de manter a primeira e perder a segunda
      const j0 = itens[vistos.get(k)];
      j0.aplica = [...new Set([...(j0.aplica || []), ...(it.aplica || [])])];
      if (!j0.nota && it.nota) j0.nota = it.nota;
      if (!j0.ncm && it.ncm) { j0.ncm = it.ncm; j0.ncm_confianca = it.ncm_confianca; }
      dup++; continue;
    }
    vistos.set(k, itens.length);
    itens.push({ ...it, frente: j.frente });
    novos++;
  }
  porFrente[j.frente] = { arquivo: f, itens: j.itens.length, novos, dup };
}
itens.forEach((it, i) => { it.n = i + 1; });

const servicos = itens.filter(i => i.servico);
const pecas = itens.filter(i => !i.servico);
console.log('═══ a lista por anatomia ═══\n');
for (const [fr, v] of Object.entries(porFrente)) {
  console.log(`   ${fr.padEnd(24)} ${String(v.itens).padStart(4)} itens · ${v.novos} novos · ${v.dup} já vistos em outra frente`);
}
console.log(`\n   TOTAL ${itens.length} itens — ${pecas.length} peças + ${servicos.length} serviços`);

// família × sistema que a lista nova cobre (a régua do cruzamento)
const familias = new Map();
itens.forEach(i => {
  const k = i.familia || '(sem família)';
  if (!familias.has(k)) familias.set(k, { n: 0, sistemas: new Set() });
  const a = familias.get(k); a.n++; if (i.sistema) a.sistemas.add(i.sistema);
});
console.log(`   ${familias.size} famílias · ${[...familias.values()].reduce((s, a) => s + a.sistemas.size, 0)} sistemas`);

// ── 2) o que a empresa compra hoje ─────────────────────────────────────────
const wb = XLSX.readFile(XLS);
const aba = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' });
const dp = aba('DE_PARA');
const usados = aba('Itens_Usadas_Benner');
const os = aba('Os_usadas');

// ── a régua: TOKEN do nome, não o nome inteiro ────────────────────────────
// O cadastro do Benner tem nome sujo ("PARAFUSO COM OLHAL 1/2\" X 25mm SISTEMA
// TRAVA BAIA FACCHINI - REF. 03.73.0087.01"), então exigir que a string bata
// mede a qualidade do cadastro antigo, não a cobertura da lista nova. Eu caí
// nessa na 1ª versão: dava "família Filtros sem destino" com a lista cheia de
// filtros, e "rolamento fora" com Rolamento na lista.
// A régua é o NÚCLEO do nome: um índice invertido de tokens dos 4.4 mil itens
// novos, e o item do Benner é coberto quando existe candidato que compartilhe
// os tokens significativos. Um token raro e específico (virabrequim, orbitrol)
// basta sozinho; token comum (kit, jogo, tubo) não conta.
const STOP = new Set(('de da do das dos e ou para por com sem a o as os um uma no na nos nas '
  + 'ref cod codigo mm cm m pol polegada x un pc pcs kg lt l g und unid p tipo modelo marca '
  + 'novo nova original generico linha serie' ).split(' '));
// stemming mínimo e grafia: "presilhas" tem de casar com "presilha", e o
// cadastro escreve junto o que a lista escreve com hífen ("parabrisa" ×
// "para-brisa", "paralama", "parachoque"). Sem isso a medição acusa lacuna
// onde o item existe — foi o que apareceu na 1ª leitura.
const JUNTO = [[/\bparabrisa\b/g, 'para brisa'], [/\bparalama\b/g, 'para lama'],
  [/\bparachoque\b/g, 'para choque'], [/\bparabarro\b/g, 'apara barro'],
  [/\bdesingripante\b/g, 'desengripante'], [/\barrebite\b/g, 'rebite'],
  [/\bnipel\b/g, 'niple'], [/\bhecile\b/g, 'helice']];
const stem = t => (t.length > 4 && /s$/.test(t) ? t.slice(0, -1) : t);
const toks = s2 => {
  let x = nrm(s2);
  for (const [re, sub] of JUNTO) x = x.replace(re, sub);
  return [...new Set(x.split(' ').map(stem))].filter(t => t.length >= 4 && !STOP.has(stem(t)) && !/^\d+$/.test(t));
};

const idx = new Map();             // token → Set(índice do item novo)
itens.forEach((it, i) => {
  for (const t of toks(it.peca + ' ' + (it.material || '') + ' ' + (it.sistema || '') + ' ' + (it.conjunto || ''))) {
    if (!idx.has(t)) idx.set(t, new Set());
    idx.get(t).add(i);
  }
});
// token RARO na lista nova = específico o bastante para valer sozinho
const raro = t => { const s3 = idx.get(t); return s3 && s3.size <= 12; };

// A lista nova é de ITEM GENÉRICO; a especificação (H7 24V, MBB Atego, 6x20mm)
// é a FICHA, por regra do próprio spec. Então a pergunta certa é: o item
// genérico existe? Isso se lê no TOKEN-CABEÇA — o 1º substantivo do nome do
// Benner ("FILTRO DE AR MBB ATEGO 1719" → filtro; "LAMPADA H7 70W 24V - GE" →
// lampada). Exigir 2 tokens punia justamente o que a lista faz de propósito:
// não carregar modelo nem medida no nome. Os dois números saem no relatório,
// porque cada um responde uma coisa diferente:
//   cabeça  — a lista TEM esse tipo de item?
//   2 tokens — a lista tem esse item com esse detalhe?
function acha(nome) {
  const ts = toks(nome);
  if (!ts.length) return { ok: false, cabeca: false, motivo: 'nome sem token útil' };
  const cand = new Map();
  let algumRaro = false;
  for (const t of ts) {
    const s3 = idx.get(t);
    if (!s3) continue;
    if (raro(t)) algumRaro = true;
    for (const i of s3) cand.set(i, (cand.get(i) || 0) + 1);
  }
  const cabeca = idx.has(ts[0]);
  if (!cand.size) return { ok: false, cabeca, motivo: `nenhum token existe na lista (cabeça: ${ts[0]})` };
  let melhor = -1, mScore = 0;
  for (const [i, sc] of cand) if (sc > mScore) { mScore = sc; melhor = i; }
  const detalhe = mScore >= 2 || (mScore === 1 && algumRaro);
  return { ok: cabeca || detalhe, cabeca, detalhe, item: itens[melhor], score: mScore,
    motivo: (cabeca || detalhe) ? '' : `o tipo "${ts[0]}" não existe na lista nova` };
}

// ── cruza: o que a empresa compra hoje ─────────────────────────────────────
const numUso = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const linhas = usados.map(u => ({
  cod: String(u.COD_ITEM).trim(),
  desc: String(u.DESCRICAO_ITEM || ''),
  familiaBenner: String(u.FAMILIA_ITEM || ''),
  uso12m: numUso(u['USO 12M']),
  estoque: numUso(u.ESTOQUE),
}));
const osCount = new Map();
os.forEach(o => { const c = String(o['Código do Item']).trim(); osCount.set(c, (osCount.get(c) || 0) + 1); });

const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
let com = 0, sem = 0, usoCom = 0, usoSem = 0, comDet = 0, usoDet = 0;
const fora = [];
for (const l of linhas) {
  const r = acha(l.desc);
  if (r.detalhe) { comDet++; usoDet += l.uso12m; }
  if (r.ok) { com++; usoCom += l.uso12m; }
  else { sem++; usoSem += l.uso12m; fora.push({ ...l, motivo: r.motivo, osN: osCount.get(l.cod) || 0 }); }
}
console.log('\n━━ o que a empresa compra hoje × a lista nova');
console.log(`   itens do Benner com uso/estoque: ${linhas.length}`);
console.log(`   ACHAM item na lista nova: ${com} (${pct(com, linhas.length)})`);
console.log(`   NÃO acham:                ${sem} (${pct(sem, linhas.length)})`);
console.log(`   ponderado por USO 12M: ${Math.round(usoCom).toLocaleString('pt-BR')} coberto × ${Math.round(usoSem).toLocaleString('pt-BR')} fora`
  + `  → ${pct(usoCom, usoCom + usoSem)} do uso coberto`);
console.log(`   (a régua acima é o TIPO do item. Com o DETALHE também batendo — modelo/medida no`);
console.log(`    nome, que a lista nova não carrega de propósito — seriam ${comDet} itens, ${pct(usoDet, usoCom + usoSem)} do uso.)`);

// as lacunas que MAIS importam: as que a operação usa de verdade
fora.sort((a, b) => (b.uso12m - a.uso12m) || (b.osN - a.osN));
console.log(`\n   as 20 maiores lacunas por uso em 12 meses:`);
fora.slice(0, 20).forEach(f => console.log(`      uso ${String(Math.round(f.uso12m)).padStart(4)} · ${f.cod.padStart(6)} ${f.desc.slice(0, 74)}`));
const semUso = fora.filter(f => !f.uso12m && !f.osN).length;
console.log(`\n   das ${sem} que não acham, ${semUso} NÃO tiveram uso em 12 meses nem aparecem em OS`);
console.log(`   (item sem uso é cadastro morto: a lista nova não precisa herdá-lo)`);
const porFamB = new Map();
fora.filter(f => f.uso12m || f.osN).forEach(f => {
  const k = f.familiaBenner || '(sem família)';
  const a = porFamB.get(k) || { n: 0, uso: 0 }; a.n++; a.uso += f.uso12m; porFamB.set(k, a);
});
console.log(`\n   lacunas COM uso, por família do Benner:`);
[...porFamB.entries()].sort((a, b) => b[1].uso - a[1].uso).slice(0, 14)
  .forEach(([k, v]) => console.log(`      ${String(Math.round(v.uso)).padStart(5)} uso · ${String(v.n).padStart(3)} item(ns) · ${k.slice(0, 60)}`));

// ── DE_PARA: o destino que a planilha propunha acha lugar na lista nova? ───
let dpOk = 0, dpFora = 0; const dpForaEx = new Map();
for (const r of dp) {
  const alvo = String(r.PECA_NOVA_PADRAO || r['NOVO CADASTRO BENNER (PARA)'] || '');
  if (!alvo.trim()) continue;
  const v = acha(alvo);
  if (v.ok) dpOk++;
  else { dpFora++; const k = nrm(alvo); dpForaEx.set(k, (dpForaEx.get(k) || 0) + 1); }
}
console.log(`\n━━ DE_PARA (${dp.length} códigos): o destino proposto acha item na lista nova em ${dpOk} · não acha em ${dpFora}`);
[...dpForaEx.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, n]) => console.log(`      ${n}× ${k}`));

fs.writeFileSync(path.join(RAIZ, 'docs/catalogo/lacunas-benner.json'), JSON.stringify({
  gerado_em: new Date().toISOString().slice(0, 10),
  regra: 'item do Benner coberto = existe item na lista nova com 2+ tokens em comum, ou 1 token raro (<=12 itens)',
  total_benner: linhas.length, cobertos: com, fora: sem,
  uso_coberto: Math.round(usoCom), uso_fora: Math.round(usoSem),
  fora_com_uso: fora.filter(f => f.uso12m || f.osN),
}, null, 1));
console.log('→ docs/catalogo/lacunas-benner.json');

// ── grava ──────────────────────────────────────────────────────────────────
const out = {
  gerado_em: new Date().toISOString().slice(0, 10),
  frentes: porFrente,
  total: itens.length, pecas: pecas.length, servicos: servicos.length,
  itens,
};
fs.writeFileSync(path.join(RAIZ, 'docs/catalogo/lista-anatomia.json'), JSON.stringify(out, null, 1));
console.log('\n→ docs/catalogo/lista-anatomia.json');
