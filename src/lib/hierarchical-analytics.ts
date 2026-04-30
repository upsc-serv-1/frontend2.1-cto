import { QuestionAttempt } from './analytics-utils';

export interface PerformanceStats {
  total: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  timeSpent: number;
}

export interface MicroTopicPerformance extends PerformanceStats {
  name: string;
}

export interface AdvancedMetrics {
  fatigue: Record<number, { total: number; correct: number }>;
  difficulty: Record<string, { total: number; correct: number }>;
  errors: Record<string, number>;
  confidence: Record<string, { total: number; correct: number; incorrect: number }>;
}

export interface SectionGroupPerformance extends PerformanceStats {
  name: string;
  microTopics: Record<string, MicroTopicPerformance>;
  advanced: AdvancedMetrics;
}

export interface SubjectPerformance extends PerformanceStats {
  name: string;
  sectionGroups: Record<string, SectionGroupPerformance>;
  advanced: AdvancedMetrics;
}

export interface HierarchicalPerformance {
  subjects: Record<string, SubjectPerformance>;
  advanced: AdvancedMetrics;
}

const createBaseStats = (): PerformanceStats => ({
  total: 0,
  correct: 0,
  incorrect: 0,
  unattempted: 0,
  accuracy: 0,
  timeSpent: 0,
});

const createBaseAdvanced = (): AdvancedMetrics => ({
  fatigue: {},
  difficulty: { 'Easy': { total: 0, correct: 0 }, 'Medium': { total: 0, correct: 0 }, 'Hard': { total: 0, correct: 0 } },
  errors: { 'Fact Mistake': 0, 'Concept Gap': 0, 'Silly Mistake': 0, 'Overthinking': 0, 'Skipped': 0 },
  confidence: {
    '100% Sure': { total: 0, correct: 0, incorrect: 0 },
    'Logical Elimination': { total: 0, correct: 0, incorrect: 0 },
    'Pure Guess': { total: 0, correct: 0, incorrect: 0 },
    'UPSC Funda': { total: 0, correct: 0, incorrect: 0 },
  }
});

const calculateAccuracy = (correct: number, totalAttempts: number) => {
  return totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0;
};

export function buildHierarchicalPerformanceReport(questions: QuestionAttempt[]): HierarchicalPerformance {
  const report: HierarchicalPerformance = { 
    subjects: {},
    advanced: createBaseAdvanced()
  };

  questions.forEach((question) => {
    const isCorrect = question.selectedAnswer?.toLowerCase() === question.correctAnswer?.toLowerCase() && !!question.selectedAnswer;
    const isIncorrect = question.selectedAnswer?.toLowerCase() !== question.correctAnswer?.toLowerCase() && !!question.selectedAnswer;
    const isUnattempted = !question.selectedAnswer;

    const subjectName = question.subject || "Unassigned Subject";
    const sectionName = question.sectionGroup || "General Section";
    const microTopicName = question.microTopic || "Unmapped Topic";

    // 1. Subject Level
    if (!report.subjects[subjectName]) {
      report.subjects[subjectName] = { name: subjectName, ...createBaseStats(), sectionGroups: {}, advanced: createBaseAdvanced() };
    }
    const subject = report.subjects[subjectName];
    subject.total += 1;
    subject.timeSpent += question.timeSpentSeconds || 0;
    if (isCorrect) subject.correct += 1;
    if (isIncorrect) subject.incorrect += 1;
    if (isUnattempted) subject.unattempted += 1;

    // 2. Section Group Level
    if (!subject.sectionGroups[sectionName]) {
      subject.sectionGroups[sectionName] = { name: sectionName, ...createBaseStats(), microTopics: {}, advanced: createBaseAdvanced() };
    }
    const section = subject.sectionGroups[sectionName];
    section.total += 1;
    section.timeSpent += question.timeSpentSeconds || 0;
    if (isCorrect) section.correct += 1;
    if (isIncorrect) section.incorrect += 1;
    if (isUnattempted) section.unattempted += 1;

    // Update Advanced Metrics for Subject and Section
    const targets = [report.advanced, subject.advanced, section.advanced];
    
    targets.forEach(t => {
      // Fatigue
      if (question.attemptHour !== undefined) {
        const h = question.attemptHour;
        if (!t.fatigue[h]) t.fatigue[h] = { total: 0, correct: 0 };
        t.fatigue[h].total++;
        if (isCorrect) t.fatigue[h].correct++;
      }

      // Difficulty
      if (question.difficultyLevel) {
        const rawDifficulty = String(question.difficultyLevel);
        const d = rawDifficulty.charAt(0).toUpperCase() + rawDifficulty.slice(1).toLowerCase();
        if (!t.difficulty[d]) t.difficulty[d] = { total: 0, correct: 0 };
        t.difficulty[d].total++;
        if (isCorrect) t.difficulty[d].correct++;
      }

      // Confidence
      if (question.confidence) {
        const rawConfidence = String(question.confidence).toLowerCase();
        const confidenceMap: Record<string, string> = {
          sure: '100% Sure',
          '100% sure': '100% Sure',
          logical: 'Logical Elimination',
          'logical elimination': 'Logical Elimination',
          guess: 'Pure Guess',
          'pure guess': 'Pure Guess',
          funda: 'UPSC Funda',
          'upsc funda': 'UPSC Funda',
        };
        const normalizedConfidence = confidenceMap[rawConfidence] || question.confidence;
        if (!t.confidence[normalizedConfidence]) {
          t.confidence[normalizedConfidence] = { total: 0, correct: 0, incorrect: 0 };
        }
        t.confidence[normalizedConfidence].total++;
        if (isCorrect) t.confidence[normalizedConfidence].correct++;
        if (isIncorrect) t.confidence[normalizedConfidence].incorrect++;
      }

      // Errors
      if (isIncorrect) {
        const e = question.errorCategory || 'Other';
        if (!t.errors[e]) t.errors[e] = 0;
        t.errors[e]++;
      }
    });

    // 3. Micro Topic Level
    if (!section.microTopics[microTopicName]) {
      section.microTopics[microTopicName] = { name: microTopicName, ...createBaseStats() };
    }
    const microTopic = section.microTopics[microTopicName];
    microTopic.total += 1;
    microTopic.timeSpent += question.timeSpentSeconds || 0;
    if (isCorrect) microTopic.correct += 1;
    if (isIncorrect) microTopic.incorrect += 1;
    if (isUnattempted) microTopic.unattempted += 1;
  });

  // Calculate Accuracies post-aggregation
  for (const subjectKey in report.subjects) {
    const subject = report.subjects[subjectKey];
    subject.accuracy = calculateAccuracy(subject.correct, subject.correct + subject.incorrect);
    
    for (const sectionKey in subject.sectionGroups) {
      const section = subject.sectionGroups[sectionKey];
      section.accuracy = calculateAccuracy(section.correct, section.correct + section.incorrect);
      
      for (const topicKey in section.microTopics) {
        const topic = section.microTopics[topicKey];
        topic.accuracy = calculateAccuracy(topic.correct, topic.correct + topic.incorrect);
      }
    }
  }

  return report;
}

