-- ============================================================
-- DRE GERENCIAL DO ERP NO BANCO (Renan, 17/11/2026: "vamos subir no banco os
-- dados da planilha que enviei. Vamos usar eles em outubro, não sheets")
-- Rode no SQL Editor do Supabase. Reexecutável.
--
-- O export "DRE Gerencial Sintético" da Bússola Gerencial (FP&A da Conlog,
-- bussolagerencial.vercel.app → DRE → DRE Gerencial → Comparativo Orçado +
-- Remunerado → download) traz, por mês, TODAS as estruturas do DRE (níveis 1
-- a 4 e os totalizadores) × projeto × unidade, com Realizado · Orçado ·
-- Remunerado · Forecast. Ele entra INTEIRO em dre_gerencial (uma linha por
-- linha do arquivo; subir o mesmo mês de novo substitui o mês), pela tela
-- /visao-financeira/dre/ (arrastar; só admin).
--
-- Quem lê o DRE são as três abas do Sheets (Frota, Receita Líquida, EBITDA),
-- que vivem em sh_dre_frota / sh_dre_receita / sh_dre_ebitda. Para nenhum
-- painel precisar mudar, dre_gerencial_monta() escreve as MESMAS três abas,
-- no MESMO layout, em ca_dre_frota / ca_dre_receita / ca_dre_ebitda:
--   • meses que o banco TEM  → derivados do export do ERP
--   • meses que o banco NÃO tem → copiados da sh_* (a aba do Sheets)
-- e registra as três em consumo_auto_base, que é o que o assets/gviz-cache.js
-- (e a Visão Financeira, pelo GvizCache.tabelaConsumo) consultam para servir
-- a ca_* no lugar da sh_*. É o desenho do consumo automático (27/10/2026).
--
-- A aba Frota = nível 4 das 14 contas de frota (170 Combustíveis · 171 Arla ·
-- 173 Pneus Novos · 174 Recapagens · 176 Manut. Veículos · 177 Carrocerias ·
-- 178 Contratos Fabricante · 180 Personalização · 181 Lavação · 183 Materiais
-- de Oficina · 185 Seguro · 186 IPVA · 398 Estorno de ICMS · 572 ICMS Crédito
-- Presumido — os mesmos códigos da "ESTRUTURAS FROTA" do Qlik). Receita
-- Líquida = estrutura 31. EBITDA = estrutura 350 (EBITDA AJUSTADO: é o que a
-- aba do Sheets tem — conferido ao centavo no remunerado de out/26).
-- Sinal: custos negativos, como na aba. Δ ORÇ = orçado − realizado,
-- Δ REM = remunerado − realizado (a conta da aba).
-- ============================================================

-- ── 1) o export inteiro ───────────────────────────────────────────────────
create table if not exists public.dre_gerencial (
  id              bigserial primary key,
  ano             int  not null,
  mes             int  not null check (mes between 1 and 12),
  cod_empresa     text,
  cod_dre         text not null,          -- Código DRE Gerencial (1, 31, 170, 350…)
  nivel           int,                    -- Nível da Estrutura (1 a 4)
  estrutura       text not null,          -- Nome da Estrutura
  handle_projeto  text,
  projeto         text not null,          -- Conta do Plano de Projetos (Rota - BLC)
  segmento        text,
  overhead        boolean,
  grupo           text,
  cod_operacao    text,
  operacao        text,
  cod_unidade     text,
  unidade         text,
  realizado       numeric not null default 0,
  orcado          numeric not null default 0,
  remunerado      numeric not null default 0,
  forecast        numeric not null default 0,
  arquivo         text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);
create index if not exists dre_gerencial_mes_ix on public.dre_gerencial (ano, mes);
create index if not exists dre_gerencial_cod_ix on public.dre_gerencial (cod_dre);
alter table public.dre_gerencial enable row level security;
drop policy if exists dre_gerencial_le on public.dre_gerencial;
create policy dre_gerencial_le on public.dre_gerencial for select to authenticated using (true);
drop policy if exists dre_gerencial_adm on public.dre_gerencial;
create policy dre_gerencial_adm on public.dre_gerencial for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
grant select, insert, update, delete on public.dre_gerencial to authenticated;
grant usage, select on sequence public.dre_gerencial_id_seq to authenticated;

-- ── 2) as três abas montadas, no layout das sh_* ──────────────────────────
do $$
declare s text;
begin
  foreach s in array array['dre_frota','dre_receita','dre_ebitda'] loop
    if to_regclass('public.sh_' || s) is null then
      raise exception 'sh_% não existe — rode o bases-manuais.sql antes', s;
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

-- o registro que o shim lê (existe desde o consumo automático; aqui só por garantia)
create table if not exists public.consumo_auto_base (
  slug text primary key, tabela text not null, colunas jsonb, linhas int not null default 0,
  carregado_em timestamptz, erro text, resumo jsonb
);

