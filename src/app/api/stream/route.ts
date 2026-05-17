import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const upstream = "http://127.0.0.1:8081/mjpeg";

  try {
    const res = await fetch(upstream, {
      headers: { Connection: "keep-alive" },
      // @ts-ignore — Node fetch supports duplex
      duplex: "half",
    } as RequestInit);

    if (!res.ok || !res.body) {
      return new Response("Stream unavailable", { status: 502 });
    }

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-cache, no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Cannot reach MJPEG server", { status: 502 });
  }
}
