-- ============================================================
-- FCA AUTOMÁTICO → FCA OFICIAL (Renan, 15/10/2026: "Agora vamos subir como oficial, de setembro em diante.
-- Anhanguera eu já fiz a reunião com eles, então ainda não considere esse mês o automático").
--
-- As causas, ações e o dono sugeridos pelo /fca-automatico/ passam a ser gravados NA PRÓPRIA tabela `fca`
-- (uma linha por ação, como o FCA já é), não numa tabela paralela. Para o automático reconhecer as linhas
-- que ele mesmo escreveu (e não duplicar nem passar por cima do que a unidade escreveu à mão), a tabela
-- ganha duas colunas:
--   auto_chave  → identidade da ação sugerida (tema + as primeiras palavras da ação, sem números)
--   auto_em     → quando o automático gravou/atualizou a linha
-- Linha sem auto_chave = escrita à mão (FCA · Admin, FCA da unidade ou o fca-preenchimento).
-- Rode no SQL Editor do Supabase. REEXECUTÁVEL.
-- ============================================================

alter table public.fca add column if not exists auto_chave text;
alter table public.fca add column if not exists auto_em    timestamptz;
create index if not exists fca_auto_chave_idx on public.fca (auto_chave) where auto_chave is not null;

notify pgrst, 'reload schema';

-- ── confere ───────────────────────────────────────────────────────────────
select vigencia, unidade, count(*) acoes_automaticas, min(auto_em) primeira, max(auto_em) ultima
from public.fca where auto_chave is not null group by 1, 2 order by 1, 2;
