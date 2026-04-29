import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { yogesh_1 } from '../../themes/yogesh_1';

interface TagProps {
  label: string;
}

export const Tag = ({ label }: TagProps) => {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    backgroundColor: yogesh_1.colors.primaryGradient[0] + '15', // Light tint of first gradient color
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: yogesh_1.radius.tag,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    color: yogesh_1.colors.primaryGradient[0],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
