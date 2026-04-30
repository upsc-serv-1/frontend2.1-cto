const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkPrelimsTests() {
  const { data, error } = await supabase
    .from('tests')
    .select('title, series')
    .ilike('series', '%Prelims%')
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Prelims Tests:', data.map(t => t.title));
  }
}

checkPrelimsTests();
