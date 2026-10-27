-- ============================================================
-- Query dos ABASTECIMENTOS no ERP — a TI passou esta consulta ao Renan
-- para ele ler o banco. Versão de 27/10/2026: SÓ OS ENCERRADAS
-- (mf.STATUS = 6, regra da TI) e o banco num servidor novo (o endereço
-- fica só no PowerShell do Renan, fora do repositório).
--
-- Quem roda: o abastecimentos.ps1 do Renan (OneDrive, tarefa
-- "GEM - Abastecimentos 05h"), que grava em erp_abastecimentos e apaga
-- as OS de 2026 que não vieram na carga. Com o filtro de status, OS
-- aberta não entra mais no banco e a que estava lá sai na carga seguinte.
--
-- 'S' AS ENCERRADA: a coluna antiga dizia se a OS estava encerrada, e a
-- Carta de Custos (CartaCalc.lerComb), o Analise Dump e os checks leem
-- encerrada = 'S'. Como o WHERE já traz só encerradas, a coluna fica fixa
-- em 'S' — sem ela o combustível sumiria da Carta.
--
-- DATA >= 2026: a query da TI veio sem data e lia o ERP inteiro (926.804
-- linhas na 1ª rodada, 27/10/2026); os painéis usam só 2026 (63.947 na carga
-- antiga). No servidor novo o histórico todo está com STATUS 6.
-- DATEFROMPARTS em vez de '2026-01-01' para não ter aspas: a query mora numa
-- string do PowerShell.
-- ============================================================

SELECT
    mf.HANDLE            AS ORDEM_SERVICO,
    fi.HANDLE            AS CODIGO_FILIAL,
    fi.NOME              AS FILIAL,
    rc.CODIGO            AS PLACA,
    vm.NOME              AS MODELO,
    rc.UNIDADEPRODUCAO   AS UNIDADE,
    pj.NOME              AS PROJETO_OS,
    pv.NOME              AS PROJETO_VEICULO,
    os.DESGASTEREAL      AS HODOMETRO,
    mf.DESGASTE          AS KM_RODADO,
    mf.QUANTIDADE        AS LITROS,
    mf.MEDIA             AS MEDIA_KM_L,
    mf.VALORTOTAL        AS VALOR,
    pd.NOME              AS TIPO_COMBUSTIVEL,
    'S'                  AS ENCERRADA,
    mf.STATUS            AS STATUS,
    mf.DATA              AS DATA
FROM MF_ORDEMSERVICOCOMBUSTIVEIS mf
INNER JOIN MF_ORDEMSERVICOS os
    ON os.HANDLE = mf.ORDEMSERVICO
LEFT JOIN FILIAIS fi
    ON fi.HANDLE = os.FILIAL
LEFT JOIN MA_RECURSOS rc
    ON rc.HANDLE = os.VEICULO
LEFT JOIN MF_VEICULOMODELOS vm
    ON vm.HANDLE = rc.MODELOVEICULO
LEFT JOIN GN_PROJETOS pj
    ON pj.HANDLE = os.PROJETO
LEFT JOIN GN_PROJETOS pv
    ON pv.HANDLE = rc.PROJETO
LEFT JOIN PD_PRODUTOS pd
    ON pd.HANDLE = mf.PRODUTO
WHERE os.EMPRESA = 12
  AND mf.STATUS = 6
  AND mf.DATA >= DATEFROMPARTS(2026,1,1)
ORDER BY rc.CODIGO, os.DATAINICIAL;
