-- ============================================================
-- CATÁLOGO DE APLICAÇÃO — o que pedir para cada modelo/placa
--
-- Três camadas (Renan, 17/09/2026: "o usuário filtra uma peça, placa ou
-- modelo e traz sugestões de como ele fará a observação da compra no ERP"):
--
--   cat_item       — a LISTA: o item GENÉRICO do Benner (óleo de motor,
--                    filtro de óleo…) com a NCM. É a lista de 1.191 peças
--                    da Frota, com os alertas das regras da Política/Parecer.
--   cat_aplicacao  — a FICHA: item × modelo × faixa de ano → especificação,
--                    quantidade, intervalo, referência, status da pesquisa e
--                    fonte. É daqui que sai o texto da observação da compra.
--   cat_modelo     — o cadastro (marca | modelo como está no Ginfo), com a
--                    nota de cadastro (ex.: "TOLEDO TM2500 é Paletrans").
--   cat_sinonimo   — busca: "Racor" acha "Filtro separador de água".
--   cat_placa      — exceções por placa (o que difere do modelo). Nasce vazia.
--
-- A placa NÃO mora aqui: o painel lê ginfo_snapshot['ativos'] + ativos_manual
-- e casa placa → (marca, modelo, ano) → cat_aplicacao. Cadastro é um só.
--
-- Leitura para logados; escrita só admin (fca_is_admin()) — a carga usa a
-- service key (workflow Catalogo Carga). Reexecutável.
-- ============================================================

create table if not exists public.cat_item (
  n           integer primary key,          -- nº na LISTA_PEÇAS_FINAL_IMPORTAR
  familia     text not null,
  peca        text not null,
  material    text,                          -- o "de <material>" do nome, separado
  ncm         text,
  alerta      text,                          -- regra da Política/Parecer que pede conferência
  status_ncm  text not null default 'lista'  -- lista · a_confirmar
    check (status_ncm in ('lista','a_confirmar')),
  updated_at  timestamptz not null default now()
);
create index if not exists cat_item_peca_idx on public.cat_item (lower(peca));

create table if not exists public.cat_modelo (
  marca       text not null,
  modelo      text not null,
  tipo        text,
  n_ativos    integer,
  ano_min     integer,
  ano_max     integer,
  motorizado  boolean,
  nota        text,                          -- erro/duplicidade de cadastro achado na pesquisa
  updated_at  timestamptz not null default now(),
  primary key (marca, modelo)
);

create table if not exists public.cat_aplicacao (
  id            bigserial primary key,
  marca         text not null,
  modelo        text not null,
  ano_de        integer,                     -- null = vale para todos os anos
  ano_ate       integer,
  sistema       text not null,
  item          text not null,               -- item GENÉRICO (casa com cat_item pela busca/sinônimo)
  especificacao text,                        -- o que vai na observação da compra
  quantidade    text,
  unidade       text,
  intervalo     text,
  codigo_ref    text,                        -- referência de mercado/original, fora da observação
  status        text not null default 'nao_encontrado'
    check (status in ('confirmado','inferido','nao_encontrado','nao_aplica')),
  fonte         text,
  nota          text,
  rodada        smallint,
  arquivo       text,
  updated_at    timestamptz not null default now()
);
-- uma ficha por modelo × sistema × item × faixa de ano (null conta como "todos")
create unique index if not exists cat_aplicacao_chave_idx
  on public.cat_aplicacao (marca, modelo, sistema, item, coalesce(ano_de, 0), coalesce(ano_ate, 9999));
create index if not exists cat_aplicacao_modelo_idx on public.cat_aplicacao (marca, modelo);
create index if not exists cat_aplicacao_item_idx   on public.cat_aplicacao (lower(item));

create table if not exists public.cat_sinonimo (
  termo       text primary key,              -- como o usuário escreve
  item        text not null,                 -- como o catálogo chama
  updated_at  timestamptz not null default now()
);

create table if not exists public.cat_placa (
  placa         text not null,
  item          text not null,
  especificacao text,
  nota          text,
  updated_by    uuid,
  updated_nome  text,
  updated_at    timestamptz not null default now(),
  primary key (placa, item)
);

-- ---------- RLS ------------------------------------------------------------
alter table public.cat_item      enable row level security;
alter table public.cat_modelo    enable row level security;
alter table public.cat_aplicacao enable row level security;
alter table public.cat_sinonimo  enable row level security;
alter table public.cat_placa     enable row level security;

drop policy if exists cat_item_sel      on public.cat_item;
drop policy if exists cat_modelo_sel    on public.cat_modelo;
drop policy if exists cat_aplicacao_sel on public.cat_aplicacao;
drop policy if exists cat_sinonimo_sel  on public.cat_sinonimo;
drop policy if exists cat_placa_sel     on public.cat_placa;
create policy cat_item_sel      on public.cat_item      for select to authenticated using (true);
create policy cat_modelo_sel    on public.cat_modelo    for select to authenticated using (true);
create policy cat_aplicacao_sel on public.cat_aplicacao for select to authenticated using (true);
create policy cat_sinonimo_sel  on public.cat_sinonimo  for select to authenticated using (true);
create policy cat_placa_sel     on public.cat_placa     for select to authenticated using (true);

-- escrita pela tela: só admin, e só nas tabelas que a tela edita
drop policy if exists cat_aplicacao_adm on public.cat_aplicacao;
drop policy if exists cat_sinonimo_adm  on public.cat_sinonimo;
drop policy if exists cat_placa_adm     on public.cat_placa;
drop policy if exists cat_item_adm      on public.cat_item;
create policy cat_aplicacao_adm on public.cat_aplicacao for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
create policy cat_sinonimo_adm  on public.cat_sinonimo  for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
create policy cat_placa_adm     on public.cat_placa     for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
create policy cat_item_adm      on public.cat_item      for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

comment on table public.cat_aplicacao is
  'Catálogo de aplicação: item genérico × modelo × ano → especificação para a observação da compra. Carga: workflow Catalogo Carga (docs/catalogo/*.json).';

-- conferir depois da carga:
-- select status, count(*) from public.cat_aplicacao group by 1;
-- select count(*) from public.cat_item;  select count(*) from public.cat_modelo;
