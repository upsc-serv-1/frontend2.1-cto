import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'default' | 'nature' | 'modern' | 'sand' | 'cute' | 'medical' | 'sage' | 'lavender' | 'ivory' | 'midnight_nebula' | 'golden_night' | 'emerald_dream' | 'royal_purple' | 'fitness_navy' | 'child_of_light' | 'aruba_aqua' | 'zinnia' | 'fuchsia_blue' | 'original_dark' | 'yogesh_1' | 'yogesh_2' | 'yogesh_3' | 'yogesh_4';

export interface ThemeColors {
  bg: string;
  bgGradient: string[];
  surface: string;
  surfaceStrong: string;
  primary: string;
  primaryDark: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  buttonText: string;
  primaryGradient?: string[];
}

export const themes: Record<ThemeType, ThemeColors> = {
  default: {
    bg: '#f8fafc',
    bgGradient: ['#f8fafc', '#f1f5f9'],
    surface: '#ffffff',
    surfaceStrong: '#f1f5f9',
    primary: '#7C3AED',
    primaryDark: '#5B21B6',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    border: '#e2e8f0',
    accent: '#7C3AED',
    buttonText: '#ffffff',
  },
  nature: {
    bg: '#f4faf6',
    bgGradient: ['#f4faf6', '#eef7f1'],
    surface: '#fbfffb',
    surfaceStrong: '#f1f8f3',
    primary: '#34d399',
    primaryDark: '#059669',
    textPrimary: '#1f3d2b',
    textSecondary: '#475569',
    textTertiary: '#7a8f85',
    border: '#d6e5dc',
    accent: '#34d399',
    buttonText: '#ffffff',
  },
  modern: {
    bg: '#f7fafb',
    bgGradient: ['#f7fafb', '#eef3f6'],
    surface: '#ffffff',
    surfaceStrong: '#eef3f6',
    primary: '#14b8a6',
    primaryDark: '#0d9488',
    textPrimary: '#1e2a38',
    textSecondary: '#6b7280',
    textTertiary: '#94a3b8',
    border: '#dce5eb',
    accent: '#14b8a6',
    buttonText: '#ffffff',
  },
  sand: {
    bg: '#fcfaf5',
    bgGradient: ['#fcfaf5', '#f8f3ea'],
    surface: '#fffdf9',
    surfaceStrong: '#f8f3ea',
    primary: '#c89b5c',
    primaryDark: '#a37c46',
    textPrimary: '#2f2a24',
    textSecondary: '#7a7164',
    textTertiary: '#a69e8a',
    border: '#e7ddcf',
    accent: '#c89b5c',
    buttonText: '#ffffff',
  },
  cute: {
    bg: '#fff8fc',
    bgGradient: ['#fff8fc', '#fff0f7'],
    surface: '#fffafb',
    surfaceStrong: '#fff0f7',
    primary: '#f29bc1',
    primaryDark: '#db2777',
    textPrimary: '#4f3556',
    textSecondary: '#8b6f8f',
    textTertiary: '#b0a0b8',
    border: '#f0d7e8',
    accent: '#f29bc1',
    buttonText: '#ffffff',
  },
  medical: {
    bg: '#f4fbfc',
    bgGradient: ['#f4fbfc', '#edf8fa'],
    surface: '#fcffff',
    surfaceStrong: '#edf8fa',
    primary: '#2ec4b6',
    primaryDark: '#0891b2',
    textPrimary: '#17324a',
    textSecondary: '#648091',
    textTertiary: '#94a3b8',
    border: '#d7e8ef',
    accent: '#2ec4b6',
    buttonText: '#ffffff',
  },
  sage: {
    bg: '#F0F7F4',
    bgGradient: ['#F0F7F4', '#E6F0EA'],
    surface: '#F9FCFA',
    surfaceStrong: '#E6F0EA',
    primary: '#7BAE7F',
    primaryDark: '#568A5A',
    textPrimary: '#2D3A2E',
    textSecondary: '#4A5D4B',
    textTertiary: '#8E9E8F',
    border: '#DDE8E0',
    accent: '#7BAE7F',
    buttonText: '#ffffff',
  },
  lavender: {
    bg: '#F6F5FA',
    bgGradient: ['#F6F5FA', '#EEEBF5'],
    surface: '#FBFBFF',
    surfaceStrong: '#EEEBF5',
    primary: '#9D8DF1',
    primaryDark: '#7966E3',
    textPrimary: '#3D3556',
    textSecondary: '#5D547F',
    textTertiary: '#8E8AA6',
    border: '#E3E0EF',
    accent: '#9D8DF1',
    buttonText: '#ffffff',
  },
  ivory: {
    bg: '#FAF9F6',
    bgGradient: ['#FAF9F6', '#F3F1EB'],
    surface: '#FFFEFB',
    surfaceStrong: '#F3F1EB',
    primary: '#B8A375',
    primaryDark: '#8E7D59',
    textPrimary: '#4A4435',
    textSecondary: '#6D6551',
    textTertiary: '#A69E8A',
    border: '#E9E4D6',
    accent: '#B8A375',
    buttonText: '#ffffff',
  },
  midnight_nebula: {
    bg: '#0B0E14',
    bgGradient: ['#0B0E14', '#151921'],
    surface: '#1C212B',
    surfaceStrong: '#252B36',
    primary: '#3E7BFA',
    primaryDark: '#2D5BBA',
    textPrimary: '#FFFFFF',
    textSecondary: '#8F9BB3',
    textTertiary: '#5D677A',
    border: '#2E3A59',
    accent: '#3E7BFA',
    buttonText: '#ffffff',
  },
  golden_night: {
    bg: '#121212',
    bgGradient: ['#121212', '#1A1A1A'],
    surface: '#242424',
    surfaceStrong: '#2D2D2D',
    primary: '#FFB800',
    primaryDark: '#C68F00',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#737373',
    border: '#333333',
    accent: '#FFB800',
    buttonText: '#000000',
  },
  emerald_dream: {
    bg: '#18191A',
    bgGradient: ['#18191A', '#242526'],
    surface: '#3A3B3C',
    surfaceStrong: '#4E4F50',
    primary: '#2ECC71',
    primaryDark: '#27AE60',
    textPrimary: '#E4E6EB',
    textSecondary: '#B0B3B8',
    textTertiary: '#72767D',
    border: '#4E4F50',
    accent: '#2ECC71',
    buttonText: '#ffffff',
  },
  royal_purple: {
    bg: '#121212',
    bgGradient: ['#121212', '#1E1E1E'],
    surface: '#252525',
    surfaceStrong: '#303030',
    primary: '#8B5CF6',
    primaryDark: '#7C3AED',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    border: '#374151',
    accent: '#8B5CF6',
    buttonText: '#ffffff',
  },
  fitness_navy: {
    bg: '#1B223C',
    bgGradient: ['#1B223C', '#242B4D'],
    surface: '#2E365F',
    surfaceStrong: '#3E487A',
    primary: '#00D2D3',
    primaryDark: '#01A3A4',
    textPrimary: '#FFFFFF',
    textSecondary: '#A3A8BC',
    textTertiary: '#6B7280',
    border: '#3E487A',
    accent: '#00D2D3',
    buttonText: '#ffffff',
  },
  child_of_light: {
    bg: '#EFF4F8',
    bgGradient: ['#EFF4F8', '#C5D0CF'],
    surface: '#FFFFFF',
    surfaceStrong: '#F8FAFC',
    primary: '#273E41',
    primaryDark: '#020101',
    textPrimary: '#020101',
    textSecondary: '#706255',
    textTertiary: '#A1A19C',
    border: '#C5D0CF',
    accent: '#273E41',
    buttonText: '#ffffff',
  },
  aruba_aqua: {
    bg: '#F0F4F8',
    bgGradient: ['#F0F4F8', '#D2DDD4'],
    surface: '#FFFFFF',
    surfaceStrong: '#F8FAFC',
    primary: '#233E42',
    primaryDark: '#5E6161',
    textPrimary: '#233E42',
    textSecondary: '#5E6161',
    textTertiary: '#A1ACAC',
    border: '#D2DDD4',
    accent: '#233E42',
    buttonText: '#ffffff',
  },
  zinnia: {
    bg: '#FCFCFB',
    bgGradient: ['#FCFCFB', '#DBD7C7'],
    surface: '#FFFFFF',
    surfaceStrong: '#FDFCFB',
    primary: '#FAA114',
    primaryDark: '#786E67',
    textPrimary: '#786E67',
    textSecondary: '#B3AA9E',
    textTertiary: '#DBD7C7',
    border: '#DBD7C7',
    accent: '#FAA114',
    buttonText: '#ffffff',
  },
  fuchsia_blue: {
    bg: '#30292F',
    bgGradient: ['#30292F', '#121212'],
    surface: '#3F353E',
    surfaceStrong: '#4A3E49',
    primary: '#8450CB',
    primaryDark: '#EAB901',
    textPrimary: '#FFFFFF',
    textSecondary: '#F7E8CF',
    textTertiary: '#90A994',
    border: '#3F353E',
    accent: '#8450CB',
    buttonText: '#ffffff',
  },
  original_dark: {
    bg: '#0A0A0A',
    bgGradient: ['#0A0A0A', '#121212'],
    surface: '#121212',
    surfaceStrong: '#1A1A1A',
    primary: '#FFC800',
    primaryDark: '#D4A600',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textTertiary: '#52525B',
    border: '#27272A',
    accent: '#FFC800',
    buttonText: '#000000',
  },
  yogesh_1: {
    bg: '#F7F8FC',
    bgGradient: ['#F7F8FC', '#F0F2F9'],
    surface: '#FFFFFF',
    surfaceStrong: '#F0F2F9',
    primary: '#FF6A88',
    primaryDark: '#6A5BFF',
    textPrimary: '#1E1E2D',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    accent: '#FF8E53',
    buttonText: '#FFFFFF',
    primaryGradient: ['#FF6A88', '#FF8E53', '#6A5BFF'],
  },
  yogesh_2: {
    bg: '#F7F8FC',
    bgGradient: ['#F7F8FC', '#F0F2F9'],
    surface: '#FFFFFF',
    surfaceStrong: '#F0F2F9',
    primary: '#FF6A88',
    primaryDark: '#6A5BFF',
    textPrimary: '#1E1E2D',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    accent: '#FF8E53',
    buttonText: '#FFFFFF',
    primaryGradient: ['#FF6A88', '#FF8E53', '#6A5BFF'],
  },
  yogesh_3: {
    bg: '#7B2CBF',
    bgGradient: ['#7B2CBF', '#C77DFF'],
    surface: '#ffffff',
    surfaceStrong: '#F3E8FF',
    primary: '#7B2CBF',
    primaryDark: '#5A189A',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textTertiary: '#888888',
    border: '#D0D0D0',
    accent: '#C77DFF',
    buttonText: '#ffffff',
    primaryGradient: ['#7B2CBF', '#9D4EDD', '#C77DFF'],
  },
  yogesh_4: {
    bg: '#FDFBF7',
    bgGradient: ['#FDFBF7', '#F8F4ED'],
    surface: '#ffffff',
    surfaceStrong: '#F3E8FF',
    primary: '#2C3E50',
    primaryDark: '#1A252F',
    textPrimary: '#1A1A1A',
    textSecondary: '#4A4A4A',
    textTertiary: '#95A5A6',
    border: '#E0DCD3',
    accent: '#800000',
    buttonText: '#ffffff',
    primaryGradient: ['#2C3E50', '#34495E'],
  }
};

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeType>('default');

  useEffect(() => {
    AsyncStorage.getItem('user-theme').then(t => {
      if (t) setThemeState(t as ThemeType);
    });
  }, []);

  const setTheme = async (t: ThemeType) => {
    setThemeState(t);
    await AsyncStorage.setItem('user-theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: themes[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
