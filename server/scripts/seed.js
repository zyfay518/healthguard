const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Generate random number in range
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random date in the past week
function randomDateInPastWeek() {
    const now = new Date();
    const daysAgo = Math.random() * 7; // 0 to 7 days ago
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return date.toISOString();
}

// Symptom options
const symptomOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const symptomNotes = [
    '早上起床后感觉头晕',
    '下午运动后心率较快',
    '晚饭后感觉胸闷',
    '工作压力大，感觉疲劳',
    '睡眠不好',
    '天气变化后不太舒服',
    '休息后感觉良好',
    null, // Some entries without notes
    null,
    null,
];

async function seedDatabase() {
    console.log('🔄 开始填充测试数据...\n');

    // First, get the current user
    const { data: session } = await supabase.auth.api.getUserByCookie({ req: null });

    // We need to get a user ID from the profiles table
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
        console.error('❌ 无法获取用户 ID。请确保已有用户注册。');
        console.error('错误:', profileError);
        process.exit(1);
    }

    const userId = profiles[0].id;
    console.log(`✅ 找到用户 ID: ${userId}\n`);

    // Clear existing data
    console.log('🗑️  清空现有数据...');

    const { error: deleteVitalsError } = await supabase
        .from('vital_records')
        .delete()
        .eq('user_id', userId);

    if (deleteVitalsError) {
        console.error('删除 vital_records 失败:', deleteVitalsError);
    } else {
        console.log('   ✓ vital_records 已清空');
    }

    const { error: deleteSymptomsError } = await supabase
        .from('symptom_logs')
        .delete()
        .eq('user_id', userId);

    if (deleteSymptomsError) {
        console.error('删除 symptom_logs 失败:', deleteSymptomsError);
    } else {
        console.log('   ✓ symptom_logs 已清空');
    }

    // Generate 50 vital records
    console.log('\n📊 生成 50 条血压/心率记录...');
    const vitalRecords = [];
    for (let i = 0; i < 50; i++) {
        vitalRecords.push({
            user_id: userId,
            systolic: randomInt(100, 140),      // 收缩压 100-140
            diastolic: randomInt(60, 90),       // 舒张压 60-90
            heart_rate: randomInt(55, 100),     // 心率 55-100
            recorded_at: randomDateInPastWeek()
        });
    }

    const { error: insertVitalsError } = await supabase
        .from('vital_records')
        .insert(vitalRecords);

    if (insertVitalsError) {
        console.error('❌ 插入 vital_records 失败:', insertVitalsError);
    } else {
        console.log('   ✓ 已插入 50 条血压/心率记录');
    }

    // Generate 20 symptom logs (not all 50, more realistic)
    console.log('\n😷 生成 20 条症状记录...');
    const symptomLogs = [];
    for (let i = 0; i < 20; i++) {
        // Pick 1-3 random symptoms
        const numSymptoms = randomInt(1, 3);
        const shuffled = [...symptomOptions].sort(() => 0.5 - Math.random());
        const selectedSymptoms = shuffled.slice(0, numSymptoms);

        symptomLogs.push({
            user_id: userId,
            symptoms: selectedSymptoms,
            note: symptomNotes[randomInt(0, symptomNotes.length - 1)],
            created_at: randomDateInPastWeek()
        });
    }

    const { error: insertSymptomsError } = await supabase
        .from('symptom_logs')
        .insert(symptomLogs);

    if (insertSymptomsError) {
        console.error('❌ 插入 symptom_logs 失败:', insertSymptomsError);
    } else {
        console.log('   ✓ 已插入 20 条症状记录');
    }

    console.log('\n✅ 测试数据填充完成！');
    console.log('   - 50 条血压/心率记录');
    console.log('   - 20 条症状记录');
}

seedDatabase().catch(console.error);
