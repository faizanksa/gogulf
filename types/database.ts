/**
 * Supabase database types.
 *
 * PLACEHOLDER — hand-written so the client modules type-check before the
 * migrations in supabase/migrations/ have been applied.
 *
 * Once they are applied, replace this file with generated output:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 *
 * and stop editing it by hand. Generated types are the point: they make the
 * schema and the code disagree loudly rather than silently.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LifecycleStage =
  | "subscriber"
  | "lead"
  | "opportunity"
  | "customer"
  | "past_customer"
  | "disqualified";

export type IdentityType =
  | "phone"
  | "email"
  | "whatsapp_wa_id"
  | "auth_user"
  | "ivr_caller"
  | "social_handle"
  | "job_portal";

export type CaseType =
  | "recruitment"
  | "travel"
  | "visa"
  | "tour_booking"
  | "support";

export type CaseStatus = "open" | "won" | "lost" | "cancelled";

export type PermissionScope = "all" | "branch" | "own";

export type NoteVisibility = "team" | "hr_private" | "finance_private";

export type ActorType = "staff" | "customer" | "system" | "provider";

/**
 * Minimal shape covering what Phase 1 code touches. Deliberately not the whole
 * schema — an incomplete hand-written type that lies is worse than one that is
 * obviously partial.
 */
export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          full_name: string;
          display_name: string | null;
          primary_phone_e164: string | null;
          primary_email: string | null;
          lifecycle_stage: LifecycleStage;
          owner_id: string | null;
          branch_id: string | null;
          country_code: string | null;
          nationality: string | null;
          preferred_language: string;
          consent_email: boolean;
          consent_whatsapp: boolean;
          consent_sms: boolean;
          consent_calls: boolean;
          consent_marketing: boolean;
          consent_updated_at: string | null;
          first_touch: Json;
          legal_hold_until: string | null;
          merged_into_id: string | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
          last_activity_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["contacts"]["Row"]> & {
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
      contact_identities: {
        Row: {
          id: string;
          contact_id: string;
          type: IdentityType;
          value_raw: string;
          value_normalized: string;
          is_primary: boolean;
          is_shared: boolean;
          verified_at: string | null;
          source: string | null;
          created_at: string;
        };
        Insert: {
          contact_id: string;
          type: IdentityType;
          value_raw: string;
          // Written by trigger; never supplied by application code.
          value_normalized?: string;
          is_primary?: boolean;
          is_shared?: boolean;
          verified_at?: string | null;
          source?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["contact_identities"]["Row"]
        >;
        Relationships: [];
      };
      staff_users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string;
          full_name: string;
          role_key: string;
          branch_id: string | null;
          phone_e164: string | null;
          is_active: boolean;
          deactivated_at: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_users"]["Row"]> & {
          email: string;
          full_name: string;
          role_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_users"]["Row"]>;
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          case_number: string;
          contact_id: string;
          case_type: CaseType;
          pipeline_id: string;
          stage_id: string;
          status: CaseStatus;
          title: string | null;
          owner_id: string | null;
          branch_id: string | null;
          value_amount_paise: number | null;
          priority: number;
          legacy_id: string | null;
          opened_at: string;
          stage_entered_at: string;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["cases"]["Row"]> & {
          case_number: string;
          contact_id: string;
          case_type: CaseType;
          pipeline_id: string;
          stage_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["cases"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          contact_id: string | null;
          case_id: string | null;
          actor_type: ActorType;
          actor_id: string | null;
          actor_label: string | null;
          verb: string;
          entity_type: string | null;
          entity_id: string | null;
          summary: string;
          metadata: Json;
          occurred_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          actor_type: ActorType;
          verb: string;
          summary: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_perm: {
        Args: { perm: string; required_scope?: PermissionScope };
        Returns: boolean;
      };
      current_staff_id: { Args: Record<string, never>; Returns: string | null };
      current_branch_id: { Args: Record<string, never>; Returns: string | null };
      current_contact_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      is_staff: { Args: Record<string, never>; Returns: boolean };
      normalize_phone_e164: {
        Args: { raw: string; default_country_code?: string };
        Returns: string | null;
      };
      resolve_contact: {
        Args: { p_wa_id?: string; p_phone?: string; p_email?: string };
        Returns: string | null;
      };
      next_case_number: { Args: { p_type: CaseType }; Returns: string };
    };
    Enums: {
      lifecycle_stage: LifecycleStage;
      identity_type: IdentityType;
      case_type: CaseType;
      case_status: CaseStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
