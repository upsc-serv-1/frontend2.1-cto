const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check2025QuestionSubjects() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, subject, section_group, micro_topic')
    .eq('test_id', 'upsc-cse-pyq-2025-gs1')
    .limit(10);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check2025QuestionSubjects();
