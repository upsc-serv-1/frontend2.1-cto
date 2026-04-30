const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkTestStages() {
  const { data, error } = await supabase
    .from('tests')
    .select('series')
    .limit(100);
  
  if (error) {
    console.error('Error:', error);
  } else {
    const stages = new Set(data.map(t => t.series).filter(Boolean));
    console.log('Available Series/Stages:', Array.from(stages));
  }
}

checkTestStages();
