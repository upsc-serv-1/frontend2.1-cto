import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log("Checking 'tests' table...");
  const { data: tests, error: tError } = await supabase.from('tests').select('*').limit(5);
  if (tError) console.error("Tests Error:", tError);
  else console.log("Tests Sample:", JSON.stringify(tests, null, 2));

  console.log("\nChecking 'questions' table...");
  const { data: questions, error: qError } = await supabase.from('questions').select('*').limit(5);
  if (qError) console.error("Questions Error:", qError);
  else console.log("Questions Sample:", JSON.stringify(questions, null, 2));
}

checkData();
