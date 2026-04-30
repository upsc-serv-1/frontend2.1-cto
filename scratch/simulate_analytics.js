const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simulateAnalytics() {
  console.log('Simulating PYQ Analysis for 2025 GS Paper 1...');
  
  // Simulation variables
  const examStage = 'Prelims';
  const selectedPaper = 'GS Paper 1';
  const selectedRange = 'Last 10 Years';
  
  const stageNorm = examStage.toLowerCase();
  const paperNorm = selectedPaper.toLowerCase();

  // 1. Fetch Tests
  const { data: tests } = await supabase.from('tests').select('*').eq('institute', 'UPSC');
  
  const relevantTests = (tests || []).filter(t => {
    const title = String(t.title || '').toLowerCase();
    const testSub = String(t.subject || '').toLowerCase();
    const level = String(t.level || '').toLowerCase();
    const matchesStage = title.includes(stageNorm) || level.includes(stageNorm);
    if (!matchesStage) return false;

    if (paperNorm.includes('gs paper 1')) {
      const isCsat = title.includes('csat') || title.includes('paper 2') || title.includes('paper ii') || testSub.includes('csat');
      if (isCsat) return false;
      const match = title.includes('paper 1') || title.includes('paper i') || title.includes('gs') || testSub.includes('gs') || !testSub;
      return match;
    }
    return true;
  });

  console.log(`Found ${relevantTests.length} relevant tests.`);
  const test2025 = relevantTests.find(t => t.id === 'upsc-cse-pyq-2025-gs1');
  console.log(`Is 2025 GS1 in relevant tests? ${!!test2025}`);

  if (test2025) {
    // 2. Fetch Questions
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', 'upsc-cse-pyq-2025-gs1');

    console.log(`Fetched ${questions.length} questions for 2025 GS1.`);

    // 3. Apply Filter
    const getAnalyticsYear = (q) => {
        const y = q.exam_year || q.year || q.launch_year || q.source?.year;
        const num = parseInt(String(y), 10);
        return Number.isFinite(num) && num > 1900 ? num : null;
    };

    const filtered = questions.filter(q => (getAnalyticsYear(q) || 0) >= 2016);
    console.log(`After filter: ${filtered.length} questions.`);

    if (filtered.length > 0) {
        console.log(`First question year: ${getAnalyticsYear(filtered[0])}`);
    }
  }
}

simulateAnalytics();
