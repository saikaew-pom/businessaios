/**
 * Presentation Tool Presets
 * Sources: Productive Presentation with AI (อ.กุลเชษฐ์ เล็กประยูร) + McKinsey/Dan Roam/Phil Waknell
 */

// =====================================================
// 10 Color Themes
// =====================================================
export interface ColorTheme {
  id: string;
  name: string;
  name_en: string;
  description: string;
  // Color tokens (used by slide renderer)
  primary: string;     // main brand
  secondary: string;   // accent
  accent: string;      // highlight
  background: string;  // slide bg
  text: string;        // body text
  textMuted: string;   // secondary text
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'business_blue',
    name: 'Business Blue',
    name_en: 'Business Blue',
    description: 'คลาสสิก มืออาชีพ เหมาะกับรายงานและ corporate',
    primary: '#1d4ed8',
    secondary: '#3b82f6',
    accent: '#06b6d4',
    background: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    chart1: '#1d4ed8', chart2: '#3b82f6', chart3: '#06b6d4', chart4: '#0ea5e9', chart5: '#0284c7',
  },
  {
    id: 'corporate_navy',
    name: 'Corporate Navy',
    name_en: 'Corporate Navy',
    description: 'เข้ม หนักแน่น เหมาะกับ investor + executive',
    primary: '#0f172a',
    secondary: '#1e293b',
    accent: '#f59e0b',
    background: '#f8fafc',
    text: '#0f172a',
    textMuted: '#475569',
    chart1: '#0f172a', chart2: '#1e293b', chart3: '#f59e0b', chart4: '#fbbf24', chart5: '#92400e',
  },
  {
    id: 'modern_teal',
    name: 'Modern Teal',
    name_en: 'Modern Teal',
    description: 'สดใส ทันสมัย เหมาะกับ tech + startup',
    primary: '#0d9488',
    secondary: '#14b8a6',
    accent: '#f97316',
    background: '#ffffff',
    text: '#134e4a',
    textMuted: '#5b8c85',
    chart1: '#0d9488', chart2: '#14b8a6', chart3: '#f97316', chart4: '#fb923c', chart5: '#fdba74',
  },
  {
    id: 'warm_sunset',
    name: 'Warm Sunset',
    name_en: 'Warm Sunset',
    description: 'อบอุ่น เป็นมิตร เหมาะกับ lifestyle + retail',
    primary: '#dc2626',
    secondary: '#f97316',
    accent: '#fbbf24',
    background: '#fffbeb',
    text: '#7c2d12',
    textMuted: '#9a3412',
    chart1: '#dc2626', chart2: '#f97316', chart3: '#fbbf24', chart4: '#fde047', chart5: '#84cc16',
  },
  {
    id: 'forest_green',
    name: 'Forest Green',
    name_en: 'Forest Green',
    description: 'สงบ ยั่งยืน เหมาะกับ sustainability + wellness',
    primary: '#15803d',
    secondary: '#22c55e',
    accent: '#eab308',
    background: '#f7fee7',
    text: '#14532d',
    textMuted: '#4d7c0f',
    chart1: '#15803d', chart2: '#22c55e', chart3: '#84cc16', chart4: '#eab308', chart5: '#facc15',
  },
  {
    id: 'royal_purple',
    name: 'Royal Purple',
    name_en: 'Royal Purple',
    description: 'หรูหรา มีระดับ เหมาะกับ luxury + premium',
    primary: '#7c3aed',
    secondary: '#a855f7',
    accent: '#ec4899',
    background: '#faf5ff',
    text: '#3b0764',
    textMuted: '#6b21a8',
    chart1: '#7c3aed', chart2: '#a855f7', chart3: '#ec4899', chart4: '#f472b6', chart5: '#fb7185',
  },
  {
    id: 'minimal_mono',
    name: 'Minimal Mono',
    name_en: 'Minimal Mono',
    description: 'เรียบง่าย เน้นเนื้อหา เหมาะกับ research + academic',
    primary: '#000000',
    secondary: '#404040',
    accent: '#dc2626',
    background: '#ffffff',
    text: '#0a0a0a',
    textMuted: '#737373',
    chart1: '#000000', chart2: '#404040', chart3: '#737373', chart4: '#a3a3a3', chart5: '#dc2626',
  },
  {
    id: 'ocean_blue',
    name: 'Ocean Blue',
    name_en: 'Ocean Blue',
    description: 'สดใส สบายตา เหมาะกับ finance + consulting',
    primary: '#0369a1',
    secondary: '#0ea5e9',
    accent: '#06b6d4',
    background: '#f0f9ff',
    text: '#0c4a6e',
    textMuted: '#0369a1',
    chart1: '#0369a1', chart2: '#0ea5e9', chart3: '#06b6d4', chart4: '#22d3ee', chart5: '#67e8f9',
  },
  {
    id: 'bold_magenta',
    name: 'Bold Magenta',
    name_en: 'Bold Magenta',
    description: 'โดดเด่น กล้าแสดงออก เหมาะกับ creative + agency',
    primary: '#be185d',
    secondary: '#db2777',
    accent: '#facc15',
    background: '#fff1f2',
    text: '#500724',
    textMuted: '#9f1239',
    chart1: '#be185d', chart2: '#db2777', chart3: '#facc15', chart4: '#fde047', chart5: '#fb923c',
  },
  {
    id: 'earth_tone',
    name: 'Earth Tone',
    name_en: 'Earth Tone',
    description: 'อบอุ่น ดิน เหมาะกับ craft + food + agriculture',
    primary: '#92400e',
    secondary: '#b45309',
    accent: '#65a30d',
    background: '#fef3c7',
    text: '#451a03',
    textMuted: '#78350f',
    chart1: '#92400e', chart2: '#b45309', chart3: '#65a30d', chart4: '#a16207', chart5: '#ca8a04',
  },
];

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

