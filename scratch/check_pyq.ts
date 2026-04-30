import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkPyqData() {
  console.log("Checking PYQ data schema...");
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('is_pyq', true)
    .limit(1);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Keys:", Object.keys(data[0]));
    console.log("Sample Data:", JSON.stringify(data[0], null, 2));
  }
}

checkPyqData();
