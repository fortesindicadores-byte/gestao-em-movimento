-- ═══════════════════════════════════════════════════════════════════════════
-- Abastecimentos das APIs dos sistemas de abastecimento (Renan, 28/10/2026)
--   Pró-Frotas (postos), Gasola e SUMA (tanque interno) → uma tabela só.
--   Quem grava é o robô scripts/abast-api-robot.mjs (service role).
--   Leitura para quem está logado no portal (painel Postos).
--   CPF e nome do motorista NÃO são gravados.
--   Reexecutável.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.abast_api (
  sistema        text        not null,            -- PROFROTAS · GASOLA · SUMA
  id_origem      text        not null,            -- id do abastecimento no sistema
  item           int         not null default 1,  -- um abastecimento com Diesel e Arla = 2 itens
  data           timestamptz not null,            -- quando abasteceu
  dia            date        not null,            -- o dia em Brasília
  unidade        text,                            -- sigla do portal (CBA, MCC, ANG…)
  unidade_origem text,                            -- como o sistema escreve a unidade
  placa          text,                            -- chave Mercosul (para cruzar)
  placa_origem   text,                            -- como veio
  produto        text,                            -- DIESEL S10 · DIESEL S500 · ARLA 32 · …
  produto_origem text,
  litros         numeric,
  preco          numeric,                         -- R$/L
  valor          numeric,                         -- R$
  posto          text,
  cnpj_posto     text,                            -- só dígitos
  hodometro      numeric,
  valido         boolean     not null default true, -- autorizado (Pró-Frotas) / ativo (SUMA)
  status_origem  text,
  modo           text,                            -- SUMA: AUTOMATICO · MANUAL
  bomba          text,                            -- SUMA
  editado_origem timestamptz,                     -- última edição no sistema, quando ele informa
  coletado_em    timestamptz not null default now(),
  primary key (sistema, id_origem, item)
);
create index if not exists abast_api_dia_idx   on public.abast_api (dia);
create index if not exists abast_api_placa_idx on public.abast_api (placa, dia);

-- uma linha por sistema: o que a última carga trouxe (o painel mostra a hora e o erro)
create table if not exists public.abast_api_base (
  sistema      text primary key,
  carregado_em timestamptz,
  de           date,
  ate          date,
  linhas       int,
  erro         text,
  resumo       jsonb
);

alter table public.abast_api      enable row level security;
alter table public.abast_api_base enable row level security;

drop policy if exists abast_api_le      on public.abast_api;
drop policy if exists abast_api_base_le on public.abast_api_base;
create policy abast_api_le      on public.abast_api      for select to authenticated using (true);
create policy abast_api_base_le on public.abast_api_base for select to authenticated using (true);

grant select on public.abast_api, public.abast_api_base to authenticated;

-- conferência
select sistema, count(*) linhas, min(dia) de, max(dia) ate from public.abast_api group by 1 order by 1;
