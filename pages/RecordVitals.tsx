import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { vitalService } from '../services/api';

const RecordVitals: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [systolic, setSystolic] = useState('--');
  const [diastolic, setDiastolic] = useState('--');
  const [activeField, setActiveField] = useState<'sys' | 'dia' | 'hr'>('sys');
  const [heartRate, setHeartRate] = useState('--');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Parse date/time from URL params (synced with Symptoms page)
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

  const handleKeyPress = (key: string) => {
    let currentVal = '';
    let setVal = (val: string) => { };

    if (activeField === 'sys') { currentVal = systolic; setVal = setSystolic; }
    else if (activeField === 'dia') { currentVal = diastolic; setVal = setDiastolic; }
    else { currentVal = heartRate; setVal = setHeartRate; }

    if (currentVal === '--') currentVal = '';

    if (key === 'backspace') {
      const newVal = currentVal.slice(0, -1);
      setVal(newVal === '' ? '--' : newVal);
    } else if (key === '.') {
      if (!currentVal.includes('.')) setVal(currentVal + '.');
    } else {
      if (currentVal.length < 3) setVal(currentVal + key);
    }
  };

  const validateData = (): boolean => {
    const hasValidSystolic = systolic !== '--' && !isNaN(parseInt(systolic));
    const hasValidDiastolic = diastolic !== '--' && !isNaN(parseInt(diastolic));
    const hasValidHeartRate = heartRate !== '--' && !isNaN(parseInt(heartRate));

    return hasValidSystolic && hasValidDiastolic && hasValidHeartRate;
  };

  const saveData = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Build the record with optional fields
      const record: any = {
        recorded_at: recordTime.toISOString()
      };

      if (systolic !== '--' && !isNaN(parseInt(systolic))) {
        record.systolic = parseInt(systolic);
      }
      if (diastolic !== '--' && !isNaN(parseInt(diastolic))) {
        record.diastolic = parseInt(diastolic);
      }
      if (heartRate !== '--' && !isNaN(parseInt(heartRate))) {
        record.heart_rate = parseInt(heartRate);
      }

      // Only save if we have at least one valid value
      if (Object.keys(record).length > 1) { // > 1 because recorded_at is always there
        // Set default values for missing fields
        if (!record.systolic) record.systolic = 0;
        if (!record.diastolic) record.diastolic = 0;
        if (!record.heart_rate) record.heart_rate = 0;

        await vitalService.create(record);
      }

      navigate('/');
    } catch (error) {
      console.error('Failed to save vitals', error);
      alert('保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  };

  const nextField = async () => {
    if (activeField === 'sys') setActiveField('dia');
    else if (activeField === 'dia') setActiveField('hr');
    else {
      // Try to save - check validation first
      if (!validateData()) {
        setShowValidationModal(true);
      } else {
        await saveData();
      }
    }
  };

  // Format date as YYYY-MM-DD using local time (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleEditTime = () => {
    const dateStr = formatLocalDate(recordTime);
    const hour = recordTime.getHours();
    const minute = recordTime.getMinutes();
    navigate(`/date-select?date=${dateStr}&hour=${hour}&minute=${minute}&returnTo=/record`);
  };

  // Format display text
  const isToday = new Date().toDateString() === recordTime.toDateString();
  const dateText = isToday ? '今天' : recordTime.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + '日';
  const timeText = recordTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#140c1d] dark:text-white antialiased touch-none flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 bg-background-light dark:bg-background-dark z-20">
        <button onClick={() => navigate(-1)} className="size-10 flex items-center justify-center rounded-full active:bg-gray-200 dark:active:bg-white/10 transition-colors text-gray-800 dark:text-white">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">记录体征</h1>
        {/* Removed calendar button, added empty div for spacing */}
        <div className="size-10"></div>
      </header>

      <main className="flex-1 flex flex-col px-6 pt-2 pb-6 gap-8 overflow-y-auto no-scrollbar relative z-10">
        {/* Time display with edit button */}
        <div className="flex justify-center">
          <button
            onClick={handleEditTime}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#2a1d36] border border-gray-100 dark:border-white/5 shadow-sm active:scale-95 transition-transform"
          >
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{dateText}, {timeText}</span>
            <span className="material-symbols-outlined text-[14px] text-gray-400">edit</span>
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-[14px]">favorite</span>
            </div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">血压 <span className="text-xs font-normal text-gray-400 ml-1">mmHg</span></label>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div
              onClick={() => setActiveField('sys')}
              className="flex-1 relative group cursor-pointer"
            >
              <div className={`h-24 w-full bg-white dark:bg-[#231530] rounded-2xl border-2 ${activeField === 'sys' ? 'border-primary shadow-glow' : 'border-gray-200 dark:border-white/10'} flex flex-col items-center justify-center relative overflow-hidden transition-all duration-200`}>
                <span className={`text-[40px] font-bold ${systolic === '--' ? 'text-gray-300' : 'text-[#140c1d] dark:text-white'} leading-none tracking-tight`}>{systolic}</span>
                {activeField === 'sys' && <div className="absolute right-[25%] top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary animate-pulse"></div>}
              </div>
              <span className={`absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold ${activeField === 'sys' ? 'text-primary' : 'text-gray-400'} uppercase tracking-wide`}>收缩压</span>
            </div>

            <span className="text-4xl font-extralight text-gray-300 dark:text-gray-600 mb-2">/</span>

            <div
              onClick={() => setActiveField('dia')}
              className="flex-1 relative cursor-pointer"
            >
              <div className={`h-24 w-full bg-white dark:bg-[#231530] rounded-2xl border-2 ${activeField === 'dia' ? 'border-primary shadow-glow' : 'border-gray-200 dark:border-white/10'} flex flex-col items-center justify-center transition-all`}>
                <span className={`text-[40px] font-bold ${diastolic === '--' ? 'text-gray-300' : 'text-[#140c1d] dark:text-white'} leading-none tracking-tight`}>{diastolic}</span>
                {activeField === 'dia' && <div className="absolute right-[25%] top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary animate-pulse"></div>}
              </div>
              <span className={`absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold ${activeField === 'dia' ? 'text-primary' : 'text-gray-400'} uppercase tracking-wide`}>舒张压</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 pt-4">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined text-[14px]">monitor_heart</span>
            </div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">心率 <span className="text-xs font-normal text-gray-400 ml-1">bpm</span></label>
          </div>
          <div className="flex items-center gap-4">
            <div
              onClick={() => setActiveField('hr')}
              className="w-1/2 relative cursor-pointer"
            >
              <div className={`h-24 w-full bg-white dark:bg-[#231530] rounded-2xl border-2 ${activeField === 'hr' ? 'border-primary shadow-glow' : 'border-gray-200 dark:border-white/10'} flex items-center justify-center transition-all`}>
                <span className={`text-[40px] font-bold ${heartRate === '--' ? 'text-gray-300' : 'text-[#140c1d] dark:text-white'} leading-none tracking-tight`}>{heartRate}</span>
                {activeField === 'hr' && <div className="absolute right-[25%] top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary animate-pulse"></div>}
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                请确保在静坐 5 分钟后测量，以获得准确读数。
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Keypad */}
      <div className="bg-white dark:bg-[#1f122b] rounded-t-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30 relative border-t border-gray-50 dark:border-[#352345]">
        <div className="px-6 -mt-7 mb-2">
          <button
            onClick={nextField}
            disabled={isSaving}
            className={`w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">{activeField === 'hr' ? 'check' : 'arrow_forward'}</span>
            )}
            {isSaving ? '保存中...' : (activeField === 'hr' ? '保存' : '下一步')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-y-3 gap-x-3 px-4 pb-safe pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button key={num} onClick={() => handleKeyPress(num)} className="h-14 text-2xl font-medium text-[#140c1d] dark:text-white rounded-xl active:bg-gray-100 dark:active:bg-white/10 transition-colors select-none">{num}</button>
          ))}
          <button onClick={() => handleKeyPress('.')} className="h-14 text-2xl font-medium text-[#140c1d] dark:text-white rounded-xl active:bg-gray-100 dark:active:bg-white/10 transition-colors select-none bg-gray-50 dark:bg-white/5">.</button>
          <button onClick={() => handleKeyPress('0')} className="h-14 text-2xl font-medium text-[#140c1d] dark:text-white rounded-xl active:bg-gray-100 dark:active:bg-white/10 transition-colors select-none">0</button>
          <button onClick={() => handleKeyPress('backspace')} className="h-14 flex items-center justify-center text-[#140c1d] dark:text-white rounded-xl active:bg-gray-100 dark:active:bg-white/10 transition-colors select-none bg-gray-50 dark:bg-white/5">
            <span className="material-symbols-outlined text-[24px]">backspace</span>
          </button>
        </div>
      </div>

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#140c1d]/60 backdrop-blur-[2px]" onClick={() => setShowValidationModal(false)}></div>
          <div className="relative w-full max-w-[320px] bg-white dark:bg-[#231530] rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center animate-[fade-in-up_0.3s_ease-out]">
            <div className="mb-5 bg-yellow-50 dark:bg-yellow-900/20 rounded-full p-4 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-yellow-500">warning</span>
            </div>
            <h3 className="text-xl font-bold text-[#140c1d] dark:text-white mb-3">数据未填写完整</h3>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
              您还有部分体征数据未填写。是否继续保存？未填写的数据将被记录为 0。
            </p>
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => setShowValidationModal(false)}
                className="w-full bg-primary hover:bg-primary/90 text-white text-[17px] font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              >
                返回填写
              </button>
              <button
                onClick={async () => {
                  setShowValidationModal(false);
                  await saveData();
                }}
                className="w-full text-gray-500 dark:text-gray-400 text-[17px] font-medium py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors active:scale-[0.98]"
              >
                不填写，继续保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordVitals;