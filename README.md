# Auditoria de PPP - Frontend

Sistema de Auditoria de Perfil Profissiográfico Previdenciário para sindicato.

## Tecnologias

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

## Instalação e Execução

1. Instale as dependências:
```bash
npm install
```

2. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

3. Acesse o aplicativo em [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
ppp-frontend/
├── app/
│   ├── (authenticated)/          # Rotas autenticadas com layout
│   │   ├── layout.tsx            # Layout com Sidebar e Topbar
│   │   └── cases/
│   │       ├── page.tsx          # Lista de casos
│   │       ├── new/
│   │       │   └── page.tsx      # Criar novo caso
│   │       └── [id]/
│   │           └── page.tsx      # Detalhes do caso
│   ├── login/
│   │   └── page.tsx              # Página de login
│   ├── layout.tsx                # Layout raiz
│   ├── page.tsx                  # Redireciona para /login
│   └── globals.css               # Estilos globais Tailwind
├── components/                    # Componentes reutilizáveis
│   ├── Badge.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Sidebar.tsx
│   ├── Table.tsx
│   └── Topbar.tsx
├── lib/
│   ├── caseContext.tsx           # Context para gerenciar casos
│   ├── mockData.ts               # Dados mock em memória
│   └── types.ts                  # Tipos TypeScript
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Funcionalidades

- Login (sem autenticação real)
- Listagem de casos
- Criação de novos casos
- Visualização de detalhes do caso
- Análise do PPP com 5 blocos (5.1 a 5.5)
- Interface responsiva com Tailwind CSS

## Notas

- Os dados são armazenados em memória (não persistem após recarregar a página)
- A funcionalidade de geração de PDF está em desenvolvimento

