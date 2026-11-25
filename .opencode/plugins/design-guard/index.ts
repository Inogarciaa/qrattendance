import { Plugin } from "@opencode/plugin"

const UI_PATTERNS = [
  // Frontend
  /^frontend\/index\.html$/,
  /^frontend\/src\/app\//,
  /^frontend\/src\/components\//,
  /^frontend\/src\/features\//,
  /^frontend\/src\/styles\//,
  /^frontend\/src\/index\.css$/,
  // Mobile
  /^mobile\/app\.json$/,
  /^mobile\/assets\//,
  /^mobile\/src\/app\//,
  /^mobile\/src\/components\//,
  /^mobile\/src\/theme\//
]

const DESIGN_DNA_SKILL = "design-dna"
const EDIT_TOOLS = new Set(["edit", "write"])

// In-memory session state: sessionID -> { hasDesignDna: boolean, timestamp: number }
const sessionState = new Map<string, { hasDesignDna: boolean; timestamp: number }>()

function isUiPath(path: string): boolean {
  // Normalize Windows backslashes to forward slashes for matching
  const normalized = path.replace(/\\/g, "/")
  return UI_PATTERNS.some((re) => re.test(normalized))
}

function getSessionState(sessionID: string): { hasDesignDna: boolean; timestamp: number } {
  const now = Date.now()
  const state = sessionState.get(sessionID)
  if (state && now - state.timestamp < 30 * 60 * 1000) {
    return state
  }
  return { hasDesignDna: false, timestamp: now }
}

function setDesignDnaLoaded(sessionID: string) {
  sessionState.set(sessionID, { hasDesignDna: true, timestamp: Date.now() })
}

export default Plugin.define({
  id: "design-guard",
  async setup(ctx) {
    // Track when design-dna is loaded via the skill tool
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool === "skill" && event.input?.id === DESIGN_DNA_SKILL) {
        setDesignDnaLoaded(event.sessionID)
      }
    })

    // Block edit/write on UI paths unless design-dna was loaded
    await ctx.tool.hook("execute.before", (event) => {
      if (!EDIT_TOOLS.has(event.tool)) return

      const input = event.input as { path?: string } | undefined
      const path = input?.path
      if (!path || !isUiPath(path)) return

      const state = getSessionState(event.sessionID)
      if (!state.hasDesignDna) {
        throw new Error(
          `UI change blocked: \`${event.tool}\` on "${path}" requires the \`design-dna\` skill. ` +
            `Load it first with the \`skill\` tool: \`skill("design-dna")\`. ` +
            `This enforces using the repo's design tokens and style guidance from \`.agents/skills/design-dna\`.`
        )
      }
    })
  }
})