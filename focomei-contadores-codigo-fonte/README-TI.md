# FocoMEI para Contadores

Código-fonte da landing page comercial da FocoMEI voltada para contadores.

## Tecnologia

- React 19
- Next.js 16
- Vinext/Vite
- Node.js 22.13 ou superior

## Instalação

```bash
npm ci
npm run build
```

Para desenvolvimento local:

```bash
npm run dev
```

## Arquivos principais

- `app/page.tsx`: estrutura e conteúdo da página.
- `app/globals.css`: identidade visual e responsividade.
- `package.json`: dependências e comandos do projeto.

## Publicação

Deploy no EasyPanel (domínio `contadores.focomei.com.br`): ver
[`DEPLOY-EASYPANEL.md`](./DEPLOY-EASYPANEL.md).

Build sem Vinext/bash (Node 22):

```bash
npm ci
npm run build:easypanel
npm run start:easypanel
```

O fluxo Vinext (`npm run build`) permanece para Sites/Cloudflare e exige Linux
com GNU `timeout` e ficheiros opcionais (ex. `.openai/hosting.json`).

## CTA

O botão final usa atualmente:

`contato@cfsolucoesempresariais.com.br`

Caso o destino comercial da FocoMEI seja outro e-mail, WhatsApp ou formulário,
altere o link no final de `app/page.tsx` antes da publicação.
