-- Acerto da numeração do FCA de set/26 (16/10/2026): GRL, CBA T1 WH e PIR · Manutenções.
-- Só mexe nas linhas listadas pelo id. Rodar uma vez.
begin;

-- GRL: "1. 2Motor…" era uma causa nova → vira a causa 2, e o Contrato passa a 3
update public.fca set causa = regexp_replace(causa, '^\s*1\.\s*2\s*', '2. ')
 where id in ('06345e1f-201c-4b32-a12f-a3d79cded24f', '3cdc40f7-9ad8-458e-9bab-fdfc1a5850f2');
update public.fca set acao = regexp_replace(acao, '^\s*1\.2\.\s*', '2.1. ') where id = '3cdc40f7-9ad8-458e-9bab-fdfc1a5850f2';
update public.fca set acao = regexp_replace(acao, '^\s*1\.3\.\s*', '2.2. ') where id = '06345e1f-201c-4b32-a12f-a3d79cded24f';
update public.fca set causa = regexp_replace(causa, '^\s*2\.\s*', '3. '),
                      acao  = regexp_replace(acao,  '^\s*2\.(\d+)\.\s*', '3.\1. ')
 where id in ('1e9f358d-702f-45e5-95b8-9f32d2c3de82', 'c48b2f69-286d-404f-910d-f4ab8c4d6d6d');

-- CBA T1 WH: as 4 ações são da mesma causa 1, com o texto em duas versões → fica o texto alterado por último;
-- e a 2ª ação "1.2." (Garantir…) vira 1.4
update public.fca f set causa = u.causa
  from (select causa from public.fca
         where id in ('0fd4ba60-543c-4082-8311-a9fd4b43a9b6','3be95951-1f95-4faa-a6c3-0f3f8e74423d','920f0e45-bee4-4f3b-b60b-6198b1c01b13','d5d38ac9-8653-490d-8194-4acdbb3bd5da')
         order by updated_at desc nulls last limit 1) u
 where f.id in ('0fd4ba60-543c-4082-8311-a9fd4b43a9b6','3be95951-1f95-4faa-a6c3-0f3f8e74423d','920f0e45-bee4-4f3b-b60b-6198b1c01b13','d5d38ac9-8653-490d-8194-4acdbb3bd5da');
update public.fca set acao = regexp_replace(acao, '^\s*1\.2\.\s*', '1.4. ') where id = '0fd4ba60-543c-4082-8311-a9fd4b43a9b6';

-- PIR: as causas começavam no 2 → 1, 2, 3
update public.fca set causa = regexp_replace(causa, '^\s*(\d+)\.\s*', ((substring(causa from '^\s*(\d+)\.'))::int - 1)::text || '. '),
                      acao  = regexp_replace(acao,  '^\s*(\d+)\.(\d+)\.\s*', ((substring(acao from '^\s*(\d+)\.'))::int - 1)::text || '.\2. ')
 where id in ('7aea0078-beca-49c5-8b60-8e20d67c34ca','3e5e917b-d5bb-43e7-9432-a19639a8275e','f693a2e5-ef99-4425-a686-4054d72c0419','cb609694-251a-48c3-811c-e7f738187ef1');

-- conferência: as linhas como ficaram
select unidade, left(causa, 45) as causa, left(acao, 40) as acao from public.fca
 where id in ('06345e1f-201c-4b32-a12f-a3d79cded24f','3cdc40f7-9ad8-458e-9bab-fdfc1a5850f2','8f43f74a-1235-4d62-93cc-324de5803c1b','1e9f358d-702f-45e5-95b8-9f32d2c3de82','c48b2f69-286d-404f-910d-f4ab8c4d6d6d',
              '0fd4ba60-543c-4082-8311-a9fd4b43a9b6','3be95951-1f95-4faa-a6c3-0f3f8e74423d','920f0e45-bee4-4f3b-b60b-6198b1c01b13','d5d38ac9-8653-490d-8194-4acdbb3bd5da',
              '7aea0078-beca-49c5-8b60-8e20d67c34ca','3e5e917b-d5bb-43e7-9432-a19639a8275e','f693a2e5-ef99-4425-a686-4054d72c0419','cb609694-251a-48c3-811c-e7f738187ef1')
 order by unidade, causa, acao;
commit;
