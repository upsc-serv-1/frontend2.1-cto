const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { count, error } = await supabase.from('tests').select('*', { count: 'exact', head: true });
  console.log('Tests count:', count);
  if (error) console.log('Error:', error.message);
  
  const { count: qCount, error: qError } = await supabase.from('questions').select('*', { count: 'exact', head: true });
  console.log('Questions count:', qCount);
  if (qError) console.log('Error:', qError.message);
}

check();
