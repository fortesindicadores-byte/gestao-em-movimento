-- ============================================================
-- Cada mapa do 2artd (T2), gravado pela importação em /painel-km/dispersao/
-- (Renan, 23/11/2026: guardar cada mapa para medir o km da recarga).
--
-- Uma linha por MAPA da frota própria: mês, quinzena, unidade, projeto,
-- tipo (prim = 1ª viagem · mkt = MKT e Recolha · rec = recarga · not = noturna),
-- placa, horário de saída e de entrega, os hodômetros digitados no mapa,
-- o km que o Roadshow previu (total, laço e deslocamento), o km que o FT
-- paga para aquele tipo de viagem na quinzena e o valor pago × o do FT.
-- Não guarda motorista, CPF nem matrícula.
-- Subir o mesmo mês de novo apaga e regrava (mês × unidade × projeto).
-- Leitura e escrita só admin (é remuneração). Reexecutável.
-- ============================================================

create table if not exists public.remun_mapa (
  id           bigint generated always as identity primary key,
  vigencia     text    not null,          -- AAAA-MM
  quinzena     int     not null,
  unidade      text    not null,          -- código do portal (BLC, CBA, CGR…)
  projeto      text    not null,          -- Rota, Van, Auto Serviço
  tipo         text    not null check (tipo in ('prim','mkt','rec','not')),
  carga        text,                      -- como veio: ROTERIZ, EXTRA, RECARGA, NOTURNA, MKT, RECOLHA
  frota        text,                      -- PADRAO ou FIXO
  placa        text,                      -- chave Mercosul
  placa_origem text,                      -- como veio no arquivo
  mapa         text,
  hr_sai       timestamp,                 -- hora local, sem fuso
  hr_entr      timestamp,
  km_sai       numeric,                   -- hodômetro digitado na saída
  km_entr      numeric,                   -- hodômetro digitado na chegada
  km_previsto  numeric,                   -- KmPrevistoRoad
  km_laco      numeric,
  km_desloc    numeric,
  km_ft        numeric,                   -- km que o FT paga para o tipo na quinzena
  valor_pago   numeric,
  valor_ft     numeric,
  virado       boolean not null default false,
  arquivo      text,
  updated_by   text,
  updated_at   timestamptz not null default now()
);
create index if not exists remun_mapa_chave_idx on public.remun_mapa (vigencia, unidade, projeto);
create index if not exists remun_mapa_placa_idx on public.remun_mapa (placa, hr_sai);

alter table public.remun_mapa enable row level security;
drop policy if exists remun_mapa_le    on public.remun_mapa;
drop policy if exists remun_mapa_grava on public.remun_mapa;
create policy remun_mapa_le    on public.remun_mapa for select to authenticated using (public.fca_is_admin());
create policy remun_mapa_grava on public.remun_mapa for all    to authenticated using (public.fca_is_admin()) with check (public.fca_is_admin());
grant select, insert, update, delete on public.remun_mapa to authenticated;

-- resumo por mês × unidade × projeto × tipo: o previsto do Roadshow contra o pago do FT,
-- só nos mapas que têm o km previsto (é o que a árvore de km lê; a RLS da tabela vale aqui)
create or replace view public.remun_mapa_resumo with (security_invoker = on) as
select vigencia, unidade, projeto, tipo,
       count(*)                                                        as mapas,
       count(*) filter (where km_previsto > 0)                         as com_previsto,
       coalesce(sum(km_previsto) filter (where km_previsto > 0), 0)    as km_previsto,
       coalesce(sum(km_ft)       filter (where km_previsto > 0), 0)    as km_ft_previsto,
       coalesce(sum(km_ft), 0)                                         as km_ft,
       count(*) filter (where km_sai > 1000 and km_entr > km_sai and km_entr - km_sai < 600)                       as com_hodometro,
       coalesce(sum(km_entr - km_sai) filter (where km_sai > 1000 and km_entr > km_sai and km_entr - km_sai < 600), 0) as km_hodometro,
       coalesce(sum(km_ft)            filter (where km_sai > 1000 and km_entr > km_sai and km_entr - km_sai < 600), 0) as km_ft_hodometro
  from public.remun_mapa
 group by vigencia, unidade, projeto, tipo;
grant select on public.remun_mapa_resumo to authenticated;

-- conferência
select count(*) as mapas, min(vigencia), max(vigencia) from public.remun_mapa;
