-- ============================================================
-- Balanço de Massa por CONTA — a base que substitui a aba do Sheets
-- (Renan, 09/10/2026: "Queria subir essa planilha a nível de conta, que já
--  tem o remunerado do balanço de massa. Aí usa o R$/km das contas, e
--  calcula. Sem 85% etc" · "Subir via importação")
--
-- Uma linha por UNIDADE × PROJETO × VIGÊNCIA × CONTA, somada dos lançamentos
-- do export do DRE ("AJUSTES CONTÁBEIS - BALANÇO DE MASSA"). O `valor` é o
-- custo cobrado no balanço, POSITIVO (no DRE o remunerado vem negativo; o
-- crédito do DRE vira valor negativo aqui e abate). `historicos` guarda a
-- abertura por texto do lançamento (BM, RETROATIVO, DESCONTO X PROVISÃO…)
-- para auditoria — o painel não a lê.
--
-- Subir o mesmo export de novo CORRIGE em vez de duplicar: a importação apaga
-- as linhas das (unidade, projeto, vigência) que vêm no arquivo e grava as
-- novas, então uma conta que sumiu do export some do banco também.
--
-- Rode no SQL Editor do Supabase. REEXECUTÁVEL.
-- ============================================================

create table if not exists public.balanco_massa (
  unidade     text not null,            -- código do portal (CBA, MCC, PIR…), do NÍVEL 3
  projeto     text not null,            -- EMPURRADA…, do NÍVEL 3
  vigencia    text not null,            -- 'AAAA-MM' (mês da DATA do lançamento)
  conta       text not null,            -- CONTA GERENCIAL como está no DRE
  nivel3      text,                     -- 'EMPURRADA - CBA', como veio
  valor       numeric not null,         -- Σ(−REMUNERADO) dos lançamentos: custo cobrado, positivo
  linhas      integer not null default 0,
  historicos  jsonb,                    -- { "AJUSTES CONTÁBEIS - BM": -1234.5, ... } (remunerado cru por histórico)
  arquivo     text,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (unidade, projeto, vigencia, conta)
);

create index if not exists balanco_massa_vig_idx on public.balanco_massa (vigencia);

alter table public.balanco_massa enable row level security;

-- leitura: qualquer usuário logado (o Painel KM e a Árvore leem com o login do hub)
drop policy if exists balanco_massa_select on public.balanco_massa;
create policy balanco_massa_select on public.balanco_massa
  for select to authenticated using (true);

-- escrita: só administradores, como na Remuneração por placa da Seara
drop policy if exists balanco_massa_admin on public.balanco_massa;
create policy balanco_massa_admin on public.balanco_massa
  for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

grant select on public.balanco_massa to authenticated;
grant insert, update, delete on public.balanco_massa to authenticated;

-- ── confere ───────────────────────────────────────────────────────────────
select unidade, projeto, vigencia, count(*) as contas,
       round(sum(valor)::numeric, 2) as balanco_rs,
       sum(linhas) as lancamentos,
       max(updated_at) as ultima_carga
  from public.balanco_massa
 group by unidade, projeto, vigencia
 order by unidade, projeto, vigencia;
