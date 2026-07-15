const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'

export type DeepSeekChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message)
    this.name = 'DeepSeekError'
  }
}

export function getDeepSeekApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) {
    throw new DeepSeekError('DEEPSEEK_API_KEY is not configured', 500)
  }
  return key
}

export function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL
}

/**
 * Call DeepSeek chat completions (OpenAI-compatible API).
 */
export async function deepseekChatCompletion(
  messages: DeepSeekChatMessage[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ content: string; model: string }> {
  const apiKey = getDeepSeekApiKey()
  const model = options?.model || getDeepSeekModel()

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    }),
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body
        ? (body as { error?: { message?: string } }).error?.message
        : null) ||
      `DeepSeek request failed (${response.status})`
    throw new DeepSeekError(message, response.status)
  }

  const content =
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { choices?: unknown }).choices)
      ? (body as { choices: { message?: { content?: string } }[] }).choices[0]
          ?.message?.content
      : null

  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new DeepSeekError('DeepSeek returned an empty response', 502)
  }

  return { content: content.trim(), model }
}
