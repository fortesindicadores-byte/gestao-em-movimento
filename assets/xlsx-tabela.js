/* ============================================================
   XLSX-TABELA — escreve .xlsx com TABELA DO EXCEL de verdade
   (Renan, 12/10/2026: "Os relatórios não ficaram limpos e com cara de
   relatório em excel… tabelas dos dados, para utilizar em análises").

   Cada aba sai como uma Tabela do Excel (Inserir → Tabela): cabeçalho com
   o estilo da tabela, filtro em cada coluna, linhas listradas, primeira
   linha congelada e formato de número/data por coluna — pronta para
   Tabela Dinâmica, que lê a tabela pelo nome.

   POR QUE NÃO UMA BIBLIOTECA PRONTA: o SheetJS gratuito não grava estilo
   nem tabela, e o ExcelJS grava, mas guarda um objeto por célula — medido
   em 12/10/2026: 20 mil linhas × 22 colunas = 457 MB de memória e 6 s; o
   Scorecard leva ~170 mil linhas de aferição do Prolog, o que derrubaria a
   aba do navegador. Aqui o XML de cada aba é escrito em blocos de linhas e
   comprimido em fluxo (fflate), então a memória fica no tamanho do bloco.

   Uso:
     XlsxTabela.monta(abas, { fflate, aoProgresso(i, n, aba) }) → Promise<Blob|Uint8Array[]>
     aba = { nome, colunas:[{nome, fmt, larg}], linhas:[[v,…],…], topo:[[v,…],…] }
       fmt ∈ texto · int · int0 · dec · pct · data · datahora · mes · dur
       valor: número, texto, Date (componentes LOCAIS), {dur:dias} ou null
       topo: linhas soltas antes da tabela (a aba "Fonte" usa); a 1ª é título.
   ============================================================ */
