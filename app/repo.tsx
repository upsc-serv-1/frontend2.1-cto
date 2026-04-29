import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Pressable, FlatList, TextInput, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, Layers, Database, Check, X, ChevronDown, Book } from 'lucide-react-native';
import { radius } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/context/ThemeContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';

const { width } = Dimensions.get('window');

const SelectionModal = ({ visible, onClose, onSelect, items, title, selectedValue }: any) => {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const filteredItems = useMemo(() => items.filter((item: any) => item && item.toLowerCase().includes(search.toLowerCase())), [items, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.textPrimary} size={24} /></TouchableOpacity>
          </View>
          <View style={[styles.modalSearchBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Search color={colors.textTertiary} size={18} style={{ marginRight: 10 }} />
            <TextInput style={[styles.modalSearchInput, { color: colors.textPrimary }]} placeholder="Search..." value={search} onChangeText={setSearch} placeholderTextColor={colors.textTertiary} />
          </View>
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.modalItem, { borderBottomColor: colors.border }, selectedValue === item && { backgroundColor: colors.primary + '15' }]} 
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.modalItemText, { color: colors.textSecondary }, selectedValue === item && { color: colors.primaryDark, fontWeight: '800' }]}>{item}</Text>
                {selectedValue === item && <Check color={colors.primaryDark} size={18} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );
};

const SelectorCard = ({ label, value, placeholder, icon: Icon, onPress, disabled = false }: any) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={[styles.selectorCard, { borderBottomColor: colors.border }, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Icon color={colors.primary} size={20} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.selectorLabel, { color: colors.textTertiary }]}>{label}</Text>
        <Text style={[styles.selectorValue, { color: colors.textPrimary }, !value && { color: colors.textTertiary }]} numberOfLines={1}>{value || placeholder}</Text>
      </View>
      <ChevronDown color={colors.textTertiary} size={18} />
    </TouchableOpacity>
  );
};

