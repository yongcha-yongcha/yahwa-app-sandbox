// 야화 — Supabase DB 타입. supabase-js v2.105 호환 (Relationships 필드 필수).
// 후속에 `supabase gen types typescript` 출력으로 자동 생성 교체 예정.

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          nickname: string;
          age: number | null;
          age_locked: boolean;
          region: string | null;
          headline: string | null;
          leaf_balance: number;
          verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          age?: number | null;
          age_locked?: boolean;
          region?: string | null;
          headline?: string | null;
          leaf_balance?: number;
          verified?: boolean;
        };
        Update: {
          nickname?: string;
          region?: string | null;
          headline?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          photos: string[];
          intro: string | null;
          basic_info: Json | null;
          tags: string[];
          visible: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          photos?: string[];
          intro?: string | null;
          basic_info?: Json | null;
          tags?: string[];
          visible?: boolean;
        };
        Update: {
          photos?: string[];
          intro?: string | null;
          basic_info?: Json | null;
          tags?: string[];
          visible?: boolean;
        };
        Relationships: [];
      };
      unlocks: {
        Row: { id: string; user_id: string; target_profile_id: string; cost_leaf: number; created_at: string };
        Insert: { user_id: string; target_profile_id: string; cost_leaf: number };
        Update: { cost_leaf?: number };
        Relationships: [];
      };
      gatherings: {
        Row: {
          id: string;
          host_id: string;
          ratio: string;
          slots: number;
          store_id: string | null;
          start_at: string | null;
          title: string;
          status: 'recruiting' | 'matched' | 'done' | 'cancelled';
          created_at: string;
        };
        Insert: {
          host_id: string;
          ratio: string;
          slots: number;
          store_id?: string | null;
          start_at?: string | null;
          title: string;
          status?: 'recruiting' | 'matched' | 'done' | 'cancelled';
        };
        Update: {
          ratio?: string;
          slots?: number;
          store_id?: string | null;
          start_at?: string | null;
          title?: string;
          status?: 'recruiting' | 'matched' | 'done' | 'cancelled';
        };
        Relationships: [];
      };
      gathering_slots: {
        Row: { gathering_id: string; user_id: string; joined_at: string };
        Insert: { gathering_id: string; user_id: string };
        Update: { gathering_id?: string; user_id?: string };
        Relationships: [];
      };
      chat_rooms: {
        Row: { id: string; kind: 'dm' | 'gather'; gathering_id: string | null; locked: boolean; created_at: string };
        Insert: { kind: 'dm' | 'gather'; gathering_id?: string | null; locked?: boolean };
        Update: { locked?: boolean };
        Relationships: [];
      };
      chat_members: {
        Row: { room_id: string; user_id: string; joined_at: string };
        Insert: { room_id: string; user_id: string };
        Update: { room_id?: string; user_id?: string };
        Relationships: [];
      };
      chat_messages: {
        Row: { id: string; room_id: string; sender_id: string; body: string; kind: string; created_at: string };
        Insert: { room_id: string; sender_id: string; body: string; kind?: string };
        Update: { body?: string };
        Relationships: [];
      };
      lounge_posts: {
        Row: {
          id: string;
          author_id: string;
          anon_nickname: string;
          cat: 'free' | 'love' | 'qna' | 'meet' | 'food';
          title: string;
          body: string;
          attachments: string[];
          likes: number;
          created_at: string;
        };
        Insert: {
          author_id: string;
          anon_nickname: string;
          cat: 'free' | 'love' | 'qna' | 'meet' | 'food';
          title: string;
          body: string;
          attachments?: string[];
        };
        Update: { title?: string; body?: string; attachments?: string[]; likes?: number };
        Relationships: [];
      };
      lounge_comments: {
        Row: {
          id: string;
          post_id: string;
          parent_id: string | null;
          author_id: string;
          anon_nickname: string;
          body: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          parent_id?: string | null;
          author_id: string;
          anon_nickname: string;
          body: string;
        };
        Update: { body?: string };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          region: string | null;
          lat: number;
          lng: number;
          charge_min: number | null;
          discount_pct: number | null;
          hot: boolean;
          active: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          category?: string | null;
          region?: string | null;
          lat: number;
          lng: number;
          charge_min?: number | null;
          discount_pct?: number | null;
          hot?: boolean;
          active?: boolean;
        };
        Update: {
          name?: string;
          category?: string | null;
          region?: string | null;
          lat?: number;
          lng?: number;
          charge_min?: number | null;
          discount_pct?: number | null;
          hot?: boolean;
          active?: boolean;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          kind: 'charge' | 'unlock' | 'refund' | 'gift';
          amount: number;
          provider: string | null;
          provider_tx_id: string | null;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          kind: 'charge' | 'unlock' | 'refund' | 'gift';
          amount: number;
          provider?: string | null;
          provider_tx_id?: string | null;
          meta?: Json | null;
        };
        Update: { meta?: Json | null };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_kind: 'user' | 'profile' | 'post' | 'comment' | 'message';
          target_id: string;
          reason: string;
          detail: string | null;
          resolved: boolean;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          target_kind: 'user' | 'profile' | 'post' | 'comment' | 'message';
          target_id: string;
          reason: string;
          detail?: string | null;
        };
        Update: { resolved?: boolean };
        Relationships: [];
      };
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string };
        Insert: { blocker_id: string; blocked_id: string };
        Update: { blocker_id?: string; blocked_id?: string };
        Relationships: [];
      };
      push_tokens: {
        Row: { id: string; user_id: string; token: string; platform: 'ios' | 'android'; created_at: string };
        Insert: { user_id: string; token: string; platform: 'ios' | 'android' };
        Update: { token?: string; platform?: 'ios' | 'android' };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      unlock_profile: {
        Args: { target_profile_id: string };
        Returns: number;
      };
      credit_leaf: {
        Args: { p_user_id: string; p_amount: number; p_provider: string; p_provider_tx_id: string };
        Returns: void;
      };
      debit_leaf_refund: {
        Args: { p_user_id: string; p_provider: string; p_provider_tx_id: string };
        Returns: void;
      };
      create_or_get_dm_room: {
        Args: { other_user_id: string };
        Returns: string;
      };
      set_birth_date: {
        Args: { p_year: number; p_month: number; p_day: number };
        Returns: void;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      get_profile_full: {
        Args: { target_id: string };
        Returns: Array<{
          user_id: string;
          photos: string[];
          intro: string | null;
          basic_info: Json | null;
          tags: string[];
          nickname: string;
          age: number | null;
          region: string | null;
          headline: string | null;
          unlocked: boolean;
        }>;
      };
    };
    Enums: {
      gathering_status: 'recruiting' | 'matched' | 'done' | 'cancelled';
      chat_kind: 'dm' | 'gather';
      lounge_cat: 'free' | 'love' | 'qna' | 'meet' | 'food';
      tx_kind: 'charge' | 'unlock' | 'refund' | 'gift';
      report_target: 'user' | 'profile' | 'post' | 'comment' | 'message';
    };
    CompositeTypes: Record<string, never>;
  };
};
