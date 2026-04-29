import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, BookOpen, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme';
import { RecentNote } from '../hooks/useRecentNotes';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.32;

export function RecentNotesCarousel({ recents, onLongPress }: { recents: RecentNote[], onLongPress?: (note: any) => void }) {
  const router = useRouter();
  const { colors } = useTheme();

  const isEmpty = recents.length === 0;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={[s.label, { color: colors.textTertiary }]}>{isEmpty ? 'GETTING STARTED' : 'CONTINUE WHERE YOU LEFT OFF'}</Text>
        <Clock size={12} color={colors.textTertiary} />
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={s.scroll}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
      >
        {isEmpty ? (
          <View style={[s.card, s.emptyCard, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
             <BookOpen size={24} color={colors.textTertiary} opacity={0.3} />
             <Text style={[s.emptyText, { color: colors.textTertiary }]}>Your recently opened notes will appear here for quick access.</Text>
          </View>
        ) : (
          recents.map((note) => (
            <TouchableOpacity 
              key={note.id} 
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/notes/editor', params: { id: note.id, title: note.title, subject: note.subject } })}
              onLongPress={() => onLongPress?.({ note_id: note.id, title: note.title, subject: note.subject })}
              delayLongPress={500}
              style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={s.cardTop}>
                <View style={[s.subjectBadge, { backgroundColor: colors.primary + '15' }]}>
                  <BookOpen size={10} color={colors.primary} />
                  <Text style={[s.subjectText, { color: colors.primary }]}>{note.subject}</Text>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} />
              </View>
              <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={2}>{note.title}</Text>
              <Text style={[s.time, { color: colors.textTertiary }]}>{formatTime(note.timestamp)}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const s = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 4 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scroll: { gap: 8 },
  card: { 
    width: CARD_WIDTH, 
    padding: 8, 
    borderRadius: 16, 
    borderWidth: 1, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', gap: 8, borderStyle: 'dashed' },
  emptyText: { fontSize: 9, textAlign: 'center', lineHeight: 14, paddingHorizontal: 4 },
  subjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 4 },
  subjectText: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  title: { fontSize: 11, fontWeight: '800', lineHeight: 14, marginBottom: 2 },
  time: { fontSize: 8, fontWeight: '600' },
});
