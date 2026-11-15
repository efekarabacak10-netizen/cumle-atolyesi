import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Takma adı karşılaştırma için sadeleştirir: Ali, ALİ, ali aynı sayılır
export const fold = n => n.toLowerCase().replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const sign = (secret, p) => createHmac("sha256", secret).update(p).digest("base64url");

export const makeToken = (secret, k) => {
  const p = Buffer.from(JSON.stringify({ k, e: Date.now() + 30 * 864e5 })).toString("base64url");
  return p + "." + sign(secret, p);
};

export const readToken = (secret, t) => {
  try {
    const [p, s] = String(t || "").split(".");
    const a = Buffer.from(sign(secret, p || "")), b = Buffer.from(s || "");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const d = JSON.parse(Buffer.from(p, "base64url").toString());
    return d.e > Date.now() ? d.k : null;
  } catch { return null; }
};

export const hashPass = (pass, salt = randomBytes(16).toString("hex")) =>
  ({ salt, hash: scryptSync(pass, salt, 32).toString("hex") });

export const checkPass = (pass, salt, hash) => {
  const a = Buffer.from(hashPass(pass, salt).hash, "hex"), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
