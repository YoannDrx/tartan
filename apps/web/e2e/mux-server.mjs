// Serveur SDK Mux réservé aux tests locaux. Le navigateur simule l'envoi direct ;
// les vrais handlers et la base testent ensuite les événements signés.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
const uploads = new Map();
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const reply = (status, data) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  if (req.url === "/health") return reply(200, { ok: true });
  if (req.url === "/video/v1/uploads" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const id = randomUUID();
    const data = {
      id,
      url: `https://upload.mux.com/tartan-e2e/${id}`,
      status: "waiting",
      new_asset_settings: body.new_asset_settings,
    };
    uploads.set(id, data);
    return reply(201, { data });
  }
  const id = req.url?.split("/")[4];
  const data = uploads.get(id);
  if (data && req.method === "GET") return reply(200, { data });
  if (data && req.url?.endsWith("/cancel")) {
    data.status = "cancelled";
    return reply(200, { data });
  }
  if (req.method === "DELETE") return reply(200, {});
  reply(404, { error: { type: "not_found", messages: ["Unknown test upload"] } });
}).listen(3103, "127.0.0.1");
