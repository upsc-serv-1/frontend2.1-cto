import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../../src/context/ThemeContext';
import { spacing } from '../../../src/theme';
import { PageWrapper } from '../../../src/components/PageWrapper';
import { ReviewSection } from '../../../src/components/unified/ReviewSection';

export default function ReviewScreen() {
  const { aid } = useLocalSearchParams<{ aid: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  if (!aid) {
    return (
      <PageWrapper>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>No attempt ID provided.</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft color={colors.textPrimary} size={24} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Test Analysis</Text>
        </TouchableOpacity>
      </View>

      <ReviewSection testAttemptId={aid} />
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
