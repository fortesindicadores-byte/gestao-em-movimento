// ============================================================
// Catálogo de aplicação — consolida a PESQUISA em linhas planas
//
// Entrada: docs/catalogo/pesquisa/raw/*.json
//   r1-*.json  → 1ª rodada (out/2026), cada agente com o próprio formato
//                (objeto por modelo, folhas {valor,status,fonte,nota})
//   r2-*.json  → 2ª rodada, já no formato plano (array de linhas)
// Saída:  docs/catalogo/aplicacoes.json — UMA linha por modelo × item, no
//         formato da tabela cat_aplicacao (é o que a carga manda ao banco e o
//         que o painel usa de reserva quando o banco não responde).
//
// Regras que valem para as duas rodadas:
//  · o modelo é a chave do CADASTRO ("MARCA | MODELO", como está no Ginfo);
//    pesquisa que não casa com nenhum modelo do cadastro é listada no fim e
//    NÃO entra — não se inventa vínculo;
//  · status: confirmado > inferido > nao_encontrado; quando a mesma chave
//    (modelo × sistema × item × anos) vem de duas rodadas, fica a de melhor
//    status e a outra vira nota;
//  · uma linha "nao_encontrado" É informação: é o que o painel mostra como
//    lacuna ("ninguém achou o volume do cárter") — não se descarta.
//
// Uso: node scripts/catalogo-consolida.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const RAW = 'docs/catalogo/pesquisa/raw';
const OUT = 'docs/catalogo/aplicacoes.json';
const CAD = JSON.parse(fs.readFileSync('docs/catalogo/pesquisa/modelos-cadastro.json', 'utf8'));
const MODELOS = [...CAD.mot, ...CAD.nao].map(m => m.modelo);       // "MARCA | MODELO"
const PESO = { confirmado: 3, inferido: 2, nao_encontrado: 1, nao_aplica: 1 };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// ── modelo da pesquisa → modelo do cadastro ─────────────────────────────────
// A 1ª rodada escreveu o modelo "à mão" ("VW 13.180 (Delivery 13.180)") e
// alguns agentes agruparam vários cadastros num objeto só. Este mapa resolve
// os agrupamentos EXPLÍCITOS do texto; o resto casa pelo nome sem parêntese.
const MAPA_R1 = {
  'RANDOM SR FG (RANDON SEMIRREBOQUE FURGAO)': ['RANDON | RANDOM SR FG'],
  'TRUCKVAN / BOVENAU / DEMAIS SEMIRREBOQUES DA CATEGORIA': [
    'TRUCKVAN | SR/TRUCKVAN CF 2E ROLETADO', 'TRUCKVAN | SR/TRUCKVAN CFE 3ED', 'TRUCKVAN | SR/EQUIP NEXT 3E CF',
    'NEXT | SR/EQUIP NEXT 3E CF', 'RODOFORT | SRFG 3ED',
    'RANDON | SR FG LO 3ED', 'RANDON | SR/RANDON SRFG LO', 'RANDON | RANDONSP SRFG SI 3E'],
  'TM2500 (TOLEDO (CADASTRO) / PALETRANS (FABRICANTE REAL))': ['TOLEDO | TM2500'],
  'BYG (GENERICO) E BYG L2.6': ['BYG | BYG', 'BYG | BYG L2.6', 'BYG | PALETEIRA MANUAL BYG'],
  'ALLDEALS (SEM MODELO)': ['ALLDEALS | ALLDEALS'],
  'TM2220 (CADASTRO DISKTRANS) E TM 2220 (CADASTRO PALETRANS)': ['DISKTRANS | TM2220', 'PALETRANS | TM 2220'],
  'PALETEIRA MANUAL TRANSPOTECH 1150X685MM': ['FERPLUS | PALETEIRA MANUAL TRANSPOTECH 1150X685MM BOMBA PRATA'],
};
// os "genéricos da categoria" entram rebaixados: valem como pista, não como ficha
const GENERICOS = new Set(MAPA_R1['TRUCKVAN / BOVENAU / DEMAIS SEMIRREBOQUES DA CATEGORIA']);

