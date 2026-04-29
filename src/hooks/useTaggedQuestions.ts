import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { formatTagLabel, normalizeTag } from '../utils/tagUtils';

// MASTER SUBJECT LIST (The Total Taxonomy)
const MASTER_SUBJECTS = [
  'Polity', 'History', 'Economy', 'Geography', 'Environment', 
  'Science & Tech', 'CSAT', 'Art & Culture', 'Internal Security', 
  'International Relations', 'Social Issues', 'Governance', 'Ethics'
];

export interface TaggedQuestion {
  id: string;
  testId: string;
  testTitle?: string;
  subject: string;
  sectionGroup: string;
  microTopic: string;
  questionText: string;
  explanation: string;
  correctAnswer: string;
  selectedAnswer: string;
  options?: any;
  reviewTags: string[];
  normalizedReviewTags: string[];
  difficultyLevel?: string;
  createdAt: string;
}

export interface VaultMicroTopic {
  name: string;
  questions: TaggedQuestion[];
}

export interface VaultSectionGroup {
  name: string;
  microTopics: Record<string, VaultMicroTopic>;
  totalCount: number;
}

export interface VaultSubject {
  name: string;
  totalCount: number;
  sectionGroups: Record<string, VaultSectionGroup>;
}



export function useTaggedVault(userId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [rawQuestions, setRawQuestions] = useState<TaggedQuestion[]>([]);
  
  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');

  const fetchVaultData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const cacheKey = `tagged_vault_cache_${userId}`;
    
    // 0. Load from Cache First
    try {
      if (rawQuestions.length === 0) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setRawQuestions(JSON.parse(cached));
          // Don't set loading to true if we have cache
        } else {
          setLoading(true);
        }
      }
    } catch (e) {
      if (rawQuestions.length === 0) setLoading(true);
    }
    
    try {
      const { data: states, error: fetchError } = await supabase
        .from('question_states')
        .select('*')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);

      if (fetchError) throw fetchError;

      const filteredStates = (states || []).filter(row => {
        let tags = row.review_tags;
        if (typeof tags === 'string') {
          try { tags = JSON.parse(tags); } catch (e) { return false; }
        }
        return Array.isArray(tags) && tags.length > 0;
      });

      if (filteredStates.length === 0) {
        setRawQuestions([]);
        setLoading(false);
        return;
      }

      const questionIds = Array.from(new Set(filteredStates.map(row => row.question_id).filter(Boolean)));
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id, test_id, subject, section_group, micro_topic, question_text, explanation_markdown, correct_answer, options')
        .in('id', questionIds as string[]);

      if (questionsError) throw questionsError;

      const questionsById = new Map((questions || []).map(q => [q.id, q]));
      const testIds = Array.from(new Set((questions || []).map(q => q.test_id).filter(Boolean)));

      let testsById = new Map<string, string>();
      if (testIds.length > 0) {
        const { data: tests } = await supabase
          .from('tests')
          .select('id, title')
          .in('id', testIds as string[]);
        testsById = new Map((tests || []).map(t => [t.id, t.title || '']));
      }

      const transformed: TaggedQuestion[] = filteredStates
        .map(row => {
          const qData = questionsById.get(row.question_id);
          let tags = row.review_tags;
          if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch (e) { tags = []; } }

          return {
            id: row.question_id,
            testId: row.test_id || qData?.test_id,
            testTitle: testsById.get((qData?.test_id || row.test_id || '') as string) || 'Custom Session',
            subject: row.subject || qData?.subject || 'Unassigned',
            sectionGroup: row.section_group || qData?.section_group || 'General',
            microTopic: row.micro_topic || qData?.micro_topic || 'Unmapped',
            questionText: qData?.question_text || 'Question text not available',
            explanation: qData?.explanation_markdown || 'No explanation available',
            correctAnswer: row.correct_answer || qData?.correct_answer || '',
            selectedAnswer: row.selected_answer || '',
            options: qData?.options,
            reviewTags: (tags || []).map((tag: string) => formatTagLabel(tag)),
            normalizedReviewTags: (tags || []).map((tag: string) => normalizeTag(tag)),
            createdAt: row.updated_at || new Date().toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRawQuestions(transformed);
      
      // Save to cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify(transformed));

    } catch (err) {
      console.error('Vault Engine Error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchVaultData();
  }, [userId]);

  // The 3-Level Filtering & Grouping Logic
  const vaultData = useMemo(() => {
    const filtered = rawQuestions.filter(q => {
      const matchesSearch = searchQuery === '' || 
        q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.sectionGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.microTopic.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTag = selectedTag === 'All' || q.normalizedReviewTags.includes(normalizeTag(selectedTag));
      const matchesSubject = selectedSubject === 'All' || q.subject === selectedSubject;
      
      return matchesSearch && matchesTag && matchesSubject;
    });

    const subjects: Record<string, VaultSubject> = {};
    
    // Initialize with Master Subjects (Dummy Folders)
    MASTER_SUBJECTS.forEach(s => {
      subjects[s] = { name: s, totalCount: 0, sectionGroups: {} };
    });

    filtered.forEach(q => {
      if (!subjects[q.subject]) {
        subjects[q.subject] = { name: q.subject, totalCount: 0, sectionGroups: {} };
      }
      
      const secName = q.sectionGroup || 'General';
      if (!subjects[q.subject].sectionGroups[secName]) {
        subjects[q.subject].sectionGroups[secName] = { name: secName, microTopics: {}, totalCount: 0 };
      }
      
      const microName = q.microTopic || 'Unmapped';
      if (!subjects[q.subject].sectionGroups[secName].microTopics[microName]) {
        subjects[q.subject].sectionGroups[secName].microTopics[microName] = { name: microName, questions: [] };
      }
      
      subjects[q.subject].sectionGroups[secName].microTopics[microName].questions.push(q);
      subjects[q.subject].sectionGroups[secName].totalCount++;
      subjects[q.subject].totalCount++;
    });

    return {
      filteredQuestions: filtered,
      subjects: Object.values(subjects).sort((a, b) => b.totalCount - a.totalCount),
      totalCount: filtered.length,
      allSubjects: Array.from(new Set([...MASTER_SUBJECTS, ...rawQuestions.map(q => q.subject)])).sort()
    };
  }, [rawQuestions, searchQuery, selectedTag, selectedSubject]);

  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    rawQuestions.forEach(q => q.reviewTags.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet).sort();
  }, [rawQuestions]);

  return {
    loading,
    error,
    vaultData,
    uniqueTags,
    filters: {
      searchQuery,
      setSearchQuery,
      selectedTag,
      setSelectedTag,
      selectedSubject,
      setSelectedSubject
    },
    refresh: fetchVaultData
  };
}
