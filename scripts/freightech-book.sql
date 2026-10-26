-- ============================================================
-- Book do Operador do Freightech no Supabase (Renan, 26/10/2026)
--
-- "No FT tem esse book do operador, que tem todas as regras de tudo. Quero
-- que valide tudo e jogue tudo pro banco de dados. Isso valerá para tudo,
-- inclusive para análises e IA que vamos implementar."
--
-- O robô (scripts/freightech-robot.mjs, modo book) lê a Central de Ajuda do
-- FT pela API (central-ajuda/listar + central-ajuda/<uuid>) e grava:
--   ft_book        — um registro por tópico do Book (título, subtítulo,
--                    categoria, os blocos como vieram em jsonb e o TEXTO
--                    limpo de tudo, para busca e para a IA)
--   ft_book_anexo  — um anexo por linha (planilha, PDF, documento), com o
--                    arquivo em base64, o texto extraído e o sha256
-- Recarregar substitui o registro e os anexos dele (upsert + delete/insert).
-- Leitura só para admin (é regra de remuneração da Ambev); escrita só
-- service_role (robô). Reexecutável.
-- ============================================================

create table if not exists public.ft_book (
  uuid          text primary key,          -- id do FT (central-ajuda/<uuid>)
  titulo        text not null,
  subtitulo     text,
  categoria     text,                      -- 1ª categoria (Gente, Freightech, Geral, Equipamentos, Lucro…)
  categorias    jsonb,                     -- todas, como o FT devolve
  ordem         int,                       -- posição na lista do FT
  blocos        jsonb not null,            -- [{subtitulo, texto (HTML), perfil, anexos:[…]}] como veio
  texto         text not null default '',  -- título + subtítulo + blocos sem HTML (busca, IA)
  n_blocos      int  not null default 0,
  n_anexos      int  not null default 0,
  n_imagens     int  not null default 0,   -- <img> embutidas no HTML dos blocos
  usuario_criou text,
  usuario_atual text,
  criado_em     timestamptz,
  atualizado_em timestamptz,
  cliques       int,
  hash          text,                      -- md5 do JSON do FT: muda = o registro mudou
  coletado_em   timestamptz not null default now()
);
create index if not exists ft_book_categoria on public.ft_book (categoria);
create index if not exists ft_book_texto on public.ft_book using gin (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(subtitulo,'') || ' ' || texto));

create table if not exists public.ft_book_anexo (
  id_storage    text primary key,          -- id no storage do FT (integracao-externa/v1/storage/<id>)
  registro      text not null references public.ft_book(uuid) on delete cascade,
  bloco         int,                       -- índice do bloco do registro
  nome          text,
  tipo          text,                      -- extensão (xlsx, pdf, docx, pptx, png…)
  tamanho       int,
  sha256        text,
  texto         text,                      -- texto extraído (planilha, PDF, docx); null quando não dá
  base64        text,                      -- o arquivo; null acima do teto do robô
  coletado_em   timestamptz not null default now()
);
create index if not exists ft_book_anexo_registro on public.ft_book_anexo (registro);

alter table public.ft_book       enable row level security;
alter table public.ft_book_anexo enable row level security;

drop policy if exists ft_book_le       on public.ft_book;
drop policy if exists ft_book_anexo_le on public.ft_book_anexo;
create policy ft_book_le       on public.ft_book       for select to authenticated using (public.fca_is_admin());
create policy ft_book_anexo_le on public.ft_book_anexo for select to authenticated using (public.fca_is_admin());

grant select on public.ft_book, public.ft_book_anexo to authenticated;

-- conferência
select (select count(*) from public.ft_book) as registros,
       (select count(*) from public.ft_book_anexo) as anexos,
       (select count(distinct categoria) from public.ft_book) as categorias;