const semParentese = s => s.replace(/\s*\(.*$/, '').trim();
const naoMapeados = new Set();
function cadastroDe(modeloPesq, marcaPesq) {
  const k = norm(modeloPesq);
  if (MAPA_R1[k]) return MAPA_R1[k];
  const exato = MODELOS.find(m => norm(m) === k);          // 2ª rodada já escreve "MARCA | MODELO"
  if (exato) return [exato];
  const alvo = norm(semParentese(modeloPesq));
  const achados = MODELOS.filter(m => norm(m.split(' | ')[1]) === alvo);
  if (achados.length === 1) return achados;
  if (achados.length > 1) {                        // mesmo nome em duas marcas: decide a marca
    const porMarca = achados.filter(m => norm(m.split(' | ')[0]) === norm(marcaPesq));
    if (porMarca.length) return porMarca;
  }
  naoMapeados.add(modeloPesq);
  return [];
}

// ── folhas da 1ª rodada → linhas ────────────────────────────────────────────
const folha = (o, ...ks) => { let x = o; for (const k of ks) x = x && x[k]; return x && typeof x === 'object' && 'status' in x ? x : null; };
const val = f => (f ? (f.valor !== undefined ? f.valor : f.value) : null);
const txt = v => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)).trim();
const uniq = a => [...new Set(a.filter(Boolean))];

// Junta várias folhas numa linha: a especificação é a concatenação das folhas
// de TEXTO; a quantidade vem da folha de volume; o status é o PIOR entre as
// folhas de texto que trouxeram valor (confirmado só se todas confirmaram).
function linha(modelo, anos, sistema, item, partes, extra = {}) {
  const texto = partes.filter(p => p && p.folha && !p.qtd);
  const qtds  = partes.filter(p => p && p.folha && p.qtd);
  const comValor = texto.filter(p => txt(val(p.folha)) !== '' && p.folha.status !== 'nao_aplica');
  const todasNA = texto.length && texto.every(p => p.folha.status === 'nao_aplica');
  let status = 'nao_encontrado';
  if (todasNA) status = 'nao_aplica';
  else if (comValor.length) status = comValor.every(p => p.folha.status === 'confirmado') ? 'confirmado'
                                   : comValor.some(p => p.folha.status === 'confirmado' || p.folha.status === 'inferido') ? 'inferido' : 'nao_encontrado';
  const espec = comValor.map(p => (p.rotulo ? p.rotulo + ': ' : '') + txt(val(p.folha))).join(' · ') || null;
  const q = qtds.map(p => txt(val(p.folha))).find(Boolean) || null;
  const notas = uniq(partes.filter(Boolean).map(p => p.folha && p.folha.nota).map(txt));
  qtds.forEach(p => { if (!txt(val(p.folha)) && p.folha.status === 'nao_encontrado') notas.unshift('volume/quantidade: não encontrado'); });
  const fontes = uniq(partes.filter(Boolean).map(p => p.folha && p.folha.fonte).map(txt));
  return { modelo, anos, sistema, item, especificacao: espec, quantidade: q, unidade: q ? (extra.unidade || 'L') : null,
           intervalo: extra.intervalo || null, codigo_ref: null, status, fonte: fontes.join(' ; ') || null,
           nota: uniq(notas).join(' | ') || null, rodada: 1, ...extra.sobre };
}

