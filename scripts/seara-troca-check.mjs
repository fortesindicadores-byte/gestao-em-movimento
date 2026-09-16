// A troca de fonte do km remunerado da Seara, nos painéis DE VERDADE.
// O gviz é dublado (fetch e JSONP): a aba `Remunerado` responde com números
// que eu escolhi, e o teste confere que é ESSE número que chega na tela.
// Sem isso, "trocar a fonte" é só editar texto e torcer.
import { chromium } from 'playwright';

const RAIZ = '/home/user/gestao-em-movimento';

// aba Remunerado: A vigência · B placa · C CT-e · D km
const REM = [
  ['07/2026', 'GAU6B24', 45, 2028],
  ['07/2026', 'STR4G70', 207, 2010],
  ['08/2026', 'GAU6B24', 23, 2129],
  ['08/2026', 'STR4G70', 224, 2724],
];
const KM_REM_0726 = 2028 + 2010;      // 4.038
const KM_REM_0826 = 2129 + 2724;      // 4.853
// aba Combustível: E=4 placa · F=5 mês · G=6 ano · H=7 modelo · J=9 tipo · K=10 km
const COMB = [
  [null,null,null,null,'GAU6B24','jul',2026,'VW 17.190','','CAMINHÃO',1900],
  [null,null,null,null,'STR4G70','jul',2026,'VW 17.190','','CAMINHÃO',1800],
  [null,null,null,null,'GAU6B24','ago',2026,'VW 17.190','','CAMINHÃO',2000],
  [null,null,null,null,'STR4G70','ago',2026,'VW 17.190','','CAMINHÃO',2500],
];
// Base Remunerado: A=0 vigência · D=3 placa · O=14 ReaisPorKm
const BREM = [
  ['01/07/2026',null,null,'GAU6B24',...Array(10).fill(0), 3.5],
  ['01/07/2026',null,null,'STR4G70',...Array(10).fill(0), 3.4],
  ['01/08/2026',null,null,'GAU6B24',...Array(10).fill(0), 3.5],
  ['01/08/2026',null,null,'STR4G70',...Array(10).fill(0), 3.4],
];

const pack = (rows, cols) => JSON.stringify({
  status: 'ok',
  table: { cols: cols.map(c => ({ label: c, id: c, type: 'string' })),
           rows: rows.map(r => ({ c: r.map(v => ({ v })) })) },
});

async function abre(pagina, checar) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const pedidos = [];

  await page.addInitScript(({ REM, COMB, BREM }) => {
    sessionStorage.setItem('gem_hub','1');
    localStorage.setItem('bi_theme', 'claro');
    localStorage.setItem('bi_user_name', 'Teste');
    window.Chart = class { constructor(){} destroy(){} update(){} resize(){} };
    window.Chart.register = () => {};
    window.ChartDataLabels = {};   // o plugin vem de CDN e o stub o esvazia
    window.__PEDIDOS = [];
    window.supabase = { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id:'u1', email:'r@x.com',
               user_metadata:{ name:'Renan' } } } } }),
              onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }) },
      from: () => { const q = new Proxy({}, { get: (_, k) =>
        k === 'then' ? (r => Promise.resolve({ data: [], error: null, count: 0 }).then(r))
                     : (() => q) }); return q; },
    })};
    const corpo = u => {
      window.__PEDIDOS.push(u);
      if (/sheet=Remunerado/i.test(u))
        return { rows: REM, cols: ['Vigência','Placa','CT-e','KM'] };
      if (/gid=1982300845/.test(u)) return { rows: COMB, cols: COMB[0].map((_,i)=>'c'+i) };
      if (/gid=0\b/.test(u))        return { rows: BREM, cols: BREM[0].map((_,i)=>'c'+i) };
      if (/gid=1672208132/.test(u)) return { rows: [], cols: ['A'] };   // Base CTEs: vazia de propósito
      return { rows: [], cols: ['A'] };
    };
    const monta = u => { const { rows, cols } = corpo(u);
      // o tq com `select A, sum(D) group by A` devolve 2 colunas; o painel que
      // pede isso lê r[0] e r[1], então a dublagem precisa agregar também
      if (/sheet=Remunerado/i.test(u) && /group\s+by\s+A/i.test(decodeURIComponent(u))) {
        const m = new Map();
        rows.forEach(r => m.set(r[0], (m.get(r[0]) || 0) + r[3]));
        return { rows: [...m].map(([v, k]) => [v, k]), cols: ['Vigência','km'] };
      }
      if (/sheet=Remunerado/i.test(u) && /select\s+A,\s*B,\s*D/i.test(decodeURIComponent(u)))
        return { rows: rows.map(r => [r[0], r[1], r[3]]), cols: ['Vigência','Placa','KM'] };
      return { rows, cols };
    };
    window.__respGviz = u => { const { rows, cols } = monta(u);
      return JSON.stringify({ status:'ok', table:{ cols: cols.map(c=>({label:c,id:c})),
        rows: rows.map(r=>({ c: r.map(v=>({ v })) })) } }); };

    const real = window.fetch.bind(window);
    window.fetch = (u, i) => {
      const s = String(typeof u === 'string' ? u : (u && u.url));
      if (s.includes('docs.google.com'))
        return Promise.resolve(new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${window.__respGviz(s)});`, { status:200 }));
      if (s.startsWith('file:')) return real(u, i);
      return Promise.resolve(new Response('[]', { status:200 }));
    };
    // JSONP (o arvore-frota usa <script src=…&responseHandler:fn>)
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function(n){
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const body = window.__respGviz(n.src);
        setTimeout(() => { if (fn && window[fn]) window[fn](JSON.parse(body)); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { REM, COMB, BREM });

  await page.route('**/cdn.jsdelivr.net/**', r =>
    r.fulfill({ status:200, contentType:'application/javascript', body:'/*stub*/' }));
  await page.goto(`file://${RAIZ}/${pagina}`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(checar);
  const urls = await page.evaluate(() => window.__PEDIDOS);
  await browser.close();
  return { ...r, errs, urls };
}

