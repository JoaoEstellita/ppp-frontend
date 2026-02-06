# Guia de Instalação do Cursor CLI no Windows

## Problema

No PowerShell do Windows, o comando `curl` é um **alias** para `Invoke-WebRequest`, que tem sintaxe diferente do utilitário `curl` tradicional do Unix/Linux. Por isso, o comando:

```powershell
curl https://cursor.com/install -fsS | bash
```

Falha com o erro:
```
Invoke-WebRequest : Não é possível localizar um parâmetro que coincida com o nome de parâmetro 'fsS'.
```

## Soluções

### Solução 1: Usar curl.exe diretamente (Recomendado)

O Windows 10/11 inclui o `curl.exe` nativo. Use o caminho completo ou especifique `.exe`:

```powershell
curl.exe https://cursor.com/install -fsS | bash
```

Ou:

```powershell
C:\Windows\System32\curl.exe https://cursor.com/install -fsS | bash
```

### Solução 2: Usar o script PowerShell fornecido

Execute o script `install-cursor-cli.ps1` que foi criado neste diretório:

```powershell
.\install-cursor-cli.ps1
```

### Solução 3: Remover o alias temporariamente

```powershell
Remove-Item alias:curl -Force
curl https://cursor.com/install -fsS | bash
```

### Solução 4: Usar Invoke-WebRequest (PowerShell nativo)

```powershell
Invoke-WebRequest -Uri https://cursor.com/install -UseBasicParsing -OutFile install.sh
bash install.sh
```

### Solução 5: Instalar via npm (se Node.js estiver instalado)

```powershell
npm install -g @cursor/cli
```

### Solução 6: Usar WSL (Windows Subsystem for Linux)

Se você tiver o WSL instalado:

```powershell
wsl bash -c "curl https://cursor.com/install -fsS | bash"
```

## Verificação da Instalação

Após a instalação, verifique se o Cursor CLI está funcionando:

```powershell
cursor --version
```

Ou teste com:

```powershell
cursor agent chat "Hello"
```

## Notas Importantes

- O script de instalação requer `bash` para ser executado. Se você não tiver bash instalado, você precisará:
  - Instalar o WSL (Windows Subsystem for Linux)
  - Instalar o Git Bash
  - Ou usar a instalação via npm
  
- Se houver problemas de conexão, verifique:
  - Configurações de proxy
  - Firewall
  - Conexão com a internet

## Referências

- [Documentação do Cursor CLI](https://cursor.com/docs/cli/overview)
- [Cursor CLI no GitHub](https://github.com/getcursor/cursor)
