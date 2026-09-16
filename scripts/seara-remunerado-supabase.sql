-- ============================================================
-- Seara · Remuneração por placa — a base que substitui a aba do Sheets
-- (Renan, 16/09/2026: "Quero criar dentro do Hub da Seara uma forma de
--  imputar as planilhas de remuneração")
--
-- Uma linha por UNIDADE × VIGÊNCIA × PLACA, que é exatamente o grão das
-- planilhas `VariavelDeFrete_PorPlaca_<UNIDADE>_MM-AAAA.xlsx`. Subir o mesmo
-- mês de novo CORRIGE em vez de duplicar — é o upsert pela chave.
--
-- POR QUE A PLACA CANÔNICA E A DE ORIGEM CONVIVEM: a `placa` é a chave
-- Mercosul (LLLNLNN) usada para cruzar com as outras bases; a `placa_origem`
-- é como ela veio no arquivo, que é o que aparece na tela. Guardar só uma das
-- duas obrigaria a escolher entre cruzar errado e mostrar errado.
--
-- Rode no SQL Editor do Supabase. REEXECUTÁVEL.
-- ============================================================

create table if not exists public.seara_remunerado (
  unidade      text not null,          -- código do portal (ANG…), do nome do arquivo
  vigencia     text not null,          -- 'AAAA-MM'
  placa        text not null,          -- chave canônica (Mercosul)
  placa_origem text,                   -- como veio no arquivo
  cte          numeric,                -- nº de CT-es do mês (contagem, não viagens)
  km           numeric,                -- O KM REMUNERADO — é a coluna que os painéis usam
  diesel       numeric,
  arla         numeric,
  manutencao   numeric,
  lubrificante numeric,
  pneu         numeric,
  recapagem    numeric,
  lavagem      numeric,
  total        numeric,                -- a soma dos sete componentes variáveis
  arquivo      text,                   -- de qual arquivo esta linha veio
  updated_at   timestamptz not null default now(),
  updated_by   text,
  primary key (unidade, vigencia, placa)
);

-- os painéis filtram por vigência antes de qualquer outra coisa
create index if not exists seara_remunerado_vig_idx
  on public.seara_remunerado (vigencia);

alter table public.seara_remunerado enable row level security;

-- leitura: qualquer usuário logado do portal (é o que os painéis precisam)
drop policy if exists seara_remunerado_select on public.seara_remunerado;
create policy seara_remunerado_select on public.seara_remunerado
  for select to authenticated using (true);

-- escrita: só administradores, como na Conferência de Locação. Se um dia a
-- analista da unidade for subir o arquivo, é esta policy que muda — e aí vale
-- a regra do portal: `fca_has_unit()`, NUNCA `= fca_my_unit()`.
drop policy if exists seara_remunerado_admin on public.seara_remunerado;
create policy seara_remunerado_admin on public.seara_remunerado
  for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

grant select on public.seara_remunerado to authenticated;
grant insert, update, delete on public.seara_remunerado to authenticated;

-- ── confere ───────────────────────────────────────────────────────────────
select unidade, vigencia, count(*) as placas,
       round(sum(km)::numeric)    as km_remunerado,
       round(sum(total)::numeric, 2) as total_variavel,
       max(updated_at)            as ultima_carga
  from public.seara_remunerado
 group by unidade, vigencia
 order by unidade, vigencia;
