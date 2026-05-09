import { z } from 'zod'

export const intakeAIOutputSchema = z.object({
  employer_name: z.string().nullable(),
  location_city: z.string().nullable(),
  location_area: z.string().nullable(),
  issues: z.array(z.string()),
  sentiment: z.enum(['negative', 'neutral', 'positive']),
  severity: z.number().min(1).max(5),
  summary: z.string(),
  is_valid_report: z.boolean(),
})

export const intelligenceAIOutputSchema = z.object({
  trust_score: z.number().min(0).max(100),
  risk_level: z.enum(['low', 'medium', 'high']),
  risk_briefing: z.string(),
  key_issues: z.array(z.string()),
})
