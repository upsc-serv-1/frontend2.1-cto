const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkQuestionsCols() {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Question Columns:', Object.keys(data[0]));
    console.log('Sample Row:', JSON.stringify(data[0], null, 2));
  }
}

checkQuestionsCols();
