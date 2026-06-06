import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@healthguard.local';
const cronSecret = process.env.CRON_SECRET || '';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function formatError(error, fallback = 'Internal server error') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    if (typeof error.message === 'string') return error.message;
    if (error.message) return formatError(error.message, fallback);
    if (typeof error.error === 'string') return error.error;
    if (error.error) return formatError(error.error, fallback);
    try {
        return JSON.stringify(error);
    } catch {
        return fallback;
    }
}

function isAuthorizedCron(req) {
    if (!cronSecret) return true;
    return req.headers['x-cron-secret'] === cronSecret ||
        req.headers.authorization === `Bearer ${cronSecret}`;
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
    res.end(JSON.stringify(data));
}

function isMissingGlucoseTable(error) {
    return error?.code === '42P01' ||
        error?.code === 'PGRST205' ||
        String(error?.message || '').includes('glucose_records');
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function getDueReminder(records) {
    const validDates = records
        .map(record => record.recorded_at ? new Date(record.recorded_at) : null)
        .filter(date => date && !Number.isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

    if (validDates.length < 3) return null;

    const now = new Date();
    const todayRecords = validDates.filter(date => sameDay(date, now));
    const recent = validDates.filter(date => !sameDay(date, now)).slice(0, 21);
    if (recent.length < 3) return null;

    const buckets = new Map();
    recent.forEach(date => {
        const bucket = Math.floor(minutesOfDay(date) / 180) * 180;
        buckets.set(bucket, [...(buckets.get(bucket) || []), minutesOfDay(date)]);
    });

    const likelyBuckets = [...buckets.entries()]
        .filter(([, values]) => values.length >= 2)
        .map(([bucket, values]) => ({
            bucket,
            dueMinute: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) + 30,
            count: values.length,
        }))
        .sort((a, b) => b.count - a.count);

    const nowMinute = minutesOfDay(now);
    return likelyBuckets.find(item => {
        const alreadyRecordedInWindow = todayRecords.some(date => {
            const minute = minutesOfDay(date);
            return minute >= item.bucket && minute <= item.bucket + 210;
        });
        return !alreadyRecordedInWindow && nowMinute >= item.dueMinute && nowMinute <= item.dueMinute + 60;
    }) || null;
}

async function checkDueNotifications() {
    if (!vapidPublicKey || !vapidPrivateKey) {
        throw new Error('Missing VAPID keys');
    }

    const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('enabled', true);

    if (subError) throw subError;

    let sent = 0;
    for (const item of subscriptions || []) {
        const userId = item.user_id;
        const { data: vitals } = await supabase
            .from('vital_records')
            .select('recorded_at')
            .eq('user_id', userId)
            .order('recorded_at', { ascending: false })
            .limit(80);
        const { data: glucose } = await supabase
            .from('glucose_records')
            .select('recorded_at')
            .eq('user_id', userId)
            .order('recorded_at', { ascending: false })
            .limit(80);

        const reminder = getDueReminder([...(vitals || []), ...(glucose || [])]);
        if (!reminder) continue;

        const now = new Date();
        const dedupeKey = `${now.toISOString().slice(0, 10)}:${reminder.bucket}`;
        if (item.last_sent_key === dedupeKey) continue;

        try {
            await webpush.sendNotification(item.subscription, JSON.stringify({
                title: '健康记录提醒',
                body: '到了你平常记录健康数据的时间。今天还没记录的话，可以按需打卡。',
                url: '/',
            }));

            await supabase
                .from('push_subscriptions')
                .update({
                    last_sent_at: now.toISOString(),
                    last_sent_key: dedupeKey,
                    updated_at: now.toISOString(),
                })
                .eq('id', item.id);
            sent += 1;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await supabase
                    .from('push_subscriptions')
                    .update({ enabled: false, updated_at: new Date().toISOString() })
                    .eq('id', item.id);
            } else {
                console.error('Push send failed:', error.message);
            }
        }
    }

    return sent;
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
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

    if (url.startsWith('/api/notifications/vapid-public-key') && method === 'GET') {
        return json(res, 200, { publicKey: vapidPublicKey });
    }

    if (url.startsWith('/api/notifications/check-due') && ['GET', 'POST'].includes(method)) {
        if (!isAuthorizedCron(req)) {
            return json(res, 401, { error: 'Unauthorized' });
        }

        try {
            const sent = await checkDueNotifications();
            return json(res, 200, { success: true, sent });
        } catch (err) {
            console.error('Notification check failed:', err);
            return json(res, 500, { error: formatError(err, 'Notification check failed') });
        }
    }

    // Auth required for all other routes
    const user = await getUser(req);
    if (!user) {
        return json(res, 401, { error: 'Unauthorized' });
    }

    try {
        // === VITALS ===
        if (url.startsWith('/api/notifications')) {
            if (url.startsWith('/api/notifications/subscribe') && method === 'POST') {
                const body = await parseBody(req);
                const subscription = body.subscription || body;
                if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
                    return json(res, 400, { error: 'Invalid push subscription' });
                }

                const { error } = await supabase
                    .from('push_subscriptions')
                    .upsert({
                        user_id: user.id,
                        endpoint: subscription.endpoint,
                        subscription,
                        user_agent: req.headers['user-agent'] || null,
                        enabled: true,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'endpoint' });

                if (error) throw error;
                return json(res, 200, { success: true });
            }

            if (url.startsWith('/api/notifications/unsubscribe') && method === 'POST') {
                const body = await parseBody(req);
                if (!body.endpoint) {
                    return json(res, 400, { error: 'Missing endpoint' });
                }

                const { error } = await supabase
                    .from('push_subscriptions')
                    .update({ enabled: false, updated_at: new Date().toISOString() })
                    .eq('user_id', user.id)
                    .eq('endpoint', body.endpoint);

                if (error) throw error;
                return json(res, 200, { success: true });
            }
        }

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
                let { data, error } = await supabase
                    .from('vital_records')
                    .insert([{ user_id: user.id, ...body }])
                    .select();
                if (error && String(error.message || '').includes('null value')) {
                    const fallbackBody = {
                        ...body,
                        systolic: body.systolic ?? 0,
                        diastolic: body.diastolic ?? 0,
                        heart_rate: body.heart_rate ?? 0
                    };
                    const fallbackResult = await supabase
                        .from('vital_records')
                        .insert([{ user_id: user.id, ...fallbackBody }])
                        .select();
                    data = fallbackResult.data;
                    error = fallbackResult.error;
                }
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
                const symptomTime = body.recorded_at || body.created_at || new Date().toISOString();
                const { data, error } = await supabase
                    .from('symptom_logs')
                    .insert([{ user_id: user.id, symptoms: body.symptoms, note: body.note, created_at: symptomTime }])
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

        // === GLUCOSE ===
        if (url.startsWith('/api/glucose')) {
            if (method === 'GET') {
                const { data, error } = await supabase
                    .from('glucose_records')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('recorded_at', { ascending: false });
                if (error) {
                    if (isMissingGlucoseTable(error)) return json(res, 200, []);
                    throw error;
                }
                return json(res, 200, data || []);
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                const { data, error } = await supabase
                    .from('glucose_records')
                    .insert([{
                        user_id: user.id,
                        value: body.value,
                        unit: body.unit || 'mmol/L',
                        measurement_context: body.measurement_context || null,
                        post_meal_timing: body.post_meal_timing || null,
                        note: body.note || null,
                        recorded_at: body.recorded_at || new Date().toISOString()
                    }])
                    .select();
                if (error) throw error;
                return json(res, 200, data[0]);
            }
            if (method === 'DELETE') {
                const body = await parseBody(req);
                const { error } = await supabase
                    .from('glucose_records')
                    .delete()
                    .in('id', body.ids || [])
                    .eq('user_id', user.id);
                if (error) throw error;
                return json(res, 200, { success: true });
            }
        }

        // === PROFILE ===
        // NOTE: profiles table uses 'id' as primary key (directly references auth.users), not 'user_id'
        if (url.startsWith('/api/auth/profile')) {
            if (method === 'GET') {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (error && error.code !== 'PGRST116') throw error;
                return json(res, 200, data || {});
            }
            if (method === 'PUT') {
                const body = await parseBody(req);
                // For profiles, id = user.id (the auth user id)
                const { data, error } = await supabase
                    .from('profiles')
                    .upsert({ id: user.id, ...body }, { onConflict: 'id' })
                    .select();
                if (error) throw error;
                return json(res, 200, data[0]);
            }
        }

        // Route not found
        return json(res, 404, { error: 'Not found' });

    } catch (err) {
        console.error('API Error:', err);
        return json(res, 500, { error: formatError(err) });
    }
}
