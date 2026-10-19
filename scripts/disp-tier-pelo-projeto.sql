-- ============================================================================
-- DISPONIBILIDADE · tier dos eventos de CBA e MCC pelo PROJETO do veículo
-- (Renan, 19/10/2026: "Só MCC e o projeto que separa… filtrei T1 e aparece até Van")
--
-- O app gravava a unidade do evento a partir do FILTRO da tela: com o filtro em
-- MCC T1, uma van do CDI Macacu entrava como MCC T1. O app já foi corrigido (o
-- tier sai do ativo pela placa). Este script acerta os eventos JÁ GRAVADOS:
-- mesma sigla (CBA/MCC), tier trocado pelo que o projeto do ativo diz
-- (disp_unit_cod, a mesma regra da foto diária). Unidade de outra sigla e placa
-- fora da base de ativos não são tocadas. As fotos antigas (indisp_snapshot)
-- também não.
--
-- Rodar o bloco 1 primeiro (só leitura). O 2 corrige.
-- ============================================================================

-- 1) CONFERÊNCIA: eventos com o tier diferente do projeto do veículo
with at as (
  select distinct on (placa) placa, public.disp_unit_cod(filial, projeto) as cod, projeto
    from (select upper(regexp_replace(coalesce(e->>'Placa',''),'[^A-Za-z0-9]','','g')) as placa,
                 upper(trim(coalesce(e->>'Filial','')))  as filial,
                 upper(trim(coalesce(e->>'Projeto',''))) as projeto
            from public.ginfo_snapshot g, jsonb_array_elements(g.data) e
           where g.chave = 'ativos') x
   where placa <> ''
   order by placa
)
select i.unidade as gravada, at.cod as pelo_projeto, at.projeto, i.placa,
       i.data_parada, i.data_retorno
  from public.indisponibilidade i
  join at on at.placa = upper(regexp_replace(i.placa,'[^A-Za-z0-9]','','g'))
 where split_part(i.unidade,' ',1) in ('CBA','MCC')
   and split_part(at.cod,' ',1) = split_part(i.unidade,' ',1)
   and at.cod <> i.unidade
 order by i.data_retorno nulls first, i.unidade, i.placa;

-- 2) CORREÇÃO (sem carimbar "alterado hoje": o gatilho de autoria fica
--    desligado só durante o update, senão a Aderência contaria o dia)
begin;
alter table public.indisponibilidade disable trigger indisp_touch;
with at as (
  select distinct on (placa) placa, public.disp_unit_cod(filial, projeto) as cod
    from (select upper(regexp_replace(coalesce(e->>'Placa',''),'[^A-Za-z0-9]','','g')) as placa,
                 upper(trim(coalesce(e->>'Filial','')))  as filial,
                 upper(trim(coalesce(e->>'Projeto',''))) as projeto
            from public.ginfo_snapshot g, jsonb_array_elements(g.data) e
           where g.chave = 'ativos') x
   where placa <> ''
   order by placa
)
update public.indisponibilidade i
   set unidade = at.cod
  from at
 where at.placa = upper(regexp_replace(i.placa,'[^A-Za-z0-9]','','g'))
   and split_part(i.unidade,' ',1) in ('CBA','MCC')
   and split_part(at.cod,' ',1) = split_part(i.unidade,' ',1)
   and at.cod <> i.unidade;
alter table public.indisponibilidade enable trigger indisp_touch;
commit;
