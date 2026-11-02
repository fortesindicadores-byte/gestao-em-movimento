// Gera os ícones do app do celular (app/img/icone-192.png e icone-512.png) sem
// biblioteca nenhuma: o quadrado laranja do Gestão em Movimento com a linha de
// tendência do hub (a mesma do logo) em branco. "any maskable": o fundo ocupa o
// quadrado inteiro e o desenho fica na zona segura do centro.
//   node scripts/app-icone.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const linhas = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { linhas[y * (w * 4 + 1)] = 0; rgba.copy(linhas, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(linhas, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// distância de um ponto ao segmento
function dSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const l2 = vx * vx + vy * vy || 1;
  let t = (wx * vx + wy * vy) / l2; t = Math.max(0, Math.min(1, t));
  const x = ax + t * vx - px, y = ay + t * vy - py;
  return Math.sqrt(x * x + y * y);
}
function desenha(S) {
  const rgba = Buffer.alloc(S * S * 4);
  // fundo: laranja do portal com um leve degradê (mais escuro embaixo, como o neon da capa)
  const topo = [249, 115, 22], base = [214, 86, 10];
  // a linha de tendência do hub: polyline 22,12 18,12 15,21 9,3 6,12 2,12 (viewBox 24)
  const P = [[22, 12], [18, 12], [15, 21], [9, 3], [6, 12], [2, 12]];
  const esc = S * 0.62 / 24, ox = S * 0.19, oy = S * 0.19;   // zona segura do maskable (centro)
  const pts = P.map(([x, y]) => [ox + x * esc, oy + y * esc]);
  const larg = S * 0.072;   // espessura do traço
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const f = y / S;
    let r = topo[0] + (base[0] - topo[0]) * f, g = topo[1] + (base[1] - topo[1]) * f, b = topo[2] + (base[2] - topo[2]) * f;
    let d = 1e9;
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, dSeg(x + .5, y + .5, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
    const a = Math.max(0, Math.min(1, larg / 2 + 0.8 - d));   // antialias de ~1,6 px
    r = r + (255 - r) * a; g = g + (255 - g) * a; b = b + (255 - b) * a;
    const o = (y * S + x) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
  }
  return png(S, S, rgba);
}
fs.mkdirSync(path.join(RAIZ, 'app/img'), { recursive: true });
for (const S of [192, 512]) {
  const f = path.join(RAIZ, 'app/img/icone-' + S + '.png');
  fs.writeFileSync(f, desenha(S));
  console.log(f, fs.statSync(f).size + ' bytes');
}
