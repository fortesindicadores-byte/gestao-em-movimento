/* ══════════════════════════════════════════════════════════════════════════
   Assistente do portal (Renan, 28/10/2026: "Quero para tudo do Gestão em
   Movimento. Banco, tudo"). A conversa da tela; quem responde é a Edge
   Function do Supabase (supabase/functions/assistente-ft), que fala com o
   Claude, consulta o banco só para leitura e pesquisa na web.

   Uso (a página já tem os elementos e o supabase-js):
     const IA = Assistente.monta({
       fn: SUPABASE_URL + '/functions/v1/rapid-processor', apikey: SUPABASE_KEY,
       sessao: async () => (await sb.auth.getSession()).data.session,
       chave: 'gem_assistente',           // onde a conversa fica neste navegador
       ids: { msgs: 'ia-msgs', txt: 'ia-txt', env: 'ia-env' },
       titulo: 'Assistente', texto: 'Responde com o que está no banco…',
       exemplos: ['…'], contexto: () => 'o que está na tela',
     });
     IA.envia(); IA.nova(); IA.abre();
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = n => Number(n || 0).toLocaleString('pt-BR');
  // erro da API em português (o do crédito é o que mais vai aparecer)
  function traduz(m) {
    const t = String(m || '');
    if (/credit balance|insufficient.*credit|billing/i.test(t)) return 'Os créditos da API acabaram. O assistente volta a responder quando entrar crédito (o do plano renova todo mês) ou com saldo em Billing no Console da Anthropic. Nada é cobrado a mais.';
    if (/rate.?limit|429/i.test(t)) return 'Muitas perguntas seguidas: o limite da API foi atingido. Espere um minuto e tente de novo.';
    if (/overloaded|529/i.test(t)) return 'A API está sobrecarregada agora. Tente de novo em alguns minutos.';
    if (/invalid.*api.?key|authentication|401/i.test(t)) return 'A chave da API não foi aceita. Confira o segredo ANTHROPIC_API_KEY da função no Supabase.';
    return t;
  }

  // Markdown mínimo: tabelas (coluna numérica à direita), listas, negrito, código, títulos
  function md(t) {
    const linhas = esc(t).split('\n'), out = []; let i = 0;
    const inl = x => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const num = c => /^[-+]?\s*(R\$\s*)?[-+]?[\d.,]+\s*(%|mi|mil|km|L|km\/L|pp|h|d)?$/.test(c.trim());
    while (i < linhas.length) {
      const l = linhas[i];
      if (/^\s*\|/.test(l)) {
        const bl = []; while (i < linhas.length && /^\s*\|/.test(linhas[i])) bl.push(linhas[i++]);
        const cel = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const corpo = bl.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)); if (!corpo.length) continue;
        const cab = cel(corpo[0]), rs = corpo.slice(1).map(cel);
        const nn = cab.map((_, k) => rs.length && rs.every(r => !r[k] || num(r[k])));
        out.push('<table><thead><tr>' + cab.map((c, k) => `<th${nn[k] ? ' class="n"' : ''}>${inl(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rs.map(r => '<tr>' + cab.map((_, k) => `<td${nn[k] ? ' class="n"' : ''}>${inl(r[k] || '')}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        const it = []; while (i < linhas.length && /^\s*[-*]\s+/.test(linhas[i])) it.push(linhas[i++].replace(/^\s*[-*]\s+/, ''));
        out.push('<ul>' + it.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>'); continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        const it = []; while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) it.push(linhas[i++].replace(/^\s*\d+[.)]\s+/, ''));
        out.push('<ol>' + it.map(x => '<li>' + inl(x) + '</li>').join('') + '</ol>'); continue;
      }
      const h = l.match(/^\s*#{1,4}\s+(.*)$/); if (h) { out.push('<h4>' + inl(h[1]) + '</h4>'); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const p = []; while (i < linhas.length && linhas[i].trim() && !/^\s*(\||[-*]\s|\d+[.)]\s|#)/.test(linhas[i])) p.push(linhas[i++]);
      out.push('<p>' + inl(p.join('<br>')) + '</p>');
    }
    return out.join('');
  }

  function consultas(q) {
    if (!q || !q.length) return '';
    const nb = q.filter(c => !c.web).length, nw = q.length - nb;
    const rot = [nb ? `${nb} consulta${nb > 1 ? 's' : ''} ao banco` : '', nw ? `${nw} pesquisa${nw > 1 ? 's' : ''} na web` : ''].filter(Boolean).join(' · ');
    return `<details class="ia-q"><summary>${rot}</summary><ul>` +
      q.map(c => c.web
        ? `<li>Web: ${esc(c.web)}</li>`
        : `<li title="${esc(c.sql || '')}">${esc(c.motivo || 'consulta')}${c.erro ? ` · <span class="er">recusada: ${esc(c.erro)}</span>` : c.linhas != null ? ` · ${br(c.linhas)} linha${c.linhas === 1 ? '' : 's'}${c.truncado ? ' (cortado)' : ''}` : ''}</li>`).join('') +
      '</ul></details>';
  }

  const SVG_IA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.5l-.8-1.9-1.9-.8 1.9-.8z"/></svg>';
  const SVG_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  const SVG_LAPIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const SVG_PARA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
  const SVG_DOC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  const SVG_CLIPE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L6 21"/></svg>';
  // o que é da conversa e não da página (imagem anexada, renomear, parar) leva o estilo junto
  const CSS = `
.ia-anx{display:flex;flex-wrap:wrap;gap:8px;width:100%;max-width:820px;margin:0 auto;padding:6px 16px 0;box-sizing:border-box;}
.ia-anx:empty{display:none;}
.ia-anx-i{position:relative;width:64px;height:64px;border-radius:9px;overflow:hidden;border:1px solid var(--card-brd,rgba(255,255,255,.12));background:var(--hover,rgba(255,255,255,.06));}
.ia-anx-i img{width:100%;height:100%;object-fit:cover;display:block;}
.ia-anx-i button{position:absolute;top:2px;right:2px;width:18px;height:18px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0;}
.ia-anx-i button svg{width:10px;height:10px;}
.ia-imgs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;justify-content:flex-end;}
.ia-anx-a{display:flex;align-items:center;gap:6px;height:64px;max-width:230px;padding:0 26px 0 10px;border-radius:9px;position:relative;border:1px solid var(--card-brd,rgba(255,255,255,.12));background:var(--hover,rgba(255,255,255,.06));font-size:11.5px;line-height:1.3;color:var(--txt,#fff);box-sizing:border-box;}
.ia-anx-a b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px;}
.ia-anx-a span{color:var(--txt3,#A9B1C0);font-size:10.5px;}
.ia-anx-a button{position:absolute;top:4px;right:4px;width:18px;height:18px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;display:grid;place-items:center;padding:0;}
.ia-anx-a button svg{width:10px;height:10px;}
.ia-arqs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;justify-content:flex-end;}
.ia-arqs span{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;border:1px solid var(--card-brd,rgba(255,255,255,.12));font-size:11.5px;}
.ia-imgs img{max-width:220px;max-height:160px;border-radius:9px;display:block;border:1px solid var(--card-brd,rgba(255,255,255,.12));}
.ia-clip{flex:0 0 auto;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--txt3,#A9B1C0);cursor:pointer;display:grid;place-items:center;align-self:flex-end;margin-bottom:3px;}
.ia-clip:hover{background:var(--hover,rgba(255,255,255,.06));color:var(--txt,#fff);}
.ia-solta{outline:2px dashed var(--laranja,#F97316);outline-offset:-4px;}
.ia-cv-e{flex:0 0 20px;width:20px;height:20px;border:0;background:transparent;color:var(--txt3,#A9B1C0);cursor:pointer;border-radius:5px;display:none;place-items:center;padding:0;}
.ia-cv-e svg{width:12px;height:12px;}
.ia-cv:hover .ia-cv-e{display:grid;} .ia-cv-e:hover{color:var(--laranja,#F97316);background:var(--hover,rgba(255,255,255,.06));}
.ia-cv input.ia-cv-in{flex:1;min-width:0;background:var(--pop,#26262B);color:var(--txt,#fff);border:1px solid var(--laranja,#F97316);border-radius:6px;padding:3px 6px;font:inherit;font-size:11.5px;outline:0;}
.ia-parando{background:var(--vermelho,#FF5252)!important;color:#fff!important;border-color:transparent!important;}
`;
  function estilos() { if (document.getElementById('ia-css-comp')) return; const st = document.createElement('style'); st.id = 'ia-css-comp'; st.textContent = CSS; document.head.appendChild(st); }

  // título de partida, antes do título que a função devolve: tira o cabeçalho de mensagem colada
  // do WhatsApp ("[09:52, 17/11/2026] Fulano: ") e o cumprimento, e fica com o começo da 1ª frase
  function tituloLocal(txt) {
    let t = String(txt || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/^(\[\d{1,2}:\d{2},?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*[^:\[\]]{1,40}:\s*)+/, '');
    t = t.replace(/^(oi|olá|ola|bom dia|boa tarde|boa noite|por favor)[,!. ]+/i, '');
    const frase = (t.split(/[.?!\n](\s|$)/)[0] || t).trim();
    const pal = frase.split(' '); let out = '';
    for (const w of pal) { if ((out + ' ' + w).trim().length > 46) break; out = (out + ' ' + w).trim(); }
    out = out || frase.slice(0, 46);
    if (out.length < frase.length) out += '…';
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
  }

  // imagem colada ou arrastada: reduzida no navegador (lado maior até 1568 px, JPEG) para o
  // pedido não ficar pesado; a miniatura é o que fica guardado na conversa
  function reduz(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file); const im = new Image();
      im.onload = () => {
        try {
          const des = (max, q) => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
            const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); };
          const cheia = des(1568, 0.88), mini = des(260, 0.72);
          URL.revokeObjectURL(url); res({ tipo: 'image/jpeg', b64: cheia.split(',')[1], mini });
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('não consegui ler a imagem')); };
      im.src = url;
    });
  }

  // arquivo (PDF, Excel, CSV, texto): o PDF vai inteiro em base64; planilha e texto viram texto
  // no navegador (planilha = uma seção CSV por aba), com teto para a pergunta não ficar enorme
  const MAX_TXT = 200000, MAX_PDF = 12 * 1048576;
  const EXT_PLAN = /\.(xlsx|xlsm|xlsb|xls|ods)$/i, EXT_TXT = /\.(csv|tsv|txt|md|json|xml|sql|log)$/i;
  let _xlsx = null;
  function carregaXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (_xlsx) return _xlsx;
    _xlsx = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      sc.onload = () => window.XLSX ? res(window.XLSX) : rej(new Error('leitor de Excel não carregou')); sc.onerror = () => { _xlsx = null; rej(new Error('leitor de Excel não carregou')); }; document.head.appendChild(sc); });
    return _xlsx;
  }
  const b64De = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const tamanho = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  async function leArquivo(f) {
    const nome = f.name || 'arquivo';
    if (/pdf/i.test(f.type || '') || /\.pdf$/i.test(nome)) {
      if (f.size > MAX_PDF) throw new Error('PDF acima de 12 MB');
      return { tipo: 'application/pdf', b64: b64De(await f.arrayBuffer()), nome, rot: 'PDF · ' + tamanho(f.size) };
    }
    let texto, rot;
    if (EXT_PLAN.test(nome) || /spreadsheet|ms-excel/i.test(f.type || '')) {
      const X = await carregaXlsx();
      const wb = X.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellDates: true });
      texto = wb.SheetNames.map(n => `=== Aba: ${n} ===\n` + X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false, dateNF: 'dd/mm/yyyy' })).join('\n\n');
      rot = 'Excel · ' + wb.SheetNames.length + (wb.SheetNames.length === 1 ? ' aba' : ' abas');
    } else if (EXT_TXT.test(nome) || /^text\//.test(f.type || '') || /json/.test(f.type || '')) {
      texto = await f.text(); rot = (nome.split('.').pop() || 'texto').toUpperCase() + ' · ' + tamanho(f.size);
    } else if (/\.docx?$/i.test(nome)) {
      throw new Error('Word ainda não: salve como PDF e anexe');
    } else throw new Error('tipo de arquivo que o assistente não lê');
    let cortado = false;
    if (texto.length > MAX_TXT) { texto = texto.slice(0, MAX_TXT); cortado = true; }
    if (cortado) { texto += `\n\n[arquivo cortado em ${MAX_TXT.toLocaleString('pt-BR')} caracteres]`; rot += ' · cortado'; }
    return { tipo: 'text/plain', texto, nome, rot };
  }

  function monta(cfg) {
    estilos();
    const $ = id => document.getElementById(id);
    const ids = Object.assign({ msgs: 'ia-msgs', txt: 'ia-txt', env: 'ia-env' }, cfg.ids || {});
    const CHAT = !!cfg.chat;            // desenho de chat (página /assistente/)
    const MULTI = !!cfg.lista;          // várias conversas guardadas, com a lista na lateral
    let MSG = [], OCUP = false, CONV = [], ATUAL = null;
    let ANX = [];                       // imagens esperando a próxima pergunta
    const CHEIA = {};                   // id → {tipo, b64} (imagem, PDF) ou {tipo, texto} (planilha, texto): o anexo inteiro, só nesta sessão do navegador
    let CTRL = null, PAROU = false;     // o pedido em andamento e se foi o usuário que parou
    const novoId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    if (MULTI) {
      try { const g = JSON.parse(localStorage.getItem(cfg.chave + '_conv') || '[]'); if (Array.isArray(g)) CONV = g; } catch (e) { /* sem armazenamento */ }
      // a conversa única da 1ª versão vira a 1ª conversa da lista
      try { const v = JSON.parse(localStorage.getItem(cfg.chave) || 'null');
        if (Array.isArray(v) && v.length && !CONV.length) CONV.push({ id: novoId(), titulo: tituloDe(v), em: Date.now(), msgs: v.slice(-40) });
        localStorage.removeItem(cfg.chave); } catch (e) { /* sem armazenamento */ }
      try { ATUAL = localStorage.getItem(cfg.chave + '_atual'); } catch (e) { /* sem armazenamento */ }
      const c = CONV.find(x => x.id === ATUAL);
      if (c) MSG = c.msgs; else ATUAL = null;
    } else {
      try { const g = JSON.parse(localStorage.getItem(cfg.chave) || '[]'); if (Array.isArray(g)) MSG = g.slice(-40); } catch (e) { /* sem armazenamento */ }
    }
    function tituloDe(msgs) { const u = msgs.find(m => m.role === 'user'); return (u && tituloLocal(u.content)) || (u && u.arqs && u.arqs.length ? u.arqs[0].nome : u && u.imgs ? 'Imagem' : 'Conversa'); }
    // grava a lista; se não couber (miniaturas de imagem pesam), solta as conversas mais antigas
    const persiste = () => {
      for (let n = 0; n < 6; n++) {
        try { localStorage.setItem(cfg.chave + '_conv', JSON.stringify(CONV)); localStorage.setItem(cfg.chave + '_atual', ATUAL || ''); return; }
        catch (e) { if (CONV.length <= 1) return; CONV = CONV.slice(0, Math.max(1, Math.floor(CONV.length * 0.7))); }
      }
    };
    const guarda = () => {
      try {
        if (!MULTI) { localStorage.setItem(cfg.chave, JSON.stringify(MSG.slice(-40))); return; }
        if (MSG.length) {
          let c = CONV.find(x => x.id === ATUAL);
          if (!c) { ATUAL = novoId(); c = { id: ATUAL, titulo: '', em: 0, msgs: [] }; CONV.unshift(c); }
          c.msgs = MSG.slice(-40); c.em = Date.now();
          if (!c.titulo) c.titulo = tituloDe(MSG);      // o título só nasce aqui; depois vem o da função ou o que a pessoa escrever
          CONV.sort((x, y) => y.em - x.em);
        }
        CONV = CONV.slice(0, 60);
        persiste();
      } catch (e) { /* sem armazenamento */ }
    };

    function lista() {
      const el = MULTI && $(cfg.lista); if (!el) return;
      if (!CONV.length) { el.innerHTML = '<div class="ia-cv-vazio">As conversas aparecem aqui.</div>'; return; }
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const h = hoje.getTime();
      const grupos = [['Hoje', c => c.em >= h], ['Últimos 7 dias', c => c.em < h && c.em >= h - 6 * 864e5], ['Anteriores', c => c.em < h - 6 * 864e5]];
      el.innerHTML = grupos.map(([rot, f]) => { const cs = CONV.filter(f); if (!cs.length) return '';
        return `<div class="ia-cv-g">${rot}</div>` + cs.map(c => `<div class="ia-cv${c.id === ATUAL ? ' on' : ''}" data-cv="${c.id}" title="${esc(c.titulo)}"><span>${esc(c.titulo || 'Conversa')}</span><button class="ia-cv-e" data-cve="${c.id}" title="Renomear conversa">${SVG_LAPIS}</button><button class="ia-cv-x" data-cvx="${c.id}" title="Apagar conversa">${SVG_X}</button></div>`).join(''); }).join('');
      el.querySelectorAll('[data-cv]').forEach(d => {
        d.addEventListener('click', e => { if (e.target.closest('[data-cvx],[data-cve],.ia-cv-in')) return; abreConv(d.dataset.cv); });
        d.addEventListener('dblclick', e => { if (e.target.closest('[data-cvx],.ia-cv-in')) return; renomeia(d.dataset.cv); });
      });
      el.querySelectorAll('[data-cvx]').forEach(b => b.addEventListener('click', () => apagaConv(b.dataset.cvx)));
      el.querySelectorAll('[data-cve]').forEach(b => b.addEventListener('click', () => renomeia(b.dataset.cve)));
    }
    // renomear no lugar: Enter ou sair do campo grava, Esc desiste. O título escrito à mão
    // (c.tm) não é mais trocado pelo automático.
    function renomeia(id) {
      const el = MULTI && $(cfg.lista); const c = CONV.find(x => x.id === id); if (!el || !c) return;
      const d = el.querySelector(`[data-cv="${id}"]`); const sp = d && d.querySelector('span'); if (!sp) return;
      const inp = document.createElement('input'); inp.className = 'ia-cv-in'; inp.value = c.titulo || ''; inp.maxLength = 60; inp.setAttribute('aria-label', 'Nome da conversa');
      sp.replaceWith(inp); inp.focus(); inp.select();
      let feito = false;
      const fim = grava => { if (feito) return; feito = true;
        const v = inp.value.replace(/\s+/g, ' ').trim();
        if (grava && v && v !== c.titulo) { c.titulo = v; c.tm = true; persiste(); }
        lista(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fim(true); } else if (e.key === 'Escape') { e.preventDefault(); fim(false); } e.stopPropagation(); });
      inp.addEventListener('blur', () => fim(true));
      inp.addEventListener('click', e => e.stopPropagation());
    }
    function abreConv(id) { if (OCUP) return; const c = CONV.find(x => x.id === id); if (!c) return; ATUAL = id; MSG = c.msgs; guarda(); lista(); abre(); }
    function apagaConv(id) {
      if (OCUP && id === ATUAL) return;
      if (!confirm('Apagar esta conversa?')) return;
      CONV = CONV.filter(x => x.id !== id); if (id === ATUAL) { ATUAL = null; MSG = []; }
      guarda(); lista(); pinta();
    }

    const pensando = m => `<span class="ia-pensa"><span class="ia-dots"><i></i><i></i><i></i></span>${esc(m.estado || 'Pensando…')}</span>`;
    function pinta() {
      const el = $(ids.msgs); if (!el) return;
      if (!MSG.length) {
        el.innerHTML = CHAT
          ? `<div class="ia-ola"><div class="ia-logo">${SVG_IA}</div><h2>${esc(cfg.saudacao || cfg.titulo || 'Assistente')}</h2><p>${esc(cfg.texto || '')}</p><div class="ia-cards">${(cfg.exemplos || []).map(x => `<button class="ia-card" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`
          : `<div class="ia-vazio"><b>${esc(cfg.titulo || 'Assistente')}</b>${esc(cfg.texto || '')}<div class="ia-ex">${(cfg.exemplos || []).map(x => `<button class="dimb" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
        el.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $(ids.txt).value = b.dataset.ex; envia(); }));
        return;
      }
      const imgsDe = m => (m.imgs && m.imgs.length ? `<div class="ia-imgs">${m.imgs.map(i => `<img src="${esc(i.mini)}" alt="imagem enviada">`).join('')}</div>` : '') +
        (m.arqs && m.arqs.length ? `<div class="ia-arqs">${m.arqs.map(a => `<span title="${esc(a.rot || '')}">${SVG_DOC}${esc(a.nome)}</span>`).join('')}</div>` : '');
      const corpo = (m, i) => `${m.content ? md(m.content) : pensando(m)}${m.estado && m.content ? pensando(m) : ''}${consultas(m.q)}${m.pe ? `<div class="ia-pe">${esc(m.pe)}</div>` : ''}`;
      if (!CHAT) {
        el.innerHTML = MSG.map(m => m.role === 'user' ? `<div class="ia-m eu">${imgsDe(m)}${esc(m.content)}</div>` : `<div class="ia-m ele">${corpo(m)}</div>`).join('');
      } else {
        el.innerHTML = '<div class="ia-col">' + MSG.map((m, i) => m.role === 'user'
          ? `<div class="ia-l eu"><div class="ia-m eu">${imgsDe(m)}${esc(m.content)}</div></div>`
          : `<div class="ia-l ele"><span class="ia-av">${SVG_IA}</span><div class="ia-m ele">${corpo(m)}${m.content && !m.estado ? `<div class="ia-acoes"><button class="ia-copia" data-cp="${i}">Copiar</button></div>` : ''}</div></div>`).join('') + '</div>';
        el.querySelectorAll('[data-cp]').forEach(b => b.addEventListener('click', () => {
          const t = (MSG[+b.dataset.cp] || {}).content || '';
          (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar'; }, 1500); }).catch(() => {});
        }));
      }
      el.scrollTop = el.scrollHeight;
    }
    function abre() { pinta(); lista(); setTimeout(() => { const t = $(ids.txt); if (t) t.focus(); }, 50); }
    function nova() { if (OCUP) return; if (MULTI) { ATUAL = null; MSG = []; guarda(); lista(); abre(); return; } MSG = []; guarda(); pinta(); }

    // ── imagens: colar (Ctrl+V), arrastar ou escolher ──
    let anxEl = null, fileEl = null;
    function pintaAnx() {
      const t = $(ids.txt); if (!t) return;
      if (!anxEl) { anxEl = document.createElement('div'); anxEl.className = 'ia-anx'; const ref = t.closest('.ia-in') || t.parentNode; ref.parentNode.insertBefore(anxEl, ref); }
      anxEl.innerHTML = ANX.map(a => a.mini
        ? `<div class="ia-anx-i"><img src="${esc(a.mini)}" alt="imagem a enviar"><button data-anx="${a.id}" title="Tirar a imagem">${SVG_X}</button></div>`
        : `<div class="ia-anx-a">${SVG_DOC}<div><b title="${esc(a.nome)}">${esc(a.nome)}</b><span>${esc(a.rot)}</span></div><button data-anx="${a.id}" title="Tirar o arquivo">${SVG_X}</button></div>`).join('');
      anxEl.querySelectorAll('[data-anx]').forEach(b => b.addEventListener('click', () => { ANX = ANX.filter(a => a.id !== b.dataset.anx); pintaAnx(); }));
    }
    async function anexa(files) {
      for (const f of [...(files || [])].filter(Boolean)) {
        if (ANX.length >= 4) { alert('Até 4 anexos por pergunta.'); break; }
        if (/^image\//.test(f.type || '')) {
          try { const r = await reduz(f); ANX.push(Object.assign({ id: novoId() }, r)); pintaAnx(); }
          catch (e) { alert('Não consegui ler essa imagem.'); }
          continue;
        }
        try { const r = await leArquivo(f); ANX.push(Object.assign({ id: novoId() }, r)); pintaAnx(); }
        catch (e) { alert(`Não consegui ler ${f.name || 'o arquivo'}: ${(e && e.message) || e}.`); }
      }
      const t = $(ids.txt); if (t) t.focus();
    }

    // o botão de enviar vira Parar enquanto a resposta está vindo
    let BT_HTML = null;
    function botao(ocupado) {
      const b = $(ids.env); if (!b) return;
      if (BT_HTML == null) BT_HTML = b.innerHTML;
      b.disabled = false; b.classList.toggle('ia-parando', ocupado);
      b.innerHTML = ocupado ? (/<svg/i.test(BT_HTML) ? SVG_PARA : 'Parar') : BT_HTML;
      b.title = ocupado ? 'Parar a consulta' : 'Enviar (Enter)';
    }
    function para() { if (!OCUP || !CTRL) return; PAROU = true; try { CTRL.abort(); } catch (e) { /* já terminou */ } }

    async function envia() {
      if (OCUP) { para(); return; }
      const t = $(ids.txt); const txt = (t.value || '').trim(); if (!txt && !ANX.length) return;
      OCUP = true; PAROU = false; CTRL = new AbortController(); botao(true); t.value = ''; t.style.height = '';
      const anexos = ANX; ANX = []; pintaAnx();
      const aImg = anexos.filter(a => a.mini), aArq = anexos.filter(a => !a.mini);
      const um = { role: 'user', content: txt || (aArq.length ? (aArq.length > 1 ? 'Veja os arquivos.' : 'Veja o arquivo.') : aImg.length > 1 ? 'Veja as imagens.' : 'Veja a imagem.') };
      if (aImg.length) um.imgs = aImg.map(a => ({ id: a.id, mini: a.mini }));
      if (aArq.length) um.arqs = aArq.map(a => ({ id: a.id, nome: a.nome, rot: a.rot }));
      anexos.forEach(a => { CHEIA[a.id] = a.mini ? { tipo: a.tipo, b64: a.b64 } : (a.b64 ? { tipo: a.tipo, b64: a.b64, nome: a.nome } : { tipo: a.tipo, texto: a.texto, nome: a.nome }); });
      MSG.push(um); const r = { role: 'assistant', content: '', q: [], estado: 'Pensando…' }; MSG.push(r);
      if (MULTI) { guarda(); lista(); }
      pinta();
      const conv = MULTI ? CONV.find(x => x.id === ATUAL) : null;
      // título automático: a função devolve um na 1ª pergunta da conversa (se ninguém renomeou)
      const pedeTitulo = !!conv && !conv.tm && MSG.filter(m => m.role === 'user').length === 1;
      const hist = MSG.filter(m => m !== r && m.content).map(m => {
        const o = { role: m.role, content: m.content };
        if (m.role === 'user' && m.imgs && m.imgs.length) {
          const vivas = m.imgs.map(i => CHEIA[i.id]).filter(Boolean);
          if (vivas.length) o.imagens = vivas;
          if (vivas.length < m.imgs.length) o.content += `\n\n[${m.imgs.length - vivas.length} imagem(ns) enviada(s) aqui antes não está(ão) mais disponível(is)]`;
        }
        if (m.role === 'user' && m.arqs && m.arqs.length) {
          const vivos = m.arqs.map(a => CHEIA[a.id]).filter(Boolean);
          if (vivos.length) o.arquivos = vivos;
          const foram = m.arqs.filter(a => !CHEIA[a.id]).map(a => a.nome);
          if (foram.length) o.content += `\n\n[arquivo(s) enviado(s) aqui antes e que não estão mais disponíveis: ${foram.join(', ')}]`;
        }
        // as consultas já feitas vão junto (sem resultado), para a função não redescobrir o banco
        if (m.role === 'assistant' && m.q && m.q.length) { const qs = m.q.filter(c => c.sql && !c.erro).slice(-12).map(c => ({ motivo: c.motivo, sql: c.sql })); if (qs.length) o.consultas = qs; }
        return o;
      });
      let ctx = ''; try { ctx = cfg.contexto ? String(cfg.contexto() || '') : ''; } catch (e) { /* sem contexto */ }
      let terminou = false, ver = null, falhou = false;
      try {
        const session = await cfg.sessao(); if (!session) throw new Error('login vencido: entre de novo pelo hub');
        const resp = await fetch(cfg.fn, {
          method: 'POST', signal: CTRL.signal,
          headers: { Authorization: 'Bearer ' + session.access_token, apikey: cfg.apikey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensagens: hist, contexto: ctx, titulo: pedeTitulo }),
        });
        if (!resp.ok || !/ndjson/.test(resp.headers.get('content-type') || '')) {
          let m = ''; try { const j = await resp.json(); m = j.erro || j.message || j.msg || ''; } catch (e) { /* corpo sem JSON */ }
          if (resp.status === 404) m = 'a função do assistente ainda não foi publicada no Supabase';
          throw new Error(m || ('HTTP ' + resp.status));
        }
        const rd = resp.body.getReader(), dec = new TextDecoder(); let buf = '', pend = 0;
        const linha = l => {
          if (!l.trim()) return; let e; try { e = JSON.parse(l); } catch (_) { return; }
          if (e.t === 'txt') { r.content += e.d; r.estado = ''; }
          else if (e.t === 'ver') { ver = e; }
          else if (e.t === 'titulo') { if (conv && !conv.tm && e.d) { conv.titulo = String(e.d).slice(0, 60); persiste(); lista(); } }
          else if (e.t === 'sql') { r.q.push({ sql: e.sql, motivo: e.motivo }); r.estado = 'Consultando: ' + (e.motivo || 'banco') + '…'; }
          else if (e.t === 'res') { const c = [...r.q].reverse().find(x => !x.web); if (c) { if (e.erro) c.erro = e.erro; else { c.linhas = e.linhas; c.truncado = e.truncado; } } r.estado = 'Analisando…'; }
          else if (e.t === 'web') { r.q.push({ web: e.q || 'pesquisa' }); r.estado = 'Pesquisando na web: ' + (e.q || '') + '…'; }
          else if (e.t === 'fim') {
            terminou = true; r.estado = '';
            const partes = [`${e.consultas} consulta${e.consultas === 1 ? '' : 's'}`];
            if (e.web) partes.push(`${e.web} pesquisa${e.web === 1 ? '' : 's'} na web`);
            partes.push(`${e.seg} s`, `US$ ${String(e.custo).replace('.', ',')}`);
            if (e.limite) partes.push('parou no limite de tempo ou de consultas');
            r.pe = partes.join(' · ');
          }
          else if (e.t === 'erro') { terminou = true; falhou = true; r.estado = ''; r.content += (r.content ? '\n\n' : '') + 'Erro: ' + traduz(e.msg); }
        };
        for (;;) {
          const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
          const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(linha);
          if (!pend) pend = requestAnimationFrame(() => { pend = 0; pinta(); });
        }
        linha(buf);
      } catch (err) { falhou = true; if (!PAROU) r.content += (r.content ? '\n\n' : '') + 'Erro: ' + traduz((err && err.message) || err); }
      r.estado = '';
      if (PAROU) { r.pe = 'Consulta interrompida por você'; if (!r.content) r.content = '(Consulta interrompida.)'; }
      else if (!terminou && !falhou) {
        // a conexão fechou sem o evento de fim: a função morreu no meio (tempo limite do Supabase)
        r.content += (r.content ? '\n\n' : '') + 'A resposta foi interrompida antes de terminar: a função passou do tempo limite. Peça de novo com um recorte menor (um mês, uma unidade, uma tabela por vez).';
      }
      if (!PAROU && !falhou && aImg.length && !(ver && ver.img > 0)) r.content += '\n\n(A função publicada no Supabase ainda não lê imagens: esta resposta não viu o anexo. Atualize a função para a versão nova.)';
      if (!PAROU && !falhou && aArq.length && !(ver && ver.arq > 0)) r.content += '\n\n(A função publicada no Supabase ainda não lê arquivos: esta resposta não viu o anexo. Atualize a função para a versão nova.)';
      if (!r.content) r.content = '(sem resposta)';
      OCUP = false; CTRL = null; botao(false); guarda(); lista(); pinta();
    }

    const t = $(ids.txt);
    if (t) {
      t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!OCUP) envia(); } else if (e.key === 'Escape' && OCUP) { para(); } });
      t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = Math.min(200, t.scrollHeight) + 'px'; });
      // colar: print ou imagem copiada vira anexo; texto (mesmo vindo junto de uma imagem, como
      // célula do Excel) continua sendo colado como texto
      t.addEventListener('paste', e => {
        const cd = e.clipboardData; if (!cd) return;
        const fs = [...(cd.items || [])].filter(i => i.kind === 'file' && /^image\//.test(i.type)).map(i => i.getAsFile()).filter(Boolean);
        if (!fs.length) return;
        if ((cd.getData('text/plain') || '').trim()) return;
        e.preventDefault(); anexa(fs);
      });
      // arrastar para a caixa ou para a conversa
      const zona = t.closest('.ia') || t.closest('.ia-in') || t.parentNode;
      if (zona) {
        const tem = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
        zona.addEventListener('dragover', e => { if (!tem(e)) return; e.preventDefault(); zona.classList.add('ia-solta'); });
        zona.addEventListener('dragleave', e => { if (e.target === zona) zona.classList.remove('ia-solta'); });
        zona.addEventListener('drop', e => { if (!tem(e)) return; e.preventDefault(); zona.classList.remove('ia-solta'); anexa(e.dataTransfer.files); });
      }
      // botão de anexar, na caixa do chat
      const box = t.closest('.ia-box');
      if (box && !box.querySelector('.ia-clip')) {
        fileEl = document.createElement('input'); fileEl.type = 'file'; fileEl.accept = 'image/*,.pdf,.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt,.md,.json'; fileEl.multiple = true; fileEl.style.display = 'none';
        fileEl.addEventListener('change', () => { anexa(fileEl.files); fileEl.value = ''; });
        const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'ia-clip'; bt.title = 'Anexar imagem, PDF ou Excel (ou cole o print com Ctrl+V)'; bt.innerHTML = SVG_CLIPE;
        bt.addEventListener('click', () => fileEl.click());
        box.insertBefore(bt, t); box.appendChild(fileEl);
      }
    }
    return { envia, nova, abre, pinta, md, abreConv, apagaConv, renomeia, para, anexa };
  }

  window.Assistente = { monta, md };
})();