export function buildAggregateHierarchicalAccuracy(questions: QuestionAttempt[]) {
  return buildHierarchicalPerformanceReport(questions); // The logic works perfectly for aggregate as well
}

export interface TestAttemptRow {
  test_id: string;
  submitted_at: string;
  score?: number;
  accuracy?: number;
  correct_count?: number;
  incorrect_count?: number;
  unattempted_count?: number;
}

export function buildAggregateTestTrends(attempts: TestAttemptRow[]) {
  // Sort attempts by date ascending
  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime()
  );

  const historicalScores = sortedAttempts.map((attempt, index) => ({
    attemptIndex: index + 1,
    testId: attempt.test_id,
    date: attempt.submitted_at,
    score: attempt.score || 0,
    accuracy: attempt.accuracy || 0,
    totalQuestionsAttempted: (attempt.correct_count || 0) + (attempt.incorrect_count || 0),
  }));

  const negativeMarkingTrends = sortedAttempts.map((attempt, index) => {
    // Attempt data structure varies, estimating negative marks if explicit data isn't present
    const incorrect = attempt.incorrect_count || 0;
    const negativeMarks = incorrect * 0.66; // Assuming standard UPSC negative marking
    return {
      attemptIndex: index + 1,
      date: attempt.submitted_at,
      incorrectCount: incorrect,
      negativeMarksPenalty: parseFloat(negativeMarks.toFixed(2)),
    };
  });

  return { historicalScores, negativeMarkingTrends };
}

export function evaluateRepeatedWeaknesses(attempts: TestAttemptRow[], questions: QuestionAttempt[]): string[] {
  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime()
  );

  const testIdsChronological = sortedAttempts.map(a => a.test_id);
  
  const questionsByTest: Record<string, QuestionAttempt[]> = {};
  questions.forEach(q => {
    if (q.testId) {
      if (!questionsByTest[q.testId]) questionsByTest[q.testId] = [];
      questionsByTest[q.testId].push(q);
    }
  });

  const consecutiveWeaknesses: Record<string, number> = {};
  const repeatedWeaknesses = new Set<string>();

  testIdsChronological.forEach(testId => {
    const testQs = questionsByTest[testId] || [];
    if (testQs.length === 0) return;

    const report = buildHierarchicalPerformanceReport(testQs);

    const testSections: Record<string, number> = {};
    Object.values(report.subjects).forEach(subject => {
      Object.values(subject.sectionGroups).forEach(section => {
        if (section.total > 1) {
          testSections[section.name] = section.accuracy;
        }
      });
    });

    // Update existing or add new sections
    Object.keys(testSections).forEach(sectionName => {
      if (testSections[sectionName] < 50) {
        consecutiveWeaknesses[sectionName] = (consecutiveWeaknesses[sectionName] || 0) + 1;
        if (consecutiveWeaknesses[sectionName] >= 3) {
          repeatedWeaknesses.add(sectionName);
        }
      } else {
        consecutiveWeaknesses[sectionName] = 0;
      }
    });
  });

  return Array.from(repeatedWeaknesses);
}
