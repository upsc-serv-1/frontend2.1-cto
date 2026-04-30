const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function discoverColumns() {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log('Available columns in questions table:');
    console.log(Object.keys(data[0]));
  }
}

discoverColumns();
