export type Session = {
  id: string;
  code: string;
  name: string;
  beer_count: number;
  admin_password: string;
  is_active: boolean;
  created_at: string;
};

export type BeerReveal = {
  id: string;
  session_id: string;
  beer_number: number;
  beer_name: string;
  brewery: string | null;
  style: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  session_id: string;
  name: string;
  order_direction: "ascending" | "descending";
  created_at: string;
};

export type Rating = {
  id: string;
  session_id: string;
  player_id: string;
  beer_number: number;
  crushability: number | null;
  taste: number | null;
  guess: string | null;
  notes: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      sessions: { Row: Session; Insert: Omit<Session, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Session> };
      beer_reveals: { Row: BeerReveal; Insert: Omit<BeerReveal, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<BeerReveal> };
      players: { Row: Player; Insert: Omit<Player, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Player> };
      ratings: { Row: Rating; Insert: Omit<Rating, "id" | "created_at"> & { id?: string; created_at?: string }; Update: Partial<Rating> };
    };
  };
};
