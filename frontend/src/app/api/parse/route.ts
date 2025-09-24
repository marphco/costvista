// src/app/api/parse/route.ts
export const dynamic = "force-dynamic";

type ParseReq = {
  url: string;
  codes?: string[];
};

type BackendOk = {
  count: number;
  rows: Record<string, unknown>[];
};

function isParseReq(x: unknown): x is ParseReq {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as Record<string, unknown>).url === "string" &&
    (Array.isArray((x as Record<string, unknown>).codes) ||
      (x as Record<string, unknown>).codes === undefined)
  );
}

export async function POST(req: Request) {
  const payloadUnknown = await req.json(); // <- no 'any'
  if (!isParseReq(payloadUnknown)) {
    return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400 });
  }
  const body: ParseReq = payloadUnknown;

  const api = process.env.NEXT_PUBLIC_API; // es: https://<railway>.up.railway.app
  if (!api) {
    return new Response(JSON.stringify({ error: "NEXT_PUBLIC_API not set" }), { status: 500 });
  }

  const resp = await fetch(`${api}/api/parse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await resp.text();
  // Inoltra status e body 1:1
  return new Response(text, { status: resp.status, headers: { "content-type": "application/json" } });
}
