/**
 * A local reverse proxy to the private staging deployment, for Lighthouse.
 *
 * Why: Lighthouse's `extraHeaders` sends a header with EVERY request the page makes —
 * third-party ones included — so passing the Vercel bypass secret that way would hand it
 * to any third party the page calls (today: Google Fonts). This proxy adds the secret only
 * to requests it forwards to staging. The browser never sees it.
 *
 * Limitation, recorded with every result: browser → proxy is plain HTTP/1.1 on localhost,
 * where real visitors get HTTP/2+ over TLS from Vercel's edge. Responses (compression,
 * caching headers, bytes) are staging's own.
 */

import http from "node:http";
import https from "node:https";

const HOP_BY_HOP = ["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer"];

export function startStagingProxy({ target, secret, port = 8787 }) {
  const upstream = new URL(target);
  const local = `http://127.0.0.1:${port}`;
  const agent = new https.Agent({ keepAlive: true, maxSockets: 16 });

  const server = http.createServer((req, res) => {
    const headers = { ...req.headers, host: upstream.host, "x-vercel-protection-bypass": secret };
    for (const h of HOP_BY_HOP) delete headers[h];

    const up = https.request(
      { hostname: upstream.hostname, port: 443, path: req.url, method: req.method, headers, agent },
      (r) => {
        const out = { ...r.headers };
        for (const h of HOP_BY_HOP) delete out[h];
        if (out.location) out.location = String(out.location).replace(upstream.origin, local);
        delete out["strict-transport-security"];
        res.writeHead(r.statusCode ?? 502, out);
        r.pipe(res);
      },
    );
    up.on("error", (e) => {
      // The upstream can fail after the response has started (a TLS reset mid-body).
      // Headers cannot be sent twice, so just cut the response; Lighthouse sees a failed
      // request rather than the whole run dying with ERR_HTTP_HEADERS_SENT.
      if (res.headersSent) {
        res.destroy(e);
        return;
      }
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`proxy error: ${e.message}`);
    });
    req.pipe(up);
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, origin: local })));
}
