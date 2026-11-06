/* ============================================================
   GESTÃO EM MOVIMENTO — APP DO CELULAR (02/11/2026)
   Login = o mesmo do portal (Supabase, mesma sessão guardada no navegador).
   Cada painel abre POR DENTRO (iframe escondido no #forno, largura de desktop)
   e o app lê os números que o painel desenhou — hero, cards, gráficos (pelo
   Chart.js do painel) e tabelas — e redesenha no estilo DriverPro. Nada é
   recalculado aqui: o número é o do painel. Modo "web" = o painel inteiro.
   ============================================================ */
'use strict';
var SUPABASE_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
var SUPABASE_KEY = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
var ADMIN_EMAIL = 'fortesindicadores@gmail.com';
var BUILD = (document.querySelector('meta[name="build"]') || {}).content || '';
var PORTAL = location.pathname.replace(/app\/?(index\.html)?$/, '');   // raiz do portal (…/gestao-em-movimento/)
var sb = window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
var $ = function (id) { return document.getElementById(id); };
var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var T = Object.assign({ passo: 400, quieto: 3, min: 2500, teto: 70000, pos: 900 }, window.APP_TEMPOS || {});
var CACHE_FRESCO = 45 * 60e3;    // o resumo lido AQUI vale 45 min; depois relê em segundo plano
var ROBO_FRESCO = 2 * 60 * 60e3; // o resumo do robô (app_resumo, de hora em hora) vale 2 h antes de o app reler sozinho
var SEM_BANCO = !!window.APP_SEM_BANCO;   // o robô liga isto: ele lê os painéis de verdade, nunca o app_resumo
var FAV_PADRAO = ['visao-financeira', 'painel-km', 'programa-reconhecimento', 'scorecard', 'fca-gerencial'];

var USER = null, PERFIL = { unidade: '', is_admin: false }, EH_DONO = false, EH_ADMIN = false;
var PN = null, PN_DATA = null, PN_VW = '', PN_VIG = '';
var V = 'inicio';
window.__gvizMem = window.__gvizMem || {};   // os iframes dividem as abas já lidas (gviz-cache.js)

/* ─────────────────────────── utilidades ─────────────────────────── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function inic(n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '')[0] || '') + ((p.length > 1 ? p[p.length - 1][0] : '') || ''); }
function titulo(s) { return String(s || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
function primeiroNome(u) { var n = (u && u.user_metadata && u.user_metadata.name) || (u && u.email ? u.email.split('@')[0] : ''); return titulo(n.split(/[\s.]+/)[0]); }
var _toastT = null;
function toast(m, ms) { var t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(_toastT); _toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2200); }
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function fechaMenu() { $('menu').classList.remove('on'); }
document.addEventListener('click', function (e) { if (!e.target.closest('#menu') && !e.target.closest('#av')) fechaMenu(); });
function corCls(c) { return c === 'g' ? 'pos' : c === 'r' ? 'neg' : c === 'a' ? 'amb' : c === 'b' ? 'azl' : ''; }

/* ─────────────────────────── tema ─────────────────────────── */
function aplicaTema(t) {
  document.body.classList.toggle('claro', t === 'light');
  try { localStorage.setItem('bi_theme', t); } catch (e) {}   // a mesma chave do portal: os painéis abrem no mesmo tema
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'light' ? '#E1E2E5' : '#17181B';
  var ch = $('chTema'); if (ch) ch.classList.toggle('on', t !== 'light');
  if (PN_DATA && $('tela-painel').classList.contains('on')) desenhaPainel(PN_DATA);
}
function trocaTema() { aplicaTema(document.body.classList.contains('claro') ? 'dark' : 'light'); }
aplicaTema(localStorage.getItem('bi_theme') || 'dark');
$('btTema').addEventListener('click', trocaTema);

/* ─────────────────────────── instalar ─────────────────────────── */
var _instEvt = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); _instEvt = e; mostraInstalar(); });
function emApp() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function mostraInstalar() {
  var v = !emApp();
  ['lgInstalar', 'btInstalar'].forEach(function (id) { var el = $(id); if (el) el.style.display = v ? '' : 'none'; });
  var o = $('optInstalar'); if (o) o.style.display = v ? '' : 'none';
}
function instalar() {
  if (_instEvt) { _instEvt.prompt(); _instEvt.userChoice.then(function () { _instEvt = null; mostraInstalar(); }); return; }
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('instTxt').innerHTML = ios
    ? '<p>No Safari, toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima) e depois em <b>Adicionar à Tela de Início</b>.</p><p>O app abre pelo ícone, em tela cheia, como qualquer outro.</p>'
    : '<p>No Chrome, abra o menu <b>⋮</b> e toque em <b>Instalar aplicativo</b> (ou <b>Adicionar à tela inicial</b>).</p><p>O app abre pelo ícone, em tela cheia, como qualquer outro.</p>';
  $('inst').classList.add('on');
}
mostraInstalar();

/* ─────────────────────────── service worker ─────────────────────────── */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(function (reg) {
    try { reg.update(); } catch (e) {}
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { reg.update(); } catch (e) {} } });
  }).catch(function () {});
  var _recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (_recarregou || !navigator.serviceWorker.controller) return;
    if (!sessionStorage.getItem('gem_app_sw')) { sessionStorage.setItem('gem_app_sw', '1'); return; }   // 1ª instalação: não recarrega
    _recarregou = true; location.reload();
  });
}
document.querySelectorAll('[data-build]').forEach(function (el) { el.textContent = 'build ' + BUILD; });

/* ─────────────────────────── login ─────────────────────────── */
function lgErro(m) { var e = $('lgErro'); e.textContent = m || ''; e.style.display = m ? '' : 'none'; }
function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido.';
  var m = String(msg).toLowerCase();
  if (m.indexOf('invalid login') >= 0 || m.indexOf('invalid credentials') >= 0) return 'E-mail ou senha incorretos.';
  if (m.indexOf('email not confirmed') >= 0) return 'Confirme seu e-mail antes de entrar.';
  if (m.indexOf('rate limit') >= 0 || m.indexOf('too many') >= 0) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.indexOf('network') >= 0 || m.indexOf('fetch') >= 0) return 'Sem conexão. Verifique a internet.';
  return msg;
}
async function entrar() {
  var email = ($('lgEmail').value || '').trim().toLowerCase(), senha = $('lgSenha').value || '';
  if (!email || !senha) { lgErro('Informe e-mail e senha.'); return; }
  if (!sb) { lgErro('Sem conexão com o servidor.'); return; }
  var b = $('btEntrar'); b.disabled = true; b.textContent = 'Entrando…'; lgErro('');
  try {
    var r = await sb.auth.signInWithPassword({ email: email, password: senha });
    if (r.error) throw r.error;
    await entra(r.data.user);
  } catch (e) { lgErro(traduzirErro(e && e.message)); }
  finally { b.disabled = false; b.textContent = 'Entrar'; }
}
$('lgSenha').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrar(); });
$('lgEmail').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('lgSenha').focus(); });

function mostraLogin(msg) { $('app').style.display = 'none'; $('tela-login').classList.add('on'); if (msg) lgErro(msg); }
function mostraApp() { $('tela-login').classList.remove('on'); $('app').style.display = ''; }

async function lePerfil(user) {
  var cache = lsGet('gem_perfil_' + user.id, null);
  try {
    var r = await Promise.race([
      sb.from('fca_profiles').select('unidade,is_admin').eq('user_id', user.id).maybeSingle(),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('teto')); }, 6000); })
    ]);
    if (r && r.error) throw r.error;
    var d = (r && r.data) || {};
    var prof = { unidade: String(d.unidade || ''), is_admin: !!d.is_admin };
    lsSet('gem_perfil_' + user.id, prof);
    return prof;
  } catch (e) { return cache || { unidade: '', is_admin: false }; }
}
async function aprovado(user) {
  if (user.email === ADMIN_EMAIL) return 'approved';
  var cached = localStorage.getItem('bi_approved_' + user.id);
  try {
    var r = await Promise.race([
      sb.from('user_approvals').select('status').eq('user_id', user.id).single(),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('teto')); }, 6000); })
    ]);
    var st = r && r.data && r.data.status;
    if (st === 'approved') localStorage.setItem('bi_approved_' + user.id, '1');
    if (st === 'blocked') localStorage.removeItem('bi_approved_' + user.id);
    return st || (cached ? 'approved' : 'pending');
  } catch (e) { return cached ? 'approved' : 'erro'; }
}
var _entrando = null;
function entra(user) { if (!_entrando) _entrando = _entra(user).finally(function () { _entrando = null; }); return _entrando; }
async function _entra(user) {
  if (user.app_metadata && user.app_metadata.troca_senha) {
    await sb.auth.signOut({ scope: 'local' });
    mostraLogin('Você entrou com uma senha provisória. Crie a sua senha no portal e volte ao app.'); return;
  }
  var st = await aprovado(user);
  if (st === 'blocked') { await sb.auth.signOut(); mostraLogin('Seu acesso está bloqueado. Fale com o administrador.'); return; }
  if (st === 'pending') { await sb.auth.signOut({ scope: 'local' }); mostraLogin('Seu cadastro ainda não foi aprovado. Peça a liberação ao administrador.'); return; }
  if (st === 'erro') { mostraLogin('O servidor não respondeu. Tente de novo em instantes.'); return; }
  USER = user;
  EH_DONO = user.email === ADMIN_EMAIL;
  PERFIL = await lePerfil(user);
  EH_ADMIN = EH_DONO || PERFIL.is_admin;
  sessionStorage.setItem('gem_hub', '1');   // os painéis (nos iframes) checam isto antes de abrir
  var nome = primeiroNome(user);
  $('ola').textContent = 'Olá, ' + nome + '!';
  var hoje = new Date();
  $('sub').textContent = MESES[hoje.getMonth()] + ', ' + hoje.getFullYear();
  $('av').textContent = inic((user.user_metadata && user.user_metadata.name) || nome) || '•';
  $('pfAv').textContent = $('av').textContent;
  $('pfNome').textContent = titulo((user.user_metadata && user.user_metadata.name) || nome);
  $('pfSub').textContent = EH_DONO ? 'Dono do portal' : EH_ADMIN ? 'Administrador' : (PERFIL.unidade ? 'Gestor · ' + PERFIL.unidade : 'Portal');
  $('pfEmail').textContent = user.email;
  mostraApp();
  renderPaineis(''); renderFav(); renderInicio();
  logAcesso('app');
  // 1º os resumos do robô (milissegundos), depois a fila só para o que ficou sem resumo fresco
  preLe(favs()).then(function () { renderInicio(); setTimeout(filaDestaques, 300); });
}
async function sair() {
  fechaMenu();
  try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
  sessionStorage.removeItem('gem_hub');
  USER = null; mataForno();
  mostraLogin('');
}
var _accTok = null;
async function logAcesso(painel) {
  try {
    if (!_accTok) { var r = await sb.auth.getSession(); _accTok = r.data.session && r.data.session.access_token; }
    if (!_accTok) return;
    fetch(SUPABASE_URL + '/rest/v1/access_log', { method: 'POST', keepalive: true,
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + _accTok, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: USER && USER.email, painel: painel }) }).catch(function () {});
  } catch (e) {}
}
// sessão: a mesma do portal (chave sb-<ref>-auth-token no localStorage desta origem)
(async function () {
  if (!sb) { mostraLogin('Não foi possível carregar o Supabase. Verifique a internet e abra de novo.'); return; }
  var sessao = null;
  try { var r = await Promise.race([sb.auth.getSession(), new Promise(function (res) { setTimeout(function () { res({ data: { session: null }, lenta: true }); }, 8000); })]); sessao = r.data && r.data.session; } catch (e) {}
  if (sessao && sessao.user) entra(sessao.user); else mostraLogin('');
  sb.auth.onAuthStateChange(function (ev, s) {
    if ((ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED' || ev === 'INITIAL_SESSION') && s && s.user && !USER) entra(s.user);
    if (ev === 'SIGNED_OUT' && USER) { USER = null; mostraLogin(''); }
    if (ev === 'TOKEN_REFRESHED') _accTok = null;
  });
})();

/* ─────────────────────────── navegação ─────────────────────────── */
function irPara(v) {
  V = v;
  document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
  document.querySelectorAll('.corpo > .tela').forEach(function (s) { s.classList.toggle('on', s.id === 'v-' + v); });
  $('corpo').scrollTop = 0;
  if (v === 'fav') renderFav();
  if (v === 'inicio') renderInicio();
}
document.querySelectorAll('#nav button').forEach(function (b) { b.addEventListener('click', function () { irPara(b.dataset.v); }); });
function abrePortal(caminho) { window.open(PORTAL + (caminho || ''), '_blank'); }

/* ─────────────────────────── catálogo ─────────────────────────── */
var CAT = (window.GEM_CATALOGO && window.GEM_CATALOGO.paineis) || [];
var ORDEM = (window.GEM_CATALOGO && window.GEM_CATALOGO.ordem) || [];
function podeVer(p) { return (!p.adm || EH_ADMIN) && (!p.dono || EH_DONO); }
function painelPorId(id) { for (var i = 0; i < CAT.length; i++) if (CAT[i].id === id) return CAT[i]; return null; }
function urlDe(p) {
  var u = PORTAL + p.href;
  if (p.gav) { var uni = (PERFIL.unidade || '').split(',')[0].trim(); u += (EH_ADMIN || !uni) ? '?u=admin' : '?u=' + encodeURIComponent(uni); }
  return u;
}
function favs() { var f = lsGet('gem_app_fav', null); return Array.isArray(f) ? f : FAV_PADRAO.slice(); }
function ehFav(id) { return favs().indexOf(id) >= 0; }
function toggleFav() {
  if (!PN) return;
  var f = favs(), i = f.indexOf(PN.id);
  if (i >= 0) f.splice(i, 1); else f.push(PN.id);
  lsSet('gem_app_fav', f);
  $('btFav').classList.toggle('on', i < 0);
  toast(i < 0 ? 'Adicionado aos favoritos' : 'Tirado dos favoritos');
  renderFav();
}
function recentes() { return lsGet('gem_app_rec', []); }
function marcaRecente(id) { var r = recentes().filter(function (x) { return x !== id; }); r.unshift(id); lsSet('gem_app_rec', r.slice(0, 8)); }

function liHtml(p, extra) {
  return '<div class="li' + (ehFav(p.id) ? ' fav' : '') + '" data-id="' + esc(p.id) + '" onclick="abrePainel(\'' + esc(p.id) + '\')">' +
    '<span class="ic">' + p.ico + '</span><div class="tx"><b>' + esc(p.nome) + '</b><span>' + esc(extra || p.desc) + '</span></div>' +
    '<span class="seta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></span></div>';
}
function normB(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
var GRUPO = '';
function escolheGrupo(g) { GRUPO = g; renderPaineis($('busca').value); }
function renderPaineis(q) {
  q = normB(q || '').trim();
  var grupos = {}, h = '', todos = {};
  CAT.filter(podeVer).forEach(function (p) {
    todos[p.cluster] = 1;
    if (q && normB(p.nome + ' ' + p.desc + ' ' + p.cluster).indexOf(q) < 0) return;
    if (GRUPO && !q && p.cluster !== GRUPO) return;
    (grupos[p.cluster] = grupos[p.cluster] || []).push(p);
  });
  var ordem = ORDEM.filter(function (c) { return todos[c]; });
  Object.keys(todos).forEach(function (c) { if (ordem.indexOf(c) < 0) ordem.push(c); });
  $('grupos').innerHTML = '<span class="chip' + (!GRUPO ? ' on' : '') + '" onclick="escolheGrupo(\'\')">Todos</span>' + ordem.map(function (c) { return '<span class="chip' + (GRUPO === c ? ' on' : '') + '" onclick="escolheGrupo(\'' + esc(c) + '\')">' + esc(c) + '</span>'; }).join('');
  ordem.forEach(function (c) { if (!grupos[c]) return; h += '<div class="sec" style="margin-top:14px">' + esc(c) + '<span class="cnt">' + grupos[c].length + '</span></div>' + grupos[c].map(function (p) { return liHtml(p); }).join(''); });
  $('lista').innerHTML = h || '<div class="vazio">Nenhum painel com esse nome.</div>';
}
function renderFav() {
  var f = favs().map(painelPorId).filter(function (p) { return p && podeVer(p); });
  $('favLista').innerHTML = f.length ? f.map(function (p) { return liHtml(p); }).join('') : '<div class="vazio">Nenhum favorito ainda. Abra um painel e toque na estrela.</div>';
}

/* ─────────────────────────── início: destaques ─────────────────────────── */
function cacheKey(p, vw, vig) { return 'gem_app_c2_' + p.id + '|' + (vw || '') + '|' + (vig || ''); }
function cacheLe(p, vw, vig) { return lsGet(cacheKey(p, vw, vig), null); }
function cacheGrava(p, vw, vig, data) {
  var ok = lsSet(cacheKey(p, vw, vig), { t: Date.now(), data: data });
  if (!ok) { limpaCache(); lsSet(cacheKey(p, vw, vig), { t: Date.now(), data: data }); }
}
function limpaCache() { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('gem_app_c2_') === 0) localStorage.removeItem(k); }); }
function cachePadrao(p) {   // o resumo guardado da visão e vigência padrão do painel (o que o início mostra)
  var ks = Object.keys(localStorage).filter(function (k) { return k.indexOf('gem_app_c2_' + p.id + '|') === 0; });
  var melhor = null;
  ks.forEach(function (k) { var c = lsGet(k, null); if (c && c.data && c.data.padrao && (!melhor || c.t > melhor.t)) melhor = c; });
  if (!melhor) ks.forEach(function (k) { var c = lsGet(k, null); if (c && (!melhor || c.t > melhor.t)) melhor = c; });
  return melhor;
}
function fresco(c) { return !!(c && c.data && Date.now() - c.t < (c.robo ? ROBO_FRESCO : CACHE_FRESCO)); }
/* ── os resumos PRÉ-LIDOS pelo robô (Renan, 06/11/2026: "Bem demorado para
   carregar no app visão mobile"): o App Robot lê os painéis no Actions de hora
   em hora e grava public.app_resumo (painel × visão, 3 a 5 KB). O app baixa
   essas linhas em milissegundos e só abre o iframe no "Atualizar", na troca de
   vigência ou quando o robô está atrasado (ROBO_FRESCO). ── */