// =====================================================
// Presentation Objectives (3 frameworks)
// =====================================================
export interface PresentationObjective {
  id: 'informative' | 'persuasive' | 'story';
  name: string;
  name_en: string;
  icon: string;
  description: string;
  framework: 'scqa_minto' | '5m_mission' | 'popup_pitch';
  framework_name: string;
  best_for: string[];
  examples: string[];
}

export const PRESENTATION_OBJECTIVES: PresentationObjective[] = [
  {
    id: 'informative',
    name: 'ให้ข้อมูล (Informative)',
    name_en: 'Informative',
    icon: '📊',
    description: 'รายงาน สรุปงาน อธิบายข้อมูล — ให้ผู้ฟังเข้าใจชัดเจน',
    framework: 'scqa_minto',
    framework_name: 'SCQA + Minto Pyramid',
    best_for: ['Status report', 'Quarterly review', 'Training', 'Brief executive', 'Project update'],
    examples: [
      'รายงานผลประกอบการ Q3',
      'สรุปแผนการตลาดปี 2026',
      'อธิบายผลิตภัณฑ์ใหม่ให้ทีมขาย',
    ],
  },
  {
    id: 'persuasive',
    name: 'โน้มน้าว (Persuasive)',
    name_en: 'Persuasive',
    icon: '🎯',
    description: 'Pitch, ขออนุมัติ, เสนอไอเดีย — ทำให้คนเชื่อและลงมือ',
    framework: '5m_mission',
    framework_name: '5M Mission Flow (Message → Move)',
    best_for: ['Investment pitch', 'Budget approval', 'New idea proposal', 'Sales pitch', 'Internal change'],
    examples: [
      'ขออนุมัติงบการตลาด 1 ล้าน',
      'เสนอไอเดียเปิดสาขาใหม่',
      'Pitch ลงทุน Series A',
    ],
  },
  {
    id: 'story',
    name: 'เล่าเรื่อง (Story)',
    name_en: 'Story / Public Speaking',
    icon: '🎤',
    description: 'TED Talk, Keynote — ดึงอารมณ์ สร้างแรงบันดาลใจ',
    framework: 'popup_pitch',
    framework_name: 'The Pop-Up Pitch (Dan Roam — 10 slides)',
    best_for: ['TED Talk', 'Keynote', 'Conference talk', 'Brand story', 'Public pitch'],
    examples: [
      'Keynote เปิดงาน',
      'เล่าเรื่องแบรนด์ 10 ปี',
      'Pitch บนเวที 5 นาที',
    ],
  },
];

// =====================================================
// Communication Styles (Mark Murphy / Leadership IQ)
// 2x2: Emotional × Linear/Freeform
// =====================================================
export interface CommunicationStyle {
  id: 'analytical' | 'intuitive' | 'functional' | 'personal';
  name: string;
  name_en: string;
  description: string;
  traits: string[];
  typical_questions: string[];
  handling_tips: string[];
  presentation_tip: string;
}

