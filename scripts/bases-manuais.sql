-- ============================================================
-- BASES MANUAIS NO SUPABASE — uma tabela por aba do Sheets
-- Gerado por scripts/sheets-ddl.mjs em 2026-09-09.
-- Rode no SQL Editor do Supabase. Pode rodar quantas vezes quiser.
--
-- Escrita: só a service_role (o robô). Leitura: quem está logado no
-- portal, como nas outras bases.
-- ============================================================

-- ── controle: o que cada base é e quando foi carregada ──────────────────
create table if not exists public.sh_base (
  slug          text primary key,
  nome          text,
  sheet_id      text not null,
  aba           text,
  gid           text,
  tq            text,
  headers       text,
  gviz_chave    text,
  colunas       jsonb,          -- [{i,label,col,tipo}] — de-para índice ↔ coluna
  linhas        integer,
  hash          text,           -- md5 da resposta do gviz: igual = não recarrega
  carregado_em  timestamptz,
  erro          text
);
comment on table public.sh_base is 'Bases manuais do Sheets copiadas para o banco: uma linha por aba.';
alter table public.sh_base enable row level security;
drop policy if exists sh_base_sel on public.sh_base;
create policy sh_base_sel on public.sh_base for select to authenticated using (true);

-- ── DRE · Frota · 17778 linha(s) · 11 coluna(s)
--    1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8|s=Frota|g=|q=|h=
create table if not exists public.sh_dre_frota (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_dre_frota
  add column if not exists vigencia_orig                          date,   -- VIGÊNCIA
  add column if not exists d_orc_brl                              numeric,   -- Δ ORÇ (BRL)
  add column if not exists d_rem_brl                              numeric,   -- Δ REM (BRL)
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists nivel_3                                text,   -- NÍVEL 3
  add column if not exists conta_gerencial                        text,   -- CONTA GERENCIAL
  add column if not exists mes                                    text,   -- MÊS
  add column if not exists ano                                    numeric,   -- ANO
  add column if not exists orcado                                 numeric,   -- ORÇADO
  add column if not exists remunerado                             numeric,   -- REMUNERADO
  add column if not exists realizado                              numeric;   -- REALIZADO
alter table public.sh_dre_frota enable row level security;
drop policy if exists sh_dre_frota_sel on public.sh_dre_frota;
create policy sh_dre_frota_sel on public.sh_dre_frota for select to authenticated using (true);
create index if not exists sh_dre_frota_vig_idx on public.sh_dre_frota (vigencia);

-- ── DRE · EBITDA · 1672 linha(s) · 11 coluna(s)
--    1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8|s=EBITDA|g=|q=|h=
create table if not exists public.sh_dre_ebitda (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_dre_ebitda
  add column if not exists vigencia_orig                          date,   -- VIGÊNCIA
  add column if not exists d_orc_brl                              numeric,   -- Δ ORÇ (BRL)
  add column if not exists d_rem_brl                              numeric,   -- Δ REM (BRL)
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists nivel_3                                text,   -- NÍVEL 3
  add column if not exists conta_gerencial                        text,   -- CONTA GERENCIAL
  add column if not exists mes                                    text,   -- MÊS
  add column if not exists ano                                    numeric,   -- ANO
  add column if not exists orcado                                 numeric,   -- ORÇADO
  add column if not exists remunerado                             numeric,   -- REMUNERADO
  add column if not exists realizado                              numeric;   -- REALIZADO
alter table public.sh_dre_ebitda enable row level security;
drop policy if exists sh_dre_ebitda_sel on public.sh_dre_ebitda;
create policy sh_dre_ebitda_sel on public.sh_dre_ebitda for select to authenticated using (true);
create index if not exists sh_dre_ebitda_vig_idx on public.sh_dre_ebitda (vigencia);

-- ── Dispersão de km · 972 linha(s) · 40 coluna(s)
--    1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM|s=Dispersão de km|g=|q=|h=
create table if not exists public.sh_dispersao_km (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_dispersao_km
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists ano                                    numeric,   -- Ano
  add column if not exists dias_uteis                             numeric,   -- Dias Úteis
  add column if not exists viagens_rem                            numeric,   -- Viagens Rem.
  add column if not exists km_frota_ativa_rem                     numeric,   -- Km/Frota Ativa Rem.
  add column if not exists km_frota_ativa_real                    numeric,   -- Km/Frota Ativa Real
  add column if not exists d_km_frota_ativa                       numeric,   -- Δ (km/Frota Ativa)
  add column if not exists km_l_rem                               text,   -- Km/l Rem.
  add column if not exists km_real                                text,   -- Km/ Real
  add column if not exists litros_rem                             text,   -- Litros Rem.
  add column if not exists litros_real                            text,   -- Litros Real
  add column if not exists dre_remunerado                         text,   -- DRE Remunerado
  add column if not exists dre_realizado                          text,   -- DRE Realizado
  add column if not exists unid                                   text,   -- UNID.
  add column if not exists proj                                   text,   -- PROJ.
  add column if not exists mes                                    text,   -- Mês
  add column if not exists mes_16                                 text,   -- [Mês]
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists unidade_2                              text,   -- Unidade 2
  add column if not exists projeto                                text,   -- Projeto
  add column if not exists projeto_2                              text,   -- Projeto 2
  add column if not exists frota_ativa                            numeric,   -- Frota Ativa
  add column if not exists viagens_real                           numeric,   -- Viagens - Real
  add column if not exists km_viagem_real                         numeric,   -- Km/Viagem Real
  add column if not exists km_rem_mes                             numeric,   -- Km Rem. Mês
  add column if not exists viagens_rec_real                       numeric,   -- Viagens Rec. Real
  add column if not exists km_viagem_rec_rem                      numeric,   -- Km/Viagem Rec. Rem.
  add column if not exists km_rec_mes_real                        numeric,   -- Km Rec. Mês Real
  add column if not exists viagens_noturnas_real                  numeric,   -- Viagens Noturnas Real
  add column if not exists km_viagem_noturna_rem                  numeric,   -- Km/Viagem Noturna Rem.
  add column if not exists km_rem_noturna                         numeric,   -- Km Rem. Noturna
  add column if not exists km_rem_tt                              numeric,   -- Km Rem. TT
  add column if not exists km_rodado_tt                           numeric,   -- Km Rodado TT
  add column if not exists d_km                                   numeric,   -- Δ (km)
  add column if not exists pct                                    numeric,   -- %
  add column if not exists rs_km                                  numeric,   -- R$/km
  add column if not exists impacto_brl                            numeric,   -- Impacto (BRL)
  add column if not exists impacto_brl_frota_ativa                numeric,   -- Impacto (BRL / Frota Ativa
  add column if not exists viagens_mapa_aberto                    numeric,   -- Viagens Mapa Aberto
  add column if not exists km_bm                                  numeric;   -- Km BM
alter table public.sh_dispersao_km enable row level security;
drop policy if exists sh_dispersao_km_sel on public.sh_dispersao_km;
create policy sh_dispersao_km_sel on public.sh_dispersao_km for select to authenticated using (true);
create index if not exists sh_dispersao_km_vig_idx on public.sh_dispersao_km (vigencia);

-- ── Balanço de Massa · 36 linha(s) · 4 coluna(s)
--    1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM|s=Balanço de Massa|g=|q=|h=
create table if not exists public.sh_balanco_massa (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_balanco_massa
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists valor                                  numeric,   -- Valor
  add column if not exists col_3                                  text;   -- (coluna 3, sem rótulo na aba)
alter table public.sh_balanco_massa enable row level security;
drop policy if exists sh_balanco_massa_sel on public.sh_balanco_massa;
create policy sh_balanco_massa_sel on public.sh_balanco_massa for select to authenticated using (true);
create index if not exists sh_balanco_massa_vig_idx on public.sh_balanco_massa (vigencia);

-- ── Consumo · Km/L · 3680 linha(s) · 27 coluna(s)
--    1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A|s=Km/L|g=|q=|h=
create table if not exists public.sh_consumo_km_litro (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_consumo_km_litro
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists rs_km_rem                              numeric,   -- R$/km Rem
  add column if not exists rs_km_real                             numeric,   -- R$/km Real
  add column if not exists d_rs_km                                numeric,   -- Δ R$/km
  add column if not exists km_l_rem_medio                         numeric,   -- KM/l Rem Médio
  add column if not exists km_l_rem_modelo                        numeric,   -- Km/l Rem Modelo
  add column if not exists km_l_real                              numeric,   -- Km/L Real
  add column if not exists d_km_l                                 numeric,   -- Δ Km/l
  add column if not exists rs_l_rem                               numeric,   -- R$/L Rem
  add column if not exists rs_l_real                              numeric,   -- R$/L/Real
  add column if not exists d_rs_l                                 numeric,   -- Δ R$/L
  add column if not exists ativo                                  text,   -- Ativo
  add column if not exists operacao                               text,   -- Operação
  add column if not exists empresa                                text,   -- Empresa
  add column if not exists projeto                                text,   -- Projeto
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists placa                                  text,   -- Placa
  add column if not exists mes_inicio_os                          text,   -- Mês Inicio OS
  add column if not exists ano_inicio_os                          numeric,   -- Ano Inicio OS
  add column if not exists modelo                                 text,   -- Modelo
  add column if not exists tipo_combustivel                       text,   -- Tipo Combustivel
  add column if not exists tipo_veiculo                           text,   -- Tipo Veiculo
  add column if not exists km_rodado_horas_trabalhadas            numeric,   -- KM Rodado / Horas trabalhadas
  add column if not exists qtd_total_de_litros                    numeric,   -- QTD Total de Litros
  add column if not exists valor_medio_litro                      numeric,   -- Valor Médio Litro
  add column if not exists totas_rs                               numeric,   -- TOTAS R$
  add column if not exists col_26                                 text;   -- (coluna 26, sem rótulo na aba)
alter table public.sh_consumo_km_litro enable row level security;
drop policy if exists sh_consumo_km_litro_sel on public.sh_consumo_km_litro;
create policy sh_consumo_km_litro_sel on public.sh_consumo_km_litro for select to authenticated using (true);
create index if not exists sh_consumo_km_litro_vig_idx on public.sh_consumo_km_litro (vigencia);

-- ── Consumo · R$/L · 282 linha(s) · 28 coluna(s)
--    1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A|s=R$/L|g=|q=|h=
create table if not exists public.sh_consumo_rs_litro (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_consumo_rs_litro
  add column if not exists unidade_benner                         text,   -- Unidade Benner
  add column if not exists concat                                 text,   -- Concat
  add column if not exists vigencia_data                          text,   -- Vigência Data
  add column if not exists vigencia_data_3                        date,   -- Vigência Data
  add column if not exists vigencia_orig                          text,   -- Vigencia
  add column if not exists unidade_cnpj                           numeric,   -- Unidade - CNPJ
  add column if not exists unidade_nome                           text,   -- Unidade - Nome
  add column if not exists unidade_sap                            text,   -- Unidade SAP
  add column if not exists unidade_tms                            numeric,   -- Unidade TMS
  add column if not exists unidade_promax_unb                     numeric,   -- Unidade - Promax UNB
  add column if not exists unidade_regional                       text,   -- Unidade - Regional
  add column if not exists operador_cnpj                          numeric,   -- Operador - CNPJ
  add column if not exists operador_nome                          text,   -- Operador - Nome
  add column if not exists operador_sap                           numeric,   -- Operador - SAP
  add column if not exists operador_tms                           text,   -- Operador - TMS
  add column if not exists operador_promax                        numeric,   -- Operador - Promax
  add column if not exists organizacao_de_compras                 text,   -- Organizacao de Compras
  add column if not exists prazo_pagamento                        text,   -- Prazo Pagamento
  add column if not exists creditosobreativos                     text,   -- creditoSobreAtivos
  add column if not exists iniciativa                             text,   -- iniciativa
  add column if not exists precoanp                               numeric,   -- precoAnp
  add column if not exists precocreditoimpostos                   numeric,   -- precoCreditoImpostos
  add column if not exists precooperadora                         numeric,   -- precoOperadora
  add column if not exists tipocombustivelshared                  text,   -- tipoCombustivelShared
  add column if not exists id                                     text,   -- _id
  add column if not exists col_25                                 text,   -- (coluna 25, sem rótulo na aba)
  add column if not exists col_26                                 text,   -- (coluna 26, sem rótulo na aba)
  add column if not exists col_27                                 text;   -- (coluna 27, sem rótulo na aba)
alter table public.sh_consumo_rs_litro enable row level security;
drop policy if exists sh_consumo_rs_litro_sel on public.sh_consumo_rs_litro;
create policy sh_consumo_rs_litro_sel on public.sh_consumo_rs_litro for select to authenticated using (true);
create index if not exists sh_consumo_rs_litro_vig_idx on public.sh_consumo_rs_litro (vigencia);

-- ── DPO · 13 linha(s) · 5 coluna(s)
--    1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=DPO|g=|q=|h=
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_dpo (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_dpo
  add column if not exists col_0                                  text,   -- (coluna 0, sem rótulo na aba)
  add column if not exists col_1                                  text,   -- (coluna 1, sem rótulo na aba)
  add column if not exists col_2                                  text,   -- (coluna 2, sem rótulo na aba)
  add column if not exists col_3                                  text,   -- (coluna 3, sem rótulo na aba)
  add column if not exists col_4                                  text;   -- (coluna 4, sem rótulo na aba)
alter table public.sh_dpo enable row level security;
drop policy if exists sh_dpo_sel on public.sh_dpo;
create policy sh_dpo_sel on public.sh_dpo for select to authenticated using (true);

-- ── Demarco · 10 linha(s) · 5 coluna(s)
--    1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=Demarco|g=|q=|h=
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_demarco (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_demarco
  add column if not exists col_0                                  text,   -- (coluna 0, sem rótulo na aba)
  add column if not exists col_1                                  text,   -- (coluna 1, sem rótulo na aba)
  add column if not exists col_2                                  text,   -- (coluna 2, sem rótulo na aba)
  add column if not exists col_3                                  text,   -- (coluna 3, sem rótulo na aba)
  add column if not exists col_4                                  text;   -- (coluna 4, sem rótulo na aba)
alter table public.sh_demarco enable row level security;
drop policy if exists sh_demarco_sel on public.sh_demarco;
create policy sh_demarco_sel on public.sh_demarco for select to authenticated using (true);

-- ── FCA Total · 414 linha(s) · 26 coluna(s)
--    1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=FCA Total|g=|q=|h=1
create table if not exists public.sh_fca_total (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_fca_total
  add column if not exists origem                                 text,   -- Origem
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists projeto                                text,   -- Projeto
  add column if not exists fato                                   text,   -- Fato
  add column if not exists causa                                  text,   -- Causa
  add column if not exists acao                                   text,   -- Ação
  add column if not exists prazo                                  date,   -- Prazo
  add column if not exists status                                 text,   -- Status
  add column if not exists col_9                                  text,   -- (coluna 9, sem rótulo na aba)
  add column if not exists col_10                                 text,   -- (coluna 10, sem rótulo na aba)
  add column if not exists col_11                                 text,   -- (coluna 11, sem rótulo na aba)
  add column if not exists col_12                                 text,   -- (coluna 12, sem rótulo na aba)
  add column if not exists col_13                                 text,   -- (coluna 13, sem rótulo na aba)
  add column if not exists col_14                                 text,   -- (coluna 14, sem rótulo na aba)
  add column if not exists col_15                                 text,   -- (coluna 15, sem rótulo na aba)
  add column if not exists col_16                                 text,   -- (coluna 16, sem rótulo na aba)
  add column if not exists col_17                                 text,   -- (coluna 17, sem rótulo na aba)
  add column if not exists col_18                                 text,   -- (coluna 18, sem rótulo na aba)
  add column if not exists col_19                                 text,   -- (coluna 19, sem rótulo na aba)
  add column if not exists col_20                                 text,   -- (coluna 20, sem rótulo na aba)
  add column if not exists col_21                                 text,   -- (coluna 21, sem rótulo na aba)
  add column if not exists col_22                                 text,   -- (coluna 22, sem rótulo na aba)
  add column if not exists col_23                                 text,   -- (coluna 23, sem rótulo na aba)
  add column if not exists col_24                                 text,   -- (coluna 24, sem rótulo na aba)
  add column if not exists col_25                                 text;   -- (coluna 25, sem rótulo na aba)
alter table public.sh_fca_total enable row level security;
drop policy if exists sh_fca_total_sel on public.sh_fca_total;
create policy sh_fca_total_sel on public.sh_fca_total for select to authenticated using (true);
create index if not exists sh_fca_total_vig_idx on public.sh_fca_total (vigencia);

-- ── Metas (painel-metas) · 35 linha(s) · 26 coluna(s)
--    1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=|g=199351909|q=|h=
create table if not exists public.sh_metas (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_metas
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists indicador                              text,   -- Indicador
  add column if not exists peso                                   numeric,   -- Peso
  add column if not exists descricao                              text,   -- Descrição
  add column if not exists regra_de_atingimento                   text,   -- Regra de Atingimento
  add column if not exists unidade_de_medida                      text,   -- Unidade de Medida
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists atingimento                            numeric,   -- Atingimento
  add column if not exists pontos                                 numeric,   -- Pontos
  add column if not exists col_10                                 numeric,   -- (coluna 10, sem rótulo na aba)
  add column if not exists col_11                                 text,   -- (coluna 11, sem rótulo na aba)
  add column if not exists col_12                                 text,   -- (coluna 12, sem rótulo na aba)
  add column if not exists col_13                                 text,   -- (coluna 13, sem rótulo na aba)
  add column if not exists col_14                                 text,   -- (coluna 14, sem rótulo na aba)
  add column if not exists col_15                                 text,   -- (coluna 15, sem rótulo na aba)
  add column if not exists col_16                                 text,   -- (coluna 16, sem rótulo na aba)
  add column if not exists col_17                                 text,   -- (coluna 17, sem rótulo na aba)
  add column if not exists col_18                                 text,   -- (coluna 18, sem rótulo na aba)
  add column if not exists col_19                                 text,   -- (coluna 19, sem rótulo na aba)
  add column if not exists col_20                                 text,   -- (coluna 20, sem rótulo na aba)
  add column if not exists col_21                                 text,   -- (coluna 21, sem rótulo na aba)
  add column if not exists col_22                                 text,   -- (coluna 22, sem rótulo na aba)
  add column if not exists col_23                                 text,   -- (coluna 23, sem rótulo na aba)
  add column if not exists col_24                                 text,   -- (coluna 24, sem rótulo na aba)
  add column if not exists col_25                                 text;   -- (coluna 25, sem rótulo na aba)
alter table public.sh_metas enable row level security;
drop policy if exists sh_metas_sel on public.sh_metas;
create policy sh_metas_sel on public.sh_metas for select to authenticated using (true);
create index if not exists sh_metas_vig_idx on public.sh_metas (vigencia);

-- ── RPM · De-Para · 26 linha(s) · 9 coluna(s)
--    1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY|s=De-Para|g=|q=|h=0
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_rpm_depara (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_rpm_depara
  add column if not exists col_0                                  text,   -- (coluna 0, sem rótulo na aba)
  add column if not exists col_1                                  text,   -- (coluna 1, sem rótulo na aba)
  add column if not exists col_2                                  text,   -- (coluna 2, sem rótulo na aba)
  add column if not exists col_3                                  text,   -- (coluna 3, sem rótulo na aba)
  add column if not exists col_4                                  text,   -- (coluna 4, sem rótulo na aba)
  add column if not exists col_5                                  text,   -- (coluna 5, sem rótulo na aba)
  add column if not exists col_6                                  text,   -- (coluna 6, sem rótulo na aba)
  add column if not exists col_7                                  text,   -- (coluna 7, sem rótulo na aba)
  add column if not exists col_8                                  text;   -- (coluna 8, sem rótulo na aba)
alter table public.sh_rpm_depara enable row level security;
drop policy if exists sh_rpm_depara_sel on public.sh_rpm_depara;
create policy sh_rpm_depara_sel on public.sh_rpm_depara for select to authenticated using (true);

-- ── Base RPM · 6551 linha(s) · 13 coluna(s)
--    1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY|s=Base RPM|g=|q=|h=1
create table if not exists public.sh_rpm_base (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_rpm_base
  add column if not exists n                                      numeric,   -- Nº
  add column if not exists bloco                                  text,   -- Bloco
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists kpi                                    text,   -- KPI
  add column if not exists un                                     text,   -- Un.
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists pct_de_ating                           numeric,   -- % de Ating.
  add column if not exists causa                                  text,   -- Causa
  add column if not exists acao                                   text,   -- Ação
  add column if not exists prazo                                  date,   -- Prazo
  add column if not exists status                                 text;   -- Status
alter table public.sh_rpm_base enable row level security;
drop policy if exists sh_rpm_base_sel on public.sh_rpm_base;
create policy sh_rpm_base_sel on public.sh_rpm_base for select to authenticated using (true);
create index if not exists sh_rpm_base_vig_idx on public.sh_rpm_base (vigencia);

-- ── Consolidado ICs · 65 linha(s) · 14 coluna(s)
--    1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY|s=Consolidado ICs|g=|q=|h=
create table if not exists public.sh_rpm_ics (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_rpm_ics
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists ic_pct_de_disponibilidade_equipamentos numeric,   -- IC: % de Disponibilidade Equipamentos
  add column if not exists ic_pct_de_aderencia_as_preventivas     numeric,   -- IC: % de Aderência às Preventivas
  add column if not exists ic_consumo_km_l                        numeric,   -- IC: Consumo Km/l
  add column if not exists ic_pct_de_aderencia_as_afericoes       numeric,   -- IC: % de Aderência às Aferições
  add column if not exists ic_aderencia_ao_checklist_t1_e_t2      numeric,   -- IC: Aderência ao Checklist - T1 e T2
  add column if not exists ic_aderencia_ao_checklist_apoio        numeric,   -- IC: Aderência ao Checklist - Apoio
  add column if not exists ic_pct_de_conformidade_da_frota        numeric,   -- IC: % de conformidade da Frota
  add column if not exists ic_aderencia_ao_stress_test_caminhoes  numeric,   -- IC: Aderência ao Stress Test - Caminhões
  add column if not exists ic_aderencia_ao_stress_test_empilhadeiras numeric,   -- IC: Aderência ao Stress Test - Empilhadeiras
  add column if not exists ic_sla_de_atendimento                  numeric,   -- IC: SLA de atendimento
  add column if not exists ic_aderencia_a_conformidade            numeric,   -- IC: Aderência à Conformidade
  add column if not exists pontuacao_total                        numeric;   -- Pontuação Total
alter table public.sh_rpm_ics enable row level security;
drop policy if exists sh_rpm_ics_sel on public.sh_rpm_ics;
create policy sh_rpm_ics_sel on public.sh_rpm_ics for select to authenticated using (true);
create index if not exists sh_rpm_ics_vig_idx on public.sh_rpm_ics (vigencia);

-- ── Termômetro · Transportes T1 · 42 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=Transportes T1|g=|q=|h=
create table if not exists public.sh_term_transportes_t1 (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_transportes_t1
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        numeric,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         numeric,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        numeric,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1                text,   -- ADERÊNCIA PREVENTIVA T1
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_de_conformidade_t1     numeric,   -- ADERÊNCIA CHECK DE CONFORMIDADE T1
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_milimetragem_pneu_t1         numeric,   -- ADERÊNCIA MILIMETRAGEM PNEU T1
  add column if not exists t1_13                                  numeric,   -- # T1
  add column if not exists aderencia_checklist_t1                 numeric,   -- ADERÊNCIA CHECKLIST T1
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordem_de_servico_vencida_t1            numeric,   -- ORDEM DE SERVIÇO VENCIDA T1
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1                         numeric,   -- STRESS TEST T1
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists indisp_manutencao_t1                   numeric,   -- INDISP. MANUTENÇÃO T1
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1                                timestamp,   -- MTTR T1
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1                                timestamp,   -- MTBF T1
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_transportes_t1 enable row level security;
drop policy if exists sh_term_transportes_t1_sel on public.sh_term_transportes_t1;
create policy sh_term_transportes_t1_sel on public.sh_term_transportes_t1 for select to authenticated using (true);
create index if not exists sh_term_transportes_t1_vig_idx on public.sh_term_transportes_t1 (vigencia);

-- ── Termômetro · Transportes T1 - Acum · 3 linha(s) · 29 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=Transportes T1 - Acum|g=|q=|h=
create table if not exists public.sh_term_transportes_t1_acum (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_transportes_t1_acum
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        text,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         text,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        text,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1                text,   -- ADERÊNCIA PREVENTIVA T1
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_de_conformidade_t1     numeric,   -- ADERÊNCIA CHECK DE CONFORMIDADE T1
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_milimetragem_pneu_t1         numeric,   -- ADERÊNCIA MILIMETRAGEM PNEU T1
  add column if not exists t1_13                                  numeric,   -- # T1
  add column if not exists aderencia_checklist_t1                 numeric,   -- ADERÊNCIA CHECKLIST T1
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordem_de_servico_vencida_t1            numeric,   -- ORDEM DE SERVIÇO VENCIDA T1
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1                         numeric,   -- STRESS TEST T1
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists indisp_manutencao_t1                   numeric,   -- INDISP. MANUTENÇÃO T1
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1                                timestamp,   -- MTTR T1
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1                                numeric,   -- MTBF T1
  add column if not exists col_25                                 numeric,   -- # #
  add column if not exists col_26                                 numeric,   -- (coluna 26, sem rótulo na aba)
  add column if not exists col_27                                 numeric,   -- (coluna 27, sem rótulo na aba)
  add column if not exists col_28                                 numeric;   -- (coluna 28, sem rótulo na aba)
alter table public.sh_term_transportes_t1_acum enable row level security;
drop policy if exists sh_term_transportes_t1_acum_sel on public.sh_term_transportes_t1_acum;
create policy sh_term_transportes_t1_acum_sel on public.sh_term_transportes_t1_acum for select to authenticated using (true);
create index if not exists sh_term_transportes_t1_acum_vig_idx on public.sh_term_transportes_t1_acum (vigencia);

-- ── Termômetro · Transportes T2 · 126 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=Transportes T2|g=|q=|h=
create table if not exists public.sh_term_transportes_t2 (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_transportes_t2
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        numeric,   -- Ranking Ranking
  add column if not exists col_6                                  numeric,   -- (coluna 6, sem rótulo na aba)
  add column if not exists col_7                                  numeric,   -- (coluna 7, sem rótulo na aba)
  add column if not exists aderencia_preventiva_t2                text,   -- ADERÊNCIA PREVENTIVA T2
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_de_conformidade_t2     numeric,   -- ADERÊNCIA CHECK DE CONFORMIDADE T2
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists blitz_de_seguranca_du                  numeric,   -- BLITZ DE SEGURANÇA DU
  add column if not exists col_13                                 numeric,   -- # #
  add column if not exists aderencia_checklist_t2                 numeric,   -- ADERÊNCIA CHECKLIST T2
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists ordem_de_servico_vencidas_t2           numeric,   -- ORDEM DE SERVIÇO VENCIDAS T2
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t2                         numeric,   -- STRESS TEST T2
  add column if not exists col_19                                 numeric,   -- # #
  add column if not exists indisp_manutencao_t2                   numeric,   -- INDISP. MANUTENÇÃO T2
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t2                                timestamp,   -- MTTR T2
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_du                                timestamp,   -- MTBF DU
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_transportes_t2 enable row level security;
drop policy if exists sh_term_transportes_t2_sel on public.sh_term_transportes_t2;
create policy sh_term_transportes_t2_sel on public.sh_term_transportes_t2 for select to authenticated using (true);
create index if not exists sh_term_transportes_t2_vig_idx on public.sh_term_transportes_t2 (vigencia);

-- ── Termômetro · Transportes T2 - Acum · 9 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=Transportes T2 - Acum|g=|q=|h=
create table if not exists public.sh_term_transportes_t2_acum (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_transportes_t2_acum
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        text,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         text,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        text,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t2                text,   -- ADERÊNCIA PREVENTIVA T2
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_de_conformidade_t2     numeric,   -- ADERÊNCIA CHECK DE CONFORMIDADE T2
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists blitz_de_seguranca_du                  numeric,   -- BLITZ DE SEGURANÇA DU
  add column if not exists col_13                                 numeric,   -- # #
  add column if not exists aderencia_checklist_t2                 numeric,   -- ADERÊNCIA CHECKLIST T2
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists ordem_de_servico_vencidas_t2           numeric,   -- ORDEM DE SERVIÇO VENCIDAS T2
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t2                         numeric,   -- STRESS TEST T2
  add column if not exists col_19                                 numeric,   -- # #
  add column if not exists indisp_manutencao_t2                   numeric,   -- INDISP. MANUTENÇÃO T2
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t2                                timestamp,   -- MTTR T2
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_du                                numeric,   -- MTBF DU
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_transportes_t2_acum enable row level security;
drop policy if exists sh_term_transportes_t2_acum_sel on public.sh_term_transportes_t2_acum;
create policy sh_term_transportes_t2_acum_sel on public.sh_term_transportes_t2_acum for select to authenticated using (true);
create index if not exists sh_term_transportes_t2_acum_vig_idx on public.sh_term_transportes_t2_acum (vigencia);

-- ── Termômetro · WH T1 · 14 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=WH T1|g=|q=|h=
create table if not exists public.sh_term_wh_t1 (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_wh_t1
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        numeric,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         numeric,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        numeric,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1_wh             text,   -- ADERÊNCIA PREVENTIVA T1 WH
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_conformidade_t1_wh     numeric,   -- ADERÊNCIA CHECK CONFORMIDADE T1 WH
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists milimetragem_pneu_t1_wh                numeric,   -- MILIMETRAGEM PNEU T1 WH
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_checklist_t1_wh              numeric,   -- ADERÊNCIA CHECKLIST T1 WH
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordens_de_servico_vencida_t1_wh        numeric,   -- ORDENS DE SERVIÇO VENCIDA T1 WH
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1_wh                      numeric,   -- STRESS TEST T1 WH
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists disponibilidade_contratada_t1_wh       numeric,   -- DISPONIBILIDADE CONTRATADA T1 WH
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1_wh                             timestamp,   -- MTTR T1 WH
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1_wh                             timestamp,   -- MTBF T1 WH
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_wh_t1 enable row level security;
drop policy if exists sh_term_wh_t1_sel on public.sh_term_wh_t1;
create policy sh_term_wh_t1_sel on public.sh_term_wh_t1 for select to authenticated using (true);
create index if not exists sh_term_wh_t1_vig_idx on public.sh_term_wh_t1 (vigencia);

-- ── Termômetro · WH T1 - Acum · 1 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=WH T1 - Acum|g=|q=|h=
create table if not exists public.sh_term_wh_t1_acum (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_wh_t1_acum
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        text,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         text,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        text,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1_wh             text,   -- ADERÊNCIA PREVENTIVA T1 WH
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_conformidade_t1_wh     numeric,   -- ADERÊNCIA CHECK CONFORMIDADE T1 WH
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists milimetragem_pneu_t1_wh                numeric,   -- MILIMETRAGEM PNEU T1 WH
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_checklist_t1_wh              numeric,   -- ADERÊNCIA CHECKLIST T1 WH
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordens_de_servico_vencida_t1_wh        numeric,   -- ORDENS DE SERVIÇO VENCIDA T1 WH
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1_wh                      numeric,   -- STRESS TEST T1 WH
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists disponibilidade_contratada_t1_wh       numeric,   -- DISPONIBILIDADE CONTRATADA T1 WH
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1_wh                             timestamp,   -- MTTR T1 WH
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1_wh                             numeric,   -- MTBF T1 WH
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_wh_t1_acum enable row level security;
drop policy if exists sh_term_wh_t1_acum_sel on public.sh_term_wh_t1_acum;
create policy sh_term_wh_t1_acum_sel on public.sh_term_wh_t1_acum for select to authenticated using (true);
create index if not exists sh_term_wh_t1_acum_vig_idx on public.sh_term_wh_t1_acum (vigencia);

-- ── Termômetro · WH T2 · 74 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=WH T2|g=|q=|h=
create table if not exists public.sh_term_wh_t2 (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_wh_t2
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        numeric,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         numeric,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        numeric,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1_wh             text,   -- ADERÊNCIA PREVENTIVA T1 WH
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_conformidade_t1_wh     numeric,   -- ADERÊNCIA CHECK CONFORMIDADE T1 WH
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists milimetragem_pneu_t1_wh                numeric,   -- MILIMETRAGEM PNEU T1 WH
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_checklist_t1_wh              numeric,   -- ADERÊNCIA CHECKLIST T1 WH
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordens_de_servico_vencida_t1_wh        numeric,   -- ORDENS DE SERVIÇO VENCIDA T1 WH
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1_wh                      numeric,   -- STRESS TEST T1 WH
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists disponibilidade_contratada_t1_wh       numeric,   -- DISPONIBILIDADE CONTRATADA T1 WH
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1_wh                             timestamp,   -- MTTR T1 WH
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1_wh                             timestamp,   -- MTBF T1 WH
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_wh_t2 enable row level security;
drop policy if exists sh_term_wh_t2_sel on public.sh_term_wh_t2;
create policy sh_term_wh_t2_sel on public.sh_term_wh_t2 for select to authenticated using (true);
create index if not exists sh_term_wh_t2_vig_idx on public.sh_term_wh_t2 (vigencia);

-- ── Termômetro · WH T2 - Acum · 6 linha(s) · 26 coluna(s)
--    10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac|s=WH T2 - Acum|g=|q=|h=
create table if not exists public.sh_term_wh_t2_acum (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_term_wh_t2_acum
  add column if not exists vigencia_m_q                           text,   -- Vigência M_Q
  add column if not exists br_cdd                                 text,   -- BR CDD
  add column if not exists tp                                     text,   -- TP
  add column if not exists geo                                    text,   -- GEO
  add column if not exists total_pontos_total_pontos              numeric,   -- Total Pontos Total Pontos
  add column if not exists ranking_ranking                        text,   -- Ranking Ranking
  add column if not exists conforme_t1_wh                         numeric,   -- Conforme T1 WH
  add column if not exists aderencia_t1_wh                        numeric,   -- ADERÊNCIA T1 WH
  add column if not exists aderencia_preventiva_t1_wh             text,   -- ADERÊNCIA PREVENTIVA T1 WH
  add column if not exists col_9                                  numeric,   -- # #
  add column if not exists aderencia_check_conformidade_t1_wh     numeric,   -- ADERÊNCIA CHECK CONFORMIDADE T1 WH
  add column if not exists col_11                                 numeric,   -- # #
  add column if not exists milimetragem_pneu_t1_wh                numeric,   -- MILIMETRAGEM PNEU T1 WH
  add column if not exists t1                                     numeric,   -- # T1
  add column if not exists aderencia_checklist_t1_wh              numeric,   -- ADERÊNCIA CHECKLIST T1 WH
  add column if not exists t1_15                                  numeric,   -- # T1
  add column if not exists ordens_de_servico_vencida_t1_wh        numeric,   -- ORDENS DE SERVIÇO VENCIDA T1 WH
  add column if not exists t1_17                                  numeric,   -- # T1
  add column if not exists stress_test_t1_wh                      numeric,   -- STRESS TEST T1 WH
  add column if not exists t1_19                                  numeric,   -- # T1
  add column if not exists disponibilidade_contratada_t1_wh       numeric,   -- DISPONIBILIDADE CONTRATADA T1 WH
  add column if not exists col_21                                 numeric,   -- # #
  add column if not exists mttr_t1_wh                             timestamp,   -- MTTR T1 WH
  add column if not exists col_23                                 numeric,   -- # #
  add column if not exists mtbf_t1_wh                             numeric,   -- MTBF T1 WH
  add column if not exists col_25                                 numeric;   -- # #
alter table public.sh_term_wh_t2_acum enable row level security;
drop policy if exists sh_term_wh_t2_acum_sel on public.sh_term_wh_t2_acum;
create policy sh_term_wh_t2_acum_sel on public.sh_term_wh_t2_acum for select to authenticated using (true);
create index if not exists sh_term_wh_t2_acum_vig_idx on public.sh_term_wh_t2_acum (vigencia);

-- ── Seara · Base Remunerado · 300 linha(s) · 36 coluna(s)
--    1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE|s=|g=0|q=|h=1
create table if not exists public.sh_seara_remunerado (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_seara_remunerado
  add column if not exists vigencia_orig                          date,   -- Vigencia
  add column if not exists cnpjunidade                            numeric,   -- CnpjUnidade
  add column if not exists nomeunidade                            text,   -- NomeUnidade
  add column if not exists placa                                  text,   -- Placa
  add column if not exists chassi                                 text,   -- Chassi
  add column if not exists modeloveiculo                          text,   -- ModeloVeiculo
  add column if not exists capacidadecarga                        text,   -- CapacidadeCarga
  add column if not exists tipoequipamento                        text,   -- TipoEquipamento
  add column if not exists empresalocadora                        text,   -- EmpresaLocadora
  add column if not exists aluguel                                text,   -- Aluguel
  add column if not exists ravex                                  numeric,   -- Ravex
  add column if not exists manobrista                             numeric,   -- Manobrista
  add column if not exists custo_fixo                             text,   -- Custo Fixo
  add column if not exists totalreaisporkm                        numeric,   -- TotalReaisPorKm
  add column if not exists reaisporkm                             numeric,   -- ReaisPorKm
  add column if not exists kmporlitro                             numeric,   -- KmPorLitro
  add column if not exists tipocombustivel                        text,   -- TipoCombustivel
  add column if not exists precodiesel                            numeric,   -- PrecoDiesel
  add column if not exists precoarla                              numeric,   -- PrecoArla
  add column if not exists reaisporkmdiesel                       numeric,   -- ReaisPorKmDiesel
  add column if not exists reaisporkmarla                         numeric,   -- ReaisPorKmArla
  add column if not exists reaisporkmmanutecao                    numeric,   -- ReaisPorKmManuteção
  add column if not exists tipopneu                               text,   -- TipoPneu
  add column if not exists quantidadepneus                        numeric,   -- QuantidadePneus
  add column if not exists preco                                  text,   -- Preco
  add column if not exists quantidaderecapagens                   numeric,   -- QuantidadeRecapagens
  add column if not exists precorecapagem                         numeric,   -- PrecoRecapagem
  add column if not exists vidautilpneu                           text,   -- VidaUtilPneu
  add column if not exists vidautilrecapagem                      text,   -- VidaUtilRecapagem
  add column if not exists reaisporkmpneu                         numeric,   -- ReaisPorKmPneu
  add column if not exists reaisporkmrecapagem                    numeric,   -- ReaisPorKmRecapagem
  add column if not exists reaisporkmlubrificante                 numeric,   -- ReaisPorKmLubrificante
  add column if not exists quantidadelavagens                     numeric,   -- QuantidadeLavagens
  add column if not exists precolavagem                           numeric,   -- PrecoLavagem
  add column if not exists kmlavagem                              text,   -- KmLavagem
  add column if not exists reaisporkmlavagem                      numeric;   -- ReaisPorKmLavagem
alter table public.sh_seara_remunerado enable row level security;
drop policy if exists sh_seara_remunerado_sel on public.sh_seara_remunerado;
create policy sh_seara_remunerado_sel on public.sh_seara_remunerado for select to authenticated using (true);
create index if not exists sh_seara_remunerado_vig_idx on public.sh_seara_remunerado (vigencia);

-- ── Seara · Base CTEs · 57679 linha(s) · 4 coluna(s)
--    1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE|s=|g=1672208132|q=select B, C, D, J|h=1
create table if not exists public.sh_seara_ctes (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_seara_ctes
  add column if not exists cd_viagem_transporte                   numeric,   -- CD_VIAGEM_TRANSPORTE
  add column if not exists cd_placa_veiculo                       text,   -- CD_PLACA_VEICULO
  add column if not exists dt_emissao_viagem                      timestamp,   -- DT_EMISSAO_VIAGEM
  add column if not exists qt_quilometros_viagem                  numeric;   -- QT_QUILOMETROS_VIAGEM
alter table public.sh_seara_ctes enable row level security;
drop policy if exists sh_seara_ctes_sel on public.sh_seara_ctes;
create policy sh_seara_ctes_sel on public.sh_seara_ctes for select to authenticated using (true);
create index if not exists sh_seara_ctes_vig_idx on public.sh_seara_ctes (vigencia);

-- ── Seara · Combustível · 318 linha(s) · 14 coluna(s)
--    1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE|s=|g=1982300845|q=|h=1
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_seara_combustivel (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_seara_combustivel
  add column if not exists pode_comeca                            text,   -- Pode começa
  add column if not exists empresa                                text,   -- Empresa
  add column if not exists projeto                                text,   -- Projeto
  add column if not exists unidade                                text,   -- Unidade
  add column if not exists placa                                  text,   -- Placa
  add column if not exists mes_inicio_os                          text,   -- Mês Inicio OS
  add column if not exists ano_inicio_os                          numeric,   -- Ano Inicio OS
  add column if not exists modelo                                 text,   -- Modelo
  add column if not exists tipo_combustivel                       text,   -- Tipo Combustivel
  add column if not exists tipo_veiculo                           text,   -- Tipo Veiculo
  add column if not exists km_rodado_horas_trabalhadas            numeric,   -- KM Rodado / Horas trabalhadas
  add column if not exists qtd_total_de_litros                    numeric,   -- QTD Total de Litros
  add column if not exists valor_medio_litro                      numeric,   -- Valor Médio Litro
  add column if not exists totas_rs                               numeric;   -- TOTAS R$
alter table public.sh_seara_combustivel enable row level security;
drop policy if exists sh_seara_combustivel_sel on public.sh_seara_combustivel;
create policy sh_seara_combustivel_sel on public.sh_seara_combustivel for select to authenticated using (true);

-- ── Frota de Elite · Pneus · 9011 linha(s) · 7 coluna(s)
--    1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M|s=Pneus|g=|q=|h=
create table if not exists public.sh_elite_pneus (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_elite_pneus
  add column if not exists filial                                 text,   -- Filial
  add column if not exists evento                                 text,   -- Evento
  add column if not exists placa                                  text,   -- Placa
  add column if not exists projeto                                text,   -- Projeto
  add column if not exists periodo                                date,   -- Período
  add column if not exists ultima_leitura                         date,   -- Última Leitura
  add column if not exists status                                 text;   -- Status
alter table public.sh_elite_pneus enable row level security;
drop policy if exists sh_elite_pneus_sel on public.sh_elite_pneus;
create policy sh_elite_pneus_sel on public.sh_elite_pneus for select to authenticated using (true);
create index if not exists sh_elite_pneus_vig_idx on public.sh_elite_pneus (vigencia);

-- ── Manutenção · 23301 linha(s) · 17 coluna(s)
--    1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k|s=|g=0|q=|h=1
create table if not exists public.sh_manutencao (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_manutencao
  add column if not exists empresa                                text,   -- EMPRESA
  add column if not exists nivel_1                                text,   -- NÍVEL 1
  add column if not exists nivel_2                                text,   -- NÍVEL 2
  add column if not exists cod_red_projeto                        numeric,   -- CÓD. RED PROJETO
  add column if not exists nivel_3                                text,   -- NÍVEL 3
  add column if not exists conta_gerencial                        text,   -- CONTA GERENCIAL
  add column if not exists cod_red_conta_contabil                 numeric,   -- CÓD. RED. CONTA CONTÁBIL
  add column if not exists conta_contabil                         text,   -- CONTA CONTÁBIL
  add column if not exists fornecedor                             text,   -- FORNECEDOR
  add column if not exists historico                              text,   -- HISTÓRICO
  add column if not exists data                                   date,   -- DATA
  add column if not exists natureza                               text,   -- NATUREZA
  add column if not exists documento                              text,   -- DOCUMENTO
  add column if not exists cod_cc                                 numeric,   -- CÓD. CC
  add column if not exists desc_cc                                text,   -- DESC. CC
  add column if not exists realizado                              numeric,   -- REALIZADO
  add column if not exists remunerado                             numeric;   -- REMUNERADO
alter table public.sh_manutencao enable row level security;
drop policy if exists sh_manutencao_sel on public.sh_manutencao;
create policy sh_manutencao_sel on public.sh_manutencao for select to authenticated using (true);
create index if not exists sh_manutencao_vig_idx on public.sh_manutencao (vigencia);

-- ── Tendência · Base · 8 linha(s) · 17 coluna(s)
--    1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0|s=Base|g=|q=|h=
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_tendencia_base (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_tendencia_base
  add column if not exists ano                                    numeric,   -- Ano
  add column if not exists remunerado                             numeric,   -- Remunerado
  add column if not exists custo_carrocerias                      numeric,   -- Custo Carrocerias
  add column if not exists custo_qlp_adicional                    numeric,   -- Custo QLP Adicional
  add column if not exists custo_total                            numeric,   -- Custo Total
  add column if not exists km_rodado                              numeric,   -- Km Rodado
  add column if not exists equipamentos                           numeric,   -- # Equipamentos
  add column if not exists rs_km_real                             numeric,   -- R$/km - Real
  add column if not exists rs_km_rem                              numeric,   -- R$/km - Rem
  add column if not exists d_rs_km                                numeric,   -- Δ R$/km
  add column if not exists impacto_rs_km                          numeric,   -- Impacto R$/Km
  add column if not exists rs_equip_rem                           numeric,   -- R$/Equip. Rem
  add column if not exists rs_equip_real                          numeric,   -- R$/Equip. Real
  add column if not exists d_rs_equip                             numeric,   -- Δ R$/Equip.
  add column if not exists impacto_rs_equip                       numeric,   -- Impacto R$/Equip.
  add column if not exists col_15                                 numeric,   -- (coluna 15, sem rótulo na aba)
  add column if not exists col_16                                 numeric;   -- (coluna 16, sem rótulo na aba)
alter table public.sh_tendencia_base enable row level security;
drop policy if exists sh_tendencia_base_sel on public.sh_tendencia_base;
create policy sh_tendencia_base_sel on public.sh_tendencia_base for select to authenticated using (true);

-- ── Metas Diretor · Regras · 7 linha(s) · 26 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=0|q=|h=
--    (esta aba não tem coluna de vigência — a coluna vigencia fica nula)
create table if not exists public.sh_mtdir_regras (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_regras
  add column if not exists metas_funcao                           numeric,   -- Metas: Função:
  add column if not exists jeronimo_raulino_diretor_op_ssma_gente text,   -- JERONIMO RAULINO DIRETOR OP./SSMA/GENTE
  add column if not exists col_2                                  numeric,   -- (coluna 2, sem rótulo na aba)
  add column if not exists col_3                                  text,   -- (coluna 3, sem rótulo na aba)
  add column if not exists col_4                                  text,   -- (coluna 4, sem rótulo na aba)
  add column if not exists col_5                                  text,   -- (coluna 5, sem rótulo na aba)
  add column if not exists col_6                                  text,   -- (coluna 6, sem rótulo na aba)
  add column if not exists col_7                                  text,   -- (coluna 7, sem rótulo na aba)
  add column if not exists col_8                                  text,   -- (coluna 8, sem rótulo na aba)
  add column if not exists col_9                                  text,   -- (coluna 9, sem rótulo na aba)
  add column if not exists col_10                                 text,   -- (coluna 10, sem rótulo na aba)
  add column if not exists col_11                                 text,   -- (coluna 11, sem rótulo na aba)
  add column if not exists col_12                                 text,   -- (coluna 12, sem rótulo na aba)
  add column if not exists col_13                                 text,   -- (coluna 13, sem rótulo na aba)
  add column if not exists col_14                                 text,   -- (coluna 14, sem rótulo na aba)
  add column if not exists col_15                                 text,   -- (coluna 15, sem rótulo na aba)
  add column if not exists col_16                                 text,   -- (coluna 16, sem rótulo na aba)
  add column if not exists col_17                                 text,   -- (coluna 17, sem rótulo na aba)
  add column if not exists col_18                                 text,   -- (coluna 18, sem rótulo na aba)
  add column if not exists col_19                                 text,   -- (coluna 19, sem rótulo na aba)
  add column if not exists col_20                                 text,   -- (coluna 20, sem rótulo na aba)
  add column if not exists col_21                                 text,   -- (coluna 21, sem rótulo na aba)
  add column if not exists col_22                                 text,   -- (coluna 22, sem rótulo na aba)
  add column if not exists col_23                                 text,   -- (coluna 23, sem rótulo na aba)
  add column if not exists col_24                                 text,   -- (coluna 24, sem rótulo na aba)
  add column if not exists col_25                                 text;   -- (coluna 25, sem rótulo na aba)
alter table public.sh_mtdir_regras enable row level security;
drop policy if exists sh_mtdir_regras_sel on public.sh_mtdir_regras;
create policy sh_mtdir_regras_sel on public.sh_mtdir_regras for select to authenticated using (true);

-- ── Metas Diretor · Getrans/Gemovi · 12 linha(s) · 4 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=410676465|q=|h=
create table if not exists public.sh_mtdir_ind1_getrans (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_ind1_getrans
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real_posicao_no_ranking                numeric,   -- Real (Posição no Ranking)
  add column if not exists ating_pct                              text;   -- Ating. %
alter table public.sh_mtdir_ind1_getrans enable row level security;
drop policy if exists sh_mtdir_ind1_getrans_sel on public.sh_mtdir_ind1_getrans;
create policy sh_mtdir_ind1_getrans_sel on public.sh_mtdir_ind1_getrans for select to authenticated using (true);
create index if not exists sh_mtdir_ind1_getrans_vig_idx on public.sh_mtdir_ind1_getrans (vigencia);

-- ── Metas Diretor · Resultado Operacional · 12 linha(s) · 4 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=1055877945|q=|h=
create table if not exists public.sh_mtdir_ind2_ebitda (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_ind2_ebitda
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists ating_pct                              numeric;   -- Ating. %
alter table public.sh_mtdir_ind2_ebitda enable row level security;
drop policy if exists sh_mtdir_ind2_ebitda_sel on public.sh_mtdir_ind2_ebitda;
create policy sh_mtdir_ind2_ebitda_sel on public.sh_mtdir_ind2_ebitda for select to authenticated using (true);
create index if not exists sh_mtdir_ind2_ebitda_vig_idx on public.sh_mtdir_ind2_ebitda (vigencia);

-- ── Metas Diretor · Gente/Sucessores · 12 linha(s) · 4 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=1358349252|q=|h=
create table if not exists public.sh_mtdir_ind3_sucessores (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_ind3_sucessores
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists ating_pct                              text;   -- Ating. %
alter table public.sh_mtdir_ind3_sucessores enable row level security;
drop policy if exists sh_mtdir_ind3_sucessores_sel on public.sh_mtdir_ind3_sucessores;
create policy sh_mtdir_ind3_sucessores_sel on public.sh_mtdir_ind3_sucessores for select to authenticated using (true);
create index if not exists sh_mtdir_ind3_sucessores_vig_idx on public.sh_mtdir_ind3_sucessores (vigencia);

-- ── Metas Diretor · SSMAQ · 12 linha(s) · 4 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=1177655149|q=|h=
create table if not exists public.sh_mtdir_ind4_ssmaq (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_ind4_ssmaq
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists ating_pct                              text;   -- Ating. %
alter table public.sh_mtdir_ind4_ssmaq enable row level security;
drop policy if exists sh_mtdir_ind4_ssmaq_sel on public.sh_mtdir_ind4_ssmaq;
create policy sh_mtdir_ind4_ssmaq_sel on public.sh_mtdir_ind4_ssmaq for select to authenticated using (true);
create index if not exists sh_mtdir_ind4_ssmaq_vig_idx on public.sh_mtdir_ind4_ssmaq (vigencia);

-- ── Metas Diretor · Perdas Operacionais · 12 linha(s) · 5 coluna(s)
--    1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8|s=|g=523073816|q=|h=
create table if not exists public.sh_mtdir_ind5_perdas (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_mtdir_ind5_perdas
  add column if not exists vigencia_ly                            date,   -- Vigência LY
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists meta                                   numeric,   -- Meta
  add column if not exists real                                   numeric,   -- Real
  add column if not exists yoy_pct                                numeric;   -- YoY %
alter table public.sh_mtdir_ind5_perdas enable row level security;
drop policy if exists sh_mtdir_ind5_perdas_sel on public.sh_mtdir_ind5_perdas;
create policy sh_mtdir_ind5_perdas_sel on public.sh_mtdir_ind5_perdas for select to authenticated using (true);
create index if not exists sh_mtdir_ind5_perdas_vig_idx on public.sh_mtdir_ind5_perdas (vigencia);

-- ── Farol Semanal · Custos · 251 linha(s) · 12 coluna(s)
--    1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY|s=Custos|g=|q=|h=1
create table if not exists public.sh_farol_custos (
  linha         integer primary key,   -- posição da linha na aba
  vigencia      text,                  -- MM/YYYY normalizada
  atualizado_em timestamptz not null default now()
);
alter table public.sh_farol_custos
  add column if not exists d_orc                                  numeric,   -- Δ ORÇ.
  add column if not exists d_fct                                  text,   -- Δ FCT
  add column if not exists vigencia_orig                          date,   -- Vigência
  add column if not exists estrutura                              numeric,   -- ESTRUTURA
  add column if not exists unidade                                text,   -- UNIDADE
  add column if not exists nivel_3                                text,   -- NÍVEL 3
  add column if not exists conta_gerencial                        text,   -- CONTA GERENCIAL
  add column if not exists mes                                    text,   -- MÊS
  add column if not exists ano                                    numeric,   -- ANO
  add column if not exists orcado                                 numeric,   -- ORÇADO
  add column if not exists remunerado                             numeric,   -- REMUNERADO
  add column if not exists realizado                              numeric;   -- REALIZADO
alter table public.sh_farol_custos enable row level security;
drop policy if exists sh_farol_custos_sel on public.sh_farol_custos;
create policy sh_farol_custos_sel on public.sh_farol_custos for select to authenticated using (true);
create index if not exists sh_farol_custos_vig_idx on public.sh_farol_custos (vigencia);

-- ---------- Conferência -------------------------------------------------
-- select slug, linhas, carregado_em, erro from public.sh_base order by slug;
