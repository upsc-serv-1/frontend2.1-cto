import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { FileText, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { PilotNoteNode } from '../hooks/useNotesPilotVault';

interface PilotNoteCardProps {
  note: PilotNoteNode;
  onPress?: (note: PilotNoteNode) => void;
  onLongPress?: (note: PilotNoteNode) => void;
}

export const PilotNoteCard = ({ note, onPress, onLongPress }: PilotNoteCardProps) => {
  const { colors } = useTheme();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 5
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5
    }).start();
  };

  const lastTap = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double Tap: Immediate Edit
      router.push({ 
        pathname: '/notes/editor', 
        params: { id: note.note_id, title: note.title, subject: note.subject } 
      });
    } else {
      // Single Tap
      if (onPress) {
        onPress(note);
      } else {
        router.push({ 
          pathname: '/notes/editor', 
          params: { id: note.note_id, title: note.title, subject: note.subject } 
        });
      }
    }
    lastTap.current = now;
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={() => onLongPress?.(note)}
        delayLongPress={500}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: 'rgba(255, 255, 255, 0.4)' }]}
      >
        <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
          <FileText size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titleText, { color: colors.textPrimary }]} numberOfLines={1}>
            {note.title}
          </Text>
          <Text style={[styles.dateText, { color: colors.textTertiary }]}>
            {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : 'Just now'}
          </Text>
        </View>
        <ChevronRight size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
  }
});
