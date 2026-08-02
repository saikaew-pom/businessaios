import type { Bindings } from '../types';
import { getModelById, normalizeModel } from './catalog';
import { getAssetRow } from './assets';

export type ReferenceInput = {
  asset_id: string;
  mention_name: string;
  reference_role?: string;
  influence_level?: string;
  sort_order?: number;
};

export function parsePromptMentions(prompt: string) {
  const mentions = new Set<string>();
  const regex = /(^|[^\w])@([A-Za-z0-9_-]{1,64})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) mentions.add(match[2]);
  return Array.from(mentions);
}

export async function validateReferencesForModel(
  env: Pick<Bindings, 'DB'>,
  userId: string,
  input: {
    model_id: string;
    prompt: string;
    references?: ReferenceInput[];
  },
) {
  const model = await getModelById(env, input.model_id);
  const normalized = model ? normalizeModel(model) : null;
  if (!model || !normalized) return { ok: false as const, status: 404, error: 'model_not_found' };

  const references = [...(input.references || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const capabilities = normalized.capabilities as { references?: { min?: number; max?: number; roles?: string[]; providerTypes?: string[] } };
  const min = capabilities.references?.min ?? 0;
  const max = capabilities.references?.max ?? 0;
  if (references.length < min || references.length > max) {
    return { ok: false as const, status: 400, error: 'reference_count_not_supported' };
  }

  const mentionNames = new Set<string>();
  for (const reference of references) {
    const mentionName = normalizeMentionName(reference.mention_name);
    if (!mentionName) return { ok: false as const, status: 400, error: 'invalid_mention_name' };
    if (mentionNames.has(mentionName)) return { ok: false as const, status: 400, error: 'duplicate_mention_name' };
    mentionNames.add(mentionName);

    const role = reference.reference_role || 'subject';
    if (capabilities.references?.roles?.length && !capabilities.references.roles.includes(role)) {
      return { ok: false as const, status: 400, error: 'reference_role_not_supported' };
    }
    const asset = await getAssetRow(env, userId, reference.asset_id);
    if (!asset || asset.lifecycle_status !== 'active') {
      return { ok: false as const, status: 404, error: 'reference_asset_not_found' };
    }
  }

  const promptMentions = parsePromptMentions(input.prompt);
  const unresolved = promptMentions.filter((mention) => !mentionNames.has(mention));
  if (unresolved.length) {
    return { ok: false as const, status: 400, error: 'unresolved_prompt_mentions', unresolved_mentions: unresolved };
  }

  return {
    ok: true as const,
    resolved: {
      model_id: model.id,
      operation: model.operation,
      prompt_mentions: promptMentions,
      references: references.map((reference, index) => ({
        asset_id: reference.asset_id,
        mention_name: normalizeMentionName(reference.mention_name),
        reference_role: reference.reference_role || 'subject',
        influence_level: reference.influence_level || 'balanced',
        sort_order: reference.sort_order ?? index,
      })),
      warnings: promptMentions.length === 0 && references.length > 0
        ? ['references_provided_without_prompt_mentions']
        : [],
    },
  };
}

function normalizeMentionName(value: string) {
  const normalized = value.replace(/^@/, '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(normalized) ? normalized : '';
}
