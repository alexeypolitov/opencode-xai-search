import { Plugin } from "@opencode/plugin"

// Web search provider backed by xAI's hosted web_search and x_search tools.
// It authenticates with the active xAI subscription sign-in (SuperGrok OAuth), never an API key.
const ENDPOINT = "https://api.x.ai/v1/responses"
const INTEGRATION = "xai"
const TIMEOUT_MS = 90_000
const MAX_SOURCES = 30

const INSTRUCTIONS = [
  "You are the web search backend for a coding agent. Search, then report what you found.",
  "Answer factually and densely: versions, dates, names, numbers, commands, and short quotes where they matter.",
  "Cite every claim inline. Do not add advice, follow-up questions, or filler.",
  "Use as few tool calls as the query needs.",
  "Use X search only when the query is about X posts, a person's statements there, or community reaction; otherwise use web search.",
].join(" ")

type Annotation = { type?: string; url?: string }
type OutputItem = {
  type?: string
  content?: { type?: string; text?: string; annotations?: Annotation[] }[]
}
type Result = { url: string; title?: string; content?: string; time: { published?: number } }

const label = (url: string) => {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === "/" ? "" : parsed.pathname
    return `${parsed.hostname.replace(/^www\./, "")}${path}`
  } catch {
    return url
  }
}

export default Plugin.define({
  id: "xai-search",
  async setup(ctx) {
    const options = ctx.options ?? {}
    const model = typeof options.model === "string" ? options.model : "grok-4.7"
    const effort = typeof options.effort === "string" ? options.effort : "low"
    const maxToolCalls = typeof options.maxToolCalls === "number" ? options.maxToolCalls : 4
    const xSearch = options.xSearch !== false

    await ctx.websearch.transform((editor) => {
      editor.add({
        id: "xai",
        name: "xAI Search",
        execute: async ({ query }: { query: string }, { signal }: { signal?: AbortSignal }): Promise<Result[]> => {
          const connection = await ctx.integration.connection.active(INTEGRATION)
          const credential = connection ? await ctx.integration.connection.resolve(connection) : undefined
          if (credential?.type !== "oauth" || !credential.access) {
            throw new Error("xAI search: no active SuperGrok subscription sign-in; run /connect and sign in to xAI")
          }
          const key = credential.access

          const timeout = AbortSignal.timeout(TIMEOUT_MS)
          const response = await fetch(ENDPOINT, {
            method: "POST",
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              store: false,
              instructions: INSTRUCTIONS,
              input: [{ role: "user", content: query }],
              tools: xSearch ? [{ type: "web_search" }, { type: "x_search" }] : [{ type: "web_search" }],
              max_tool_calls: maxToolCalls,
              reasoning: { effort },
            }),
          })
          if (!response.ok) {
            const detail = (await response.text().catch(() => "")).slice(0, 300)
            throw new Error(`xAI search failed: HTTP ${response.status} ${detail}`)
          }

          const data = (await response.json()) as { output?: OutputItem[] }
          const parts = (data.output ?? [])
            .filter((item) => item.type === "message")
            .flatMap((item) => item.content ?? [])
            .filter((part) => part.type === "output_text" && part.text)
          const answer = parts.map((part) => part.text).join("\n\n").trim()
          if (!answer) throw new Error("xAI search returned no answer text")

          // xAI gives no per-source snippet, so sources are listed as links only, in citation order.
          const sources = new Set<string>()
          for (const part of parts) {
            for (const annotation of part.annotations ?? []) {
              if (annotation.type === "url_citation" && annotation.url) sources.add(annotation.url)
            }
          }

          return [
            {
              url: ENDPOINT,
              title: "Grok answer, synthesized from the sources listed after it",
              content: answer,
              time: {},
            },
            ...[...sources].slice(0, MAX_SOURCES).map((url) => ({ url, title: label(url), time: {} })),
          ]
        },
      })
    })
  },
})
