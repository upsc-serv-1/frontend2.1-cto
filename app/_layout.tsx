import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider>
          <RootStack />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { theme, colors } = useTheme();
  
  // Decide if status bar should be light or dark based on theme brightness
  // Themes like 'ivory', 'sage', 'lavender', 'child_of_light' are light
  const isDarkTheme = theme.includes('dark') || theme.includes('midnight') || theme.includes('nebula') || theme.includes('night') || theme.includes('navy') || theme.includes('fuchsia') || theme.includes('emerald') || theme === 'modern';
  const statusBarStyle = isDarkTheme ? 'light' : 'dark';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={colors.bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <StatusBar style={statusBarStyle} translucent backgroundColor="transparent" />
      <Stack screenOptions={{ 
        headerShown: false, 
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
        animationDuration: 400,
        gestureEnabled: true,
      }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="notes" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
