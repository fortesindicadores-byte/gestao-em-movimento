// ============================================================
// DUMP CIFRADO PARA ANÁLISE (só leitura)
//
// Lê do banco o que a análise do Freightech precisa cruzar e grava em
// /tmp/analise-dump/*.ndjson.gz, uma linha JSON por registro:
//   ft-<CANAL>   — ft_linha inteira do canal ({t,v,l,u,p,d}), com os rótulos
//                  de cada tabela × vigência em ft-layout
//   sh-<slug>    — as abas do Sheets no banco (DRE Frota, Receita, Dispersão
//                  de km, Km/L, R$/L), com os rótulos de sh_base.colunas
//   tb-<tabela>  — tabelas do portal (dispersao_km, balanco_massa) e os
//                  Ativos do Ginfo
// O workflow cifra tudo com a chave PÚBLICA de scripts/analise-dump.pub.pem
// antes de publicar (o repositório é público): só quem tem a chave privada lê.
// Nada vai para o log além de contagens.
// ============================================================
import fs from 'node:fs';
import zlib from 'node:zlib';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const OUT = process.env.DUMP_DIR || '/tmp/analise-dump';
fs.mkdirSync(OUT, { recursive: true });
// DUMP_SO=dre (input `so` do workflow): só as três abas do DRE (Frota, Receita,
// EBITDA), para conferir um export do ERP sem carregar o Freightech inteiro.
const SO = (process.env.DUMP_SO || '').trim().toLowerCase();
const SO_DRE = SO === 'dre';
// DUMP_SO=km: só o que explica o km remunerado mês a mês (Dispersão de km da aba e
// do banco, placas e viagens, balanço de massa, DRE Frota, Km/L e o FT de ago/26 em diante)
const SO_KM = SO === 'km';
// DUMP_SO=comb: as tabelas de combustível do FT desde 2025 (preço pago, ANP e preço
// com crédito de imposto), o DRE Frota do banco e o balanço de massa, para medir o
// crédito de imposto que o FT desconta no diesel
const SO_COMB = SO === 'comb';
// DUMP_SO=mix: o cadastro de caminhão e van da Rota e do AS em 2026 (ativo, Km/L e
// modelo por placa e quinzena), o Resumo, o Km/L automático, a Dispersão e o DRE Frota,
// para medir quanto a escolha das placas ativas mexeu no Km/L remunerado
const SO_MIX = SO === 'mix';
// DUMP_SO=manut: os lançamentos de manutenção por placa (aba Manutenção), o cadastro
// das vans no FT (Van e ResumoVan, todas as quinzenas), o Km/L e os Ativos do Ginfo,
// para montar o R$/km de manutenção das vans pela idade do veículo
const SO_MANUT = SO === 'manut';
const FT_MIX = ['Caminhao', 'Van', 'CaminhaoAS', 'Resumo', 'ResumoVan', 'ResumoAS', 'ParametrosGeraisRota', 'CombustivelRota', 'CombustivelListaAS'];
const FT_COMB = ['CombustivelEmpurrada', 'CombustivelInsumos', 'CombustivelRota', 'CombustivelListaAS', 'Combustivel', 'CombustivelAS'];
console.log('recorte:', SO || 'tudo');

async function rest(q) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: H });
    if (r.ok) return r.json();
    if (t >= 4 || r.status < 500) throw new Error(`${r.status} ${q.split('?')[0]} ${(await r.text()).slice(0, 160)}`);
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}
async function tudo(tabela, order, filtro = '', sel = '*') {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const p = await rest(`${tabela}?select=${sel}${filtro}&order=${order}&offset=${off}&limit=1000`);
    out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
}
function grava(nome, linhas) {
  const gz = zlib.gzipSync(linhas.map(x => JSON.stringify(x)).join('\n') + '\n', { level: 9 });
  fs.writeFileSync(`${OUT}/${nome}.ndjson.gz`, gz);
  console.log(`${nome}: ${linhas.length} registro(s) · ${(gz.length / 1048576).toFixed(1)} MB`);
}
async function emParalelo(itens, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < itens.length) { const k = i++; await fn(itens[k], k); } }));
}

// ── 1) Freightech ──
const layout = SO_DRE ? [] : SO_MANUT ? await tudo('ft_layout', 'canal,tabela,vigencia', '&canal=eq.ROTA&tabela=in.(Van,ResumoVan)')
  : false ? [] : await tudo('ft_layout', 'canal,tabela,vigencia', SO_KM ? '&ano=eq.2026&mes=gte.8'
  : SO_COMB ? `&ano=gte.2025&tabela=in.(${FT_COMB.join(',')})`
  : SO_MIX ? `&ano=eq.2026&canal=in.(ROTA,AS)&tabela=in.(${FT_MIX.join(',')})` : '');
if (!SO_DRE)
grava('ft-layout', layout.map(({ canal, tabela, vigencia, tabela_nome, ano, mes, quinzena, colunas, linhas, carregado_em }) =>
  ({ canal, tabela, vigencia, tabela_nome, ano, mes, quinzena, colunas, linhas, carregado_em })));
