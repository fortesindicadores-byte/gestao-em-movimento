// Impactos e diagnóstico das Árvores de Combustível (assets/arvore-impacto.js).
// Roda o arquivo do próprio portal em node:vm e confere que a ponte FECHA:
//   Volume + R$/km = Δ custo  e  Preço + Eficiência + Diferença = R$/km,
// com a Diferença partida em lado remunerado + lado realizado. Caso real: ANG
// set/26 do print do Renan (13/10/2026).
import fs from 'node:fs'; import vm from 'node:vm';
const ctx={window:{}}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../assets/arvore-impacto.js',import.meta.url),'utf8'),ctx);
const A=ctx.window.ArvImpacto; let ok=0,fail=0;
const t=(c,m)=>{c?ok++:fail++; console.log((c?'  ✓ ':'  ✗ ')+m);};
const near=(a,b,e=0.01)=>Math.abs(a-b)<=e;
const casos={
  'ANG set/26':{custoRem:-123800,custoReal:-235700,kmRem:81148,kmReal:116231,rsLRem:7.58,rsLReal:6.91,kmLRem:3.76,kmLReal:3.34},
  'custo abaixo':{custoRem:-500000,custoReal:-420000,kmRem:200000,kmReal:190000,rsLRem:6.2,rsLReal:6.0,kmLRem:2.4,kmLReal:2.5},
};
for(const [nome,d] of Object.entries(casos)){
  const b=A.calc(d);
  t(near(b.vol+b.rsKm,b.dCusto),`${nome}: Volume + R$/km = Δ custo (${Math.round(b.vol)} + ${Math.round(b.rsKm)} = ${Math.round(b.dCusto)})`);
  t(near(b.preco+b.efic+b.dif,b.rsKm),`${nome}: Preço + Eficiência + Diferença = R$/km (${Math.round(b.preco)} + ${Math.round(b.efic)} + ${Math.round(b.dif)})`);
  t(near(b.difRem+b.difReal,b.dif),`${nome}: Diferença = lado rem + lado real (${Math.round(b.difRem)} + ${Math.round(b.difReal)})`);
  const h=A.html(b); t(/Diagnóstico/.test(h)&&(h.match(/class="dg-it"/g)||[]).length===4,`${nome}: diagnóstico com 4 partes`);
}
const g=A.calc(casos['ANG set/26']);
t(near(g.rsKm,58405,60),`ANG: Impacto R$/km ≈ 58.405 da tela (${Math.round(g.rsKm)})`);
t(near(g.vol,53524,60),`ANG: Volume ≈ 53.524 da tela (${Math.round(g.vol)})`);
t(g.preco<0&&g.efic>0&&g.dif>40000,`ANG: preço favorável, Km/L desfavorável, diferença grande (${Math.round(g.preco)} · ${Math.round(g.efic)} · ${Math.round(g.dif)})`);
const s=A.calc({custoRem:-1000,custoReal:-1200,kmRem:500,kmReal:520,rsLRem:null,rsLReal:6,kmLRem:3,kmLReal:3});
t(s.preco===null&&/não dá para separar/.test(A.html(s)),'sem R$/L remunerado: não separa preço de eficiência e diz por quê');
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
