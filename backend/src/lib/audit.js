const { admin } = require("./supabase");

/**
 * Archive, restore and gatekeeper changes are recorded for accountability.
 * A failed audit write must never break the action itself, so this logs and
 * moves on instead of throwing.
 */
async function writeAudit(actorId, action, entity, entityId, meta = {}) {
  try {
    await admin.from("audit_log").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      meta,
    });
  } catch (err) {
    console.error("[audit] could not write", action, entity, entityId, err.message);
  }
}

module.exports = { writeAudit };
