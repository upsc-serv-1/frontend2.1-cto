const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, count, error } = await supabase.from('questions').select('id', { count: 'exact', head: true });
  console.log('Total Rows:', count);
  
  // We can't do distinct count easily without a custom RPC, 
  // but we can try to fetch all IDs and check uniqueness.
  // Actually, 41k IDs is small enough to fetch in chunks.
  
  let allIds = new Set();
  let totalFetched = 0;
  const CHUNK = 10000;
  
  for (let i = 0; i < 5; i++) {
    const { data: chunk } = await supabase.from('questions').select('id').range(i * CHUNK, (i + 1) * CHUNK - 1);
    if (!chunk) break;
    chunk.forEach(r => allIds.add(r.id));
    totalFetched += chunk.length;
    if (chunk.length < CHUNK) break;
  }
  
  console.log('Total Fetched:', totalFetched);
  console.log('Unique IDs:', allIds.size);
}

check();
