import { Plugin } from "@opencode/plugin"

/**
 * Design guard: blocks edits to UI files until the `design-dna` skill has been
 * loaded in the current session. AGENTS.md makes the skill mandatory for design
 * work; this plugin enforces it mechanically.
 */

const DESIGN_SKILL = "design-dna"

const MUTATING_TOOLS = new Set([
  "edit",
  "write",
  "patch",
  "multiedit",
  "apply_patch",
  "edit_file",
  "write_file",
])

// UI surfaces only. Keep logic, API clients, and backend files editable without
// the skill so ordinary bug fixes are not blocked.
const UI_PATTERNS = [
  /(^|\/)frontend\/index\.html$/,
  /(^|\/)frontend\/src\/app\//,
  /(^|\/)frontend\/src\/components\//,
  /(^|\/)frontend\/src\/features\//,
  /(^|\/)frontend\/src\/styles\//,
  /(^|\/)frontend\/src\/index\.css$/,
  /(^|\/)mobile\/app\.json$/,
  /(^|\/)mobile\/assets\//,
  /(^|\/)mobile\/src\/app\//,
  /(^|\/)mobile\/src\/components\//,
  /(^|\/)mobile\/src\/theme\//,
]

function normalize(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase()
}

function isUiPath(value: string) {
  const path = normalize(value)
  return UI_PATTERNS.some((pattern) => pattern.test(path))
}

function collectPaths(input: unknown): string[] {
  if (!input || typeof input !== "object") return []
  const record = input as Record<string, unknown>
  const paths: string[] = []

  for (const key of ["filePath", "file_path", "path", "filename"]) {
    const value = record[key]
    if (typeof value === "string") paths.push(value)
  }

  const files = record.files
  if (Array.isArray(files)) {
    for (const file of files) {
      if (typeof file === "string") paths.push(file)
      else if (file && typeof file === "object") {
        const entry = file as Record<string, unknown>
        for (const key of ["filePath", "file_path", "path"]) {
          const value = entry[key]
          if (typeof value === "string") paths.push(value)
        }
      }
    }
  }

  return paths
}

function skillID(input: unknown) {
  if (!input || typeof input !== "object") return ""
  const record = input as Record<string, unknown>
  const value = record.id ?? record.name ?? record.skillID
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export default Plugin.define({
  id: "lacoqr.design-guard",
  async setup(ctx) {
    // Sessions that loaded design-dna. The skill stays in the session context
    // for its lifetime, so this is intentionally in-memory.
    const approved = new Set<string>()

    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool === "skill") {
        if (skillID(event.input) === DESIGN_SKILL) approved.add(event.sessionID)
        return
      }

      if (!MUTATING_TOOLS.has(event.tool)) return

      const uiPaths = collectPaths(event.input).filter(isUiPath)
      if (uiPaths.length === 0) return
      if (approved.has(event.sessionID)) return

      throw new Error(
        [
          `Blocked by design-guard: UI changes require the "${DESIGN_SKILL}" skill.`,
          `Call the skill tool with id "${DESIGN_SKILL}" first, then retry this edit.`,
          `See AGENTS.md -> Design. Blocked path(s): ${uiPaths.join(", ")}`,
        ].join(" "),
      )
    })
  },
})
