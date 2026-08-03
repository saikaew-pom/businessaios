-- Visual Template gallery for the composition renderer: admin-global
-- (owner_user_id NULL, visible to everyone) vs. user-private, same
-- visibility-split pattern as content_series_templates (migration 016).
CREATE TABLE IF NOT EXISTS visual_templates (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  owner_user_id TEXT, -- NULL for admin/global templates
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  layout_json TEXT NOT NULL DEFAULT '{}',
  preview_asset_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES users(id),
  FOREIGN KEY(preview_asset_id) REFERENCES media_assets(id)
);

CREATE INDEX IF NOT EXISTS idx_visual_templates_visibility
  ON visual_templates(owner_type, owner_user_id, is_active);

-- Starter set of built-in admin templates (visible to every user).
-- layout_json is consumed by lib/creative/compositionRenderer.ts.
INSERT INTO visual_templates (id, owner_type, owner_user_id, name, description, layout_json, is_active, created_at, updated_at)
VALUES
  (
    'tpl-builtin-bottom-gradient', 'admin', NULL,
    'Bottom Gradient Headline', 'หัวข้อใหญ่ด้านล่างบนไล่สีดำโปร่งใส เหมาะกับภาพถ่ายทั่วไป',
    '{"canvas":{"width":1080,"height":1080},"background":{"overlay_gradient":{"direction":"180deg","stops":[{"offset":"45%","color":"rgba(0,0,0,0)"},{"offset":"100%","color":"rgba(0,0,0,0.82)"}]}},"blocks":[{"type":"headline","anchor":"bottom-left","font_size":58,"font_weight":700,"color":"#ffffff","max_width_pct":88},{"type":"subheadline","anchor":"bottom-left","font_size":26,"font_weight":400,"color":"#e2e8f0","max_width_pct":88}]}',
    1, 0, 0
  ),
  (
    'tpl-builtin-top-badge', 'admin', NULL,
    'Top Badge + Center Headline', 'ป้ายเล็กด้านบน หัวข้อใหญ่กลางภาพ เหมาะกับโปรโมชัน/ประกาศ',
    '{"canvas":{"width":1080,"height":1080},"background":{"overlay_gradient":{"direction":"180deg","stops":[{"offset":"0%","color":"rgba(0,0,0,0.55)"},{"offset":"35%","color":"rgba(0,0,0,0.15)"},{"offset":"70%","color":"rgba(0,0,0,0.15)"},{"offset":"100%","color":"rgba(0,0,0,0.65)"}]}},"blocks":[{"type":"badge","anchor":"top-center","font_size":22,"font_weight":700,"color":"#111827","background_color":"#facc15"},{"type":"headline","anchor":"center","font_size":60,"font_weight":700,"color":"#ffffff","max_width_pct":80,"text_align":"center"}]}',
    1, 0, 0
  ),
  (
    'tpl-builtin-quote-card', 'admin', NULL,
    'Quote Card', 'การ์ดสี่เหลี่ยมโปร่งแสงกลางภาพ ใช้เน้นคำพูด/รีวิว',
    '{"canvas":{"width":1080,"height":1080},"background":{"overlay_gradient":{"direction":"180deg","stops":[{"offset":"0%","color":"rgba(15,23,42,0.35)"},{"offset":"100%","color":"rgba(15,23,42,0.35)"}]}},"blocks":[{"type":"headline","anchor":"center","font_size":46,"font_weight":700,"color":"#0f172a","max_width_pct":72,"text_align":"center","card_background":"rgba(255,255,255,0.94)","card_padding":56}]}',
    1, 0, 0
  ),
  (
    'tpl-builtin-side-bar', 'admin', NULL,
    'Side Color Bar', 'แถบสีตันด้านซ้าย ข้อความชิดซ้าย เหมาะกับสไตล์ corporate',
    '{"canvas":{"width":1080,"height":1080},"background":{"side_bar":{"width_pct":38,"color":"#0f172a"}},"blocks":[{"type":"headline","anchor":"center-left","font_size":48,"font_weight":700,"color":"#ffffff","max_width_pct":32,"side_bar_only":true},{"type":"subheadline","anchor":"center-left","font_size":22,"font_weight":400,"color":"#cbd5e1","max_width_pct":32,"side_bar_only":true}]}',
    1, 0, 0
  ),
  (
    'tpl-builtin-minimal-caption', 'admin', NULL,
    'Minimal Bottom Caption', 'แถบข้อความบางด้านล่าง เนื้อที่ภาพเยอะสุด เหมาะกับสินค้า/สถานที่',
    '{"canvas":{"width":1080,"height":1080},"background":{"overlay_gradient":{"direction":"180deg","stops":[{"offset":"78%","color":"rgba(0,0,0,0)"},{"offset":"100%","color":"rgba(0,0,0,0.75)"}]}},"blocks":[{"type":"headline","anchor":"bottom-left","font_size":40,"font_weight":700,"color":"#ffffff","max_width_pct":90}]}',
    1, 0, 0
  );
