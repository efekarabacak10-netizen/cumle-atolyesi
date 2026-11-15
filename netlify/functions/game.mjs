import { getStore } from "@netlify/blobs";
import { fold, makeToken, readToken, hashPass, checkPass } from "../lib/auth.mjs";

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const NICK = /^[A-Za-z0-9_.çğıöşüÇĞİÖŞÜ-]{3,16}$/;
const num = v => Math.max(0, Math.min(1e7, Number(v) || 0));
const sane = s => { if (!s || typeof s !== "object") return null; const t = JSON.stringify(s); return t.length > 150000 ? null : JSON.parse(t); };

export default async (req) => {
  if (req.method !== "POST") return J({ error: "Method not allowed" }, 405);
  const secret = Netlify.env.get("AUTH_SECRET");
  if (!secret) return J({ error: "Sunucu ayarı eksik." }, 500);
  let b;
  try { b = await req.json(); } catch { return J({ error: "Geçersiz istek" }, 400); }
  const store = getStore({ name: "users", consistency: "strong" });
  const key = n => "u:" + encodeURIComponent(fold(n));

  try {
    if (b.action === "register") {
      const nick = String(b.nick || "").trim(), pass = String(b.pass || "");
      if (!NICK.test(nick)) return J({ error: "Takma ad 3-16 karakter olmalı (harf, rakam, _ . -)." }, 400);
      if (pass.length < 4 || pass.length > 64) return J({ error: "Şifre en az 4 karakter olmalı." }, 400);
      const k = key(nick);
      if (await store.get(k, { type: "json" })) return J({ error: "Bu takma ad alınmış, başka birini dene." }, 409);
      const st = sane(b.state);
      await store.setJSON(k, { nick, ...hashPass(pass), state: st, xp: num(st?.xp), st: num(st?.st) });
      return J({ nick, token: makeToken(secret, k) });
    }
    if (b.action === "login") {
      const nick = String(b.nick || "").trim();
      const u = NICK.test(nick) ? await store.get(key(nick), { type: "json" }) : null;
      if (!u || !checkPass(String(b.pass || ""), u.salt, u.hash)) return J({ error: "Takma ad ya da şifre hatalı." }, 401);
      return J({ nick: u.nick, token: makeToken(secret, key(nick)), state: u.state });
    }

    const k = readToken(secret, b.token);
    if (!k) return J({ error: "Oturum süresi doldu, tekrar giriş yap." }, 401);
    const u = await store.get(k, { type: "json" });
    if (!u) return J({ error: "Hesap bulunamadı." }, 401);

    if (b.action === "load") return J({ state: u.state });
    if (b.action === "save") {
      const st = sane(b.state);
      if (!st) return J({ error: "Geçersiz veri" }, 400);
      u.state = st; u.xp = num(st.xp); u.st = num(st.st);
      await store.setJSON(k, u);
      return J({ ok: true });
    }
    if (b.action === "board") {
      const { blobs } = await store.list({ prefix: "u:" });
      const us = await Promise.all(blobs.slice(0, 200).map(x => store.get(x.key, { type: "json" })));
      const board = us.filter(Boolean).map(x => ({ nick: x.nick, xp: x.xp || 0, st: x.st || 0 }))
        .sort((a, c) => c.xp - a.xp).slice(0, 50);
      return J({ board, me: u.nick });
    }
    return J({ error: "Bilinmeyen işlem" }, 400);
  } catch (e) {
    console.error("game error", String(e));
    return J({ error: "Sunucu hatası" }, 500);
  }
};

export const config = { path: "/api/game" };
