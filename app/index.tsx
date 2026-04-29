import { Redirect } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();

  console.log("[Route: index] Session:", !!session, "Loading:", loading);
  if (loading) {
    return (
      <View testID="splash-loader" style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
