<#
============================================================
 Carga dos ABASTECIMENTOS do ERP → Supabase (erp_abastecimentos)
 Remontado em 31/10/2026 para rodar num servidor da TI da Conlog, sem
 depender do notebook do Renan. Faz o mesmo que o abastecimentos.ps1 dele:

   1. lê o ERP (SQL Server) com a query da TI: só OS encerradas
      (mf.STATUS = 6), de 2026 em diante, com o posto;
   2. grava em erp_abastecimentos por upsert (chave = ORDEM_SERVICO);
   3. apaga as OS de 2026 que estão no banco e não vieram na carga
      (OS excluída ou reaberta no ERP).

 Precisa só de: Windows com PowerShell 5.1 (já vem no Windows), acesso de
 rede ao SQL Server do ERP e saída HTTPS para lozwipoeacpvplgkrxkq.supabase.co.
 Não precisa de Google Drive, de Claude nem de nada instalado.

 Configuração: abastecimentos.config.json na mesma pasta (modelo em
 erp-abastecimentos.config.exemplo.json). Servidor, usuário e senha do ERP e
 a chave do Supabase moram SÓ nesse arquivo, nunca no repositório.

 Uso:   powershell -NoProfile -ExecutionPolicy Bypass -File abastecimentos.ps1 -Auto
        (-Auto = não espera Enter no fim; é o que a tarefa agendada usa)
        -Ensaio = lê o ERP e mostra os números, sem gravar nada
 Log:   pasta logs\ ao lado do script, um arquivo por dia (30 dias guardados).
 Saída: 0 = ok · 1 = falhou (a tarefa agendada mostra "último resultado 0x1").
