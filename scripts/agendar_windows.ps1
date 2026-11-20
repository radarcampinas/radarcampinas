# Cria (ou recria) a tarefa "Radar Campinas - atualizar dados" no Agendador de Tarefas do Windows.
#
# COMPUTADOR COMO RESERVA do GitHub Actions (que atualiza todo dia às 03:00, horário de Brasília).
# Esta tarefa só atualiza se o site publicado ainda NÃO foi atualizado hoje. Quando ela tenta rodar:
#   - todo dia às 09:00 (horário deste computador; confira se ele está em Brasília) e DEPOIS repete a cada 1 hora até as 21:00;
#   - e também sempre que você entra no Windows (login).
# O script atualizar.py recebe --pular-se-atualizado: se hoje já deu certo, se o servidor pediu para diminuir o ritmo
# ou se já houve 4 tentativas hoje, ele não faz nada. Assim uma atualização interrompida (reinício do Windows Update,
# computador desligado às 03:00) é refeita sozinha quando o computador volta, sem sobrecarregar o servidor da Câmara.
# Aos domingos também faz a parte semanal (atos de suplência e Mesa).
# Não acorda o computador: como reserva, roda quando você estiver usando (09:00 em diante) ou ao entrar no Windows.
# A janela roda escondida, para não ser fechada por engano no meio da atualização.
#
# Uso (PowerShell, na pasta do projeto):   powershell -ExecutionPolicy Bypass -File scripts\agendar_windows.ps1
# Para remover:                             Unregister-ScheduledTask -TaskName "Radar Campinas - atualizar dados" -Confirm:$false

$raiz = (Resolve-Path "$PSScriptRoot\..").Path
$python = (Get-Command python).Source
$nome = "Radar Campinas - atualizar dados"

$cmd = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"Set-Location '$raiz'; `$extra = if ((Get-Date).DayOfWeek -eq 'Sunday') { '--semanal' } else { '' }; & '$python' -I -X utf8 scripts\atualizar.py --publicar --pular-se-atualizado `$extra`""
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $cmd -WorkingDirectory $raiz

# gatilho 1: diário às 09:00, repetindo de hora em hora por 12 horas
$diario = New-ScheduledTaskTrigger -Daily -At 9:00AM
$rep = (New-ScheduledTaskTrigger -Once -At 9:00AM -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 12)).Repetition
$diario.Repetition = $rep
# gatilho 2: ao entrar no Windows
$login = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 6) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger @($diario, $login) -Settings $config -Description "Baixa só o que é novo (devagar), regera o site e publica. Repete se o computador reiniciou." -Force | Out-Null
Write-Host "Tarefa criada: $nome (reserva: 09:00 + a cada hora até 21:00 + ao entrar no Windows; só atualiza se o GitHub ainda não atualizou hoje)."
Write-Host "Para testar agora: Start-ScheduledTask -TaskName '$nome'   (se hoje já foi atualizado, ele só registra 'pulado' no log)"
