// ============================================================
// Pneus do Frota de Elite: a aba corrigida já está no banco, e quanto dá
// cada mês de uma filial? (Renan, 25/09/2026: Guarulhos corrigido no Ginfo)
//
// Lê a aba `Pneus` do workbook Frota de Elite com a MESMA conta do
// assets/gerot-base.js (loadPneusSheet): uma linha por placa no mês, Status
// "Não Realizado" = pendente, qualquer outro = aferido. Imprime a aderência
// mês a mês da filial pedida e diz se o banco (sh_base.elite_pneus) já tem
// esta versão da aba — o md5 é o mesmo que o sheets-robot grava.
// Não grava nada.
// ============================================================
import { createHash } from 'node:crypto';
import { BASES, baixa } from './sheets-bases.mjs';

const FILIAL = (process.env.PN_FILIAL || 'CDD GUARULHOS').toUpperCase();
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const NK = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const MES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
const vigDe = c => {
  if (!c) return null;
  const d = String(c.v ?? '').match(/^Date\((\d{4}),(\d{1,2}),/);
  if (d) return `${d[1]}-${String(+d[2] + 1).padStart(2, '0')}`;
  const m = NK(c.f ?? c.v).match(/([A-Z]+)\s+DE\s+(\d{4})/);
  return m && MES[m[1]] ? `${m[2]}-${String(MES[m[1]]).padStart(2, '0')}` : null;
};

const base = BASES.find(b => b.slug === 'elite_pneus');
const { json } = await baixa(base);
const hash = createHash('md5').update(JSON.stringify(json.table)).digest('hex');
const rows = json.table.rows || [];
console.log(`aba Pneus: ${rows.length} linhas`);

if (KEY) {
  const r = await fetch(`${SUPA}/rest/v1/sh_base?slug=eq.elite_pneus&select=linhas,hash,carregado_em,erro`,
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  const b = (await r.json())[0] || {};
  console.log(`banco: ${b.linhas} linhas · carregado ${b.carregado_em} · erro ${b.erro || '—'}`);
  console.log(b.hash === hash ? '✔ o banco tem ESTA versão da aba' : '✘ o banco tem OUTRA versão — clicar "Atualizar agora" no hub');
}

const por = {}, eventos = {}, status = {};
rows.forEach(r => {
  const c = r.c || [];
  const v = i => (c[i] && c[i].v != null ? c[i].v : (c[i] && c[i].f != null ? c[i].f : ''));
  if (NK(v(0)) !== FILIAL) return;
  const vig = vigDe(c[4]); if (!vig) return;
  const o = por[vig] || (por[vig] = { ok: 0, n: 0 });
  o.n++; if (NK(v(6)) !== 'NAO REALIZADO') o.ok++;
  eventos[NK(v(1))] = (eventos[NK(v(1))] || 0) + 1;
  status[NK(v(6))] = (status[NK(v(6))] || 0) + 1;
});
console.log(`\n── ${FILIAL} · aderência mês a mês (conta do Frota de Elite) ──`);
Object.keys(por).sort().forEach(k => {
  const o = por[k];
  console.log(`${k}   ${String(o.ok).padStart(4)}/${String(o.n).padEnd(4)}  ${(o.ok / o.n * 100).toFixed(2).replace('.', ',')}%`);
});
console.log(`eventos: ${JSON.stringify(eventos)}`);
console.log(`status : ${JSON.stringify(status)}`);
