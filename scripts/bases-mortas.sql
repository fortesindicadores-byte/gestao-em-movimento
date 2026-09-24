-- ============================================================
-- Bases mortas fora do banco (Renan, 24/09/2026: "Pode fazer")
--
-- seara_ctes: cópia crua da aba Base CTEs da Seara (57.679 linhas), sem
--   leitor desde 16/09 (o km remunerado passou para a aba Remunerado; a
--   contagem de viagens sai da agregada sh_seara_ctes_viagens, que FICA).
-- disp_disponibilidade / disp_indisponibilidade: abas do Consolidado Geral
--   congeladas desde o desligamento do Apps Script (19/09); a reserva do
--   Gestão à Vista saiu do farol-core.js na mesma data.
--
-- Reexecutável. Depois de rodar, o Sheets Robot e o Gviz Robot já não as
-- recarregam (saíram das listas em 24/09).
-- ============================================================
begin;

-- 1) as tabelas tipadas
drop table if exists public.sh_seara_ctes;
drop table if exists public.sh_disp_disponibilidade;
drop table if exists public.sh_disp_indisponibilidade;

-- 2) o registro delas no catálogo das bases (é o que o shim e o Saúde leem)
delete from public.sh_base
 where slug in ('seara_ctes', 'disp_disponibilidade', 'disp_indisponibilidade');

-- 3) as fotos cruas do gviz (chave exata, como o robô grava)
delete from public.gviz_snapshot
 where key in (
   '1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE|s=|g=1672208132|q=select B, C, D, J|h=1',
   '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=Disponibilidade|g=|q=|h=',
   '1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=Indisponibilidade|g=|q=|h='
 );

-- 4) o painel de Saúde deixa de vigiar o que não existe mais
delete from public.saude_base
 where chave in ('sh:seara_ctes', 'sh:disp_disponibilidade', 'sh:disp_indisponibilidade')
    or chave like 'gviz:1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE|s=|g=1672208132|q=select B, C, D, J%'
    or chave like 'gviz:1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=Disponibilidade%'
    or chave like 'gviz:1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o|s=Indisponibilidade%';

commit;

-- conferência: as três não podem mais aparecer
select slug from public.sh_base where slug like 'seara_ctes%' or slug like 'disp_%';
select key, length(body) as bytes from public.gviz_snapshot
 where key like '%1672208132%' or key like '%Disponibilidade%';
