// "Voltar ao Hub" no mesmo lugar em todo painel (Renan, 07/10/2026): no rodapé da
// lateral, logo acima do bloco do usuário; sem lateral, no rodapé à esquerda.
// node scripts/voltar-hub-teste.mjs   (SHOTS=<pasta> salva o rodapé de cada um)
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const RAIZ = process.cwd(), SHOTS = process.env.SHOTS;
const COM_LATERAL = fs.readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const SEM_LATERAL = ['combustivel/index.html','combustivel/seara/index.html','pneus/index.html','governanca/index.html','papeis-responsabilidades/index.html','mpr/index.html'];
const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let ok = 0, falha = 0; const ck = (c, m) => { if (c) ok++; else { falha++; console.log('FALHA', m); } };
const abre = async (f, W = 1366, H = 768) => {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  await pg.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 404, body: '' }));
  await pg.addInitScript(() => { try { sessionStorage.setItem('gem_hub', '1'); } catch (e) {} });
  await pg.goto('file://' + path.join(RAIZ, f), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { for (const el of [document.querySelector('.app'), document.querySelector('aside.side')]) if (el && !el.getBoundingClientRect().width) el.style.display = 'flex'; });
  return pg;
};
for (const f of COM_LATERAL) {
  const pg = await abre(f);
  const r = await pg.evaluate(() => {
    const side = document.querySelector('aside.side'); if (!side) return { side: false };
    const v = side.querySelectorAll('.s-volta'), u = side.querySelector('.s-user');
    const hubs = [...side.querySelectorAll('.s-item')].filter(a => /^\s*(Voltar ao )?Hub\s*$/i.test(a.textContent));
    const fora = hubs.filter(a => !a.closest('.s-volta')).length;
    const vb = v[0] && v[0].getBoundingClientRect(), ub = u && u.getBoundingClientRect(), sb = side.getBoundingClientRect();
    return { side: true, nv: v.length, fora, nhub: hubs.length, gap: vb && ub ? Math.round(ub.top - vb.bottom) : null,
      fundo: ub ? Math.round(sb.bottom - ub.bottom) : null, sairHub: [...side.querySelectorAll('.s-sair')].filter(a => /hub/i.test(a.title)).length,
      volta: v[0] ? [...v[0].querySelectorAll('a,button')].map(a => a.textContent.trim()) : [] };
  });
  ck(r.side && r.nv === 1 && r.nhub === 1 && r.fora === 0, `${f}: um "Voltar ao Hub" só, no rodapé (${JSON.stringify(r)})`);
  ck(r.sairHub === 0, `${f}: sem ícone de hub no bloco do usuário`);
  ck(r.gap !== null && r.gap >= 0 && r.gap <= 16, `${f}: colado no bloco do usuário (folga ${r.gap}px)`);
  if (SHOTS) { const bx = await pg.evaluate(() => { const r = document.querySelector('aside.side').getBoundingClientRect(); return r.width ? { x: r.x, y: Math.max(0, r.bottom - 260), width: r.width, height: Math.min(260, r.bottom) } : null; }); if (bx) await pg.screenshot({ path: `${SHOTS}/lat-${f.replace(/\//g, '_')}.png`, clip: bx }); }
  // recolhido: vira ícone
  await pg.evaluate(() => document.querySelector('aside.side').classList.add('mini'));
  const fs0 = await pg.evaluate(() => getComputedStyle(document.querySelector('.s-volta .s-item:last-child')).fontSize);
  ck(fs0 === '0px', `${f}: recolhido, só o ícone`);
  await pg.close();
}
for (const f of SEM_LATERAL) {
  const pg = await abre(f);
  const r = await pg.evaluate(() => {
    const pe = document.querySelector('.pe-volta'); if (!pe) return { pe: false };
    const a = [...pe.querySelectorAll('a')], app = document.querySelector('.app').getBoundingClientRect(), pb = pe.getBoundingClientRect();
    const topo = [...document.querySelectorAll('.top a,.top-dir a,.acoes a')].filter(x => /hub/i.test(x.textContent + x.title)).length;
    return { pe: true, n: a.length, txt: a.map(x => x.textContent.trim()), esq: Math.round(a[0].getBoundingClientRect().left - app.left),
      baixo: Math.round(app.bottom - pb.bottom), topo, rola: document.documentElement.scrollHeight > innerHeight + 1 };
  });
  ck(r.pe && r.txt.includes('Voltar ao Hub'), `${f}: rodapé com Voltar ao Hub (${JSON.stringify(r)})`);
  ck(r.esq <= 30 && r.baixo <= 20, `${f}: embaixo à esquerda`);
  ck(r.topo === 0, `${f}: nada de hub no topo`);
  ck(!r.rola, `${f}: página não rola`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/sem-${f.replace(/\//g, '_')}.png` });
  await pg.close();
}
await b.close(); console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);
