import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Modal, Pressable, ScrollView } from 'react-native';
import { useTheme, themes, ThemeType } from '../context/ThemeContext';
import { ChevronDown, Palette, Check } from 'lucide-react-native';

export const ThemeSwitcher = () => {
  const { theme, setTheme, colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themeList: ThemeType[] = [
    'default', 'nature', 'modern', 'sand', 'cute', 'medical', 
    'sage', 'lavender', 'ivory', 
    'midnight_nebula', 'golden_night', 'emerald_dream', 'royal_purple', 'fitness_navy',
    'child_of_light', 'aruba_aqua', 'zinnia', 'fuchsia_blue', 'original_dark', 'yogesh_1', 'yogesh_2', 'yogesh_3', 'yogesh_4'
  ];

  const getThemeName = (t: string) => {
    const originals = ['default', 'nature', 'modern', 'sand', 'cute', 'medical', 'original_dark'];
    const zen = [
      'sage', 'lavender', 'ivory', 'midnight_nebula', 'golden_night', 'emerald_dream', 
      'royal_purple', 'fitness_navy', 'child_of_light', 'aruba_aqua', 'zinnia', 'fuchsia_blue'
    ];
    const name = t.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    if (originals.includes(t)) return `Original ${name}`;
    if (zen.includes(t)) return `Zen ${name}`;
    return name;
  };

  return (
    <View style={{ zIndex: 9999 }}>
      <TouchableOpacity 
        style={[
          styles.trigger, 
          { 
            backgroundColor: colors.surface + 'CC', 
            borderColor: colors.primary,
            borderWidth: 1.5,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4
          }
        ]} 
        onPress={() => setIsOpen(true)}
      >
        <Palette size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownTitle, { color: colors.textPrimary }]}>Choose Theme</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {themeList.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    setTheme(t);
                    setIsOpen(false);
                  }}
                  style={[
                    styles.item,
                    theme === t && { backgroundColor: colors.primary + '10' }
                  ]}
                >
                  <View style={[styles.itemColor, { backgroundColor: themes[t].primary }]} />
                  <Text style={[
                    styles.itemText, 
                    { color: colors.textSecondary },
                    theme === t && { color: colors.primaryDark, fontWeight: '800' }
                  ]}>
                    {getThemeName(t)}
                  </Text>
                  {theme === t && <Check size={16} color={colors.primaryDark} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  colorPreview: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dropdown: {
    width: '100%',
    maxWidth: 260,
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  dropdownHeader: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  itemColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
