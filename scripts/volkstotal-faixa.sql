-- ============================================================
-- A FAIXA entra na chave, e vira um controle de quem avançou
-- (Renan, 15/09/2026: "Importante ver isso, quando ultrapassa. Até ter um
--  controle que indique que avançou de faixa")
--
-- A 1ª coleta do ano recusou a gravação com "ON CONFLICT DO UPDATE command
-- cannot affect row a second time": o MESMO chassi aparece mais de uma vez no
-- mesmo contrato e mês. Não é duplicata — é o veículo cujo km atravessa a
-- faixa do contrato e passa a ser cobrado em duas linhas, cada uma com o seu
-- preço. Colapsar as linhas destruiria exatamente o que interessa enxergar.
--
-- Então a chave passa a incluir a faixa, e a view `vw_contrato_faixa` responde
-- a pergunta direta: quais placas avançaram, e em que mês.
--
-- REEXECUTÁVEL. Rodar no SQL Editor do Supabase.
-- ============================================================

-- 1) a faixa entra na chave primária
--    (a tabela ainda está vazia, então trocar a PK não perde nada; se um dia
--     tiver dado, a troca continua válida — nenhuma linha some)
alter table public.vw_contrato_km drop constraint if exists vw_contrato_km_pkey;
alter table public.vw_contrato_km
  alter column faixa set default '',
  alter column faixa set not null;
update public.vw_contrato_km set faixa = '' where faixa is null;
alter table public.vw_contrato_km
  add constraint vw_contrato_km_pkey primary key (contrato, vigencia, chassi, faixa);

-- 2) o controle de faixa: uma linha por chassi e mês
--    `faixas` diz em quantas o veículo foi cobrado naquele mês; `avancou` é o
--    mês em que ele passou a ser cobrado em mais de uma — que é o momento que
--    o Renan quer ver. `faixa_max` é a faixa mais alta que ele alcançou.
create or replace view public.vw_contrato_faixa as
with por_mes as (
  select contrato, vigencia, chassi,
         max(placa)                     as placa,
         count(*)                       as faixas,
         min(faixa)                     as faixa_min,
         max(faixa)                     as faixa_max,
         sum(km_rodado)                 as km_rodado,
         sum(valor)                     as valor,
         min(km_anterior)               as km_anterior,
         max(km_atual)                  as km_atual
    from public.vw_contrato_km
   group by contrato, vigencia, chassi
)
select p.*,
       -- avançou NESTE mês: foi cobrado em mais de uma faixa
       (p.faixas > 1)                                   as avancou_no_mes,
       -- e a faixa mais alta subiu em relação ao mês anterior do mesmo veículo
       lag(p.faixa_max) over (partition by p.contrato, p.chassi
                              order by p.vigencia)      as faixa_max_anterior,
       (p.faixa_max is distinct from
        lag(p.faixa_max) over (partition by p.contrato, p.chassi
                               order by p.vigencia))    as mudou_de_faixa
  from por_mes p;

grant select on public.vw_contrato_faixa to authenticated;

-- confere: quantas placas foram cobradas em mais de uma faixa, por mês
select vigencia,
       count(*)                                  as placas,
       count(*) filter (where avancou_no_mes)    as cobradas_em_2_faixas,
       count(*) filter (where mudou_de_faixa
                          and faixa_max_anterior is not null) as mudaram_de_faixa
  from public.vw_contrato_faixa
 group by vigencia
 order by vigencia;
