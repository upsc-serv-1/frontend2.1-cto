import React from 'react';
import { TextInput, StyleSheet, View, Text, ViewStyle } from 'react-native';
import { yogesh_1 } from '../../themes/yogesh_1';

interface InputFieldProps {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: ViewStyle;
  secureTextEntry?: boolean;
}

export const InputField = ({ label, placeholder, value, onChangeText, style, secureTextEntry }: InputFieldProps) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={yogesh_1.colors.textSecondary + '80'}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: yogesh_1.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: yogesh_1.colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: yogesh_1.colors.card,
    borderWidth: 1,
    borderColor: yogesh_1.colors.border,
    borderRadius: yogesh_1.radius.input,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: yogesh_1.colors.textPrimary,
    fontWeight: '500',
  },
});
