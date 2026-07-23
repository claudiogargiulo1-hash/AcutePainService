// src/types/database.ts

export type UserRole = 'medico' | 'infermiere' | 'paziente' | 'admin';
export type InterventionCategory =
  | 'ortopedico' | 'addominale' | 'toracico' | 'urologico'
  | 'ginecologico' | 'vascolare' | 'neurochirurgico' | 'altro';
export type AnesthesiaType =
  | 'generale' | 'spinale' | 'epidurale' | 'locoregionale' | 'sedazione' | 'locale';
export type PainProtocol =
  | 'PCA_morfina' | 'PCA_tramadolo' | 'epidurale_continua'
  | 'blocco_nervoso' | 'sistemico_ev' | 'sistemico_orale' | 'multimodale';
export type AlertLevel = 'verde' | 'giallo' | 'rosso';

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  badge_number?: string;
  department?: string;
  phone?: string;
  preferred_language: 'it' | 'en';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  fiscal_code?: string;
  gender?: 'M' | 'F' | 'altro';
  admission_number: string;
  ward: string;
  bed?: string;
  admission_date: string;
  discharge_date?: string;
  allergies?: string;
  weight_kg?: number;
  height_cm?: number;
  asa_class?: number;
  notes?: string;
  user_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Intervention {
  id: string;
  patient_id: string;
  intervention_name: string;
  category: InterventionCategory;
  intervention_date: string;
  duration_minutes?: number;
  anesthesia_type: AnesthesiaType;
  anesthesiologist_id?: string;
  surgeon?: string;
  pain_protocol: PainProtocol;
  nrs_schedule: string[];
  nrs_alert_threshold: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NrsMeasurement {
  id: string;
  patient_id: string;
  intervention_id?: string;
  nrs_value: number;
  nrs_rest?: number;
  nrs_movement?: number;
  scheduled_time?: string;
  measured_at: string;
  alert_level: AlertLevel;
  therapy_administered?: string;
  therapy_dose?: string;
  recorded_by?: string;
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  patient_id?: string;
  recipient_id: string;
  type: string;
  title: string;
  title_en: string;
  body: string;
  body_en: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> };
      patients: { Row: Patient; Insert: Omit<Patient, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Patient> };
      interventions: { Row: Intervention; Insert: Omit<Intervention, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Intervention> };
      nrs_measurements: { Row: NrsMeasurement; Insert: Omit<NrsMeasurement, 'id' | 'alert_level' | 'created_at'>; Update: Partial<NrsMeasurement> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> };
    };
  };
};
