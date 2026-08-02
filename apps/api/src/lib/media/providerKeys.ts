import { decryptText, encryptText, getMasterSecret } from '../crypto';
import type { Bindings } from '../types';

export type PlatformProviderKeyRow = {
  provider: string;
  encrypted_key: string;
  key_hint: string | null;
  is_active: number;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
};

export async function setPlatformProviderKey(
  env: Pick<Bindings, 'DB' | 'MASTER_ENCRYPTION_KEY'>,
  provider: string,
  plaintextKey: string,
  adminId: string,
  now = Date.now(),
) {
  const trimmed = plaintextKey.trim();
  if (!trimmed) return { ok: false as const, error: 'api_key_required' };

  const encrypted = await encryptText(trimmed, getMasterSecret(env));
  const hint = trimmed.length > 4 ? `••••${trimmed.slice(-4)}` : '••••';

  await env.DB.prepare(`
    INSERT INTO platform_provider_keys (provider, encrypted_key, key_hint, is_active, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      encrypted_key = excluded.encrypted_key,
      key_hint = excluded.key_hint,
      is_active = 1,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).bind(provider, encrypted, hint, adminId, now, now).run();

  return { ok: true as const, key_hint: hint };
}

export async function getPlatformProviderKey(
  env: Pick<Bindings, 'DB' | 'MASTER_ENCRYPTION_KEY'>,
  provider: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT encrypted_key FROM platform_provider_keys WHERE provider = ? AND is_active = 1',
  ).bind(provider).first<{ encrypted_key: string }>();
  if (!row) return null;
  try {
    return await decryptText(row.encrypted_key, getMasterSecret(env));
  } catch {
    return null;
  }
}

export async function listPlatformProviderKeys(env: Pick<Bindings, 'DB'>) {
  const result = await env.DB.prepare(`
    SELECT provider, key_hint, is_active, updated_by, updated_at
    FROM platform_provider_keys ORDER BY provider ASC
  `).all<Pick<PlatformProviderKeyRow, 'provider' | 'key_hint' | 'is_active' | 'updated_by' | 'updated_at'>>();
  return (result.results || []).map((row) => ({ ...row, is_active: row.is_active === 1 }));
}
