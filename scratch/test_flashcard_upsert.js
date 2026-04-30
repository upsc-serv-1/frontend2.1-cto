const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testUpsert() {
  const userId = 'cf6b5f69-24ab-4376-a817-12b04846035a'; // A real user ID
  const { data: card } = await supabase.from('cards').select('id').limit(1).single();
  
  if (!card) {
    console.log('No cards found to test with.');
    return;
  }
  
  console.log('Testing upsert for user:', userId, 'card:', card.id);
  
  const { data, error } = await supabase
    .from('user_cards')
    .upsert({
      user_id: userId,
      card_id: card.id,
      next_review: new Date().toISOString(),
      interval: 0,
      ease_factor: 2.5,
      status: 'new'
    }, { onConflict: 'user_id,card_id' });
  
  if (error) {
    console.error('Upsert Error:', error);
  } else {
    console.log('Upsert Success:', data);
    
    const { data: check } = await supabase.from('user_cards').select('*').eq('user_id', userId);
    console.log('Verification check:', check);
  }
}

testUpsert();
