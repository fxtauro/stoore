// Servidor MCP minimalista para publicar posts orgânicos na Página do Facebook.
// A autenticação é feita através de um segmento secreto no próprio URL
// (ex: /api/mcp/<MCP_AUTH_TOKEN>), para evitar que o Claude tente iniciar
// um fluxo OAuth ao encontrar uma resposta 401.

const GRAPH_VERSION = "v21.0";

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const TOOLS = [
  {
    name: "publish_facebook_post",
    description:
      "Publica um post orgânico (gratuito) na Página do Facebook configurada. Aceita texto e, opcionalmente, uma imagem via URL pública.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Texto do post (incluindo hashtags)."
        },
        image_url: {
          type: "string",
          description:
            "URL pública de uma imagem para acompanhar o post. Opcional — se omitido, publica só texto."
        }
      },
      required: ["message"]
    }
  }
];

async function publishFacebookPost({ message, image_url }) {
  const pageId = process.env.FB_PAGE_ID;
  const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageToken) {
    throw new Error(
      "Faltam variáveis de ambiente FB_PAGE_ID e/ou FB_PAGE_ACCESS_TOKEN no Vercel."
    );
  }

  let url;
  const params = new URLSearchParams();
  params.set("access_token", pageToken);

  if (image_url) {
    url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`;
    params.set("url", image_url);
    params.set("caption", message);
    params.set("published", "true");
  } else {
    url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
    params.set("message", message);
  }

  const resp = await fetch(url, { method: "POST", body: params });
  const data = await resp.json();

  if (!resp.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Erro da Graph API: ${errMsg}`);
  }

  return data; // contém { id: "..." } do post criado
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Autenticação via segmento secreto no URL: /api/mcp/<MCP_AUTH_TOKEN>
  const expectedSecret = process.env.MCP_AUTH_TOKEN;
  const providedSecret = req.query.secret;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    // 404 propositado (não 401) para não parecer um endpoint OAuth-protegido
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json(jsonRpcError(null, -32700, "JSON inválido"));
      return;
    }
  }

  const { id, method, params } = body || {};

  try {
    if (method === "initialize") {
      res.status(200).json(
        jsonRpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "fb-page-publisher", version: "1.1.0" }
        })
      );
      return;
    }

    if (method === "notifications/initialized") {
      res.status(202).end();
      return;
    }

    if (method === "tools/list") {
      res.status(200).json(jsonRpcResult(id, { tools: TOOLS }));
      return;
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params || {};

      if (name !== "publish_facebook_post") {
        res
          .status(200)
          .json(jsonRpcError(id, -32602, `Ferramenta desconhecida: ${name}`));
        return;
      }

      const result = await publishFacebookPost(args || {});
      res.status(200).json(
        jsonRpcResult(id, {
          content: [
            {
              type: "text",
              text: `Post publicado com sucesso. ID: ${result.id || result.post_id}`
            }
          ]
        })
      );
      return;
    }

    res.status(200).json(jsonRpcError(id, -32601, `Método desconhecido: ${method}`));
  } catch (err) {
    res.status(200).json(jsonRpcError(id, -32000, err.message));
  }
};
