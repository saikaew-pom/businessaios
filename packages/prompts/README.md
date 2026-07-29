# MarketingAiOs — 7 Prompt Templates

> เนื้อหา prompt ที่ใช้ใน wizard แต่ละ step — เอาไปต่อกับ AI provider ได้เลย

## 📚 Overview

| # | Step | Output | AI Model | Cost/Generation |
|---|------|--------|----------|-----------------|
| 1 | [Business DNA](./01-business-dna.md) | Brand Card 5 ข้อ | Claude Sonnet 4 | ~$0.02 |
| 2 | [Customer Persona](./02-customer-persona.md) | Persona 3 แบบ + quotes | Claude Sonnet 4 | ~$0.04 |
| 3 | [Customer Journey](./03-customer-journey.md) | Journey 5 จุด + emotion curve | Claude Sonnet 4 | ~$0.03 |
| 4 | [Positioning](./04-positioning.md) | Positioning + UVP + Tagline | Claude Sonnet 4 | ~$0.025 |
| 5 | [Content Calendar](./05-content-calendar.md) | 30 content pieces | Claude Sonnet 4 | ~$0.05 |
| 6 | [Marketing Workflow](./06-marketing-workflow.md) | 3 workflows + voice guide | Claude Sonnet 4 | ~$0.03 |
| 7 | [KPI Dashboard](./07-kpi-dashboard.md) | 5 KPIs + 30-day plan | Claude Sonnet 4 | ~$0.02 |

**Total cost for 1 full project:** ~$0.22 (all 7 steps)

## 🚀 How to Use

### 1. Variable Substitution

Each prompt has `{variable}` placeholders. Replace them with user input from the wizard.

```typescript
const prompt = step1Template
  .replace('{business_name}', userInput.businessName)
  .replace('{business_type}', userInput.businessType)
  // ... etc
```

### 2. Call AI API

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: user.apiKey });

const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2000,
  messages: [{ role: 'user', content: prompt }],
});
```

### 3. Parse JSON Output

Each prompt specifies a JSON schema. Use `response.content[0].text` then parse:

```typescript
const output = JSON.parse(message.content[0].text);
```

### 4. Validate

Each prompt has a "Validation Checklist" — run before saving to DB.

## 🎯 Customization

### Add Industry-Specific Prompts

Create new files:
- `08-clinic-specific.md`
- `09-restaurant-specific.md`
- `10-realestate-specific.md`

### Adjust Tone

Each prompt has a tone section. Modify for:
- B2B vs B2C
- Premium vs Accessible
- Conservative vs Bold

### Multi-language

Translate the prompt templates to:
- English (default in some steps)
- Thai (primary)
- Chinese (for SEA expansion)

## 🔒 Security

- API keys stored in DB encrypted (AES-256)
- Prompts do NOT include sensitive data (no PII)
- Output logged but not stored long-term

## 📊 A/B Testing

Each step has variants in the prompt file (e.g., "Premium positioning" vs "Niche positioning").
Let user choose or randomly assign.

## 🛠️ Maintenance

When AI models update:
1. Test prompts with new model
2. Update "AI model recommended" in this README
3. Update cost estimates
4. Update BLUEPRINT.md decision log

---

**Maintained by:** MarketingAiOs team
**Last updated:** 24 July 2026
