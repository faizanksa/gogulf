export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          case_id: string | null
          contact_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          occurred_at: string
          summary: string
          verb: string
        }
        Insert: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type: string
          case_id?: string | null
          contact_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          summary: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          case_id?: string | null
          contact_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          summary?: string
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2026: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_2027: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_default: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          actor_type: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          occurred_at: string
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          occurred_at?: string
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          city: string | null
          code: string
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      case_recruitment: {
        Row: {
          case_id: string
          created_at: string
          employer_id: string | null
          expected_salary_paise: number | null
          job_id: string | null
          legacy_job_country: string | null
          legacy_job_title: string | null
          passport_number_last4: string | null
          years_experience: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          employer_id?: string | null
          expected_salary_paise?: number | null
          job_id?: string | null
          legacy_job_country?: string | null
          legacy_job_title?: string | null
          passport_number_last4?: string | null
          years_experience?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          employer_id?: string | null
          expected_salary_paise?: number | null
          job_id?: string | null
          legacy_job_country?: string | null
          legacy_job_title?: string | null
          passport_number_last4?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_recruitment_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_recruitment_job_fk"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      case_travel: {
        Row: {
          budget_paise: number | null
          case_id: string
          created_at: string
          depart_date: string | null
          destination: string | null
          pax_adults: number
          pax_children: number
          return_date: string | null
        }
        Insert: {
          budget_paise?: number | null
          case_id: string
          created_at?: string
          depart_date?: string | null
          destination?: string | null
          pax_adults?: number
          pax_children?: number
          return_date?: string | null
        }
        Update: {
          budget_paise?: number | null
          case_id?: string
          created_at?: string
          depart_date?: string | null
          destination?: string | null
          pax_adults?: number
          pax_children?: number
          return_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_travel_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_visa: {
        Row: {
          application_ref: string | null
          case_id: string
          country_code: string | null
          created_at: string
          submitted_at: string | null
          visa_type: string | null
        }
        Insert: {
          application_ref?: string | null
          case_id: string
          country_code?: string | null
          created_at?: string
          submitted_at?: string | null
          visa_type?: string | null
        }
        Update: {
          application_ref?: string | null
          case_id?: string
          country_code?: string | null
          created_at?: string
          submitted_at?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_visa_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          branch_id: string | null
          case_number: string
          case_type: Database["public"]["Enums"]["case_type"]
          closed_at: string | null
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          legacy_id: string | null
          opened_at: string
          owner_id: string | null
          pipeline_id: string
          priority: number
          source_id: string | null
          stage_entered_at: string
          stage_id: string
          status: Database["public"]["Enums"]["case_status"]
          title: string | null
          updated_at: string
          value_amount_paise: number | null
        }
        Insert: {
          branch_id?: string | null
          case_number: string
          case_type: Database["public"]["Enums"]["case_type"]
          closed_at?: string | null
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          opened_at?: string
          owner_id?: string | null
          pipeline_id: string
          priority?: number
          source_id?: string | null
          stage_entered_at?: string
          stage_id: string
          status?: Database["public"]["Enums"]["case_status"]
          title?: string | null
          updated_at?: string
          value_amount_paise?: number | null
        }
        Update: {
          branch_id?: string | null
          case_number?: string
          case_type?: Database["public"]["Enums"]["case_type"]
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          opened_at?: string
          owner_id?: string | null
          pipeline_id?: string
          priority?: number
          source_id?: string | null
          stage_entered_at?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["case_status"]
          title?: string | null
          updated_at?: string
          value_amount_paise?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_identities: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          is_shared: boolean
          source: string | null
          type: Database["public"]["Enums"]["identity_type"]
          value_normalized: string
          value_raw: string
          verified_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_shared?: boolean
          source?: string | null
          type: Database["public"]["Enums"]["identity_type"]
          value_normalized: string
          value_raw: string
          verified_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_shared?: boolean
          source?: string | null
          type?: Database["public"]["Enums"]["identity_type"]
          value_normalized?: string
          value_raw?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merges: {
        Row: {
          id: string
          loser_id: string
          merged_at: string
          merged_by: string | null
          reason: string | null
          snapshot: Json
          winner_id: string
        }
        Insert: {
          id?: string
          loser_id: string
          merged_at?: string
          merged_by?: string | null
          reason?: string | null
          snapshot: Json
          winner_id: string
        }
        Update: {
          id?: string
          loser_id?: string
          merged_at?: string
          merged_by?: string | null
          reason?: string | null
          snapshot?: Json
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_merges_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_merged_by_fkey"
            columns: ["merged_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          branch_id: string | null
          consent_calls: boolean
          consent_email: boolean
          consent_marketing: boolean
          consent_sms: boolean
          consent_updated_at: string | null
          consent_whatsapp: boolean
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          display_name: string | null
          first_touch: Json
          full_name: string
          gender: string | null
          id: string
          last_activity_at: string | null
          legacy_id: string | null
          legal_hold_until: string | null
          lifecycle_stage: Database["public"]["Enums"]["lifecycle_stage"]
          merged_into_id: string | null
          nationality: string | null
          notes_summary: string | null
          owner_id: string | null
          preferred_language: string
          primary_email: string | null
          primary_phone_e164: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          consent_calls?: boolean
          consent_email?: boolean
          consent_marketing?: boolean
          consent_sms?: boolean
          consent_updated_at?: string | null
          consent_whatsapp?: boolean
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          display_name?: string | null
          first_touch?: Json
          full_name: string
          gender?: string | null
          id?: string
          last_activity_at?: string | null
          legacy_id?: string | null
          legal_hold_until?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          merged_into_id?: string | null
          nationality?: string | null
          notes_summary?: string | null
          owner_id?: string | null
          preferred_language?: string
          primary_email?: string | null
          primary_phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          consent_calls?: boolean
          consent_email?: boolean
          consent_marketing?: boolean
          consent_sms?: boolean
          consent_updated_at?: string | null
          consent_whatsapp?: boolean
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          display_name?: string | null
          first_touch?: Json
          full_name?: string
          gender?: string | null
          id?: string
          last_activity_at?: string | null
          legacy_id?: string | null
          legal_hold_until?: string | null
          lifecycle_stage?: Database["public"]["Enums"]["lifecycle_stage"]
          merged_into_id?: string | null
          nationality?: string | null
          notes_summary?: string | null
          owner_id?: string | null
          preferred_language?: string
          primary_email?: string | null
          primary_phone_e164?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          assignee_id: string | null
          branch_id: string | null
          case_id: string | null
          contact_id: string | null
          created_at: string
          cv_path: string
          email: string
          experience: string | null
          full_name: string
          id: string
          job_country: string | null
          job_id: string | null
          job_title: string
          message: string | null
          other_paths: string[]
          page_source: string | null
          passport_path: string
          phone: string
          status: Database["public"]["Enums"]["application_status"]
          status_changed_at: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          cv_path: string
          email: string
          experience?: string | null
          full_name: string
          id?: string
          job_country?: string | null
          job_id?: string | null
          job_title: string
          message?: string | null
          other_paths?: string[]
          page_source?: string | null
          passport_path: string
          phone: string
          status?: Database["public"]["Enums"]["application_status"]
          status_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          cv_path?: string
          email?: string
          experience?: string | null
          full_name?: string
          id?: string
          job_country?: string | null
          job_id?: string | null
          job_title?: string
          message?: string | null
          other_paths?: string[]
          page_source?: string | null
          passport_path?: string
          phone?: string
          status?: Database["public"]["Enums"]["application_status"]
          status_changed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_categories: {
        Row: {
          classification: Database["public"]["Enums"]["job_classification"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          classification: Database["public"]["Enums"]["job_classification"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          classification?: Database["public"]["Enums"]["job_classification"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          additional_info: string | null
          application_access: Database["public"]["Enums"]["job_application_access"]
          application_method: Database["public"]["Enums"]["job_application_method"]
          archived_at: string | null
          availability: Database["public"]["Enums"]["job_availability"]
          benefits: string[]
          branch_id: string | null
          category_id: string
          city: string | null
          classification: Database["public"]["Enums"]["job_classification"]
          closed_at: string | null
          closes_on: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          duplicated_from: string | null
          education: string | null
          employer_disclosure:
            | Database["public"]["Enums"]["job_employer_disclosure"]
            | null
          employer_name: string | null
          employment_type:
            | Database["public"]["Enums"]["job_employment_type"]
            | null
          experience: string | null
          featured_until: string | null
          id: string
          internal_notes: string | null
          languages: string | null
          last_published_at: string | null
          promotion: Database["public"]["Enums"]["job_promotion"]
          published_at: string | null
          reference: string
          requirements: string[]
          responsibilities: string[]
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: Database["public"]["Enums"]["job_salary_period"] | null
          slug: string
          status: Database["public"]["Enums"]["job_status"]
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          vacancies: number | null
        }
        Insert: {
          additional_info?: string | null
          application_access?: Database["public"]["Enums"]["job_application_access"]
          application_method?: Database["public"]["Enums"]["job_application_method"]
          archived_at?: string | null
          availability?: Database["public"]["Enums"]["job_availability"]
          benefits?: string[]
          branch_id?: string | null
          category_id: string
          city?: string | null
          classification?: Database["public"]["Enums"]["job_classification"]
          closed_at?: string | null
          closes_on?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          duplicated_from?: string | null
          education?: string | null
          employer_disclosure?:
            | Database["public"]["Enums"]["job_employer_disclosure"]
            | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["job_employment_type"]
            | null
          experience?: string | null
          featured_until?: string | null
          id?: string
          internal_notes?: string | null
          languages?: string | null
          last_published_at?: string | null
          promotion?: Database["public"]["Enums"]["job_promotion"]
          published_at?: string | null
          reference?: string
          requirements?: string[]
          responsibilities?: string[]
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?:
            | Database["public"]["Enums"]["job_salary_period"]
            | null
          slug?: string
          status?: Database["public"]["Enums"]["job_status"]
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          vacancies?: number | null
        }
        Update: {
          additional_info?: string | null
          application_access?: Database["public"]["Enums"]["job_application_access"]
          application_method?: Database["public"]["Enums"]["job_application_method"]
          archived_at?: string | null
          availability?: Database["public"]["Enums"]["job_availability"]
          benefits?: string[]
          branch_id?: string | null
          category_id?: string
          city?: string | null
          classification?: Database["public"]["Enums"]["job_classification"]
          closed_at?: string | null
          closes_on?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          duplicated_from?: string | null
          education?: string | null
          employer_disclosure?:
            | Database["public"]["Enums"]["job_employer_disclosure"]
            | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["job_employment_type"]
            | null
          experience?: string | null
          featured_until?: string | null
          id?: string
          internal_notes?: string | null
          languages?: string | null
          last_published_at?: string | null
          promotion?: Database["public"]["Enums"]["job_promotion"]
          published_at?: string | null
          reference?: string
          requirements?: string[]
          responsibilities?: string[]
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?:
            | Database["public"]["Enums"]["job_salary_period"]
            | null
          slug?: string
          status?: Database["public"]["Enums"]["job_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          vacancies?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_duplicated_from_fkey"
            columns: ["duplicated_from"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          branch_id: string | null
          case_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          id: string
          payment_id: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id: string | null
          provider_payment_id: string | null
          received_at: string
          status: Database["public"]["Enums"]["payment_event_status"]
          summary: Json
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          provider_payment_id?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["payment_event_status"]
          summary?: Json
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string | null
          provider_payment_id?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["payment_event_status"]
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          authorized_at: string | null
          branch_id: string | null
          case_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          method: string | null
          paid_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_order_id: string
          provider_payment_id: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          reference: string
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          authorized_at?: string | null
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id: string
          provider_payment_id?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          reference?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          authorized_at?: string | null
          branch_id?: string | null
          case_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_order_id?: string
          provider_payment_id?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          reference?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          domain: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          key: string
          name: string
          pipeline_id: string
          position: number
          sla_hours: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key: string
          name: string
          pipeline_id: string
          position: number
          sla_hours?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          key?: string
          name?: string
          pipeline_id?: string
          position?: number
          sla_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          case_type: Database["public"]["Enums"]["case_type"]
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          case_type: Database["public"]["Enums"]["case_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          case_type?: Database["public"]["Enums"]["case_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_key: string
          scope: string
        }
        Insert: {
          permission_id: string
          role_key: string
          scope: string
        }
        Update: {
          permission_id?: string
          role_key?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          is_super: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_super?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          is_super?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          auth_user_id: string | null
          branch_id: string | null
          created_at: string
          deactivated_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          phone_e164: string | null
          role_key: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          phone_e164?: string | null
          role_key: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          branch_id?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          phone_e164?: string | null
          role_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_users_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          branch_id: string | null
          case_id: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          branch_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          branch_id?: string | null
          case_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_application_document: {
        Args: { p_name: string }
        Returns: boolean
      }
      convert_job_application: {
        Args: { p_application_id: string }
        Returns: Json
      }
      current_branch_id: { Args: never; Returns: string }
      current_contact_id: { Args: never; Returns: string }
      current_role_key: { Args: never; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      ensure_audit_partition: { Args: { p_year: number }; Returns: undefined }
      grant_perm: {
        Args: { p_perm: string; p_role: string; p_scope: string }
        Returns: undefined
      }
      has_perm: {
        Args: { perm: string; required_scope?: string }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      job_publish_problems: {
        Args: { j: Database["public"]["Tables"]["jobs"]["Row"] }
        Returns: string[]
      }
      job_slug: {
        Args: { p_reference: string; p_title: string }
        Returns: string
      }
      job_text_items_valid: { Args: { items: string[] }; Returns: boolean }
      log_activity: {
        Args: {
          p_actor_id: string
          p_actor_type: string
          p_case_id: string
          p_contact_id: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
          p_summary: string
          p_verb: string
        }
        Returns: string
      }
      next_case_number: {
        Args: { p_type: Database["public"]["Enums"]["case_type"] }
        Returns: string
      }
      next_job_reference: { Args: never; Returns: string }
      next_payment_reference: { Args: never; Returns: string }
      normalize_email: { Args: { raw: string }; Returns: string }
      normalize_phone_e164: {
        Args: { default_country_code?: string; raw: string }
        Returns: string
      }
      normalize_wa_id: { Args: { raw: string }; Returns: string }
      note_view_permission: { Args: { p_visibility: string }; Returns: string }
      record_document_access: { Args: { p_path: string }; Returns: boolean }
      record_payment_event: {
        Args: {
          p_amount?: number
          p_currency?: string
          p_error_code?: string
          p_error_desc?: string
          p_event_id: string
          p_event_type: string
          p_method?: string
          p_order_id?: string
          p_payment_id?: string
        }
        Returns: string
      }
      redact_audit_payload: { Args: { payload: Json }; Returns: Json }
      resolve_contact: {
        Args: { p_email?: string; p_phone?: string; p_wa_id?: string }
        Returns: string
      }
      scope_allows: {
        Args: { perm: string; row_branch: string; row_owner: string }
        Returns: boolean
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_label: string
          p_actor_type: string
          p_entity_id: string
          p_entity_type: string
          p_ip?: unknown
          p_new_values?: Json
          p_old_values?: Json
          p_user_agent?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      application_status:
        | "new"
        | "screening"
        | "converted"
        | "rejected"
        | "withdrawn"
      case_status: "open" | "won" | "lost" | "cancelled"
      case_type: "recruitment" | "travel" | "visa" | "tour_booking" | "support"
      identity_type:
        | "phone"
        | "email"
        | "whatsapp_wa_id"
        | "auth_user"
        | "ivr_caller"
        | "social_handle"
        | "job_portal"
      job_application_access: "free" | "paid"
      job_application_method: "online_form" | "whatsapp"
      job_availability: "ongoing" | "time_limited"
      job_classification: "general" | "professional"
      job_employer_disclosure: "named" | "confidential"
      job_employment_type: "full_time" | "part_time" | "contract" | "temporary"
      job_promotion: "standard" | "featured"
      job_salary_period: "hour" | "day" | "month" | "year"
      job_status: "draft" | "review" | "published" | "closed" | "archived"
      lifecycle_stage:
        | "subscriber"
        | "lead"
        | "opportunity"
        | "customer"
        | "past_customer"
        | "disqualified"
      payment_event_status: "received" | "processed" | "ignored" | "failed"
      payment_provider: "razorpay"
      payment_purpose: "consultation"
      payment_status: "created" | "authorized" | "paid" | "failed" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: [
        "new",
        "screening",
        "converted",
        "rejected",
        "withdrawn",
      ],
      case_status: ["open", "won", "lost", "cancelled"],
      case_type: ["recruitment", "travel", "visa", "tour_booking", "support"],
      identity_type: [
        "phone",
        "email",
        "whatsapp_wa_id",
        "auth_user",
        "ivr_caller",
        "social_handle",
        "job_portal",
      ],
      job_application_access: ["free", "paid"],
      job_application_method: ["online_form", "whatsapp"],
      job_availability: ["ongoing", "time_limited"],
      job_classification: ["general", "professional"],
      job_employer_disclosure: ["named", "confidential"],
      job_employment_type: ["full_time", "part_time", "contract", "temporary"],
      job_promotion: ["standard", "featured"],
      job_salary_period: ["hour", "day", "month", "year"],
      job_status: ["draft", "review", "published", "closed", "archived"],
      lifecycle_stage: [
        "subscriber",
        "lead",
        "opportunity",
        "customer",
        "past_customer",
        "disqualified",
      ],
      payment_event_status: ["received", "processed", "ignored", "failed"],
      payment_provider: ["razorpay"],
      payment_purpose: ["consultation"],
      payment_status: ["created", "authorized", "paid", "failed", "refunded"],
    },
  },
} as const
