-- ============================================================
-- Consumo automático (Km/L · R$/L · Base Remunerado Modelo · Seara)
-- Renan, 27/10/2026: "o consumo km/L e o R$/L agora, não poderíamos
-- automatizar, e ter ele em tempo real?" → D-1, tudo do ERP + Freightech.
-- Rode no SQL Editor do Supabase. Reexecutável.
--
-- O robô scripts/consumo-auto.mjs (workflow Consumo Auto, todo dia 06:00 BRT)
-- monta, a partir de erp_abastecimentos (realizado) e de ft_linha (remunerado
-- do Freightech), as MESMAS abas que hoje são coladas à mão no Sheets, no
-- MESMO layout das tabelas sh_* — e grava em ca_<slug>. Enquanto a chave
-- portal_flags.consumo_auto estiver DESLIGADA, nada muda nos painéis: as
-- abas continuam saindo do Sheets e o robô só compara (aba × automático, no
-- log). Ligada a chave, o gviz-cache.js e o Eficiência Km/L passam a servir
-- as ca_* no lugar das sh_*.
-- ============================================================

-- ── 1) as cópias automáticas, com o layout das sh_* ───────────────────────
-- `like … including all` copia colunas, defaults e índices; RLS e grants não
-- vêm junto, por isso são refeitos abaixo. Coluna nova na aba (sh_*) ⇒ rodar
-- este bloco de novo não adianta (a tabela já existe): acrescentar a coluna
-- na ca_* à mão, como se faz na sh_* pelo Sheets DDL.
do $$
declare s text;
begin
  foreach s in array array['consumo_km_litro','consumo_rs_litro','consumo_rem_modelo',
                           'seara_combustivel','seara_remunerado','seara_comb_vig'] loop
    if to_regclass('public.sh_' || s) is null then
      raise notice 'sh_% não existe — rode o bases-manuais.sql antes', s;
      continue;
    end if;
    if to_regclass('public.ca_' || s) is null then
      execute format('create table public.ca_%I (like public.sh_%I including all)', s, s);
    end if;
    execute format('alter table public.ca_%I enable row level security', s);
    execute format('drop policy if exists ca_%s_le on public.ca_%I', s, s);
    execute format('create policy ca_%s_le on public.ca_%I for select to authenticated using (true)', s, s);
    execute format('grant select on public.ca_%I to authenticated', s);
  end loop;
end $$;

-- ── 2) o registro do que o robô gravou (o que o shim lê) ──────────────────
create table if not exists public.consumo_auto_base (
  slug          text primary key,        -- o mesmo slug da sh_ que substitui
  tabela        text not null,           -- ca_<slug>
  colunas       jsonb,                   -- cópia de sh_base.colunas no momento da carga
  linhas        int  not null default 0,
  carregado_em  timestamptz,
  erro          text,                    -- carga que falhou: o shim NÃO serve a base
  resumo        jsonb                    -- a comparação aba × automático da última carga
);
alter table public.consumo_auto_base enable row level security;
drop policy if exists consumo_auto_base_le on public.consumo_auto_base;
create policy consumo_auto_base_le on public.consumo_auto_base for select using (true);
grant select on public.consumo_auto_base to anon, authenticated;

-- ── 3) parâmetros da Seara (Renan, 27/10/2026: "o consumo remunerado é sempre
-- o mesmo. O preço a princípio também, mas pode criar um campo de parâmetros
-- seara no cluster administração para eu mudar, com vigência e campos.
-- Mantenha igual, e eu mudo se tiver alteração") ─────────────────────────
-- Uma linha por MODELO × vigência de início ('AAAA-MM'). Vale a linha de
-- vigência mais recente que não passa do mês. `campos` guarda todas as
-- colunas da Base Remunerado (a semente sai da própria aba, pelo robô, quando
-- a tabela está vazia); os campos explícitos abaixo são os que a tela edita e
-- vencem o que está em `campos`.
create table if not exists public.seara_param (
  id               bigserial primary key,
  modelo           text not null,
  vigencia_inicio  text not null check (vigencia_inicio ~ '^\d{4}-\d{2}$'),
  kmporlitro       numeric,
  precodiesel      numeric,
  precoarla        numeric,
  reaisporkm       numeric,
  totalreaisporkm  numeric,
  campos           jsonb not null default '{}'::jsonb,
  ativo            boolean not null default true,
  obs              text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null,
  unique (modelo, vigencia_inicio)
);
alter table public.seara_param enable row level security;
drop policy if exists seara_param_sel on public.seara_param;
create policy seara_param_sel on public.seara_param for select to authenticated using (true);
drop policy if exists seara_param_ins on public.seara_param;
create policy seara_param_ins on public.seara_param for insert to authenticated with check (public.fca_is_admin());
drop policy if exists seara_param_upd on public.seara_param;
create policy seara_param_upd on public.seara_param for update to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
drop policy if exists seara_param_del on public.seara_param;
create policy seara_param_del on public.seara_param for delete to authenticated using (public.fca_is_admin());
grant select, insert, update, delete on public.seara_param to authenticated;
grant usage, select on sequence public.seara_param_id_seq to authenticated;

create or replace function public.seara_param_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists seara_param_touch on public.seara_param;
create trigger seara_param_touch before insert or update on public.seara_param
  for each row execute function public.seara_param_touch();

-- ── 4) a chave: começa DESLIGADA ──────────────────────────────────────────
-- Ligar = a tela Parâmetros Seara (hub › Administração) ou:
--   update public.portal_flags set ligado = true where chave = 'consumo_auto';
insert into public.portal_flags (chave, ligado, mensagem)
values ('consumo_auto', false, 'Km/L, R$/L e Seara servidos pelo robô (ERP + Freightech) em vez do Sheets')
on conflict (chave) do nothing;

-- ── 5) o relógio: 06:00 BRT, depois do ERP (05:00) e do Freightech (05:00) ──
-- Mesmo desenho do ginfo-4h / freightech-5h: o pg_cron chama o workflow_dispatch
-- por pg_net com o token de portal_segredo; o cron do YAML fica como rede.
create or replace function public.consumo_auto_dispara()
returns void language plpgsql security definer
set search_path = public, net, extensions as $$
declare tok text;
begin
  select valor into tok from public.portal_segredo where chave = 'github_token';
  if tok is null or length(tok) < 30 then
    raise notice 'sem token em portal_segredo - nada disparado';
    return;
  end if;
  perform net.http_post(
    url     := 'https://api.github.com/repos/fortesindicadores-byte/gestao-em-movimento/actions/workflows/consumo-auto.yml/dispatches',
    headers := jsonb_build_object(
                 'Authorization',        'Bearer ' || tok,
                 'Accept',               'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'Content-Type',         'application/json',
                 'User-Agent',           'gestao-em-movimento'),
    body    := jsonb_build_object('ref', 'main',
                                  'inputs', jsonb_build_object('modo', 'gravar')));
end $$;
revoke all on function public.consumo_auto_dispara() from public;
select cron.unschedule('consumo-auto-6h') where exists (select 1 from cron.job where jobname = 'consumo-auto-6h');
select cron.schedule('consumo-auto-6h', '0 9 * * *', $$select public.consumo_auto_dispara()$$);

-- conferência
select (select count(*) from public.consumo_auto_base) as bases_automaticas,
       (select count(*) from public.seara_param)       as parametros_seara,
       (select ligado from public.portal_flags where chave = 'consumo_auto') as chave_ligada,
       (select count(*) from cron.job where jobname = 'consumo-auto-6h') as cron;
