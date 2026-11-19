/* ============================================================
   ACESSOS NO APP (Renan, 19/11/2026: "Nao consigo nem no link nem no app,
   mobile, gerenciar os acessos. Alterar senha etc. … Ideia seria no app de
   forma objetiva e fácil").
   Só admin vê a entrada (Perfil → Gerenciar acessos). Lista com busca e os
   filtros de situação; tocar no nome abre a pessoa: situação, senha
   provisória (com copiar e mandar no WhatsApp), liberar cadastro, encerrar
   sessões e as unidades do FCA. Usa as MESMAS funções do Gerenciar Acessos do
   hub (master_* no banco, user_approvals e fca_profiles), então as regras de
   hierarquia continuam no banco: admin comum não mexe em Admin nem Master.
   ============================================================ */
var AC = { master: false, ap: [], mu: {}, prof: {}, filtro: 'pending', busca: '', id: null, fca: null, senha: '' };
var AC_UNIS = ['CGR', 'BLC', 'CBA T1', 'CBA T1 WH', 'CBA T2', 'FLP', 'GRL', 'NFR', 'PLT', 'RON', 'MCC T1', 'MCC T2', 'PIR', 'GNA', 'ANG'];
var AC_CARGOS = ['Gestor de Frota', 'Gestor de Unidade', 'Gestor de Área', 'Gestor Regional', 'Gestor', 'Time Frota'];
var AC_ST = { approved: 'Ativo', pending: 'Aguardando', blocked: 'Bloqueado' };
var AC_NOTIFY = SUPABASE_URL + '/functions/v1/quick-task';   // notify-user do hub