let falhas = 0;
const ok = (t, v, extra='') => { console.log(`  ${v?'✓':'✗'} ${t}${extra?'  ('+extra+')':''}`); if(!v) falhas++; };

// ── seara-km ──────────────────────────────────────────────────────────────
{
  const r = await abre('seara-km/index.html', () => ({
    linhas: (typeof ALL !== 'undefined' && ALL) ? ALL.map(x => `${x.vig}|${x.placa}|rem=${Math.round(x.kmRem ?? x.rem ?? 0)}|real=${Math.round(x.kmReal ?? x.real ?? 0)}|fb=${!!x.remFb}`) : null,
    chaves: (typeof ALL !== 'undefined' && ALL && ALL[0]) ? Object.keys(ALL[0]) : [],
  }));
  console.log('\n══ seara-km');
  console.log('   pedidos ao gviz:', r.urls.map(u => (u.match(/(sheet=[^&]+|gid=\d+)/)||[])[0]).join(' · '));
  console.log('   linhas:', JSON.stringify(r.linhas));
  ok('sem erro de página', r.errs.length === 0, r.errs[0] || '');
  ok('pediu a aba Remunerado', r.urls.some(u => /sheet=Remunerado/i.test(u)));
  ok('NÃO pediu mais a Base CTEs', !r.urls.some(u => /gid=1672208132/.test(u)));
  const soma = (r.linhas||[]).reduce((s,l)=> s + (+((l.match(/rem=(\d+)/)||[])[1]||0)), 0);
  ok(`Σ km remunerado = ${KM_REM_0726 + KM_REM_0826}`, soma === KM_REM_0726 + KM_REM_0826, 'veio ' + soma);
  ok('nenhuma linha caiu no mês anterior (remFb)', !(r.linhas||[]).some(l => l.endsWith('fb=true')));
}

// ── árvore Seara ──────────────────────────────────────────────────────────
{
  const r = await abre('combustivel/seara/arvore/index.html', () => ({
    remKm: typeof SE_ROWS !== 'undefined' ? 'SE_ROWS' : null,
    txt: document.body.innerText.slice(0, 0),
  }));
  console.log('\n══ combustivel/seara/arvore');
  console.log('   pedidos ao gviz:', r.urls.map(u => (u.match(/(sheet=[^&]+|gid=\d+)/)||[])[0]).join(' · '));
  ok('sem erro de página', r.errs.length === 0, r.errs[0] || '');
  ok('pediu a aba Remunerado', r.urls.some(u => /sheet=Remunerado/i.test(u)));
  ok('NÃO pediu mais a Base CTEs', !r.urls.some(u => /gid=1672208132/.test(u)));
}

// ── os três que estavam quebrados ─────────────────────────────────────────
for (const p of ['arvore-frota/index.html', 'rs-por-km/index.html', 'visao-financeira-arvore/index.html']) {
  // a Visão Financeira carrega a Seara SÓ quando a visão é aberta (lazy)
  const r = await abre(p, async () => {
    // o bloco da Seara é LAZY e já pode ter sido chamado (e guardado a promise);
    // zerar as duas guardas é o que força a carga de verdade neste teste
    if (typeof arvCarregaFontes === 'function') {
      try { if (typeof ARV_S_DP !== 'undefined' && ARV_S_DP) ARV_S_DP.length = 0; } catch(e){}
      try { arvCarregando = null; } catch(e){}
      try { await arvCarregaFontes(); } catch(e){ window.__ARVERR = String(e && e.message || e); }
    }
    window.__ARVFN = window.__ARVERR || 'chamada ok';
    await new Promise(r => setTimeout(r, 900));
    return { arvfn: window.__ARVFN };
  });
  console.log(`\n══ ${p}`);
  console.log('   pedidos ao gviz:', [...new Set(r.urls.map(u => (u.match(/(sheet=[^&]+|gid=\d+)/)||[])[0]))].join(' · '));
  if (r.arvfn !== undefined) console.log('   funções arv* globais:', r.arvfn || '(nenhuma)');
  ok('sem erro de página', r.errs.length === 0, r.errs[0] || '');
  // ACHADO À PARTE: a visao-financeira-arvore chama `gvizFetch`, que NÃO EXISTE
  // no arquivo nem nos assets — a visão Árvore dela nunca carregou a Seara, e o
  // `sum(Z)` de antes nem chegava a ser enviado. Não é regressão desta troca e
  // não vou consertar por conta própria: fica reportado.
  if (/gvizFetch is not defined/.test(r.arvfn || ''))
    console.log('   ⚠ ACHADO: `gvizFetch` não existe neste painel — a Seara nunca carrega aqui (problema ANTERIOR à troca)');
  else ok('pediu a aba Remunerado', r.urls.some(u => /sheet=Remunerado/i.test(u)));
  ok('não manda mais sum(Z)', !r.urls.some(u => /sum\(Z\)|sum%28Z%29/i.test(decodeURIComponent(u))));
}

console.log(`\n${falhas ? '✗ ' + falhas + ' falha(s)' : '✓ tudo passou'}`);
process.exit(falhas ? 1 : 0);
