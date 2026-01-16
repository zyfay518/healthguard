import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { symptomService } from '../services/api';

const symptomsList = [
  { id: '1', name: '感觉良好', icon: 'sentiment_satisfied', color: 'green' },
  { id: '2', name: '头痛', icon: 'healing', color: 'primary' },
  { id: '3', name: '头晕', icon: 'blur_circular', color: 'blue' },
  { id: '4', name: '心悸', icon: 'ecg_heart', color: 'red' },
  { id: '5', name: '胸闷', icon: 'compress', color: 'orange' },
  { id: '6', name: '疲劳', icon: 'bedtime', color: 'indigo' },
  { id: '7', name: '恶心', icon: 'sick', color: 'yellow' },
  { id: '8', name: '气短', icon: 'air', color: 'cyan' },
  { id: '9', name: '其他', icon: 'more_horiz', color: 'gray' },
];

const Symptoms: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const symptomId = searchParams.get('id');
  const [selected, setSelected] = useState<string[]>(symptomId ? [symptomId] : ['2']);
  const [isSaving, setIsSaving] = useState(false);

  // Parse date/time from URL params
  const getInitialDateTime = () => {
    const dateParam = searchParams.get('date');
    const hourParam = searchParams.get('hour');
    const minuteParam = searchParams.get('minute');

    if (dateParam) {
      const date = new Date(dateParam);
      const hour = hourParam ? parseInt(hourParam) : new Date().getHours();
      const minute = minuteParam ? parseInt(minuteParam) : new Date().getMinutes();
      date.setHours(hour, minute, 0, 0);
      return date;
    }
    return new Date();
  };

  const [recordTime, setRecordTime] = useState(getInitialDateTime());

  // Update time when returning from date selection
  useEffect(() => {
    const dateParam = searchParams.get('date');
    const hourParam = searchParams.get('hour');
    const minuteParam = searchParams.get('minute');

    if (dateParam) {
      const date = new Date(dateParam);
      const hour = hourParam ? parseInt(hourParam) : recordTime.getHours();
      const minute = minuteParam ? parseInt(minuteParam) : recordTime.getMinutes();
      date.setHours(hour, minute, 0, 0);
      setRecordTime(date);
    }
  }, [searchParams]);

  const toggleSymptom = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Format date as YYYY-MM-DD using local time (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const noteElement = document.getElementById('notes') as HTMLTextAreaElement;
      const note = noteElement ? noteElement.value : '';

      await symptomService.create({
        symptoms: selected,
        note: note,
        recorded_at: recordTime.toISOString()
      });

      // Pass time to next page via URL params
      const dateStr = formatLocalDate(recordTime);
      const hour = recordTime.getHours();
      const minute = recordTime.getMinutes();
      navigate(`/record?date=${dateStr}&hour=${hour}&minute=${minute}`);
    } catch (error) {
      console.error('Failed to save symptoms', error);
      alert('保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTime = () => {
    const dateStr = formatLocalDate(recordTime);
    const hour = recordTime.getHours();
    const minute = recordTime.getMinutes();
    navigate(`/date-select?date=${dateStr}&hour=${hour}&minute=${minute}&returnTo=/symptoms`);
  };

  // Format display text
  const isToday = new Date().toDateString() === recordTime.toDateString();
  const dateText = isToday ? '今天' : recordTime.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '日';
  const timeText = recordTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-24 bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 flex items-center justify-between p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 dark:hover:bg-[#2a1d36] text-[#140c1d] dark:text-white transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold">身体状况</h1>
        {/* Removed calendar button, added empty div for spacing */}
        <div className="size-10"></div>
      </header>

      <main className="flex flex-col gap-6 px-4 pt-2">
        {/* Time display with edit button */}
        <div className="flex items-center justify-center">
          <button
            onClick={handleEditTime}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345] shadow-sm active:scale-95 transition-transform"
          >
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{dateText}, {timeText}</span>
            <span className="material-symbols-outlined text-[14px] text-gray-400">edit</span>
          </button>
        </div>

        <div className="text-center space-y-2 mt-2">
          <h2 className="text-2xl font-bold text-[#140c1d] dark:text-white">您现在感觉如何？</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">请选择所有符合您当前感受的症状</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {symptomsList.map((item) => {
            const isSelected = selected.includes(item.id);
            const isPrimary = item.color === 'primary';
            const activeBorder = isSelected
              ? (isPrimary ? 'border-primary' : `border-${item.color}-500`)
              : 'border-gray-100 dark:border-[#352345]';
            const activeBg = isSelected
              ? (isPrimary ? 'bg-primary/5' : `bg-${item.color}-50 dark:bg-${item.color}-900/10`)
              : 'bg-white dark:bg-[#231530]';

            return (
              <button
                key={item.id}
                onClick={() => toggleSymptom(item.id)}
                className={`group flex flex-col items-center justify-center aspect-[4/3.5] rounded-2xl ${activeBg} border ${activeBorder} ${isSelected ? 'border-2' : ''} shadow-sm transition-all relative overflow-hidden active:scale-95`}
              >
                {isSelected && (
                  <div className={`absolute top-2 right-2 size-4 rounded-full ${isPrimary ? 'bg-primary' : `bg-${item.color}-500`} text-white flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                  </div>
                )}
                <div className={`mb-2 p-2 rounded-full ${isSelected ? (isPrimary ? 'bg-primary/10' : `bg-${item.color}-100`) : `bg-${item.color}-50 dark:bg-${item.color}-900/20`} text-${item.color === 'primary' ? 'primary' : `${item.color}-500`} group-hover:scale-110 transition-transform`}>
                  <span className={`material-symbols-outlined text-[28px] ${isSelected ? 'fill-current' : ''}`}>{item.icon}</span>
                </div>
                <span className={`text-xs font-bold ${isSelected ? (isPrimary ? 'text-primary' : `text-${item.color}-600`) : 'text-gray-600 dark:text-gray-300'}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-bold text-[#140c1d] dark:text-white" htmlFor="notes">添加备注 (选填)</label>
          <div className="relative">
            <textarea
              className="w-full rounded-xl border-gray-200 dark:border-[#352345] bg-white dark:bg-[#231530] text-[#140c1d] dark:text-white focus:ring-primary focus:border-primary placeholder:text-gray-400 text-sm resize-none p-4 shadow-sm"
              id="notes"
              placeholder="描述具体的疼痛部位或程度..."
              rows={3}
            ></textarea>
            <div className="absolute bottom-3 right-3 text-gray-400 dark:text-gray-500 pointer-events-none">
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 pb-safe bg-white/80 dark:bg-[#1f122b]/90 backdrop-blur-lg border-t border-gray-100 dark:border-[#352345] z-30">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl py-4 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSaving ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <span className="material-symbols-outlined">check_circle</span>
          )}
          <span className="text-lg font-bold">{isSaving ? '保存中...' : '保存并下一步'}</span>
        </button>
      </div>
    </div>
  );
};

export default Symptoms;