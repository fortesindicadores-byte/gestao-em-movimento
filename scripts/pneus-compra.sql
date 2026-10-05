-- ============================================================
-- COMPRA DE PNEUS (Renan, 05/10/2026)
-- "A ideia é a unidade fazer os pedidos de pneus, e nós validarmos via
--  corporativo." Desenho do FCA: a unidade lança, o admin aprova.
--
-- pneu_preco   — a tabela de preços por medida (visão Preços, só admin edita)
-- pneu_pedido  — um pedido por linha: unidade · projeto · banda · medida · qtd
--
-- Regras que moram no BANCO (não na tela):
--   * a vigência sai da DATA DO PEDIDO (mês em Brasília), a unidade não escolhe;
--   * quem não é admin não aprova: qtd_aprovada / preco_id / aprovado_* chegam
--     nulos no insert e nenhum update passa sem fca_is_admin();
--   * a unidade só apaga pedido AINDA NÃO AVALIADO, e só da própria unidade.
-- Reexecutável.
-- ============================================================

create table if not exists public.pneu_preco (
  id          bigserial primary key,
  medida      text        not null,
  produto     text        not null,
  codigo      text,
  valor       numeric(12,2) not null default 0 check (valor >= 0),
  ativo       boolean     not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists pneu_preco_medida on public.pneu_preco (medida);

create table if not exists public.pneu_pedido (
  id            bigserial primary key,
  unidade       text    not null,
  projeto       text    not null,
  vigencia      text    not null,              -- 'AAAA-MM', da data do pedido
  banda         text    not null check (banda in ('Tração/Borrachudo','Liso/Direcional','Leve','Empilhadeira')),
  medida        text    not null,
  qtd           integer not null check (qtd > 0),
  qtd_aprovada  integer check (qtd_aprovada >= 0),
  preco_id      bigint  references public.pneu_preco(id) on delete set null,
  criado_por    uuid,
  criado_nome   text,
  created_at    timestamptz not null default now(),
  aprovado_por  uuid,
  aprovado_nome text,
  aprovado_em   timestamptz
);
create index if not exists pneu_pedido_vig on public.pneu_pedido (vigencia, unidade);

-- ── carimbo do insert: vigência, autor e nada de aprovação vinda da unidade ──
create or replace function public.pneu_pedido_ins() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.vigencia   := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  new.created_at := now();
  new.criado_por := auth.uid();
  if not public.fca_is_admin() then
    new.qtd_aprovada := null; new.preco_id := null;
    new.aprovado_por := null; new.aprovado_nome := null; new.aprovado_em := null;
  end if;
  return new;
end $$;
drop trigger if exists pneu_pedido_ins on public.pneu_pedido;
create trigger pneu_pedido_ins before insert on public.pneu_pedido
  for each row execute function public.pneu_pedido_ins();

-- ── carimbo da aprovação: quem e quando, sempre que o admin mexe nela ──
create or replace function public.pneu_pedido_upd() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.vigencia := old.vigencia; new.created_at := old.created_at; new.criado_por := old.criado_por;
  if new.qtd_aprovada is distinct from old.qtd_aprovada or new.preco_id is distinct from old.preco_id then
    new.aprovado_por := auth.uid();
    new.aprovado_em  := case when new.qtd_aprovada is null then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists pneu_pedido_upd on public.pneu_pedido;
create trigger pneu_pedido_upd before update on public.pneu_pedido
  for each row execute function public.pneu_pedido_upd();

-- ── RLS ──
alter table public.pneu_preco  enable row level security;
alter table public.pneu_pedido enable row level security;

drop policy if exists pneu_preco_sel on public.pneu_preco;
create policy pneu_preco_sel on public.pneu_preco for select to authenticated using (true);
drop policy if exists pneu_preco_ins on public.pneu_preco;
create policy pneu_preco_ins on public.pneu_preco for insert to authenticated with check (public.fca_is_admin());
drop policy if exists pneu_preco_upd on public.pneu_preco;
create policy pneu_preco_upd on public.pneu_preco for update to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
drop policy if exists pneu_preco_del on public.pneu_preco;
create policy pneu_preco_del on public.pneu_preco for delete to authenticated using (public.fca_is_admin());

-- unidade com DUAS unidades no perfil tem de enxergar e lançar nas duas:
-- fca_has_unit(), nunca "= fca_my_unit()" (bug real da carta_custos, 24/08/2026)
drop policy if exists pneu_pedido_sel on public.pneu_pedido;
create policy pneu_pedido_sel on public.pneu_pedido for select to authenticated
  using (public.fca_is_admin() or public.fca_has_unit(unidade));
drop policy if exists pneu_pedido_ins on public.pneu_pedido;
create policy pneu_pedido_ins on public.pneu_pedido for insert to authenticated
  with check (public.fca_is_admin() or public.fca_has_unit(unidade));
drop policy if exists pneu_pedido_upd on public.pneu_pedido;
create policy pneu_pedido_upd on public.pneu_pedido for update to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());
drop policy if exists pneu_pedido_del on public.pneu_pedido;
create policy pneu_pedido_del on public.pneu_pedido for delete to authenticated
  using (public.fca_is_admin() or (public.fca_has_unit(unidade) and qtd_aprovada is null));

