const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkInstitutes() {
  const { data, error } = await supabase
    .from('tests')
    .select('institute')
    .limit(100);

  if (error) {
    console.error(error);
  } else {
    const institutes = Array.from(new Set(data.map(d => d.institute)));
    console.log('Available institutes:', institutes);
  }
}

checkInstitutes();
