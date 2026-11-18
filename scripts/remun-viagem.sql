-- ============================================================
-- Remunerado por viagem: o detalhe da importação do 2artd (T2) e da base
-- de CT-e (T1), em /painel-km/dispersao/ (Renan, 18/11/2026).
--
-- Uma linha por mês × quinzena × unidade × projeto × tipo de viagem
-- (prim = 1ª viagem: Roteriz, Extra · mkt = MKT e Recolha, pagos como 1ª ·
-- rec = recarga · not = noturna), com:
--   viagens, mapas virados, mapas sem valor,
--   km remunerado (viagens × km por viagem do FT da quinzena),
--   valor pago no 2artd × valor do FT (Resumo - SRTrans), quantos mapas
--   foram pagos diferente do FT e a soma da diferença.
-- Os totais por mês × unidade × projeto vão para a dispersao_km, as placas
-- para a dispersao_placa e a dispersao_placa_viagem (as mesmas tabelas da
-- 01-BD); esta guarda o que a árvore de km e a conferência com o FT precisam.
-- Leitura e escrita só admin (é remuneração). Reexecutável.
-- ============================================================

create table if not exists public.remun_viagem (
  vigencia        text    not null,          -- AAAA-MM
  quinzena        int     not null,
  unidade         text    not null,          -- código do portal (BLC, CBA, PIR…)
  projeto         text    not null,          -- Rota, Van, Auto Serviço, Empurrada - 28 Palets…
  tipo            text    not null check (tipo in ('prim','mkt','rec','not')),
  viagens         int     not null default 0,
  virados         int     not null default 0,
  sem_valor       int     not null default 0,
  km_rem          numeric not null default 0,
  km_viagem       numeric,                   -- km por viagem do FT na quinzena
  valor_pago      numeric not null default 0,
  valor_ft        numeric,                   -- Σ do valor por viagem do FT
  valor_viagem_ft numeric,
  pago_diferente  int     not null default 0,
  dif_valor       numeric not null default 0,
  arquivo         text,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  primary key (vigencia, quinzena, unidade, projeto, tipo)
);

alter table public.remun_viagem enable row level security;
drop policy if exists remun_viagem_le    on public.remun_viagem;
drop policy if exists remun_viagem_grava on public.remun_viagem;
create policy remun_viagem_le    on public.remun_viagem for select to authenticated using (public.fca_is_admin());
create policy remun_viagem_grava on public.remun_viagem for all    to authenticated using (public.fca_is_admin()) with check (public.fca_is_admin());
grant select, insert, update, delete on public.remun_viagem to authenticated;

-- conferência
select count(*) as linhas, min(vigencia), max(vigencia) from public.remun_viagem;
