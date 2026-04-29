import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export const SearchFAB = () => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: colors.primary }]}
      onPress={() => router.push('/unified/arena')}
      activeOpacity={0.8}
    >
      <Search color="#FFFFFF" size={28} strokeWidth={2.5} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 86, // Above tab bar (70 height + 16 margin)
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
