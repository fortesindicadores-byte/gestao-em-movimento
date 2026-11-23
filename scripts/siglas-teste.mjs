// assets/siglas.js: ANG → ANH e GNA → GOI só na TELA (texto, dica, eixo do gráfico);
// value, data-v, campos de formulário e placas ficam como estão.
//   CHART_JS = caminho do chart.umd.js real (obrigatório para a parte do gráfico)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHART_JS = process.env.CHART_JS || '';
const PAG = `<!doctype html><meta charset="utf-8"><body>
<table id="t"><tr><td>ANG</td><td>ROTA - ANG</td><td>GNA</td><td>ANG1B23</td><td>ANGRA</td></tr></table>
<label class="ms-opt"><input type="checkbox" data-v="ANG"> ANG<span class="ms-only" data-v="ANG">only</span></label>
<select id="s1"><option>ANG</option><option>PIR</option></select>
<select id="s2"><option value="GNA">GNA</option></select>
<input id="i" value="ANG"><textarea id="ta">GNA</textarea><div id="ce" contenteditable>ANG</div>
<span id="dica" title="Unidade ANG">x</span><div id="depois"></div>
<div style="width:400px;height:200px"><canvas id="c"></canvas></div>
${CHART_JS ? '<script src="/__chart.js"></script>' : ''}
<script src="/assets/mobile.js"></script>
<script>window.addEventListener('load',()=>{ if(window.Chart) window.G=new Chart(document.getElementById('c'),{type:'bar',data:{labels:['ANG','GNA','PIR'],datasets:[{data:[1,2,3]}]},options:{animation:false}});
  setTimeout(()=>{ document.getElementById('depois').innerHTML='<b>GNA · AUTO SERVIÇO</b>'; },300); });</script>`;
const srv = http.createServer((req, res) => { const u = req.url.split('?')[0];
  if (u === '/p.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAG); }
  if (u === '/__chart.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); return res.end(fs.readFileSync(CHART_JS)); }
  fs.readFile(path.join(RAIZ, u), (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(b); }); });
await new Promise(r => srv.listen(8792, r));
const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
const pg = await br.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8792/p.html'); await pg.waitForTimeout(900);
let f = 0, n = 0; const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); v ? n++ : f++; };
const R = await pg.evaluate(() => ({
  tds: [...document.querySelectorAll('#t td')].map(x => x.textContent).join('|'),
  lab: document.querySelector('.ms-opt').textContent.trim(), dv: document.querySelector('.ms-opt input').dataset.v,
  s1: document.getElementById('s1').value, s1t: document.getElementById('s1').options[0].textContent,
  s2: document.getElementById('s2').value, s2t: document.getElementById('s2').options[0].textContent,
  i: document.getElementById('i').value, ta: document.getElementById('ta').value, ce: document.getElementById('ce').textContent,
  dica: document.getElementById('dica').title, depois: document.getElementById('depois').textContent,
  eixo: window.G ? window.G.scales.x.ticks.map(t => t.label).join('|') : '', dados: window.G ? window.G.data.labels.join('|') : '' }));
ok('texto: ANG → ANH, GNA → GOI; placa e outra palavra ficam', R.tds === 'ANH|ROTA - ANH|GOI|ANG1B23|ANGRA', R.tds);
ok('filtro: o rótulo muda e o data-v continua o código', /^ANH/.test(R.lab) && R.dv === 'ANG', R.lab + ' · ' + R.dv);
ok('<option> sem value: mostra ANH e o valor continua ANG', R.s1 === 'ANG' && R.s1t === 'ANH', R.s1 + ' · ' + R.s1t);
ok('<option> com value: mostra GOI e o valor continua GNA', R.s2 === 'GNA' && R.s2t === 'GOI');
ok('campo de texto, textarea e célula editável não mudam', R.i === 'ANG' && R.ta === 'GNA' && R.ce === 'ANG', [R.i, R.ta, R.ce].join('|'));
ok('dica (title) muda', R.dica === 'Unidade ANH', R.dica);
ok('conteúdo que entra depois também muda', R.depois === 'GOI · AUTO SERVIÇO', R.depois);
if (CHART_JS) ok('gráfico: o eixo mostra ANH e GOI, os dados continuam ANG e GNA', R.eixo === 'ANH|GOI|PIR' && R.dados === 'ANG|GNA|PIR', R.eixo + ' · ' + R.dados);
ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
await br.close(); srv.close(); console.log(`\n${n} ok · ${f} falha(s)`); process.exit(f ? 1 : 0);
