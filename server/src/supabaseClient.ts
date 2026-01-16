import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use Service Role Key to bypass RLS

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase URL or Service Key');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