function r1Caminhao(m, modelo) {
  const anos = Array.isArray(m.anos) && m.anos.length ? [Math.min(...m.anos.filter(Number)), Math.max(...m.anos.filter(Number))] : null;
  const F = (...k) => folha(m, ...k);
  const iv = k => txt(val(F('intervalos', k))) || null;
  const L = [];
  const ident = [['Motor', F('motor')], ['Cilindrada', F('cilindrada')], ['Potência', F('potencia')], ['Versão', F('versao')], ['Tanques', F('tanques')], ['Velocidade máxima', F('velocidade_max')]];
  ident.forEach(([item, f]) => f && L.push(linha(modelo, anos, 'Identificação', item, [{ folha: f }])));
  L.push(linha(modelo, anos, 'Motor', 'Óleo de motor',
    [{ folha: F('oleo_motor', 'viscosidade') }, { folha: F('oleo_motor', 'norma') }, { folha: F('oleo_motor', 'base'), rotulo: 'base' }, { folha: F('oleo_motor', 'volume_l'), qtd: true }],
    { intervalo: iv('oleo_motor') }));
  L.push(linha(modelo, anos, 'Transmissão', 'Óleo de câmbio',
    [{ folha: F('oleo_cambio', 'tipo') }, { folha: F('oleo_cambio', 'norma') }, { folha: F('oleo_cambio', 'automatizado'), rotulo: 'acionamento' }, { folha: F('oleo_cambio', 'tipo_cambio'), rotulo: 'câmbio' }, { folha: F('oleo_cambio', 'volume_l'), qtd: true }],
    { intervalo: iv('oleo_cambio') }));
  const dif = F('oleo_diferencial') ? [{ folha: F('oleo_diferencial') }] : [{ folha: F('oleo_diferencial', 'tipo') }, { folha: F('oleo_diferencial', 'norma') }, { folha: F('oleo_diferencial', 'volume_l'), qtd: true }];
  L.push(linha(modelo, anos, 'Eixo/Diferencial', 'Óleo de diferencial', dif));
  L.push(linha(modelo, anos, 'Freios', 'Fluido de freio', [{ folha: F('fluido_freio') }]));
  const arr = F('arrefecimento') ? [{ folha: F('arrefecimento') }] : [{ folha: F('arrefecimento', 'tipo') }, { folha: F('arrefecimento', 'volume_l'), qtd: true }];
  L.push(linha(modelo, anos, 'Arrefecimento', 'Líquido de arrefecimento', arr));
  L.push(linha(modelo, anos, 'Pós-tratamento', 'Arla 32', [{ folha: F('arla') }]));
  const filtros = [['Motor', 'Filtro de óleo', 'oleo'], ['Combustível', 'Filtro de combustível', 'combustivel'], ['Combustível', 'Filtro separador de água', 'separador_agua'],
    ['Admissão de ar', 'Filtro de ar do motor', 'ar_motor'], ['Cabine', 'Filtro de cabine', 'ar_cabine'], ['Freios', 'Cartucho do secador de ar', 'secador_ar'],
    ['Pós-tratamento', 'Filtro de ureia', 'arla'], ['Direção', 'Filtro da direção hidráulica', 'hidraulico_direcao']];
  filtros.forEach(([sis, item, k]) => F('filtros', k) && L.push(linha(modelo, anos, sis, item, [{ folha: F('filtros', k) }], { intervalo: iv('filtros') })));
  L.push(linha(modelo, anos, 'Motor', 'Correia', [{ folha: F('correia') }]));
  const bat = F('bateria') ? [{ folha: F('bateria') }] : [{ folha: F('bateria', 'tensao'), rotulo: 'tensão' }, { folha: F('bateria', 'capacidade'), rotulo: 'capacidade' }, { folha: F('bateria', 'cca'), rotulo: 'CCA' }];
  L.push(linha(modelo, anos, 'Elétrica', 'Bateria', bat));
  L.push(linha(modelo, anos, 'Rodas/Pneus', 'Pneu', [{ folha: F('pneu') }]));
  if (F('intervalos')) L.push(linha(modelo, anos, 'Manutenção', 'Plano de revisão', [{ folha: F('intervalos') }]));
  return L;
}

