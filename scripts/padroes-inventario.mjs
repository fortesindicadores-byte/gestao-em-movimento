// ============================================================
// INVENTÁRIO DOS PAINÉIS — gera a tabela do PADROES.md a partir do código
// (Renan, 10/09/2026: "faça uma varredura em todos os painéis").
//
// Lê cada index.html e diz: casca (padrão novo = .app/.side · antiga =
// .header/.main), tema (claro | light-mode), fontes (workbooks do Sheets por
// apelido, tabelas do Supabase, chaves do ginfo_snapshot), filtros multi-select,
// gráficos (tipos), tabela (dre | tbl-section), exportadores e build.
//
// Uso: node scripts/padroes-inventario.mjs > /tmp/inventario.md
// Não grava nada; só imprime Markdown.
// ============================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const WB = {
  '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8': 'DRE',
  '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM': 'Dispersão',
  '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A': 'Consumo',
  '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o': 'Termômetro',
  '1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY': 'RPM',
  '10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac': 'Termômetro-tiers',
  '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE': 'Seara',
  '1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M': 'Frota de Elite',
  '1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k': 'Manutenção',
  '1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0': 'Tendência',
  '1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8': 'Metas Diretor',
  '1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY': 'Farol Semanal',
};

function paineis(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.') || n === 'node_modules' || n === 'assets' || n === 'docs' || n === 'scripts') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) paineis(p, out);
    else if (n === 'index.html') out.push(p);
  }
  return out;
}

const uniq = a => [...new Set(a)];
const linhas = [];
for (const f of paineis(RAIZ).sort()) {
  const h = readFileSync(f, 'latin1').length ? readFileSync(f, 'utf8') : '';
  const pasta = relative(RAIZ, f).replace(/index\.html$/, '') || '/';
  const titulo = (h.match(/<title>([^<]*)/) || [, ''])[1].replace(/&amp;/g, '&').trim();
  const build = (h.match(/name="build" content="(\d+)"/) || [, '—'])[1];
  // o DriverPro também usa .app, mas é um app próprio (sem lateral nem board)
  const casca = /class="app"/.test(h) && /class="(side|board)/.test(h) ? 'padrão'
              : /class="app"/.test(h) ? 'app próprio'
              : (/class="header"/.test(h) ? 'antiga' : '—');
  const tema = /body\.claro|'claro'/.test(h) ? 'claro' : (/light-mode/.test(h) ? 'light-mode' : '—');
  const sheets = uniq((h.match(/[A-Za-z0-9_-]{44}/g) || []).filter(id => WB[id]).map(id => WB[id]));
  const sb = uniq((h.match(/\.from\('([a-z_]+)'\)/g) || []).map(s => s.replace(/\.from\('|'\)/g, '')))
    .filter(t => t !== 'fca_profiles');
  const rpc = uniq((h.match(/\.rpc\('([a-z_]+)'/g) || []).map(s => s.replace(/\.rpc\('|'/g, '')));
  const ginfo = uniq((h.match(/'(ativos|stress-test-frota|stress-test-empilhadeira|civf|preventivas|alinhamentos|os-em-aberto|checklist-031120|blitz-seguranca)'/g) || []).map(s => s.replace(/'/g, '')));
  const ms = (h.match(/class="ms-wrap"/g) || []).length;
  const charts = uniq((h.match(/type:\s*'(bar|line|doughnut|pie|scatter)'/g) || []).map(s => s.replace(/type:\s*'|'/g, '')));
  const tabela = /table\.dre|class="dre/.test(h) ? 'dre' : (/tbl-section/.test(h) ? 'tbl-section' : '—');
  const exp = [/excel-export\.js/.test(h) ? 'Excel/PNG' : '', /pdf-export\.js/.test(h) ? 'PDF' : '', /sortable-table\.js/.test(h) ? 'ordenação' : ''].filter(Boolean).join(' · ') || '—';
  const fontes = [...sheets.map(s => 'Sheets:' + s), ...sb.map(t => 'sb:' + t), ...rpc.map(r => 'rpc:' + r), ...ginfo.map(g => 'ginfo:' + g)];
  linhas.push({ pasta, titulo, casca, tema, fontes: fontes.join(', ') || '—', ms, charts: charts.join('+') || '—', tabela, exp, build });
}

console.log('| Pasta | Título | Casca | Tema | Fontes | Filtros | Gráficos | Tabela | Exporta | Build |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const l of linhas) console.log(`| \`${l.pasta}\` | ${l.titulo} | ${l.casca} | ${l.tema} | ${l.fontes} | ${l.ms} | ${l.charts} | ${l.tabela} | ${l.exp} | ${l.build} |`);
console.error(`${linhas.length} painéis · ${linhas.filter(l => l.casca === 'padrão').length} na casca padrão · ${linhas.filter(l => l.casca === 'antiga').length} na antiga`);
