const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check2024Year() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, pyq_year')
    .eq('test_id', 'upsc-cse-pyq-2024-gs1')
    .limit(1);

  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

check2024Year();
