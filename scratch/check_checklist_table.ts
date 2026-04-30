import { supabase } from './src/lib/supabase';

async function check() {
  const { data, error } = await supabase.from('checklist_notes').select('*').limit(1);
  if (error) {
    console.error('Error fetching checklist_notes:', error);
  } else {
    console.log('checklist_notes columns:', Object.keys(data[0] || {}));
  }
}

check();
