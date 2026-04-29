import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  ChevronDown,
  ChevronLeft,
  Download,
  Grid,
  LineChart as LineIcon,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { PieChart, LineChart } from '../src/components/Charts';
import { useTheme } from '../src/context/ThemeContext';
import { prelimsTaxonomy } from '../src/data/taxonomy';

const { width } = Dimensions.get('window');

const EXAM_STAGES = ['Prelims', 'Mains'];
const PAPERS = {
  Prelims: ['GS Paper 1', 'GS Paper 2 (CSAT)'],
  Mains: ['GS Paper 1', 'GS Paper 2', 'GS Paper 3', 'GS Paper 4', 'Optional'],
};
const RANGE_OPTIONS = ['Only 2025', 'Last 5 Years', 'Last 10 Years', 'All (2013-2025)', 'Custom Range'];
const TREND_PALETTE = ['#2563eb', '#14b8a6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
const PYQ_PAGE_SIZE = 1000;

type HubKey = 'overview' | 'heatmaps' | 'focused';

export default function PyqAnalysisTab({ isEmbedded }: { isEmbedded?: boolean }) {
  const { colors } = useTheme();
  const taxonomyMaps = useMemo(() => {
    const microToSubject: Record<string, string> = {};
    const sectionToSubject: Record<string, string> = {};
    prelimsTaxonomy.forEach(entry => {
      if (entry.microTopic) microToSubject[entry.microTopic.trim().toLowerCase()] = entry.subject;
      if (entry.sectionGroup) sectionToSubject[entry.sectionGroup.trim().toLowerCase()] = entry.subject;
    });
    return { microToSubject, sectionToSubject };
  }, []);

  const [loading, setLoading] = useState(false);
  const [examStage, setExamStage] = useState('Prelims');
  const [selectedPaper, setSelectedPaper] = useState('GS Paper 1');
  const [selectedRange, setSelectedRange] = useState('Last 10 Years');
  const [customYearStart, setCustomYearStart] = useState('2020');
  const [customYearEnd, setCustomYearEnd] = useState('2025');
  const [activeHub, setActiveHub] = useState<HubKey>('overview');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'stage' | 'paper' | 'range' | null>(null);

  const [rawQuestions, setRawQuestions] = useState<any[]>([]);
  const [testsMetaById, setTestsMetaById] = useState<Record<string, any>>({});
  const [distributionData, setDistributionData] = useState<Array<{ name: string; value: number }>>([]);
  const [heatmapData, setHeatmapData] = useState<Record<string, Record<string, number>>>({});
  const [topicYearHeatmap, setTopicYearHeatmap] = useState<Record<string, Record<string, number>>>({});
  const [topTopics, setTopTopics] = useState<string[]>([]);
  const [trendSubjects, setTrendSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [heatmapSubject, setHeatmapSubject] = useState<string>('All');
  const [sectionData, setSectionData] = useState<Array<{ name: string; value: number }>>([]);
  const [microTopicData, setMicroTopicData] = useState<Array<{ name: string; value: number }>>([]);
  const [focusSubject, setFocusSubject] = useState('All');
  const [focusSection, setFocusSection] = useState('All');
  const [focusMicro, setFocusMicro] = useState('All');

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPyqData();
  }, [examStage, selectedPaper, selectedRange, customYearStart, customYearEnd]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [loading]);

  const getAnalyticsSubject = (q: any) => {
    const micro = String(q.micro_topic || '').trim();
    const section = String(q.section_group || '').trim();
    const rawSubject = String(q.subject || '').trim();
    const lowerSubject = rawSubject.toLowerCase();

    if (micro && taxonomyMaps.microToSubject[micro.toLowerCase()]) {
      return taxonomyMaps.microToSubject[micro.toLowerCase()];
    }
    if (section && taxonomyMaps.sectionToSubject[section.toLowerCase()]) {
      return taxonomyMaps.sectionToSubject[section.toLowerCase()];
    }

    const isCsat = /(^|\b)(csat|aptitude|comprehension|logical reasoning|maths|numeracy|paper\s*ii|paper\s*2)(\b|$)/i.test(`${rawSubject} ${section}`);
    if (isCsat) return 'CSAT';
    if (rawSubject && taxonomyMaps.sectionToSubject[lowerSubject]) {
      return taxonomyMaps.sectionToSubject[lowerSubject];
    }
    return rawSubject || 'Miscellaneous';
  };

  const getAnalyticsYear = (q: any) => {
    const test = testsMetaById[String(q.test_id)] || {};
    const y = q.exam_year || q.year || q.launch_year || q.source?.year || test.launch_year || test.exam_year;
    const num = parseInt(String(y), 10);
    return Number.isFinite(num) && num > 1900 ? num : null;
  };

  const parseYearRange = () => {
    const start = parseInt(customYearStart, 10);
    const end = parseInt(customYearEnd, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  };

  const extractYearFromTitle = (value: string) => {
    const match = String(value || '').match(/(20\d{2})/);
    return match ? parseInt(match[1], 10) : null;
  };

  const normalizePyqPaperGroup = (value = '', fallbackStage = '') => {
    const text = String(value || '').trim().toLowerCase();
    const stage = String(fallbackStage || '').trim().toLowerCase();
    if (!text) return '';
    if (text === 'gs paper 1' || text === 'paper 1' || text === 'gs1' || text === 'pre_gs1' || text.includes('gs paper 1')) return 'GS Paper 1';
    if (text === 'csat' || text === 'gs paper 2' || text === 'paper 2' || text === 'gs2' || text === 'pre_csat' || text.includes('csat') || text.includes('paper 2') || (text === 'pre_gs2' && stage.includes('prelim'))) return 'GS Paper 2';
    if (text === 'gs paper 3' || text === 'paper 3' || text === 'gs3') return 'GS Paper 3';
    if (text === 'gs paper 4' || text === 'paper 4' || text === 'gs4') return 'GS Paper 4';
    return String(value || '').trim();
  };

  const resolveTestPaperGroup = (test: any) =>
    normalizePyqPaperGroup(
      test.section_group || test.sectionGroup || test.level || test.title || '',
      test.level || test.series || ''
    );

  const getTestYear = (test: any) => {
    const num = Number(test?.launch_year || test?.exam_year || extractYearFromTitle(test?.title || ''));
    return Number.isFinite(num) && num > 1900 ? num : null;
  };

  const matchesYearRange = (year: number | null) => {
    if (!year) return false;
    if (selectedRange === 'Only 2025') return year === 2025;
    if (selectedRange === 'Last 5 Years') return year >= 2021;
    if (selectedRange === 'Last 10 Years') return year >= 2016;
    if (selectedRange === 'Custom Range') {
      const range = parseYearRange();
      if (!range) return true;
      return year >= range.start && year <= range.end;
    }
    return true;
  };

  const fetchQuestionsForTests = async (testIds: string[]) => {
    const rows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .in('test_id', testIds)
        .order('test_id', { ascending: true })
        .order('question_number', { ascending: true })
        .range(from, from + PYQ_PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < PYQ_PAGE_SIZE) break;
      from += PYQ_PAGE_SIZE;
    }
    return rows;
  };

  const fetchPyqData = async (bypassCache = false) => {
    const stageNorm = examStage.toLowerCase();
    const targetPaperGroup = normalizePyqPaperGroup(selectedPaper, examStage);
    const cacheKey = `pyq_cache_${stageNorm}_${targetPaperGroup.replace(/\s+/g, '_')}_${selectedRange.replace(/\s+/g, '_')}`;

    if (!bypassCache) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setRawQuestions(parsed.questions || []);
          setTestsMetaById(parsed.testsMeta || {});
          processAnalytics(parsed.questions || []);
          // Optional: skip network if cache is very fresh (e.g. < 24h)
        } else {
          setLoading(true);
        }
      } catch (e) {
        setLoading(true);
      }
    }

    try {
      const { data: tests, error: testError } = await supabase
        .from('tests')
        .select('id, title, subject, level, paper_type, section_group, exam_year, launch_year, institute, program_id, program_name, series');
      if (testError) throw testError;
      const relevantTests = (tests || []).filter((test: any) => {
        const institute = String(test.institute || '').trim().toLowerCase();
        const programId = String(test.program_id || '').trim().toLowerCase();
        const programName = String(test.program_name || '').trim().toLowerCase();
        const series = String(test.series || '').trim().toLowerCase();
        const paperType = String(test.paper_type || '').trim().toLowerCase();

        if (institute !== 'upsc') return false;
        if (programId !== 'cse' && programName !== 'cse') return false;
        if (series !== 'prelims (official)') return false;
        if (paperType && !['test-paper', 'question bank'].includes(paperType)) return false;
        if (stageNorm !== 'prelims') return false;
        return resolveTestPaperGroup(test) === targetPaperGroup;
      });
      const visibleTests = relevantTests.filter((test: any) => matchesYearRange(getTestYear(test)));

      if (visibleTests.length === 0) {
        clearComputedState();
        setRawQuestions([]);
        setTestsMetaById({});
        return;
      }

      const testIds = visibleTests.map((test: any) => test.id);
      const testsMetaMap = Object.fromEntries(visibleTests.map((test: any) => [String(test.id), test]));
      const questions = await fetchQuestionsForTests(testIds);
      
      setRawQuestions(questions);
      setTestsMetaById(testsMetaMap);
      processAnalytics(questions);

      // Save to cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        questions,
        testsMeta: testsMetaMap,
        timestamp: Date.now()
      }));

    } catch (err) {
      console.error('PYQ analysis fetch error', err);
      if (!bypassCache) { // Only clear if we didn't have cache to begin with
        clearComputedState();
        setRawQuestions([]);
        setTestsMetaById({});
      }
    } finally {
      setLoading(false);
    }
  };

  const clearComputedState = () => {
    setDistributionData([]);
    setHeatmapData({});
    setTopicYearHeatmap({});
    setTopTopics([]);
    setTrendSubjects([]);
    setSelectedSubject(null);
    setSelectedSection(null);
    setHeatmapSubject('All');
    setSectionData([]);
    setMicroTopicData([]);
  };

  const processAnalytics = (data: any[]) => {
    if (!data.length) {
      clearComputedState();
      return;
    }

    const subjectMap: Record<string, number> = {};
    const yearSubjectMap: Record<string, Record<string, number>> = {};
    const topicMap: Record<string, number> = {};
    const topicYearMap: Record<string, Record<string, number>> = {};

    data.forEach(q => {
      const subject = getAnalyticsSubject(q);
      const year = getAnalyticsYear(q);
      if (!year) return;
      const yearKey = String(year);

      subjectMap[subject] = (subjectMap[subject] || 0) + 1;
      if (!yearSubjectMap[yearKey]) yearSubjectMap[yearKey] = {};
      yearSubjectMap[yearKey][subject] = (yearSubjectMap[yearKey][subject] || 0) + 1;

      const topic = q.micro_topic || q.section_group || 'Other';
      topicMap[topic] = (topicMap[topic] || 0) + 1;
      if (!topicYearMap[topic]) topicYearMap[topic] = {};
      topicYearMap[topic][yearKey] = (topicYearMap[topic][yearKey] || 0) + 1;
    });

    const sortedSubjects = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]);
    const hottestTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);

    setDistributionData(sortedSubjects.map(([name, value]) => ({ name, value })));
    setHeatmapData(yearSubjectMap);
    setTopTopics(hottestTopics);
    setTrendSubjects(sortedSubjects.slice(0, 4).map(([name]) => name));

    const filteredTopicHeatmap: Record<string, Record<string, number>> = {};
    hottestTopics.forEach(topic => {
      filteredTopicHeatmap[topic] = topicYearMap[topic] || {};
    });
    setTopicYearHeatmap(filteredTopicHeatmap);
  };

  useEffect(() => {
    if (!selectedSubject) {
      setSectionData([]);
      setSelectedSection(null);
      return;
    }
    const sectionMap: Record<string, number> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === selectedSubject)
      .forEach(q => {
        const section = q.section_group || 'General';
        sectionMap[section] = (sectionMap[section] || 0) + 1;
      });
    setSectionData(Object.entries(sectionMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  }, [selectedSubject, rawQuestions]);

  useEffect(() => {
    if (!selectedSubject || !selectedSection) {
      setMicroTopicData([]);
      return;
    }
    const microMap: Record<string, number> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === selectedSubject && (q.section_group || 'General') === selectedSection)
      .forEach(q => {
        const micro = q.micro_topic || 'Other';
        microMap[micro] = (microMap[micro] || 0) + 1;
      });
    setMicroTopicData(Object.entries(microMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  }, [selectedSubject, selectedSection, rawQuestions]);

  const years = useMemo(() => {
    return Array.from(new Set(rawQuestions.map(getAnalyticsYear).filter(Boolean).map(String))).sort((a, b) => Number(b) - Number(a)); // DESC: 2025, 2024, ...
  }, [rawQuestions, testsMetaById]);

  const paperCoverageRows = useMemo(() => {
    const rows: Record<string, { year: string; expected: number; fetched: number; testCount: number }> = {};
    Object.values(testsMetaById).forEach((test: any) => {
      const year = getTestYear(test);
      if (!year) return;
      const key = String(year);
      if (!rows[key]) rows[key] = { year: key, expected: 0, fetched: 0, testCount: 0 };
      rows[key].expected += Number(test.question_count || 0);
      rows[key].testCount += 1;
    });
    rawQuestions.forEach(q => {
      const year = getAnalyticsYear(q);
      if (!year) return;
      const key = String(year);
      if (!rows[key]) rows[key] = { year: key, expected: 0, fetched: 0, testCount: 0 };
      rows[key].fetched += 1;
    });
    return Object.values(rows).sort((a, b) => Number(a.year) - Number(b.year));
  }, [rawQuestions, testsMetaById]);

  const heatmapSections = useMemo(() => {
    if (heatmapSubject === 'All') return [];
    const map: Record<string, Record<string, number>> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === heatmapSubject)
      .forEach(q => {
        const section = q.section_group || 'General';
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        if (!map[section]) map[section] = {};
        map[section][year] = (map[section][year] || 0) + 1;
      });
    return Object.entries(map)
      .map(([name, byYear]) => ({ name, byYear, total: Object.values(byYear).reduce((sum, val) => sum + val, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 14);
  }, [rawQuestions, heatmapSubject, years]);

  const heatmapMicros = useMemo(() => {
    if (heatmapSubject === 'All') return [];
    const map: Record<string, Record<string, number>> = {};
    rawQuestions
      .filter(q => getAnalyticsSubject(q) === heatmapSubject)
      .forEach(q => {
        const micro = q.micro_topic || 'Other';
        const year = String(getAnalyticsYear(q) || '');
        if (!year) return;
        if (!map[micro]) map[micro] = {};
        map[micro][year] = (map[micro][year] || 0) + 1;
      });
    return Object.entries(map)
      .map(([name, byYear]) => ({ name, byYear, total: Object.values(byYear).reduce((sum, val) => sum + val, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [rawQuestions, heatmapSubject, years]);

  const trendColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    distributionData.forEach((item, index) => {
      map[item.name] = TREND_PALETTE[index % TREND_PALETTE.length];
    });
    return map;
  }, [distributionData]);

  const topThreeSubjects = useMemo(() => distributionData.slice(0, 3), [distributionData]);
  const focusSubjects = useMemo(() => ['All', ...Array.from(new Set(rawQuestions.map(q => getAnalyticsSubject(q))))], [rawQuestions]);
  const focusSections = useMemo(() => {
    if (focusSubject === 'All') return ['All'];
    return ['All', ...Array.from(new Set(rawQuestions.filter(q => getAnalyticsSubject(q) === focusSubject).map(q => q.section_group || 'General')))];
  }, [rawQuestions, focusSubject]);
  const focusMicros = useMemo(() => {
    return [
      'All',
      ...Array.from(
        new Set(
          rawQuestions
            .filter(q => (focusSubject === 'All' || getAnalyticsSubject(q) === focusSubject) && (focusSection === 'All' || (q.section_group || 'General') === focusSection))
            .map(q => q.micro_topic || 'Other')
        )
      ),
    ];
  }, [rawQuestions, focusSubject, focusSection]);

  const breakdownData = useMemo(() => {
    if (!selectedSubject) return distributionData;
    if (!selectedSection) return sectionData;
    return microTopicData;
  }, [distributionData, sectionData, microTopicData, selectedSubject, selectedSection]);

  const donutData = useMemo(() => {
    const source = breakdownData.slice(0, 5);
    const rest = breakdownData.slice(5).reduce((sum, item) => sum + item.value, 0);
    const compact = source.map(item => ({ tag: item.name, count: item.value }));
    if (rest > 0) compact.push({ tag: 'Others', count: rest });
    return compact;
  }, [breakdownData]);

  const overviewSeries = useMemo(() => {
    return trendSubjects.map(subject => ({
      label: subject,
      values: years.map(year => heatmapData[year]?.[subject] || 0),
    }));
  }, [trendSubjects, years, heatmapData]);

  const focusTrendSeries = useMemo(() => {
    const label =
      focusMicro !== 'All'
        ? focusMicro
        : focusSection !== 'All'
          ? `${focusSubject} / ${focusSection}`
          : focusSubject !== 'All'
            ? focusSubject
            : 'All PYQ';
    return [
      {
        label,
        values: years.map(year => {
          const numYear = Number(year);
          return rawQuestions.filter(q => {
            if (getAnalyticsYear(q) !== numYear) return false;
            if (focusSubject !== 'All' && getAnalyticsSubject(q) !== focusSubject) return false;
            if (focusSection !== 'All' && (q.section_group || 'General') !== focusSection) return false;
            if (focusMicro !== 'All' && (q.micro_topic || 'Other') !== focusMicro) return false;
            return true;
          }).length;
        }),
      },
    ];
  }, [rawQuestions, years, focusSubject, focusSection, focusMicro]);

  const openModal = (type: 'stage' | 'paper' | 'range') => {
    setModalType(type);
    setModalVisible(true);
  };

  const handleSelect = (value: string) => {
    if (modalType === 'stage') {
      setExamStage(value);
      setSelectedPaper(PAPERS[value as keyof typeof PAPERS][0]);
    } else if (modalType === 'paper') {
      setSelectedPaper(value);
    } else if (modalType === 'range') {
      setSelectedRange(value);
    }
    setModalVisible(false);
  };

  const navigateToLearning = (opts: { subject?: string; section?: string; micro?: string; year?: string }) => {
    router.push({
      pathname: '/unified/engine',
      params: {
        mode: 'learning',
        view: 'list',
        institutes: 'UPSC',
        pyqFilter: 'PYQ Only',
        subject: opts.subject || 'All',
        section: opts.section || '',
        microTopics: opts.micro || '',
        specificYear: opts.year || '',
      },
    });
  };

  const exportPdf = async () => {
    const title = `${examStage} ${selectedPaper} PYQ Analysis`;
    const subjectRows = distributionData.map(item => `<tr><td>${item.name}</td><td>${item.value}</td></tr>`).join('');
    const maxSubjectValue = Math.max(...distributionData.map(item => item.value), 1);
    const topicRows = topTopics.map(topic => {
      const counts = years.map(year => topicYearHeatmap[topic]?.[year] || 0).join(' / ');
      return `<tr><td>${topic}</td><td>${counts}</td></tr>`;
    }).join('');
    const focusedLabel = focusMicro !== 'All' ? focusMicro : focusSection !== 'All' ? `${focusSubject} / ${focusSection}` : focusSubject;
    const subjectChartRows = distributionData.slice(0, 12).map(item => `
      <div class="bar-row">
        <div class="bar-label">${item.name}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max((item.value / maxSubjectValue) * 100, 4)}%"></div></div>
        <div class="bar-value">${item.value}</div>
      </div>
    `).join('');
    const subjectHeatmapHtml = distributionData.slice(0, 12).map(item => `
      <tr>
        <td>${item.name}</td>
        ${years.map(year => {
          const count = heatmapData[year]?.[item.name] || 0;
          const alpha = count ? Math.min(0.22 + count / 14, 1) : 0.06;
          return `<td style="background: rgba(37,99,235,${alpha}); color: ${count ? '#fff' : '#475569'};">${count || ''}</td>`;
        }).join('')}
      </tr>
    `).join('');
    const topicHeatmapHtml = topTopics.slice(0, 12).map(topic => `
      <tr>
        <td>${topic}</td>
        ${years.map(year => {
          const count = topicYearHeatmap[topic]?.[year] || 0;
          const alpha = count ? Math.min(0.22 + count / 10, 1) : 0.06;
          return `<td style="background: rgba(29,78,216,${alpha}); color: ${count ? '#fff' : '#475569'};">${count || ''}</td>`;
        }).join('')}
      </tr>
    `).join('');

    const html = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1, h2 { margin-bottom: 8px; }
          .meta { margin-bottom: 16px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          td, th { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          .cards { display: flex; gap: 12px; margin-bottom: 24px; }
          .card { flex: 1; border: 1px solid #d1d5db; padding: 12px; }
          .bar-card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
          .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
          .bar-label { width: 140px; font-size: 12px; }
          .bar-track { flex: 1; height: 12px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
          .bar-fill { height: 100%; background: #2563eb; border-radius: 999px; }
          .bar-value { width: 42px; text-align: right; font-size: 12px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Range: ${selectedRange}${selectedRange === 'Custom Range' ? ` (${customYearStart} - ${customYearEnd})` : ''}</div>
        <div class="cards">
          ${topThreeSubjects.map((item, index) => `<div class="card"><div>Top ${index + 1}</div><strong>${item.name}</strong><div>${item.value} questions</div></div>`).join('')}
        </div>
        <h2>Subject Distribution</h2>
        <div class="bar-card">${subjectChartRows}</div>
        <h2>Subject Distribution</h2>
        <table><tr><th>Subject</th><th>Questions</th></tr>${subjectRows}</table>
        <h2>Focused Trend</h2>
        <div class="meta">Current focus: ${focusedLabel || 'All'}</div>
        <table>
          <tr><th>Year</th><th>Count</th></tr>
          ${years.map((year, index) => `<tr><td>${year}</td><td>${focusTrendSeries[0]?.values[index] || 0}</td></tr>`).join('')}
        </table>
        <h2>Subject x Year Heatmap</h2>
        <table>
          <tr><th>Subject</th>${years.map(year => `<th>${year}</th>`).join('')}</tr>
          ${subjectHeatmapHtml}
        </table>
        <h2>Top Topics by Year</h2>
        <table><tr><th>Topic</th><th>${years.join(' / ')}</th></tr>${topicRows}</table>
        <h2>Top Topic x Year Heatmap</h2>
        <table>
          <tr><th>Topic</th>${years.map(year => `<th>${year}</th>`).join('')}</tr>
          ${topicHeatmapHtml}
        </table>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.bg }]}>
      {!isEmbedded ? (
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <ChevronLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
      ) : <View style={styles.headerIcon} />}
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>PYQ Analysis</Text>
      <TouchableOpacity onPress={exportPdf} style={[styles.headerIcon, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Download color={colors.primary} size={18} />
      </TouchableOpacity>
    </View>
  );

  const renderOverview = () => (
    <View style={styles.blockGap}>
      <View style={styles.topCardRow}>
        {topThreeSubjects.map((item, idx) => (
          <View key={item.name} style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.topRank, { color: colors.primary }]}>Top {idx + 1}</Text>
            <Text style={[styles.topName, { color: colors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.topCount, { color: colors.textSecondary }]}>{item.value} questions</Text>
          </View>
        ))}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject Momentum</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {distributionData.map(item => {
            const active = trendSubjects.includes(item.name);
            const seriesColor = trendColorMap[item.name] || colors.primary;
            return (
              <TouchableOpacity
                key={item.name}
                style={[
                  styles.seriesChip,
                  { borderColor: active ? seriesColor : colors.border, backgroundColor: active ? seriesColor : colors.surfaceStrong },
                ]}
                onPress={() => {
                  setTrendSubjects(prev => {
                    if (prev.includes(item.name)) return prev.filter(v => v !== item.name);
                    if (prev.length >= 6) return [...prev.slice(1), item.name];
                    return [...prev, item.name];
                  });
                }}
              >
                <View style={[styles.seriesDot, { backgroundColor: active ? '#ffffff' : seriesColor }]} />
                <Text style={[styles.seriesChipText, { color: active ? '#ffffff' : colors.textSecondary }]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {overviewSeries.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              labels={years}
              data={overviewSeries}
              colors={overviewSeries.map(series => trendColorMap[series.label] || colors.primary)}
              height={300}
              width={Math.max(width * 1.45, years.length * 96, 420)}
              topInset={30}
            />
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Select subjects to compare their year-wise momentum.</Text>
        )}
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject Distribution</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pieScroll}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={styles.pieVerticalScroll}>
            <PieChart
              data={donutData}
              size={258}
              canvasWidth={640}
              canvasHeight={390}
              centerLabel={String(donutData.reduce((sum, item) => sum + item.count, 0))}
              centerSubLabel="QUESTIONS"
              colors={donutData.map((_, index) => TREND_PALETTE[index % TREND_PALETTE.length])}
              onPress={tag => {
                if (tag === 'Others') return;
                if (!selectedSubject) {
                  setSelectedSubject(tag);
                } else if (!selectedSection) {
                  setSelectedSection(tag);
                }
              }}
            />
          </ScrollView>
        </ScrollView>
        <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 8 }]}>
          Click on the chart to deep dive from subject to section group to micro topic.
        </Text>
        <View style={[styles.tableWrap, { borderColor: colors.border }]}>
          {breakdownData.slice(0, 12).map((item, index) => (
            <TouchableOpacity
              key={`${item.name}-${index}`}
              style={[styles.tableRow, { borderBottomColor: colors.border + '60' }]}
              onPress={() => {
                if (!selectedSubject) {
                  setSelectedSubject(item.name);
                  return;
                }
                if (!selectedSection) {
                  setSelectedSection(item.name);
                  return;
                }
                navigateToLearning({
                  subject: selectedSubject || undefined,
                  section: selectedSection || undefined,
                  micro: item.name,
                });
              }}
            >
              <Text style={[styles.tableName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.tableValue, { color: colors.textSecondary }]}>{item.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {(selectedSubject || selectedSection) ? (
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
            onPress={() => {
              if (selectedSection) setSelectedSection(null);
              else setSelectedSubject(null);
            }}
          >
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Go one level up</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderSubjectYearHeatmap = () => (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject x Year Heatmap</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.heatmapHeader}>
            <Text style={[styles.axisSubject, { color: colors.textTertiary }]}>Subject</Text>
            {years.map(year => <Text key={year} style={[styles.axisYear, { color: colors.textTertiary }]}>{year}</Text>)}
          </View>
          {distributionData.slice(0, 16).map(item => (
            <View key={item.name} style={styles.heatmapRow}>
              <Text style={[styles.axisSubject, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
              {years.map(year => {
                const count = heatmapData[year]?.[item.name] || 0;
                const opacity = count ? Math.min(0.22 + count / 14, 1) : 0.08;
                return (
                  <TouchableOpacity
                    key={`${item.name}-${year}`}
                    style={[styles.heatCell, { backgroundColor: '#2563eb', opacity }]}
                    onPress={() => navigateToLearning({ subject: item.name, year })}
                  >
                    <Text style={styles.heatCellText}>{count || ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // (renderPaperCoverageTable removed — per user request)

  const renderTopicYearHeatmap = () => (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Top 20 Topics x Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.heatmapHeader}>
            <Text style={[styles.axisSubject, { color: colors.textTertiary }]}>Topic</Text>
            {years.map(year => <Text key={year} style={[styles.axisYear, { color: colors.textTertiary }]}>{year}</Text>)}
          </View>
          {topTopics.map(topic => (
            <View key={topic} style={styles.heatmapRow}>
              <Text style={[styles.axisSubject, { color: colors.textSecondary }]} numberOfLines={1}>{topic}</Text>
              {years.map(year => {
                const count = topicYearHeatmap[topic]?.[year] || 0;
                const opacity = count ? Math.min(0.22 + count / 10, 1) : 0.06;
                return (
                  <TouchableOpacity
                    key={`${topic}-${year}`}
                    style={[styles.heatCell, { backgroundColor: '#1d4ed8', opacity }]}
                    onPress={() => navigateToLearning({ micro: topic, year })}
                  >
                    <Text style={styles.heatCellText}>{count || ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderSubjectDeepHeatmaps = () => (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Subject Distribution</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', ...distributionData.map(item => item.name)].map(item => (
          <TouchableOpacity
            key={`heat-subject-${item}`}
            style={[
              styles.filterChip,
              { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
              heatmapSubject === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }
            ]}
            onPress={() => setHeatmapSubject(item)}
          >
            <Text style={[styles.filterChipText, { color: heatmapSubject === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {heatmapSubject === 'All' ? (
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>Choose a subject to open section-group and micro-topic heatmaps for that subject.</Text>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Section Group x Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.heatmapHeader}>
                <Text style={[styles.axisSubject, { color: colors.textTertiary }]}>Section</Text>
                {years.map(year => <Text key={`section-year-${year}`} style={[styles.axisYear, { color: colors.textTertiary }]}>{year}</Text>)}
              </View>
              {heatmapSections.map(item => (
                <View key={`section-row-${item.name}`} style={styles.heatmapRow}>
                  <Text style={[styles.axisSubject, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
                  {years.map(year => {
                    const count = item.byYear[year] || 0;
                    const opacity = count ? Math.min(0.22 + count / 8, 1) : 0.06;
                    return (
                      <TouchableOpacity
                        key={`${item.name}-${year}`}
                        style={[styles.heatCell, { backgroundColor: '#2563eb', opacity }]}
                        onPress={() => navigateToLearning({ subject: heatmapSubject, section: item.name, year })}
                      >
                        <Text style={styles.heatCellText}>{count || ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Micro Topic x Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.heatmapHeader}>
                <Text style={[styles.axisSubject, { color: colors.textTertiary }]}>Micro Topic</Text>
                {years.map(year => <Text key={`micro-year-${year}`} style={[styles.axisYear, { color: colors.textTertiary }]}>{year}</Text>)}
              </View>
              {heatmapMicros.map(item => (
                <View key={`micro-row-${item.name}`} style={styles.heatmapRow}>
                  <Text style={[styles.axisSubject, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
                  {years.map(year => {
                    const count = item.byYear[year] || 0;
                    const opacity = count ? Math.min(0.22 + count / 8, 1) : 0.06;
                    return (
                      <TouchableOpacity
                        key={`${item.name}-${year}`}
                        style={[styles.heatCell, { backgroundColor: '#1d4ed8', opacity }]}
                        onPress={() => navigateToLearning({ subject: heatmapSubject, micro: item.name, year })}
                      >
                        <Text style={styles.heatCellText}>{count || ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );

  const renderFocusedTrend = () => (
    <View style={styles.blockGap}>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.textPrimary }]}>Focused Trend</Text>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Subject only, then deeper into section group and micro topic when you need it.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {focusSubjects.map(item => (
            <TouchableOpacity
              key={`subject-${item}`}
              style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusSubject === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
              onPress={() => {
                setFocusSubject(item);
                setFocusSection('All');
                setFocusMicro('All');
              }}
            >
              <Text style={[styles.filterChipText, { color: focusSubject === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {focusSubject !== 'All' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {focusSections.map(item => (
              <TouchableOpacity
                key={`section-${item}`}
                style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusSection === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
                onPress={() => {
                  setFocusSection(item);
                  setFocusMicro('All');
                }}
              >
                <Text style={[styles.filterChipText, { color: focusSection === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {focusSection !== 'All' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {focusMicros.map(item => (
              <TouchableOpacity
                key={`micro-${item}`}
                style={[styles.filterChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, focusMicro === item && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}
                onPress={() => setFocusMicro(item)}
              >
                <Text style={[styles.filterChipText, { color: focusMicro === item ? colors.buttonText : colors.textSecondary }]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            labels={years}
            data={focusTrendSeries}
            colors={[colors.primary]}
            height={320}
            width={Math.max(width * 1.65, years.length * 108, 460)}
            topInset={34}
          />
        </ScrollView>

        <TouchableOpacity
          style={[styles.openBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigateToLearning({
            subject: focusSubject === 'All' ? undefined : focusSubject,
            section: focusSection === 'All' ? undefined : focusSection,
            micro: focusMicro === 'All' ? undefined : focusMicro,
          })}
        >
          <Text style={[styles.openBtnText, { color: colors.buttonText }]}>Open This In Learn Mode</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isEmbedded ? 'transparent' : colors.bg }]}>
      {renderHeader()}

      <View style={[styles.filterWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { label: 'Stage', value: examStage, type: 'stage' as const },
          { label: 'Paper', value: selectedPaper, type: 'paper' as const },
          { label: 'Years', value: selectedRange, type: 'range' as const },
        ].map(item => (
          <TouchableOpacity key={item.label} style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} onPress={() => openModal(item.type)}>
            <Text style={[styles.selectorLabel, { color: colors.textTertiary }]}>{item.label}</Text>
            <View style={styles.selectorValue}>
              <Text style={[styles.selectorText, { color: colors.textPrimary }]} numberOfLines={1}>{item.value}</Text>
              <ChevronDown size={14} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRange === 'Custom Range' ? (
        <View style={[styles.rangeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rangeInputWrap}>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>From</Text>
            <TextInput value={customYearStart} onChangeText={setCustomYearStart} keyboardType="number-pad" maxLength={4} style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} />
          </View>
          <View style={styles.rangeInputWrap}>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>To</Text>
            <TextInput value={customYearEnd} onChangeText={setCustomYearEnd} keyboardType="number-pad" maxLength={4} style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]} />
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={[styles.loaderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading PYQ analysis...</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            {rawQuestions.length === 0 ? (
              <View style={[styles.loaderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.loaderText, { color: colors.textSecondary }]}>No PYQ matched this filter selection.</Text>
              </View>
            ) : (
              <>
                {activeHub === 'overview' && renderOverview()}
                {activeHub === 'heatmaps' && <View style={styles.blockGap}>{renderSubjectYearHeatmap()}{renderTopicYearHeatmap()}{renderSubjectDeepHeatmaps()}</View>}
                {activeHub === 'focused' && renderFocusedTrend()}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { key: 'overview', label: 'Overview', icon: TrendingUp },
          { key: 'heatmaps', label: 'Heatmaps', icon: Grid },
          { key: 'focused', label: 'Focused', icon: LineIcon },
        ].map(item => {
          const Icon = item.icon;
          const active = activeHub === item.key;
          return (
            <TouchableOpacity key={item.key} style={styles.tabItem} onPress={() => setActiveHub(item.key as HubKey)}>
              <Icon size={18} color={active ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textTertiary }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select {modalType}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X size={22} color={colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {(modalType === 'stage' ? EXAM_STAGES : modalType === 'paper' ? PAPERS[examStage as keyof typeof PAPERS] : RANGE_OPTIONS).map(item => (
                <TouchableOpacity key={item} style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => handleSelect(item)}>
                  <Text style={[styles.modalItemText, { color: colors.textPrimary }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  headerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filterWrap: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  selector: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10 },
  selectorLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  selectorValue: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  selectorText: { fontSize: 12, fontWeight: '700', flex: 1 },
  rangeBox: { marginHorizontal: 12, marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 12 },
  rangeInputWrap: { flex: 1 },
  rangeLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  yearInput: { borderRadius: 10, borderWidth: 1, padding: 8, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  content: { paddingBottom: 100 },
  blockGap: { gap: 16, padding: 12 },
  topCardRow: { flexDirection: 'row', gap: 10 },
  topCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1 },
  topRank: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  topName: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  topCount: { fontSize: 11, fontWeight: '600' },
  panel: { padding: 16, borderRadius: 24, borderWidth: 1 },
  panelTitle: { fontSize: 16, fontWeight: '900', marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  chipRow: { gap: 8, marginBottom: 12 },
  pieScroll: { paddingHorizontal: 8, minWidth: '100%' },
  pieVerticalScroll: { paddingBottom: 12, paddingRight: 12 },
  seriesChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, gap: 8 },
  seriesDot: { width: 8, height: 8, borderRadius: 4 },
  seriesChipText: { fontSize: 12, fontWeight: '700' },
  emptyText: { textAlign: 'center', padding: 40, fontSize: 14, fontStyle: 'italic' },
  backBtn: { alignSelf: 'center', marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  backBtnText: { fontSize: 12, fontWeight: '700' },
  heatmapHeader: { flexDirection: 'row', marginBottom: 4, paddingLeft: 100 },
  axisYear: { width: 44, textAlign: 'center', fontSize: 10, fontWeight: '800' },
  axisSubject: { width: 100, fontSize: 11, fontWeight: '700', marginRight: 8 },
  heatmapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heatCell: { width: 44, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  heatCellText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  helperText: { fontSize: 12, marginBottom: 16, lineHeight: 18 },
  tableWrap: { marginTop: 12, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  tableName: { flex: 1, fontSize: 12, fontWeight: '700', paddingRight: 12 },
  tableValue: { fontSize: 12, fontWeight: '800' },
  coverageYear: { flex: 1.1, fontSize: 12, fontWeight: '800' },
  coverageCell: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  openBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  openBtnText: { fontSize: 14, fontWeight: '800' },
  loaderBox: { height: 300, alignItems: 'center', justifyContent: 'center', margin: 12, borderRadius: 24, borderWidth: 1 },
  loaderText: { marginTop: 16, fontSize: 14, fontWeight: '600' },
  tabBar: { flexDirection: 'row', height: 70, borderTopWidth: 1, paddingBottom: 15 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  modalItem: { paddingVertical: 18, borderBottomWidth: 1 },
  modalItemText: { fontSize: 16, fontWeight: '700' },
});
