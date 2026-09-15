-- ============================================================
-- O CONTRATO PASSA A VIR DO PORTAL DA VW, e a Carta ganha os dois hodômetros
--
-- Renan, 15/09/2026:
--   · "Aqui adicione o último hodômetro e o último hodômetro do abastecimento.
--      Lembrando que que é mensal, então quando vira o mês considera o último
--      do mês que passou"
--   · "E pode subir já o contrato do site, à partir de fevereiro"
--
-- São dois hodômetros DIFERENTES, e é da distância entre eles que sai o
-- controle: o do CONTRATO é a leitura que a VW usou para fechar a nota; o do
-- ABASTECIMENTO é a maior leitura que o ERP viu no mês. Quando um anda e o
-- outro não, o veículo está rodando sem ser declarado (ou o contrário).
--
-- A REGRA DO MÊS QUE VIRA: os dois são ARRASTADOS. Mês que não teve leitura
-- fica com a última conhecida antes dele, em vez de vazio — que é o que
-- acontece todo dia 1º, quando o mês novo ainda não tem abastecimento nem
-- nota. Vazio ali não significa "não rodou", significa "ainda não mediram".
--
-- FEVEREIRO É ONDE O PORTAL COMEÇA: janeiro/2026 não existe no portal da VW
-- (2025 inteiro existe, e fevereiro também — não é janela de tempo nem início
-- de contrato, a causa é desconhecida). Por isso o portal vale de 2026-02 em
-- diante e janeiro continua saindo da planilha, sem buraco na Carta.
--
-- REEXECUTÁVEL. Rodar no SQL Editor do Supabase.
-- ============================================================

-- ── 1) a chave de placa, a MESMA do robô ──────────────────────────────────
-- Placa antiga LLLNNNN vira Mercosul LLLNLNN (o 5º caractere, dígito, vira
-- letra: 0=A … 9=J). É só para CRUZAR as bases — cada tela continua mostrando
-- a placa como ela veio da origem. Sem isso o portal e o contrato não se
-- encontram nas placas que ainda estão no formato antigo em um dos lados.
create or replace function public.placa_key(p text)
returns text language sql immutable as $$
  select case when s ~ '^[A-Z]{3}[0-9]{4}$'
              then substr(s, 1, 4)
                   || substr('ABCDEFGHIJ', substr(s, 5, 1)::int + 1, 1)
                   || substr(s, 6)
              else s end
    from (select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))) t(s);
$$;

-- ── 2) o portal, uma linha por placa e mês ────────────────────────────────
-- A FAIXA está na chave de `vw_contrato_km` porque o veículo que atravessa a
-- faixa é cobrado DUAS vezes no mesmo mês, cada uma com o seu preço. Aqui as
-- duas somam (é uma nota só), e `faixas` guarda quantas foram — é o que diz
-- que ele atravessou.
--
-- O PORTAL NEM SEMPRE PREENCHE A PLACA: em alguns meses vem só o chassi. O
-- de-para sai do próprio portal, que preenche a placa daquele chassi em outro
-- mês — sem isso a mesma linha ficava órfã e a placa aparecia sem contrato.
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
         k.contrato, k.km_rodado, k.valor, k.km_atual, k.km_anterior
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
       min(km_anterior)   as km_anterior
  from base
 where placa is not null and placa <> ''
 group by vigencia, placa;

grant select on public.vw_contrato_placa_mes to authenticated;

-- ── 3) a view de custo ganha as colunas novas ─────────────────────────────
-- `create or replace view` só aceita coluna NOVA no FIM do select — por isso
-- as cinco entram depois de `contrato`, e não ao lado do que elas explicam.
-- A tela é que as coloca no lugar certo.
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
         w.km_atual  as hodo_vw, w.faixas as faixas_vw
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
       f.km_vw, f.valor_vw, f.faixas_vw
  from f;

-- ── 4) a materializada é RECRIADA ─────────────────────────────────────────
-- Ela nasceu como `select * from custo_vigencia` e o `*` foi expandido na
-- criação: coluna nova não aparece nela sozinha. Não guarda dado próprio, é
-- cópia da view — recriar é seguro, e o cron de refresh continua valendo
-- porque o nome não muda.
drop materialized view if exists public.custo_vigencia_mv;
create materialized view public.custo_vigencia_mv as
  select * from public.custo_vigencia;
create unique index if not exists custo_vigencia_mv_pk
  on public.custo_vigencia_mv (vig_cobranca, placa);
grant select on public.custo_vigencia_mv to authenticated;

-- ── confere ───────────────────────────────────────────────────────────────
-- 1) o portal chegou na view: quantas placas por vigência têm valor da VW
select vig_cobranca,
       count(*)                                        as placas,
       count(valor_vw)                                 as com_portal,
       count(*) filter (where faixas_vw > 1)           as atravessaram_faixa,
       round(sum(valor_vw)::numeric, 2)                as valor_portal,
       count(hodo_abast)                               as com_hodo_abast,
       count(hodo_contrato)                            as com_hodo_contrato
  from public.custo_vigencia_mv
 group by vig_cobranca
 order by vig_cobranca;

-- 2) os dois hodômetros lado a lado na vigência mais recente, do maior
--    descolamento para o menor — é a leitura que o controle existe para dar
select vig_cobranca, placa_origem, contrato,
       hodo_contrato, hodo_abast,
       (hodo_abast - hodo_contrato) as diferenca
  from public.custo_vigencia_mv
 where vig_cobranca = (select max(vig_cobranca) from public.custo_vigencia_mv)
   and hodo_abast is not null and hodo_contrato is not null
 order by abs(hodo_abast - hodo_contrato) desc
 limit 20;
