const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function testFix() {
  const userId = 'cf6b5f69-24ab-4376-a817-12b04846035a';
  const tags = ['Imp. Concept', 'Imp. Fact'];
  
  console.log('Testing with OR of CONTAINS...');
  
  // Method 1: Multiple contains in OR
  const orCondition = tags.map(t => `review_tags.cs.[ "${t}" ]`).join(',');
  console.log('OR Condition:', orCondition);
  
  const { data, error, count } = await supabase
    .from('question_states')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .or(orCondition);
  
  if (error) console.error('OR Error:', error);
  else console.log('OR Match Count:', count);
}

testFix();
