import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { glucoseService, vitalService } from '../services/api';
import type { GlucoseContext, PostMealTiming } from '../utils/dataAggregation';

const RecordVitals: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [systolic, setSystolic] = useState('--');
  const [diastolic, setDiastolic] = useState('--');
  const [activeField, setActiveField] = useState<'sys' | 'dia' | 'hr' | 'glucose'>('sys');
  const [heartRate, setHeartRate] = useState('--');
  const [glucose, setGlucose] = useState('--');
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext | null>(null);
  const [postMealTiming, setPostMealTiming] = useState<PostMealTiming | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const contextOptions: { value: GlucoseContext; label: string }[] = [
    { value: 'fasting', label: '空腹' },
    { value: 'pre_meal', label: '餐前' },
    { value: 'post_meal', label: '餐后' },
  ];

  const postMealOptions: { value: PostMealTiming; label: string }[] = [
    { value: 'within_30_min', label: '30分钟内' },
    { value: 'one_hour', label: '1小时' },
    { value: 'two_hours', label: '2小时' },
    { value: 'over_two_hours', label: '2小时以上' },
  ];

  const stepInfo = activeField === 'glucose'
    ? { index: 2, total: 3, title: '血糖', skipLabel: '跳过血糖' }
    : activeField === 'hr'
      ? { index: 3, total: 3, title: '心率', skipLabel: '跳过心率' }
      : { index: 1, total: 3, title: '血压', skipLabel: '跳过血压' };

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
    else if (activeField === 'hr') { currentVal = heartRate; setVal = setHeartRate; }
    else { currentVal = glucose; setVal = setGlucose; }

    if (currentVal === '--') currentVal = '';

    if (key === 'backspace') {
      const newVal = currentVal.slice(0, -1);
      setVal(newVal === '' ? '--' : newVal);
    } else if (key === '.') {
      if (!currentVal.includes('.')) setVal(currentVal + '.');
    } else {
      const maxLength = activeField === 'glucose' ? 4 : 3;
      if (currentVal.length < maxLength) setVal(currentVal + key);
    }
  };

  const hasNumber = (value: string) => value !== '--' && !isNaN(Number(value));
  const hasInt = (value: string) => value !== '--' && !isNaN(parseInt(value));

  const validateData = (): boolean => {
    const hasValidSystolic = hasInt(systolic);
    const hasValidDiastolic = hasInt(diastolic);
    const hasValidHeartRate = hasInt(heartRate);
    const hasValidGlucose = hasNumber(glucose);
    const hasPartialBloodPressure = hasValidSystolic !== hasValidDiastolic;
    const hasAnyRecord = (hasValidSystolic && hasValidDiastolic) || hasValidHeartRate || hasValidGlucose;

    return hasAnyRecord && !hasPartialBloodPressure;
  };

  const saveData = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const recordedAt = recordTime.toISOString();
      const hasBloodPressure = hasInt(systolic) && hasInt(diastolic);
      const hasHeartRate = hasInt(heartRate);
      const hasGlucose = hasNumber(glucose);

      if (hasBloodPressure || hasHeartRate) {
        await vitalService.create({
          recorded_at: recordedAt,
          systolic: hasBloodPressure ? parseInt(systolic) : null,
          diastolic: hasBloodPressure ? parseInt(diastolic) : null,
          heart_rate: hasHeartRate ? parseInt(heartRate) : null,
        });
      }

      if (hasGlucose) {
        await glucoseService.create({
          value: Number(Number(glucose).toFixed(1)),
          unit: 'mmol/L',
          measurement_context: glucoseContext || 'random',
          post_meal_timing: glucoseContext === 'post_meal' ? postMealTiming : null,
          recorded_at: recordedAt,
        });
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
    else if (activeField === 'dia') setActiveField('glucose');
    else if (activeField === 'glucose') setActiveField('hr');
    else {
      if (!validateData()) {
        setShowValidationModal(true);
      } else {
        await saveData();
      }
    }
  };

  const skipField = () => {
    if (activeField === 'sys' || activeField === 'dia') {
      setSystolic('--');
      setDiastolic('--');
      setActiveField('glucose');
    } else if (activeField === 'glucose') {
      setGlucose('--');
      setGlucoseContext(null);
      setPostMealTiming(null);
      setActiveField('hr');
    } else {
      setHeartRate('--');
    }
  };

  const selectGlucoseContext = (value: GlucoseContext) => {
    setGlucoseContext(value);
    if (value !== 'post_meal') {
      setPostMealTiming(null);
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
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleEditTime}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#2a1d36] border border-gray-100 dark:border-white/5 shadow-sm active:scale-95 transition-transform"
          >
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{dateText}, {timeText}</span>
            <span className="material-symbols-outlined text-[14px] text-gray-400">edit</span>
          </button>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(step => (
                <span
                  key={step}
                  className={`h-1.5 rounded-full transition-all ${step === stepInfo.index ? 'w-6 bg-primary' : step < stepInfo.index ? 'w-3 bg-primary/40' : 'w-3 bg-gray-200 dark:bg-white/10'}`}
                />
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-400">第 {stepInfo.index}/{stepInfo.total} 项 · {stepInfo.title}</p>
          </div>
        </div>

        {(activeField === 'sys' || activeField === 'dia') && <div className="flex flex-col gap-5">
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
        </div>}

        {activeField === 'hr' && <div className="flex flex-col gap-5 pt-4">
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
        </div>}

        {activeField === 'glucose' && <div className="flex flex-col gap-5 pt-2">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
              <span className="material-symbols-outlined text-[14px]">bloodtype</span>
            </div>
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">血糖 <span className="text-xs font-normal text-gray-400 ml-1">mmol/L</span></label>
          </div>
          <div className="flex items-center gap-4">
            <div
              onClick={() => setActiveField('glucose')}
              className="w-1/2 relative cursor-pointer"
            >
              <div className={`h-24 w-full bg-white dark:bg-[#231530] rounded-2xl border-2 ${activeField === 'glucose' ? 'border-primary shadow-glow' : 'border-gray-200 dark:border-white/10'} flex items-center justify-center transition-all`}>
                <span className={`text-[40px] font-bold ${glucose === '--' ? 'text-gray-300' : 'text-[#140c1d] dark:text-white'} leading-none tracking-tight`}>{glucose}</span>
                {activeField === 'glucose' && <div className="absolute right-[18%] top-1/2 -translate-y-1/2 h-8 w-0.5 bg-primary animate-pulse"></div>}
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-1.5">
                {contextOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectGlucoseContext(option.value)}
                    className={`h-8 rounded-lg text-xs font-semibold transition-colors ${glucoseContext === option.value ? 'bg-green-500 text-white' : 'bg-white dark:bg-[#231530] text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/10'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {glucoseContext === 'post_meal' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {postMealOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPostMealTiming(option.value)}
                      className={`h-8 rounded-lg text-[11px] font-semibold transition-colors ${postMealTiming === option.value ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' : 'bg-white dark:bg-[#231530] text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/10'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>}
      </main>

      {/* Keypad */}
      <div className="bg-white dark:bg-[#1f122b] rounded-t-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-30 relative border-t border-gray-50 dark:border-[#352345]">
        <div className="px-6 -mt-7 mb-2">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <button
              onClick={skipField}
              disabled={isSaving}
              className="h-14 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 font-bold active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {stepInfo.skipLabel}
            </button>
            <button
              onClick={nextField}
              disabled={isSaving}
              className={`bg-primary hover:bg-primary/90 text-white font-bold text-lg h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">{activeField === 'hr' ? 'check' : 'arrow_forward'}</span>
              )}
              {isSaving ? '保存中...' : (activeField === 'hr' ? '保存' : '下一步')}
            </button>
          </div>
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
            <h3 className="text-xl font-bold text-[#140c1d] dark:text-white mb-3">请确认记录内容</h3>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-8">
              血压需要同时填写收缩压和舒张压；如果只想记录血糖或心率，可以跳过血压后继续保存。
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
