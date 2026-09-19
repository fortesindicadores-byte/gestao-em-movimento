-- ============================================================================
--  Saúde do Ecossistema · o PISO da idade do dado
--  Rodar no  Supabase Dashboard → SQL Editor  (complemento do saude-conteudo.sql;
--  é reexecutável e não toca em dado nenhum).
--
--  POR QUE ISSO EXISTE (é um defeito MEU, corrigido):
--  o primeiro desenho deixava `mudou_em` NULO na 1ª coleta de cada base, e a
--  tela dizia "Aguardando coleta" em cinza. Parecia prudente e era pior que o
--  problema original: numa base CONGELADA a impressão nunca muda, então o nulo
--  seria preservado em toda coleta seguinte — a base ficaria em cinza PARA
--  SEMPRE, sem nunca alarmar. Era o mesmo "Em dia eterno" com outra cor.
--
--  O CONSERTO é um PISO que envelhece: na 1ª vez que vemos a base, gravamos
--  `mudou_em = agora` com `mudou_piso = true`. Não sabemos desde quando o dado
--  está parado, mas sabemos que está parado DESDE AGORA — e, como a impressão
--  não muda, essa data fica onde está e envelhece sozinha até virar
--  "Atrasada" e depois "Parada". Quando a impressão finalmente mudar, a data
--  passa a ser EXATA (`mudou_piso = false`).
--
--  A tela mostra a diferença em vez de esconder: "desde 19/09 14:00" e idade
--  com "≥" enquanto for piso; data e idade secas quando for exata.
-- ============================================================================

alter table public.saude_base
  add column if not exists mudou_piso boolean not null default false;

comment on column public.saude_base.mudou_piso is
  'true = mudou_em é um PISO (1ª observação desta base; o dado pode estar parado há mais tempo). false = data exata, medida entre duas impressões diferentes. A tela prefixa a idade com "≥" quando é piso.';

-- ---------- conferência ------------------------------------------------------
-- a coluna nasceu?
select column_name, data_type, column_default, is_nullable
  from information_schema.columns
 where table_name = 'saude_base' and column_name = 'mudou_piso';

-- como está a distribuição hoje (antes da próxima coleta do robô, tudo é false
-- pelo default; depois dela, as bases nunca vistas viram piso)
select mudou_piso,
       count(*)                                   as bases,
       count(mudou_em)                            as com_data,
       min(mudou_em)                              as mais_antiga
  from public.saude_base
 group by mudou_piso
 order by mudou_piso;
