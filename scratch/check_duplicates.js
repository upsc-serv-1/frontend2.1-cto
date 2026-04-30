const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Checking for Duplicate Questions ---');
  // We can't do a real GROUP BY in PostgREST easily, but we can sample some rows.
  const { data, error } = await supabase.from('questions').select('question_text, id').limit(100);
  
  if (error) {
    console.error(error);
    return;
  }

  const counts = {};
  data.forEach(q => {
    const text = q.question_text.substring(0, 100); // Compare first 100 chars
    counts[text] = (counts[text] || 0) + 1;
  });

  console.log('Sample summary:');
  Object.keys(counts).forEach(text => {
    if (counts[text] > 1) {
        console.log(`Duplicate found: "${text}..." (${counts[text]} times)`);
    }
  });
  
  // Also check if there are "old" tests
  const { data: tests, error: tErr } = await supabase.from('tests').select('institute, program_name').limit(500);
  const instCounts = {};
  tests.forEach(t => {
    const key = `${t.institute} - ${t.program_name}`;
    instCounts[key] = (instCounts[key] || 0) + 1;
  });
  console.log('\nInstitute Summary:');
  console.log(JSON.stringify(instCounts, null, 2));
}

check();
