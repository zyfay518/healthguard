export interface Symptom {
    id: string;
    name: string;
    icon: string;
    colorClass: string; // e.g., "text-green-500 bg-green-50"
}

export interface VitalRecord {
    id: string;
    date: string;
    systolic: number;
    diastolic: number;
    heartRate: number;
}
