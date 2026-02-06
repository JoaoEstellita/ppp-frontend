# Script de instalação do Cursor CLI para Windows PowerShell
# Este script resolve o problema do alias 'curl' no PowerShell

Write-Host "Baixando script de instalação do Cursor CLI..." -ForegroundColor Cyan

# Método 1: Usar curl.exe diretamente (recomendado)
try {
    $scriptContent = curl.exe https://cursor.com/install -fsS 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Script baixado com sucesso!" -ForegroundColor Green
        # Salvar em arquivo temporário
        $tempScript = "$env:TEMP\cursor-install.sh"
        $scriptContent | Out-File -FilePath $tempScript -Encoding UTF8
        
        Write-Host "Executando script de instalação..." -ForegroundColor Cyan
        # Verificar se bash está disponível (WSL ou Git Bash)
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            bash $tempScript
        } else {
            Write-Host "Bash não encontrado. Instalando via npm..." -ForegroundColor Yellow
            # Alternativa: instalar via npm se disponível
            if (Get-Command npm -ErrorAction SilentlyContinue) {
                npm install -g @cursor/cli
            } else {
                Write-Host "Por favor, instale o WSL ou Git Bash para executar o script." -ForegroundColor Red
                Write-Host "Ou instale o Node.js e execute: npm install -g @cursor/cli" -ForegroundColor Yellow
            }
        }
    } else {
        throw "Erro ao baixar script"
    }
} catch {
    Write-Host "Erro ao usar curl.exe, tentando método alternativo..." -ForegroundColor Yellow
    
    # Método 2: Usar Invoke-WebRequest
    try {
        $response = Invoke-WebRequest -Uri https://cursor.com/install -UseBasicParsing
        $scriptContent = $response.Content
        $tempScript = "$env:TEMP\cursor-install.sh"
        $scriptContent | Out-File -FilePath $tempScript -Encoding UTF8
        
        Write-Host "Script baixado com sucesso via Invoke-WebRequest!" -ForegroundColor Green
        
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            bash $tempScript
        } else {
            Write-Host "Bash não encontrado. Por favor, instale o WSL ou Git Bash." -ForegroundColor Red
        }
    } catch {
        Write-Host "Erro ao baixar o script: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Soluções alternativas:" -ForegroundColor Cyan
        Write-Host "1. Instale via npm: npm install -g @cursor/cli" -ForegroundColor Yellow
        Write-Host "2. Baixe manualmente de: https://cursor.com/download" -ForegroundColor Yellow
        Write-Host "3. Use o WSL (Windows Subsystem for Linux)" -ForegroundColor Yellow
    }
}