============================================================
#>
param(
  [switch]$Auto,
  [switch]$Ensaio,
  [string]$Config = (Join-Path $PSScriptRoot 'abastecimentos.config.json')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co'
$TABELA = 'erp_abastecimentos'
$LOTE   = 1000      # linhas por upsert
$LOTE_DEL = 200     # ordens por DELETE
$MIN_PROPORCAO = 0.8  # carga menor que 80% do que já está no banco não apaga nada

# ── log ───────────────────────────────────────────────────────────────────
$pastaLog = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $pastaLog)) { New-Item -ItemType Directory -Path $pastaLog | Out-Null }
$arqLog = Join-Path $pastaLog ('abastecimentos-' + (Get-Date -Format 'yyyyMMdd') + '.log')
Get-ChildItem $pastaLog -Filter 'abastecimentos-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -ErrorAction SilentlyContinue
function Log([string]$msg) {
  $l = (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + '  ' + $msg
  Write-Host $l
  Add-Content -Path $arqLog -Value $l -Encoding UTF8
}

function Fim([int]$codigo) {
  if (-not $Auto) { Read-Host 'Enter para fechar' | Out-Null }
  exit $codigo
}

# ── a query da TI (igual a scripts/erp-abastecimentos-query.sql) ──────────
$QUERY = @'
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
    os.FORNECEDOR        AS COD_POSTO,
    fo.NOME              AS POSTO,
    fo.CGCCPF            AS CNPJ_POSTO,
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
LEFT JOIN GN_PESSOAS fo
    ON fo.HANDLE = os.FORNECEDOR
WHERE os.EMPRESA = 12
  AND mf.STATUS = 6
  AND mf.DATA >= DATEFROMPARTS(2026,1,1)
ORDER BY rc.CODIGO, os.DATAINICIAL
'@

# coluna da query → coluna do banco
$MAPA = [ordered]@{
  ORDEM_SERVICO='ordem_servico'; CODIGO_FILIAL='codigo_filial'; FILIAL='filial'; MODELO='modelo'
  UNIDADE='unidade_prod'; PROJETO_OS='projeto_os'; PROJETO_VEICULO='projeto_veiculo'
  HODOMETRO='hodometro'; KM_RODADO='km_rodado'; LITROS='litros'; MEDIA_KM_L='media_km_l'; VALOR='valor'
  TIPO_COMBUSTIVEL='tipo_combustivel'; ENCERRADA='encerrada'; STATUS='status_os'
  COD_POSTO='cod_posto'; POSTO='posto'; CNPJ_POSTO='cnpj_posto'
}
$TEXTO = @('ordem_servico','codigo_filial','cod_posto','status_os')   # chaves vão como texto

# placa canônica (Mercosul): LLLNNNN vira LLLNLNN trocando o 5º caractere
# (0=A … 9=J), a mesma regra do resto do portal. A placa crua vai em placa_origem.
function PlacaMercosul([string]$p) {
  $s = ($p.ToUpper() -replace '[^A-Z0-9]', '')
  if ($s -match '^[A-Z]{3}[0-9]{4}$') { return $s.Substring(0,4) + 'ABCDEFGHIJ'[[int][string]$s[4]] + $s.Substring(5) }
  return $s
}

function ValorDe($v, [bool]$texto) {
  if ($v -is [DBNull] -or $null -eq $v) { return $null }
  if ($v -is [string]) { $t = $v.Trim(); if ($t -eq '') { return $null }; return $t }
  if ($texto) {
    if ($v -is [decimal] -or $v -is [double]) { if ($v -eq [math]::Truncate($v)) { return ([decimal]$v).ToString('0') } }
    return [string]$v
  }
  if ($v -is [double] -or $v -is [single]) { if ([double]::IsNaN($v) -or [double]::IsInfinity($v)) { return $null } }
  return $v
}

# ── Supabase ──────────────────────────────────────────────────────────────
function SbHeaders([string]$prefer) {
  $h = @{ apikey = $script:CHAVE; Authorization = 'Bearer ' + $script:CHAVE }
  if ($prefer) { $h['Prefer'] = $prefer }
  return $h
}
function CorpoErro($err) {
  if ($err.ErrorDetails -and $err.ErrorDetails.Message) { return $err.ErrorDetails.Message }
  try {
    $r = $err.Exception.Response
    if ($r) { $sr = New-Object IO.StreamReader($r.GetResponseStream()); return $sr.ReadToEnd() }
  } catch {}
  return $err.Exception.Message
}
function SbEnvia([string]$metodo, [string]$caminho, $corpo, [string]$prefer) {
  $args2 = @{ Method = $metodo; Uri = ($SB_URL + '/rest/v1/' + $caminho); Headers = (SbHeaders $prefer); TimeoutSec = 180; UseBasicParsing = $true }
  if ($null -ne $corpo) {
    $json = ConvertTo-Json -InputObject $corpo -Depth 4 -Compress
    $args2['Body'] = [Text.Encoding]::UTF8.GetBytes($json)
    $args2['ContentType'] = 'application/json; charset=utf-8'
  }
  for ($t = 1; $t -le 4; $t++) {
    try { return Invoke-WebRequest @args2 }
    catch {
      $msg = CorpoErro $_
      $cod = 0; try { $cod = [int]$_.Exception.Response.StatusCode } catch {}
      if ($msg -match 'PGRST204' -or ($cod -ge 400 -and $cod -lt 500 -and $cod -ne 429)) { throw ('HTTP ' + $cod + ': ' + $msg) }
      if ($t -eq 4) { throw ('HTTP ' + $cod + ': ' + $msg) }
      Log ('  tentativa ' + $t + ' falhou (' + $cod + '), tentando de novo…')
      Start-Sleep -Seconds (5 * $t)
    }
  }
}

# ── início ────────────────────────────────────────────────────────────────
try {
  Log ('==== carga dos abastecimentos do ERP' + $(if ($Ensaio) { ' (ENSAIO, não grava)' } else { '' }) + ' ====')
  if (-not (Test-Path $Config)) { throw ('Arquivo de configuração não encontrado: ' + $Config) }
  $cfg = Get-Content $Config -Raw -Encoding UTF8 | ConvertFrom-Json
  $script:CHAVE = [string]$cfg.SupabaseChave
  if (-not $cfg.ErpServidor -or -not $cfg.ErpBanco) { throw 'Preencha ErpServidor e ErpBanco no arquivo de configuração.' }
  if (-not $Ensaio -and $script:CHAVE.Length -lt 30) { throw 'Preencha SupabaseChave (service_role) no arquivo de configuração.' }

  # 1) ERP
  $cs = 'Server=' + $cfg.ErpServidor + ';Database=' + $cfg.ErpBanco + ';Connect Timeout=60;'
  if ($cfg.ErpUsuario) { $cs += 'User ID=' + $cfg.ErpUsuario + ';Password=' + $cfg.ErpSenha + ';' }
  else { $cs += 'Integrated Security=True;' }
  $con = New-Object System.Data.SqlClient.SqlConnection $cs
  $cmd = $con.CreateCommand(); $cmd.CommandText = $QUERY; $cmd.CommandTimeout = 900
  $tab = New-Object System.Data.DataTable
  $con.Open()
  try { (New-Object System.Data.SqlClient.SqlDataAdapter $cmd).Fill($tab) | Out-Null } finally { $con.Close() }
  Log ('ERP: ' + $tab.Rows.Count + ' linha(s) lidas')
  if ($tab.Rows.Count -eq 0) { throw 'O ERP devolveu ZERO linhas — nada é gravado nem apagado (conferir conexão/query).' }

  # 2) linhas no formato do banco
  $agora = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  $linhas = New-Object System.Collections.Generic.List[object]
  $vistas = New-Object 'System.Collections.Generic.HashSet[string]'
  $semPlaca = 0; $repetidas = 0; $dmin = $null; $dmax = $null
  foreach ($r in $tab.Rows) {
    $placaCrua = ValorDe $r['PLACA'] $true
    if (-not $placaCrua) { $semPlaca++; continue }
    $o = [ordered]@{}
    foreach ($k in $MAPA.Keys) { $col = $MAPA[$k]; $o[$col] = ValorDe $r[$k] ($TEXTO -contains $col) }
    if (-not $o['ordem_servico']) { continue }
    if (-not $vistas.Add($o['ordem_servico'])) { $repetidas++; continue }
    $o['placa'] = PlacaMercosul $placaCrua
    $o['placa_origem'] = $placaCrua
    $d = $r['DATA']
    $o['data'] = $(if ($d -is [DateTime]) { $d.ToString('yyyy-MM-dd') } else { $null })
    if ($o['data']) { if (-not $dmin -or $o['data'] -lt $dmin) { $dmin = $o['data'] }; if (-not $dmax -or $o['data'] -gt $dmax) { $dmax = $o['data'] } }
    $o['atualizado_em'] = $agora
    $o['carregado_em'] = $agora
    $linhas.Add($o)
  }
  Log ('linhas para gravar: ' + $linhas.Count + ' · datas ' + $dmin + ' a ' + $dmax + ' · sem placa ' + $semPlaca + ' · OS repetida ' + $repetidas)

  if ($Ensaio) { Log 'ENSAIO: nada gravado.'; Fim 0 }

  # 3) upsert em lotes; coluna que o banco não tem sai e o lote é reenviado
  $semCol = New-Object 'System.Collections.Generic.HashSet[string]'
  $gravadas = 0
  for ($i = 0; $i -lt $linhas.Count; $i += $LOTE) {
    $fim = [math]::Min($i + $LOTE, $linhas.Count) - 1
    $ok = $false
    while (-not $ok) {
      $pacote = New-Object System.Collections.Generic.List[object]
      for ($j = $i; $j -le $fim; $j++) {
        $o = $linhas[$j]
        if ($semCol.Count) { $c = [ordered]@{}; foreach ($k in $o.Keys) { if (-not $semCol.Contains($k)) { $c[$k] = $o[$k] } }; $pacote.Add($c) }
        else { $pacote.Add($o) }
      }
      try {
        SbEnvia 'POST' ($TABELA + '?on_conflict=ordem_servico') $pacote 'resolution=merge-duplicates,return=minimal' | Out-Null
        $ok = $true
      } catch {
        $m = $_.Exception.Message
        if ($m -match "Could not find the (?:'|\\u0027)([a-z_0-9]+)(?:'|\\u0027) column") {
          [void]$semCol.Add($Matches[1]); Log ('  o banco não tem a coluna ' + $Matches[1] + ' — gravando sem ela')
        } else { throw }
      }
    }
    $gravadas += ($fim - $i + 1)
    if ((($i / $LOTE) % 10) -eq 0) { Log ('  gravadas ' + $gravadas + ' de ' + $linhas.Count) }
  }
  Log ('upsert ok: ' + $gravadas + ' linha(s)')

  # 4) OS de 2026 no banco que não vieram na carga → apagar
  $noBanco = New-Object System.Collections.Generic.List[string]
  $off = 0
  while ($true) {
    $resp = SbEnvia 'GET' ($TABELA + '?select=ordem_servico&data=gte.2026-01-01&order=ordem_servico&offset=' + $off + '&limit=1000') $null $null
    $pag = @(ConvertFrom-Json ([Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())))
    foreach ($p in $pag) { $noBanco.Add([string]$p.ordem_servico) }
    if ($pag.Count -lt 1000) { break }
    $off += $pag.Count
  }
  $sobra = @($noBanco | Where-Object { -not $vistas.Contains($_) })
  Log ('no banco (2026): ' + $noBanco.Count + ' · fora da carga: ' + $sobra.Count)
  if ($sobra.Count -gt 0) {
    if ($linhas.Count -lt ($noBanco.Count * $MIN_PROPORCAO)) {
      Log ('ATENÇÃO: a carga (' + $linhas.Count + ') é menor que 80% do banco (' + $noBanco.Count + ') — nada apagado. Conferir o ERP.')
    } else {
      for ($i = 0; $i -lt $sobra.Count; $i += $LOTE_DEL) {
        $parte = $sobra[$i..([math]::Min($i + $LOTE_DEL, $sobra.Count) - 1)]
        $lista = ($parte | ForEach-Object { '"' + $_ + '"' }) -join ','
        SbEnvia 'DELETE' ($TABELA + '?ordem_servico=in.(' + [uri]::EscapeDataString($lista) + ')') $null 'return=minimal' | Out-Null
      }
      Log ('apagadas ' + $sobra.Count + ' OS que saíram do ERP (excluídas ou reabertas)')
    }
  }

  Log '==== fim: OK ===='
  Fim 0
} catch {
  Log ('ERRO: ' + $_.Exception.Message)
  Log '==== fim: FALHOU ===='
  Fim 1
}
