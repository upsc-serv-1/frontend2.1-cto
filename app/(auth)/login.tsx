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

export default function Login() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) return Alert.alert('Missing fields', 'Enter email and password.');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) return Alert.alert('Login failed', error);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.themePos}><ThemeSwitcher /></View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.brand, { color: colors.textPrimary }]}>GRADE1</Text>
          </View>
          <Text style={[styles.h1, { color: colors.textPrimary }]}>Welcome back.</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Master the concepts. Ace the exam.</Text>

          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { backgroundColor: colors.surface + '80', borderColor: colors.border, color: colors.textPrimary }]}
            />
            <Text style={[styles.label, { color: colors.textTertiary, marginTop: spacing.md }]}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { backgroundColor: colors.surface + '80', borderColor: colors.border, color: colors.textPrimary }]}
            />

            <TouchableOpacity testID="login-submit-button" style={[styles.cta, { backgroundColor: colors.primary }]} onPress={onLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.ctaText, { color: colors.buttonText }]}>Sign In</Text>}
            </TouchableOpacity>

            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity testID="goto-signup" style={styles.ghost}>
                <Text style={[styles.ghostText, { color: colors.textSecondary }]}>Don't have an account? <Text style={{ color: colors.primary }}>Create one</Text></Text>
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.lg },
  logoDot: { width: 12, height: 12, borderRadius: 3 },
  brand: { fontWeight: '900', letterSpacing: 4, fontSize: 14 },
  h1: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  sub: { marginTop: 8, fontSize: 15 },
  label: { fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 16, fontSize: 16 },
  cta: { padding: 18, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  ctaText: { fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  ghost: { marginTop: spacing.md, alignItems: 'center' },
  ghostText: { fontSize: 14 },
});
