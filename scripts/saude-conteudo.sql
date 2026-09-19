-- ============================================================================
--  Saúde do Ecossistema · IDADE DO CONTEÚDO, não da leitura
--  Rodar no  Supabase Dashboard → SQL Editor  (uma vez; é reexecutável).
--
--  POR QUE: o painel /saude/ já marcava base "Atrasada"/"Parada", mas pela
--  data da LEITURA. E essa data mente: o sheets-robot reescreve `carregado_em`
--  mesmo quando o md5 da aba é igual, e o gviz-robot dá PATCH no `updated_at`
--  quando o hash não mudou. Resultado: 75 das 99 bases ficariam "Em dia" para
--  sempre, mesmo congeladas — o mesmo engano do "Atualizado" no topo do
--  Gestão à Vista. Apareceu ao desligar o Apps Script da Disponibilidade:
--  aquelas abas param de mudar e nada na tela diria isso.
--
--  O QUE ENTRA:
--   1) saude_base.impressao / saude_base.mudou_em — o robô compara a impressão
--      do conteúdo entre duas coletas e carimba quando ela muda.
--   2) view ginfo_impressao — md5 do jsonb calculado NO POSTGRES. Sem ela, o
--      robô teria de baixar MBs de `data` a cada coleta só para saber se mudou.
--      sh_base e gviz_snapshot já têm a coluna `hash`; o Ginfo não tem.
-- ============================================================================

-- ---------- 1) as duas colunas ----------------------------------------------
alter table public.saude_base
  add column if not exists impressao text,        -- hash/assinatura do conteúdo visto
  add column if not exists mudou_em  timestamptz; -- quando a impressão mudou

comment on column public.saude_base.impressao is
  'Assinatura do conteúdo na última coleta (hash do sh_base/gviz_snapshot, md5 do ginfo, bytes quando não há hash). Serve para separar "foi relida" de "mudou".';
comment on column public.saude_base.mudou_em is
  'Última vez que a impressão mudou = idade real do dado. NULO = primeira coleta, ainda sem referência (não é "em dia").';

-- ---------- 2) impressão dos exports do Ginfo --------------------------------
-- security_invoker = on mantém a RLS da ginfo_snapshot valendo para quem lê a
-- view (sem isso, a view rodaria com os direitos do owner e furaria a regra).
create or replace view public.ginfo_impressao
  with (security_invoker = on) as
select
  chave,
  updated_at,
  md5(data::text)                                                as hash,
  case when jsonb_typeof(data) = 'array'
       then jsonb_array_length(data) end                         as linhas
from public.ginfo_snapshot;

comment on view public.ginfo_impressao is
  'Chave, hash e nº de linhas de cada export do Ginfo, sem trafegar o jsonb inteiro. Lida pelo saude-robot.';

-- a leitura segue a mesma regra da tabela: logado no portal (e a service_role
-- do robô, que passa por cima da RLS)
grant select on public.ginfo_impressao to authenticated;

-- ---------- conferência ------------------------------------------------------
-- as colunas nasceram?
select column_name, data_type
  from information_schema.columns
 where table_name = 'saude_base' and column_name in ('impressao','mudou_em')
 order by column_name;

-- a view responde? (deve trazer uma linha por chave do Ginfo)
select chave, linhas, left(hash, 8) as hash, updated_at
  from public.ginfo_impressao
 order by chave
 limit 10;
