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

  function monta(cfg) {
    const $ = id => document.getElementById(id);
    const ids = Object.assign({ msgs: 'ia-msgs', txt: 'ia-txt', env: 'ia-env' }, cfg.ids || {});
    const CHAT = !!cfg.chat;            // desenho de chat (página /assistente/)
    const MULTI = !!cfg.lista;          // várias conversas guardadas, com a lista na lateral
    let MSG = [], OCUP = false, CONV = [], ATUAL = null;
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
    function tituloDe(msgs) { const u = msgs.find(m => m.role === 'user'); const t = u ? String(u.content).replace(/\s+/g, ' ').trim() : 'Conversa'; return t.length > 60 ? t.slice(0, 58) + '…' : t; }
    const guarda = () => {
      try {
        if (!MULTI) { localStorage.setItem(cfg.chave, JSON.stringify(MSG.slice(-40))); return; }
        if (MSG.length) {
          let c = CONV.find(x => x.id === ATUAL);
          if (!c) { ATUAL = novoId(); c = { id: ATUAL, titulo: '', em: 0, msgs: [] }; CONV.unshift(c); }
          c.msgs = MSG.slice(-40); c.titulo = tituloDe(MSG); c.em = Date.now();
          CONV.sort((x, y) => y.em - x.em);
        }
        CONV = CONV.slice(0, 60);
        localStorage.setItem(cfg.chave + '_conv', JSON.stringify(CONV));
        localStorage.setItem(cfg.chave + '_atual', ATUAL || '');
      } catch (e) { /* sem armazenamento */ }
    };

    function lista() {
      const el = MULTI && $(cfg.lista); if (!el) return;
      if (!CONV.length) { el.innerHTML = '<div class="ia-cv-vazio">As conversas aparecem aqui.</div>'; return; }
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0); const h = hoje.getTime();
      const grupos = [['Hoje', c => c.em >= h], ['Últimos 7 dias', c => c.em < h && c.em >= h - 6 * 864e5], ['Anteriores', c => c.em < h - 6 * 864e5]];
      el.innerHTML = grupos.map(([rot, f]) => { const cs = CONV.filter(f); if (!cs.length) return '';
        return `<div class="ia-cv-g">${rot}</div>` + cs.map(c => `<div class="ia-cv${c.id === ATUAL ? ' on' : ''}" data-cv="${c.id}" title="${esc(c.titulo)}"><span>${esc(c.titulo)}</span><button class="ia-cv-x" data-cvx="${c.id}" title="Apagar conversa">${SVG_X}</button></div>`).join(''); }).join('');
      el.querySelectorAll('[data-cv]').forEach(d => d.addEventListener('click', e => { if (e.target.closest('[data-cvx]')) return; abreConv(d.dataset.cv); }));
      el.querySelectorAll('[data-cvx]').forEach(b => b.addEventListener('click', () => apagaConv(b.dataset.cvx)));
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
      const corpo = (m, i) => `${m.content ? md(m.content) : pensando(m)}${m.estado && m.content ? pensando(m) : ''}${consultas(m.q)}${m.pe ? `<div class="ia-pe">${esc(m.pe)}</div>` : ''}`;
      if (!CHAT) {
        el.innerHTML = MSG.map(m => m.role === 'user' ? `<div class="ia-m eu">${esc(m.content)}</div>` : `<div class="ia-m ele">${corpo(m)}</div>`).join('');
      } else {
        el.innerHTML = '<div class="ia-col">' + MSG.map((m, i) => m.role === 'user'
          ? `<div class="ia-l eu"><div class="ia-m eu">${esc(m.content)}</div></div>`
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

    async function envia() {
      const t = $(ids.txt); const txt = (t.value || '').trim(); if (!txt || OCUP) return;
      OCUP = true; $(ids.env).disabled = true; t.value = ''; t.style.height = '';
      MSG.push({ role: 'user', content: txt }); const r = { role: 'assistant', content: '', q: [], estado: 'Pensando…' }; MSG.push(r);
      if (MULTI) { guarda(); lista(); }
      pinta();
      const hist = MSG.filter(m => m !== r && m.content).map(m => ({ role: m.role, content: m.content }));
      let ctx = ''; try { ctx = cfg.contexto ? String(cfg.contexto() || '') : ''; } catch (e) { /* sem contexto */ }
      try {
        const session = await cfg.sessao(); if (!session) throw new Error('login vencido: entre de novo pelo hub');
        const resp = await fetch(cfg.fn, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + session.access_token, apikey: cfg.apikey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensagens: hist, contexto: ctx }),
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
          else if (e.t === 'sql') { r.q.push({ sql: e.sql, motivo: e.motivo }); r.estado = 'Consultando: ' + (e.motivo || 'banco') + '…'; }
          else if (e.t === 'res') { const c = [...r.q].reverse().find(x => !x.web); if (c) { if (e.erro) c.erro = e.erro; else { c.linhas = e.linhas; c.truncado = e.truncado; } } r.estado = 'Analisando…'; }
          else if (e.t === 'web') { r.q.push({ web: e.q || 'pesquisa' }); r.estado = 'Pesquisando na web: ' + (e.q || '') + '…'; }
          else if (e.t === 'fim') {
            r.estado = '';
            const partes = [`${e.consultas} consulta${e.consultas === 1 ? '' : 's'}`];
            if (e.web) partes.push(`${e.web} pesquisa${e.web === 1 ? '' : 's'} na web`);
            partes.push(`${e.seg} s`, `US$ ${String(e.custo).replace('.', ',')}`);
            r.pe = partes.join(' · ');
          }
          else if (e.t === 'erro') { r.estado = ''; r.content += (r.content ? '\n\n' : '') + 'Erro: ' + traduz(e.msg); }
        };
        for (;;) {
          const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
          const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(linha);
          if (!pend) pend = requestAnimationFrame(() => { pend = 0; pinta(); });
        }
        linha(buf);
      } catch (err) { r.estado = ''; r.content += (r.content ? '\n\n' : '') + 'Erro: ' + traduz((err && err.message) || err); }
      if (!r.content) r.content = '(sem resposta)'; r.estado = '';
      OCUP = false; $(ids.env).disabled = false; guarda(); lista(); pinta();
    }

    const t = $(ids.txt);
    if (t) {
      t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envia(); } });
      t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = Math.min(200, t.scrollHeight) + 'px'; });
    }
    return { envia, nova, abre, pinta, md, abreConv, apagaConv };
  }

  window.Assistente = { monta, md };
})();
