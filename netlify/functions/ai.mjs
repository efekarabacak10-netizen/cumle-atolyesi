import { readToken } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Netlify.env.get("AUTH_SECRET");
  if (!secret || !readToken(secret, req.headers.get("x-auth"))) return new Response("Unauthorized", { status: 401 });

  let prompt;
  try { ({ prompt } = await req.json()); } catch { return new Response("Bad request", { status: 400 }); }
  if (typeof prompt !== "string" || !prompt || prompt.length > 4000) return new Response("Bad request", { status: 400 });

  const key = Netlify.env.get("GEMINI_API_KEY");
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!key) return new Response("Missing GEMINI_API_KEY", { status: 500 });

  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    console.error("Gemini request failed", String(e));
    return new Response("Gemini request failed: " + String(e), { status: 504 });
  }
  if (!r.ok) {
    const body = (await r.text()).slice(0, 600);
    console.error("Gemini error", r.status, body);
    return new Response("Gemini " + r.status + " (model " + model + "): " + body, { status: 502 });
  }
  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  try {
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch {
    console.error("Bad model output", text.slice(0, 300));
    return new Response("Bad model output: " + text.slice(0, 300), { status: 502 });
  }
};

export const config = { path: "/api/ai" };
