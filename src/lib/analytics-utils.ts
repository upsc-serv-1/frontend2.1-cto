export type QuestionAttempt = {
  id: string;
  testId?: string;
  subject?: string;
  sectionGroup?: string;
  microTopic?: string;
  selectedAnswer?: string;
  correctAnswer?: string;
  confidence?: string;
  reviewDifficulty?: string;
  reviewTags?: string[];
  provider?: string;
  attemptHour?: number;
  difficultyLevel?: 'Easy' | 'Medium' | 'Hard';
  errorCategory?: 'Conceptual' | 'Elimination' | 'Silly' | null;
  timeSpentSeconds?: number;
};

export function buildTopicWeaknessReport(questions: QuestionAttempt[]) {
  const bucket = new Map<string, any>();
  questions.forEach((question) => {
    const key = question.microTopic || "Unmapped";
    if (!bucket.has(key)) bucket.set(key, { topic: key, total: 0, incorrect: 0, correct: 0 });
    const row = bucket.get(key);
    row.total += 1;
    if (question.selectedAnswer && question.selectedAnswer === question.correctAnswer) row.correct += 1;
    if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
  });
  return [...bucket.values()]
    .map((item) => ({
      ...item,
      accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
    }))
    .sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy);
}

export function buildSubjectPerformanceReport(questions: QuestionAttempt[]) {
  const bucket = new Map<string, any>();
  questions.forEach((question) => {
    const key = question.subject || "Unassigned";
    if (!bucket.has(key)) bucket.set(key, { subject: key, total: 0, correct: 0, incorrect: 0 });
    const row = bucket.get(key);
    row.total += 1;
    if (question.selectedAnswer && question.selectedAnswer === question.correctAnswer) row.correct += 1;
    if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
  });
  return [...bucket.values()].map((item) => ({
    ...item,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
  }));
}

export function buildDecisionMetrics(questions: QuestionAttempt[]) {
  const mapping: Record<string, string> = {
    'sure': '100% Sure',
    'logical': 'Logical Elimination',
    'guess': 'Pure Guess',
    'funda': 'UPSC Funda',
    // Fallbacks for direct labels
    '100% Sure': '100% Sure',
    'Logical Elimination': 'Logical Elimination',
    'Pure Guess': 'Pure Guess',
    'UPSC Funda': 'UPSC Funda'
  };

  const labels = ["100% Sure", "Logical Elimination", "Pure Guess", "UPSC Funda"];
  return labels.map((label) => {
    const tagged = questions.filter((question) => {
      const val = question.confidence?.toLowerCase();
      return mapping[val || ''] === label || question.confidence === label;
    });
    const correct = tagged.filter((question) => question.selectedAnswer === question.correctAnswer).length;
    const incorrect = tagged.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    return {
      label,
      total: tagged.length,
      correct,
      incorrect,
      accuracy: tagged.length ? Math.round((correct / tagged.length) * 100) : 0
    };
  });
}

export function buildDifficultyMetrics(questions: QuestionAttempt[]) {
  return ["Easy", "Moderate", "Hard"].map((level) => {
    const tagged = questions.filter((question) => question.reviewDifficulty === level);
    const correct = tagged.filter((question) => question.selectedAnswer === question.correctAnswer).length;
    const incorrect = tagged.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    return {
      level,
      total: tagged.length,
      correct,
      incorrect,
      accuracy: tagged.length ? Math.round((correct / tagged.length) * 100) : 0
    };
  });
}

export function buildSourcePerformanceReport(questions: QuestionAttempt[]) {
  const bucket = new Map<string, any>();
  questions.forEach((question) => {
    const key = question.provider || "Unknown Source";
    if (!bucket.has(key)) bucket.set(key, { source: key, total: 0, correct: 0, incorrect: 0 });
    const row = bucket.get(key);
    row.total += 1;
    if (question.selectedAnswer === question.correctAnswer) row.correct += 1;
    if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
  });
  return [...bucket.values()].map((item) => ({
    ...item,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
  }));
}

export function buildRevisionBacklog(questions: QuestionAttempt[]) {
  const incorrect = questions.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
  const mustRevise = questions.filter((question) => (question.reviewTags || []).includes("Must Revise")).length;
  return [
    { label: "Incorrect", count: incorrect },
    { label: "Must Revise", count: mustRevise }
  ];
}

export function buildIncorrectTrendReport(questions: QuestionAttempt[]) {
  const totalIncorrect = questions.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
  const firstHalf = questions.slice(0, Math.ceil(questions.length / 2));
  const secondHalf = questions.slice(Math.ceil(questions.length / 2));
  const firstHalfIncorrect = firstHalf.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
  const secondHalfIncorrect = secondHalf.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
  return [
    { label: "First half", count: firstHalfIncorrect },
    { label: "Second half", count: secondHalfIncorrect },
    { label: "Total incorrect", count: totalIncorrect }
  ];
}

export function buildConceptualFactualMetrics(questions: QuestionAttempt[]) {
  const categories = ["Imp. Fact", "Imp. Concept", "Trap Question", "Must Revise"];
  return categories.map((tag) => ({
    tag,
    count: questions.filter((question) => (question.reviewTags || []).includes(tag)).length
  }));
}

export function buildConfidenceInsights(questions: QuestionAttempt[]) {
  const sureWrong = questions.filter((q) => (q.confidence === "sure" || q.confidence === "100% Sure") && q.selectedAnswer && q.selectedAnswer !== q.correctAnswer).length;
  const guessedCorrect = questions.filter((q) => (q.confidence === "guess" || q.confidence === "Pure Guess") && q.selectedAnswer === q.correctAnswer).length;
  const eliminationCorrect = questions.filter((q) => (q.confidence === "logical" || q.confidence === "Logical Elimination") && q.selectedAnswer === q.correctAnswer).length;
  const fundaCorrect = questions.filter((q) => (q.confidence === "funda" || q.confidence === "UPSC Funda") && q.selectedAnswer === q.correctAnswer).length;
  return {
    sureWrong,
    guessedCorrect,
    eliminationCorrect,
    fundaCorrect
  };
}

export function computeScore(questions: QuestionAttempt[], config = { correct: 2.0, incorrect: 0.667 }) {
  const correct = questions.filter(q => q.selectedAnswer === q.correctAnswer).length;
  const incorrect = questions.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer).length;
  const unattempted = questions.filter(q => !q.selectedAnswer).length;
  
  // UPSC Scoring: +2 for correct, -1/3 of marks (0.667) for incorrect
  const totalMarks = (correct * config.correct) - (incorrect * config.incorrect);
  const accuracy = (correct + incorrect) > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;
  
  // Attempt Quality Score
  const totalPossible = Math.max(0.1, questions.length * config.correct);
  const rawPercentage = (totalMarks / totalPossible) * 100;
  const attemptQualityScore = Math.max(0, Math.min(100, Math.round(rawPercentage)));
  
  let qualityLabel = "Needs Focus";
  if (attemptQualityScore > 80) qualityLabel = "Exceptional";
  else if (attemptQualityScore > 65) qualityLabel = "Good";
  else if (attemptQualityScore > 50) qualityLabel = "Average";

  return {
    correct,
    incorrect,
    unattempted,
    totalMarks: totalMarks.toFixed(2),
    accuracy,
    attemptQualityScore,
    qualityLabel
  };
}

// --- HIERARCHICAL ANALYTICS ADDITIONS ---

