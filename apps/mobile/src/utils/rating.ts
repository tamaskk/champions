/** Badge colour for a 0–100 player rating: elite, strong, decent, weak. */
export function ratingColor(rating: number): string {
  if (rating >= 85) return '#208AEF';
  if (rating >= 70) return '#30A46C';
  if (rating >= 55) return '#F5B800';
  return '#8B8D98';
}

export const formatRating = (rating: number) => String(Math.round(rating));
