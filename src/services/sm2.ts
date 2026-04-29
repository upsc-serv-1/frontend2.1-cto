/**
 * SuperMemo-2 standard implementation (Noji/Anki style).
 * quality scale 0..5  (0 total blackout, 3 = recalled with difficulty, 5 = perfect)
 */
export interface SM2Input {
  ease_factor: number;   // EF, min 1.3
  interval_days: number; // I, days
  repetitions: number;   // n, count of consecutive correct
  quality: number;       // q, 0..5
}
export interface SM2Output {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: Date;
  status: 'learning' | 'review' | 'mastered' | 'leech';
  lapsed: boolean;
}

export function applySM2(input: SM2Input, lapses: number = 0): SM2Output {
  const q = Math.max(0, Math.min(5, Math.round(input.quality)));
  let { ease_factor, interval_days, repetitions } = input;
  let lapsed = false;

  if (q < 3) {
    // Lapse — restart
    repetitions = 0;
    interval_days = 1;
    lapsed = true;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  // EF formula:  EF' = EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02))
  ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;
  ease_factor = Math.round(ease_factor * 100) / 100;

  const next_review = new Date();
  next_review.setDate(next_review.getDate() + interval_days);

  let status: SM2Output['status'] =
    interval_days >= 90 ? 'mastered' :
    repetitions <= 1 ? 'learning' :
    'review';
  if (lapses + (lapsed ? 1 : 0) >= 8 && interval_days <= 1) status = 'leech';

  return { ease_factor, interval_days, repetitions, next_review, status, lapsed };
}
