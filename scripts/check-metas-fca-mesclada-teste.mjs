// O SLIDE DO FCA NO CHECK DE METAS COM A TABELA MESCLADA (Renan, 19/10/2026:
// "Está tudo errado quando gero o material do check de metas, no FCA").
// A Tabela do FCA (assets/fca-tabela.js) mescla Unidade · Projeto · Vigência ·
// Fato e a causa sobre as ações dela (rowspan). Este teste desenha essa tabela
// com o código real, lê com o __cm.extrai real do check-metas e monta o slide com
// o slides.js real, conferindo:
//   · o extrai devolve a grade completa (toda linha com as 9 colunas, a ação
//     sempre na coluna Ação, a unidade em toda linha);
//   · o "+" de adicionar não vira texto e o YTD aparece uma vez só;
//   · o slide refaz o rowspan (fato mesclado nas linhas dele, causa sobre as
//     ações dela) e cada linha ocupa as 9 colunas.
// Uso: node scripts/check-metas-fca-mesclada-teste.mjs  (SHOT=arquivo.png salva o slide)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
let oks = 0, falhas = 0;
const ok = (n, c, d) => { if (c) { oks++; console.log('  ✓', n, d ? ` (${d})` : ''); } else { falhas++; console.log('  ✗', n, d ? ` (${d})` : ''); } };

// o __cm do check-metas é um template literal; avalio a string como o painel faz
const ix = fs.readFileSync(path.join(RAIZ, 'check-metas/index.html'), 'utf8');
const a = ix.indexOf('const CM_HELPER=`') + 'const CM_HELPER=`'.length;
const b = ix.indexOf('};`;', a) + 2;
const CM = (0, eval)('`' + ix.slice(a, b) + '`');

