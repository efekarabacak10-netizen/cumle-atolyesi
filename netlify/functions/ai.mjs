// Sayfadan gelen istemi Gemini'ye iletir, JSON cevabı sayfaya döndürür.
// API anahtarı sadece burada (ortam değişkeninde) durur, sayfada görünmez.
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let prompt;
  try { ({ prompt } = await req.json()); } catch { return new Response("Bad request", { status: 400 }); }
  if (typeof prompt !== "string" || !prompt || prompt.length > 4000) return new Response("Bad request", { status: 400 });

  const key = Netlify.env.get("GEMINI_API_KEY");
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  if (!key) return new Response("Missing GEMINI_API_KEY", { status: 500 });

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });
  if (!r.ok) return new Response("Upstream error", { status: 502 });

  const d = await r.json();
  const text = d?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  try {
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch {
    return new Response("Bad model output", { status: 502 });
  }
};

export const config = { path: "/api/ai" };