function r1Empilhadeira(m, modelo) {
  const anos = Array.isArray(m.anos) && m.anos.filter(Number).length ? [Math.min(...m.anos.filter(Number)), Math.max(...m.anos.filter(Number))] : null;
  const F = (...k) => folha(m, ...k);
  const L = [];
  L.push(linha(modelo, anos, 'Identificação', 'Motor', [{ folha: F('motor', 'fabricante_codigo') }, { folha: F('motor', 'combustivel'), rotulo: 'combustível' }]));
  const om = F('oleo_motor') ? [{ folha: F('oleo_motor') }] : [{ folha: F('oleo_motor', 'viscosidade') }, { folha: F('oleo_motor', 'norma_api') }, { folha: F('oleo_motor', 'base'), rotulo: 'base' }, { folha: F('oleo_motor', 'volume_litros'), qtd: true }];
  L.push(linha(modelo, anos, 'Motor', 'Óleo de motor', om));
  L.push(linha(modelo, anos, 'Hidráulico', 'Óleo hidráulico', [{ folha: F('oleo_hidraulico', 'tipo_iso_vg') }, { folha: F('oleo_hidraulico', 'norma') }, { folha: F('oleo_hidraulico', 'volume_litros'), qtd: true }]));
  L.push(linha(modelo, anos, 'Transmissão', 'Óleo de transmissão', [{ folha: F('oleo_transmissao', 'tipo') }, { folha: F('oleo_transmissao', 'volume_litros'), qtd: true }]));
  if (F('oleo_transmissao', 'diferencial_eixo')) L.push(linha(modelo, anos, 'Eixo/Diferencial', 'Óleo de diferencial', [{ folha: F('oleo_transmissao', 'diferencial_eixo') }]));
  const eletrica = /ELETRIC/.test(norm(m.tipo || m.propulsao));
  L.push(linha(modelo, anos, 'Elétrica/Bateria', eletrica ? 'Bateria de tração' : 'Bateria',
    [{ folha: F('bateria', 'tensao'), rotulo: 'tensão' }, { folha: F('bateria', 'capacidade_ah'), rotulo: 'capacidade' }, { folha: F('bateria', 'tipo'), rotulo: 'tipo' }, { folha: F('bateria', 'n_celulas'), rotulo: 'células' }]));
  [['Motor', 'Filtro de óleo', 'oleo'], ['Admissão de ar', 'Filtro de ar do motor', 'ar_motor'], ['Hidráulico', 'Filtro hidráulico', 'hidraulico'], ['Combustível/GLP', 'Filtro de GLP', 'glp']]
    .forEach(([sis, item, k]) => F('filtros', k) && L.push(linha(modelo, anos, sis, item, [{ folha: F('filtros', k) }])));
  if (F('vela', 'tipo') || F('vela', 'quantidade')) L.push(linha(modelo, anos, 'Motor', 'Vela de ignição', [{ folha: F('vela', 'tipo') }, { folha: F('vela', 'quantidade'), rotulo: 'quantidade' }]));
  const arr = F('arrefecimento') ? [{ folha: F('arrefecimento') }] : [{ folha: F('arrefecimento', 'tipo') }, { folha: F('arrefecimento', 'volume_litros'), qtd: true }];
  L.push(linha(modelo, anos, 'Arrefecimento', 'Líquido de arrefecimento', arr));
  if (F('pneu', 'dianteiro')) L.push(linha(modelo, anos, 'Rodas/Pneus', 'Pneu dianteiro', [{ folha: F('pneu', 'dianteiro') }, { folha: F('pneu', 'tipo'), rotulo: 'tipo' }]));
  if (F('pneu', 'traseiro')) L.push(linha(modelo, anos, 'Rodas/Pneus', 'Pneu traseiro', [{ folha: F('pneu', 'traseiro') }, { folha: F('pneu', 'tipo'), rotulo: 'tipo' }]));
  [['Garfos', 'garfos'], ['Corrente de elevação', 'corrente_passo'], ['Roletes da torre', 'roletes']]
    .forEach(([item, k]) => F('garfos_corrente_roletes', k) && L.push(linha(modelo, anos, 'Elevação (torre)', item, [{ folha: F('garfos_corrente_roletes', k) }])));
  if (F('intervalos_horas')) L.push(linha(modelo, anos, 'Manutenção', 'Plano de revisão', [{ folha: F('intervalos_horas') }]));
  return L;
}

