import { z } from 'zod'

export const employerIdSchema = z.object({
  employerId: z.string().uuid('Invalid employer ID format'),
})