async function preLe(ids) {
  if (!sb || SEM_BANCO || !USER) return 0;
  ids = (ids || []).filter(function (id) { var p = painelPorId(id); return p && podeVer(p) && p.modo === 'resumo' && (!p.gav || EH_ADMIN); });
  if (!ids.length) return 0;
  var n = 0;
  try {
    var r = await Promise.race([sb.from('app_resumo').select('id,vw,vig,unidade,dados,lido_em').in('id', ids), new Promise(function (res) { setTimeout(function () { res({ data: null, error: { message: 'tempo' } }); }, 8000); })]);
    if (r.error || !Array.isArray(r.data)) { if (r.error && !/relation|does not exist|tempo/i.test(r.error.message || '')) console.warn('app_resumo:', r.error.message); return 0; }
    r.data.forEach(function (row) {
      var p = painelPorId(row.id); if (!p || row.unidade) return;
      var t = Date.parse(row.lido_em) || 0, d = row.dados; if (!d || !d.blocos) return;
      var atual = cacheLe(p, row.vw, row.vig);
      if (atual && atual.t >= t) return;   // o que foi lido aqui depois do robô vale mais
      d.lido = t;
      if (lsSet(cacheKey(p, row.vw, row.vig), { t: t, data: d, robo: true })) n++;
    });
  } catch (e) { console.warn('app_resumo:', e && e.message); }
  return n;
}
function heroDe(d) {   // o 1º número grande do resumo: hero; senão o 1º card
  if (!d || !d.blocos) return null;
  for (var i = 0; i < d.blocos.length; i++) {
    var b = d.blocos[i];
    if (b.t === 'hero' && b.itens.length && b.itens[0].v) return { l: b.itens[0].l, v: b.itens[0].v, cor: b.itens[0].cor, dels: b.itens[0].dels || [], extra: b.itens[0].extra };
  }
  for (var j = 0; j < d.blocos.length; j++) { var k = d.blocos[j]; if (k.t === 'kpis' && k.itens.length && !k.tit) return { l: k.itens[0].l, v: k.itens[0].v, cor: k.itens[0].cor, dels: [], extra: k.itens[0].m }; }
  for (var q = 0; q < d.blocos.length; q++) { var g = d.blocos[q]; if (g.t === 'kpis' && g.itens.length && g.tit) { var it = g.itens.filter(function (x) { return /^real/i.test(x.l); })[0] || g.itens[0]; return { l: g.tit + ' · ' + it.l, v: it.v, cor: it.cor, dels: g.itens.filter(function (x) { return x !== it; }).slice(0, 3).map(function (x) { return { l: x.l, v: x.v, cor: x.cor }; }), extra: '' }; } }
  return null;
}
function horaDe(t) { var d = new Date(t); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function renderInicio() {
  var f = favs().map(painelPorId).filter(function (p) { return p && podeVer(p); });
  var h = '', hero1 = null;
  f.forEach(function (p) {
    var c = cachePadrao(p), hr = c && heroDe(c.data), sr = c && serieDe(c.data);
    if (hr && !hero1) hero1 = { p: p, hr: hr, c: c, sr: sr };
    h += '<div class="dq" onclick="abrePainel(\'' + esc(p.id) + '\')"><div class="dq-top">' +
      '<div class="dq-l"><div class="rot">' + esc(p.nome) + (hr && hr.l ? ' <i>·</i> ' + esc(suave(hr.l)) : '') + '</div>' +
      (hr ? '<div class="val ' + corCls(hr.cor) + (String(hr.v).length > 12 ? ' menor' : '') + '">' + esc(hr.v) + '</div>' +
          (!hr.dels.length && hr.extra ? '<div class="sub">' + esc(hr.extra) + '</div>' : '')
        : '<div class="sk"></div><div class="sub">carregando…</div>') + '</div>' +
      '<div class="dq-r">' + (sr ? sparkSvg(sr.data, 88, 34, hr && hr.cor === 'r' ? '#FF5252' : '#F97316') : '') + '<span class="seta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></span></div></div>' +
      (hr && hr.dels.length ? pillsHtml(hr.dels.slice(0, 2)) : '') + '</div>';
  });
  $('destaques').innerHTML = h || '<div class="vazio">Marque painéis como favoritos para vê-los aqui.</div>';
  if (hero1) {
    $('iniRot').textContent = hero1.p.nome + ' · ' + suave(hero1.hr.l || '');
    $('iniVal').textContent = hero1.hr.v; $('iniVal').className = 'val ' + corCls(hero1.hr.cor) + (String(hero1.hr.v).length > 12 ? ' menor' : '');
    $('iniAviso').innerHTML = (hero1.hr.dels && hero1.hr.dels.length ? pillsHtml(hero1.hr.dels.slice(0, 3)) : '') + (hero1.c.data.sub ? '<div class="sub">' + esc(hero1.c.data.sub) + '</div>' : '');
    $('iniSpark').innerHTML = hero1.sr ? sparkSvg(hero1.sr.data, 320, 46, hero1.hr.cor === 'r' ? '#FF5252' : '#F97316') + '<div class="leg">' + esc(hero1.sr.tit || hero1.sr.label || '') + ' · ' + esc(rotuloCurto(hero1.sr.labels[0])) + ' → ' + esc(rotuloCurto(hero1.sr.labels[hero1.sr.labels.length - 1])) + '</div>' : '';
  } else { $('iniRot').textContent = 'Resumo do mês'; $('iniVal').textContent = '—'; $('iniVal').className = 'val'; $('iniAviso').textContent = 'Os destaques são lidos dos painéis favoritos, um a um. Toque num painel para abrir agora.'; $('iniSpark').innerHTML = ''; }
  var rec = recentes().map(painelPorId).filter(function (p) { return p && podeVer(p); }).slice(0, 5);
  $('recentes').innerHTML = rec.length ? rec.map(function (p) { var c = cachePadrao(p); return liHtml(p, c ? 'lido ' + horaDe(c.t) : p.desc); }).join('') : '<div class="vazio">Os painéis que você abrir aparecem aqui.</div>';
}
var _fila = false;
async function filaDestaques() {   // lê em segundo plano os favoritos sem resumo fresco, um por vez
  if (_fila || !USER) return; _fila = true;
  try {
    var f = favs().map(painelPorId).filter(function (p) { return p && podeVer(p) && p.modo === 'resumo'; });
    for (var i = 0; i < f.length; i++) {
      var p = f[i], c = cachePadrao(p);
      if (fresco(c)) continue;
      if (PN) break;   // a pessoa abriu um painel: ele tem prioridade; a fila volta depois
      try { await carrega(p, { fundo: true }); } catch (e) { console.warn('destaque ' + p.id + ':', e && e.message); }
      renderInicio();
      if (PN) break;
    }
  } finally { _fila = false; }
}
function atualizarTudo() {
  limpaCache(); window.__gvizMem = {}; mataForno();
  toast('Os painéis serão relidos na próxima abertura');
  renderInicio();
  preLe(favs()).then(function () { renderInicio(); setTimeout(filaDestaques, 300); });
}

/* ─────────────────────────── o forno: iframe escondido com o painel ─────────────────────────── */
var FORNO = { ifr: null, url: '', win: null, doc: null, pronto: false, t: 0 };
var _abortaFundo = 0;
function mataForno() { if (FORNO.ifr) { try { FORNO.ifr.remove(); } catch (e) {} } FORNO = { ifr: null, url: '', win: null, doc: null, pronto: false, t: 0 }; }
async function abreForno(url) {
  if (FORNO.ifr && FORNO.url === url && FORNO.pronto && Date.now() - FORNO.t < 20 * 60e3) {
    try { if (FORNO.win.document && !FORNO.win.document.querySelector('.gate')) return FORNO; } catch (e) {}
  }
  mataForno();
  var ifr = document.createElement('iframe');
  ifr.setAttribute('title', 'painel'); ifr.setAttribute('aria-hidden', 'true');
  $('forno').appendChild(ifr);
  FORNO = { ifr: ifr, url: url, win: null, doc: null, pronto: false, t: Date.now() };
  await new Promise(function (res, rej) {
    var to = setTimeout(function () { rej(new Error('o painel não abriu em 60 s')); }, 60000);
    ifr.onload = function () { clearTimeout(to); res(); };
    ifr.onerror = function () { clearTimeout(to); rej(new Error('o painel não abriu')); };
    ifr.src = url;
  });
  FORNO.win = ifr.contentWindow; FORNO.doc = ifr.contentDocument;
  if (!FORNO.doc) throw new Error('o painel não abriu (origem diferente)');
  return FORNO;
}
/* O painel está pronto quando TEM conteúdo (linha de tabela, gráfico com dados
   ou texto) e o DOM parou de mudar — a mesma régua do Check de Metas. */
async function esperaPronto(win, doc, opt) {
  opt = opt || {};
  var teto = opt.teto || T.teto, min = opt.min || T.min, t0 = Date.now(), ant = -1, quieto = 0;
  var temConteudo = function () {
    if (doc.querySelectorAll('tbody tr').length > 0) return true;
    var C = win.Chart;
    if (C && C.getChart) {
      var cvs = doc.querySelectorAll('canvas');
      for (var i = 0; i < cvs.length; i++) { var ch = null; try { ch = C.getChart(cvs[i]); } catch (e) {}
        if (ch && ch.data && (ch.data.datasets || []).some(function (d) { return (d.data || []).length; })) return true; }
    }
    if (!doc.querySelector('table,canvas')) return (doc.body ? doc.body.innerText.length : 0) > 400;
    return false;
  };
  while (Date.now() - t0 < teto) {
    await espera(T.passo);
    if (opt.fundo && _abortaFundo) return 'abortado';
    try { doc = win.document; } catch (e) { return 'gate'; }   // o iframe pode ter navegado (painel → hub → painel)
    if (!doc || !doc.body) continue;
    // só conta o gate VISÍVEL: a Manutenção tem um .gate escondido no HTML (aparece com erro de carga)
    var g = doc.querySelector('.gate'); if (g && g.getClientRects().length && getComputedStyle(g).display !== 'none') return 'gate';
    try { if (/[?&]volta=/.test(win.location.search) || win.location.pathname.indexOf('/app/') < 0 && win.location.pathname.replace(/[^/]*$/, '') === PORTAL) return 'gate'; } catch (e) { return 'gate'; }
    var txt = doc.body.innerText || '';
    if (/carregando/i.test(txt)) { quieto = 0; continue; }
    if (!temConteudo()) { quieto = 0; continue; }
    var n = txt.length + doc.querySelectorAll('tbody tr').length * 7;
    if (n === ant) quieto++; else { quieto = 0; ant = n; }
    if (quieto >= T.quieto && Date.now() - t0 > min) return 'ok';
  }
  return (doc.querySelectorAll('tbody tr').length || doc.querySelector('canvas')) ? 'demorou' : 'vazio';
}

/* ═════════ o ajudante que roda DENTRO do painel (injetado por eval) ═════════ */
function __APP_HELPER() {
  var A = window.__app = {};
  A.norm = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  A.txt = function (el) { return String(el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/\s+/g, ' ').trim(); };
  A.vis = function (el) { if (!el || el.nodeType !== 1) return false; if (el.closest && el.closest('[aria-hidden="true"]')) return false; var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; if (cs.display === 'contents') return true; return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); };
  A.fs = function (el) { return parseFloat(getComputedStyle(el).fontSize) || 0; };
  var rgbDe = function (s) { var m = String(s || '').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  var hsl = function (c) { var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
  // só é cor de RESULTADO a cor saturada e nem escura nem clara demais: o texto comum do portal
  // (#EEF2FA no escuro, #161D2B no claro — um azul-marinho quase preto) não é verde, vermelho nem azul
  A.classCor = function (rgb) { if (!rgb) return ''; var x = hsl(rgb); if (x[1] < .35 || x[2] > .9 || x[2] < .22) return ''; var h = x[0];
    if (h >= 75 && h <= 165) return 'g'; if (h < 14 || h > 335) return 'r'; if (h >= 14 && h < 60) return 'a'; if (h >= 185 && h <= 262) return (x[1] >= .45 && x[2] >= .3) ? 'b' : ''; return ''; };
  A.cor = function (el) { if (!el) return ''; try { return A.classCor(rgbDe(getComputedStyle(el).color)); } catch (e) { return ''; } };
  // a condicional pode estar no FUNDO (a pílula do Ranking do Gestão à Vista, o selo das Auditorias em data-bg), não no texto
  var hexRgb = function (s) { var m = String(s || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return s; var x = m[1]; if (x.length === 3) x = x.split('').map(function (q) { return q + q; }).join(''); return 'rgb(' + parseInt(x.slice(0, 2), 16) + ',' + parseInt(x.slice(2, 4), 16) + ',' + parseInt(x.slice(4, 6), 16) + ')'; };
  A.corFundo = function (el) { if (!el) return ''; try { var c = el.getAttribute && el.getAttribute('data-bg'); if (c) { var k = A.classCor(rgbDe(hexRgb(c))); if (k) return k; } var bg = getComputedStyle(el).backgroundColor; if (!bg || /rgba\(.*,\s*0\)$/.test(bg)) return ''; return A.classCor(rgbDe(bg)); } catch (e) { return ''; } };
  A.corCel = function (td) {   // texto da célula → texto do filho → fundo do filho → fundo da célula
    var c = A.cor(td); if (c) return c;
    var b = td.querySelector && td.querySelector('b,span,i,em');
    if (b) { c = A.cor(b); if (c) return c; c = A.corFundo(b); if (c) return c; }
    return A.corFundo(td);
  };
  A.corCss = function (s) {   // cor de um dataset do Chart.js → string ou lista de strings
    if (!s) return null; if (typeof s === 'string') return s;
    if (Array.isArray(s)) return s.slice(0, 80).map(function (x) { return typeof x === 'string' ? x : null; });
    if (typeof s === 'object' && s instanceof CanvasGradient) return null;
    return null;
  };
  A.opts = function (w) {
    return [].slice.call(w.querySelectorAll('.ms-list input[data-v], .ms-panel input[data-v]')).map(function (i) {
      var lb = i.closest('label') || i.parentNode, c = lb.cloneNode(true), o = c.querySelector('.ms-only'); if (o) o.parentNode.removeChild(o);
      return { v: i.dataset.v, t: (c.textContent || '').replace(/\s+/g, ' ').trim(), on: !!i.checked, el: i };
    });
  };
  A.vigOpts = function (id) {
    if (id === 'elite') {
      var l = document.getElementById('ms-vig-list'); if (!l) return [];
      var sel = (typeof selVig !== 'undefined' && Array.isArray(selVig)) ? selVig : [];
      return [].slice.call(l.querySelectorAll('.ms-opt input')).map(function (i) { var lb = i.parentNode.querySelector('label'); return { v: i.value, t: (lb ? lb.textContent : i.value).replace(/\s+/g, ' ').trim(), on: sel.indexOf(i.value) >= 0 }; }).filter(function (o) { return o.v; });
    }
    var w = document.getElementById(id); if (!w) return [];
    if (typeof w._render === 'function') { try { w._render(''); } catch (e) {} }
    var os = A.opts(w), sel = w._sel instanceof Set ? w._sel : null;
    return os.map(function (o) { return { v: o.v, t: o.t, on: sel && sel.size ? sel.has(o.v) : false }; });
  };
  A.sel = function (id, alvos) {
    var w = document.getElementById(id); if (!w) return 'não existe o filtro ' + id;
    if (typeof w._render === 'function') { try { w._render(''); } catch (e) {} }
    var os = A.opts(w), achou = [];
    if (!alvos || !alvos.length) {   // "Todos": nada marcado = todas as vigências (a regra dos filtros do portal)
      if (!(w._sel instanceof Set)) w._sel = new Set(); w._sel.clear();
      os.forEach(function (o) { o.el.checked = false; });
      var allB = w.querySelector('.ms-all'); if (allB) allB.checked = true;
      var cntB = w.querySelector('.ms-cnt'); if (cntB) cntB.style.display = 'none';
      w.classList.remove('ativo');
      if (typeof w._render === 'function') { try { w._render(''); } catch (e) {} }
      return '';
    }
    (alvos || []).forEach(function (a) { var c = A.norm(a);
      var o = os.filter(function (x) { return A.norm(x.v) === c; })[0] || os.filter(function (x) { return A.norm(x.t) === c; })[0];
      if (o) achou.push(o); });
    if (!achou.length) return 'não achei a vigência';
    if (!(w._sel instanceof Set)) w._sel = new Set();
    w._sel.clear(); achou.forEach(function (o) { w._sel.add(o.v); });
    os.forEach(function (o) { o.el.checked = w._sel.has(o.v); });
    var all = w.querySelector('.ms-all'); if (all) all.checked = false;
    var cnt = w.querySelector('.ms-cnt'); if (cnt) { cnt.textContent = w._sel.size; cnt.style.display = 'inline-block'; }
    w.classList.add('ativo');
    if (typeof w._render === 'function') { try { w._render(''); } catch (e) {} }
    return '';
  };
  A.elite = function (alvos) {
    var l = document.getElementById('ms-vig-list'); if (!l) return 'sem lista';
    var os = [].slice.call(l.querySelectorAll('.ms-opt input')).map(function (i) { return i.value; }).filter(Boolean);
    var achou = (alvos || []).filter(function (a) { return os.indexOf(a) >= 0; });
    if (alvos && alvos.length && !achou.length) return 'não achei a vigência';
    if (typeof setSelArr === 'function') setSelArr('vig', achou);
    if (typeof updateMsBtn === 'function') try { updateMsBtn('vig'); } catch (e) {}
    if (typeof renderAll === 'function') renderAll();
    return '';
  };
  A.vw = function (v) { var f = ['setVw', 'vaiPara', 'setView', 'irPara']; for (var i = 0; i < f.length; i++) if (typeof window[f[i]] === 'function') { window[f[i]](v); return ''; } return 'o painel não troca de visão'; };
  A.redesenha = function (pref) {
    var f = ['run', 'render', 'atualizar', 'onFilterChange', 'aplica', 'desenha', 'renderAll', 'pinta'];
    if (pref) f = [pref].concat(f.filter(function (x) { return x !== pref; }));
    for (var i = 0; i < f.length; i++) if (typeof window[f[i]] === 'function') { try { var r = window[f[i]](); if (r && r.catch) r.catch(function () {}); return ''; } catch (e) { return 'erro ao redesenhar: ' + e.message; } }
    return 'o painel não tem função de redesenho';
  };
  A.tema = function (t) { ['aplicaTema', 'applyTheme', 'setTema'].forEach(function (f) { try { if (typeof window[f] === 'function') window[f](t); } catch (e) {} }); };
  A.gate = function () { return !!document.querySelector('.gate'); };

  /* ── a leitura ── */
  var SEL_HERO = '.fin-hero,.hero,.hero-wrap,.mini-hero,.custos-hero,.hero-main,.hero-box,.adh-hero';
  var SEL_KPIS = '.kpis,.ind-cards,.cards-row,.kpi-row,.kgrid,.cards,.saude-cards';
  var SEL_KPI = '.kpi,.kpi-card,.card-kpi,.saude-card,.uc';
  var SEL_GRAF = '.gcard,.chart-card,.chart-box';
  var SEL_TIT = '.ttit,.tt,.gtit,.tbl-title,.chart-title,.rtit,.card-title,.card-label,.kl,.lbl,.adh-label,h2,h3';
  /* cada painel batiza os cards do seu jeito (kpi, kpi-card, saude-card, ind-card…):
     além das classes conhecidas, vale o NOME: token que termina em -card / -cards /
     -hero, fora os que são outra coisa (gráfico, texto, usuário) */
  var EXC_CARD = { 'chart-card': 1, 'tx-card': 1, 'user-card': 1, 'hcard': 1, 'kcard': 1, 'gcard': 1, 'card': 1, 'uni-card': 1, 'diag-card': 1, 'card-link': 1, 'tsec': 1 };
  A.tok = function (el) { return (el && typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean); };
  function ehHero(el) { return el.matches(SEL_HERO) || A.tok(el).some(function (t) { return /(^|-)hero$/.test(t); }); }
  function ehKpi(el) { return el.matches(SEL_KPI) || A.tok(el).some(function (t) { return /-card$/.test(t) && !EXC_CARD[t]; }); }
  function ehKpis(el) { return el.matches(SEL_KPIS) || A.tok(el).some(function (t) { return /(^|-)(cards|kpis)$/.test(t); }); }
  function temKpi(el) { return [].slice.call(el.querySelectorAll('[class]')).some(ehKpi); }
  function corDeTexto(el) { var c = A.cor(el); if (c) return c; var b = el.querySelector && el.querySelector('b,strong,span'); return b ? A.cor(b) : ''; }
  function leHero(el) {
    var itens = [];
    var VALS = '.hval,.hero-value,.hv,.hn,.hero-val,.adh-value,[class$="-value"]';
    var vals = [].slice.call(el.querySelectorAll(VALS)).filter(A.vis);
    if (!vals.length) vals = [].slice.call(el.querySelectorAll('*')).filter(function (x) { return A.vis(x) && A.fs(x) >= 24 && x.children.length <= 2 && A.txt(x).length && A.txt(x).length < 40; });
    var usados = [], ehVal = function (x) { return vals.indexOf(x) >= 0; };
    vals.forEach(function (v) {
      if (usados.some(function (u) { return u.contains(v) || v.contains(u); })) return; usados.push(v);
      // o "item" do hero é o maior bloco em volta do valor que não contém outro valor
      var raiz = v.parentElement;
      while (raiz && raiz.parentElement && raiz.parentElement !== el && [].slice.call(raiz.parentElement.querySelectorAll('*')).filter(ehVal).length <= 1) raiz = raiz.parentElement;
      if (!raiz) raiz = v.parentElement;
      var lab = raiz.querySelector('.hlbl,.hero-label,.hl,.hlab,.adh-label,[class$="-label"]'); var l = lab ? A.txt(lab) : '';
      if (!l) { var ants = [].slice.call(raiz.querySelectorAll('*')).filter(function (x) { return A.vis(x) && A.fs(x) <= 12.5 && x !== v && !v.contains(x) && !x.contains(v) && (x.compareDocumentPosition(v) & 4) && A.txt(x).length && A.txt(x).length < 60 && x.children.length === 0; }); l = ants.length ? A.txt(ants[0]) : ''; }
      var dels = [];
      [].slice.call(raiz.querySelectorAll('.hdel > *, .hero-deltas > *, .hero-delta, .hero-item, .hdeltas > *, .adh-deltas > *, [class$="-deltas"] > *')).forEach(function (d) {
        if (!A.vis(d) || d.contains(v)) return; var b = d.querySelector('b,.hv,.v,strong,span'); if (!b) return;
        var vv = A.txt(b), ll = A.txt(d).replace(vv, '').trim(); if (!vv) return; dels.push({ l: ll, v: vv, cor: A.cor(b) });
      });
      var extra = [].slice.call(raiz.querySelectorAll('.hrem,.hero-sub,.hero-leg,.hero-period,.hsub,.hero-tag,.hnota')).filter(A.vis).map(A.txt).filter(Boolean).join(' · ');
      var vt = A.txt(v), filhos = [].slice.call(v.children).filter(function (x) { return A.vis(x) && A.txt(x); });
      if (filhos.length && A.proprio(v) && filhos.some(function (x) { return A.fs(x) < A.fs(v) * .8; })) { vt = A.proprio(v); extra = [filhos.map(A.txt).join(' '), extra].filter(Boolean).join(' · '); }
      else if (filhos.length >= 2 && !A.proprio(v)) { vt = A.txt(filhos[0]); extra = [filhos.slice(1).map(A.txt).join(' '), extra].filter(Boolean).join(' · '); }
      if (!vt || vt === '—') { if (!dels.length) return; }
      itens.push({ l: l, v: vt, cor: A.cor(v), dels: dels, extra: extra });
    });
    return itens.length ? { t: 'hero', itens: itens } : null;
  }
  // o texto PRÓPRIO do elemento (os nós de texto dele, sem os filhos): é o que
  // separa "18,5" do "<small>de 25,0</small>" dentro do mesmo valor
  A.proprio = function (el) { var s = ''; for (var i = 0; i < el.childNodes.length; i++) { var n = el.childNodes[i]; if (n.nodeType === 3) s += n.nodeValue; } return s.replace(/\s+/g, ' ').trim(); };
  function leCard(c) {
    var lab = c.querySelector('.kl,.klbl,.card-label,.lbl,.kn,.k-l,[class$="-label"],[class$="-lbl"],[class$="-name"]'), val = c.querySelector('.kv,.kval,.card-value,.val,.kvn,.k-v,.v,[class$="-value"],[class$="-val"],.uc-score'), met = c.querySelector('.km,.kmeta,.card-meta,.meta,.k-m,.sub,[class$="-sub"],[class$="-meta"],.uc-code');
    var l = lab ? A.txt(lab) : '', v = '', m = met ? A.txt(met) : '';
    // card que é uma MINI-TABELA de uma linha (a Árvore de Combustível: Rem · Real · Δ · Δ%):
    // vira um grupo de cards com o rótulo do card como título
    var tb = c.querySelector('table');
    if (tb && !val) {
      var ths = [].slice.call(tb.querySelectorAll('th')).filter(A.vis), tds = [].slice.call(tb.querySelectorAll('tbody td, tr:not(:first-child) td')).filter(A.vis);
      if (ths.length && tds.length === ths.length) {
        var it = tds.map(function (td, i) { return { l: A.txt(ths[i]), v: A.txt(td), m: '', cor: A.corCel(td), mcor: '' }; }).filter(function (x) { return x.v; });
        if (it.length) return { multi: true, tit: l, itens: it };
      }
    }
    if (val) { var sm = val.querySelector('small,.un,.unit'); if (sm && A.proprio(val)) { v = A.proprio(val); m = [A.txt(sm), m].filter(Boolean).join(' · '); } else v = A.txt(val); }
    if (!v) {   // sem as classes: o maior número é o valor, o que vem antes é o rótulo, o que vem depois é a nota
      var els = [].slice.call(c.querySelectorAll('*')).filter(function (x) { return A.vis(x) && A.proprio(x); });
      if (!els.length) { var t = A.txt(c); return t ? { l: '', v: t, m: '', cor: A.cor(c) } : null; }
      var mx = els.reduce(function (a, b) { return A.fs(b) > A.fs(a) ? b : a; }, els[0]);
      val = mx; v = A.proprio(mx); var i = els.indexOf(mx);
      l = els.slice(0, i).map(A.proprio).join(' · '); m = els.slice(i + 1).map(A.proprio).join(' · ');
    }
    if (m.length > 90) m = m.slice(0, 88).replace(/\s+\S*$/, '') + '…';   // nota comprida (o corpo inteiro de um card por unidade) não cabe no celular
    var mb = met && met.querySelector('b,strong,span'); var mcor = mb ? A.cor(mb) : (met ? A.cor(met) : '');
    var cor = val ? A.cor(val) : ''; if (!cor && val) { var vb = val.querySelector('b,span,i'); if (vb) cor = A.cor(vb); }
    return { l: l, v: v, m: m, cor: cor, mcor: mcor };
  }
  function pushCards(cards, blocos) {
    var itens = [];
    cards.forEach(function (c) { var r = leCard(c); if (!r) return;
      if (r.multi) { if (itens.length) { blocos.push({ t: 'kpis', itens: itens }); itens = []; } blocos.push({ t: 'kpis', tit: r.tit, itens: r.itens }); }
      else if ((r.v || r.l) && String(r.v).length <= 60) itens.push(r); });   // "valor" longo é texto, não card
    if (itens.length) blocos.push({ t: 'kpis', itens: itens });
  }
  function leKpis(el, blocos) {
    var cards = [].slice.call(el.children).filter(A.vis);
    if (cards.length === 1 && cards[0].children.length > 1 && !ehKpi(cards[0])) cards = [].slice.call(cards[0].children).filter(A.vis);
    pushCards(cards, blocos);
  }
  function leGrafico(el) {
    var C = window.Chart, cv = el.querySelector('canvas'); if (!C || !C.getChart || !cv) return null;
    var ch = null; try { ch = C.getChart(cv); } catch (e) {} if (!ch || !ch.data) return null;
    if (/scatter|bubble|radar/.test(ch.config.type || '')) return null;   // dispersão não cabe no app (fica no painel completo)
    var ds = (ch.data.datasets || []).filter(function (d) { return !d.hidden && (d.data || []).length; });
    if (!ds.length) return null;
    var o = ch.options || {}, sc = o.scales || {};
    var tit = el.querySelector('.gtit,.chart-title,.gt,.ct'), sub = el.querySelector('.gsub,.chart-sub,.gs');
    return { t: 'graf', tipo: ch.config.type || 'bar', tit: tit ? A.txt(tit) : '', sub: sub ? A.txt(sub) : '', horiz: o.indexAxis === 'y',
      stacked: !!((sc.x || {}).stacked || (sc.y || {}).stacked),
      labels: (ch.data.labels || []).map(function (x) { return x == null ? '' : Array.isArray(x) ? x.join(' ') : String(x); }).slice(0, 80),
      ds: ds.slice(0, 8).map(function (d) { return { label: d.label || '', tipo: d.type || '', fill: !!d.fill, dash: !!(d.borderDash && d.borderDash.length),
        cor: A.corCss(d.type === 'line' || ch.config.type === 'line' ? (d.borderColor || d.backgroundColor) : (d.backgroundColor || d.borderColor)),
        borda: A.corCss(d.borderColor),
        data: (d.data || []).slice(0, 80).map(function (v) { if (v && typeof v === 'object') v = v.y != null ? v.y : v.x; var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : null; }) }; }) };
  }
  function leTabela(tab, card) {
    var ths = [].slice.call(tab.querySelectorAll('thead th, thead td')).filter(A.vis);
    if (!ths.length) { var r0 = tab.querySelector('tr'); if (r0) ths = [].slice.call(r0.children).filter(A.vis); }
    var head = ths.map(A.txt);
    var trs = [].slice.call(tab.querySelectorAll('tbody tr')).filter(function (tr) { return A.vis(tr) && !tr.closest('thead'); });
    var rows = [], nTot = trs.length;
    trs.slice(0, 80).forEach(function (tr) {
      var tds = [].slice.call(tr.children).filter(A.vis); if (!tds.length) return;
      var cls = tr.className || '';
      rows.push({ tot: /\btotal\b|\btot\b|pre-total|rodape/.test(cls), c: tds.map(function (td) { return { v: A.txt(td), cor: A.corCel(td) }; }) });
    });
    rows = rows.filter(function (r) { return r.c.some(function (c) { return c.v; }); });
    if (!rows.length) return null;
    var titEl = null, cont = card || tab.parentElement;
    for (var k = 0; k < 4 && cont && !titEl; k++) { titEl = [].slice.call(cont.querySelectorAll(SEL_TIT)).filter(function (x) { return A.vis(x) && !tab.contains(x); })[0] || null; cont = cont.parentElement; }
    var sub = card ? card.querySelector('.tsub,.gsub,.tbl-sub') : null;
    return { t: 'tab', tit: titEl ? A.txt(titEl) : '', sub: sub && A.vis(sub) ? A.txt(sub) : '', head: head, rows: rows, n: nTot };
  }
  function leTexto(el) {
    var tit = el.querySelector(SEL_TIT), t = tit && A.vis(tit) ? A.txt(tit) : '';
    var corpo = (el.innerText || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
    if (t && corpo.indexOf(t) === 0) corpo = corpo.slice(t.length).trim();
    if (corpo.length < 24) return null;
    var ls = corpo.split('\n'); if (ls.length >= 15 && ls.filter(function (l) { return l.trim().length <= 4; }).length / ls.length > .6) return null;   // grade de células (calendário): não é texto
    return { t: 'txt', tit: t, corpo: corpo.slice(0, 1200) };
  }
  function temFilho(el, s) { return !!el.querySelector(s); }
  function varre(raiz, blocos, prof) {
    if (prof > 14) return;
    var fs = [].slice.call(raiz.children);
    var soltos = [];
    var fechaSoltos = function () { if (soltos.length) { pushCards(soltos, blocos); soltos = []; } };
    fs.forEach(function (el) {
      if (!A.vis(el)) return;
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CANVAS' || tag === 'SVG' || tag === 'svg' || tag === 'BUTTON' || tag === 'NAV' || tag === 'ASIDE' || tag === 'HEADER' || el.matches('.side,.topo,.top,.pbar,.ms-wrap,.filtros,.s-volta,.dica,.chips,.hcab,.tit-wrap,.acoes,.gate')) return;
      if (ehKpi(el) && !ehHero(el)) { soltos.push(el); return; }
      fechaSoltos();
      if (ehHero(el)) { var h = leHero(el); if (h) blocos.push(h); return; }
      if (ehKpis(el) || ([].slice.call(el.children).filter(function (x) { return x.matches && ehKpi(x); }).length >= 2)) { leKpis(el, blocos); return; }
      if (el.matches(SEL_GRAF) || (temFilho(el, 'canvas') && !temFilho(el, SEL_GRAF) && !temFilho(el, 'table') && el.querySelectorAll('canvas').length === 1)) { var g = leGrafico(el); if (g) blocos.push(g); else varre(el, blocos, prof + 1); return; }
      if (tag === 'TABLE') { var t = leTabela(el, null); if (t) blocos.push(t); return; }
      var tabs = el.querySelectorAll('table');
      if (tabs.length === 1 && !temFilho(el, 'canvas') && !temFilho(el, SEL_KPIS) && !temFilho(el, SEL_HERO) && !temKpi(el)) { var t1 = leTabela(tabs[0], el); if (t1) blocos.push(t1); return; }
      if (el.matches('.card,.quad,.quadrante,.diag-card,.bloco,.tx-card,.info,.passo,.regra') && !temFilho(el, 'canvas,table,' + SEL_KPIS + ',' + SEL_HERO + ',.card')) { var x = leTexto(el); if (x) blocos.push(x); return; }
      if (el.children.length) varre(el, blocos, prof + 1);
    });
    fechaSoltos();
  }
  A.extrai = function (vigId) {
    var raiz = document.querySelector('.vw.on') || document.querySelector('.cols,.vws,.conteudo,main,.hmio') || document.body;
    var blocos = []; varre(raiz, blocos, 0);
    // tira repetições (o mesmo card lido duas vezes por caminhos diferentes)
    var vistos = {}; blocos = blocos.filter(function (b) { var k = JSON.stringify(b).slice(0, 400); if (vistos[k]) return false; vistos[k] = 1; return true; });
    var vistas = [].slice.call(document.querySelectorAll('.s-item[data-vw]')).filter(A.vis).map(function (b) { var c = b.cloneNode(true); [].slice.call(c.querySelectorAll('svg,small,.cnt,.badge,.pnd,[class*="cnt"],[class*="badge"],[class*="pill"]')).forEach(function (s) { s.remove(); }); return { v: b.dataset.vw, t: A.txt(c).replace(/([^\d\s])\s*\d+(\/\d+)?$/, '$1').trim() }; });
    var on = document.querySelector('.vw.on'); var atual = on ? on.id.replace(/^vw-/, '') : '';
    var tit = document.getElementById('tit') || document.querySelector('.tit-wrap h1,.tit h1,h1');
    var sub = document.getElementById('titSub') || document.querySelector('.tit-sub');
    var vig = vigId ? { id: vigId, opts: A.vigOpts(vigId).slice(0, 60) } : null;
    return { tit: tit ? A.txt(tit) : '', sub: sub ? A.txt(sub) : '', vistas: vistas, atual: atual, vig: vig, blocos: blocos, lido: Date.now() };
  };
}
var HELPER_SRC = '(' + __APP_HELPER.toString() + ')()';

/* ═════════ carregar um painel: abrir, (visão, vigência), ler ═════════ */
var _lendo = null;   // uma leitura por vez: o forno é um só
async function carrega(p, opt) {
  opt = opt || {};
  while (_lendo) { if (!opt.fundo) _abortaFundo = Date.now(); try { await _lendo; } catch (e) {} }
  if (!opt.fundo) _abortaFundo = 0;
  var prom = _carrega(p, opt);
  _lendo = prom.then(null, function () {}).finally(function () { _lendo = null; });   // quem espera não herda a rejeição (o chamador já a trata)
  return prom;
}
async function _carrega(p, opt) {
  var url = urlDe(p);
  var F = await abreForno(url);
  var win = F.win, doc = F.doc;
  if (!F.pronto) {
    var st = await esperaPronto(win, doc, { fundo: !!opt.fundo });
    if (st === 'abortado') throw new Error('abortado');
    if (st === 'gate') throw new Error('o painel recusou o acesso: ' + (((doc.querySelector('.gate h2') || {}).textContent) || 'sem permissão'));
    F.pronto = true; F.t = Date.now();
  }
  doc = F.doc = win.document;
  if (!win.__app) win.eval(HELPER_SRC);
  var tema = document.body.classList.contains('claro') ? 'light' : 'dark';
  try { win.__app.tema(tema); } catch (e) {}
  var msgs = [];
  if (!F.vistas) { F.vistas = win.__app.extrai('').vistas.map(function (v) { return v.v; }); F.vw = F.vistas[0] || ''; F.vig = ''; }
  // o iframe é reaproveitado: a visão volta à pedida (ou à 1ª) e a vigência só muda se for pedida
  var vwAlvo = opt.vw || F.vistas[0] || '';
  if (vwAlvo && vwAlvo !== F.vw) { var m1 = win.__app.vw(vwAlvo); if (m1) msgs.push(m1); else F.vw = vwAlvo; await espera(T.pos); await esperaPronto(win, doc, { teto: 12000, min: 600 }); }
  if (opt.vig && opt.vig !== F.vig) {
    var alvos = opt.vig === '*' ? [] : [opt.vig];   // '*' = Todos (nada marcado no filtro do painel)
    var m2 = p.vig === 'elite' ? win.__app.elite(alvos) : win.__app.sel(p.vig, alvos);
    if (m2) msgs.push(m2);
    else { F.vig = opt.vig; if (p.vig !== 'elite') { var m3 = win.__app.redesenha(p.rdz || ''); if (m3) msgs.push(m3); } }
    await espera(T.pos); await esperaPronto(win, doc, { teto: 60000, min: 1500 });
  }
  await espera(250);
  var data = win.__app.extrai(p.vig === '' ? '' : p.vig);
  data.msgs = msgs; data.vw = F.vw || data.atual; data.vigSel = F.vig || '';
  data.padrao = (!F.vistas[0] || data.vw === F.vistas[0]) && !data.vigSel;
  if (!data.blocos.length && !opt.vw) throw new Error('sem-blocos');
  cacheGrava(p, data.vw, data.vigSel, data);
  return data;
}

/* ═════════ a tela do painel ═════════ */
function abrePainel(id) {
  var p = painelPorId(id); if (!p) return;
  fechaMenu(); marcaRecente(id); logAcesso(p.href.replace(/\/?(index\.html)?(\?.*)?$/, ''));
  if (p.modo === 'web') { abreWeb(p); return; }
  PN = p; PN_VW = ''; PN_VIG = ''; PN_DATA = null;
  $('pnTit').textContent = p.nome; $('pnSub').textContent = p.desc;
  $('btFav').classList.toggle('on', ehFav(p.id));
  $('pnVistas').innerHTML = ''; $('pnVigs').innerHTML = '';
  $('pnCorpo').innerHTML = ''; $('pnCorpo').scrollTop = 0;
  $('tela-painel').classList.add('on');
  var c = cachePadrao(p);
  if (c && c.data) { PN_DATA = c.data; PN_VW = c.data.vw || ''; PN_VIG = c.data.vigSel || ''; desenhaPainel(c.data, { lido: c.t, robo: c.robo }); }
  else estado('Abrindo o painel…');
  if (fresco(c)) { estado(''); return; }
  // sem resumo fresco aqui: antes de abrir o iframe, pede ao banco o que o robô leu (todas as visões do painel)
  var seq = ++_leSeq;
  preLe([p.id]).then(function (n) {
    if (PN !== p || seq !== _leSeq) return;
    var c2 = n ? cachePadrao(p) : c;
    if (c2 && c2.data && (!c || c2.t > c.t)) { PN_DATA = c2.data; PN_VW = c2.data.vw || ''; PN_VIG = c2.data.vigSel || ''; desenhaPainel(c2.data, { lido: c2.t, robo: c2.robo }); }
    if (fresco(c2)) estado(''); else lePainel({});
  });
}
function fechaPainel() { $('tela-painel').classList.remove('on'); PN = null; PN_DATA = null; mataGraficos(); renderInicio(); setTimeout(filaDestaques, 500); }
function recarregaPainel() { if (!PN) return; mataForno(); window.__gvizMem = {}; lePainel({ vw: PN_VW, vig: PN_VIG, forca: true }); }
function estado(msg, erro) {
  var el = $('pnEstado');
  if (!el) { el = document.createElement('div'); el.id = 'pnEstado'; el.className = 'estado'; $('pnCorpo').insertBefore(el, $('pnCorpo').firstChild); }
  el.className = 'estado' + (erro ? ' erro' : ''); el.innerHTML = msg ? '<i></i><span>' + esc(msg) + '</span>' : ''; el.style.display = msg ? '' : 'none';
}
var _leSeq = 0;
async function lePainel(o) {
  var p = PN, seq = ++_leSeq; if (!p) return;
  var vw = o.vw || PN_VW, vig = o.vig || PN_VIG;
  if (!o.forca) {
    var c = cacheLe(p, vw, vig);
    if (!fresco(c) && vig && vig !== '*') { var c0 = cacheLe(p, vw, ''); if (fresco(c0) && c0.data && vigDe(c0.data) === vig) c = c0; }   // o mês clicado é o padrão do painel: o resumo já está aqui
    if (fresco(c)) { PN_DATA = c.data; desenhaPainel(c.data, { lido: c.t, robo: c.robo }); estado(''); return; }
  }
  estado(PN_DATA ? (o.vig && o.vig !== PN_DATA.vigSel ? 'Lendo ' + (o.vig === '*' ? 'todas as vigências' : vigRotulo(o.vig)) + ' no painel… leva uns segundos' : 'Atualizando…') : 'Abrindo o painel… (os números vêm do próprio painel)');
  try {
    var d = await carrega(p, { vw: vw || undefined, vig: vig || undefined });
    if (seq !== _leSeq || PN !== p) return;
    PN_DATA = d; PN_VW = d.vw || ''; PN_VIG = d.vigSel || '';
    desenhaPainel(d, { lido: d.lido });
    estado(d.msgs && d.msgs.length ? d.msgs.join(' · ') : '', !!(d.msgs && d.msgs.length));
    if (!d.msgs || !d.msgs.length) estado('');
  } catch (e) {
    if (seq !== _leSeq || PN !== p) return;
    var m = (e && e.message) || 'erro';
    if (m === 'abortado') return;
    if (m === 'sem-blocos') { $('pnCorpo').innerHTML = '<div class="vazio"><b>Este painel não tem resumo no app.</b><br>Abra o painel completo, que já funciona no celular.<button class="btn" onclick="abreWeb(PN)">Abrir o painel completo</button></div>'; estado(''); return; }
    estado(m, true);
    if (!PN_DATA) $('pnCorpo').innerHTML += '<div class="vazio">Não deu para ler o painel agora.<br><span style="color:var(--txt3)">' + esc(m) + '</span><button class="btn ghost" onclick="recarregaPainel()">Tentar de novo</button><button class="btn" onclick="abreWeb(PN)">Abrir o painel completo</button></div>';
  }
}
function mudaVista(v) { if (!PN || v === PN_VW) return; PN_VW = v; marcaChips('pnVistas', v); lePainel({ vw: v, vig: PN_VIG }); }
function mudaVig(v) { if (!PN) return; PN_VIG = v; VIG_SEL = v; marcaChips('pnVigs', v); lePainel({ vw: PN_VW, vig: v }); }
/* ── vigência em DUAS linhas (Renan, 06/11/2026: "Poderia ter toggle de ano, e abaixo de mês só
   lado a lado: All, Jan, Fev, Mar…"): os anos em cima, os meses do ano em ordem de calendário
   embaixo, com "Todos" na frente. Cada painel escreve a vigência de um jeito (set/26, SET/2026,
   09/2026, 2026-09, Set/2026, 2026/09/01, "Todas"); o que não se lê como mês fica como veio. ── */
var VIG_OPTS = [], VIG_SEL = '', VIG_ANO = null;
var MES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
var MES_IDX = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
function vigDe(d) { return d.vigSel || (((d.vig && d.vig.opts) || []).filter(function (x) { return x.on; }).map(function (x) { return x.v; })[0] || ''); }   // a vigência que o resumo mostra: a pedida ou a marcada no painel
function vigRotulo(v) { var o = null; VIG_OPTS.forEach(function (x) { if (x.v === v) o = x; }); var l = o && vigLe(o); return l && l.mes != null ? MES_ABR[l.mes] + '/' + String(l.ano).slice(2) : (o ? o.t : v); }
function vigLe(o) {
  var cands = [o.t, o.v].map(function (s) { return String(s == null ? '' : s).trim(); }).filter(Boolean);
  for (var i = 0; i < cands.length; i++) {
    var s = cands[i], m;
    if (/^(todas|todos|tudo|all)\b/i.test(s)) return { todos: true };
    if ((m = s.match(/^([a-zç]{3})[a-zç]*[\/\-\s.]?(\d{2}|\d{4})$/i)) && MES_IDX[m[1].toLowerCase()] != null) return { ano: m[2].length === 2 ? 2000 + +m[2] : +m[2], mes: MES_IDX[m[1].toLowerCase()] };
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return { ano: +m[2], mes: +m[1] - 1 };
    if ((m = s.match(/^(\d{4})[\/\-](\d{1,2})(?:[\/\-]\d{1,2})?$/)) && +m[2] >= 1 && +m[2] <= 12) return { ano: +m[1], mes: +m[2] - 1 };
  }
  return null;
}
function vigChipsHtml() {
  var vg = VIG_OPTS, sel = VIG_SEL;
  if (vg.length <= 1) return '';
  var lidos = vg.map(vigLe), chip = function (v, t, on, cls) { return '<span class="chip' + (on ? ' on' : '') + (cls ? ' ' + cls : '') + '" data-v="' + esc(v) + '" onclick="mudaVig(\'' + esc(v) + '\')">' + esc(t) + '</span>'; };
  if (lidos.some(function (x) { return !x; }) || !lidos.some(function (x) { return x && x.mes != null; }))
    return vg.map(function (v) { return chip(v.v, v.t, v.v === sel); }).join('');   // formato que não se lê: como veio
  var todosOpt = null, porAno = {};
  vg.forEach(function (o, i) { var l = lidos[i]; if (l.todos) { if (!todosOpt) todosOpt = o; return; } (porAno[l.ano] = porAno[l.ano] || []).push({ o: o, mes: l.mes }); });
  var anos = Object.keys(porAno).map(Number).sort(function (a, b) { return b - a; });
  var selL = null; vg.forEach(function (o, i) { if (o.v === sel) selL = lidos[i]; });
  var ano = VIG_ANO != null && porAno[VIG_ANO] ? VIG_ANO : (selL && selL.ano && porAno[selL.ano] ? selL.ano : anos[0]);
  VIG_ANO = ano;
  var vTodos = todosOpt ? todosOpt.v : (PN && PN.vig && PN.vig !== 'elite' ? '*' : null);
  // linha de cima: os anos (sempre, mesmo um só) e "Todos" na ponta direita
  var h = '<div class="chips vig anos">' + anos.map(function (a) { return '<span class="chip' + (a === ano ? ' on' : '') + '" onclick="mudaAno(' + a + ')">' + a + '</span>'; }).join('') +
    (vTodos != null ? chip(vTodos, 'Todos', sel === vTodos || !sel, 'todos') : '') + '</div>';
  // linha de baixo: os 12 meses em grade fixa; mês sem dado no ano fica apagado e não clica
  var doAno = {}; porAno[ano].forEach(function (m) { doAno[m.mes] = m.o; });
  h += '<div class="chips vig meses">' + MES_ABR.map(function (t, i) { var o = doAno[i]; return o ? chip(o.v, t, o.v === sel) : '<span class="chip off">' + t + '</span>'; }).join('') + '</div>';
  return h;
}
function mudaAno(a) { VIG_ANO = a; $('pnVigs').innerHTML = vigChipsHtml(); }
function marcaChips(id, v) { document.querySelectorAll('#' + id + ' .chip[data-v]').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); }); }

/* ═════════ desenhar no estilo DriverPro (v2, 06/11/2026) ═════════
   Renan: "a versão mobile hoje é muito ruim de usar… que caibam infos no
   celular… as visões podem ser mais diretas, resumidas, estilo app mesmo".
   O que muda em relação à 1ª versão: o hero vira número + pílulas coloridas;
   os cards escolhem 2 ou 3 colunas pelo tamanho do número e os grupos de
   mini-tabela (Rem · Real · Δ · Δ%) viram UMA linha; gráfico categórico de
   uma série vira LISTA DE BARRAS (sem canvas), rosca vira lista com bolinha
   e %, série temporal longa abre nos últimos 12 pontos com "tudo" ao lado;
   tabela vira LISTA (nome à esquerda, valor principal à direita, o segundo
   valor embaixo e uma barra proporcional), com chips para trocar a coluna;
   texto longo vem recolhido; e a visão com muitos blocos ganha um índice. */
var GRAFS = [], GR = {}, TABS = {};
function mataGraficos() { GRAFS.forEach(function (g) { try { g.destroy(); } catch (e) {} }); GRAFS = []; GR = {}; }
function numOk(v) { return typeof v === 'number' && isFinite(v); }
/* rótulo em CAIXA ALTA (os painéis escrevem assim) vira frase: siglas curtas ficam */
var MANTEM = { FCA: 1, DPO: 1, VPO: 1, CIVF: 1, CIFV: 1, QLP: 1, YTD: 1, MOM: 1, YOY: 1, CPK: 1, DRE: 1, ANP: 1, KPI: 1, EBITDA: 1, GEO: 1, SUL: 1, ROTA: 1, SEARA: 1, AMBEV: 1, SLA: 1, MTTR: 1, MTBF: 1, RPM: 1, ICMS: 1, PIS: 1, COFINS: 1, FINAME: 1, ERP: 1, API: 1, VAN: 1, UDC: 1, BID: 1, NOK: 1, CONLOG: 1, ARLA: 1, VW: 1 };
var MINUSC = { A: 1, VS: 1, DE: 1, DO: 1, DA: 1, NO: 1, NA: 1, EM: 1, POR: 1, COM: 1, SEM: 1, DOS: 1, DAS: 1, REM: 1, PTS: 1, OU: 1, E: 1, AO: 1, À: 1 };
function suave(s) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!s || s !== s.toUpperCase() || !/[A-ZÀ-Ü]/.test(s)) return s;
  var out = s.split(' ').map(function (w) {
    return w.split('/').map(function (part) {
      var l = part.replace(/[^A-ZÀ-Ü0-9]/g, '');
      if (!l) return part;
      if (MINUSC[l]) return part.toLowerCase();
      if (MANTEM[l] || /\d/.test(l) || (l.length <= 3 && /^[A-Z]+$/.test(l))) return part;
      return part.toLowerCase();
    }).join('/');
  }).join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
}
var MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function rotuloCurto(s) {
  s = String(s == null ? '' : s).trim(); var m;
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return MES3[+m[1] - 1] + '/' + m[2].slice(2);
  if ((m = s.match(/^([a-zç]{3})[a-zç]*\.?\/(\d{4})$/i))) return m[1].toLowerCase() + '/' + m[2].slice(2);
  if ((m = s.match(/^(\d{4})-(\d{2})$/))) return MES3[+m[2] - 1] + '/' + m[1].slice(2);
  if ((m = s.match(/^([a-zç]{3})[a-zç]*\.?\s*\/?\s*(\d{2})$/i))) return m[1].toLowerCase() + '/' + m[2];
  return s.length > 14 ? s.slice(0, 13) + '…' : s;
}
function ehTemporal(labels) {
  var n = 0; (labels || []).forEach(function (l) { l = String(l == null ? '' : l).trim();
    if (/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(l) || /^\d{1,2}\/\d{2,4}$/.test(l) || /^\d{4}-\d{2}/.test(l) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(l) || /^\d{4}$/.test(l) || /^\d{1,2}\/\d{1,2}$/.test(l) || /^\d{1,2}[hH]$/.test(l) || /^[12][hH]\d{2}$/i.test(l) || /^Q[1-4]/i.test(l)) n++; });
  return (labels || []).length >= 3 && n / labels.length >= .6;
}
/* número de um texto pt-BR ("R$ 1.234,5", "-12,3%", "566k", "2,2 mi", "(1.200)") */
function numDe(s) {
  if (s == null) return null; var raw = String(s).trim(); if (!raw || !/\d/.test(raw)) return null;
  if (/^[a-záéíóúç]+\s*\d/i.test(raw) && !/^r\$/i.test(raw)) return null;   // "jun/26", "Q3" não são números
  var mult = /\d\s*bi\b/i.test(raw) ? 1e9 : /\d\s*mi\b/i.test(raw) ? 1e6 : /\d\s*k\b/.test(raw) ? 1e3 : 1;
  var neg = /^\s*[-−(]/.test(raw) || /^\s*-?R\$\s*-/.test(raw) || /^-R\$/.test(raw);
  var t = raw.replace(/[−]/g, '-').replace(/[^\d,.\-]/g, '');
  if (!t || !/\d/.test(t)) return null;
  var v;
  if (/,\d+$/.test(t)) v = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) v = parseFloat(t.replace(/\./g, ''));
  else v = parseFloat(t.replace(/,/g, ''));
  if (!isFinite(v)) return null;
  if (neg && v > 0) v = -v;
  return v * mult;
}
function fmtEixo(v) { if (typeof v !== 'number') return v; var a = Math.abs(v); if (a >= 1e9) return (v / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' bi'; if (a >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'; if (a >= 1e4) return Math.round(v / 1e3).toLocaleString('pt-BR') + 'k'; return v.toLocaleString('pt-BR', { maximumFractionDigits: a < 10 ? 2 : 1 }); }

function desenhaPainel(d, o) {
  o = o || {};
  var titulo = d.tit && d.tit !== PN.nome ? d.tit : '';
  $('pnSub').textContent = d.sub || PN.desc;
  var vs = (d.vistas || []);
  $('pnVistas').innerHTML = vs.length > 1 ? vs.map(function (v) { return '<span class="chip' + (v.v === (d.vw || d.atual) ? ' on' : '') + '" data-v="' + esc(v.v) + '" onclick="mudaVista(\'' + esc(v.v) + '\')">' + esc(v.t) + '</span>'; }).join('') : '';
  var vg = d.vig && d.vig.opts && d.vig.opts.length ? d.vig.opts : [];
  var sel = vigDe(d);
  VIG_OPTS = vg; VIG_SEL = sel; VIG_ANO = null;
  $('pnVigs').innerHTML = vigChipsHtml();
  mataGraficos(); TABS = {};
  var bl = d.blocos || [];
  var h = '<div id="pnEstado" class="estado" style="display:none"></div>';
  // índice da visão: só quando há mais de 5 blocos com título (as visões longas, tipo Gestão à Vista)
  var idx = []; var nomeDe = function (b, i) { return b.tit || (b.t === 'graf' ? 'Gráfico ' + (i + 1) : b.t === 'tab' ? 'Tabela ' + (i + 1) : ''); };
  bl.forEach(function (b, i) { if (b.t === 'graf' || b.t === 'tab') idx.push({ i: i, n: nomeDe(b, i) }); });
  if (bl.length > 5 && idx.length >= 3) h += '<div class="idx"><span class="chip on" onclick="vaiBloco(\'pnCorpo\')">Resumo</span>' + idx.map(function (x) { return '<span class="chip" onclick="vaiBloco(\'b' + x.i + '\')">' + esc(x.n.length > 26 ? x.n.slice(0, 25) + '…' : x.n) + '</span>'; }).join('') + '</div>';
  // texto explicativo vai EMBAIXO, nunca em cima (Renan, 06/11/2026: "Se quer colocar
  // texto explicativo, coloque embaixo"): os blocos de texto saem depois dos números
  var ordem = bl.map(function (b, i) { return i; }).filter(function (i) { return bl[i].t !== 'txt'; }).concat(bl.map(function (b, i) { return i; }).filter(function (i) { return bl[i].t === 'txt'; }));
  ordem.forEach(function (i) {
    var b = bl[i], id = 'b' + i;
    if (b.t === 'hero') h += heroHtml(b);
    else if (b.t === 'kpis') h += kpisHtml(b);
    else if (b.t === 'graf') h += grafHtml(b, id);
    else if (b.t === 'tab') h += tabHtml(b, id);
    else if (b.t === 'txt') h += txtHtml(b, id);
  });
  if (!bl.length) h += '<div class="vazio">Esta visão não tem resumo. <a onclick="abreWeb(PN)" style="color:var(--acc);font-weight:600">Abrir o painel completo</a></div>';
  h += '<div class="pe-painel">' + (titulo ? esc(titulo) + ' · ' : '') + (o.lido ? (o.robo ? 'lido pelo robô em ' : 'lido do painel em ') + horaDe(o.lido) : '') + '<br><a onclick="abreWeb(PN)">Abrir o painel completo</a> · <a onclick="recarregaPainel()">Atualizar</a></div>';
  $('pnCorpo').innerHTML = h;
  bl.forEach(function (b, i) { if (b.t === 'graf' && GR['b' + i]) desenhaGrafico('b' + i); });
}
function vaiBloco(id) { var el = $(id); if (!el) return; if (id === 'pnCorpo') { el.scrollTop = 0; return; } el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

/* hero: número grande + pílulas coloridas com os deltas */
function pillsHtml(dels) {
  // valor longo (texto: "CDD RIO DE JANEIRO · 96") ocupa a linha inteira, senão come o rótulo
  // quando um terço ou mais são largas, TODAS vão uma por linha (senão fica uma curta sozinha ao lado de uma linha inteira)
  if (!dels || !dels.length) return '';
  // painel que escreve o número ANTES do rótulo ("+4%" / "MoM", Remuneração) chega trocado: destroca
  var ds = dels.slice(0, 8).map(function (x) {
    var l = String(x.l == null ? '' : x.l), v = String(x.v == null ? '' : x.v);
    return (/^[+\-−▲▼]?\s*[\d.,]+\s*%?$/.test(l.trim()) && v && !/\d/.test(v)) ? { l: v, v: l, cor: x.cor } : x;
  });
  var nl = ds.filter(function (x) { return String(x.v == null ? '' : x.v).length > 11; }).length, todas = nl * 3 >= ds.length;
  return '<div class="pills' + (todas ? ' lista' : '') + '">' + ds.map(function (x) { var v = String(x.v == null ? '' : x.v); return '<span class="pill ' + corCls(x.cor) + (v.length > 11 ? ' larga' : '') + '"><span>' + esc(suave(x.l)) + '</span><b>' + esc(v) + '</b></span>'; }).join('') + '</div>';
}
function heroHtml(b) {
  return '<div class="hero">' + b.itens.map(function (it, i) {
    var v = String(it.v == null ? '' : it.v), cls = v.length > 14 ? ' menor' : v.length > 10 ? ' medio' : '';
    return '<div class="hi' + (i ? ' hi2' : '') + '"><div class="rot">' + esc(suave(it.l)) + '</div><div class="val ' + corCls(it.cor) + cls + '">' + esc(v) + '</div>' +
      (it.extra ? '<div class="extra">' + esc(it.extra) + '</div>' : '') + pillsHtml(it.dels) + '</div>';
  }).join('') + '</div>';
}
/* cards: 2 por linha; 3 quando são muitos e curtos (os faróis do Gestão à Vista);
   o grupo de mini-tabela (Rem · Real · Δ · Δ% da Árvore) vira UMA linha */
function kpisHtml(b) {
  var its = b.itens || [], longos = [];
  // "card" com rótulo de parágrafo (a tabela de pesos da Saúde dos Pneus lida como card) vira texto recolhido
  its = its.filter(function (k) { if (suave(k.l || '').length > 60) { longos.push(k); return false; } return true; });
  var txt = longos.map(function (k, i) { return txtHtml({ t: 'txt', corpo: [suave(k.l), k.v, k.m].filter(Boolean).join(' · ') }, 'tx-k' + i); }).join('');
  if (!its.length) return txt;
  if (b.tit && its.length <= 6 && its.every(function (k) { return String(k.v).length <= 10 && !k.m; })) {
    return '<div class="kgrp"><div class="t">' + esc(suave(b.tit)) + '</div><div class="row">' + its.map(function (k) { return '<div><span>' + esc(suave(k.l)) + '</span><b class="' + corCls(k.cor) + '">' + esc(k.v) + '</b></div>'; }).join('') + '</div></div>';
  }
  var curtos = its.length >= 6 && its.every(function (k) { return String(k.v).length <= 6 && suave(k.l).length <= 22 && (!k.m || k.m.length <= 18); });
  return (b.tit ? '<div class="sec">' + esc(suave(b.tit)) + '</div>' : '') + '<div class="kg' + (curtos ? ' c3' : '') + '">' + its.map(function (k) {
    var v = String(k.v == null ? '' : k.v), largo = v.length > 16 || (k.l && k.l.length > 44);
    return '<div class="k' + (largo ? ' largo' : '') + '"><div class="l">' + esc(suave(k.l)) + '</div><div class="v ' + corCls(k.cor) + (v.length > 11 ? ' menor' : '') + '">' + esc(v) + '</div>' + (k.m ? '<div class="m">' + metaHtml(k) + '</div>' : '') + '</div>';
  }).join('') + '</div>';
}
function metaHtml(k) { var m = suave(k.m); if (!k.mcor) return esc(m); var i = m.indexOf(':'); return i > 0 ? esc(m.slice(0, i + 1)) + ' <b class="' + corCls(k.mcor) + '">' + esc(m.slice(i + 1).trim()) + '</b>' : '<b class="' + corCls(k.mcor) + '">' + esc(m) + '</b>'; }

/* ── gráficos ── */
var PAL = ['#F97316', '#94A3B8', '#2E90E8', '#3BB33B', '#FF5252', '#F4A100', '#A78BFA', '#22D3EE'];
function corNorm(c, i) {   // cor do painel → cor legível no app (branco/preto do tema do painel viram cinza; vazio vira a paleta)
  if (typeof c !== 'string' || !c || /transparent/.test(c)) return PAL[i % PAL.length];
  var claro = document.body.classList.contains('claro'), neutro = claro ? '#4A5568' : '#C9D0DD';
  var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i), rgb = null;
  if (m) { var x = m[1]; if (x.length === 3) x = x.split('').map(function (q) { return q + q; }).join(''); rgb = [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
  else if (/^rgba?\(/.test(c)) { var r = c.match(/[\d.]+/g); if (r && r.length >= 3) rgb = [+r[0], +r[1], +r[2]]; }
  if (rgb) { var med = (rgb[0] + rgb[1] + rgb[2]) / 3; if (med > 228 || med < 42) return neutro; }
  return c;
}
function corDs(c, i) {
  if (Array.isArray(c)) return c.map(function (x) { return corNorm(x, i); });
  return corNorm(c, i);
}
function corUma(c, i, j) { var x = corDs(c, i); if (Array.isArray(x)) { var y = x[j] || x[0]; return typeof y === 'string' && y && !/transparent/.test(y) ? y : PAL[i % PAL.length]; } return x; }
function alfa(c, a) { if (Array.isArray(c)) return c.map(function (x) { return alfa(x, a); }); if (typeof c !== 'string') return c;
  var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i); if (m) { var x = m[1]; if (x.length === 3) x = x.split('').map(function (q) { return q + q; }).join(''); return 'rgba(' + parseInt(x.slice(0, 2), 16) + ',' + parseInt(x.slice(2, 4), 16) + ',' + parseInt(x.slice(4, 6), 16) + ',' + a + ')'; }
  var r = c.match(/^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/); if (r) return 'rgba(' + r[1] + ',' + r[2] + ',' + r[3] + ',' + a + ')'; return c; }
function legHtml(b) {
  return b.ds.length > 1 ? '<div class="leg">' + b.ds.map(function (d, i) { return '<span><i style="background:' + esc(corUma(d.cor, i, 0)) + '"></i>' + esc(d.label || (i === 0 && b.tit ? b.tit : 'série ' + (i + 1))) + '</span>'; }).join('') + '</div>' : '';
}
function grafHtml(b, id) {
  var circ = /doughnut|pie|polarArea/.test(b.tipo), temporal = ehTemporal(b.labels), n = b.labels.length;
  // subtítulo curto fica sob o título; nota longa (explicação) vai embaixo do gráfico
  var longo = b.sub && b.sub.length > 60, cab = (b.tit ? '<div class="t">' + esc(b.tit) + '</div>' : '') + (b.sub && !longo ? '<div class="s">' + esc(b.sub) + '</div>' : ''), pe = longo ? '<div class="s pe">' + esc(b.sub) + '</div>' : '';
  // categórico de uma série (ranking por unidade, impacto por projeto, rosca): lista de barras, sem canvas
  if (circ || (b.ds.length === 1 && !temporal && n <= 30)) return '<div class="gc" id="' + id + '">' + cab + listaBarras(b, circ, id) + pe + '</div>';
  GR[id] = { b: b, tudo: n <= 14 };
  return '<div class="gc" id="' + id + '">' + cab + legHtml(b) +
    (n > 14 ? '<div class="gtog"><span class="chip on" onclick="grafJanela(\'' + id + '\',false)">últimos 12</span><span class="chip" onclick="grafJanela(\'' + id + '\',true)">tudo (' + n + ')</span></div>' : '') +
    '<div class="cv' + (n > 14 ? ' ' : '') + '"><canvas></canvas></div>' + pe + '</div>';
}
function grafJanela(id, tudo) { if (!GR[id]) return; GR[id].tudo = tudo; var g = $(id); g.querySelectorAll('.gtog .chip').forEach(function (c, i) { c.classList.toggle('on', (i === 1) === tudo); }); var old = GRAFS.filter(function (x) { return x.canvas && x.canvas.closest('#' + id); })[0]; if (old) { try { old.destroy(); } catch (e) {} GRAFS = GRAFS.filter(function (x) { return x !== old; }); } desenhaGrafico(id); }
/* gráfico categórico de uma série → lista limpa: nome e valor, o valor na cor
   da barra do painel (verde/vermelho/âmbar; laranja e cinza ficam neutros).
   Rosca: a bolinha da cor + o % do total. Sem barra (Renan, 06/11/2026). */
function corClasse(c) {
  if (typeof c !== 'string') return '';
  var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i), rgb = null;
  if (m) { var x = m[1]; if (x.length === 3) x = x.split('').map(function (q) { return q + q; }).join(''); rgb = [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
  else if (/^rgba?\(/.test(c)) { var r = c.match(/[\d.]+/g); if (r && r.length >= 3) rgb = [+r[0], +r[1], +r[2]]; }
  if (!rgb) return '';
  var R = rgb[0] / 255, G = rgb[1] / 255, B = rgb[2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return ''; var s = d / (1 - Math.abs(2 * l - 1)), h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h = h * 60; if (h < 0) h += 360;
  if (s < .35 || l > .9 || l < .22) return '';
  if (h >= 75 && h <= 165) return 'g'; if (h < 14 || h > 335) return 'r'; if (h >= 38 && h < 60) return 'a'; return '';
}
function listaBarras(b, circ, id) {
  var ds = b.ds[0], vals = ds.data, labels = b.labels, soma = 0, itens = [];
  vals.forEach(function (v, j) { if (numOk(v)) soma += Math.abs(v); });
  labels.forEach(function (l, j) { var v = vals[j]; if (!numOk(v) && !l) return; itens.push({ l: String(l == null ? '' : l), v: v, j: j }); });
  var h = '<div class="bl' + (circ ? ' rosca' : '') + '">';
  var lim = itens.length > 12 ? 12 : itens.length;
  itens.forEach(function (it, k) {
    var cor = circ ? (corUma(ds.cor, 0, it.j) || PAL[it.j % PAL.length]) : corUma(ds.cor, 0, it.j);
    if (circ && (cor === PAL[0]) && Array.isArray(ds.cor) === false) cor = PAL[it.j % PAL.length];
    var pc = circ && soma ? ' · ' + (Math.abs(it.v) / soma * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '';
    var cls = circ ? '' : (Array.isArray(ds.cor) ? corCls(corClasse(cor)) : (numOk(it.v) && it.v < 0 ? 'neg' : ''));
    h += '<div class="br' + (k >= lim ? ' esc' : '') + '">' + (circ ? '<i class="dot" style="background:' + esc(cor) + '"></i>' : '') + '<div class="bn"><span>' + esc(suave(it.l)) + '</span></div><b class="bv ' + cls + '">' + esc(numOk(it.v) ? fmtEixo(it.v) : '—') + pc + '</b></div>';
  });
  h += '</div>';
  if (itens.length > lim) h += '<span class="mais" onclick="var r=this.parentNode.querySelectorAll(\'.br.esc\');for(var i=0;i<r.length;i++)r[i].classList.remove(\'esc\');this.remove()">ver todas as ' + itens.length + ' linhas</span>';
  if (b.ds.length > 1 && circ) h += '<div class="s" style="margin-top:6px">' + esc(ds.label || '') + '</div>';
  return h;
}
var ROTULOS = { id: 'rotulos', afterDatasetsDraw: function (ch, args, o) {
  if (!o || !o.on) return; var ctx = ch.ctx; ctx.save(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = o.cor; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ch.data.datasets.forEach(function (ds, i) { var meta = ch.getDatasetMeta(i); if (meta.hidden) return; meta.data.forEach(function (el, j) { var v = ds.data[j]; if (!numOk(v) || !el) return; ctx.fillText(fmtEixo(v), el.x, (v >= 0 ? el.y - 3 : el.y + 11)); }); });
  ctx.restore(); } };
function desenhaGrafico(id) {
  var g = GR[id], el = $(id); if (!g || !el || !window.Chart) return;
  var cv = el.querySelector('canvas'); if (!cv) return;
  var b = g.b, claro = document.body.classList.contains('claro');
  var tick = claro ? '#4A5568' : '#C9D0DD', grade = claro ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)';
  var n = b.labels.length, fim = n;
  if (!g.tudo) { while (fim > 0 && !b.ds.some(function (d) { return numOk(d.data[fim - 1]); })) fim--; if (!fim) fim = n; }
  var ini = g.tudo ? 0 : Math.max(0, fim - 12);
  var labels = b.labels.slice(ini, fim).map(rotuloCurto), temporal = ehTemporal(b.labels);
  var tipo = b.tipo === 'horizontalBar' ? 'bar' : b.tipo;
  var ds = b.ds.map(function (d, i) {
    var t = d.tipo || tipo, c = corDs(d.cor, i), linha = t === 'line';
    var dados = d.data.slice(ini, fim);
    var o = { label: d.label || (i === 0 && b.tit ? b.tit : 'série ' + (i + 1)), data: dados, type: t === 'bar' || t === 'line' ? t : undefined };
    if (linha) { o.borderColor = Array.isArray(c) ? c[0] : c; o.backgroundColor = alfa(Array.isArray(c) ? c[0] : c, .15); o.borderWidth = 2; o.tension = .3; o.pointRadius = dados.length > 20 ? 0 : 2.5; o.pointBackgroundColor = o.borderColor; o.fill = !!d.fill; if (d.dash) o.borderDash = [5, 4]; }
    else { var cc = Array.isArray(c) ? c.slice(ini, fim) : c; o.backgroundColor = alfa(cc, .72); o.borderColor = cc; o.borderWidth = 1; o.borderRadius = 3; o.borderSkipped = false; o.maxBarThickness = 34; }
    return o;
  });
  var rot = b.ds.length === 1 && labels.length <= 8 && !b.horiz && (b.ds[0].tipo || tipo) === 'bar';
  // o eixo se ajusta aos dados como no hub (Renan, 06/11/2026: "Gráfico começando do zero? Não era
  // melhor adaptar o eixo como no hub?"): a régua do FCA — piso = min(menor − 45% da amplitude,
  // 82% do menor), teto = max(maior + 18% da amplitude, 104% do maior); só sem negativo e sem pilha
  var eixo = null;
  if (!b.stacked) {
    var vs = []; ds.forEach(function (d) { d.data.forEach(function (v) { if (numOk(v)) vs.push(v); }); });
    if (vs.length > 1) { var mn = Math.min.apply(null, vs), mxv = Math.max.apply(null, vs);
      if (mn >= 0 && mxv > 0) { var amp = mxv - mn; eixo = { min: Math.max(0, amp ? Math.min(mn - .45 * amp, .82 * mn) : .9 * mn), max: amp ? Math.max(mxv + .18 * amp, 1.04 * mxv) : 1.1 * mxv };
        // piso e teto em números redondos (passo 1·2·5 × 10ⁿ), senão o eixo mostra 70,2 e 8,31
        var bruto = (eixo.max - eixo.min) / 5, p10 = Math.pow(10, Math.floor(Math.log10(bruto || 1))), f = bruto / p10, passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10;
        eixo.min = Math.max(0, Math.floor(eixo.min / passo) * passo); eixo.max = Math.ceil(eixo.max / passo) * passo; eixo.passo = passo; } }
  }
  var opts = { responsive: true, maintainAspectRatio: false, animation: false, indexAxis: b.horiz ? 'y' : 'x', layout: { padding: { top: rot ? 14 : 4 } },
    plugins: { legend: { display: false }, rotulos: { on: rot, cor: tick }, tooltip: { backgroundColor: claro ? '#fff' : '#2A2B30', titleColor: '#F97316', bodyColor: claro ? '#161D2B' : '#EEF2FA', borderColor: claro ? 'rgba(0,0,0,.1)' : '#33343B', borderWidth: 1, callbacks: { label: function (c) { return (c.dataset.label ? c.dataset.label + ': ' : '') + (numOk(c.parsed[b.horiz ? 'x' : 'y']) ? c.parsed[b.horiz ? 'x' : 'y'].toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'); } } } },
    scales: {
      x: { stacked: b.stacked, grid: { display: false }, ticks: { color: tick, font: { family: 'Inter', size: temporal ? 9 : 8.5 }, maxRotation: temporal ? 0 : 50, minRotation: 0, autoSkip: temporal || labels.length > 14, maxTicksLimit: labels.length > 12 ? 6 : 12 }, border: { display: false } },
      y: { stacked: b.stacked, grid: { display: !b.horiz, color: grade }, ticks: { color: tick, font: { family: 'Inter', size: 9 }, maxTicksLimit: 5, callback: function (v) { return b.horiz ? this.getLabelForValue(v) : fmtEixo(v); } }, border: { display: false } } } };
  if (b.horiz) { opts.scales.x.grid.display = true; opts.scales.x.grid.color = grade; opts.scales.x.ticks.callback = fmtEixo; opts.scales.x.ticks.maxTicksLimit = 5; }
  if (eixo) { var ev = opts.scales[b.horiz ? 'x' : 'y']; ev.min = eixo.min; ev.max = eixo.max; ev.ticks.stepSize = eixo.passo; ev.ticks.maxTicksLimit = Math.round((eixo.max - eixo.min) / eixo.passo) + 1; }
  try { var ch = new Chart(cv, { type: 'bar', data: { labels: labels, datasets: ds }, options: opts, plugins: [ROTULOS] }); GRAFS.push(ch); } catch (e) { console.warn('gráfico', e); }
}

/* ── tabela → lista LIMPA (Renan, 06/11/2026: "Essa barrinha e ranking
   totalmente fora de padrão. Quero clean. Apenas nome e resultado. O resultado
   percentual pode estar pintado de acordo com condicionais"): nome à esquerda,
   UM resultado à direita na cor que o painel deu; chips trocam a coluna. Sem
   barra, sem badge de posição, sem 2º valor. ── */
function tabHtml(b, id) {
  var nCol = Math.max(b.head.length, b.rows[0] ? b.rows[0].c.length : 0);
  var head = b.head.slice(); while (head.length < nCol) head.push('');
  var numCol = [];
  for (var i = 0; i < nCol; i++) { var n = 0, t = 0; b.rows.forEach(function (r) { if (r.tot) return; var c = r.c[i]; if (c && c.v) { t++; if (numDe(c.v) != null) n++; } }); numCol[i] = t > 0 && n / t >= .6; }
  // a coluna do NOME: a 1ª; se a 1ª é posição (#, 1, 2, 3…) e a 2ª é texto, a 2ª
  var nome = 0;
  if (nCol > 2 && !numCol[1] && (/^#$|^pos|^rank|^nº$|^n°$/i.test(head[0].trim()) || (numCol[0] && b.rows.every(function (r) { var v = numDe((r.c[0] || {}).v); return r.tot || v == null || (v >= 1 && v <= 300 && v % 1 === 0); })))) nome = 1;
  var nums = []; for (var j = 0; j < nCol; j++) if (j !== nome && j !== 0 - 0 + (nome === 1 ? 0 : -1) && numCol[j]) nums.push(j);
  var sec = nums.filter(function (j) { return /Δ|%|var|dif|desv/i.test(head[j]); })[0];
  var prim = nums.filter(function (j) { return j !== sec; })[0]; if (prim == null) prim = nums[0];
  var cols = []; if (prim != null) cols.push(prim); else if (sec != null) cols.push(sec);
  if (!cols.length) { for (var k = 0; k < nCol && cols.length < 1; k++) if (k !== nome && !(nome === 1 && k === 0)) cols.push(k); }
  TABS[id] = { b: b, head: head, cols: cols, n: nCol, nome: nome, numCol: numCol, subCol: null, mais: false };
  // o subtítulo (a nota explicativa do painel) vai EMBAIXO da lista, nunca em cima
  return '<div class="tb" id="' + id + '">' + (b.tit ? '<div class="t">' + esc(b.tit) + '</div>' : '') + tabMiolo(id) + (b.sub ? '<div class="s pe">' + esc(b.sub) + '</div>' : '') + '</div>';
}
function tabMiolo(id) {
  var T2 = TABS[id], b = T2.b, max = T2.mais ? 80 : 12, h = '';
  var sel = []; for (var i = 0; i < T2.n; i++) if (i !== T2.nome && !(T2.nome === 1 && i === 0) && T2.head[i]) sel.push(i);
  if (sel.length > 1) h += '<div class="colsel">' + sel.map(function (i) { return '<span class="chip' + (T2.cols[0] === i ? ' on' : '') + '" onclick="tabCol(\'' + id + '\',' + i + ')">' + esc(suave(T2.head[i])) + '</span>'; }).join('') + '</div>';
  var p = T2.cols[0];
  h += '<div class="lista">';
  if (p != null && sel.length <= 1) h += '<div class="lh"><span>' + esc(suave(T2.head[T2.nome] || '')) + '</span><span>' + esc(suave(T2.head[p])) + '</span></div>';
  b.rows.slice(0, max).forEach(function (r) {
    var nm = r.c[T2.nome] || { v: '' }, pv = p != null ? (r.c[p] || { v: '' }) : null;
    h += '<div class="lr' + (r.tot ? ' tot' : '') + '"><div class="ln"><b>' + esc(nm.v) + '</b></div>' +
      (pv ? '<div class="lv"><b class="' + corCls(pv.cor) + '">' + esc(pv.v || '—') + '</b></div>' : '') + '</div>';
  });
  h += '</div>';
  if (b.rows.length > 12 && !T2.mais) h += '<span class="mais" onclick="tabMais(\'' + id + '\')">ver todas as ' + b.rows.length + ' linhas' + (b.n > b.rows.length ? ' (das ' + b.n + ')' : '') + '</span>';
  else if (b.n > b.rows.length) h += '<span class="mais" style="color:var(--txt3)">mostrando ' + b.rows.length + ' de ' + b.n + ' linhas · o painel completo tem todas</span>';
  return h;
}
function tabCol(id, c) { TABS[id].cols = [c]; redesenhaTab(id); }
function tabMais(id) { TABS[id].mais = true; redesenhaTab(id); }
function redesenhaTab(id) { var el = $(id); if (!el) return; var tit = el.querySelector('.t'), sub = el.querySelector('.s.pe'); el.innerHTML = (tit ? tit.outerHTML : '') + tabMiolo(id) + (sub ? sub.outerHTML : ''); }

/* texto (quadrantes, diagnósticos): recolhido, "ler mais" abre */
function txtHtml(b, id) {
  // marcador sozinho na linha ("+", "−", "!", "⇒", "★" do Resumo Executivo) junta com a linha de baixo
  var corpo = String(b.corpo || '').replace(/(^|\n)\s*([+\-−!⇒→★•▲▼])\s*\n\s*/g, '$1$2 ');
  b = { tit: b.tit, corpo: corpo };
  var longo = b.corpo.length > 220;
  return '<div class="tx-card' + (longo ? ' clamp' : '') + '" id="' + id + '"' + (longo ? ' onclick="this.classList.remove(\'clamp\')"' : '') + '>' + (b.tit ? '<div class="t">' + esc(b.tit) + '</div>' : '') + '<p>' + esc(b.corpo) + '</p>' + (longo ? '<span class="mais">ler mais</span>' : '') + '</div>';
}

/* ── sparkline (o início): a 1ª série temporal do resumo, últimos 12 pontos ── */
function serieDe(d) {
  if (!d || !d.blocos) return null;
  for (var i = 0; i < d.blocos.length; i++) { var b = d.blocos[i];
    if (b.t === 'graf' && ehTemporal(b.labels) && b.ds.length) { var ds = b.ds.filter(function (x) { return (x.data || []).filter(numOk).length >= 4; })[0]; if (ds) return { labels: b.labels.slice(-12), data: ds.data.slice(-12), tit: b.tit, label: ds.label }; } }
  return null;
}
function sparkSvg(data, w, h, cor) {
  var v = (data || []).filter(numOk); if (v.length < 2) return '';
  var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), r = mx - mn || 1, pts = [], n = data.length;
  data.forEach(function (y, i) { if (!numOk(y)) return; pts.push([n > 1 ? (i / (n - 1)) * (w - 4) + 2 : w / 2, h - 3 - ((y - mn) / r) * (h - 6)]); });
  var dp = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '), last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + dp + ' L' + last[0].toFixed(1) + ' ' + h + ' L' + pts[0][0].toFixed(1) + ' ' + h + 'Z" fill="' + cor + '" opacity=".12"/><path d="' + dp + '" fill="none" stroke="' + cor + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + cor + '"/></svg>';
}

/* ═════════ o painel inteiro ═════════ */
function abreWeb(p) {
  if (!p) return;
  var url = urlDe(p);
  $('wbTit').textContent = p.nome; $('wbSub').textContent = p.modo === 'web' ? p.desc : 'painel completo';
  $('wbAbrir').onclick = function () { window.open(url, '_blank'); };
  $('wbFrame').src = url;
  $('tela-web').classList.add('on');
}
function fechaWeb() { $('tela-web').classList.remove('on'); $('wbFrame').src = 'about:blank'; }

/* botão "voltar" do celular fecha a tela de cima em vez de sair do app */
history.replaceState({ gem: 'raiz' }, '');
function empilha(t) { try { history.pushState({ gem: t }, ''); } catch (e) {} }
var _abreWeb0 = abreWeb; abreWeb = function (p) { _abreWeb0(p); empilha('web'); };
var _abrePainel0 = abrePainel; abrePainel = function (id) { var p = painelPorId(id); if (p && p.modo !== 'web') empilha('painel'); _abrePainel0(id); };
window.addEventListener('popstate', function () {
  if ($('tela-web').classList.contains('on')) { fechaWeb(); return; }
  if ($('tela-painel').classList.contains('on')) { fechaPainel(); return; }
});
