const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Checking Question Timestamps ---');
  // Sample 100 rows from the beginning and 100 from the end
  const { data: first } = await supabase.from('questions').select('id, updated_at').order('updated_at', { ascending: true }).limit(5);
  const { data: last } = await supabase.from('questions').select('id, updated_at').order('updated_at', { ascending: false }).limit(5);
  
  console.log('Oldest:', first);
  console.log('Newest:', last);
}

check();
