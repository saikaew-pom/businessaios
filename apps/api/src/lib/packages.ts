/**
 * Credit packages — one-time top-ups in Thai Baht
 * 
 * Pricing model:
 *   1 credit ≈ $0.001 (cost) ≈ 0.035 THB
 *   Markup 20-28x covers Stripe fees + R2 + compute + support
 * 
 * Free tier: 200 credits (signup bonus)
 * All credits never expire
 */

export interface CreditPackage {
  id: string;            // stripe_lookup_key
  name: string;          // display name
  tagline: string;       // short description
  credits: number;       // credits user gets
  price_thb: number;     // price in Thai Baht
  price_satang: number;  // price in satang (smallest unit) — for Stripe
  per_credit_thb: number;// price per credit (display)
  best_for: string;      // who is this for
  popular?: boolean;     // highlight this package
  save_pct?: number;     // bulk discount % vs starter
  stripe_lookup_key: string;
}

export const PACKAGES: Record<string, CreditPackage> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'ลองใช้งาน',
    credits: 100,
    price_thb: 99,
    price_satang: 9900,
    per_credit_thb: 0.99,
    best_for: 'ทดลองใช้ 1-2 ครั้ง',
    stripe_lookup_key: 'businessaios_starter_100',
  },
  popular: {
    id: 'popular',
    name: 'Popular',
    tagline: 'ใช้งานประจำ',
    credits: 300,
    price_thb: 249,
    price_satang: 24900,
    per_credit_thb: 0.83,
    best_for: 'ทำงานจริงจัง 1-2 สัปดาห์',
    popular: true,
    save_pct: 16,
    stripe_lookup_key: 'businessaios_popular_300',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'ผู้ใช้งานจริงจัง',
    credits: 500,
    price_thb: 399,
    price_satang: 39900,
    per_credit_thb: 0.80,
    best_for: 'Power user ทำงานหลายโปรเจกต์',
    save_pct: 19,
    stripe_lookup_key: 'businessaios_pro_500',
  },
};

export function getPackage(id: string): CreditPackage | null {
  return PACKAGES[id] || null;
}

export function listPackages(): CreditPackage[] {
  return Object.values(PACKAGES);
}

/** Free signup bonus */
export const SIGNUP_BONUS_CREDITS = 200;
