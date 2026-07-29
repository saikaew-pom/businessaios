/**
 * Shared types for MarketingAiOs
 * Used by both web (SvelteKit) and api (Hono)
 */

export type Locale = 'th' | 'en';

export type Plan = 'free' | 'pro' | 'team';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'workers-ai';

export type AIComplexity = 'simple' | 'medium' | 'complex';

// =====================================================
// Wizard
// =====================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4, 5, 6, 7];

export const STEP_NAMES: Record<WizardStep, { th: string; en: string }> = {
  1: { th: 'Business DNA', en: 'Business DNA' },
  2: { th: 'Customer Persona', en: 'Customer Persona' },
  3: { th: 'Customer Journey', en: 'Customer Journey' },
  4: { th: 'Positioning', en: 'Positioning' },
  5: { th: 'Content Calendar', en: 'Content Calendar' },
  6: { th: 'Marketing Workflow', en: 'Marketing Workflow' },
  7: { th: 'KPI Dashboard', en: 'KPI Dashboard' },
};

// =====================================================
// Step 1: Business DNA
// =====================================================

export type BrandCard = {
  positioning: string;
  uvp: string;
  target_audience: string;
  voice_tone: string;
  anti_positioning: string;
  reasoning: string;
};

// =====================================================
// Step 2: Customer Persona
// =====================================================

export type Persona = {
  name: string;
  demographics: {
    age: string;
    job: string;
    income: string;
    location: string;
    family: string;
  };
  psychographics: {
    values: string;
    interests: string;
    fears: string;
    aspirations: string;
  };
  pain_points: string[];
  preferred_channels: string[];
  key_quotes: string[];
  motivators: string[];
  objections: string[];
  best_offer: string;
  size_estimate: string;
};

export type PersonasOutput = {
  personas: Persona[];
  insights: string[];
};

// =====================================================
// Step 3: Customer Journey
// =====================================================

export type JourneyStage = 'awareness' | 'consideration' | 'decision' | 'action' | 'loyalty';

export type JourneyTouchpoint = {
  stage: JourneyStage;
  stage_name_th: string;
  touchpoints: string[];
  emotions: {
    primary: string;
    secondary: string;
    pain: string;
    quote: string;
  };
  key_message: string;
  kpi: string;
  content_types: string[];
};

export type JourneyOutput = {
  journey: JourneyTouchpoint[];
  pain_points: { stage: JourneyStage; pain: string; solution: string }[];
  emotion_curve: {
    description: string;
    data: { stage: JourneyStage; emotion_score: number; label: string }[];
  };
  opportunities: string[];
};

// =====================================================
// Step 4: Positioning
// =====================================================

export type PositioningOutput = {
  positioning_statement: string;
  positioning_one_liner: string;
  uvp_bullets: string[];
  tagline_options: string[];
  competitive_frame: Record<string, string>;
  proof_points: string[];
  elevator_pitch: string;
  reasoning: string;
};

// =====================================================
// Step 5: Content Calendar
// =====================================================

export type ContentPillar = 'awareness' | 'education' | 'social_proof' | 'conversion';
export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'line' | 'twitter' | 'youtube';

export type ContentItem = {
  day: number;
  date_suggested: string;
  pillar: ContentPillar;
  platform: Platform;
  format: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visual_suggestion: string;
  expected_engagement: 'low' | 'medium' | 'high';
};

export type ContentCalendarOutput = {
  calendar: ContentItem[];
};

// =====================================================
// Step 6: Workflow
// =====================================================

export type Workflow = {
  id: string;
  name: string;
  type: 'content' | 'customer_service' | 'research' | 'sales' | 'reporting';
  time_before: string;
  time_after: string;
  time_saved_pct: number;
  tools_used: string[];
  tools_cost_monthly: number;
  steps: { step: number; action: string; duration: string; output: string }[];
  frequency: string;
  kpi: string;
  pitfalls: string[];
};

export type VoiceGuide = {
  tone: string;
  do: string[];
  dont: string[];
  sample_phrases: string[];
};

export type WorkflowOutput = {
  workflows: Workflow[];
  voice_guide: VoiceGuide;
};

// =====================================================
// Step 7: KPI
// =====================================================

export type KPI = {
  id: string;
  name: string;
  category: 'leading' | 'lagging';
  current: number;
  target_30d: number;
  target_90d: number;
  unit: string;
  how_to_measure: string;
  tool: string;
  frequency: string;
  owner: string;
  action_if_below: string;
  why_this_matters: string;
};

export type ActionPlan30d = {
  week_1: { theme: string; tasks: string[]; outcome: string };
  week_2: { theme: string; tasks: string[]; outcome: string };
  week_3: { theme: string; tasks: string[]; outcome: string };
  week_4: { theme: string; tasks: string[]; outcome: string };
};

export type DashboardTemplate = {
  tool: string;
  tabs: { name: string; columns: string[] }[];
  auto_charts: string[];
};

export type ReviewRitual = {
  daily: string;
  weekly: string;
  monthly: string;
};

export type KPIOutput = {
  kpis: KPI[];
  action_plan_30d: ActionPlan30d;
  dashboard_template: DashboardTemplate;
  review_ritual: ReviewRitual;
};

// =====================================================
// API Responses
// =====================================================

export type WaitlistResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  duplicate?: boolean;
  id?: string;
};

export type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

export type ApiError = {
  error: string;
  message: string;
};
