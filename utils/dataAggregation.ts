// Data aggregation utilities for vital records

export interface VitalRecord {
    id: string;
    user_id: string;
    systolic: number | null;
    diastolic: number | null;
    heart_rate: number | null;
    recorded_at: string;
}

export type GlucoseContext = 'fasting' | 'pre_meal' | 'post_meal' | 'random';
export type PostMealTiming = 'within_30_min' | 'one_hour' | 'two_hours' | 'over_two_hours';

export interface GlucoseRecord {
    id: string;
    user_id: string;
    value: number;
    unit: 'mmol/L';
    measurement_context?: GlucoseContext | null;
    post_meal_timing?: PostMealTiming | null;
    note?: string | null;
    recorded_at: string;
    created_at?: string;
}

export interface AggregatedData {
    label: string;
    date: Date;
    systolic: number;
    diastolic: number;
    heart_rate: number;
    count: number;
}

export interface GlucoseAggregatedData {
    label: string;
    date: Date;
    value: number;
    count: number;
}

// Format date as yy/mm/dd
export function formatDateShort(date: Date): string {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
}

// Format date as yy/mm (for month view)
export function formatMonthShort(date: Date): string {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yy}/${mm}`;
}

// Format time as HH:MM
export function formatTime(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

// Get the start of a day (00:00:00)
export function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Get the start of a week (Monday)
export function startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Get the start of a month
export function startOfMonth(date: Date): Date {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function averagePositive(records: VitalRecord[], field: 'systolic' | 'diastolic' | 'heart_rate'): number {
    const values = records
        .map(record => record[field])
        .filter(value => typeof value === 'number' && value > 0);

    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

// Group records by day and calculate averages
export function aggregateByDay(records: VitalRecord[]): AggregatedData[] {
    const grouped: Map<string, VitalRecord[]> = new Map();

    records.forEach(record => {
        const date = startOfDay(new Date(record.recorded_at));
        const key = date.toISOString();
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
    });

    const result: AggregatedData[] = [];
    grouped.forEach((dayRecords, key) => {
        const date = new Date(key);
        const count = dayRecords.length;
        result.push({
            label: formatDateShort(date),
            date,
            systolic: averagePositive(dayRecords, 'systolic'),
            diastolic: averagePositive(dayRecords, 'diastolic'),
            heart_rate: averagePositive(dayRecords, 'heart_rate'),
            count
        });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function aggregateGlucoseByDay(records: GlucoseRecord[]): GlucoseAggregatedData[] {
    const grouped: Map<string, GlucoseRecord[]> = new Map();

    records.forEach(record => {
        const date = startOfDay(new Date(record.recorded_at));
        const key = date.toISOString();
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
    });

    const result: GlucoseAggregatedData[] = [];
    grouped.forEach((dayRecords, key) => {
        const date = new Date(key);
        const count = dayRecords.length;
        result.push({
            label: formatDateShort(date),
            date,
            value: Number((dayRecords.reduce((sum, r) => sum + r.value, 0) / count).toFixed(1)),
            count
        });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getLatestGlucoseRecord(records: GlucoseRecord[]): GlucoseRecord | null {
    return [...records]
        .filter(record => typeof record.value === 'number' && record.recorded_at)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] || null;
}

export function formatGlucoseContext(record?: GlucoseRecord | null): string {
    if (!record?.measurement_context || record.measurement_context === 'random') return '未标记时机';
    if (record.measurement_context === 'fasting') return '空腹';
    if (record.measurement_context === 'pre_meal') return '餐前';
    if (record.measurement_context === 'post_meal') {
        const timingMap: Record<PostMealTiming, string> = {
            within_30_min: '餐后30分钟内',
            one_hour: '餐后1小时',
            two_hours: '餐后2小时',
            over_two_hours: '餐后2小时以上',
        };
        return record.post_meal_timing ? timingMap[record.post_meal_timing] : '餐后';
    }
    return '未标记时机';
}

export function evaluateGlucose(record?: GlucoseRecord | null): { text: string; color: string; advice: string } {
    if (!record || typeof record.value !== 'number') {
        return { text: '暂无', color: 'gray', advice: '' };
    }

    if (record.value < 3.9) {
        return { text: '偏低', color: 'yellow', advice: '血糖偏低，若伴随出汗、心慌或乏力，建议及时补充糖分并关注身体反应。' };
    }

    if (record.measurement_context === 'fasting' || record.measurement_context === 'pre_meal') {
        if (record.value >= 4.4 && record.value <= 7.2) {
            return { text: '正常', color: 'green', advice: '当前血糖处于常见餐前目标范围。' };
        }
        if (record.value > 7.2) {
            return { text: '偏高', color: 'orange', advice: '餐前/空腹血糖偏高，建议结合近期饮食、运动和医生建议持续观察。' };
        }
        return { text: '需关注', color: 'yellow', advice: '血糖低于常见餐前目标范围，建议留意低血糖反应。' };
    }

    if (record.measurement_context === 'post_meal') {
        if (record.value < 10) {
            return { text: '正常', color: 'green', advice: '当前餐后血糖处于常见目标范围。' };
        }
        if (record.value >= 11.1) {
            return { text: '偏高', color: 'red', advice: '餐后血糖明显偏高，建议复测并结合医生建议判断。' };
        }
        return { text: '偏高', color: 'orange', advice: '餐后血糖偏高，建议关注饮食结构和记录趋势。' };
    }

    if (record.value >= 11.1) {
        return { text: '偏高', color: 'orange', advice: '随机血糖偏高，建议补充测量时机并持续观察。' };
    }

    return { text: '已记录', color: 'blue', advice: '建议标记空腹、餐前或餐后，以获得更准确判断。' };
}


// Group records by week and calculate averages
export function aggregateByWeek(records: VitalRecord[]): AggregatedData[] {
    const grouped: Map<string, VitalRecord[]> = new Map();

    records.forEach(record => {
        const date = startOfWeek(new Date(record.recorded_at));
        const key = date.toISOString();
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
    });

    const result: AggregatedData[] = [];
    grouped.forEach((weekRecords, key) => {
        const date = new Date(key);
        const count = weekRecords.length;
        result.push({
            label: formatDateShort(date), // First day of week
            date,
            systolic: averagePositive(weekRecords, 'systolic'),
            diastolic: averagePositive(weekRecords, 'diastolic'),
            heart_rate: averagePositive(weekRecords, 'heart_rate'),
            count
        });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Group records by month and calculate averages
export function aggregateByMonth(records: VitalRecord[]): AggregatedData[] {
    const grouped: Map<string, VitalRecord[]> = new Map();

    records.forEach(record => {
        const date = startOfMonth(new Date(record.recorded_at));
        const key = date.toISOString();
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
    });

    const result: AggregatedData[] = [];
    grouped.forEach((monthRecords, key) => {
        const date = new Date(key);
        const count = monthRecords.length;
        result.push({
            label: formatMonthShort(date),
            date,
            systolic: averagePositive(monthRecords, 'systolic'),
            diastolic: averagePositive(monthRecords, 'diastolic'),
            heart_rate: averagePositive(monthRecords, 'heart_rate'),
            count
        });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Get all individual records formatted for display
export function formatRecordsForDisplay(records: VitalRecord[]): AggregatedData[] {
    return records
        .map(record => {
            const date = new Date(record.recorded_at);
            return {
                label: formatTime(date),
                date,
                systolic: record.systolic || 0,
                diastolic: record.diastolic || 0,
                heart_rate: record.heart_rate || 0,
                count: 1
            };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

// Format date range for display in header
export function formatDateRange(startDate: Date, endDate: Date): string {
    if (isSameDay(startDate, endDate)) {
        return `${startDate.getMonth() + 1}月${startDate.getDate()}日`;
    }
    return `${startDate.getMonth() + 1}月${startDate.getDate()}日 - ${endDate.getMonth() + 1}月${endDate.getDate()}日`;
}

// Calculate days ago for "last record" time
export function getTimeAgoString(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays === 1) return '昨天';
    return `${diffDays} 天前`;
}

// Get the N most recent records
export function getLastNRecords(records: VitalRecord[], n: number = 3): VitalRecord[] {
    return [...records]
        .filter(v => typeof v.systolic === 'number' && v.systolic > 0 && typeof v.diastolic === 'number' && v.diastolic > 0)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
        .slice(0, n);
}

export function getLatestHeartRateRecord(records: VitalRecord[]): VitalRecord | null {
    return [...records]
        .filter(v => typeof v.heart_rate === 'number' && v.heart_rate > 0 && v.recorded_at)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] || null;
}

// Evaluate BP based on comprehensive guidelines (Age, BMI, Gender)
export function evaluateBP(systolic: number, diastolic: number, age: number = 30, gender: string = 'unknown', bmi: number = 22): { text: string; color: string; advice: string } {
    let status = 'normal';

    if (systolic < 90 || diastolic < 60) {
        status = 'low';
    } else if (systolic >= 180 || diastolic >= 110) {
        status = 'grade3';
    } else if (systolic >= 160 || diastolic >= 100) {
        status = 'grade2';
    } else if (systolic >= 140 || diastolic >= 90) {
        status = 'grade1';
    } else if (systolic >= 120 || diastolic >= 80) {
        status = 'high-normal';
    }

    if (age >= 65 && status === 'grade1' && systolic < 150 && diastolic < 90) {
        return { text: '达标(长者)', color: 'blue', advice: '对于65岁以上长者，此血压水平处于可接受的达标范围，建议继续保持监测。' };
    }

    let bmiAdvice = '';
    if (bmi >= 28) {
        bmiAdvice = '经测算您的BMI处于肥胖范围，这是高血压的危险信号。建议积极控制体重，适度增加运动。';
    } else if (bmi >= 24) {
        bmiAdvice = '您的BMI处于超重范围。减重可能有助于进一步改善或控制血压水平。';
    }

    switch (status) {
        case 'low': return { text: '偏低', color: 'yellow', advice: '血压偏低。若伴随头晕、乏力等症状，建议就医。' };
        case 'normal': return { text: '正常', color: 'green', advice: '血压完全正常，请继续保持良好的生活习惯！' };
        case 'high-normal': return { text: '偏高', color: 'orange', advice: `血压处于正常高值（偏高）。${bmiAdvice}` };
        case 'grade1': return { text: '偏高', color: 'red', advice: `处于一级高血压范围。建议增加测量频次，并改善生活方式。${bmiAdvice}` };
        case 'grade2': return { text: '过高', color: 'red', advice: `处于二级高血压范围。建议及时就医咨询，可能需要药物干预。${bmiAdvice}` };
        case 'grade3': return { text: '危险', color: 'red', advice: `处于三级高血压范围。请尽快就医，避免引发心脑血管并发症！` };
        default: return { text: '正常', color: 'green', advice: '' };
    }
}

// Get dynamic BP thresholds based on age and gender
export function getBPThresholds(age: number = 30, gender: string = 'unknown'): { systolic: number; diastolic: number } {
    let systolic = 120;
    let diastolic = 80;

    // Base adjustments by age
    if (age >= 65) {
        systolic = 140;
        diastolic = 90;
    } else if (age >= 45) {
        systolic = 130;
        diastolic = 85;
    } else {
        systolic = 120;
        diastolic = 80;
    }

    // Gender specific minor tweaks (e.g. younger females often have slightly lower baseline BP)
    if (gender === 'female' && age < 50) {
        systolic -= 5;
        diastolic -= 5;
    }

    return { systolic, diastolic };
}

// Get dynamic HR thresholds based on age and gender
export function getHRThresholds(age: number = 30, gender: string = 'unknown'): { max: number; min: number } {
    let max = 100;
    let min = 60;

    // Resting HR tends to decrease slightly with age
    if (age >= 60) {
        max = 90;
        min = 55;
    } else if (age <= 18) {
        max = 105;
        min = 65;
    }

    // Females sometimes have slightly higher resting HR than males
    if (gender === 'female') {
        max += 5;
    }

    return { max, min };
}
