// ============================================================
// Remun Mapa Carga — grava na remun_mapa os mapas de um 2artd que já foi
// importado ANTES de a tabela existir, sem pedir o arquivo de novo.
//
// O arquivo tem placa e valor por mapa e o repositório é público, então os
// mapas chegam CIFRADOS (X25519 + HKDF + AES-256-GCM) num arquivo do branch de
// trabalho. A chave privada é derivada da service key, que só o Actions tem:
//   MODO=chave   imprime a chave PÚBLICA (com ela se cifra o arquivo)
//   MODO=ensaio  decifra, lê o FT do banco, roda o MESMO assets/remun-mapas.js
//                da tela e compara com a remun_viagem já gravada; não grava
//   MODO=gravar  idem e grava SÓ a remun_mapa (apaga e regrava por mês ×
//                unidade × projeto, como a tela). Nenhuma outra tabela muda.
// O log imprime contagens, nunca placa nem valor por mapa.
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';

const SB_URL = process.env.SB_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const MODO = (process.env.MODO || 'chave').trim();
const ARQ = process.env.CARGA_ARQ || '/tmp/remun-mapa.enc';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

// par de chaves derivado da service key (a privada nunca sai daqui)
const seed = crypto.createHash('sha256').update('gem-remun-mapa-carga-v1|' + KEY).digest();
const priv = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
const pubRaw = crypto.createPublicKey(priv).export({ format: 'der', type: 'spki' }).subarray(-32);

if (MODO === 'chave') { console.log('CHAVE PUBLICA: ' + pubRaw.toString('base64')); process.exit(0); }
if (MODO !== 'ensaio' && MODO !== 'gravar') { console.error('MODO inválido: ' + MODO); process.exit(1); }

// ── decifra ──
const env = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
const epk = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b656e032100', 'hex'), Buffer.from(env.epk, 'base64')]), format: 'der', type: 'spki' });
const seg = crypto.diffieHellman({ privateKey: priv, publicKey: epk });
const k = Buffer.from(crypto.hkdfSync('sha256', seg, Buffer.from(env.epk, 'base64'), Buffer.from('gem-remun-mapa'), 32));
const dec = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(env.iv, 'base64'));
dec.setAuthTag(Buffer.from(env.tag, 'base64'));
const art = JSON.parse(zlib.gunzipSync(Buffer.concat([dec.update(Buffer.from(env.ct, 'base64')), dec.final()])).toString('utf8'));
console.log(`arquivo: ${art.arquivo} · vigência ${art.vig} · ${art.mapas.length} mapas da frota própria`);

// ── o motor da tela ──
const w = {}; vm.runInContext(fs.readFileSync(new URL('../assets/remun-mapas.js', import.meta.url), 'utf8'), vm.createContext({ window: w, console }));
const RM = w.RemunMapas;

