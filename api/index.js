import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
}

// Helper: Parse request body
async function parseBody(req) {
    return new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(data || '{}'));
            } catch {
                resolve({});
            }
        });
    });
}

// Helper: Send JSON response
function json(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
}

// Helper: Get user from token (Supabase v1 compatible)
async function getUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No auth header found');
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        // Supabase v1 uses auth.api.getUser(token)
        const { data: user, error } = await supabase.auth.api.getUser(token);
        if (error || !user) {
            console.log('Auth error:', error?.message);
            return null;
        }
        return user;
    } catch (err) {
        console.log('Auth exception:', err.message);
        return null;
    }
}

// Main handler
export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.statusCode = 200;
        res.end();
        return;
    }

    // Check Supabase initialization
    if (!supabase) {
        return json(res, 500, { error: 'Server not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.' });
    }

    const url = req.url || '';
    const method = req.method || 'GET';

    // Route: Health check
    if (url === '/api' || url === '/api/') {
        return json(res, 200, { status: 'HealthGuard API is running' });
    }

    // Auth required for all other routes
    const user = await getUser(req);
    if (!user) {
        return json(res, 401, { error: 'Unauthorized' });
    }

    try {
        // === VITALS ===
        if (url.startsWith('/api/vitals')) {
            if (method === 'GET') {
                const { data, error } = await supabase
                    .from('vital_records')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('recorded_at', { ascending: false });
                if (error) throw error;
                return json(res, 200, data);
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                const { data, error } = await supabase
                    .from('vital_records')
                    .insert([{ user_id: user.id, ...body }])
                    .select();
                if (error) throw error;
                return json(res, 200, data[0]);
            }
            if (method === 'DELETE') {
                const body = await parseBody(req);
                const { error } = await supabase
                    .from('vital_records')
                    .delete()
                    .in('id', body.ids || [])
                    .eq('user_id', user.id);
                if (error) throw error;
                return json(res, 200, { success: true });
            }
        }

        // === SYMPTOMS ===
        if (url.startsWith('/api/symptoms')) {
            if (method === 'GET') {
                const { data, error } = await supabase
                    .from('symptom_logs')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return json(res, 200, data);
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                const { data, error } = await supabase
                    .from('symptom_logs')
                    .insert([{ user_id: user.id, symptoms: body.symptoms, note: body.note, created_at: body.created_at || new Date().toISOString() }])
                    .select();
                if (error) throw error;
                return json(res, 200, data[0]);
            }
            if (method === 'DELETE') {
                const body = await parseBody(req);
                const { error } = await supabase
                    .from('symptom_logs')
                    .delete()
                    .in('id', body.ids || [])
                    .eq('user_id', user.id);
                if (error) throw error;
                return json(res, 200, { success: true });
            }
        }

        // === PROFILE ===
        if (url.startsWith('/api/auth/profile')) {
            if (method === 'GET') {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                if (error && error.code !== 'PGRST116') throw error;
                return json(res, 200, data || {});
            }
            if (method === 'PUT') {
                const body = await parseBody(req);
                const { data, error } = await supabase
                    .from('profiles')
                    .upsert({ user_id: user.id, ...body }, { onConflict: 'user_id' })
                    .select();
                if (error) throw error;
                return json(res, 200, data[0]);
            }
        }

        // Route not found
        return json(res, 404, { error: 'Not found' });

    } catch (err) {
        console.error('API Error:', err);
        return json(res, 500, { error: err.message || 'Internal server error' });
    }
}
