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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      favorite_friends: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      game_invites: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          room_id: string | null
          sender_id: string
          session_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          room_id?: string | null
          sender_id: string
          session_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          room_id?: string | null
          sender_id?: string
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tv_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          target: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          read_at?: string | null
          target?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          target?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string
          bio: string
          created_at: string
          game_counts: Json
          id: string
          last_active: string | null
          losses: number
          matches: number
          nickname: string
          photo_path: string | null
          username: string | null
          wins: number
        }
        Insert: {
          avatar?: string
          bio?: string
          created_at?: string
          game_counts?: Json
          id: string
          last_active?: string | null
          losses?: number
          matches?: number
          nickname?: string
          photo_path?: string | null
          username?: string | null
          wins?: number
        }
        Update: {
          avatar?: string
          bio?: string
          created_at?: string
          game_counts?: Json
          id?: string
          last_active?: string | null
          losses?: number
          matches?: number
          nickname?: string
          photo_path?: string | null
          username?: string | null
          wins?: number
        }
        Relationships: []
      }
      room_history: {
        Row: {
          created_at: string
          game: string
          id: string
          room_id: string
          summary: string
          winner_ids: string[]
        }
        Insert: {
          created_at?: string
          game: string
          id?: string
          room_id: string
          summary: string
          winner_ids?: string[]
        }
        Update: {
          created_at?: string
          game?: string
          id?: string
          room_id?: string
          summary?: string
          winner_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "room_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_players: {
        Row: {
          avatar: string
          is_bot: boolean
          joined_at: string
          last_seen: string
          nickname: string
          photo_path: string | null
          ready: boolean
          room_id: string
          user_id: string
          wins: number
        }
        Insert: {
          avatar?: string
          is_bot?: boolean
          joined_at?: string
          last_seen?: string
          nickname: string
          photo_path?: string | null
          ready?: boolean
          room_id: string
          user_id: string
          wins?: number
        }
        Update: {
          avatar?: string
          is_bot?: boolean
          joined_at?: string
          last_seen?: string
          nickname?: string
          photo_path?: string | null
          ready?: boolean
          room_id?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_secrets: {
        Row: {
          data: Json
          kind: string
          room_id: string
          user_id: string
        }
        Insert: {
          data?: Json
          kind: string
          room_id: string
          user_id: string
        }
        Update: {
          data?: Json
          kind?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          game: string
          host_id: string
          id: string
          state: Json
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          game?: string
          host_id: string
          id?: string
          state?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          game?: string
          host_id?: string
          id?: string
          state?: Json
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      tv_answers: {
        Row: {
          answer: Json
          created_at: string
          round: number
          session_id: string
          user_id: string
        }
        Insert: {
          answer: Json
          created_at?: string
          round: number
          session_id: string
          user_id: string
        }
        Update: {
          answer?: Json
          created_at?: string
          round?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tv_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_participants: {
        Row: {
          avatar: string
          last_seen: string
          nickname: string
          photo_path: string | null
          score: number
          session_id: string
          user_id: string
        }
        Insert: {
          avatar?: string
          last_seen?: string
          nickname: string
          photo_path?: string | null
          score?: number
          session_id: string
          user_id: string
        }
        Update: {
          avatar?: string
          last_seen?: string
          nickname?: string
          photo_path?: string | null
          score?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tv_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_private: {
        Row: {
          data: Json
          round: number
          session_id: string
        }
        Insert: {
          data: Json
          round: number
          session_id: string
        }
        Update: {
          data?: Json
          round?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_private_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tv_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_sessions: {
        Row: {
          code: string
          created_at: string
          game: string
          host_id: string
          id: string
          mode: string
          state: Json
          status: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          game?: string
          host_id: string
          id?: string
          mode?: string
          state?: Json
          status?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          game?: string
          host_id?: string
          id?: string
          mode?: string
          state?: Json
          status?: string
          version?: number
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      commit_game_move: {
        Args: {
          p_room_id: string
          p_secrets: Json
          p_state: Json
          p_version: number
        }
        Returns: boolean
      }
      commit_tv_round: {
        Args: {
          new_state: Json
          new_status: string
          s: string
          scores: Json
          v: number
        }
        Returns: boolean
      }
      is_room_member: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      is_tv_member: { Args: { s: string; u: string }; Returns: boolean }
      search_players: {
        Args: { term: string }
        Returns: {
          avatar: string
          bio: string
          id: string
          last_active: string
          matches: number
          nickname: string
          photo_path: string
          username: string
          wins: number
        }[]
      }
      shares_room: { Args: { _a: string; _b: string }; Returns: boolean }
      username_available: { Args: { name: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
