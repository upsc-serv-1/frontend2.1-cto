import AsyncStorage from '@react-native-async-storage/async-storage';

export const ANALYTICS_LAYOUT_KEY = 'analytics_layout_v1';

export const DEFAULT_ANALYTICS_LAYOUT = {
  review: [
    'summary',
    'outcomes',
    'subject_accuracy',
    'fatigue',
    'difficulty',
    'mistake_types',
    'confidence',
    'weak_areas',
    'mistake_analysis',
    'insights',
  ],
  overall: [
    'smart_insight',
    'repeated_weaknesses',
    'performance_trajectory',
    'subject_proficiency',
    'elimination_zone',
    'theme_heatmap',
    'fatigue_difficulty',
    'mistake_categorization',
  ],
};

export type AnalyticsLayout = typeof DEFAULT_ANALYTICS_LAYOUT;

export async function loadAnalyticsLayout(): Promise<AnalyticsLayout> {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_LAYOUT_KEY);
    if (!raw) return DEFAULT_ANALYTICS_LAYOUT;
    const parsed = JSON.parse(raw);
    return {
      review: Array.isArray(parsed?.review) ? parsed.review : DEFAULT_ANALYTICS_LAYOUT.review,
      overall: Array.isArray(parsed?.overall) ? parsed.overall : DEFAULT_ANALYTICS_LAYOUT.overall,
    };
  } catch {
    return DEFAULT_ANALYTICS_LAYOUT;
  }
}

export async function saveAnalyticsLayout(layout: AnalyticsLayout) {
  await AsyncStorage.setItem(ANALYTICS_LAYOUT_KEY, JSON.stringify(layout));
}

export function moveLayoutItem(list: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}
