import { z } from 'zod'

export const createReportSchema = z.object({
  raw_text: z.string().min(10, 'Report text must be at least 10 characters long'),
  source_type: z.enum(['text', 'audio']).default('text'),
  audio_url: z.string().url().optional().nullable(),
  language: z.string().max(16).default('en'),
})

export type CreateReportInput = z.infer<typeof createReportSchema>

export const reportIdSchema = z.object({
  reportId: z.string().uuid('Invalid report ID format'),
})
