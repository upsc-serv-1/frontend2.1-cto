const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Checking for Duplicate Content with Different IDs ---');
  const { data, error } = await supabase.from('questions').select('id, question_text').limit(1000);
  
  const textMap = {};
  data.forEach(q => {
    if (textMap[q.question_text]) {
      console.log(`DUPLICATE FOUND:`);
      console.log(`ID 1: ${textMap[q.question_text]}`);
      console.log(`ID 2: ${q.id}`);
      console.log(`Text: ${q.question_text.substring(0, 50)}...`);
    } else {
      textMap[q.question_text] = q.id;
    }
  });
}

check();
