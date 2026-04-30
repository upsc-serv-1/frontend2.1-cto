const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCsat() {
  console.log('Checking 2025 CSAT Meta...');
  
  const { data: test } = await supabase
    .from('tests')
    .select('id, title, institute, subject, level')
    .eq('id', 'upsc-cse-pyq-2025-gs2');

  console.log(JSON.stringify(test, null, 2));
}

checkCsat();
