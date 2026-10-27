const crypto = require("crypto");
const { admin } = require("../lib/supabase");

async function issueToken(subjectType, subjectId, windowSeconds = 30) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + windowSeconds * 1000).toISOString();

  await admin
    .from("qr_tokens")
    .delete()
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId);

  const { data, error } = await admin
    .from("qr_tokens")
    .insert({
      subject_type: subjectType,
      subject_id: subjectId,
      token,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return { token: data.token, issued_at: data.issued_at, expires_at: data.expires_at, window_seconds: windowSeconds };
}

async function validateToken(token, expected = {}) {
  if (!token) return { ok: false, reason: "missing_token" };

  const { data, error } = await admin
    .from("qr_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, reason: "unknown_token" };
  if (expected.subjectType && data.subject_type !== expected.subjectType) {
    return { ok: false, reason: "wrong_subject_type" };
  }
  if (expected.subjectId && data.subject_id !== expected.subjectId) {
    return { ok: false, reason: "wrong_subject" };
  }
  if (data.consumed_at) return { ok: false, reason: "consumed" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, row: data };
}

async function consumeToken(id) {
  await admin.from("qr_tokens").update({ consumed_at: new Date().toISOString() }).eq("id", id);
}

module.exports = { issueToken, validateToken, consumeToken };
