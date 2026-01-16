const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Environment variables (set these in Vercel)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));
app.options('*', cors());
app.use(express.json());

// Auth middleware
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Auth failed' });
    }
};

// === VITALS ROUTES ===
app.get('/api/vitals', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vitals')
            .select('*')
            .eq('user_id', req.user.id)
            .order('recorded_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vitals', authMiddleware, async (req, res) => {
    try {
        const { systolic, diastolic, heart_rate, recorded_at } = req.body;
        const { data, error } = await supabase
            .from('vitals')
            .insert([{ user_id: req.user.id, systolic, diastolic, heart_rate, recorded_at }])
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/vitals', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        const { error } = await supabase
            .from('vitals')
            .delete()
            .in('id', ids)
            .eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === SYMPTOMS ROUTES ===
app.get('/api/symptoms', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('symptoms')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/symptoms', authMiddleware, async (req, res) => {
    try {
        const { symptoms, note, created_at } = req.body;
        const { data, error } = await supabase
            .from('symptoms')
            .insert([{ user_id: req.user.id, symptoms, note, created_at: created_at || new Date().toISOString() }])
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/symptoms', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        const { error } = await supabase
            .from('symptoms')
            .delete()
            .in('id', ids)
            .eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === AUTH/PROFILE ROUTES ===
app.get('/api/auth/profile', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', req.user.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
    try {
        const { nickname, avatar_url, height, weight } = req.body;
        const { data, error } = await supabase
            .from('profiles')
            .upsert({ user_id: req.user.id, nickname, avatar_url, height, weight }, { onConflict: 'user_id' })
            .select();
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/api', (req, res) => {
    res.json({ status: 'HealthGuard API is running' });
});

module.exports = app;
