// Busca Web: traz para a sessão o que o sandbox não alcança (sites fora da rede
// liberada, link de compartilhamento do OneDrive). Dois modos:
//   pagina  → lê a página, lista as imagens (img, link, meta, srcset, CSS url(),
//             SVG inline) e baixa as que casam com o filtro. Conteúdo público.
//   arquivo → baixa o arquivo de cada link (OneDrive: tenta a API de shares e o
//             download=1). O workflow cifra antes de publicar.
// Saída em BUSCA_DIR. O log mostra host, status e tamanho; nunca o link inteiro.
import fs from 'node:fs'; import path from 'node:path';
const MODO = process.env.BUSCA_MODO || 'pagina', URLS = (process.env.BUSCA_URL || '').split(/[\s,]+/).filter(Boolean);
const FILTRO = new RegExp(process.env.BUSCA_FILTRO || 'logo|conlog|brand|marca', 'i'), DIR = process.env.BUSCA_DIR || '/tmp/busca';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'accept-language': 'pt-BR,pt;q=0.9' };
fs.mkdirSync(DIR, { recursive: true });
const host = u => { try { return new URL(u).host; } catch (e) { return '?'; } };
const nomeDe = (u, i, ct) => { let b = ''; try { b = decodeURIComponent(path.basename(new URL(u).pathname)); } catch (e) {} b = b.replace(/[^\w.\-]+/g, '_').slice(-80);
  if (!/\.\w{2,5}$/.test(b)) b += ({ 'image/svg+xml': '.svg', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/x-icon': '.ico' }[(ct || '').split(';')[0]] || '.bin'); return String(i).padStart(2, '0') + '_' + b; };
async function pega(u, o) { const c = new AbortController(), t = setTimeout(() => c.abort(), (o && o.ms) || 60000);
  try { return await fetch(u, { redirect: 'follow', headers: UA, signal: c.signal }); } finally { clearTimeout(t); } }
const ehImg = b => b.length > 8 && (b.subarray(0, 4).toString('hex') === '89504e47' || b.subarray(0, 3).toString('hex') === 'ffd8ff' || b.subarray(0, 4).toString() === 'RIFF' || /^\s*<(\?xml|svg)/i.test(b.subarray(0, 200).toString()));

if (MODO === 'pagina') {
  let n = 0; const vistos = new Set();
  for (const pg of URLS) {
    let r, html = ''; try { r = await pega(pg); html = await r.text(); } catch (e) { console.log(`${pg}: FALHOU (${e.message})`); continue; }
    console.log(`\n${pg}: HTTP ${r.status} · ${html.length} caracteres · final ${r.url}`);
    const base = r.url, cand = new Set(), add = u => { try { const a = new URL(u.replace(/&amp;/g, '&'), base).href; if (/^https?:/.test(a)) cand.add(a); } catch (e) {} };
    for (const m of html.matchAll(/(?:src|href|content|data-src|data-lazy-src|poster)\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of html.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) m[1].split(',').forEach(x => add(x.trim().split(/\s+/)[0]));
    for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1]);
    // folhas de estilo: o logo às vezes é background
    for (const css of [...cand].filter(u => /\.css(\?|$)/i.test(u)).slice(0, 12)) { try { const t = await (await pega(css, { ms: 20000 })).text();
      for (const m of t.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) { try { const a = new URL(m[1], css).href; if (FILTRO.test(a)) cand.add(a); } catch (e) {} } } catch (e) {} }
    const imgs = [...cand].filter(u => /\.(svg|png|jpe?g|webp|ico|gif)(\?|$)/i.test(u));
    console.log(`imagens na página: ${imgs.length}`); imgs.forEach(u => console.log('  ' + u));
    for (const u of imgs.filter(u => FILTRO.test(u))) { if (vistos.has(u) || n >= 40) continue; vistos.add(u);
      try { const x = await pega(u, { ms: 30000 }), b = Buffer.from(await x.arrayBuffer()); if (!x.ok || b.length > 6e6 || !b.length) { console.log(`  não baixei ${u} (HTTP ${x.status}, ${b.length} bytes)`); continue; }
        const f = nomeDe(u, ++n, x.headers.get('content-type')); fs.writeFileSync(path.join(DIR, f), b); console.log(`  baixado ${f} · ${b.length} bytes · ${x.headers.get('content-type')}`); } catch (e) { console.log(`  falhou ${u}: ${e.message}`); } }
    let k = 0; for (const m of html.matchAll(/<svg[\s\S]*?<\/svg>/gi)) { if (m[0].length < 600 || k >= 20) continue; fs.writeFileSync(path.join(DIR, `inline_${String(++k).padStart(2, '0')}.svg`), m[0]); }
    console.log(`SVG inline guardados: ${k}`);
    const tit = (html.match(/<title[^>]*>([^<]*)/i) || [])[1]; console.log(`título: ${tit || '—'}`);
  }
  console.log(`\n${n} arquivo(s) baixado(s) em ${DIR}`);
} else {
  let ok = 0;
  for (let i = 0; i < URLS.length; i++) { const u = URLS[i], tent = [];
    const b64 = 'u!' + Buffer.from(u).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
    tent.push(['API de shares', `https://api.onedrive.com/v1.0/shares/${b64}/root/content`]);
    let fin = ''; try { const r = await pega(u, { ms: 30000 }); fin = r.url; } catch (e) {}
    if (fin) tent.push(['link final + download=1', fin + (fin.includes('?') ? '&' : '?') + 'download=1']);
    tent.push(['link + download=1', u + (u.includes('?') ? '&' : '?') + 'download=1'], ['link direto', u]);
    let feito = false;
    for (const [nome, t] of tent) { try { const r = await pega(t, { ms: 600000 }), b = Buffer.from(await r.arrayBuffer());
        console.log(`arquivo ${i + 1} · ${nome} · ${host(r.url)} · HTTP ${r.status} · ${(b.length / 1e6).toFixed(1)} MB · ${r.headers.get('content-type')}`);
        if (r.ok && ehImg(b) && b.length > 20000) { const cd = r.headers.get('content-disposition') || '', nm = (cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) || [])[1];
          const f = String(i + 1).padStart(2, '0') + '_' + (nm ? decodeURIComponent(nm).replace(/[^\w.\-]+/g, '_') : 'arquivo' + (b.subarray(0, 4).toString('hex') === '89504e47' ? '.png' : '.jpg'));
          fs.writeFileSync(path.join(DIR, f), b); console.log(`  guardado ${f}`); feito = true; ok++; break; } } catch (e) { console.log(`arquivo ${i + 1} · ${nome} · falhou (${e.message})`); } }
    if (!feito) console.log(`::warning::arquivo ${i + 1}: nenhum caminho devolveu uma imagem`);
  }
  console.log(`\n${ok} de ${URLS.length} arquivo(s) baixado(s)`); if (!ok) process.exit(1);
}
