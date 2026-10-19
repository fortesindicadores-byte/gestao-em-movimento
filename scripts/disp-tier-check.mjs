// Conferência do scripts/disp-tier-pelo-projeto.sql (Renan, 19/10/2026: "Rodei
// o SQL, valide se corrigiu"). Só leitura. Para cada evento de CBA/MCC compara
// a unidade gravada com o código que o PROJETO do veículo dá (mesma regra do
// app e do disp_unit_cod) e mostra os abertos por sigla × projeto, que é o que
// a tela mostra (unidade = sigla, projeto separa).
const URL = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.log('SEM GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const req = async (tab, q) => {
  const out = [], PAG = 1000;
  for (let de = 0; ; de += PAG) {
    const r = await fetch(`${URL}/rest/v1/${tab}?${q}`, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${de}-${de + PAG - 1}` } });
    if (!r.ok) throw new Error(tab + ' http ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const l = await r.json(); out.push(...l); if (l.length < PAG) return out;
  }
};
const NAME2COD = {
  'CDD CAMBORIU':'BLC','BALNEARIO CAMBORIU':'BLC','CAMBORIU':'BLC',
  'CDD CUIABA':'CBA T2','CUIABA':'CBA T1 WH','CUIABA EMPURRADA':'CBA T1',
  'CDD RIO DE JANEIRO':'CGR','CAMPO GRANDE':'CGR','RIO DE JANEIRO':'CGR',
  'CDD FLORIANOPOLIS':'FLP','FLORIANOPOLIS':'FLP','CDD GUARULHOS':'GRL','GUARULHOS':'GRL','ANHANGUERA':'ANG',
  'CDI MACACU':'MCC T2','MACACU EMPURRADA':'MCC T1','CACHOEIRAS DE MACACU':'MCC T2','MACACU':'MCC T2',
  'CDD NOVA FRIBURGO':'NFR','NOVA FRIBURGO':'NFR','PIRAI EMPURRADA':'PIR','PIRAI':'PIR',
  'CDD PELOTAS':'PLT','PELOTAS':'PLT','CDD RONDONOPOLIS':'RON','RONDONOPOLIS':'RON','CDD GOIANIA':'GNA','GOIANIA':'GNA'
};
const normU = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const normP = s => String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
function unitCod(nome, projeto){
  const n = normU(nome); if(!n) return null;
  let cod = NAME2COD[n]; if(!cod) return n;
  const p = normU(projeto);
  if (cod.startsWith('CBA')) {
    if (/EMPURRAD/.test(p)) cod='CBA T1';
    else if (/APOIO|EMPILHADEIRA|ARMAZEM|\bWH\b/.test(p)) cod='CBA T1 WH';
    else if (/ROTA|CDD|AUTO SERVICO|VAN/.test(p)) cod='CBA T2';
  } else if (cod.startsWith('MCC')) {
    if (/EMPURRAD/.test(p)) cod='MCC T1';
    else if (/ROTA|CDI|CDD|AUTO SERVICO|VAN/.test(p)) cod='MCC T2';
  }
  return cod;
}
const sig = c => String(c||'').split(' ')[0];

const [gs] = await req('ginfo_snapshot', 'chave=eq.ativos&select=data,updated_at');
const AT = {};
(gs.data||[]).forEach(e => { const p = normP(e['Placa']); if (p && !AT[p]) AT[p] = { cod: unitCod(e['Filial'], e['Projeto']), proj: String(e['Projeto']||'').trim() }; });
(await req('ativos_manual','select=placa,unidade,projeto')).forEach(r => { AT[normP(r.placa)] = { cod: r.unidade, proj: r.projeto||'' }; });
console.log('ativos (Ginfo + manuais):', Object.keys(AT).length, '· Ginfo de', gs.updated_at);

const ev = await req('indisponibilidade', 'select=id,unidade,placa,projeto,data_parada,data_retorno,updated_at&order=data_parada.desc');
console.log('eventos:', ev.length, '· abertos:', ev.filter(e=>!e.data_retorno).length);

const fam = ev.filter(e => ['CBA','MCC'].includes(sig(e.unidade)));
let ok = 0, errado = [], fora = [], outraSigla = [];
fam.forEach(e => {
  const a = AT[normP(e.placa)];
  if (!a) { fora.push(e); return; }
  if (sig(a.cod) !== sig(e.unidade)) { outraSigla.push({ e, a }); return; }
  if (a.cod === e.unidade) ok++; else errado.push({ e, a });
});
console.log('\n===== CBA/MCC: unidade gravada × projeto do veículo =====');
console.log(`  eventos CBA/MCC: ${fam.length} · tier certo: ${ok} · TIER ERRADO: ${errado.length} · placa fora da base: ${fora.length} · ativo hoje em outra sigla: ${outraSigla.length}`);
errado.slice(0,40).forEach(({e,a}) => console.log(`    ERRADO ${e.placa} gravado ${e.unidade} · projeto "${a.proj}" → ${a.cod} · parou ${e.data_parada}${e.data_retorno?' · voltou '+e.data_retorno:' · ABERTO'}`));
fora.filter(e=>!e.data_retorno).slice(0,20).forEach(e => console.log(`    fora da base (aberto) ${e.placa} ${e.unidade} proj gravado "${e.projeto}"`));
outraSigla.filter(x=>!x.e.data_retorno).slice(0,20).forEach(({e,a}) => console.log(`    outra sigla (aberto) ${e.placa} gravado ${e.unidade} · ativo ${a.cod} "${a.proj}"`));

console.log('\n===== ABERTOS por sigla × projeto (como a tela mostra) =====');
const m = new Map();
ev.filter(e=>!e.data_retorno).forEach(e => {
  const a = AT[normP(e.placa)]; const proj = (a&&a.proj)||e.projeto||'—';
  const k = sig(e.unidade) + ' | ' + proj;
  if (!m.has(k)) m.set(k, { n:0, tiers:{} });
  const g = m.get(k); g.n++; g.tiers[e.unidade] = (g.tiers[e.unidade]||0)+1;
});
[...m.entries()].sort().forEach(([k,g]) => console.log(`  ${k.padEnd(34)} ${String(g.n).padStart(3)}  gravado: ${JSON.stringify(g.tiers)}`));

console.log('\n===== T1 com projeto que não é Empurrada/Apoio (abertos) =====');
const t1 = ev.filter(e=>!e.data_retorno && /T1/.test(e.unidade||'')).filter(e=>{const a=AT[normP(e.placa)];const p=normU((a&&a.proj)||e.projeto);return !/EMPURRAD|APOIO|EMPILHADEIRA|ARMAZEM|\bWH\b/.test(p);});
console.log('  total:', t1.length);
t1.forEach(e=>{const a=AT[normP(e.placa)];console.log(`    ${e.placa} ${e.unidade} projeto "${(a&&a.proj)||e.projeto}"`);});
