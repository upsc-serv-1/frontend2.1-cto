const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  console.log('--- Cleaning up Database ---');
  
  // To delete everything via REST API, we need a filter that matches all rows.
  // We use .neq('id', 'non-existent-id')
  
  console.log('Deleting questions...');
  const { error: qErr } = await supabase.from('questions').delete().neq('id', '_clear_all_');
  if (qErr) console.error('Error deleting questions:', qErr.message);
  else console.log('Successfully cleared questions table.');

  console.log('Deleting tests...');
  const { error: tErr } = await supabase.from('tests').delete().neq('id', '_clear_all_');
  if (tErr) console.error('Error deleting tests:', tErr.message);
  else console.log('Successfully cleared tests table.');
}

cleanup();
