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
