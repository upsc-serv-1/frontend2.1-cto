const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function comparePapers() {
  console.log('Comparing 2024 and 2025 GS1 Metadata...');
  
  // 1. Fetch Tests
  const { data: tests } = await supabase
    .from('tests')
    .select('id, title, institute, subject, level')
    .in('id', ['upsc-cse-pyq-2024-gs1', 'upsc-cse-pyq-2025-gs1']);

  console.log('Tests Meta:');
  console.log(JSON.stringify(tests, null, 2));

  // 2. Fetch Sample Questions
  const { data: q24 } = await supabase
    .from('questions')
    .select('id, exam_year, subject, section_group, micro_topic, is_pyq, is_upsc_cse, source')
    .eq('test_id', 'upsc-cse-pyq-2024-gs1')
    .limit(1);

  const { data: q25 } = await supabase
    .from('questions')
    .select('id, exam_year, subject, section_group, micro_topic, is_pyq, is_upsc_cse, source')
    .eq('test_id', 'upsc-cse-pyq-2025-gs1')
    .limit(1);

  console.log('2024 Question Sample:');
  console.log(JSON.stringify(q24, null, 2));
  console.log('2025 Question Sample:');
  console.log(JSON.stringify(q25, null, 2));
}

comparePapers();