// implementos e paleteiras: cada campo vira um item com rótulo legível
const ROT_IMPL = {
  tipo_implemento: ['Identificação', 'Tipo de implemento'], suspensao: ['Suspensão', 'Suspensão'], numero_eixos: ['Identificação', 'Número de eixos'],
  eixo: ['Eixo/Diferencial', 'Eixo'], marca_eixo: ['Eixo/Diferencial', 'Marca do eixo'], freio: ['Freios', 'Sistema de freio'], lonas_sapatas: ['Freios', 'Lona de freio'],
  tambor: ['Freios', 'Tambor de freio'], catraca: ['Freios', 'Catraca (ajustador de folga)'], cuica: ['Freios', 'Cuíca de freio'], rolamento_cubo: ['Rodas/Pneus', 'Rolamento do cubo'],
  retentor_cubo: ['Rodas/Pneus', 'Retentor do cubo'], graxa: ['Rodas/Pneus', 'Graxa do cubo'], intervalo_graxa_cubo: ['Manutenção', 'Intervalo da graxa do cubo'],
  pneu: ['Rodas/Pneus', 'Pneu'], roda: ['Rodas/Pneus', 'Roda'], posicoes_pneu: ['Rodas/Pneus', 'Posições de pneu'], sistema_eletrico: ['Elétrica', 'Sistema elétrico'],
  plugue: ['Elétrica', 'Tomada/plugue'], pino_rei: ['Engate', 'Pino rei'], patolas_pe_apoio: ['Engate', 'Pé de apoio (patola)'], valvulas_pneumaticas: ['Freios', 'Válvulas pneumáticas'],
  mangueiras_engates: ['Freios', 'Mangueiras e engates'], carroceria: ['Carroceria', 'Carroceria'], intervalos_manutencao: ['Manutenção', 'Plano de revisão'],
  truckvan_perfil: ['Identificação', 'Perfil (Truckvan)'], truckvan_suspensao: ['Suspensão', 'Suspensão (Truckvan)'], truckvan_carroceria: ['Carroceria', 'Carroceria (Truckvan)'],
  bovenau_como_semirreboque: ['Identificação', 'Observação de cadastro'], especificacoes_comuns: ['Identificação', 'Especificações comuns da categoria'],
  fabricante_real: ['Identificação', 'Fabricante real'], capacidade: ['Identificação', 'Capacidade'], garfos: ['Elevação (torre)', 'Garfos'], dimensoes_gerais: ['Identificação', 'Dimensões'],
  oleo_hidraulico: ['Hidráulico', 'Óleo hidráulico'], rodas: ['Rodas/Pneus', 'Rodas'], roda_carga_medida: ['Rodas/Pneus', 'Roda de carga'], rolamento: ['Rodas/Pneus', 'Rolamento'],
  kit_reparo_bomba: ['Hidráulico', 'Kit de reparo da bomba'], bomba_completa: ['Hidráulico', 'Bomba hidráulica'], eixos_garfos_timao: ['Estrutura', 'Eixos, garfos e timão'],
  identificacao: ['Identificação', 'Identificação'], acabamento_chassi: ['Estrutura', 'Acabamento do chassi'], categoria_correta: ['Identificação', 'Categoria correta'],
  elevacao: ['Elevação (torre)', 'Elevação'], celula_de_carga: ['Pesagem', 'Célula de carga'], indicador_peso: ['Pesagem', 'Indicador de peso'], bateria_indicador: ['Pesagem', 'Bateria do indicador'],
  cabo: ['Pesagem', 'Cabo'], certificacao: ['Pesagem', 'Certificação metrológica'], roda_medidas: ['Rodas/Pneus', 'Medidas das rodas'], construcao: ['Estrutura', 'Construção'],
  capacidade_pesagem: ['Pesagem', 'Capacidade de pesagem'], capacidade_mecanica: ['Identificação', 'Capacidade mecânica'], existe_versao_ex: ['Identificação', 'Versão EX'],
  dimensoes_exemplo_mtp30: ['Identificação', 'Dimensões (exemplo MTP-30)'], engate_ar_pressao: ['Hidráulico', 'Pressão do engate de ar'], tipo_engate: ['Hidráulico', 'Tipo de engate'],
  kit_reparo: ['Hidráulico', 'Kit de reparo'],
};
function r1Implemento(m, modelo, generico) {
  const anos = Array.isArray(m.anos) && m.anos.filter(Number).length ? [Math.min(...m.anos.filter(Number)), Math.max(...m.anos.filter(Number))] : null;
  const L = [];
  for (const [k, f] of Object.entries(m.campos || {})) {
    if (!f || typeof f !== 'object' || !('status' in f)) continue;
    const [sis, item] = ROT_IMPL[k] || ['Outros', k];
    const l = linha(modelo, anos, sis, item, [{ folha: f }]);
    if (generico) { if (l.status === 'confirmado') l.status = 'inferido'; l.nota = '[genérico da categoria semirreboque — não é ficha deste modelo] ' + (l.nota || ''); }
    L.push(l);
  }
  return L;
}

