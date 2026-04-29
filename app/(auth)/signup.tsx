import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { radius, spacing } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { ThemeSwitcher } from '../../src/components/ThemeSwitcher';

export default function Signup() {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!email || !password || !name) return Alert.alert('Missing fields', 'Fill all fields.');
    if (password.length < 6) return Alert.alert('Weak password', 'Password must be at least 6 characters.');
    setLoading(true);
    const { error } = await signUp(email.trim(), password, name.trim());
    setLoading(false);
    if (error) return Alert.alert('Signup failed', error);
    Alert.alert('Account created', 'Check your email if confirmation is required, then sign in.');
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} testID="signup-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.themePos}><ThemeSwitcher /></View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: colors.textPrimary }]}>Create account.</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Start your prep, track every attempt.</Text>

          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>NAME</Text>
            <TextInput testID="signup-name-input" value={name} onChangeText={setName} placeholder="Aspirant name" placeholderTextColor={colors.textTertiary} style={[styles.input, { backgroundColor: colors.surface + '80', borderColor: colors.border, color: colors.textPrimary }]} />
            <Text style={[styles.label, { color: colors.textTertiary, marginTop: spacing.md }]}>EMAIL</Text>
            <TextInput testID="signup-email-input" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.textTertiary} style={[styles.input, { backgroundColor: colors.surface + '80', borderColor: colors.border, color: colors.textPrimary }]} />
            <Text style={[styles.label, { color: colors.textTertiary, marginTop: spacing.md }]}>PASSWORD</Text>
            <TextInput testID="signup-password-input" value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 6 chars" placeholderTextColor={colors.textTertiary} style={[styles.input, { backgroundColor: colors.surface + '80', borderColor: colors.border, color: colors.textPrimary }]} />

            <TouchableOpacity testID="signup-submit-button" style={[styles.cta, { backgroundColor: colors.primary }]} onPress={onSignup} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.ctaText, { color: colors.buttonText }]}>Create Account</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity testID="goto-login" style={styles.ghost}>
                <Text style={[styles.ghostText, { color: colors.textSecondary }]}>Already registered? <Text style={{ color: colors.primary }}>Sign in</Text></Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  themePos: { position: 'absolute', top: 10, right: 20, zIndex: 1000 },
  h1: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  sub: { marginTop: 8, fontSize: 15 },
  label: { fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 16, fontSize: 16 },
  cta: { padding: 18, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  ctaText: { fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  ghost: { marginTop: spacing.md, alignItems: 'center' },
  ghostText: { fontSize: 14 },
});
