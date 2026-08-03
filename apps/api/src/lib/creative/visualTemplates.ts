import type { Bindings } from '../types';

export type VisualTemplateRow = {
  id: string;
  owner_type: 'admin' | 'user';
  owner_user_id: string | null;
  name: string;
  description: string;
  layout_json: string;
  preview_asset_id: string | null;
  is_active: number;
  created_at: number;
  updated_at: number;
};

function parseJson(value: string | null | undefined, fallback: unknown) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export async function getVisibleVisualTemplates(env: Pick<Bindings, 'DB'>, userId: string): Promise<VisualTemplateRow[]> {
  const rows = await env.DB.prepare(`
    SELECT * FROM visual_templates
    WHERE is_active = 1 AND (owner_type = 'admin' OR owner_user_id = ?)
    ORDER BY owner_type ASC, created_at DESC
  `).bind(userId).all<VisualTemplateRow>();
  return rows.results || [];
}

export async function getVisualTemplateForUser(env: Pick<Bindings, 'DB'>, userId: string, templateId: string): Promise<VisualTemplateRow | null> {
  const row = await env.DB.prepare(`
    SELECT * FROM visual_templates
    WHERE id = ? AND is_active = 1 AND (owner_type = 'admin' OR owner_user_id = ?)
  `).bind(templateId, userId).first<VisualTemplateRow>();
  return row || null;
}

export function serializeVisualTemplate(row: VisualTemplateRow) {
  return {
    ...row,
    layout: parseJson(row.layout_json, {}),
    layout_json: undefined,
    is_active: !!row.is_active,
  };
}