// ── vocabulário canônico: as rodadas chamaram a mesma coisa por nomes diferentes ──
const ITEM_CANON = {
  'filtro de ar primario': 'Filtro de ar do motor', 'filtro de ar': 'Filtro de ar do motor', 'filtro de ar motor': 'Filtro de ar do motor',
  'filtro de ar secundario': 'Filtro de ar do motor (secundário)', 'filtro de ar de seguranca': 'Filtro de ar do motor (secundário)',
  'filtro de combustivel primario': 'Filtro de combustível', 'filtro de combustivel secundario': 'Filtro de combustível (secundário)',
  'cartucho do secador': 'Cartucho do secador de ar', 'filtro secador': 'Cartucho do secador de ar', 'filtro secador de ar': 'Cartucho do secador de ar',
  'filtro de arla': 'Filtro de ureia', 'filtro de arla 32': 'Filtro de ureia', 'filtro de cabine': 'Filtro de cabine', 'filtro de ar da cabine': 'Filtro de cabine',
  'oleo de motor': 'Óleo de motor', 'oleo do motor': 'Óleo de motor', 'oleo de cambio': 'Óleo de câmbio', 'oleo de transmissao': 'Óleo de transmissão',
  'oleo de diferencial': 'Óleo de diferencial', 'liquido de arrefecimento': 'Líquido de arrefecimento', 'lampada de farol': 'Lâmpada de farol',
  'pneu': 'Pneu', 'pneus': 'Pneu', 'bateria': 'Bateria', 'correia': 'Correia', 'palheta': 'Palheta', 'fluido de embreagem': 'Fluido de embreagem',
  'fluido de freio': 'Fluido de freio', 'arla 32': 'Arla 32', 'arla': 'Arla 32', 'oleo de direcao hidraulica': 'Óleo de direção hidráulica',
};
const SIS_CANON = { 'eletrica': 'Elétrica', 'eletrica/bateria': 'Elétrica/Bateria', 'admissao de ar': 'Admissão de ar', 'pos-tratamento': 'Pós-tratamento', 'rodas/pneus': 'Rodas/Pneus' };
const canonItem = s => ITEM_CANON[norm(s).toLowerCase()] || String(s).trim();
const canonSis  = s => SIS_CANON[norm(s).toLowerCase()] || String(s).trim();

