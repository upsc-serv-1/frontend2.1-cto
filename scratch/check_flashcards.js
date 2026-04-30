const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkCards() {
  const { data: cards, error: cardError } = await supabase.from('cards').select('*').limit(5);
  console.log('Cards Sample:', cards);
  
  const { data: userCards, error: userCardError } = await supabase.from('user_cards').select('*').limit(5);
  console.log('User Cards Sample:', userCards);
}

checkCards();
