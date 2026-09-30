export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['org_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['org_members']['Insert']>
      }
      sectors: {
        Row: {
          id: string
          org_id: string
          name: string
          code: string
          description: string | null
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sectors']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sectors']['Insert']>
      }
      customers: {
        Row: {
          id: string
          org_id: string
          subscriber_id: string | null
          first_name: string
          last_name: string
          phone: string | null
          neighborhood: string | null
          sector_id: string | null
          concession: string | null
          reference: string | null
          address: string | null
          request_date: string | null
          status: 'active' | 'suspended' | 'paused' | 'cancelled'
          suspension_date: string | null
          suspension_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          org_id: string
          customer_id: string
          monthly_price: number
          start_date: string
          end_date: string | null
          billing_day: number
          service_frequency: string
          status: 'active' | 'suspended' | 'paused' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      billing_charges: {
        Row: {
          id: string
          org_id: string
          customer_id: string
          subscription_id: string
          billing_period: string
          monthly_price: number
          months_billed: number
          amount_due: number
          amount_paid: number
          balance: number
          status: 'paid' | 'partial' | 'unpaid' | 'overdue' | 'waived'
          due_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['billing_charges']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['billing_charges']['Insert']>
      }
      payments: {
        Row: {
          id: string
          org_id: string
          customer_id: string
          amount: number
          payment_method: string
          payment_date: string
          reference: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      payment_allocations: {
        Row: {
          id: string
          payment_id: string
          charge_id: string
          amount: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payment_allocations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_allocations']['Insert']>
      }
      collection_schedules: {
        Row: {
          id: string
          org_id: string
          customer_id: string
          subscription_id: string
          scheduled_date: string
          assigned_worker: string | null
          status: 'scheduled' | 'completed' | 'missed' | 'rescheduled' | 'cancelled'
          completed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['collection_schedules']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['collection_schedules']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_org: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      current_user_orgs: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrgMember = Database['public']['Tables']['org_members']['Row']
export type Sector = Database['public']['Tables']['sectors']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type BillingCharge = Database['public']['Tables']['billing_charges']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentAllocation = Database['public']['Tables']['payment_allocations']['Row']
export type CollectionSchedule = Database['public']['Tables']['collection_schedules']['Row']

export type CustomerWithSector = Customer & {
  sectors: Pick<Sector, 'name' | 'code'> | null
}

export type CustomerFull = Customer & {
  sectors: Sector | null
  subscriptions: (Subscription & {
    billing_charges: BillingCharge[]
  })[]
}
