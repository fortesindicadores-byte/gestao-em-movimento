// A aba Km/L chega do Google SEM cabeçalho (rótulos A, B, C… — Kml Aba Inspect,
// 05/10/2026), então os quatro painéis que a leem caem nas posições padrão do
// detectCols. Este teste roda o detectCols DO PRÓPRIO arquivo com os rótulos
// vazios e confere as posições contra a aba real: P=Unidade, Q=Placa, T=Modelo,
// V=Tipo Veículo, X=Litros, Z=TOTAS R$.
import fs from 'node:fs'; import vm from 'node:vm';
const RAIZ = process.env.RAIZ || new URL('..', import.meta.url).pathname;
const COLS = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z AA'.split(' ');
const ESPERA = { placa: 16, modelo: 19, tipoVei: 21, proj: 14, litros: 23, ativo: 11 };
let falhas = 0;
for (const p of ['combustivel/co2', 'combustivel/preco-litro', 'combustivel/eficiencia-kml', 'consumo-kml-analise']) {
  const h = fs.readFileSync(`${RAIZ}/${p}/index.html`, 'utf8');
  const i = h.indexOf('function detectCols('), j = h.indexOf('\n}\n', i) + 3;
  const ctx = { CL: {} }; vm.createContext(ctx);
  vm.runInContext(h.slice(i, j).replace('CL = {', 'globalThis.CL = {') + '\ndetectCols(' + JSON.stringify(COLS) + ');', ctx);
  for (const [k, v] of Object.entries(ESPERA)) {
    if (!(k in ctx.CL)) continue;
    const ok = ctx.CL[k] === v; if (!ok) falhas++;
    console.log(`${ok ? '✓' : '✗'} ${p} · ${k} = ${ctx.CL[k]} (aba: ${v})`);
  }
}
console.log(falhas ? `${falhas} falha(s)` : 'ok'); process.exit(falhas ? 1 : 0);
