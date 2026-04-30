import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function findDuplicates() {
  console.log("Checking for duplicate PYQs...");
  
  // Get a few PYQs and see if they exist in multiple tests
  const { data: pyqs } = await supabase
    .from('questions')
    .select('question_text, is_pyq, test_id, source')
    .eq('is_pyq', true)
    .limit(50);
    
  if (!pyqs) return;

  const counts: Record<string, string[]> = {};
  pyqs.forEach(q => {
    const textSnippet = q.question_text.slice(0, 100);
    if (!counts[textSnippet]) counts[textSnippet] = [];
    counts[textSnippet].push(q.test_id);
  });

  console.log("Sample Duplicate Check (First 100 chars):");
  Object.entries(counts).forEach(([text, ids]) => {
    if (ids.length > 1) {
      console.log(`- "${text}..."`);
      console.log(`  Tests: ${ids.join(", ")}`);
    }
  });

  // Check how many have is_upsc_cse = true
  const { count: upscCseCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_upsc_cse', true);
    
  const { count: totalPyqCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('is_pyq', true);

  console.log(`\nTotal PYQs: ${totalPyqCount}`);
  console.log(`UPSC CSE PYQs: ${upscCseCount}`);
}

findDuplicates();
