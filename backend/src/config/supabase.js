const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not set. Database features will not work.');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

module.exports = supabase;
