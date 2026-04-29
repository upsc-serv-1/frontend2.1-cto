import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { yogesh_1 } from '../../themes/yogesh_1';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const GradientButton = ({ title, onPress, style, textStyle }: GradientButtonProps) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.container, style]}>
      <LinearGradient
        colors={yogesh_1.colors.primaryGradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      >
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    width: '100%',
    borderRadius: yogesh_1.radius.button,
    overflow: 'hidden',
    ...yogesh_1.shadows.soft,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    color: yogesh_1.colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
