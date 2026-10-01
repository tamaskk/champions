import type { DraftPick } from '@/components/draft-spin';

// Substitutes' bench (arcade mode): slots and the minimum to complete the squad.
export const BENCH_SIZE = 5;
// The bench is optional: an empty one just means tired starters over a league season.
export const BENCH_MIN = 0;
export const EMPTY_BENCH: (DraftPick | null)[] = Array(BENCH_SIZE).fill(null);
