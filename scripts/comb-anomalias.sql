-- ============================================================
-- Correção de Anomalias de Combustível (Renan, 28/10/2026: "Se tiver erros de
-- abastecimento. Conseguimos ver? … placas com km/l muito errado (não a nível de
-- abastecimento, a nível mês mesmo) Aí lançaríamos o km, litro ou outra coisa?
-- Poderia estar lá no administração com 'Correção de Anomalias de Combustível'")
--
-- comb_anomalia  — o que o robô Consumo Auto (scripts/consumo-auto.mjs) achou de
--                  errado por placa × mês, sobre os números CRUS do ERP. Ele
--                  reescreve a tabela inteira a cada rodada. Escrita só service_role.
-- comb_correcao  — o que o admin lançou na tela /anomalias-combustivel/. Chave =
--                  projeto|AAAA-MM|placa (a mesma da anomalia). status 'corrigido'
--                  troca km/litros/valor da placa-mês no consumo automático (campo
--                  vazio = fica o do ERP); 'correto' só tira da lista.
-- Toda mudança em comb_correcao dispara o Consumo Auto (consumo_auto_dispara, do
-- scripts/consumo-auto.sql), para a correção chegar aos painéis em minutos.
-- Reexecutável.
-- ============================================================

create table if not exists public.comb_anomalia (
  chave        text primary key,
  ym           text not null,
  unidade      text,
  projeto      text,
  placa        text,
  placa_origem text,
  modelo       text,
  tipo         text,
  tipos        text,
  km           numeric,
  litros       numeric,
  valor        numeric,
  kml          numeric,
  ref_kml      numeric,
  ref_fonte    text,
  desvio       numeric,
  impacto_l    numeric,
  preco_ref    numeric,
  impacto_rs   numeric,
  n_abast      int,
  hodo_min     numeric,
  hodo_max     numeric,
  dados_ate    date,
  gerado_em    timestamptz default now()
);
alter table public.comb_anomalia enable row level security;
drop policy if exists comb_anomalia_le on public.comb_anomalia;
create policy comb_anomalia_le on public.comb_anomalia for select to authenticated using (public.fca_is_admin());

create table if not exists public.comb_correcao (
  chave        text primary key,
  ym           text not null,
  projeto      text not null,
  placa        text not null,
  placa_origem text,
  status       text not null default 'corrigido' check (status in ('corrigido','correto')),
  km           numeric,
  litros       numeric,
  valor        numeric,
  km_erp       numeric,
  litros_erp   numeric,
  valor_erp    numeric,
  motivo       text,
  autor        text,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.comb_correcao enable row level security;
drop policy if exists comb_correcao_le on public.comb_correcao;
create policy comb_correcao_le on public.comb_correcao for select to authenticated using (public.fca_is_admin());
drop policy if exists comb_correcao_ins on public.comb_correcao;
create policy comb_correcao_ins on public.comb_correcao for insert to authenticated with check (public.fca_is_admin());
drop policy if exists comb_correcao_upd on public.comb_correcao;
create policy comb_correcao_upd on public.comb_correcao for update to authenticated using (public.fca_is_admin()) with check (public.fca_is_admin());
drop policy if exists comb_correcao_del on public.comb_correcao;
create policy comb_correcao_del on public.comb_correcao for delete to authenticated using (public.fca_is_admin());

create or replace function public.comb_correcao_touch() returns trigger
language plpgsql as $$
begin
  -- remover o usuário zera a autoria (on delete set null): isso não é edição
  if (old.created_by is not null and new.created_by is null) or (old.updated_by is not null and new.updated_by is null) then
    return new;
  end if;
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists comb_correcao_touch on public.comb_correcao;
create trigger comb_correcao_touch before update on public.comb_correcao
  for each row execute function public.comb_correcao_touch();

-- uma rodada do Consumo Auto por comando (salvar, desfazer); falha no disparo não
-- impede a gravação: a correção entra na rodada das 06:00
create or replace function public.comb_correcao_dispara() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.consumo_auto_dispara();
  exception when others then
    raise notice 'Consumo Auto não disparado: %', sqlerrm;
  end;
  return null;
end $$;
drop trigger if exists comb_correcao_dispara on public.comb_correcao;
create trigger comb_correcao_dispara after insert or update or delete on public.comb_correcao
  for each statement execute function public.comb_correcao_dispara();

-- conferência
select (select count(*) from public.comb_anomalia) as anomalias,
       (select count(*) from public.comb_correcao) as correcoes;
