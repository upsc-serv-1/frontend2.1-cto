const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkPaperTypes() {
  const { data, error } = await supabase
    .from('tests')
    .select('paper_type')
    .limit(100);
  
  if (error) {
    console.error('Error:', error);
  } else {
    const types = new Set(data.map(t => t.paper_type).filter(Boolean));
    console.log('Available Paper Types:', Array.from(types));
  }
}

checkPaperTypes();
