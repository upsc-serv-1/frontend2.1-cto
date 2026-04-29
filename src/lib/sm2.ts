// SM-2 style spaced repetition algorithm
// rating: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy

export type SM2State = { ease_factor: number; interval_days: number; repetitions: number };

export function sm2(prev: SM2State, rating: 0 | 1 | 2 | 3): SM2State {
  let { ease_factor, interval_days, repetitions } = prev;
  // quality 0-5 mapping
  const q = rating === 0 ? 2 : rating === 1 ? 3 : rating === 2 ? 4 : 5;

  if (q < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 3;
    else interval_days = Math.round(interval_days * ease_factor);
  }
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ease_factor, interval_days, repetitions };
}

export function nextDueIso(intervalDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(intervalDays, 0));
  return d.toISOString();
}