(function (raiz) {
  'use strict';

  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const NSR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NSP = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const CT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';

  // estilos de célula (índice em cellXfs) — a ordem é a do styles.xml abaixo
  const XF = { texto: 0, data: 1, datahora: 2, mes: 3, int: 4, dec: 5, pct: 6, dur: 7, int0: 8, titulo: 9, rotulo: 10 };
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + `<styleSheet xmlns="${NS}">`
    + '<numFmts count="8">'
    + '<numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>'
    + '<numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/>'
    + '<numFmt numFmtId="166" formatCode="mm/yyyy"/>'
    + '<numFmt numFmtId="167" formatCode="#,##0"/>'
    + '<numFmt numFmtId="168" formatCode="#,##0.00"/>'
    + '<numFmt numFmtId="169" formatCode="0.0%"/>'
    + '<numFmt numFmtId="170" formatCode="[h]:mm"/>'
    + '<numFmt numFmtId="171" formatCode="0"/>'
    + '</numFmts>'
    + '<fonts count="3">'
    + '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
    + '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>'
    + '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
    + '</fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="11">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="169" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="170" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="171" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

  // caractere que o XML não aceita derruba o arquivo inteiro no Excel
  const INVAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
  const esc = s => String(s).replace(INVAL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MAXC = 32000;   // limite do Excel por célula é 32.767
  const col = i => { let s = ''; i = i + 1; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  // serial do Excel pelos componentes LOCAIS: converter via fuso joga a data
  // 28 s para trás em São Paulo (hora média local de 1899) e 01/08 vira 31/07
  const serial = d => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30)) / 864e5;
  const ehData = v => Object.prototype.toString.call(v) === '[object Date]';

  // nome de aba: até 31, sem []:*?/\, sem apóstrofo nas pontas, único
  function nomeAba(n, usados) {
    let b = String(n || 'Aba').replace(INVAL, '').replace(/[\[\]:*?\/\\]/g, '-').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31) || 'Aba';
    let s = b, i = 2;
    while (usados.has(s.toLowerCase())) { const suf = ' (' + (i++) + ')'; s = b.slice(0, 31 - suf.length) + suf; }
    usados.add(s.toLowerCase()); return s;
  }
  // cabeçalho de tabela: texto único (o Excel compara sem caixa), sem quebra
  function nomesTabela(cols) {
    const vis = new Set();
    return cols.map(c => {
      let b = String(c.nome == null ? '' : c.nome).replace(INVAL, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Coluna';
      let s = b, i = 2;
      while (vis.has(s.toLowerCase())) s = b + ' (' + (i++) + ')';
      vis.add(s.toLowerCase()); return s;
    });
  }

  function celula(ref, v, fmt, sst) {
    if (v == null || v === '') return '';
    if (typeof v === 'object' && !ehData(v) && v.dur != null) v = v.dur;
    if (ehData(v)) { if (isNaN(v)) return ''; return `<c r="${ref}" s="${XF[fmt === 'datahora' || fmt === 'mes' ? fmt : 'data'] }"><v>${serial(v)}</v></c>`; }
    if (typeof v === 'number') {
      if (!isFinite(v)) return '';
      const s = XF[fmt] != null && fmt !== 'texto' ? XF[fmt] : 0;
      return `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;
    }
    let t = String(v); if (t.length > MAXC) t = t.slice(0, MAXC) + '…';
    return `<c r="${ref}" t="s"><v>${sst(t)}</v></c>`;
  }

  async function monta(abas, opts) {
    opts = opts || {};
    const fflate = opts.fflate || raiz.fflate;
    if (!fflate) throw new Error('fflate não carregou');
    const enc = new TextEncoder();
    const saida = [];
    let fecha, falha;
    const fim = new Promise((ok, erro) => { fecha = ok; falha = erro; });
    const zip = new fflate.Zip((err, dado, ultimo) => { if (err) return falha(err); saida.push(dado); if (ultimo) fecha(); });
    const arquivo = (nome, texto) => { const f = new fflate.ZipDeflate(nome, { level: 6 }); zip.add(f); f.push(enc.encode(texto), true); };

    // sharedStrings: cada texto distinto uma vez
    const ss = new Map(), ssLista = [];
    const sst = t => { let i = ss.get(t); if (i == null) { i = ssLista.length; ss.set(t, i); ssLista.push(t); } return i; };

    const usados = new Set(), nomes = [];
    let nTab = 0;
    const pausa = () => new Promise(r => setTimeout(r, 0));
    for (let a = 0; a < abas.length; a++) {
      const aba = abas[a];
      if (opts.aoProgresso) opts.aoProgresso(a, abas.length, aba);
      await pausa();
      const nome = nomeAba(aba.nome, usados); nomes.push(nome);
      const cols = aba.colunas || [];
      const cab = nomesTabela(cols);
      const topo = aba.topo || [];
      const r0 = topo.length ? topo.length + 2 : 1;       // linha do cabeçalho
      const linhas = aba.linhas || [];
      const comTabela = cols.length > 0 && linhas.length > 0;
      const ultLinha = r0 + Math.max(linhas.length, 0);
      const ref = `A${r0}:${col(Math.max(cols.length, 1) - 1)}${Math.max(ultLinha, r0 + 1)}`;

      const f = new fflate.ZipDeflate(`xl/worksheets/sheet${a + 1}.xml`, { level: 6 });
      zip.add(f);
      const empurra = (txt, ultimo) => f.push(enc.encode(txt), !!ultimo);
      let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + `<worksheet xmlns="${NS}" xmlns:r="${NSR}">`
        + '<sheetViews><sheetView workbookViewId="0"' + (a === 0 ? ' tabSelected="1"' : '') + '>'
        + (comTabela ? `<pane ySplit="${r0}" topLeftCell="A${r0 + 1}" activePane="bottomLeft" state="frozen"/>` : '')
        + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
      if (cols.length) xml += '<cols>' + cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(6, Math.min(60, c.larg || 12)) + 2}" customWidth="1"/>`).join('') + '</cols>';
      xml += '<sheetData>';
      topo.forEach((lin, i) => {
        const r = i + 1;
        xml += `<row r="${r}">` + lin.map((v, j) => {
          if (v == null || v === '') return '';
          const s = i === 0 ? XF.titulo : (j === 0 ? XF.rotulo : 0);
          if (ehData(v)) return `<c r="${col(j)}${r}" s="${XF.datahora}"><v>${serial(v)}</v></c>`;
          if (typeof v === 'number') return `<c r="${col(j)}${r}"><v>${v}</v></c>`;
          return `<c r="${col(j)}${r}" t="s"${s ? ` s="${s}"` : ''}><v>${sst(String(v).replace(INVAL, ''))}</v></c>`;
        }).join('') + '</row>';
      });
      if (cols.length) xml += `<row r="${r0}">` + cab.map((n, j) => `<c r="${col(j)}${r0}" t="s"><v>${sst(n)}</v></c>`).join('') + '</row>';
      empurra(xml);
      const BLOCO = 4000;
      for (let i = 0; i < linhas.length; i += BLOCO) {
        let parte = '';
        const ate = Math.min(linhas.length, i + BLOCO);
        for (let k = i; k < ate; k++) {
          const r = r0 + 1 + k, lin = linhas[k];
          parte += `<row r="${r}">`;
          for (let j = 0; j < cols.length; j++) parte += celula(col(j) + r, lin[j], cols[j].fmt, sst);
          parte += '</row>';
        }
        empurra(parte);
        if (opts.aoProgresso && linhas.length > BLOCO) opts.aoProgresso(a, abas.length, aba, ate);
        await pausa();
      }
      empurra('</sheetData>' + (comTabela ? '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>' : '') + '</worksheet>', true);

      if (comTabela) {
        nTab++;
        arquivo(`xl/worksheets/_rels/sheet${a + 1}.xml.rels`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + `<Relationships xmlns="${NSP}"><Relationship Id="rId1" Type="${NSR}/table" Target="../tables/table${nTab}.xml"/></Relationships>`);
        arquivo(`xl/tables/table${nTab}.xml`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + `<table xmlns="${NS}" id="${nTab}" name="Tabela${nTab}" displayName="Tabela${nTab}" ref="${ref}" totalsRowShown="0">`
          + `<autoFilter ref="${ref}"/><tableColumns count="${cab.length}">`
          + cab.map((n, j) => `<tableColumn id="${j + 1}" name="${esc(n)}"/>`).join('')
          + '</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>');
        aba._tabela = nTab;
      }
    }

    // partes fixas
    const tabelas = abas.filter(a => a._tabela).map(a => a._tabela);
    arquivo('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + `<Override PartName="/xl/workbook.xml" ContentType="${CT}sheet.main+xml"/>`
      + abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT}worksheet+xml"/>`).join('')
      + tabelas.map(t => `<Override PartName="/xl/tables/table${t}.xml" ContentType="${CT}table+xml"/>`).join('')
      + `<Override PartName="/xl/styles.xml" ContentType="${CT}styles+xml"/>`
      + `<Override PartName="/xl/sharedStrings.xml" ContentType="${CT}sharedStrings+xml"/>`
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + '</Types>');
    arquivo('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + `<Relationships xmlns="${NSP}">`
      + `<Relationship Id="rId1" Type="${NSR}/officeDocument" Target="xl/workbook.xml"/>`
      + `<Relationship Id="rId2" Type="${NSR}/extended-properties" Target="docProps/app.xml"/>`
      + '</Relationships>');
    arquivo('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Gestão em Movimento</Application></Properties>');
    arquivo('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + `<workbook xmlns="${NS}" xmlns:r="${NSR}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>`
      + nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
      + '</sheets></workbook>');
    arquivo('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + `<Relationships xmlns="${NSP}">`
      + nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NSR}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${nomes.length + 1}" Type="${NSR}/styles" Target="styles.xml"/>`
      + `<Relationship Id="rId${nomes.length + 2}" Type="${NSR}/sharedStrings" Target="sharedStrings.xml"/>`
      + '</Relationships>');
    arquivo('xl/styles.xml', STYLES);
    // a lista de textos pode ser grande: em blocos também
    const fs = new fflate.ZipDeflate('xl/sharedStrings.xml', { level: 6 });
    zip.add(fs);
    fs.push(enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + `<sst xmlns="${NS}" count="${ssLista.length}" uniqueCount="${ssLista.length}">`));
    for (let i = 0; i < ssLista.length; i += 20000) {
      fs.push(enc.encode(ssLista.slice(i, i + 20000).map(t => '<si><t xml:space="preserve">' + esc(t) + '</t></si>').join('')));
    }
    fs.push(enc.encode('</sst>'), true);
    zip.end();
    await fim;
    if (typeof Blob !== 'undefined' && !opts.bruto) return new Blob(saida, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return saida;
  }

  raiz.XlsxTabela = { monta, nomeAba, serial, XF };
})(typeof window !== 'undefined' ? window : globalThis);