export const COMMUNICATION_STYLES: CommunicationStyle[] = [
  {
    id: 'analytical',
    name: 'Analytical (นักวิเคราะห์)',
    name_en: 'Analytical',
    description: 'เน้นข้อเท็จจริง ตัวเลข ข้อมูล',
    traits: ['รักข้อมูล', 'ตัดสินใจด้วยตรรกะ', 'ไม่เชื่ออารมณ์', 'ถามตัวเลขเสมอ'],
    typical_questions: [
      'ตัวเลขนี้ได้มาจากไหน?',
      'ข้อมูลนี้มาจากแหล่งไหน?',
      'แน่ใจแล้วเหรอ?',
      'Sample size เท่าไหร่?',
    ],
    handling_tips: [
      'ใส่ data source ในทุกสไลด์',
      'ใช้ตัวเลขจริง ไม่ใช่คำกล่าวอ้าง',
      'มี footnote อ้างอิง',
    ],
    presentation_tip: 'เปิดด้วย data point เด่น ใช้ chart เยอะ ๆ',
  },
  {
    id: 'intuitive',
    name: 'Intuitive (นักมองภาพรวม)',
    name_en: 'Intuitive',
    description: 'เน้นภาพรวม ผลลัพธ์ปลายทาง',
    traits: ['มองภาพใหญ่', 'ไม่ชอบรายละเอียด', 'ตัดสินใจเร็ว', 'ชอบไอเดียใหม่'],
    typical_questions: [
      'แล้วรูปรวมจะได้อะไร?',
      'ปลายทางคืออะไร?',
      'ข้ามไปดูรูปเลยได้ไหม?',
      'ทำไมต้องสนใจเรื่องนี้?',
    ],
    handling_tips: [
      'เปิดด้วย big picture 1 slide',
      'สรุป conclusion ก่อน',
      'ไม่ต้องลงรายละเอียดทุกข้อ',
    ],
    presentation_tip: 'Slide แรก = คำตอบ ห้าม build-up ยาว',
  },
  {
    id: 'functional',
    name: 'Functional (นักปฏิบัติ)',
    name_en: 'Functional',
    description: 'เน้นกระบวนการ ขั้นตอน รายละเอียด',
    traits: ['ชอบแผนงาน', 'รอบคอบ', 'ถาม process', 'กลัวความผิดพลาด'],
    typical_questions: [
      'Process มีอะไรบ้าง?',
      'ขั้นตอนแรกคืออะไร?',
      'ใช้เวลานานเท่าไหร่?',
      'ใครต้องทำอะไรบ้าง?',
    ],
    handling_tips: [
      'มี timeline ชัดเจน',
      'แสดง responsibility matrix (RACI)',
      'มี Plan B เสมอ',
    ],
    presentation_tip: 'ใส่ timeline + owner + risk mitigation',
  },
  {
    id: 'personal',
    name: 'Personal (นักสัมพันธ์)',
    name_en: 'Personal',
    description: 'เน้นความสัมพันธ์ ความรู้สึก คน',
    traits: ['ใส่ใจคน', 'เห็นอกเห็นใจ', 'เน้นความรู้สึก', 'ชอบ storytelling'],
    typical_questions: [
      'พวกเขารู้สึกอย่างไร?',
      'คุณคิดว่ายังไง?',
      'ทีมโอเคไหม?',
      'Impact ต่อคนเป็นยังไง?',
    ],
    handling_tips: [
      'เปิดด้วยเรื่องเล่าของคน',
      'ใส่ quote จากลูกค้า/พนักงาน',
      'พูดถึง impact ต่อคน ไม่ใช่ตัวเลข',
    ],
    presentation_tip: 'Story-first — quote + ชื่อคน + ผลกระทบ',
  },
];

// =====================================================
// Audience Concerns (สิ่งที่ผู้ฟังอาจกังวล)
// =====================================================
export interface AudienceConcern {
  id: string;
  name: string;
  name_en: string;
  description: string;
  icon: string;
}

