-- ============================================================
-- footprint_check — Check do footprint da operação de Goiânia
-- (Renan, 08/09/2026). Visão TEMPORÁRIA no cluster Administração:
-- uma linha por placa, uma coluna por check, célula OK / NOK / N/A.
--
-- Uma linha por (placa, check). Sem linha = ainda não preenchido.
-- Placas e checks moram no HTML (/footprint-goiania/), não no banco —
-- é uma conferência de entrada, não um cadastro.
--
-- Leitura: qualquer usuário logado. Escrita: admin (fca_is_admin),
-- como no Gerenciar Acessos e no portal_flags.
-- ============================================================

create table if not exists public.footprint_check (
  placa        text        not null,
  chave        text        not null,           -- id do check (ex.: ben_crlv)
  status       text        not null check (status in ('OK','NOK','NA')),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  updated_nome text,
  primary key (placa, chave)
);

comment on table public.footprint_check is
  'Footprint Goiânia — status de cada check por placa (OK / NOK / NA), com quem marcou e quando.';

alter table public.footprint_check enable row level security;

drop policy if exists footprint_check_sel on public.footprint_check;
create policy footprint_check_sel on public.footprint_check
  for select to authenticated using (true);

drop policy if exists footprint_check_ins on public.footprint_check;
create policy footprint_check_ins on public.footprint_check
  for insert to authenticated with check (public.fca_is_admin());

drop policy if exists footprint_check_upd on public.footprint_check;
create policy footprint_check_upd on public.footprint_check
  for update to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

drop policy if exists footprint_check_del on public.footprint_check;
create policy footprint_check_del on public.footprint_check
  for delete to authenticated using (public.fca_is_admin());

-- ---------- Conferência ----------------------------------------------------
-- select placa, chave, status, updated_nome, updated_at
--   from public.footprint_check order by placa, chave;
