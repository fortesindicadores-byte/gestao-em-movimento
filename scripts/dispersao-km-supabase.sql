-- ============================================================
-- Dispersão de km — a planilha "Dispersão de KM - Consolidado" no banco
-- (Renan, 14/10/2026: "Consigo importar essa planilha para o banco sempre e o
--  km rodado que já está lá completa?" → "Pode montar assim. Lembrando de
--  sempre transformar tudo em Mercosul por trás do De-Para. No painel deve
--  aparecer a placa como está")
--
-- dispersao_km     — a aba 01-BD: uma linha por VIGÊNCIA × UNIDADE × PROJETO
--                    ("Van - UDC" entra em Van). km_real = o km rodado que a
--                    planilha traz; NULO quando o mês ainda não tem (a tela
--                    completa pela aba Km/L, placa a placa).
-- dispersao_placa  — a lista de placas (02-ABERT. PLACA + a parte T1 da
--                    02-Dinamica): unidade, projeto e km remunerado por placa.
--                    `placa` é a chave MERCOSUL (é por ela que se cruza com a
--                    aba Km/L); `placa_origem` é como veio na planilha, e é a
--                    que aparece na tela.
--
-- Subir o arquivo de novo SUBSTITUI os meses que ele traz (a importação apaga
-- as vigências do arquivo e grava as novas).
-- Rode no SQL Editor do Supabase. REEXECUTÁVEL.
-- ============================================================

create table if not exists public.dispersao_km (
  vigencia            text not null,      -- 'AAAA-MM'
  unidade             text not null,      -- código do portal (PIR, MCC, CBA…)
  projeto             text not null,      -- Rota · Auto Serviço · Van · Empurrada - 28 Palets · Empurrada - 42 Palets · Empurrada - Insumos
  unidade_orig        text,               -- como veio na planilha ("Piraí -RJ")
  projetos_orig       text,               -- "Van + Van - UDC" quando dois projetos da planilha viraram um
  frota_ativa         numeric,
  viagens_prim        numeric,
  km_rem_prim         numeric,
  viagens_rec         numeric,
  km_rem_rec          numeric,
  viagens_not         numeric,
  km_rem_not          numeric,
  km_rem              numeric,            -- [Consolidado] Km remunerado por mês
  km_real             numeric,            -- [Consolidado] Km rodado por mês (nulo = a planilha não tem)
  fator_rskm          numeric,            -- Fator de remuneração (R$/km)
  viagens_mapa_aberto numeric,
  arquivo             text,
  updated_at          timestamptz not null default now(),
  updated_by          text,
  primary key (vigencia, unidade, projeto)
);

create table if not exists public.dispersao_placa (
  vigencia      text not null,
  unidade       text not null,
  projeto       text not null,
  placa         text not null,            -- chave MERCOSUL (CUC9514 → CUC9F14)
  placa_origem  text,                     -- como veio na planilha
  entrega       text,
  km_rem        numeric,
  arquivo       text,
  updated_at    timestamptz not null default now(),
  primary key (vigencia, unidade, projeto, placa)
);
create index if not exists dispersao_placa_placa_idx on public.dispersao_placa (placa);

alter table public.dispersao_km    enable row level security;
alter table public.dispersao_placa enable row level security;

-- leitura: qualquer usuário logado; escrita: só administradores
drop policy if exists dispersao_km_select on public.dispersao_km;
create policy dispersao_km_select on public.dispersao_km for select to authenticated using (true);
drop policy if exists dispersao_km_admin on public.dispersao_km;
create policy dispersao_km_admin on public.dispersao_km for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

drop policy if exists dispersao_placa_select on public.dispersao_placa;
create policy dispersao_placa_select on public.dispersao_placa for select to authenticated using (true);
drop policy if exists dispersao_placa_admin on public.dispersao_placa;
create policy dispersao_placa_admin on public.dispersao_placa for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

grant select, insert, update, delete on public.dispersao_km, public.dispersao_placa to authenticated;

notify pgrst, 'reload schema';

-- ── confere ───────────────────────────────────────────────────────────────
select vigencia, count(*) as linhas, round(sum(km_rem)) as km_rem,
       round(sum(km_real)) as km_real_planilha, count(km_real) as com_km_real
  from public.dispersao_km group by vigencia order by vigencia;
