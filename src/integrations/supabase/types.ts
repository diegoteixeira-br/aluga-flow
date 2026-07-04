export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_email_log: {
        Row: {
          body: string
          created_at: string
          id: string
          recipients_count: number
          sent_by: string | null
          status: string
          subject: string
          target_plan: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipients_count?: number
          sent_by?: string | null
          status?: string
          subject: string
          target_plan: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipients_count?: number
          sent_by?: string | null
          status?: string
          subject?: string
          target_plan?: string
        }
        Relationships: []
      }
      admin_finance_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          kind: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          id?: string
          kind: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cancellations: {
        Row: {
          cancelled_at: string
          effective_date: string | null
          id: string
          plan_type: string
          reason: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string
          effective_date?: string | null
          id?: string
          plan_type: string
          reason: string
          user_id: string
        }
        Update: {
          cancelled_at?: string
          effective_date?: string | null
          id?: string
          plan_type?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_signatures: {
        Row: {
          contract_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
          signed_at: string | null
          signed_cpf: string | null
          signed_name: string | null
          signer_ip: string | null
          token: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          role: string
          signed_at?: string | null
          signed_cpf?: string | null
          signed_name?: string | null
          signer_ip?: string | null
          token?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          signed_at?: string | null
          signed_cpf?: string | null
          signed_name?: string | null
          signer_ip?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          adjustment_frequency_months: number
          adjustment_index: Database["public"]["Enums"]["adjustment_index"]
          contract_type: string
          created_at: string
          deposit_amount: number | null
          due_day: number
          end_date: string
          extra_charges: Json
          guarantee_months: number | null
          guarantee_type: Database["public"]["Enums"]["guarantee_type"]
          guarantor_address: string | null
          guarantor_cpf: string | null
          guarantor_email: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          guarantor_rg: string | null
          id: string
          notes: string | null
          payment_method: string
          property_id: string
          rent_amount: number
          signature_mode: string
          signature_status: string
          signed_at: string | null
          signed_pdf_path: string | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_frequency_months?: number
          adjustment_index?: Database["public"]["Enums"]["adjustment_index"]
          contract_type?: string
          created_at?: string
          deposit_amount?: number | null
          due_day?: number
          end_date: string
          extra_charges?: Json
          guarantee_months?: number | null
          guarantee_type?: Database["public"]["Enums"]["guarantee_type"]
          guarantor_address?: string | null
          guarantor_cpf?: string | null
          guarantor_email?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          guarantor_rg?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          property_id: string
          rent_amount: number
          signature_mode?: string
          signature_status?: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_frequency_months?: number
          adjustment_index?: Database["public"]["Enums"]["adjustment_index"]
          contract_type?: string
          created_at?: string
          deposit_amount?: number | null
          due_day?: number
          end_date?: string
          extra_charges?: Json
          guarantee_months?: number | null
          guarantee_type?: Database["public"]["Enums"]["guarantee_type"]
          guarantor_address?: string | null
          guarantor_cpf?: string | null
          guarantor_email?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          guarantor_rg?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          property_id?: string
          rent_amount?: number
          signature_mode?: string
          signature_status?: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          property_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          property_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          property_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          category: Database["public"]["Enums"]["photo_category"]
          created_at: string
          id: string
          inspection_id: string
          notes: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string
          id?: string
          inspection_id: string
          notes?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string
          id?: string
          inspection_id?: string
          notes?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          contract_id: string | null
          created_at: string
          general_notes: string | null
          id: string
          inspection_date: string
          property_id: string
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          inspection_date?: string
          property_id: string
          type: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          general_notes?: string | null
          id?: string
          inspection_date?: string
          property_id?: string
          type?: Database["public"]["Enums"]["inspection_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          current_address: string | null
          current_city: string | null
          current_state: string | null
          current_zip: string | null
          doc_income_path: string | null
          doc_residence_path: string | null
          doc_rg_path: string | null
          email: string | null
          id: string
          marital_status: string | null
          mensagem: string | null
          monthly_income: number | null
          nome_interessado: string
          profession: string | null
          property_id: string
          rg: string | null
          status: string
          telefone: string
          user_id: string
          visualizado: boolean
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          current_address?: string | null
          current_city?: string | null
          current_state?: string | null
          current_zip?: string | null
          doc_income_path?: string | null
          doc_residence_path?: string | null
          doc_rg_path?: string | null
          email?: string | null
          id?: string
          marital_status?: string | null
          mensagem?: string | null
          monthly_income?: number | null
          nome_interessado: string
          profession?: string | null
          property_id: string
          rg?: string | null
          status?: string
          telefone: string
          user_id: string
          visualizado?: boolean
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          current_address?: string | null
          current_city?: string | null
          current_state?: string | null
          current_zip?: string | null
          doc_income_path?: string | null
          doc_residence_path?: string | null
          doc_rg_path?: string | null
          email?: string | null
          id?: string
          marital_status?: string | null
          mensagem?: string | null
          monthly_income?: number | null
          nome_interessado?: string
          profession?: string | null
          property_id?: string
          rg?: string | null
          status?: string
          telefone?: string
          user_id?: string
          visualizado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          content: string
          slug: string
          updated_at: string
        }
        Insert: {
          content?: string
          slug: string
          updated_at?: string
        }
        Update: {
          content?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          charge_sent_at: string | null
          contract_id: string
          created_at: string
          due_date: string
          id: string
          method: Database["public"]["Enums"]["payment_method"] | null
          notes: string | null
          overdue_notice_sent_at: string | null
          paid_amount: number | null
          paid_date: string | null
          receipt_sent_at: string | null
          reference_month: string
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          charge_sent_at?: string | null
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          overdue_notice_sent_at?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          receipt_sent_at?: string | null
          reference_month: string
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          charge_sent_at?: string | null
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"] | null
          notes?: string | null
          overdue_notice_sent_at?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          receipt_sent_at?: string | null
          reference_month?: string
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          advanced_reports: boolean
          asaas_enabled: boolean
          benefits: Json
          created_at: string
          id: string
          max_listings: number | null
          max_properties: number | null
          max_users: number
          name: string
          price: number
          promo_price: number | null
          promo_until: string | null
          sort_order: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          advanced_reports?: boolean
          asaas_enabled?: boolean
          benefits?: Json
          created_at?: string
          id: string
          max_listings?: number | null
          max_properties?: number | null
          max_users?: number
          name: string
          price?: number
          promo_price?: number | null
          promo_until?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          advanced_reports?: boolean
          asaas_enabled?: boolean
          benefits?: Json
          created_at?: string
          id?: string
          max_listings?: number | null
          max_properties?: number | null
          max_users?: number
          name?: string
          price?: number
          promo_price?: number | null
          promo_until?: string | null
          sort_order?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_name: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          published: boolean
          scheduled_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt: string
          id?: string
          published?: boolean
          scheduled_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          scheduled_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          address_uf: string | null
          address_zip: string | null
          asaas_api_key: string | null
          asaas_environment: string
          auto_charge_days_before: number
          auto_charge_enabled: boolean
          auto_charge_message: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          creci: string | null
          email: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          parent_id: string | null
          pdf_footer: string | null
          pdf_header: string | null
          person_type: string
          phone: string | null
          pix_key: string | null
          plan: string
          profile_type: string | null
          public_phone: string | null
          razao_social: string | null
          role: string
          show_phone_public: boolean
          updated_at: string
          watermark_url: string | null
        }
        Insert: {
          active?: boolean
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_uf?: string | null
          address_zip?: string | null
          asaas_api_key?: string | null
          asaas_environment?: string
          auto_charge_days_before?: number
          auto_charge_enabled?: boolean
          auto_charge_message?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          parent_id?: string | null
          pdf_footer?: string | null
          pdf_header?: string | null
          person_type?: string
          phone?: string | null
          pix_key?: string | null
          plan?: string
          profile_type?: string | null
          public_phone?: string | null
          razao_social?: string | null
          role?: string
          show_phone_public?: boolean
          updated_at?: string
          watermark_url?: string | null
        }
        Update: {
          active?: boolean
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          address_uf?: string | null
          address_zip?: string | null
          asaas_api_key?: string | null
          asaas_environment?: string
          auto_charge_days_before?: number
          auto_charge_enabled?: boolean
          auto_charge_message?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          parent_id?: string | null
          pdf_footer?: string | null
          pdf_header?: string | null
          person_type?: string
          phone?: string | null
          pix_key?: string | null
          plan?: string
          profile_type?: string | null
          public_phone?: string | null
          razao_social?: string | null
          role?: string
          show_phone_public?: boolean
          updated_at?: string
          watermark_url?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          ad_description: string | null
          ad_title: string | null
          address: string
          area_m2: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          contact_phone: string | null
          created_at: string
          id: string
          listed_public: boolean
          neighborhood: string | null
          nickname: string
          notes: string | null
          rent_amount: number
          show_contact_public: boolean
          state: string | null
          status: Database["public"]["Enums"]["property_status"]
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          ad_description?: string | null
          ad_title?: string | null
          address: string
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          listed_public?: boolean
          neighborhood?: string | null
          nickname: string
          notes?: string | null
          rent_amount?: number
          show_contact_public?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          ad_description?: string | null
          ad_title?: string | null
          address?: string
          area_m2?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          listed_public?: boolean
          neighborhood?: string | null
          nickname?: string
          notes?: string | null
          rent_amount?: number
          show_contact_public?: boolean
          state?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      property_photos: {
        Row: {
          caption: string | null
          category: Database["public"]["Enums"]["photo_category"]
          created_at: string
          id: string
          property_id: string
          sort_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          category?: Database["public"]["Enums"]["photo_category"]
          created_at?: string
          id?: string
          property_id?: string
          sort_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_type: string
          scheduled_plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type: string
          scheduled_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_type?: string
          scheduled_plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tenant_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          file_path: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          file_path: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          file_path?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          asaas_customer_id: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          guarantor_cpf: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          id: string
          marital_status: string | null
          notes: string | null
          occupation: string | null
          phone: string | null
          rg: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          asaas_customer_id?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          guarantor_cpf?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          rg?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          asaas_customer_id?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          guarantor_cpf?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          marital_status?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          rg?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_metrics: { Args: never; Returns: Json }
      admin_list_users: {
        Args: never
        Returns: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          is_admin: boolean
          last_sign_in_at: string
          phone: string
          plan: string
          property_count: number
        }[]
      }
      admin_toggle_admin: {
        Args: { _make_admin: boolean; _user_id: string }
        Returns: undefined
      }
      admin_toggle_user_active: {
        Args: { _active: boolean; _user_id: string }
        Returns: undefined
      }
      admin_update_user_plan: {
        Args: { _plan: string; _user_id: string }
        Returns: undefined
      }
      check_plan_limit: {
        Args: { _resource: string; _user_id: string }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_account_owner: { Args: { _user_id: string }; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      publish_scheduled_posts: { Args: never; Returns: number }
    }
    Enums: {
      adjustment_index: "nenhum" | "igpm" | "ipca"
      app_role: "admin" | "user"
      contract_status: "ativo" | "encerrado" | "cancelado" | "pendente"
      expense_category:
        | "manutencao"
        | "iptu"
        | "condominio"
        | "seguro"
        | "reforma"
        | "administracao"
        | "outro"
      guarantee_type: "sem_garantia" | "fiador" | "caucao" | "seguro_fianca"
      inspection_type: "entrada" | "saida"
      payment_method:
        | "pix"
        | "boleto"
        | "transferencia"
        | "dinheiro"
        | "cartao"
        | "outro"
      payment_status: "pendente" | "pago" | "atrasado" | "cancelado"
      photo_category:
        | "fachada"
        | "sala"
        | "quarto"
        | "cozinha"
        | "banheiro"
        | "area_externa"
        | "vistoria_entrada"
        | "vistoria_saida"
        | "sala_jantar"
        | "suite"
        | "cozinha_americana"
        | "lavabo"
        | "area_servico"
        | "varanda"
        | "garagem"
        | "quintal"
        | "piscina"
        | "churrasqueira"
        | "escritorio"
        | "closet"
        | "outro"
      property_status: "disponivel" | "alugado" | "manutencao" | "inativo"
      property_type:
        | "apartamento"
        | "casa"
        | "comercial"
        | "kitnet"
        | "terreno"
        | "outro"
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
      adjustment_index: ["nenhum", "igpm", "ipca"],
      app_role: ["admin", "user"],
      contract_status: ["ativo", "encerrado", "cancelado", "pendente"],
      expense_category: [
        "manutencao",
        "iptu",
        "condominio",
        "seguro",
        "reforma",
        "administracao",
        "outro",
      ],
      guarantee_type: ["sem_garantia", "fiador", "caucao", "seguro_fianca"],
      inspection_type: ["entrada", "saida"],
      payment_method: [
        "pix",
        "boleto",
        "transferencia",
        "dinheiro",
        "cartao",
        "outro",
      ],
      payment_status: ["pendente", "pago", "atrasado", "cancelado"],
      photo_category: [
        "fachada",
        "sala",
        "quarto",
        "cozinha",
        "banheiro",
        "area_externa",
        "vistoria_entrada",
        "vistoria_saida",
        "sala_jantar",
        "suite",
        "cozinha_americana",
        "lavabo",
        "area_servico",
        "varanda",
        "garagem",
        "quintal",
        "piscina",
        "churrasqueira",
        "escritorio",
        "closet",
        "outro",
      ],
      property_status: ["disponivel", "alugado", "manutencao", "inativo"],
      property_type: [
        "apartamento",
        "casa",
        "comercial",
        "kitnet",
        "terreno",
        "outro",
      ],
    },
  },
} as const
