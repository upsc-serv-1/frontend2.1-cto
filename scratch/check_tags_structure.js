const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkTags() {
  const { data, error } = await supabase
    .from('question_states')
    .select('*')
    .not('review_tags', 'is', null)
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample Data:', JSON.stringify(data, null, 2));
    console.log('Type of review_tags:', typeof data[0]?.review_tags);
  }
}

checkTags();
