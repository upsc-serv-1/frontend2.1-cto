const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function inspectTable() {
  const userId = 'cf6b5f69-24ab-4376-a817-12b04846035a';
  const { data: card } = await supabase.from('cards').select('id').limit(1).single();
  
  if (!card) return;
  
  // Try to insert with just required fields to see what columns are there
  const { data, error } = await supabase
    .from('user_cards')
    .insert({ user_id: userId, card_id: card.id })
    .select('*');
  
  if (error) {
    console.log('Error (Expected):', error.message);
    // If it fails because of missing columns, it might still tell us what's wrong
  } else {
    console.log('Columns found:', Object.keys(data[0]));
    // Clean up
    await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', card.id);
  }
}

inspectTable();
