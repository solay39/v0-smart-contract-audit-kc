// Loopback-only, memory-only fake used by browser QA. Never connect to production.
import { createServer } from "node:http"

const rows = new Map()
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3116")
  const json = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(JSON.stringify(body))
  }
  if (url.pathname === "/health") return json(200, { qaFixture: true })
  if (url.pathname !== "/rest/v1/audits") return json(404, { error: "QA endpoint not found" })
  if (request.headers.authorization !== "Bearer qa-service-key-not-a-real-credential") {
    return json(401, { error: "QA credentials required" })
  }
  if (request.method === "POST") {
    let text = ""
    for await (const chunk of request) text += chunk
    const row = JSON.parse(text)
    rows.set(row.id, row)
    response.writeHead(201)
    return response.end()
  }
  const id = url.searchParams.get("id")?.replace(/^eq\./, "")
  return json(200, id ? rows.has(id) ? [rows.get(id)] : [] : [...rows.values()])
})
server.listen(3116, "127.0.0.1", () => console.log("Draft QA fake ready on 127.0.0.1:3116"))
