const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkInstituteWhitespace() {
  const { data, error } = await supabase
    .from('tests')
    .select('id, institute')
    .eq('id', 'upsc-cse-pyq-2025-gs1');

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log(`Institute: "${data[0].institute}"`);
    console.log(`Length: ${data[0].institute.length}`);
  }
}

checkInstituteWhitespace();
