import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import type { WidgetData } from '../../hooks/useWidgetData';
import { useTheme } from '../../context/ThemeContext';
import {
  DailyGoalWidget, ExamCountdownWidget, QuestionsTodayWidget,
  StudyTimeWidget, WeeklyActivityWidget, AccuracyTrendWidget,
  TodayScoreWidget, WeakestSubjectWidget, SpeedMeterWidget,
} from './CoreWidgets';
import {
  DueCardsWidget, MasteryRingWidget, PYQCoverageWidget,
  RecentNotesWidget, TaggedCountWidget, QuickPracticeWidget,
  LastTestWidget, TestScoresWidget,
} from '../ExtraWidgets';


interface Props {
  activeWidgets: string[];
  data: WidgetData;
  config?: any;
  colors: any;
  isEditMode?: boolean;
  onRemove?: (id: string) => void;
}

function renderWidget(id: string, data: WidgetData, config: WidgetConfig, colors: any) {
  switch (id) {
    case 'daily_goal':       return <DailyGoalWidget data={data} colors={colors} dailyGoal={config.dailyGoal} />;
    case 'exam_countdown':   return <ExamCountdownWidget colors={colors} examDate={config.examDate} />;
    case 'questions_today':  return <QuestionsTodayWidget data={data} colors={colors} />;
    case 'study_time_today': return <StudyTimeWidget data={data} colors={colors} />;
    case 'weekly_streak':    return <WeeklyActivityWidget data={data} colors={colors} />;
    case 'accuracy_trend':   return <AccuracyTrendWidget data={data} colors={colors} />;
    case 'correct_incorrect':return <TodayScoreWidget data={data} colors={colors} />;
    case 'weakest_subject':  return <WeakestSubjectWidget data={data} colors={colors} />;
    case 'speed_meter':      return <SpeedMeterWidget data={data} colors={colors} />;
    case 'due_cards':        return <DueCardsWidget data={data} colors={colors} />;
    case 'mastery_ring':     return <MasteryRingWidget data={data} colors={colors} />;
    case 'pyq_coverage':     return <PYQCoverageWidget data={data} colors={colors} />;
    case 'recent_notes':     return <RecentNotesWidget data={data} colors={colors} />;
    case 'tagged_count':     return <TaggedCountWidget data={data} colors={colors} />;
    case 'quick_practice':   return <QuickPracticeWidget colors={colors} />;
    case 'last_test':        return <LastTestWidget data={data} colors={colors} />;
    case 'test_scores':      return <TestScoresWidget data={data} colors={colors} />;
    default: return null;
  }
}

export function WidgetGrid({ activeWidgets, data, config, colors, isEditMode, onRemove }: Props) {
  return (
    <View style={{ gap: 12 }}>
      {(activeWidgets || []).map(id => (
        <View key={id} style={{ width: '100%', position: 'relative' }}>
          {renderWidget(id, data, config || {}, colors)}
          {isEditMode && onRemove && (
            <TouchableOpacity 
              style={rs.removeBtn} 
              onPress={() => onRemove(id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X color="#fff" size={14} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const rs = StyleSheet.create({
  pairRow: { flexDirection: 'row', gap: 12, width: '100%' },
  fullRow: { width: '100%' },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, zIndex: 100,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
});

// 🆕 WidgetRenderer — used by DraggableFlatList in dashboard
export function WidgetRenderer({ widgetKey, data, onArchive }: {
  widgetKey: string;
  data?: WidgetData;
  onArchive?: () => void;
}) {
  const { colors } = useTheme();
  const content = renderWidget(widgetKey, data as WidgetData, {} as any, colors);
  return (
    <View style={{ position: 'relative' }}>
      {content}
      {onArchive && (
        <TouchableOpacity
          onPress={onArchive}
          style={{ position: 'absolute', top: 8, right: 8, padding: 4, zIndex: 100 }}
        >
          <X size={14} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );
}