export const AUDIENCE_CONCERNS: AudienceConcern[] = [
  { id: 'clarity', name: 'ความชัดเจน', name_en: 'Clarity', description: 'กลัวฟังแล้วไม่เข้าใจ', icon: '🔍' },
  { id: 'time', name: 'เวลา', name_en: 'Time', description: 'กลัวเสียเวลา / ใช้เวลานานเกินไป', icon: '⏰' },
  { id: 'money', name: 'เงินทุน', name_en: 'Money', description: 'กลัวลงทุนแล้วไม่คุ้ม', icon: '💰' },
  { id: 'quality', name: 'คุณภาพ', name_en: 'Quality', description: 'กลัวคุณภาพไม่ได้มาตรฐาน', icon: '✨' },
  { id: 'risk', name: 'ความเสี่ยง', name_en: 'Risk', description: 'กลัวล้มเหลว / ผลลัพธ์ไม่แน่นอน', icon: '⚠️' },
  { id: 'reputation', name: 'ชื่อเสียง', name_en: 'Reputation', description: 'กลัวกระทบภาพลักษณ์', icon: '🏆' },
  { id: 'people', name: 'ทีม/คน', name_en: 'People', description: 'กลัวคนในทีมไม่พร้อม', icon: '👥' },
  { id: 'execution', name: 'การปฏิบัติจริง', name_en: 'Execution', description: 'กลัวทำไม่ได้จริง', icon: '⚙️' },
];

// =====================================================
// Slide Types (Flat / Story / Visual)
// =====================================================
export interface SlideType {
  id: 'flat' | 'story' | 'visual';
  name: string;
  name_en: string;
  description: string;
  best_for: string[];
  layout: string;
  warning: string;
}

export const SLIDE_TYPES: SlideType[] = [
  {
    id: 'flat',
    name: 'Flat (เน้นข้อความ)',
    name_en: 'Flat',
    description: 'เรียบ ตรงประเด็น เน้นข้อความเป็นหลัก',
    best_for: ['ภาคผนวก', 'สไลด์ Report', 'สรุปท้าย', 'ข้อมูลเชิงลึก'],
    layout: 'Title + bullets + data table',
    warning: 'ระวัง: ตัวหนังสือเยอะไป คนจะเบื่อ',
  },
  {
    id: 'story',
    name: 'Story (เล่าเรื่อง)',
    name_en: 'Story',
    description: 'Title แบบสรุปความ + สถิติ/กราฟ/ไอคอน/ภาพประกอบ',
    best_for: ['ทุก slide ที่ต้องการโน้มน้าว', 'เนื้อหาหลัก', 'Key points'],
    layout: 'Assertion title + 2-3 bullets + 1 visual',
    warning: '',
  },
  {
    id: 'visual',
    name: 'Visual (เล่าด้วยภาพ)',
    name_en: 'Visual',
    description: 'ภาพ/อินโฟกราฟิกเป็นสัดส่วนใหญ่ text น้อย',
    best_for: ['Pitch', 'Persuasive', 'สไลด์เปิด/ปิด', 'Story slides'],
    layout: 'Full-bleed image + 1 hook + minimal text',
    warning: '',
  },
];

// =====================================================
// Layout Patterns (5 Less-is-More patterns)
// =====================================================
export interface LayoutPattern {
  id: 'quadrant' | '3column' | 'chart_text' | 'full_bleed' | 'comparison';
  name: string;
  name_en: string;
  description: string;
  best_for: string[];
  preview: string; // SVG preview text
}

export const LAYOUT_PATTERNS: LayoutPattern[] = [
  {
    id: 'quadrant',
    name: '4 Quadrant',
    name_en: '4-Quadrant',
    description: 'แบ่งพื้นที่ 4 ส่วน เท่าๆ กัน',
    best_for: ['4 เสาหลัก', '3-4 ปัจจัยสำคัญ', 'คุณสมบัติเปรียบเทียบ'],
    preview: '┌─────┬─────┐\n│  1  │  2  │\n├─────┼─────┤\n│  3  │  4  │\n└─────┴─────┘',
  },
  {
    id: '3column',
    name: '3 Column',
    name_en: '3-Column',
    description: 'แบ่ง 3 คอลัมน์ พร้อม icon + title + body',
    best_for: ['Agenda', '3 ขั้นตอน', '3 กลยุทธ์', 'Before-During-After'],
    preview: '┌────┬────┬────┐\n│ ⭐ │ 🔥 │ 💡 │\n│Text│Text│Text│\n└────┴────┴────┘',
  },
  {
    id: 'chart_text',
    name: 'Chart + Text',
    name_en: 'Chart + Text',
    description: 'กราฟ/รูปฝั่งซ้าย + คำอธิบายฝั่งขวา',
    best_for: ['ข้อมูลที่ต้องอธิบาย', 'KPI', 'Before/After comparison'],
    preview: '┌─────────┬───────┐\n│ Chart   │ Title │\n│ ▓▓▓░░   │ • จุด1│\n│ ▓▓░░░   │ • จุด2│\n└─────────┴───────┘',
  },
  {
    id: 'full_bleed',
    name: 'Full-bleed Image',
    name_en: 'Full-bleed',
    description: 'รูปเต็มสไลด์ + hook text เหนือกึ่งกลาง',
    best_for: ['Persuasive', 'Sales', 'สไลด์เปิด/ปิด', 'Section divider'],
    preview: '┌─────────────┐\n│ ░░░░░░░░░░ │\n│  HOOK TEXT  │\n│ ░░░░░░░░░░ │\n└─────────────┘',
  },
  {
    id: 'comparison',
    name: 'Before vs After',
    name_en: 'Before/After',
    description: 'เปรียบเทียบ 2 สถานการณ์',
    best_for: ['แสดงการเปลี่ยนแปลง', 'ROI', 'ปัญหา vs ทางออก'],
    preview: '┌─────┬─ VS ─┬─────┐\n│Before│     │After │\n│  😟  │     │  😊  │\n└─────┴─────┴─────┘',
  },
];

