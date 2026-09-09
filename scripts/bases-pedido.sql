-- ============================================================
-- sh_pedido — o botão "Atualizar agora" das bases manuais
-- (Renan, 09/09/2026: "Crie um botão no hub no admin para quando eu
-- quiser rodar?").
--
-- A página do hub é HTML público e só carrega a chave publishable do
-- Supabase — não há como guardar nela um token do GitHub para disparar o
-- workflow direto. Então o botão não chama o GitHub: ele GRAVA UM PEDIDO
-- aqui, e o workflow "Sheets Pedido" (varredura de 5 em 5 minutos) pega o
-- pedido, roda o robô de carga e escreve de volta o resultado nesta mesma
-- linha — que é o que o hub fica mostrando enquanto espera.
--
-- Leitura: quem está logado. Escrita do pedido: só admin (fca_is_admin).
-- Mudar o status é privilégio da service_role (o robô) — não há policy de
-- update nem de delete, de propósito: ninguém "conclui" um pedido pela tela.
-- ============================================================

create table if not exists public.sh_pedido (
  id           bigserial   primary key,
  pedido_em    timestamptz not null default now(),
  pedido_por   uuid        default auth.uid(),
  pedido_nome  text,                              -- quem pediu, para o log
  so           text,                              -- prefixo de slug (vazio = todas as bases)
  status       text        not null default 'pendente',
  iniciado_em  timestamptz,
  terminado_em timestamptz,
  run_url      text,                              -- link da execução no GitHub
  resultado    text                               -- o rodapé do log do robô
);

comment on table public.sh_pedido is
  'Pedidos de carga das bases manuais do Sheets — o botão do hub grava aqui e o workflow Sheets Pedido responde.';

do $$ begin
  alter table public.sh_pedido add constraint sh_pedido_status_chk
    check (status in ('pendente','rodando','ok','erro'));
exception when duplicate_object then null; end $$;

create index if not exists sh_pedido_status_idx on public.sh_pedido (status, id);

alter table public.sh_pedido enable row level security;

drop policy if exists sh_pedido_sel on public.sh_pedido;
create policy sh_pedido_sel on public.sh_pedido
  for select to authenticated using (true);

-- só admin pede, e o pedido nasce pendente e no nome de quem está logado
drop policy if exists sh_pedido_ins on public.sh_pedido;
create policy sh_pedido_ins on public.sh_pedido
  for insert to authenticated
  with check (public.fca_is_admin() and status = 'pendente' and pedido_por = auth.uid());

-- ---------- Conferência ----------------------------------------------------
-- select id, pedido_em, pedido_nome, status, terminado_em, resultado
--   from public.sh_pedido order by id desc limit 10;
