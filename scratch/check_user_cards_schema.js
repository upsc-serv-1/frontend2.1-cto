const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkUserCardsCols() {
  const { data, error } = await supabase
    .from('user_cards')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    if (data.length > 0) {
      console.log('User Cards Columns:', Object.keys(data[0]));
    } else {
      console.log('No rows in user_cards, trying to get schema another way');
    }
  }
}

checkUserCardsCols();
