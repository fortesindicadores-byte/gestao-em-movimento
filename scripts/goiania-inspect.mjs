// ============================================================================
// Goiânia Inspect — como a unidade nova aparece em CADA fonte, antes de
// cadastrá-la no portal (Renan, 23/09/2026: "Temos a unidade de Goiânia
// agora, se não me engano está como GNA. Precisa estar nos FCAs, acessos").
// Roda no Actions (o sandbox não alcança docs.google nem o Supabase). Só
// leitura; imprime nomes de unidade/filial, nunca dado pessoal.
// Uso: [GOI_BUSCA=GOI,GNA,GYN] node scripts/goiania-inspect.mjs
// ============================================================================
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Falta GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const BUSCA = (process.env.GOI_BUSCA || 'GOI,GNA,GYN').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const NK = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const bate = s => BUSCA.some(b => NK(s).includes(b));
const conta = (arr) => { const m = new Map(); arr.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const mostra = (tit, vals, todos) => {
  const c = conta(vals.filter(Boolean));
  const hit = c.filter(([v]) => bate(v));
  console.log(`\n── ${tit} · ${c.length} valor(es) distintos`);
  console.log(hit.length ? '   COM GOIÂNIA: ' + hit.map(([v, n]) => `"${v}" ×${n}`).join(' · ') : '   (nada com ' + BUSCA.join('/') + ')');
  if (todos) console.log('   todos: ' + c.map(([v, n]) => `${v}=${n}`).join(' · '));
};
const gviz = async (id, aba) => {
  const t = await (await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(aba)}`)).text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  return { cols: (j.table.cols || []).map(c => c.label || c.id || ''), rows: (j.table.rows || []).map(r => (r.c || []).map(c => c ? c.v : null)) };
};
const rest = async (q) => { const r = await fetch(`${SB}/rest/v1/${q}`, { headers: H }); if (!r.ok) { console.log('   REST', r.status, (await r.text()).slice(0, 120)); return []; } return r.json(); };
const pagina = async (tab, sel) => { let out = [], from = 0; while (true) { const r = await fetch(`${SB}/rest/v1/${tab}?select=${sel}&offset=${from}&limit=1000`, { headers: H }); if (!r.ok) { console.log('   REST', r.status); break; } const j = await r.json(); out = out.concat(j); if (j.length < 1000) break; from += 1000; } return out; };

// 1) DRE Frota (Nível 3 = "PROJETO - UNIDADE")
try { const f = await gviz('1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8', 'Frota');
  const i3 = f.cols.findIndex(c => /n[ií]vel 3/i.test(c)), iu = f.cols.findIndex(c => /^unidade/i.test(c)), iv = f.cols.findIndex(c => /vig/i.test(c));
  mostra('DRE Frota · Nível 3', f.rows.map(r => r[i3]));
  mostra('DRE Frota · Unidade', f.rows.map(r => r[iu]));
  const gv = f.rows.filter(r => bate(r[i3]) || bate(r[iu])).map(r => String(r[iv]));
  if (gv.length) console.log('   vigências com Goiânia no DRE: ' + [...new Set(gv)].join(' · '));
} catch (e) { console.log('DRE Frota falhou:', e.message); }
// 2) Dispersão de km (col 13 = unidade, col 14 = "PROJETO - COD")
try { const d = await gviz('1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM', 'Dispersão de km');
  mostra('Dispersão de km · col 13 (unidade)', d.rows.map(r => r[13]));
  mostra('Dispersão de km · col 14 (projeto - cod)', d.rows.map(r => r[14]));
} catch (e) { console.log('Dispersão falhou:', e.message); }
// 3) Ginfo ativos (Filial)
try { const g = await rest('ginfo_snapshot?chave=eq.ativos&select=data'); const rows = (g[0] && g[0].data) || [];
  mostra('Ginfo ativos · Filial', rows.map(r => r['Filial']), true);
  const goi = rows.filter(r => bate(r['Filial'])); if (goi.length) mostra('Ginfo ativos de Goiânia · Projeto', goi.map(r => r['Projeto']), true);
  if (goi.length) mostra('Ginfo ativos de Goiânia · Tipo Veículo', goi.map(r => r['Tipo Veículo']), true);
} catch (e) { console.log('Ginfo falhou:', e.message); }
// 4) Frota de Elite (elite_snapshot) — filiais da conformidade-detalhe e da disponibilidade mais novas
try { for (const ind of ['conformidade-detalhe', 'disponibilidade', 'checklist-t2', 'preventivas']) {
  const e = await rest(`elite_snapshot?indicador=eq.${ind}&escopo=eq.mes&select=vigencia,data&order=vigencia.desc&limit=3`);
  const fil = e.flatMap(r => (Array.isArray(r.data) ? r.data : []).map(x => x['Filial'] || x.filial || x.Filial));
  mostra(`Frota de Elite · ${ind} (últimas ${e.length} vigências: ${e.map(r => r.vigencia).join(', ')}) · Filial`, fil, ind === 'disponibilidade');
} } catch (e) { console.log('Elite falhou:', e.message); }
// 5) tabelas do portal
try { mostra('fca · unidade', (await pagina('fca', 'unidade')).map(r => r.unidade), true); } catch (e) { console.log('fca falhou:', e.message); }
try { mostra('fca_profiles · unidade (lista por vírgula)', (await pagina('fca_profiles', 'unidade')).flatMap(r => String(r.unidade || '').split(',').map(s => s.trim())), true); } catch (e) { console.log('fca_profiles falhou:', e.message); }
try { mostra('ativos_manual · unidade', (await pagina('ativos_manual', 'unidade')).map(r => r.unidade), true); } catch (e) { console.log('ativos_manual falhou:', e.message); }
try { mostra('unidade_depara · nome → cod', (await pagina('unidade_depara', 'nome,cod')).map(r => `${r.nome} → ${r.cod}`), true); } catch (e) { console.log('unidade_depara falhou:', e.message); }
try { mostra('indisponibilidade · unidade', (await pagina('indisponibilidade', 'unidade')).map(r => r.unidade), true); } catch (e) { console.log('indisponibilidade falhou:', e.message); }
try { mostra('ce_motoristas · unidade', (await pagina('ce_motoristas', 'unidade')).map(r => r.unidade), true); } catch (e) { console.log('ce_motoristas falhou:', e.message); }
try { mostra('carta_custos · unidade', (await pagina('carta_custos', 'unidade')).map(r => r.unidade), true); } catch (e) { console.log('carta_custos falhou:', e.message); }