-- ── preços iniciais: a lista "Código Benner" que o Renan mandou (R$ Un.) ──
-- Só entra o que ainda não existe (pelo produto), então rodar de novo não
-- desfaz o que o admin já editou na tela.
insert into public.pneu_preco (medida, produto, codigo, valor)
select v.medida, v.produto, v.codigo, v.valor
from (values
  ('295',     'BRIDGESTONE M765 295/80R22.5',                             '10110729', 2131.00),
  ('295',     'BRIDGESTONE FS440 295/80R22.5 16M',                        '10016429', 1967.00),
  ('295',     'SPEEDMAX ARO 22.5 EASYMAX S2 295/80R22.5 152/148M 18L',    null,       1610.00),
  ('275',     'BRIDGESTONE FS440 275/80R22.5 16L',                        '10016428', 1825.00),
  ('275',     'SPEEDMAX ARO 22.5 EASYMAX S 275/80R22.5 149/146L 18L',     null,       1450.00),
  ('235',     'BRIDGESTONE M814 235/75R17.5 14M',                         '10017585', 1357.00),
  ('235',     'SPEEDMAX ARO 17.5 SPM01 235/75R17.5 143/141K 18L',         null,        709.00),
  ('225',     'PNEU GOODYEAR G32 CARGO 225/65R16 LISO',                   null,        905.79),
  ('215',     'BRIDGESTONE M814 215/75R17.5 12M',                         '10016543', 1131.00),
  ('205',     'PNEU FIRESTONE CV5000 205/75R16 LISO',                     '37873',     880.55),
  ('205',     'PNEU GOODYEAR CARGO MARATHON 205/75R16 LISO',              null,        701.55),
  ('6.00-9',  'INFINITY 600-9',                                           null,          0.00),
  ('7.00-12', 'INFINITY 700-12',                                          null,          0.00),
  -- média de mercado (05/10/2026, Renan: "coloque os preços de mercado, valor
  -- médio") para as medidas de empilhadeira que a lista do Benner não tinha —
  -- SÓ MACIÇO ("considere só maciço")
  ('5.00-8',  'MÉDIA DE MERCADO · MACIÇO 5.00-8',                          null,        716.08),
  ('8.25-15', 'MÉDIA DE MERCADO · MACIÇO 8.25-15',                         null,       2971.75),
  ('28x9-15', 'MÉDIA DE MERCADO · MACIÇO 28x9-15',                         null,       1860.13),
  ('6.00-9',  'MÉDIA DE MERCADO · MACIÇO 6.00-9',                          null,       1032.64),
  ('7.00-12', 'MÉDIA DE MERCADO · MACIÇO 7.00-12',                         null,       1590.00)
) as v(medida, produto, codigo, valor)
where not exists (select 1 from public.pneu_preco p where p.produto = v.produto);

-- os INFINITY vieram da planilha com R$ 0,00; ativos, eles seriam o "menor
-- preço da medida" e zerariam o valor previsto de 6.00-9 e 7.00-12. Ficam no
-- cadastro, desativados, até alguém pôr o preço deles na visão Preços.
update public.pneu_preco set ativo = false
where produto in ('INFINITY 600-9','INFINITY 700-12') and valor = 0;

notify pgrst, 'reload schema';

-- ---------- Conferência ----------------------------------------------------
-- select medida, produto, codigo, valor from public.pneu_preco order by medida, valor desc;
-- select vigencia, unidade, projeto, banda, medida, qtd, qtd_aprovada from public.pneu_pedido order by id desc limit 20;
