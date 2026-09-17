-- ============================================================
-- A coluna FAIXA na Carta de Custos
-- (Renan, 17/09/2026: "Deixe só a faixa, sem sinalizar km. Se rodar mais que
--  o usual foi de faixa 1 para 2 e vice versa")
--
-- A tabela ganha UMA coluna: em que faixa do contrato a placa foi cobrada no
-- mês. Sem km de corte — a nota da VW diz em qual faixa o veículo está, não
-- onde ela começa, e eu não vou derivar esse limite para mostrar um número
-- que a fonte não afirma. A direção se lê do próprio par: quem rodou mais que
-- o usual subiu de 1 para 2, quem rodou menos desceu.
--
-- A placa que ATRAVESSA a faixa no mês é cobrada em DUAS linhas na nota, cada
-- uma com o seu preço — por isso a faixa está na chave de `vw_contrato_km`.
-- Aqui as duas viram um rótulo só: `1 → 2`.
--
-- Rode DEPOIS do `contrato-portal.sql`. REEXECUTÁVEL.
-- ============================================================

-- ── 1) o rótulo da faixa, por placa e mês ─────────────────────────────────
-- `create or replace view` só aceita coluna nova no FIM — `faixa` entra depois
-- de `km_anterior`, e a tela é que a coloca no lugar certo.
create or replace view public.vw_contrato_placa_mes as
with dp as (
  select chassi, max(public.placa_key(placa)) as placa
    from public.vw_contrato_km
   where placa is not null and btrim(placa) <> ''
   group by chassi
),
base as (
  select k.vigencia,
         coalesce(nullif(public.placa_key(k.placa), ''), d.placa) as placa,
         k.contrato, k.km_rodado, k.valor, k.km_atual, k.km_anterior,
         nullif(btrim(k.faixa), '') as faixa
    from public.vw_contrato_km k
    left join dp d on d.chassi = k.chassi
)
select vigencia,
       placa,
       max(contrato)      as contrato,
       count(*)           as faixas,
       sum(km_rodado)     as km_rodado,
       sum(valor)         as valor,
       max(km_atual)      as km_atual,
       min(km_anterior)   as km_anterior,
       -- uma faixa = o rótulo; duas = o par, na ordem em que foi cobrado
       case when count(faixa) = 0            then null
            when min(faixa) = max(faixa)     then min(faixa)
            else min(faixa) || ' → ' || max(faixa)
       end                as faixa
  from base
 where placa is not null and placa <> ''
 group by vigencia, placa;

grant select on public.vw_contrato_placa_mes to authenticated;

