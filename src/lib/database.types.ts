// Database Types for FaidaFleet
// Auto-generated from Supabase schema

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          business_name: string | null
          phone: string | null
          email: string | null
          plan: 'starter' | 'pro' | 'enterprise'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          business_name?: string | null
          phone?: string | null
          email?: string | null
          plan?: 'starter' | 'pro' | 'enterprise'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          business_name?: string | null
          phone?: string | null
          email?: string | null
          plan?: 'starter' | 'pro' | 'enterprise'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: 'owner' | 'admin' | 'accountant' | 'driver'
          is_active: boolean
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          role: 'owner' | 'admin' | 'accountant' | 'driver'
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          role?: 'owner' | 'admin' | 'accountant' | 'driver'
          is_active?: boolean
          invited_by?: string | null
          joined_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          full_name: string
          phone: string
          license_number: string | null
          license_expiry: string | null
          id_number: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id?: string | null
          full_name: string
          phone: string
          license_number?: string | null
          license_expiry?: string | null
          id_number?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string | null
          full_name?: string
          phone?: string
          license_number?: string | null
          license_expiry?: string | null
          id_number?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          tenant_id: string
          registration_number: string
          make: string | null
          model: string | null
          year: number | null
          capacity: number | null
          route: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          registration_number: string
          make?: string | null
          model?: string | null
          year?: number | null
          capacity?: number | null
          route?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          registration_number?: string
          make?: string | null
          model?: string | null
          year?: number | null
          capacity?: number | null
          route?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      driver_assignments: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          start_date: string
          end_date: string | null
          is_current: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          driver_id: string
          vehicle_id: string
          start_date: string
          end_date?: string | null
          is_current?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          driver_id?: string
          vehicle_id?: string
          start_date?: string
          end_date?: string | null
          is_current?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      collections: {
        Row: {
          id: string
          tenant_id: string
          vehicle_id: string
          driver_id: string
          date: string
          shift: 'morning' | 'afternoon' | 'evening' | 'night' | null
          amount: number
          payment_method: 'cash' | 'mpesa' | 'pochi'
          mpesa_receipt: string | null
          reconciled: boolean
          reconciled_at: string | null
          reconciled_by: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          vehicle_id: string
          driver_id: string
          date?: string
          shift?: 'morning' | 'afternoon' | 'evening' | 'night' | null
          amount: number
          payment_method: 'cash' | 'mpesa' | 'pochi'
          mpesa_receipt?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          vehicle_id?: string
          driver_id?: string
          date?: string
          shift?: 'morning' | 'afternoon' | 'evening' | 'night' | null
          amount?: number
          payment_method?: 'cash' | 'mpesa' | 'pochi'
          mpesa_receipt?: string | null
          reconciled?: boolean
          reconciled_at?: string | null
          reconciled_by?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      mpesa_transactions: {
        Row: {
          id: string
          tenant_id: string
          transaction_type: string
          trans_id: string
          trans_time: string
          trans_amount: number
          business_short_code: string | null
          bill_ref_number: string | null
          msisdn: string | null
          first_name: string | null
          last_name: string | null
          org_account_balance: number | null
          third_party_trans_id: string | null
          phone_number: string | null
          matched_collection_id: string | null
          raw_data: any | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          transaction_type: string
          trans_id: string
          trans_time: string
          trans_amount: number
          business_short_code?: string | null
          bill_ref_number?: string | null
          msisdn?: string | null
          first_name?: string | null
          last_name?: string | null
          org_account_balance?: number | null
          third_party_trans_id?: string | null
          phone_number?: string | null
          matched_collection_id?: string | null
          raw_data?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          transaction_type?: string
          trans_id?: string
          trans_time?: string
          trans_amount?: number
          business_short_code?: string | null
          bill_ref_number?: string | null
          msisdn?: string | null
          first_name?: string | null
          last_name?: string | null
          org_account_balance?: number | null
          third_party_trans_id?: string | null
          phone_number?: string | null
          matched_collection_id?: string | null
          raw_data?: any | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          tenant_id: string
          vehicle_id: string | null
          date: string
          category: 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'other'
          amount: number
          description: string | null
          receipt_url: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          vehicle_id?: string | null
          date?: string
          category: 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'other'
          amount: number
          description?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          vehicle_id?: string | null
          date?: string
          category?: 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'other'
          amount?: number
          description?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      maintenance_logs: {
        Row: {
          id: string
          tenant_id: string
          vehicle_id: string
          date: string
          type: 'service' | 'repair' | 'inspection' | 'other'
          description: string
          cost: number | null
          odometer_reading: number | null
          next_service_date: string | null
          garage_name: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          vehicle_id: string
          date?: string
          type: 'service' | 'repair' | 'inspection' | 'other'
          description: string
          cost?: number | null
          odometer_reading?: number | null
          next_service_date?: string | null
          garage_name?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          vehicle_id?: string
          date?: string
          type?: 'service' | 'repair' | 'inspection' | 'other'
          description?: string
          cost?: number | null
          odometer_reading?: number | null
          next_service_date?: string | null
          garage_name?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kpi_daily: {
        Row: {
          tenant_id: string
          date: string
          active_vehicles: number
          active_drivers: number
          cash_total: number | null
          mpesa_total: number | null
          pochi_total: number | null
          total_collections: number
          reconciled_count: number
          unreconciled_count: number
          total_expenses: number
          net_profit: number
        }
      }
    }
    Views: {
      kpi_daily: {
        Row: {
          tenant_id: string
          date: string
          active_vehicles: number
          active_drivers: number
          cash_total: number | null
          mpesa_total: number | null
          pochi_total: number | null
          total_collections: number
          reconciled_count: number
          unreconciled_count: number
          total_expenses: number
          net_profit: number
        }
      }
    }
    Functions: {
      current_tenant_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      has_tenant_role: {
        Args: {
          tenant_uuid: string
          required_role: string
        }
        Returns: boolean
      }
      has_any_tenant_role: {
        Args: {
          tenant_uuid: string
          required_roles: string[]
        }
        Returns: boolean
      }
      refresh_kpi_daily: {
        Args: Record<string, never>
        Returns: void
      }
    }
  }
}

// Convenience types
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Membership = Database['public']['Tables']['memberships']['Row']
export type Driver = Database['public']['Tables']['drivers']['Row']
export type Vehicle = Database['public']['Tables']['vehicles']['Row']
export type DriverAssignment = Database['public']['Tables']['driver_assignments']['Row']
export type Collection = Database['public']['Tables']['collections']['Row']
export type MpesaTransaction = Database['public']['Tables']['mpesa_transactions']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type MaintenanceLog = Database['public']['Tables']['maintenance_logs']['Row']
export type KpiDaily = Database['public']['Tables']['kpi_daily']['Row']

// Insert types
export type TenantInsert = Database['public']['Tables']['tenants']['Insert']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type MembershipInsert = Database['public']['Tables']['memberships']['Insert']
export type DriverInsert = Database['public']['Tables']['drivers']['Insert']
export type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']
export type DriverAssignmentInsert = Database['public']['Tables']['driver_assignments']['Insert']
export type CollectionInsert = Database['public']['Tables']['collections']['Insert']
export type MpesaTransactionInsert = Database['public']['Tables']['mpesa_transactions']['Insert']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
export type MaintenanceLogInsert = Database['public']['Tables']['maintenance_logs']['Insert']

// Update types
export type TenantUpdate = Database['public']['Tables']['tenants']['Update']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type MembershipUpdate = Database['public']['Tables']['memberships']['Update']
export type DriverUpdate = Database['public']['Tables']['drivers']['Update']
export type VehicleUpdate = Database['public']['Tables']['vehicles']['Update']
export type DriverAssignmentUpdate = Database['public']['Tables']['driver_assignments']['Update']
export type CollectionUpdate = Database['public']['Tables']['collections']['Update']
export type MpesaTransactionUpdate = Database['public']['Tables']['mpesa_transactions']['Update']
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']
export type MaintenanceLogUpdate = Database['public']['Tables']['maintenance_logs']['Update']

// Enums
export type UserRole = 'owner' | 'admin' | 'accountant' | 'driver'
export type TenantPlan = 'starter' | 'pro' | 'enterprise'
export type PaymentMethod = 'cash' | 'mpesa' | 'pochi'
export type Shift = 'morning' | 'afternoon' | 'evening' | 'night'
export type ExpenseCategory = 'fuel' | 'maintenance' | 'insurance' | 'license' | 'parking' | 'other'
export type MaintenanceType = 'service' | 'repair' | 'inspection' | 'other'
