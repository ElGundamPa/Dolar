export interface AgentRow {
  id: string;
  name: string;
  photo_url: string | null;
  song_url: string | null;
  song_start_seconds: number;
  team_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: string;
  name: string;
  goal: number;
  icon_url: string | null;
  display_order: number;
}

export interface AppSettingRow {
  key: string;
  value: unknown;
}

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: AgentRow;
        Insert: Omit<AgentRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AgentRow>;
      };
      teams: {
        Row: TeamRow;
        Insert: TeamRow;
        Update: Partial<TeamRow>;
      };
      app_settings: {
        Row: AppSettingRow;
        Insert: AppSettingRow;
        Update: Partial<AppSettingRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