export default function PapersScreen() {
  const { colors } = useTheme();
  const [examStage, setExamStage] = useState<'Prelims' | 'Mains'>('Prelims');
  const [selectedInstitutes, setSelectedInstitutes] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("All Subjects");
  const [selectedSection, setSelectedSection] = useState<string>("All Sections");
  
  const [institutes, setInstitutes] = useState<string[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState<'subject' | 'section' | null>(null);
  const [subjects, setSubjects] = useState<string[]>(["All Subjects"]);
  const [sections, setSections] = useState<string[]>(["All Sections"]);

  useEffect(() => { fetchDynamicFilters(); }, [examStage, selectedInstitutes, selectedPrograms]);
  useEffect(() => { fetchPapers(); }, [examStage, selectedInstitutes, selectedPrograms, selectedSubject, selectedSection]);

  const fetchDynamicFilters = async () => {
    const { data: testMeta } = await supabase.from('tests')
      .select('institute, program_name, subject, section_group')
      .ilike('series', `%${examStage}%`);
    
    if (testMeta) {
      setInstitutes(Array.from(new Set(testMeta.map(t => t.institute).filter(Boolean))).sort());
      const filteredTests = selectedInstitutes.length > 0 ? testMeta.filter(t => selectedInstitutes.includes(t.institute)) : testMeta;
      setPrograms(Array.from(new Set(filteredTests.map(t => t.program_name).filter(Boolean))).sort());
      const foundSubjects = Array.from(new Set(filteredTests.map(t => t.subject))).filter(Boolean) as string[];
      setSubjects(["All Subjects", ...foundSubjects.sort()]);

      if (selectedSubject !== 'All Subjects') {
        const subjectData = filteredTests.filter(t => t.subject === selectedSubject);
        const foundSections = Array.from(new Set(subjectData.map(t => t.section_group))).sort() as (string | null)[];
        setSections(["All Sections", ...foundSections.map(s => s === null ? "General" : s)]);
      }
    }
  };

  const fetchPapers = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('tests').select('*').ilike('series', `%${examStage}%`);
      if (selectedInstitutes.length > 0) query = query.in('institute', selectedInstitutes);
      if (selectedPrograms.length > 0) query = query.in('program_name', selectedPrograms);
      if (selectedSubject !== "All Subjects") query = query.eq('subject', selectedSubject);
      if (selectedSection !== "All Sections") query = query.eq('section_group', selectedSection === "General" ? null : selectedSection);
      
      const { data } = await query.order('launch_year', { ascending: false });
      setPapers(data || []);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const toggle = (val: string, list: string[], setter: (v: string[]) => void, allItems?: string[]) => {
    if (val === 'select_all' && allItems) setter([...allItems]);
    else if (val === 'clear_all') setter([]);
    else if (list.includes(val)) setter(list.filter(i => i !== val));
    else setter([...list, val]);
  };

  const isAllSelected = (list: string[], all: string[]) => list.length === all.length && all.length > 0;

  const FilterStrip = ({ title, items, selected, onSelect, multi = false }: any) => {
    const isSelected = (item: string) => {
      if (multi) return Array.isArray(selected) && selected.includes(item);
      return selected === item;
    };
    const handleSelect = (item: string) => {
      if (item === 'All') {
        onSelect(multi ? [] : 'All');
        return;
      }
      if (multi) {
        const prev = Array.isArray(selected) ? selected : [];
        if (prev.includes(item)) onSelect(prev.filter(i => i !== item));
        else onSelect([...prev, item]);
      } else {
        onSelect(item);
      }
    };
    const isAll = !selected || (Array.isArray(selected) && selected.length === 0) || selected === 'All' || selected === 'All Subjects';
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.stripTitle, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
          <TouchableOpacity 
            style={[
              styles.chip, 
              { backgroundColor: colors.surface, borderColor: colors.border }, 
              isAll && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
            ]} 
            onPress={() => handleSelect('All')}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isAll && { color: colors.buttonText, fontWeight: '800' }]}>All</Text>
          </TouchableOpacity>
          {items.map((item: string) => (
            <TouchableOpacity 
              key={item} 
              style={[
                styles.chip, 
                { backgroundColor: colors.surface, borderColor: colors.border }, 
                isSelected(item) && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
              ]} 
              onPress={() => handleSelect(item)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, isSelected(item) && { color: colors.buttonText, fontWeight: '800' }]}>{item}</Text>
              {multi && isSelected(item) && <Check size={12} color={colors.buttonText} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <PageWrapper>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft color={colors.textPrimary} size={28} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Paper Hub</Text>
        <ThemeSwitcher />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: colors.primaryDark }]}>SEARCH ACROSS</Text>
        <View style={[styles.filterGroup, { backgroundColor: colors.surface + '50', padding: 15, borderRadius: 20, marginHorizontal: 20, borderWidth: 1, borderColor: colors.border }]}>
          <FilterStrip title="Exam Stage" items={['Prelims', 'Mains']} selected={examStage} onSelect={setExamStage} />
          <FilterStrip title="Institute" items={institutes} selected={selectedInstitutes} onSelect={setSelectedInstitutes} multi />
          <FilterStrip title="Program" items={programs} selected={selectedPrograms} onSelect={setSelectedPrograms} multi />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.primaryDark }]}>SYLLABUS FILTERS</Text>
        <View style={[styles.filterGroup, { backgroundColor: colors.surface + '50', padding: 15, borderRadius: 20, marginHorizontal: 20, borderWidth: 1, borderColor: colors.border }]}>
          <View style={[styles.cardGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SelectorCard label="Subject" value={selectedSubject} icon={Book} onPress={() => setModal('subject')} />
            <SelectorCard label="Section" value={selectedSection} icon={Layers} onPress={() => setModal('section')} disabled={selectedSubject === "All Subjects"} />
          </View>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={[styles.sectionLabel, { color: colors.primaryDark, marginLeft: 0 }]}>AVAILABLE PAPERS ({papers.length})</Text>
        </View>
        
        <View style={styles.paperList}>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : (
            papers.map(paper => (
              <TouchableOpacity 
                key={paper.id} 
                style={[styles.paperCard, { backgroundColor: colors.surface, borderColor: colors.border }]} 
                onPress={() => router.push({ pathname: '/test/custom', params: { title: paper.title, type: 'test', filter: paper.id } })}
              >
                <View style={[styles.paperIcon, { backgroundColor: colors.primary + '15' }]}><Database color={colors.primary} size={20} /></View>
                <View style={styles.paperInfo}>
                  <Text style={[styles.paperTitle, { color: colors.textPrimary }]}>{paper.title}</Text>
                  <Text style={[styles.paperMeta, { color: colors.textTertiary }]}>{paper.institute} • {paper.launch_year || '2024'} • {paper.question_count} Qs</Text>
                </View>
                <ChevronRight color={colors.textTertiary} size={18} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <SelectionModal visible={modal === 'subject'} onClose={() => setModal(null)} onSelect={setSelectedSubject} items={subjects} title="Select Subject" selectedValue={selectedSubject} />
      <SelectionModal visible={modal === 'section'} onClose={() => setModal(null)} onSelect={setSelectedSection} items={sections} title="Select Section" selectedValue={selectedSection} />
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', flex: 1 },
  scrollContent: { paddingBottom: 100 },
  stripTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  chipText: { fontSize: 12, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 16, marginTop: 16, textTransform: 'uppercase', marginLeft: 20 },
  filterGroup: { marginBottom: 24 },
  cardGroup: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  selectorCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  selectorLabel: { fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
  selectorValue: { fontSize: 15, fontWeight: '700' },
  resultsHeader: { paddingHorizontal: 20 },
  paperList: { paddingHorizontal: 20 },
  paperCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: radius.lg, borderWidth: 1, marginBottom: 12 },
  paperIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  paperInfo: { flex: 1 },
  paperTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  paperMeta: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: radius.xl, height: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalSearchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 12, height: 44, marginBottom: 16, borderWidth: 1 },
  modalSearchInput: { flex: 1, fontSize: 14 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemText: { fontSize: 16, fontWeight: '600' },
});
