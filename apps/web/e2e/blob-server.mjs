// Stockage Vercel Blob réservé aux parcours, comme `mux-server.mjs` pour Mux : le vrai SDK `@vercel/blob` y envoie
// ses requêtes (`VERCEL_BLOB_API_URL`), et les fichiers restent en mémoire. L'adresse rendue a la forme d'une vraie
// adresse publique de Blob ; le parcours sert l'image au navigateur depuis `GET /files/<chemin>`.
import { createServer } from "node:http";

const port = Number(process.env.E2E_BLOB_PORT ?? 3104);
const store = process.env.E2E_BLOB_STORE ?? "tartane2e";
const files = new Map();

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const reply = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/health") return reply(200, { ok: true });
  if (req.method === "PUT" && url.pathname === "/") {
    const pathname = url.searchParams.get("pathname") ?? "";
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const contentType = req.headers["x-content-type"] ?? "application/octet-stream";
    files.set(pathname, { body: Buffer.concat(chunks), contentType });
    const publicUrl = `https://${store}.public.blob.vercel-storage.com/${pathname}`;
    return reply(200, {
      url: publicUrl,
      downloadUrl: `${publicUrl}?download=1`,
      pathname,
      contentType,
      contentDisposition: `inline; filename="${pathname.split("/").pop()}"`,
      etag: `"${files.size}"`,
    });
  }
  if (req.method === "POST" && url.pathname === "/delete") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const { urls = [] } = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    for (const item of urls) files.delete(new URL(item).pathname.slice(1));
    return reply(200, {});
  }
  if (req.method === "GET" && url.pathname.startsWith("/files/")) {
    const file = files.get(decodeURIComponent(url.pathname.slice("/files/".length)));
    if (!file) return reply(404, { error: { code: "not_found" } });
    res.writeHead(200, { "Content-Type": file.contentType, "Cache-Control": "no-store" });
    return res.end(file.body);
  }
  reply(404, { error: { code: "not_found", message: "Unknown test blob route" } });
}).listen(port, "127.0.0.1");
