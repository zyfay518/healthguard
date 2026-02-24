// Data aggregation utilities for vital records

export interface VitalRecord {
    id: string;
    user_id: string;
    systolic: number;
    diastolic: number;
    heart_rate: number;
    recorded_at: string;
}

export interface AggregatedData {
    label: string;
    date: Date;
    systolic: number;
    diastolic: number;
    heart_rate: number;
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
            systolic: Math.round(dayRecords.reduce((sum, r) => sum + r.systolic, 0) / count),
            diastolic: Math.round(dayRecords.reduce((sum, r) => sum + r.diastolic, 0) / count),
            heart_rate: Math.round(dayRecords.reduce((sum, r) => sum + r.heart_rate, 0) / count),
            count
        });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
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
            systolic: Math.round(weekRecords.reduce((sum, r) => sum + r.systolic, 0) / count),
            diastolic: Math.round(weekRecords.reduce((sum, r) => sum + r.diastolic, 0) / count),
            heart_rate: Math.round(weekRecords.reduce((sum, r) => sum + r.heart_rate, 0) / count),
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
            systolic: Math.round(monthRecords.reduce((sum, r) => sum + r.systolic, 0) / count),
            diastolic: Math.round(monthRecords.reduce((sum, r) => sum + r.diastolic, 0) / count),
            heart_rate: Math.round(monthRecords.reduce((sum, r) => sum + r.heart_rate, 0) / count),
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
                systolic: record.systolic,
                diastolic: record.diastolic,
                heart_rate: record.heart_rate,
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
        .filter(v => typeof v.systolic === 'number' && typeof v.diastolic === 'number')
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
        .slice(0, n);
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