-- ── 2) a view de custo carrega o rótulo até a tela ────────────────────────
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
),
grade as (
  -- O PORTAL CASA PELA COBRANÇA, o ERP pelo mês em que rodou. São meses
  -- diferentes na mesma linha, e é assim mesmo: a nota de setembro cobra o km
  -- de agosto. Foi o comparador que provou o alinhamento — março e junho
  -- bateram centavo a centavo contra a planilha.
  select v.vig_cobranca, v.vig_km,
         c.placa, c.placa_origem, c.unidade, c.projeto, c.tipo,
         c.taxa_km, c.valor_fixo, c.contrato, c.ultimo_km_informado,
         k.km_vig, k.km_hodometro, k.km_erp, k.divergencia_pct, k.origem_km,
         k.litros, k.valor_diesel, k.abastecimentos, k.ultimo_abast, k.modelo,
         k.hodo_fim,
         w.km_rodado as km_vw, w.valor as valor_vw,
         w.km_atual  as hodo_vw, w.faixas as faixas_vw,
         w.faixa     as faixa_vw
    from vigs v
    cross join public.contratos_placa c
    left join public.km_vigencia k
           on k.placa = c.placa and k.vig_km = v.vig_km
    left join public.vw_contrato_placa_mes w
           on w.placa = c.placa and w.vigencia = v.vig_cobranca
),
-- ARRASTE: mês sem leitura herda a última conhecida. O truque das duas
-- janelas é o jeito do Postgres de fazer `last_value ignore nulls`, que ele
-- não tem: a contagem acumulada só muda quando aparece um valor, então ela
-- numera os blocos, e o `max` dentro do bloco devolve o valor que o abriu.
-- Bloco 0 (nenhuma leitura ainda) fica nulo, que é o certo — placa nova não
-- tem hodômetro anterior para herdar.
g as (
  select grade.*,
         count(hodo_fim) over (partition by placa order by vig_km
                               rows between unbounded preceding and current row) as blk_ab,
         count(hodo_vw)  over (partition by placa order by vig_km
                               rows between unbounded preceding and current row) as blk_ct
    from grade
),
f as (
  select g.*,
         max(hodo_fim) over (partition by placa, blk_ab) as hodo_abast,
         max(hodo_vw)  over (partition by placa, blk_ct) as hodo_ct
    from g
)
select f.vig_cobranca, f.vig_km,
       f.placa, f.placa_origem, f.unidade, f.projeto, f.tipo,
       f.taxa_km, f.valor_fixo,
       f.km_vig, f.km_hodometro, f.km_erp, f.divergencia_pct,
       coalesce(f.origem_km, 'sem leitura') as origem_km,
       case when f.tipo = 'fixo' then f.valor_fixo
            else coalesce(f.km_vig, 0) * coalesce(f.taxa_km, 0)
       end                                  as custo_vig,
       f.litros, f.valor_diesel, f.abastecimentos, f.ultimo_abast,
       (f.vig_km = to_char(current_date, 'YYYY-MM')) as previa,
       f.modelo,
       f.contrato,
       -- as cinco novas
       f.hodo_abast,
       -- o hodômetro do contrato cai no `ultimo_km_informado` da planilha
       -- quando a placa não está no portal (contrato fixo, outro fornecedor,
       -- e janeiro) — senão a coluna nasceria vazia em metade da frota
       coalesce(f.hodo_ct, f.ultimo_km_informado) as hodo_contrato,
       f.km_vw, f.valor_vw, f.faixas_vw,
       -- a coluna nova desta rodada
       f.faixa_vw
  from f;

-- ── 3) a materializada é RECRIADA ─────────────────────────────────────────
-- Ela nasceu como `select *` e o `*` foi expandido na criação: coluna nova não
-- aparece nela sozinha. Não guarda dado próprio — recriar é seguro, e o cron
-- de refresh continua valendo porque o nome não muda.
drop materialized view if exists public.custo_vigencia_mv;
create materialized view public.custo_vigencia_mv as
  select * from public.custo_vigencia;
create unique index if not exists custo_vigencia_mv_pk
  on public.custo_vigencia_mv (vig_cobranca, placa);
grant select on public.custo_vigencia_mv to authenticated;

-- ── confere ───────────────────────────────────────────────────────────────
-- 1) quais rótulos de faixa existem, e quantas placas em cada um por mês
select vig_cobranca, coalesce(faixa_vw, '(sem faixa)') as faixa, count(*) as placas
  from public.custo_vigencia_mv
 where valor_vw is not null
 group by vig_cobranca, faixa
 order by vig_cobranca, faixa;

-- 2) as que ATRAVESSARAM no mês (cobradas em duas faixas), com o km do mês ao
--    lado do km que a placa costuma rodar — é a leitura que o Renan descreveu
with media as (
  select placa, avg(km_vig) as km_medio
    from public.custo_vigencia_mv
   where km_vig is not null
   group by placa
)
select c.vig_cobranca, c.placa_origem, c.contrato, c.faixa_vw,
       c.km_vig, round(m.km_medio) as km_medio_da_placa
  from public.custo_vigencia_mv c
  join media m on m.placa = c.placa
 where c.faixas_vw > 1
 order by c.vig_cobranca desc, c.km_vig desc;
