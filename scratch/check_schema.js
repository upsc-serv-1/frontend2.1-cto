const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Checking Tests Table ---');
  const { error: error1 } = await supabase.from('tests').insert({ check_cols: 1 });
  console.log('Tests error:', error1?.message);
  
  console.log('\n--- Checking Questions Table ---');
  const { error: error2 } = await supabase.from('questions').insert({ check_cols: 1 });
  console.log('Questions error:', error2?.message);
}

check();
