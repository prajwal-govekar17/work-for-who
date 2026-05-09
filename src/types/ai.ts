export type Sentiment = 'negative' | 'neutral' | 'positive'

export interface IntakeAIOutput {
  employer_name: string | null
  location_city: string | null
  location_area: string | null
  issues: string[]
  sentiment: Sentiment
  severity: number // 1-5
  summary: string
  is_valid_report: boolean
}

export interface IntelligenceAIOutput {
  trust_score: number // 0-100
  risk_level: 'low' | 'medium' | 'high'
  risk_briefing: string
  key_issues: string[]
}
