# Cria a tarefa "Radar Campinas - atualizar dados" no Agendador de Tarefas do Windows.
# Roda todo dia às 03:00 (horário deste computador; confira se ele está em Brasília) e, aos domingos, faz também a parte semanal.
# Se o computador estiver desligado às 03:00, a tarefa roda assim que ele ligar (StartWhenAvailable).
#
# Uso (PowerShell, na pasta do projeto):   powershell -ExecutionPolicy Bypass -File scripts\agendar_windows.ps1
# Para remover:                             Unregister-ScheduledTask -TaskName "Radar Campinas - atualizar dados" -Confirm:$false

$raiz = (Resolve-Path "$PSScriptRoot\..").Path
$python = (Get-Command python).Source
$nome = "Radar Campinas - atualizar dados"

$cmd = "-NoProfile -ExecutionPolicy Bypass -Command `"Set-Location '$raiz'; `$extra = if ((Get-Date).DayOfWeek -eq 'Sunday') { '--semanal' } else { '' }; & '$python' -I -X utf8 scripts\atualizar.py --publicar `$extra`""
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $cmd -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -Daily -At 3:00AM
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 6) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Description "Baixa só o que é novo (devagar) e regera o site." -Force | Out-Null
Write-Host "Tarefa criada: $nome (todo dia às 03:00). Para testar agora: Start-ScheduledTask -TaskName '$nome'"
