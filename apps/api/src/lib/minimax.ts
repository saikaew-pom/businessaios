/**
 * Minimax AI Client
 * OpenAI-compatible chat completion API
 * https://api.minimaxi.chat/v1/text/chatcompletion_v2?GroupId=...
 */

export type MinimaxMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

export type MinimaxRequest = {
  model?: string;
  messages: MinimaxMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
  stream?: boolean;
};

export type MinimaxResponse = {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type MinimaxConfig = {
  apiKey: string;
  groupId: string;
  model?: string;
};

const ENDPOINT = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2';
const DEFAULT_MODEL = 'MiniMax-M3';
const DEFAULT_MAX_TOKENS = 4000;

/**
 * Call Minimax AI chat completion
 */
export async function callMinimax(
  config: MinimaxConfig,
  messages: MinimaxMessage[],
  options: {
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  } = {}
): Promise<{ content: string; reasoning: string; usage: MinimaxResponse['usage'] }> {
  const body: MinimaxRequest = {
    model: config.model || DEFAULT_MODEL,
    messages,
    max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.7,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const url = `${ENDPOINT}?GroupId=${config.groupId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Minimax API error ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as MinimaxResponse & { base_resp?: any };

  if (!data.choices || data.choices.length === 0) {
    const errInfo = data.base_resp ? JSON.stringify(data.base_resp) : 'unknown';
    throw new Error(`Minimax returned no choices: ${errInfo}`);
  }

  const choice = data.choices[0];
  const content = choice.message.content || '';
  const reasoning = choice.message.reasoning_content || '';
  const finishReason = choice.finish_reason;

  // Debug log
  console.log('[Minimax]', {
    finishReason,
    contentLength: content.length,
    reasoningLength: reasoning.length,
    base_resp: data.base_resp,
  });

  return {
    content,
    reasoning,
    usage: data.usage,
  };
}

/**
 * Extract JSON from AI response that may have markdown fences
 * More robust — handles ```json blocks, reasoning, and partial outputs
 */
export function extractJson<T = any>(text: string): T {
  if (!text) throw new Error('Empty response');

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = text;

  // Extract content between ```json and ``` (or ``` and ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
    try {
      return JSON.parse(cleaned);
    } catch {}
  }

  // Remove all ``` markers (in case of malformed fences)
  cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Remove any reasoning-like prefix (e.g., "Here is the JSON: ...")
  // Find the first { or [
  const firstBrace = cleaned.search(/[\[{]/);
  if (firstBrace > 0) {
    cleaned = cleaned.slice(firstBrace);
  }

  // Remove trailing text after last } or ]
  const lastClose = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastClose > 0 && lastClose < cleaned.length - 1) {
    cleaned = cleaned.slice(0, lastClose + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {}

  // Try to find JSON object with regex
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {}
  }

  // Try JSON array
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {}
  }

  throw new Error(`Failed to extract JSON from: ${text.slice(0, 300)}`);
}

/**
 * Extract JSON from reasoning + content combined
 * For reasoning models, the model might "think" in reasoning_content and put the actual answer in content
 * If content is empty, try to extract from reasoning
 */
export function extractJsonFromAny(content: string, reasoning: string): any {
  // Try content first
  if (content) {
    try {
      return extractJson(content);
    } catch {}
  }

  // Fall back to reasoning
  if (reasoning) {
    // Look for JSON in reasoning
    const fenceMatch = reasoning.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {}
    }

    // Find largest { ... } block in reasoning
    const objMatches = reasoning.match(/\{[\s\S]*?\}/g);
    if (objMatches) {
      // Try largest one first
      const sorted = objMatches.sort((a, b) => b.length - a.length);
      for (const m of sorted) {
        try {
          return JSON.parse(m);
        } catch {}
      }
    }

    // Find [ ... ] block
    const arrMatches = reasoning.match(/\[[\s\S]*?\]/g);
    if (arrMatches) {
      const sorted = arrMatches.sort((a, b) => b.length - a.length);
      for (const m of sorted) {
        try {
          return JSON.parse(m);
        } catch {}
      }
    }
  }

  throw new Error('No JSON found in content or reasoning');
}

/**
 * Estimate cost in USD (rough)
 * Minimax pricing varies; this is approximate
 */
export function estimateCost(usage: MinimaxResponse['usage'] | undefined): number {
  if (!usage) return 0;
  // Approximate: $0.001 per 1K input, $0.002 per 1K output
  const inputCost = (usage.prompt_tokens / 1000) * 0.001;
  const outputCost = (usage.completion_tokens / 1000) * 0.002;
  return inputCost + outputCost;
}
