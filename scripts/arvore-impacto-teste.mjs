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
// sem a Dispersão de km do mês (print do Renan, set/26: custo e bases de combustível
// com dado, km 0): preço e eficiência saem do km e dos litros da aba Km/L
const sd=A.calc({custoRem:-88357,custoReal:-96235,kmRem:0,kmReal:0,rsLRem:7.09,rsLReal:7.12,kmLRem:3.65,kmLReal:3.53,kmBase:35300,litBase:10000});
t(sd.semDisp&&near(sd.preco,(7.12-7.09)*10000)&&near(sd.efic,7.09*(10000-35300/3.65)),`sem Dispersão: Preço ${Math.round(sd.preco)} e Eficiência ${Math.round(sd.efic)} pelos litros da base`);
const hs=A.html(sd);
t(sd.vol===null&&sd.rsKm===null&&/Dispersão de km ainda não tem km/.test(hs)&&(hs.match(/class="dg-it"/g)||[]).length===2,'sem Dispersão: volume e R$/km vazios, diagnóstico diz o que falta');
// com os impactos dos painéis (temBase): a árvore mostra exatamente os números deles
// e a ponte continua fechando no R$/km
const tb=A.calc({...casos['ANG set/26'],impPrecoBase:-21000,impEficBase:31000,kmBase:110000,litBase:33000,totBase:228000});
t(tb.preco===-21000&&tb.efic===31000,'com os painéis: Preço e Eficiência são os do R$/L e do Km/L');
t(near(tb.preco+tb.efic+tb.dif,tb.rsKm)&&near(tb.difRem+tb.difReal,tb.dif),`com os painéis: a ponte fecha (dif ${Math.round(tb.dif)} = rem ${Math.round(tb.difRem)} + real ${Math.round(tb.difReal)})`);
t(near(tb.difReal,235700-228000)&&/116\.231 km da Dispersão/.test(A.html(tb)),'com os painéis: lado realizado = DRE − abastecimentos; o texto cita os dois km');
const sd2=A.calc({custoRem:-88357,custoReal:-96235,kmRem:0,kmReal:0,rsLRem:7.09,rsLReal:7.12,kmLRem:3.65,kmLReal:3.53,kmBase:35300,litBase:10000,impPrecoBase:310,impEficBase:2400});
t(sd2.semDisp&&sd2.preco===310&&sd2.efic===2400,'sem Dispersão: usa os impactos dos painéis');
const sz=A.calc({custoRem:-1000,custoReal:-1200,kmRem:0,kmReal:0,rsLRem:7,rsLReal:7.1,kmLRem:3,kmLReal:3});
t(sz.preco===null,'sem Dispersão e sem litros da base: continua sem preço/eficiência');
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