// =====================================================
// Chart Types (แบ่ง/แข่ง/โต)
// =====================================================
export interface ChartType {
  id: string;
  name: string;
  category: 'composition' | 'comparison' | 'change';
  category_name: string;
  description: string;
  best_for: string;
  example_use: string;
}

export const CHART_TYPES: ChartType[] = [
  // Composition (แบ่ง)
  { id: 'pie', name: 'Pie Chart', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'วงกลมแบ่งสัดส่วน', best_for: '<5 หมวด', example_use: 'ส่วนแบ่งยอดขายตามสินค้า' },
  { id: 'stacked_bar', name: 'Stacked Bar', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'แท่งแบ่งสีตามสัดส่วน', best_for: '5+ หมวด + เปรียบเทียบข้ามกลุ่ม', example_use: 'สัดส่วนรายได้แต่ละไตรมาส' },
  { id: 'treemap', name: 'Treemap', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'พื้นที่ขนาดตามค่า', best_for: 'Hierarchy + ขนาด', example_use: 'โครงสร้างองค์กร + headcount' },
  { id: 'sankey', name: 'Sankey', category: 'composition', category_name: 'แบ่ง (Composition)', description: 'กระแสการไหล', best_for: 'Flow / Conversion', example_use: 'Conversion funnel' },
  // Comparison (แข่ง)
  { id: 'grouped_bar', name: 'Grouped Bar', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'แท่งเปรียบเทียบหลายกลุ่ม', best_for: 'เปรียบเทียบ 2-3 ตัวแปร', example_use: 'ยอดขาย Q1-Q4 ของ 3 สินค้า' },
  { id: 'clustered_bar', name: 'Clustered Bar', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'แท่งกลุ่มใกล้กัน', best_for: 'หลายกลุ่ม หลายช่วงเวลา', example_use: 'Performance 5 ทีม × 4 ไตรมาส' },
  { id: 'bullet', name: 'Bullet Chart', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'Actual vs Target', best_for: 'KPI + เป้า', example_use: 'Actual vs Target KPI' },
  { id: 'heatmap', name: 'Heatmap', category: 'comparison', category_name: 'แข่ง (Comparison)', description: 'ตารางสีตามค่า', best_for: 'Matrix ขนาดใหญ่', example_use: 'ยอดขายตามภาค+สินค้า' },
  // Change (โต)
  { id: 'line', name: 'Line Chart', category: 'change', category_name: 'โต (Change)', description: 'เส้นแสดงแนวโน้ม', best_for: 'Time series 4+ จุด', example_use: 'ยอดขายรายเดือน' },
  { id: 'area', name: 'Area Chart', category: 'change', category_name: 'โต (Change)', description: 'พื้นที่ใต้เส้น', best_for: 'Volume + trend', example_use: 'Active users ตามช่วงเวลา' },
  { id: 'dot_plot', name: 'Dot Plot', category: 'change', category_name: 'โต (Change)', description: 'จุดตามค่า', best_for: 'เปรียบเทียบค่าจำนวนน้อย', example_use: 'ค่าเฉลี่ย 4 หมวด' },
  { id: 'slope', name: 'Slope Chart', category: 'change', category_name: 'โต (Change)', description: 'เส้นเชื่อม 2 จุดเวลา', best_for: 'Before/After 2 ช่วง', example_use: 'อันดับความพึงพอใจ 2023 vs 2024' },
];
