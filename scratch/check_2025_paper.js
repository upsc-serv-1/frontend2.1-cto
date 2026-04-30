const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check2025Paper() {
  console.log('Checking for 2025 UPSC GS Paper 1...');
  
  // 1. Check for tests with 2025 in title
  const { data: tests, error: testError } = await supabase
    .from('tests')
    .select('id, title')
    .ilike('title', '%2025%');

  if (testError) {
    console.error('Error fetching tests:', testError);
  } else {
    console.log(`Found ${tests ? tests.length : 0} tests matching "2025":`);
    if (tests) tests.forEach(t => console.log(`- [${t.id}] ${t.title}`));
  }

  // 2. Check for questions with 2025 in year or test title context
  if (tests && tests.length > 0) {
    const testIds = tests.map(t => t.id);
    const { data: qsWithTest, error: qError } = await supabase
      .from('questions')
      .select('id')
      .in('test_id', testIds);

    if (!qError && qsWithTest) {
      console.log(`Found ${qsWithTest.length} questions associated with these tests.`);
    }
  }

  // 3. Check for specific year tagging in questions
  const { data: pyqQs, error: pyqError } = await supabase
      .from('questions')
      .select('id')
      .eq('pyq_year', '2025');
  
  if (!pyqError && pyqQs && pyqQs.length > 0) {
      console.log(`Found ${pyqQs.length} questions with pyq_year = 2025.`);
  } else {
      console.log('No questions found with pyq_year = 2025 in metadata.');
  }

  // 4. Broad search in question text for "2025" (rare for current paper but possible)
  const { data: textSearch, error: tsError } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', '%2025%')
      .limit(5);

  if (!tsError && textSearch && textSearch.length > 0) {
      console.log(`Found ${textSearch.length} questions mentioning "2025" in text.`);
  }
}

check2025Paper();
