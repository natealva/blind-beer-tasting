type TastingSessionLike = { tasting_type?: string | null } | null | undefined;

export function getTastingType(session: TastingSessionLike): string {
  return session?.tasting_type || "Beer";
}

export function getItemLabel(session: TastingSessionLike): string {
  const type = getTastingType(session);
  const labels: Record<string, string> = {
    Beer: "Beer",
    Wine: "Wine",
    Seltzer: "Seltzer",
    Steak: "Steak",
    Food: "Food",
    Cheese: "Cheese",
    Cocktails: "Cocktail",
    Whiskey: "Whiskey",
  };
  return labels[type] || type;
}

export function getItemEmoji(session: TastingSessionLike): string {
  const type = getTastingType(session);
  const emojis: Record<string, string> = {
    Beer: "🍺",
    Wine: "🍷",
    Seltzer: "🥂",
    Steak: "🥩",
    Food: "🍕",
    Cheese: "🧀",
    Cocktails: "🫗",
    Whiskey: "🥃",
  };
  return emojis[type] || "🍽️";
}

export function isBeer(session: TastingSessionLike): boolean {
  return getTastingType(session).toLowerCase() === "beer";
}

