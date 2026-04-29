import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Home, BarChart2, RotateCcw, LayoutList, Tag, Target, FileText, BarChart3, Layers, ArrowUp, ArrowDown, Save } from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { TabConfigService, TabKey } from '../src/services/TabConfigService';

const ALL_TABS: { key: TabKey; title: string; icon: any }[] = [
  { key: 'index', title: 'Home', icon: Home },
  { key: 'arena', title: 'Arena', icon: Target },
  { key: 'analyse', title: 'Analyse', icon: BarChart2 },
  { key: 'pyq', title: 'PYQs', icon: BarChart3 },
  { key: 'flashcards', title: 'Cards', icon: Layers },
  { key: 'tags', title: 'Tags', icon: Tag },
  { key: 'notes', title: 'Notes', icon: FileText },
  { key: 'revise', title: 'Revise', icon: RotateCcw },
  { key: 'tracker', title: 'Tracker', icon: LayoutList },
];

export default function CustomizeTabsScreen() {
  const { colors } = useTheme();
  const [order, setOrder] = useState<TabKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    const stored = await TabConfigService.getTabOrder();
    setOrder(stored);
    setLoading(false);
  };

  const saveOrder = async () => {
    if (order.length === 0) {
      Alert.alert("Error", "You must have at least one tab visible.");
      return;
    }
    await TabConfigService.setTabOrder(order);
    Alert.alert("Success", "Navigation updated!");
    router.back();
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...order];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setOrder(newOrder);
  };

  const toggleTab = (key: TabKey) => {
    if (order.includes(key)) {
      if (order.length <= 1) return;
      setOrder(order.filter(k => k !== key));
    } else {
      // Find where to insert it based on ALL_TABS default or just at the end
      setOrder([...order, key]);
    }
  };

  if (loading) return null;

  return (
    <PageWrapper>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft color={colors.textPrimary} size={28} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Navigation</Text>
        <TouchableOpacity onPress={saveOrder} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
          <Save color="#FFF" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACTIVE TABS (ORDER)</Text>
        <View style={[styles.listContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {order.map((key, index) => {
            const def = ALL_TABS.find(t => t.key === key);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <View key={key} style={[styles.row, index < order.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Icon color={colors.primary} size={20} />
                <Text style={[styles.tabTitle, { color: colors.textPrimary }]}>{def.title}</Text>
                
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => moveItem(index, 'up')} disabled={index === 0} style={styles.moveBtn}>
                    <ArrowUp color={index === 0 ? colors.textTertiary : colors.textSecondary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveItem(index, 'down')} disabled={index === order.length - 1} style={styles.moveBtn}>
                    <ArrowDown color={index === order.length - 1 ? colors.textTertiary : colors.textSecondary} size={18} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 32 }]}>AVAILABLE TABS</Text>
        <View style={[styles.listContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ALL_TABS.map((tab, index) => (
            <View key={tab.key} style={[styles.row, index < ALL_TABS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <tab.icon color={colors.textSecondary} size={20} />
              <Text style={[styles.tabTitle, { color: colors.textPrimary }]}>{tab.title}</Text>
              <Switch 
                value={order.includes(tab.key)} 
                onValueChange={() => toggleTab(tab.key)}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          ))}
        </View>
        
        <Text style={styles.hint}>Tabs will appear in the bottom bar in the order shown above. Scroll the bar to see more.</Text>
      </ScrollView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', flex: 1 },
  saveBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 },
  listContainer: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  tabTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  moveBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.03)' },
  hint: { fontSize: 13, color: 'rgba(0,0,0,0.4)', textAlign: 'center', marginTop: 24, lineHeight: 18, paddingHorizontal: 20 }
});
