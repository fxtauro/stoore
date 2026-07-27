# Publicar posts na Página do Facebook — servidor MCP próprio

Este pacote monta um pequeno servidor que publica posts (texto + imagem opcional)
diretamente na tua Página do Facebook, sem custo de anúncios e sem depender do
Zapier/Make.

## Passo 1 — Criar a app no Facebook Developers

1. Vai a https://developers.facebook.com/apps e cria uma nova app do tipo
   **"Business"**.
2. Dentro da app, adiciona o produto **"Facebook Login for Business"** ou usa
   diretamente o **Graph API Explorer** (https://developers.facebook.com/tools/explorer/).
3. No Graph API Explorer:
   - Seleciona a tua app no menu.
   - Em "User or Page", escolhe a tua Página.
   - Pede as permissões: `pages_manage_posts`, `pages_read_engagement`.
   - Gera o token — este é um **token de curta duração**, próximo passo troca-o
     por um permanente.

## Passo 2 — Obter um token permanente da Página

Os tokens do Graph API Explorer expiram em 1-2 horas. Para automação precisas
de um token de longa duração (não expira, salvo se mudares a password ou
revogares acesso):

1. Troca o token de utilizador de curta duração por um de longa duração
   (60 dias) usando o endpoint `oauth/access_token` com `grant_type=fb_exchange_token`.
2. Com esse token de utilizador de longa duração, chama
   `GET /me/accounts` — isto devolve o **token da Página**, que não expira
   enquanto o token de utilizador que o gerou estiver válido e fores admin da Página.

(Se preferires, a documentação oficial da Meta tem o passo-a-passo detalhado
em "Access Tokens" → "Page Access Tokens".)

## Passo 3 — Obter o ID da Página

No Graph API Explorer, com a Página selecionada, chama `GET /me` — o `id`
devolvido é o `FB_PAGE_ID`.

## Passo 4 — Deploy no Vercel

1. Cria um repositório novo no GitHub e envia esta pasta para lá
   (`git init`, `git add .`, `git commit`, `git push`).
2. Em https://vercel.com, clica "Add New Project" e importa esse repositório.
3. Antes do deploy (ou depois, em Settings → Environment Variables), define:
   - `FB_PAGE_ID` → o ID da tua Página
   - `FB_PAGE_ACCESS_TOKEN` → o token permanente da Página (Passo 2)
   - `MCP_AUTH_TOKEN` → inventa uma password longa e aleatória só tua
     (protege o teu servidor para que só tu o consigas chamar)
4. Faz deploy. O Vercel dá-te um URL do tipo
   `https://o-teu-projeto.vercel.app`.

## Passo 5 — Ligar como Connector personalizado no Claude

1. Nas definições do Claude, em Connectors, adiciona um **Connector
   personalizado (Custom Connector)**.
2. URL do servidor: `https://o-teu-projeto.vercel.app/api/mcp`
3. Se o Claude pedir um cabeçalho de autenticação, usa:
   `Authorization: Bearer <o mesmo valor de MCP_AUTH_TOKEN>`

## Passo 6 — Testar

Pede ao Claude: "usa a ferramenta publish_facebook_post para publicar 'teste'
na Página" — deve aparecer um post de teste na tua Página. Depois de
confirmares que funciona, podes apagar esse post de teste e avançar para a
Tarefa Agendada no Cowork.

## Notas de segurança

- O `MCP_AUTH_TOKEN` é a única coisa que impede qualquer pessoa com o URL de
  publicar na tua Página — não o partilhes.
- O token da Página nunca passa pelo chat do Claude — fica só no Vercel.
- Se algum dia quiseres revogar o acesso, basta apagar as variáveis de
  ambiente no Vercel ou remover o Connector no Claude.
