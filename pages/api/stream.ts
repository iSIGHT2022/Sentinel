import type { NextApiRequest, NextApiResponse } from "next";
import http from "http";

export const config = { api: { externalResolver: true } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const upstream = http.get("http://127.0.0.1:8081/mjpeg", (mjpeg) => {
    res.setHeader("Content-Type", "multipart/x-mixed-replace; boundary=frame");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.writeHead(200);
    mjpeg.pipe(res);
    req.on("close", () => { upstream.destroy(); mjpeg.destroy(); });
  });
  upstream.on("error", () => res.status(502).end("Stream unavailable"));
}
