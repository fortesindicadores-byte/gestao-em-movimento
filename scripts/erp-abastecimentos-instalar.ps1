<#
 Instala a tarefa agendada "GEM - Abastecimentos 05h" (todo dia às 05:00,
 horário do servidor), que roda o abastecimentos.ps1 desta pasta com -Auto.
 Rodar UMA vez, como administrador, na pasta onde estão os arquivos:

   powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarefa.ps1

 Sem parâmetro a tarefa roda como SYSTEM (serve quando o config usa usuário
 e senha do SQL Server). Se o acesso ao ERP for pela conta do Windows
 (ErpUsuario vazio), passe a conta de serviço que enxerga o banco:

   ... -File instalar-tarefa.ps1 -Conta 'DOMINIO\usuario'
#>
param([string]$Conta = '', [string]$Hora = '05:00')
$ErrorActionPreference = 'Stop'
$pasta  = $PSScriptRoot
$script = Join-Path $pasta 'abastecimentos.ps1'
if (-not (Test-Path $script)) { throw "abastecimentos.ps1 não está em $pasta" }
if (-not (Test-Path (Join-Path $pasta 'abastecimentos.config.json'))) { throw 'Falta o abastecimentos.config.json nesta pasta.' }

$nome  = 'GEM - Abastecimentos 05h'
$acao  = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $pasta `
         -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -Auto')
$gat   = New-ScheduledTaskTrigger -Daily -At $Hora
$cfg   = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
         -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)

if ($Conta) {
  $cred = Get-Credential -UserName $Conta -Message 'Senha da conta que vai rodar a tarefa'
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gat -Settings $cfg `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest -Force | Out-Null
} else {
  $quem = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gat -Settings $cfg -Principal $quem -Force | Out-Null
}
Write-Host "Tarefa '$nome' criada: todo dia às $Hora."
Write-Host 'Para testar agora:  Start-ScheduledTask -TaskName "GEM - Abastecimentos 05h"'
Write-Host 'O resultado fica em logs\ nesta pasta.'
