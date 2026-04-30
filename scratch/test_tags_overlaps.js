const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkColumnType() {
  const { data, error } = await supabase.rpc('get_column_type', { table_name: 'question_states', column_name: 'review_tags' });
  
  if (error) {
    // If RPC doesn't exist, try another way
    const { data: cols, error: colError } = await supabase
      .from('information_schema.columns')
      .select('data_type')
      .eq('table_name', 'question_states')
      .eq('column_name', 'review_tags');
    
    if (colError) console.error('Error:', colError);
    else console.log('Column Type:', cols[0]?.data_type);
  } else {
    console.log('Column Type:', data);
  }
}

async function testOverlaps() {
  const userId = 'cf6b5f69-24ab-4376-a817-12b04846035a'; // From previous sample
  const tags = ['Imp. Fact']; // Assuming this tag might exist or I'll fetch one
  
  const { data: userTags } = await supabase
    .from('question_states')
    .select('review_tags')
    .eq('user_id', userId)
    .not('review_tags', 'is', null)
    .limit(10);
  
  console.log('Existing tags for user:', JSON.stringify(userTags, null, 2));
  
  if (userTags && userTags.length > 0) {
    const realTag = userTags.find(t => t.review_tags.length > 0)?.review_tags[0];
    if (realTag) {
      console.log('Testing with tag:', realTag);
      const { data, error, count } = await supabase
        .from('question_states')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .overlaps('review_tags', [realTag]);
      
      if (error) console.error('Overlaps Error:', error);
      else console.log('Overlaps Match Count:', count);
    }
  }
}

checkColumnType().then(testOverlaps);