// ── 2ª rodada: já plana; só valida e carimba ────────────────────────────────
function r2(arr, arquivo) {
  const L = [];
  for (const r of arr) {
    if (!r || !r.modelo || !r.item) continue;
    const modelos = cadastroDe(r.modelo, String(r.modelo).split('|')[0]);
    for (const modelo of modelos) L.push({
      modelo, anos: Array.isArray(r.anos) && r.anos.length ? [Number(r.anos[0]), Number(r.anos[r.anos.length - 1])] : null,
      sistema: canonSis(r.sistema || 'Outros'), item: canonItem(r.item), especificacao: r.especificacao || null,
      quantidade: r.quantidade == null ? null : String(r.quantidade), unidade: r.unidade || null, intervalo: r.intervalo || null,
      codigo_ref: r.codigo_ref || null, status: PESO[r.status] ? r.status : 'nao_encontrado', fonte: r.fonte || null, nota: r.nota || null,
      rodada: 2, arquivo,
    });
  }
  return L;
}

// ── roda tudo ───────────────────────────────────────────────────────────────
let linhas = [];
for (const f of fs.readdirSync(RAW).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
  if (/^r1-ncm/.test(f)) continue;                                   // NCM não é aplicação por modelo
  if (/^r2-/.test(f)) { linhas.push(...r2(j, f)); continue; }
  for (const m of j) {
    const modelos = cadastroDe(m.modelo, m.marca);
    for (const modelo of modelos) {
      const L = /empilhadeira/.test(f) ? r1Empilhadeira(m, modelo)
              : /implementos/.test(f) ? r1Implemento(m, modelo, GENERICOS.has(modelo) && /TRUCKVAN \/ BOVENAU/i.test(m.modelo))
              : r1Caminhao(m, modelo);
      L.forEach(l => { l.arquivo = f; });
      linhas.push(...L);
    }
  }
}

linhas.forEach(l => { l.item = canonItem(l.item); l.sistema = canonSis(l.sistema); });
// dedup pela chave: fica o melhor status; o outro vira nota
const chave = l => [l.modelo, l.sistema, l.item, l.anos ? l.anos.join('-') : ''].join('|');
const mapa = new Map();
for (const l of linhas) {
  const k = chave(l), a = mapa.get(k);
  if (!a) { mapa.set(k, l); continue; }
  const [fica, sai] = PESO[l.status] > PESO[a.status] || (PESO[l.status] === PESO[a.status] && l.rodada > a.rodada) ? [l, a] : [a, l];
  if (sai.especificacao && sai.especificacao !== fica.especificacao)
    fica.nota = uniq([fica.nota, `[rodada ${sai.rodada}, ${sai.status}] ${sai.especificacao}${sai.fonte ? ' — ' + sai.fonte : ''}`]).join(' | ');
  if (!fica.quantidade && sai.quantidade) { fica.quantidade = sai.quantidade; fica.unidade = sai.unidade; }
  if (!fica.intervalo && sai.intervalo) fica.intervalo = sai.intervalo;
  if (!fica.codigo_ref && sai.codigo_ref) fica.codigo_ref = sai.codigo_ref;
  mapa.set(k, fica);
}
linhas = [...mapa.values()].sort((a, b) => a.modelo.localeCompare(b.modelo) || a.sistema.localeCompare(b.sistema) || a.item.localeCompare(b.item));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ gerado_em: new Date().toISOString(), linhas }, null, 1));

// ── resumo ──────────────────────────────────────────────────────────────────
const cont = {};
linhas.forEach(l => { cont[l.status] = (cont[l.status] || 0) + 1; });
console.log(`${OUT}: ${linhas.length} linha(s)`, cont);
const modelosCom = new Set(linhas.map(l => l.modelo));
const sem = MODELOS.filter(m => !modelosCom.has(m));
console.log(`modelos do cadastro: ${MODELOS.length} · com alguma linha: ${modelosCom.size} · SEM NADA: ${sem.length}`);
sem.forEach(m => console.log('   sem pesquisa:', m));
if (naoMapeados.size) { console.log('pesquisa que NÃO casou com o cadastro (ficou de fora):'); [...naoMapeados].forEach(m => console.log('   ', m)); }
