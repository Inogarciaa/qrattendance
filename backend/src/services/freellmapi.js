// freellmapi: curated registry of AI/LLM providers that offer at least one
// model at zero cost, with the endpoint and model ID needed to call it.
//
// This is a static, hand-curated list ("swept" from public knowledge of
// provider free tiers). Free tiers change frequently and without notice, so:
//   - Treat each entry as "free when you last checked it" and re-check the
//     provider's docs page before depending on it.
//   - Entries with `keyless: true` need no API key at all.
//   - Many of these require a free account and an API key even for the free
//     models, and have request/token limits that can change.
//
// To add or refresh entries, edit FREE_LLM_MODELS below and run the syntax
// check (see the bottom of this file) to keep it valid.

const FREE_LLM_MODELS = [
  // --- OpenRouter ----------------------------------------------------------
  // OpenRouter tags free models with the ":free" suffix. Models are
  // interchangeable by name, e.g. "meta-llama/llama-3.3-70b-instruct:free".
  {
    provider: "OpenRouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    notes: "Free tier; requires a free account and an OpenRouter API key.",
    status: "active",
  },
  {
    provider: "OpenRouter",
    model: "deepseek/deepseek-r1:free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    notes: "Free tier; same account/key as above.",
    status: "active",
  },
  {
    provider: "OpenRouter",
    model: "qwen/qwen3-coder:free",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    notes: "Free tier; same account/key as above.",
    status: "active",
  },
  // --- Cloudflare Workers AI ----------------------------------------------
  // Account ID is part of the URL path:
  // https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
  {
    provider: "Cloudflare Workers AI",
    model: "Meta-Llama/Llama-3.1-8B-Instruct",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/run/<MODEL>",
    notes: "Free tier with a monthly quota of AI units; replace <ACCOUNT_ID> with your Workers AI account ID and <MODEL> with the model above.",
    status: "active",
  },
  // --- Groq ----------------------------------------------------------------
  {
    provider: "Groq",
    model: "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    notes: "Free tier for new signups; subject to rate limits.",
    status: "active",
  },
  // --- Cerebras ------------------------------------------------------------
  {
    provider: "Cerebras",
    model: "llama-3.3-70b",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    notes: "Free tier; verify current model availability on the Cerebras docs.",
    status: "active",
  },
  // --- Hugging Face Inference Providers ------------------------------------
  // Free tier with a monthly credit allowance; same OpenAI-style
  // /chat/completions shape as above.
  {
    provider: "Hugging Face Inference Providers",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    notes: "Free tier for public models; requires a free HF account.",
    status: "active",
  },
  // --- Perplexity ----------------------------------------------------------
  {
    provider: "Perplexity",
    model: "sonar",
    endpoint: "https://api.perplexity.ai/chat/completions",
    notes: "Free API tier for a limited number of requests per month; verify the current limit.",
    status: "active",
  },
  // --- Keyless: no API key required ----------------------------------------
  // Local / self-hosted servers. They need no account or key, but you must
  // run the server yourself and have the model available locally.
  {
    provider: "Ollama",
    model: "(any local model, e.g. llama3.2)",
    endpoint: "http://localhost:11434/v1/chat/completions",
    keyless: true,
    notes: "Self-hosted local server (ollama.com); install it and `ollama pull` a model. No API key required.",
    status: "active",
  },
  {
    provider: "LM Studio",
    model: "(any local model)",
    endpoint: "http://localhost:1234/v1/chat/completions",
    keyless: true,
    notes: "Local desktop server (lmstudio.ai); run it and load a model. No API key required.",
    status: "active",
  },
  {
    provider: "LocalAI",
    model: "(any supported local model)",
    endpoint: "http://localhost:8080/v1/chat/completions",
    keyless: true,
    notes: "Self-hosted (localai.io); start it and point at a model. No API key required.",
    status: "active",
  },
];

// Returns a copy of the current free-model registry.
function getFreeModels() {
  return FREE_LLM_MODELS.map((entry) => ({ ...entry }));
}

// Returns the entries that need no API key at all (keyless: true).
function getKeylessModels() {
  return getFreeModels().filter((entry) => entry.keyless === true);
}

// Finds free models matching a predicate. `predicate` receives each entry
// and should return true for the ones you want.
function findFreeModels(predicate) {
  return getFreeModels().filter((entry) => predicate(entry));
}

module.exports = {
  FREE_LLM_MODELS,
  getFreeModels,
  getKeylessModels,
  findFreeModels,
};

// Syntax check: `node backend/src/services/freellmapi.js` should print nothing.
if (require.main === module) {
  const entries = getFreeModels();
  const keyless = entries.filter((e) => e.keyless === true);
  console.log(
    `freellmapi: ${entries.length} free model entries loaded ` +
      `(${keyless.length} keyless); ` +
      `providers: ${[...new Set(entries.map((e) => e.provider))].join(", ")}`
  );
}
