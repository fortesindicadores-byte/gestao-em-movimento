-- ============================================================
-- Viagens por placa (planilha de viagens do Roadshow) — o km REMUNERADO POR PLACA
-- de Rota, AS e Van (Renan, 15/10/2026: "Use essa planilha para subir remunerado
-- por placa Rota, AS e Van. Deixe T1 fora").
--
-- Uma linha por VIGÊNCIA × UNIDADE × PROJETO × PLACA com as viagens do mês:
--   1ª viagem (Extra + Roteriz) · recarga · noturna. Spot, TERCEIROS, MKT e Recolha
--   ficam fora; Pelotas AS conta como Rota. O km NÃO é gravado: a tela calcula
--   viagens × km por viagem da 01-BD (dispersao_km), então a soma das placas bate
--   com o km remunerado da unidade × projeto mesmo se a 01-BD for corrigida depois.
-- `placa` = chave MERCOSUL; `placa_origem` = como veio na planilha (é a que aparece).
-- Subir o arquivo de novo SUBSTITUI os meses que ele traz.
-- Rode no SQL Editor do Supabase. REEXECUTÁVEL.
-- ============================================================

create table if not exists public.dispersao_placa_viagem (
  vigencia      text not null,            -- 'AAAA-MM'
  unidade       text not null,            -- código do portal, sem tier (CBA, MCC…)
  projeto       text not null,            -- Rota · Auto Serviço · Van
  placa         text not null,            -- chave MERCOSUL
  placa_origem  text,
  viagens_prim  numeric not null default 0,
  viagens_rec   numeric not null default 0,
  viagens_not   numeric not null default 0,
  arquivo       text,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  primary key (vigencia, unidade, projeto, placa)
);
create index if not exists dispersao_placa_viagem_placa_idx on public.dispersao_placa_viagem (placa);

alter table public.dispersao_placa_viagem enable row level security;

-- leitura: qualquer usuário logado; escrita: só administradores
drop policy if exists dispersao_placa_viagem_select on public.dispersao_placa_viagem;
create policy dispersao_placa_viagem_select on public.dispersao_placa_viagem for select to authenticated using (true);
drop policy if exists dispersao_placa_viagem_admin on public.dispersao_placa_viagem;
create policy dispersao_placa_viagem_admin on public.dispersao_placa_viagem for all to authenticated
  using (public.fca_is_admin()) with check (public.fca_is_admin());

grant select, insert, update, delete on public.dispersao_placa_viagem to authenticated;

notify pgrst, 'reload schema';

-- ── confere ───────────────────────────────────────────────────────────────
select vigencia, unidade, projeto, count(*) placas, sum(viagens_prim) prim, sum(viagens_rec) rec, sum(viagens_not) noturna
from public.dispersao_placa_viagem group by 1, 2, 3 order by 1, 2, 3;