-- ── 3) montar as abas (chamada pela tela depois de cada importação) ───────
create or replace function public.dre_gerencial_monta() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_meses text[];            -- 'MM/AAAA' dos meses que o banco tem
  v_out jsonb := '{}'::jsonb;
  s text; n_aba int; n_erp int; off int; cols jsonb;
  meses_pt constant text[] := array['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
begin
  if auth.uid() is not null and not public.fca_is_admin() then
    raise exception 'só administradores montam as abas do DRE';
  end if;
  select coalesce(array_agg(distinct to_char(mes, 'FM00') || '/' || ano), '{}') into v_meses from public.dre_gerencial;

  -- unidade como a aba escreve (caixa alta; o export vem "Rondonopolis" sem acento)
  create temp table if not exists _dre_src on commit drop as
  select ano, mes, cod_dre, nivel, estrutura,
         upper(projeto) as nivel_3,
         case upper(unidade) when 'RONDONOPOLIS' then 'RONDONÓPOLIS' when 'CUIABA' then 'CUIABÁ'
              when 'PIRAI' then 'PIRAÍ' when 'GOIANIA' then 'GOIÂNIA' else upper(coalesce(unidade, '')) end as unidade,
         realizado, orcado, remunerado
  from public.dre_gerencial;

  foreach s in array array['dre_frota','dre_receita','dre_ebitda'] loop
    execute format('truncate table public.ca_%I', s);
    -- (a) os meses que o banco NÃO tem vêm da aba do Sheets, como estão
    execute format($q$
      insert into public.ca_%1$I
      select * from public.sh_%1$I where not (vigencia = any($1))
    $q$, s) using v_meses;
    get diagnostics n_aba = row_count;
    execute format('select coalesce(max(linha), 0) from public.ca_%I', s) into off;
    -- (b) os meses do banco, derivados do export (linha provisória depois das da aba; renumerada abaixo)
    if s = 'dre_frota' then
      insert into public.ca_dre_frota (linha, vigencia, atualizado_em, vigencia_orig, d_orc_brl, d_rem_brl, unidade, nivel_3, conta_gerencial, mes, ano, orcado, remunerado, realizado)
      select off + row_number() over (), to_char(mes, 'FM00') || '/' || ano, now(), make_date(ano, mes, 1),
             sum(orcado) - sum(realizado), sum(remunerado) - sum(realizado),
             unidade, nivel_3, estrutura, meses_pt[mes], ano, sum(orcado), sum(remunerado), sum(realizado)
      from _dre_src
      where nivel = 4 and cod_dre in ('170','171','173','174','176','177','178','180','181','183','185','186','398','572')
      group by ano, mes, unidade, nivel_3, estrutura
      having sum(orcado) <> 0 or sum(remunerado) <> 0 or sum(realizado) <> 0;
    elsif s = 'dre_receita' then
      insert into public.ca_dre_receita (linha, vigencia, atualizado_em, vigencia_orig, d_orc_brl, d_rem_brl, unidade, nivel_3, conta_gerencial, mes, ano, orcado, remunerado, realizado)
      select off + row_number() over (), to_char(mes, 'FM00') || '/' || ano, now(), make_date(ano, mes, 1),
             sum(orcado) - sum(realizado), sum(remunerado) - sum(realizado),
             unidade, nivel_3, '( = ) Receita Líquida', meses_pt[mes], ano, sum(orcado), sum(remunerado), sum(realizado)
      from _dre_src where cod_dre = '31'
      group by ano, mes, unidade, nivel_3
      having sum(orcado) <> 0 or sum(remunerado) <> 0 or sum(realizado) <> 0;
    else
      insert into public.ca_dre_ebitda (linha, vigencia, atualizado_em, vigencia_orig, d_orc_brl, d_rem_brl, unidade, nivel_3, conta_gerencial, mes, ano, orcado, remunerado, realizado)
      select off + row_number() over (), to_char(mes, 'FM00') || '/' || ano, now(), make_date(ano, mes, 1),
             sum(orcado) - sum(realizado), sum(remunerado) - sum(realizado),
             unidade, nivel_3, '( = ) EBITDA', meses_pt[mes], ano, sum(orcado), sum(remunerado), sum(realizado)
      from _dre_src where cod_dre = '350'
      group by ano, mes, unidade, nivel_3
      having sum(orcado) <> 0 or sum(remunerado) <> 0 or sum(realizado) <> 0;
    end if;
    get diagnostics n_erp = row_count;
    -- `linha` é a ordem de leitura do shim: renumera a tabela inteira por vigência (em dois passos,
    -- pelo negativo, porque `linha` é chave primária e a troca direta colidiria com a linha vizinha)
    execute format($q$
      with o as (select ctid as c, row_number() over (order by vigencia_orig, nivel_3, conta_gerencial, unidade) as n from public.ca_%1$I)
      update public.ca_%1$I t set linha = -o.n from o where t.ctid = o.c
    $q$, s);
    execute format('update public.ca_%I set linha = -linha', s);
    select colunas into cols from public.sh_base where slug = s;
    insert into public.consumo_auto_base (slug, tabela, colunas, linhas, carregado_em, erro, resumo)
    values (s, 'ca_' || s, cols, n_aba + n_erp, now(), null,
            jsonb_build_object('fonte', 'dre_gerencial', 'meses_erp', to_jsonb(v_meses), 'linhas_erp', n_erp, 'linhas_aba', n_aba))
    on conflict (slug) do update set tabela = excluded.tabela, colunas = excluded.colunas, linhas = excluded.linhas,
      carregado_em = excluded.carregado_em, erro = null, resumo = excluded.resumo;
    v_out := v_out || jsonb_build_object(s, jsonb_build_object('erp', n_erp, 'aba', n_aba));
  end loop;
  drop table if exists _dre_src;
  return v_out || jsonb_build_object('meses', to_jsonb(v_meses));
end $$;
revoke all on function public.dre_gerencial_monta() from public;
grant execute on function public.dre_gerencial_monta() to authenticated, service_role;

-- ── 4) conferência ────────────────────────────────────────────────────────
-- select ano, mes, count(*) linhas, max(updated_at) carga, max(arquivo) arquivo from public.dre_gerencial group by 1,2 order by 1,2;
-- select slug, tabela, linhas, carregado_em, resumo from public.consumo_auto_base where slug like 'dre_%';
-- select vigencia, count(*), sum(realizado) from public.ca_dre_frota group by 1 order by 1 desc limit 3;
