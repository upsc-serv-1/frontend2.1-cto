const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect2025Questions() {
  console.log('Inspecting 2025 Question data...');
  
  const { data, error } = await supabase
    .from('questions')
    .select('id, exam_year, source')
    .eq('test_id', 'upsc-cse-pyq-2025-gs1')
    .limit(5);

  if (error) {
    console.error(error);
  } else {
    console.log('Sample questions for 2025 paper:');
    console.log(JSON.stringify(data, null, 2));
  }
}

inspect2025Questions();
