import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { yogesh_1 } from '../../themes/yogesh_1';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card = ({ children, style }: CardProps) => {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: yogesh_1.colors.card,
    borderRadius: yogesh_1.radius.card,
    padding: yogesh_1.spacing.lg,
    borderWidth: 1,
    borderColor: yogesh_1.colors.border + '50',
    ...yogesh_1.shadows.soft,
  },
});
