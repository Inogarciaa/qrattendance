const crypto = require("crypto");

const SECRET = process.env.AUTH_SECRET || "lacoqr-local-dev-secret";
const TTL_SECONDS = 8 * 60 * 60;

const encode = (value) => Buffer.from(value).toString("base64url");

function signature(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function signToken(profile) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(
    JSON.stringify({
      sub: profile.id,
      role: profile.role,
      iat: now,
      exp: now + TTL_SECONDS,
    })
  );
  return {
    access_token: `${payload}.${signature(payload)}`,
    expires_at: now + TTL_SECONDS,
  };
}

function verifyToken(token) {
  if (typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = signature(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = { signToken, verifyToken };
