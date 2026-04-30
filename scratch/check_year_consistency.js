const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkYearConsistency() {
  const { data, error } = await supabase
    .from('questions')
    .select('exam_year')
    .eq('test_id', 'upsc-cse-pyq-2025-gs1');

  if (error) {
    console.error(error);
  } else {
    const years = Array.from(new Set(data.map(d => d.exam_year)));
    console.log('Years found in 2025 test questions:', years);
    console.log('Total questions:', data.length);
  }
}

checkYearConsistency();
