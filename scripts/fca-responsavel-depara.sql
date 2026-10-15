-- ============================================================================
-- FCA — responsável retroativo → usuário do portal (Renan, 15/10/2026:
-- "Nomes dos responsáveis pode e devem ser de todos os que estão como usuários.
--  E precisa ser selecionado, não digitado. Pode também ajustar no banco as
--  retroativas depois. Se tiver 2 nomes, tipo Renan/Pedro, ajustar. Utilize
--  unidade e nome para criar o de-para das retroativas.")
--
-- Três passos, nesta ordem:
--   1. PROPOSTA  — monta a tabela fca_resp_depara com um nome proposto por
--                  (unidade, responsável antigo), casando pelo nome e pela unidade.
--   2. CONFERIR  — select da tabela; corrija `novo` à mão onde quiser
--                  (ambíguo/sem correspondência ficam com novo = null).
--   3. APLICAR   — update na tabela fca só onde `novo` está preenchido.
-- Reexecutável: a proposta não sobrescreve `novo` já corrigido à mão.
-- ============================================================================

-- normaliza para comparar: minúsculas, sem acento, espaços simples
create or replace function public._fca_norm(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(lower(translate(coalesce(t,''),
    'áàâãäéêëíìïóòôõöúùüçñÁÀÂÃÄÉÊËÍÌÏÓÒÔÕÖÚÙÜÇÑ',
    'aaaaaeeeiiiooooouuucnAAAAAEEEIIIOOOOOUUUCN')), '\s+', ' ', 'g'))
$$;

create table if not exists public.fca_resp_depara (
  unidade     text not null,
  antigo      text not null,          -- como está na tabela fca
  novo        text,                   -- nome do usuário (fca_profiles.nome); null = não resolvido
  criterio    text,                   -- como foi casado (nome completo · 1º nome + unidade · admin · ambíguo · sem correspondência)
  linhas      int,                    -- quantas linhas da fca têm esse par
  manual      boolean not null default false,   -- true quando você corrigiu `novo` à mão
  primary key (unidade, antigo)
);
-- só o editor SQL (postgres) usa a tabela: RLS ligada e sem policy = anon e logados não enxergam
alter table public.fca_resp_depara enable row level security;

-- ---------------------------------------------------------------------------
-- 1. PROPOSTA
-- ---------------------------------------------------------------------------
with perfis as (
  select nome, is_admin,
         ',' || regexp_replace(coalesce(unidade,''), '\s*,\s*', ',', 'g') || ',' as unis
  from public.fca_profiles
  where coalesce(btrim(nome),'') <> ''
),
alvo as (                      -- pares (unidade, responsável) que ainda não são usuário
  select f.unidade, btrim(f.responsavel) as antigo, count(*) as linhas
  from public.fca f
  where coalesce(btrim(f.responsavel),'') <> ''
    and not exists (select 1 from perfis p where public._fca_norm(p.nome) = public._fca_norm(f.responsavel))
  group by f.unidade, btrim(f.responsavel)
),
tokens as (                    -- "Renan/Pedro", "Ana e Bia", "João, Maria" → um nome por linha, na ordem
  select a.unidade, a.antigo, a.linhas, t.ord, btrim(t.tok) as tok
  from alvo a,
       lateral regexp_split_to_table(a.antigo, '\s*(/|,|;|&|\+|\se\s)\s*') with ordinality as t(tok, ord)
  where btrim(t.tok) <> ''
),
cand as (                      -- cada token contra cada perfil, com uma pontuação
  select t.unidade, t.antigo, t.linhas, t.ord, t.tok, p.nome,
         (case when public._fca_norm(p.nome) = public._fca_norm(t.tok) then 10 else 0 end)
       + (case when split_part(public._fca_norm(p.nome),' ',1) = split_part(public._fca_norm(t.tok),' ',1) then 4 else 0 end)
       + (case when p.unis like '%,' || t.unidade || ',%' then 3
               when p.unis like '%,' || split_part(t.unidade,' ',1) || '%' then 2
               when p.is_admin then 1 else 0 end) as pontos,
         (p.unis like '%,' || t.unidade || ',%') as mesma_uni, p.is_admin
  from tokens t
  join perfis p
    on public._fca_norm(p.nome) = public._fca_norm(t.tok)
    or split_part(public._fca_norm(p.nome),' ',1) = split_part(public._fca_norm(t.tok),' ',1)
),
-- só vale: nome completo igual (qualquer unidade) OU 1º nome igual E (mesma unidade/base ou admin)
validos as (
  select * from cand where pontos >= 10 or pontos >= 5
),
topo as (                      -- o melhor perfil de cada token, e quantos empatam nele
  select v.*, max(pontos) over (partition by unidade, antigo, ord) as maxp from validos v
),
melhor as (
  select unidade, antigo, linhas, ord, tok, nome, pontos,
         row_number() over (partition by unidade, antigo order by ord, nome) as rn,
         count(*) over (partition by unidade, antigo, ord) as empates
  from topo where pontos = maxp
),
proposta as (
  select a.unidade, a.antigo, a.linhas,
         case when m.nome is null then null when m.empates > 1 then null else m.nome end as novo,
         case when m.nome is null then 'sem correspondência'
              when m.empates > 1 then 'ambíguo: ' || (select string_agg(nome, ' | ') from validos v where v.unidade=a.unidade and v.antigo=a.antigo and v.ord=m.ord)
              when m.pontos >= 10 then 'nome completo'
              else '1º nome + unidade' end
         || case when (select count(distinct ord) from tokens t where t.unidade=a.unidade and t.antigo=a.antigo) > 1 then ' · tinha mais de um nome, ficou o 1º que casou' else '' end as criterio
  from alvo a
  left join melhor m on m.unidade = a.unidade and m.antigo = a.antigo and m.rn = 1
)
insert into public.fca_resp_depara (unidade, antigo, novo, criterio, linhas)
select unidade, antigo, novo, criterio, linhas from proposta
on conflict (unidade, antigo) do update
  set novo = case when fca_resp_depara.manual then fca_resp_depara.novo else excluded.novo end,
      criterio = case when fca_resp_depara.manual then fca_resp_depara.criterio else excluded.criterio end,
      linhas = excluded.linhas;

-- ---------------------------------------------------------------------------
-- 2. CONFERIR (e corrigir à mão onde precisar)
-- ---------------------------------------------------------------------------
select unidade, antigo, novo, criterio, linhas, manual
from public.fca_resp_depara
order by (novo is null) desc, unidade, antigo;

-- exemplo de correção manual (o `manual = true` protege de uma nova proposta):
-- update public.fca_resp_depara set novo = 'Pedro Silva', manual = true
--  where unidade = 'PIR' and antigo = 'Renan/Pedro';

-- ---------------------------------------------------------------------------
-- 3. APLICAR (só onde `novo` está preenchido)
-- ---------------------------------------------------------------------------
-- update public.fca f
--    set responsavel = d.novo
--   from public.fca_resp_depara d
--  where d.unidade = f.unidade
--    and btrim(f.responsavel) = d.antigo
--    and d.novo is not null
--    and f.responsavel is distinct from d.novo;