const get = async (caminho) => {
  for (let t = 1; ; t++) {
    const r = await fetch(SB_URL + '/rest/v1/' + caminho, { headers: H });
    if (r.ok) return r.json();
    if (t >= 4) throw new Error(caminho.split('?')[0] + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
    await new Promise(z => setTimeout(z, 3000 * t));
  }
};
const todas = async (caminho) => { const out = []; for (let i = 0; ; i += 1000) { const d = await get(caminho + `&limit=1000&offset=${i}`); out.push(...d); if (d.length < 1000) break; } return out; };

// ── FT do mês (as mesmas tabelas e a mesma montagem do carregaFT da tela) ──
const [ano, mes] = art.vig.split('-');
const rows = [];
for (const [canal, tab] of RM.FT_TABELAS) {
  for (const q of [1, 2]) {
    const vg = `${canal}_${q}_${+mes}_${ano}`;
    const lay = await get(`ft_layout?select=colunas&canal=eq.${canal}&tabela=eq.${tab}&vigencia=eq.${vg}`);
    if (!lay.length) continue;
    const ls = await todas(`ft_linha?select=unidade,placa,dados&canal=eq.${canal}&tabela=eq.${tab}&vigencia=eq.${vg}&order=linha`);
    ls.forEach(l => { const o = {}; lay[0].colunas.forEach((c, i) => { o[c] = l.dados[i]; }); rows.push({ canal, tabela: tab, vigencia: vg, unidade: l.unidade, placa: l.placa, o }); });
  }
}
const ft = RM.ftIndice(rows);
const faltam = RM.FT_TABELAS.filter(([c, t]) => !rows.some(r => r.canal === c && r.tabela === t)).map(([c, t]) => c + ' ' + t);
console.log(`FT do mês: ${rows.length} linhas · ${ft.vans.size} vans${faltam.length ? ' · SEM: ' + faltam.join(', ') : ''}`);
if (!rows.length) { console.error('::error::FT do mês não encontrado no banco'); process.exit(1); }

const r = RM.calculaT2(art, ft, art.arquivo);
const M = r.mapas;
const c = f => M.filter(f).length;
console.log(`mapas calculados: ${M.length} · com horário ${c(m => m.hr_sai)} · com km previsto ${c(m => m.km_previsto > 0)} · com km do FT ${c(m => m.km_ft != null)} · sem valor ${c(m => !m.valor_pago)}`);
const porTipo = {}; M.forEach(m => { const o = porTipo[m.tipo] = porTipo[m.tipo] || { n: 0, p: 0, s: 0 }; o.n++; if (m.km_previsto > 0) { o.p++; o.s += m.km_previsto; } });
Object.entries(porTipo).forEach(([t, o]) => console.log(`  ${t}: ${o.n} mapas · ${o.p} com previsto · média ${o.p ? (o.s / o.p).toFixed(1) : '—'} km`));
(r.avisos || []).slice(0, 12).forEach(a => console.log('  aviso: ' + a));
if ((r.avisos || []).length > 12) console.log(`  … e mais ${r.avisos.length - 12} aviso(s)`);

// ── conferência com o que a importação de antes gravou (remun_viagem) ──
const vigs = [...new Set(M.map(m => m.vigencia))];
const rv = await todas(`remun_viagem?select=vigencia,quinzena,unidade,projeto,tipo,viagens&vigencia=in.(${vigs.join(',')})`);
const kv = x => [x.vigencia, x.quinzena, x.unidade, x.projeto, x.tipo].join('|');
// só os projetos do 2artd (Rota, Auto Serviço, Van): a Empurrada e Insumos da remun_viagem vêm dos CT-es
const projs = new Set(M.map(m => m.projeto));
const banco = new Map(rv.filter(x => projs.has(x.projeto)).map(x => [kv(x), +x.viagens || 0]));
const meu = new Map(); M.forEach(m => meu.set(kv(m), (meu.get(kv(m)) || 0) + 1));
let iguais = 0; const dif = [];
new Set([...banco.keys(), ...meu.keys()]).forEach(key => { const a = banco.get(key) || 0, b = meu.get(key) || 0; if (a === b) iguais++; else dif.push(`${key}: banco ${a} × arquivo ${b}`); });
console.log(`conferência com a remun_viagem: ${banco.size} linhas no banco (${[...projs].join(', ')}) · ${iguais} recortes iguais · ${dif.length} diferentes`);
dif.slice(0, 40).forEach(d => console.log('  ' + d));
if (rv.length && dif.length > Math.max(3, 0.1 * (iguais + dif.length))) { console.error('::error::o arquivo não é o que foi importado (recortes demais diferentes); nada gravado'); process.exit(1); }

if (MODO !== 'gravar') { console.log('\nENSAIO: nada gravado.'); process.exit(0); }

// ── grava só a remun_mapa ──
const chaves = [...new Set(M.map(m => m.vigencia + '|' + m.unidade + '|' + m.projeto))].map(x => x.split('|'));
for (const [v, u, p] of chaves) {
  const d = await fetch(`${SB_URL}/rest/v1/remun_mapa?vigencia=eq.${v}&unidade=eq.${encodeURIComponent(u)}&projeto=eq.${encodeURIComponent(p)}`, { method: 'DELETE', headers: H });
  if (!d.ok) { console.error('::error::ao limpar remun_mapa: HTTP ' + d.status + ' ' + (await d.text()).slice(0, 300)); process.exit(1); }
}
let n = 0;
for (let i = 0; i < M.length; i += 500) {
  const lote = M.slice(i, i + 500).map(m => ({ ...m, updated_by: 'carga pelo Actions' }));
  const p = await fetch(`${SB_URL}/rest/v1/remun_mapa`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(lote) });
  if (!p.ok) { console.error('::error::remun_mapa: HTTP ' + p.status + ' ' + (await p.text()).slice(0, 300)); process.exit(1); }
  n += lote.length;
}
const res = await todas(`remun_mapa_resumo?select=*&vigencia=in.(${vigs.join(',')})`);
const tot = res.reduce((a, x) => a + (+x.mapas || 0), 0);
console.log(`\nGRAVADO: ${n} mapas em ${chaves.length} recortes (mês × unidade × projeto) · a view remun_mapa_resumo soma ${tot} mapas em ${res.length} linhas`);
if (tot !== n) { console.error('::error::a view não bate com o gravado'); process.exit(1); }