function acErro(e) {
  var m = (e && (e.message || e.details)) || String(e || '');
  if (/permission|not allowed|recusad|privil/i.test(m)) return 'Sem permissão para isso. Admin e Master só o Master altera.';
  if (/network|fetch/i.test(m)) return 'Sem conexão. Tente de novo.';
  return m || 'Não deu certo.';
}
function acDt(s) { if (!s) return ''; var d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function acUnis(p) { return String((p && p.unidade) || '').toUpperCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
function acTel(s) { var d = String(s || '').replace(/\D/g, ''); if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2); return d; }

/* uma linha por pessoa: quem está no user_approvals + (para o Master) quem travou fora dela */
function acLinhas() {
  var por = {};
  AC.ap.forEach(function (a) {
    por[a.user_id] = { id: a.user_id, nome: String(a.name || '').toUpperCase(), email: String(a.email || '').toLowerCase(), tel: a.phone || '', st: a.status || 'pending', cad: a.created_at };
  });
  Object.keys(AC.mu).forEach(function (id) {
    var m = AC.mu[id], r = por[id];
    if (!r) por[id] = r = { id: id, nome: String(m.nome || '').toUpperCase(), email: String(m.email || '').toLowerCase(), tel: m.telefone || '', st: m.status || 'pending', cad: m.criado, semAprov: true };
    r.m = m;
  });
  return Object.keys(por).map(function (k) { var r = por[k], p = AC.prof[k] || {}; r.p = p; r.perfil = acPerfil(r); return r; });
}
function acPerfil(r) {
  if (r.m && r.m.master) return 'Master';
  if (r.p && r.p.is_admin) return 'Admin';
  var c = r.p && r.p.cargo; if (c && AC_CARGOS.indexOf(c) >= 0) return c;
  return r.p && r.p.time_frota ? 'Time Frota' : 'Gestor de Frota';
}
function acChefe(r) { return r.perfil === 'Admin' || r.perfil === 'Master'; }
function acPode(r) { return AC.master || (USER && r.id === USER.id) || !acChefe(r); }

async function acCarrega() {
  var res = await sb.from('user_approvals').select('*').order('created_at', { ascending: false });
  if (res.error) throw res.error;
  AC.ap = res.data || [];
  var pr = await sb.from('fca_profiles').select('user_id,unidade,is_admin,time_frota,cargo');
  if (pr.error) pr = await sb.from('fca_profiles').select('user_id,unidade,is_admin');
  AC.prof = {}; (pr.data || []).forEach(function (p) { AC.prof[p.user_id] = p; });
  AC.master = false; AC.mu = {};
  try { var me = await sb.rpc('master_eu'); AC.master = !me.error && me.data === true; } catch (e) {}
  if (AC.master) {
    try { var mu = await sb.rpc('master_usuarios'); (mu.data || []).forEach(function (m) { AC.mu[m.id] = m; }); } catch (e) {}
  }
}

async function abreAcessos() {
  if (!EH_ADMIN) return;
  $('tela-acessos').classList.add('on'); empilha('acessos');
  $('acLista').innerHTML = '<div class="ac-vazio">Carregando os usuários…</div>';
  try { await acCarrega(); }
  catch (e) { $('acLista').innerHTML = '<div class="ac-vazio">' + esc(acErro(e)) + '</div>'; return; }
  acRender();
}
function fechaAcessos() { $('tela-acessos').classList.remove('on'); }
function acFiltro(f) { AC.filtro = f; acRender(); }
function acBusca(v) { AC.busca = v; acRender(); }

function acRender() {
  var rows = acLinhas(), q = (AC.busca || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  var cont = { pending: 0, approved: 0, blocked: 0, all: rows.length };
  rows.forEach(function (r) { if (cont[r.st] != null) cont[r.st]++; });
  $('acSub').textContent = cont.approved + (cont.approved === 1 ? ' ativo · ' : ' ativos · ') + cont.pending + ' aguardando · ' + cont.blocked + (cont.blocked === 1 ? ' bloqueado' : ' bloqueados');
  $('acChips').innerHTML = [['pending', 'Aguardando'], ['approved', 'Ativos'], ['blocked', 'Bloqueados'], ['all', 'Todos']].map(function (c) {
    return '<span class="chip' + (AC.filtro === c[0] ? ' on' : '') + '" onclick="acFiltro(\'' + c[0] + '\')">' + c[1] + ' ' + cont[c[0]] + '</span>';
  }).join('');
  var vis = rows.filter(function (r) {
    if (AC.filtro !== 'all' && r.st !== AC.filtro) return false;
    if (!q) return true;
    var t = (r.nome + ' ' + r.email + ' ' + acTel(r.tel) + ' ' + acUnis(r.p).join(' ') + ' ' + r.perfil).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return q.split(/\s+/).every(function (w) { return t.indexOf(w) >= 0; });
  }).sort(function (a, b) { return (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'); });
  if (!vis.length) { $('acLista').innerHTML = '<div class="ac-vazio">Ninguém nesse filtro.</div>'; return; }
  $('acLista').innerHTML = vis.map(function (r) {
    var cor = r.st === 'approved' ? 'pos' : r.st === 'blocked' ? 'neg' : 'amb';
    var unis = r.perfil === 'Admin' || r.perfil === 'Master' ? 'todas as unidades' : (acUnis(r.p).join(', ') || 'sem unidade');
    return '<div class="li ac-li" onclick="abreUsuarioApp(\'' + r.id + '\')"><div class="tx"><b>' + esc(r.nome || r.email) + '</b>' +
      '<span>' + esc(r.perfil) + ' · ' + esc(unis) + '</span><span>' + esc(r.email) + '</span></div>' +
      '<span class="ac-st ' + cor + '">' + AC_ST[r.st] + '</span></div>';
  }).join('');
}

/* ── a pessoa ── */
function acR() { var id = AC.id; return acLinhas().filter(function (r) { return r.id === id; })[0]; }
function abreUsuarioApp(id) {
  AC.id = id; AC.senha = '';
  var r = acR(); if (!r) return;
  AC.fca = new Set(acUnis(r.p));
  $('tela-usuario').classList.add('on'); empilha('usuario');
  $('acuSenha').value = '';
  acuRender();
}
function fechaUsuarioApp() { $('tela-usuario').classList.remove('on'); AC.id = null; }

function acuRender() {
  var r = acR(); if (!r) { fechaUsuarioApp(); return; }
  var pode = acPode(r), eu = USER && r.id === USER.id, m = r.m;
  $('acuTit').textContent = r.nome || r.email;
  $('acuSub').textContent = r.email;
  var fatos = [['Perfil', r.perfil], ['Telefone', r.tel || '—'], ['Cadastro', acDt(r.cad) || '—']];
  if (m) {
    fatos.push(['Último acesso', m.ultimo ? acDt(m.ultimo) : 'nunca entrou']);
    fatos.push(['E-mail', m.confirmado ? 'confirmado' : 'não confirmado']);
    if (m.troca_senha) fatos.push(['Senha', 'provisória (ainda não trocou)']);
    if (m.sessoes) fatos.push(['Sessões abertas', String(m.sessoes)]);
  }
  $('acuFatos').innerHTML = fatos.map(function (f) { return '<div class="ac-f"><span>' + f[0] + '</span><b>' + esc(f[1]) + '</b></div>'; }).join('');
  // situação
  $('acuStBox').style.display = eu ? 'none' : '';
  $('acuSt').innerHTML = ['approved', 'pending', 'blocked'].map(function (k) {
    return '<button class="' + (r.st === k ? 'on' : '') + '"' + (pode ? '' : ' disabled') + ' onclick="acuSituacao(\'' + k + '\')">' + (k === 'pending' ? 'Pendente' : AC_ST[k]) + '</button>';
  }).join('');
  // senha e acesso: só o Master
  $('acuSenhaBox').style.display = AC.master ? '' : 'none';
  $('acuLib').style.display = AC.master && m && (!m.confirmado || r.st !== 'approved') ? '' : 'none';
  $('acuEnc').style.display = AC.master ? '' : 'none';
  $('acuMstNota').style.display = AC.master ? 'none' : '';
  acuPintaSenha(r);
  // unidades
  var chefe = acChefe(r);
  $('acuUniTit').textContent = chefe ? 'Unidades do FCA · todas (' + r.perfil.toLowerCase() + ')' : 'Unidades do FCA · ' + AC.fca.size + ' marcada' + (AC.fca.size === 1 ? '' : 's');
  $('acuUnis').innerHTML = AC_UNIS.map(function (u) {
    var on = chefe || AC.fca.has(u);
    return '<button class="' + (on ? 'on' : '') + '"' + (pode && !chefe ? '' : ' disabled') + ' onclick="acuTogUni(\'' + u + '\')">' + u + '</button>';
  }).join('');
  var mudou = !chefe && Array.from(AC.fca).sort().join(',') !== acUnis(r.p).slice().sort().join(',');
  $('acuUniSalvar').style.display = mudou ? '' : 'none';
  $('acuNota').textContent = pode ? '' : 'Só o Master altera o cadastro de um Admin ou de um Master.';
}
function acuPintaSenha(r) {
  var box = $('acuSenhaV');
  if (!AC.senha) { box.style.display = 'none'; return; }
  box.style.display = '';
  $('acuSenhaCod').textContent = AC.senha;
  var tel = acTel(r.tel);
  $('acuWpp').style.display = tel.length >= 10 ? '' : 'none';
}
function acuMsgTxt(r) {
  return 'Gestão em Movimento\nE-mail: ' + r.email + '\nSenha provisória: ' + AC.senha + '\n' + PORTAL + '\nNo primeiro acesso você cria a sua senha.';
}
function acuCopia() {
  var r = acR(); if (!r) return;
  var t = acuMsgTxt(r);
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('E-mail e senha copiados'); }, function () { toast('Não deu para copiar. Selecione a senha na tela.'); });
}
function acuWhats() {
  var r = acR(); if (!r) return;
  window.open('https://wa.me/55' + acTel(r.tel) + '?text=' + encodeURIComponent(acuMsgTxt(r)), '_blank');
}
async function acuRecarrega() { await acCarrega(); acRender(); if (AC.id) acuRender(); }

async function acuSituacao(st) {
  var r = acR(); if (!r || r.st === st || !acPode(r)) return;
  if (st === 'blocked' && !confirm('Bloquear o acesso de ' + (r.nome || r.email) + '?')) return;
  try {
    if (r.semAprov && st === 'approved') { var l = await sb.rpc('master_liberar', { p_user: r.id }); if (l.error) throw l.error; }
    else if (AC.master) { var a = await sb.rpc('master_altera', { p_user: r.id, p_dados: { status: st } }); if (a.error) throw a.error; }
    else { var u = await sb.from('user_approvals').update({ status: st }).eq('user_id', r.id); if (u.error) throw u.error; }
    if (st === 'approved') acNotifica(r);
    await acuRecarrega();
    toast(st === 'approved' ? 'Acesso liberado' : st === 'blocked' ? 'Acesso bloqueado' : 'Voltou para aguardando');
  } catch (e) { toast(acErro(e), 3500); }
}
function acNotifica(r) {
  try { fetch(AC_NOTIFY, { method: 'POST', headers: { Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: r.email, name: r.nome }) }).catch(function () {}); } catch (e) {}
}
async function acuGeraSenha() {
  var r = acR(); if (!r || !AC.master) return;
  var s = $('acuSenha').value.trim();
  if (s && s.length < 6) { toast('A senha precisa de pelo menos 6 caracteres.'); return; }
  var bt = $('acuSenhaBt'); bt.disabled = true; bt.textContent = 'Gravando…';
  try {
    var res = await sb.rpc('master_senha', { p_user: r.id, p_senha: s || null });
    if (res.error) throw res.error;
    $('acuSenha').value = '';
    await acuRecarrega();
    AC.senha = res.data; acuRender();
    toast('Senha provisória gravada');
  } catch (e) { toast(acErro(e), 3500); }
  finally { bt.disabled = false; bt.textContent = 'Gerar senha provisória'; }
}
async function acuLiberar() {
  var r = acR(); if (!r || !AC.master) return;
  try { var l = await sb.rpc('master_liberar', { p_user: r.id }); if (l.error) throw l.error; acNotifica(r); await acuRecarrega(); toast('Cadastro liberado'); }
  catch (e) { toast(acErro(e), 3500); }
}
async function acuEncerrar() {
  var r = acR(); if (!r || !AC.master) return;
  if (!confirm('Encerrar as sessões abertas? A pessoa terá de entrar de novo.')) return;
  try { var e1 = await sb.rpc('master_encerrar', { p_user: r.id }); if (e1.error) throw e1.error; await acuRecarrega(); toast((e1.data || 0) + ' sessão(ões) encerrada(s)'); }
  catch (e) { toast(acErro(e), 3500); }
}
function acuTogUni(u) { if (AC.fca.has(u)) AC.fca.delete(u); else AC.fca.add(u); acuRender(); }
async function acuSalvaUnis() {
  var r = acR(); if (!r || !acPode(r) || acChefe(r)) return;
  var csv = AC_UNIS.filter(function (u) { return AC.fca.has(u); }).join(',');
  try {
    if (AC.master) { var a = await sb.rpc('master_altera', { p_user: r.id, p_dados: { unidade: csv } }); if (a.error) throw a.error; }
    else { var u = await sb.from('fca_profiles').upsert({ user_id: r.id, nome: r.nome || null, unidade: csv || null, is_admin: false }, { onConflict: 'user_id' }); if (u.error) throw u.error; }
    await acuRecarrega();
    toast('Unidades salvas');
  } catch (e) { toast(acErro(e), 3500); }
}

/* a entrada no Perfil só para admin; o "voltar" do celular fecha a tela de cima */
(function () {
  var t = setInterval(function () { if (USER) { clearInterval(t); $('pfAdm').style.display = EH_ADMIN ? '' : 'none'; } }, 300);
  window.addEventListener('popstate', function () {
    if ($('tela-usuario').classList.contains('on')) { fechaUsuarioApp(); return; }
    if ($('tela-acessos').classList.contains('on')) fechaAcessos();
  });
})();
