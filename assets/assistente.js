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

  function monta(cfg) {
    const $ = id => document.getElementById(id);
    const ids = Object.assign({ msgs: 'ia-msgs', txt: 'ia-txt', env: 'ia-env' }, cfg.ids || {});
    let MSG = [], OCUP = false;
    try { const g = JSON.parse(localStorage.getItem(cfg.chave) || '[]'); if (Array.isArray(g)) MSG = g.slice(-40); } catch (e) { /* sem armazenamento */ }
    const guarda = () => { try { localStorage.setItem(cfg.chave, JSON.stringify(MSG.slice(-40))); } catch (e) { /* sem armazenamento */ } };

    function pinta() {
      const el = $(ids.msgs); if (!el) return;
      if (!MSG.length) {
        el.innerHTML = `<div class="ia-vazio"><b>${esc(cfg.titulo || 'Assistente')}</b>${esc(cfg.texto || '')}<div class="ia-ex">${(cfg.exemplos || []).map(x => `<button class="dimb" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>`;
        el.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => { $(ids.txt).value = b.dataset.ex; envia(); }));
        return;
      }
      el.innerHTML = MSG.map(m => m.role === 'user' ? `<div class="ia-m eu">${esc(m.content)}</div>` :
        `<div class="ia-m ele">${m.content ? md(m.content) : `<span class="ia-pensa">${esc(m.estado || 'Pensando…')}</span>`}${m.estado && m.content ? `<div class="ia-pensa">${esc(m.estado)}</div>` : ''}${consultas(m.q)}${m.pe ? `<div class="ia-pe">${esc(m.pe)}</div>` : ''}</div>`).join('');
      el.scrollTop = el.scrollHeight;
    }
    function abre() { pinta(); setTimeout(() => { const t = $(ids.txt); if (t) t.focus(); }, 50); }
    function nova() { if (OCUP) return; MSG = []; guarda(); pinta(); }

    async function envia() {
      const t = $(ids.txt); const txt = (t.value || '').trim(); if (!txt || OCUP) return;
      OCUP = true; $(ids.env).disabled = true; t.value = ''; t.style.height = '';
      MSG.push({ role: 'user', content: txt }); const r = { role: 'assistant', content: '', q: [], estado: 'Pensando…' }; MSG.push(r); pinta();
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
          else if (e.t === 'erro') { r.estado = ''; r.content += (r.content ? '\n\n' : '') + 'Erro: ' + e.msg; }
        };
        for (;;) {
          const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
          const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(linha);
          if (!pend) pend = requestAnimationFrame(() => { pend = 0; pinta(); });
        }
        linha(buf);
      } catch (err) { r.estado = ''; r.content += (r.content ? '\n\n' : '') + 'Erro: ' + ((err && err.message) || err); }
      if (!r.content) r.content = '(sem resposta)'; r.estado = '';
      OCUP = false; $(ids.env).disabled = false; guarda(); pinta();
    }

    const t = $(ids.txt);
    if (t) {
      t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envia(); } });
      t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; });
    }
    return { envia, nova, abre, pinta, md };
  }

  window.Assistente = { monta, md };
})();
