export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      employers: {
        Row: {
          id: string
          canonical_name: string
          location_city: string | null
          location_area: string | null
          created_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          canonical_name: string
          location_city?: string | null
          location_area?: string | null
          created_at?: string
          last_seen_at?: string
        }
        Update: {
          id?: string
          canonical_name?: string
          location_city?: string | null
          location_area?: string | null
          created_at?: string
          last_seen_at?: string
        }
      }
      employer_aliases: {
        Row: {
          id: string
          employer_id: string
          alias_name: string
          confidence: number
          created_at: string
        }
        Insert: {
          id?: string
          employer_id: string
          alias_name: string
          confidence?: number
          created_at?: string
        }
        Update: {
          id?: string
          employer_id?: string
          alias_name?: string
          confidence?: number
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          employer_id: string | null
          source_type: 'text' | 'audio'
          raw_text: string
          audio_url: string | null
          language: string
          status: 'new' | 'analyzed' | 'needs_review'
          moderation_state: 'clean' | 'flagged'
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          employer_id?: string | null
          source_type?: 'text' | 'audio'
          raw_text: string
          audio_url?: string | null
          language?: string
          status?: 'new' | 'analyzed' | 'needs_review'
          moderation_state?: 'clean' | 'flagged'
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          employer_id?: string | null
          source_type?: 'text' | 'audio'
          raw_text?: string
          audio_url?: string | null
          language?: string
          status?: 'new' | 'analyzed' | 'needs_review'
          moderation_state?: 'clean' | 'flagged'
          submitted_at?: string
          created_at?: string
        }
      }
      ai_analyses: {
        Row: {
          id: string
          report_id: string
          employer_id: string | null
          issues_json: Json
          sentiment: 'negative' | 'neutral' | 'positive'
          severity: number
          summary: string
          prompt_version: string
          model: string
          raw_model_output: Json
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          employer_id?: string | null
          issues_json?: Json
          sentiment?: 'negative' | 'neutral' | 'positive'
          severity?: number
          summary?: string
          prompt_version: string
          model: string
          raw_model_output?: Json
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          employer_id?: string | null
          issues_json?: Json
          sentiment?: 'negative' | 'neutral' | 'positive'
          severity?: number
          summary?: string
          prompt_version?: string
          model?: string
          raw_model_output?: Json
          created_at?: string
        }
      }
      employer_scores: {
        Row: {
          employer_id: string
          trust_score: number
          risk_level: 'low' | 'medium' | 'high'
          risk_briefing: string
          report_count: number
          updated_at: string
          safety_rating: number | null
          wage_reliability: number | null
          fairness_score: number | null
          communication_score: number | null
        }
        Insert: {
          employer_id: string
          trust_score?: number
          risk_level?: 'low' | 'medium' | 'high'
          risk_briefing?: string
          report_count?: number
          updated_at?: string
          safety_rating?: number | null
          wage_reliability?: number | null
          fairness_score?: number | null
          communication_score?: number | null
        }
        Update: {
          employer_id?: string
          trust_score?: number
          risk_level?: 'low' | 'medium' | 'high'
          risk_briefing?: string
          report_count?: number
          updated_at?: string
          safety_rating?: number | null
          wage_reliability?: number | null
          fairness_score?: number | null
          communication_score?: number | null
        }
      }
      score_events: {
        Row: {
          id: string
          employer_id: string
          previous_score: number | null
          new_score: number
          reason_summary: string
          created_at: string
        }
        Insert: {
          id?: string
          employer_id: string
          previous_score?: number | null
          new_score: number
          reason_summary?: string
          created_at?: string
        }
        Update: {
          id?: string
          employer_id?: string
          previous_score?: number | null
          new_score?: number
          reason_summary?: string
          created_at?: string
        }
      }
      report_flags: {
        Row: {
          id: string
          report_id: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          reason?: string
          created_at?: string
        }
      }
    }
  }
}

export type Employer = Database['public']['Tables']['employers']['Row']
export type EmployerAlias = Database['public']['Tables']['employer_aliases']['Row']
export type Report = Database['public']['Tables']['reports']['Row']
export type AIAnalysis = Database['public']['Tables']['ai_analyses']['Row']
export type EmployerScore = Database['public']['Tables']['employer_scores']['Row']
export type ScoreEvent = Database['public']['Tables']['score_events']['Row']
export type ReportFlag = Database['public']['Tables']['report_flags']['Row']
