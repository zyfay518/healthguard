import express from 'express';
import webpush from 'web-push';
import { z } from 'zod';
import { supabase } from '../supabaseClient';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { formatError } from '../utils/errors';

const router = express.Router();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@healthguard.local';
const cronSecret = process.env.CRON_SECRET || '';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const subscriptionSchema = z.object({
    endpoint: z.string(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
    }),
});

const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const getDueReminder = (records: Array<{ recorded_at?: string }>) => {
    const validDates = records
        .map(record => record.recorded_at ? new Date(record.recorded_at) : null)
        .filter((date): date is Date => !!date && !isNaN(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

    if (validDates.length < 3) return null;

    const now = new Date();
    const todayRecords = validDates.filter(date => sameDay(date, now));
    const recent = validDates.filter(date => !sameDay(date, now)).slice(0, 21);
    if (recent.length < 3) return null;

    const buckets = new Map<number, number[]>();
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
};

router.get('/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidPublicKey });
});

router.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const subscription = subscriptionSchema.parse(req.body.subscription || req.body);

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: userId,
                endpoint: subscription.endpoint,
                subscription,
                user_agent: req.headers['user-agent'] || null,
                enabled: true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'endpoint' });

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: formatError(error) });
    }
});

router.post('/unsubscribe', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const endpoint = req.body.endpoint;
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

        const { error } = await supabase
            .from('push_subscriptions')
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('endpoint', endpoint);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: formatError(error) });
    }
});

const isAuthorizedCron = (req: express.Request) => {
    if (!cronSecret) return true;
    return req.headers['x-cron-secret'] === cronSecret ||
        req.headers.authorization === `Bearer ${cronSecret}`;
};

router.all('/check-due', async (req, res) => {
    try {
        if (!['GET', 'POST'].includes(req.method)) {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        if (!isAuthorizedCron(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!vapidPublicKey || !vapidPrivateKey) {
            return res.status(400).json({ error: 'Missing VAPID keys' });
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
            const todayKey = now.toISOString().slice(0, 10);
            const dedupeKey = `${todayKey}:${reminder.bucket}`;
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
            } catch (error: any) {
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

        res.json({ success: true, sent });
    } catch (error: any) {
        res.status(400).json({ error: formatError(error) });
    }
});

export default router;
