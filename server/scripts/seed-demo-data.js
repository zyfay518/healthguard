const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const targetEmail = process.argv[2] || process.env.SEED_TARGET_EMAIL || '354966041@qq.com';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY in server/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const symptomOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const symptomNotes = [
    '今天整体感觉不错',
    '睡眠较少，下午有些疲劳',
    '饭后轻微头晕，休息后缓解',
    '工作压力较大，心率略快',
    '运动后记录，供趋势参考',
    null,
    null,
];

const glucoseContexts = [
    { measurement_context: 'fasting', post_meal_timing: null },
    { measurement_context: 'pre_meal', post_meal_timing: null },
    { measurement_context: 'post_meal', post_meal_timing: 'within_30_min' },
    { measurement_context: 'post_meal', post_meal_timing: 'one_hour' },
    { measurement_context: 'post_meal', post_meal_timing: 'two_hours' },
    { measurement_context: 'random', post_meal_timing: null },
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, precision = 1) {
    return Number((Math.random() * (max - min) + min).toFixed(precision));
}

function recordedAt(daysBack, hour, minute = randomInt(0, 59)) {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
}

async function findUserIdByEmail(email) {
    if (supabase.auth.api.listUsers) {
        try {
            const { data, error } = await supabase.auth.api.listUsers();
            if (error) throw error;
            const users = Array.isArray(data) ? data : data?.users || [];
            const user = users.find(item => item.email === email);
            if (user?.id) return user.id;
        } catch (error) {
            console.warn('Unable to list auth users, falling back to first profile.');
        }
    }

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .limit(1);

    if (error) throw error;
    if (profiles?.[0]?.id) return profiles[0].id;

    throw new Error(`Unable to find user for ${email}`);
}

async function seedDemoData() {
    console.log(`Seeding demo data for ${targetEmail}`);
    const userId = await findUserIdByEmail(targetEmail);
    console.log(`User id: ${userId}`);

    const vitalRecords = [];
    for (let i = 0; i < 45; i++) {
        const daysBack = i % 30;
        const mode = i % 5;
        const hasBp = mode !== 3;
        const hasHr = mode !== 4;
        const trendLift = Math.floor(i / 12);

        vitalRecords.push({
            user_id: userId,
            systolic: hasBp ? randomInt(106 + trendLift, 138 + trendLift) : 0,
            diastolic: hasBp ? randomInt(66, 88) : 0,
            heart_rate: hasHr ? randomInt(58, 102) : 0,
            recorded_at: recordedAt(daysBack, randomInt(7, 22)),
        });
    }

    const glucoseRecords = [];
    for (let i = 0; i < 35; i++) {
        const daysBack = i % 30;
        const context = glucoseContexts[i % glucoseContexts.length];
        const isPostMeal = context.measurement_context === 'post_meal';
        const base = context.measurement_context === 'fasting'
            ? randomFloat(4.2, 6.9)
            : isPostMeal
                ? randomFloat(6.4, 10.8)
                : randomFloat(4.8, 8.5);

        glucoseRecords.push({
            user_id: userId,
            value: base,
            unit: 'mmol/L',
            measurement_context: context.measurement_context,
            post_meal_timing: context.post_meal_timing,
            note: null,
            recorded_at: recordedAt(daysBack, isPostMeal ? randomInt(12, 21) : randomInt(6, 18)),
        });
    }

    const symptomLogs = [];
    for (let i = 0; i < 15; i++) {
        const goodDay = i % 4 === 0;
        const shuffled = [...symptomOptions.filter(id => id !== '1')].sort(() => 0.5 - Math.random());
        symptomLogs.push({
            user_id: userId,
            symptoms: goodDay ? ['1'] : shuffled.slice(0, randomInt(1, 3)),
            note: symptomNotes[randomInt(0, symptomNotes.length - 1)],
            created_at: recordedAt(i % 30, randomInt(8, 22)),
        });
    }

    const { error: vitalError } = await supabase.from('vital_records').insert(vitalRecords);
    if (vitalError) throw vitalError;

    const { error: glucoseError } = await supabase.from('glucose_records').insert(glucoseRecords);
    if (glucoseError) throw glucoseError;

    const { error: symptomError } = await supabase.from('symptom_logs').insert(symptomLogs);
    if (symptomError) throw symptomError;

    console.log('Done.');
    console.log(`Inserted ${vitalRecords.length} vital records`);
    console.log(`Inserted ${glucoseRecords.length} glucose records`);
    console.log(`Inserted ${symptomLogs.length} symptom logs`);
}

seedDemoData().catch(error => {
    console.error(error);
    process.exit(1);
});