const canais = [...new Set(layout.map(x => x.canal))];
for (const canal of canais) {
  const ls = layout.filter(x => x.canal === canal);
  const partes = new Array(ls.length);
  await emParalelo(ls, 8, async (l, k) => {
    const f = `&canal=eq.${encodeURIComponent(canal)}&tabela=eq.${encodeURIComponent(l.tabela)}&vigencia=eq.${encodeURIComponent(l.vigencia)}`;
    const rows = await tudo('ft_linha', 'linha', f);
    partes[k] = rows.map(r => ({ t: r.tabela, v: r.vigencia, l: r.linha, u: r.unidade, p: r.placa, d: r.dados }));
  });
  grava(`ft-${canal}`, partes.flat());
}

// ── 2) abas do Sheets no banco ──
const SLUGS = SO_MANUT ? ['manutencao', 'consumo_km_litro']
  : SO_DRE ? ['dre_frota', 'dre_receita', 'dre_ebitda']
  : SO_KM ? ['dre_frota', 'dispersao_km', 'consumo_km_litro']
  : SO_COMB ? ['dre_frota']
  : SO_MIX ? ['dre_frota', 'dispersao_km', 'consumo_km_litro']
  : ['dre_frota', 'dre_receita', 'dre_ebitda', 'dispersao_km', 'consumo_km_litro', 'consumo_rs_litro', 'consumo_rem_modelo'];
for (const slug of SLUGS) {
  try {
    const [b] = await rest(`sh_base?select=slug,colunas,linhas,carregado_em,erro&slug=eq.${slug}`);
    const rows = await tudo(`sh_${slug}`, 'linha.asc');
    grava(`sh-${slug}`, [{ _base: b }, ...rows]);
  } catch (e) { console.log(`sh_${slug}: falhou (${e.message})`); }
}

// ── 3) tabelas do portal ──
if (SO_DRE) { console.log('só o DRE: Freightech e tabelas do portal ficaram fora'); process.exit(0); }
if (SO_MANUT) {
  try { grava('tb-ginfo-ativos', await tudo('ginfo_snapshot', 'chave', '&chave=eq.ativos')); } catch (e) { console.log(`ativos: falhou (${e.message})`); }
  console.log('recorte manut: o resto ficou fora'); process.exit(0);
}
if (SO_MIX) {
  for (const [t, o] of [['dispersao_km', 'vigencia,unidade,projeto'], ['balanco_massa', 'vigencia,unidade,projeto,conta'], ['ca_dre_frota', 'vigencia,linha'],
    ['ca_consumo_km_litro', 'vigencia,linha'], ['consumo_auto_base', 'slug']]) {
    try { grava(`tb-${t}`, await tudo(t, o)); } catch (e) { console.log(`${t}: falhou (${e.message})`); }
  }
  console.log('recorte mix: o resto ficou fora'); process.exit(0);
}
if (SO_COMB) {
  for (const [t, o] of [['balanco_massa', 'vigencia,unidade,projeto,conta'], ['ca_dre_frota', 'vigencia,linha']]) {
    try { grava(`tb-${t}`, await tudo(t, o)); } catch (e) { console.log(`${t}: falhou (${e.message})`); }
  }
  console.log('recorte comb: o resto ficou fora'); process.exit(0);
}
if (SO_KM) {
  for (const [t, o] of [['dispersao_km', 'vigencia'], ['dispersao_placa', 'vigencia'], ['dispersao_placa_viagem', 'vigencia'], ['balanco_massa', 'vigencia'],
    ['consumo_auto_base', 'slug'], ['ca_dre_frota', 'linha'], ['ca_consumo_km_litro', 'linha']]) {
    try { grava(`tb-${t}`, await tudo(t, o)); } catch (e) { console.log(`${t}: falhou (${e.message})`); }
  }
  console.log('recorte km: o resto ficou fora'); process.exit(0);
}
for (const [t, o] of [['dispersao_km', 'vigencia'], ['balanco_massa', 'vigencia'], ['dispersao_placa_viagem', 'vigencia']]) {
  try { grava(`tb-${t}`, await tudo(t, o)); } catch (e) { console.log(`${t}: falhou (${e.message})`); }
}
// o que a VW cobra por placa, o contrato por placa da Carta, o diesel que pagamos
// (ERP, só encerradas) e as paradas por placa, para cruzar com o FT em 2026
const EXTRA = [
  ['vw_contrato_km', 'vigencia,contrato,chassi', '&vigencia=gte.2025-01', 'contrato,vigencia,chassi,placa,km_anterior,km_atual,faixa,km_rodado,valor'],
  ['custo_vigencia_mv', 'placa', '&vig_km=gte.2025-01', '*'],
  ['erp_abastecimentos', 'data,ordem_servico', '&encerrada=eq.S&data=gte.2025-01-01', 'data,placa,filial,projeto_os,litros,valor,tipo_combustivel'],
  ['indisponibilidade', 'data_parada', '&or=(data_retorno.is.null,data_retorno.gte.2025-12-01)', 'unidade,projeto,placa,modelo,grupo,local_manutencao,data_parada,previsao_retorno,data_retorno,status'],
  ['pneu_preco', 'medida', '', '*'],
];
for (const [t, o, f, s] of EXTRA) {
  try { grava(`tb-${t}`, await tudo(t, o, f, s)); } catch (e) { console.log(`${t}: falhou (${e.message})`); }
}
try {
  const [gs] = await rest('ginfo_snapshot?chave=eq.ativos&select=data,updated_at');
  grava('tb-ginfo-ativos', [{ _updated_at: gs.updated_at }, ...gs.data]);
} catch (e) { console.log(`ginfo ativos: falhou (${e.message})`); }
