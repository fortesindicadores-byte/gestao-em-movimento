-- ============================================================
-- Nº do contrato na visão "Placas Contrato" da Carta de Custos
-- (Renan, 15/09/2026: "deve ter o número do contrato também do lado das
--  placas e um filtro de contrato")
--
-- O número JÁ era lido da planilha "Contratos Man." — ele aparece na
-- descrição de cada lançamento da carta_custos ("Contrato A1783K · ref
-- ago/26"). O que faltava era guardá-lo em `contratos_placa`, que é a régua
-- por placa de onde a visão Placas sai, e expô-lo na view de custo.
--
-- REEXECUTÁVEL: a coluna entra por `add column if not exists` e a
-- materializada é recriada do zero (é uma cópia da view, não tem dado próprio).
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Depois disso, o robô
-- "Contratos Man" passa a preencher o número a cada carga.
-- ============================================================

-- 1) a coluna na régua por placa
alter table public.contratos_placa add column if not exists contrato text;

-- 2) a view expõe o número
--    `create or replace view` só aceita coluna NOVA no FIM do select — por
--    isso `c.contrato` é a última, e não ao lado da placa.
create or replace view public.custo_vigencia as
with dens as (
  select vig_km,
         sum(abastecimentos)::numeric / nullif(count(distinct placa), 0) as por_placa
    from public.km_vigencia
   where abastecimentos > 0
   group by vig_km
),
corte as (
  select min(vig_km) as vig0 from dens where por_placa >= 1.5
),
vigs as (
  select distinct k.vig_km,
         to_char(to_date(k.vig_km, 'YYYY-MM') + interval '1 month', 'YYYY-MM') as vig_cobranca
    from public.km_vigencia k, corte
   where k.vig_km >= corte.vig0
)
select v.vig_cobranca, v.vig_km,
       c.placa, c.placa_origem, c.unidade, c.projeto, c.tipo,
       c.taxa_km, c.valor_fixo,
       k.km_vig, k.km_hodometro, k.km_erp, k.divergencia_pct,
       coalesce(k.origem_km, 'sem leitura') as origem_km,
       case when c.tipo = 'fixo' then c.valor_fixo
            else coalesce(k.km_vig, 0) * coalesce(c.taxa_km, 0)
       end                                  as custo_vig,
       k.litros, k.valor_diesel, k.abastecimentos, k.ultimo_abast,
       (v.vig_km = to_char(current_date, 'YYYY-MM')) as previa,
       k.modelo,
       c.contrato
  from vigs v
  cross join public.contratos_placa c
  left join public.km_vigencia k on k.placa = c.placa and k.vig_km = v.vig_km;

-- 3) a materializada é RECRIADA, não alterada
--    Ela foi criada como `select * from custo_vigencia`, e o `*` foi expandido
--    na criação: a coluna nova não aparece nela sozinha. Como não guarda dado
--    próprio (é cópia da view), recriar é seguro — e o cron de refresh continua
--    valendo, porque o nome não muda.
drop materialized view if exists public.custo_vigencia_mv;
create materialized view public.custo_vigencia_mv as
  select * from public.custo_vigencia;
create unique index if not exists custo_vigencia_mv_pk
  on public.custo_vigencia_mv (vig_cobranca, placa);
grant select on public.custo_vigencia_mv to authenticated;

-- confere: deve listar a coluna `contrato` nas duas
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('contratos_placa','custo_vigencia','custo_vigencia_mv')
   and column_name = 'contrato'
 order by table_name;