const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/__t.html') { r.setHeader('content-type', 'text/html; charset=utf-8'); return r.end('<!doctype html><meta charset="utf-8"><body></body>'); }
  const f = path.join(RAIZ, p);
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : 'text/plain');
  r.end(fs.readFileSync(f));
}).listen(0);
const ORIG = `http://localhost:${srv.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
const pg = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(ORIG + '/__t.html');
await pg.addScriptTag({ url: '/assets/fca-tabela.js' });

// o caso do print: FLP · ROTA · Manutenções, 3 causas, 6 ações
const ITENS = [
  { id: 'a', causa: '1. Manutenção de Veículos e Equipamentos', acao: '1.2. Reciclar unidade no processo de abertura de RC' },
  { id: 'b', causa: '1. Manutenção de Veículos e Equipamentos', acao: '1.3. Treinar motoristas realização de checklist' },
  { id: 'c', causa: '1. Manutenção de Veículos e Equipamentos', acao: '1.4. Criar cronograma de treinamento com Motorista instrutor' },
  { id: 'd', causa: '2. Contrato de manutenção: 15 de 27 placas variáveis\n- RXT2D65 +933 km (+48%), R$ 627', acao: '2.1. Revisar Real X Remunerados no FT' },
  { id: 'e', causa: '2. Contrato de manutenção: 15 de 27 placas variáveis\n- RXT2D65 +933 km (+48%), R$ 627', acao: '2.2. Revisar Real X Remunerados no remunerado' },
  { id: 'f', causa: '3. Contrato de manutenção Apoio R$5.445', acao: '3.1. Reciclar unidade no processo de abertura de RC' },
].map(x => ({ ...x, uni: 'FLP', proj: 'ROTA', vig: 'set/26', fato: 'Manutenções',
  desvio: 'Desvio: ▲ R$ 13.591 · ▲ 31%\nContas:\n- Man. Veículos e Equip.: ▲ 18K | ▲ 217%\n- Carrocerias: ▼ 6,9K | ▼ 100%\nYTD: ▲ R$ 60.620 (13%) · reduzir 38% até dez/26',
  resp: 'ANA ROCHA', prazo: '2026-10-30', status: 'Não iniciada' }));

await pg.evaluate(itens => {
  const tri = h => h.replace(/▲/g, '<span style="color:#e33">▲</span>').replace(/▼/g, '<span style="color:#2a2">▼</span>');
  document.body.innerHTML = FcaTabela.html(itens, { uni: true, add: true, tri,
    chip: s => `<span style="background:#e33;color:#fff;padding:2px 6px;border-radius:9px">${s}</span>` });
}, ITENS);
await pg.addScriptTag({ content: CM });
const tab = await pg.evaluate(() => window.__cm.extrai(document.querySelector('table')));

console.log('\n1 · leitura (__cm.extrai)');
ok('a tabela foi lida', !!tab && tab.tipo === 'tabela', tab && tab.cab.join(' | '));
const COLS = tab.cab.length;
ok('cabeçalho com as 9 colunas do FCA', COLS === 9, String(COLS));
ok('toda linha sai com as 9 colunas (grade completa)', tab.linhas.length === 6 && tab.linhas.every(l => l.cels.length === COLS), tab.linhas.map(l => l.cels.length).join(','));
const iU = 0, iFato = 3, iCausa = 4, iAcao = 5, iResp = 6;
ok('a unidade está em toda linha (1ª de origem, as outras cópia)', tab.linhas.every(l => l.cels[iU].t === 'FLP') && tab.linhas[0].cels[iU].rs === 6 && tab.linhas.slice(1).every(l => l.cels[iU].cont));
ok('a ação está sempre na coluna Ação', tab.linhas.every((l, i) => l.cels[iAcao].t.includes(ITENS[i].acao.replace(/^\d+\.\d+\.\s*/, ''))), tab.linhas.map(l => l.cels[iAcao].t.slice(0, 22)).join(' | '));
ok('o responsável está sempre na coluna Resp.', tab.linhas.every(l => l.cels[iResp].t === 'ANA ROCHA'));
ok('a causa 1 cobre as 3 ações dela (rs 3) e a 2 as 2 dela', tab.linhas[0].cels[iCausa].rs === 3 && tab.linhas[3].cels[iCausa].rs === 2 && tab.linhas[1].cels[iCausa].cont && !tab.linhas[5].cels[iCausa].cont);
const todosTx = tab.linhas.flatMap(l => l.cels.map(c => c.t + (c.trechos || []).map(x => x.t).join('')));
ok('o "+" de adicionar não vira texto', !todosTx.some(t => /(^|\n)\s*\+\s*($|\n)/.test(t)) && !todosTx.some(t => /\+$/.test(t.trim())));
const fatoTx = tab.linhas[0].cels[iFato];
const fatoStr = (fatoTx.trechos || []).map(x => x.t).join('') || fatoTx.t;
ok('número e texto separados por espaço ("1.3. Treinar")', /^1\.3\. Treinar/.test(tab.linhas[1].cels[iAcao].t), tab.linhas[1].cels[iAcao].t.slice(0, 20));
ok('espaço antes da seta colorida ("Equip. ▲")', /Equip\. ▲/.test(fatoStr) && /YTD ▲/.test(fatoStr));
ok('o YTD aparece uma vez só no fato', (fatoStr.match(/YTD/g) || []).length === 1, fatoStr.replace(/\n/g, ' ⏎ '));

console.log('\n2 · slide (slides.js)');
await pg.addScriptTag({ url: '/check-metas/slides.js' });
const sl = await pg.evaluate(dados => {
  const pgs = window.SlidePadrao.slTabela('Manutenções – FLP · ROTA', 'FCA · set/2026', dados, {});
  const t = pgs[0].querySelector('table.sl-t');
  const trs = [...t.querySelectorAll('tbody tr')];
  // grade: quantas colunas cada linha ocupa contando os rowspans de cima
  const ocup = [];
  const larg = trs.map((tr, ri) => {
    let n = (ocup[ri] || 0);
    [...tr.children].forEach(td => { n += 1; for (let k = 1; k < td.rowSpan; k++) ocup[ri + k] = (ocup[ri + k] || 0) + 1; });
    return n;
  });
  return { pags: pgs.length, larg, tds0: trs[0].children.length,
    rsFato: trs[0].children[3].rowSpan, rsUni: trs[0].children[0].rowSpan, rsCausa: trs[0].children[4].rowSpan,
    acao2: trs[1].children[0] && trs[1].children[0].textContent,
    txt: t.innerText };
}, tab);
if (process.env.SHOT) {
  await pg.evaluate(() => { document.querySelector('.rel-section').remove(); const p = document.getElementById('sl-palco'); p.style.left = '0'; p.style.zIndex = '1'; });
  await pg.setViewportSize({ width: 1600, height: 900 });
  const el = await pg.$('#sl-palco .sl'); if (el) await el.screenshot({ path: process.env.SHOT }); }
ok('cabe em uma página', sl.pags === 1, String(sl.pags));
ok('toda linha do slide ocupa as 9 colunas', sl.larg.every(n => n === 9), sl.larg.join(','));
ok('unidade, fato e causa mesclados como no painel', sl.rsUni === 6 && sl.rsFato === 6 && sl.rsCausa === 3, `uni ${sl.rsUni} · fato ${sl.rsFato} · causa ${sl.rsCausa}`);
ok('a 2ª linha começa pela AÇÃO (não pela unidade)', /Treinar motoristas/.test(sl.acao2 || ''), sl.acao2);
ok('nada de "+" no slide', !/(^|\s)\+(\s|$)/.test(sl.txt));
ok('zero erro de página', !errs.length, errs.join(' / '));

await browser.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
