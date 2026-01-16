import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

const DateSelection: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Determine mode: 'single' for symptoms/record, 'range' for trends
  const from = searchParams.get('from');
  const mode = (from === 'trends' || from === 'export') ? 'range' : 'single';
  const showTime = mode === 'single'; // Show time picker for single date mode

  // Parse initial values from URL
  const getInitialValues = () => {
    const dateParam = searchParams.get('date');
    const hourParam = searchParams.get('hour');
    const minuteParam = searchParams.get('minute');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (mode === 'single' && dateParam) {
      return {
        selectedDate: new Date(dateParam),
        hour: hourParam ? parseInt(hourParam) : new Date().getHours(),
        minute: minuteParam ? parseInt(minuteParam) : new Date().getMinutes()
      };
    }

    if (mode === 'range' && startParam && endParam) {
      return {
        start: new Date(startParam),
        end: new Date(endParam)
      };
    }

    const now = new Date();
    return {
      selectedDate: now,
      hour: now.getHours(),
      minute: now.getMinutes(),
      start: now,
      end: now
    };
  };

  const initialValues = getInitialValues();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(initialValues.selectedDate || new Date());
  const [selectedRange, setSelectedRange] = useState({ start: initialValues.start || new Date(), end: initialValues.end || new Date() });
  const [selectingStart, setSelectingStart] = useState(true);
  const [selectedHour, setSelectedHour] = useState(initialValues.hour || new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialValues.minute || new Date().getMinutes());

  // Refs for time picker scroll
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Scroll to selected time on mount
  useEffect(() => {
    if (hourRef.current) {
      hourRef.current.scrollTo({ top: selectedHour * 40, behavior: 'auto' });
    }
    if (minuteRef.current) {
      minuteRef.current.scrollTo({ top: selectedMinute * 40, behavior: 'auto' });
    }
  }, []);

  // Handle scroll for hour/minute selection
  const handleScroll = (type: 'hour' | 'minute', ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    const scrollTop = ref.current.scrollTop;
    const index = Math.round(scrollTop / 40);
    if (type === 'hour') {
      setSelectedHour(Math.min(23, Math.max(0, index)));
    } else {
      setSelectedMinute(Math.min(59, Math.max(0, index)));
    }
  };

  // Generate calendar data
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
    }

    return days;
  }, [currentMonth]);

  const isDateSelected = (date: Date): boolean => {
    if (mode === 'single') {
      return date.toDateString() === selectedDate.toDateString();
    }
    return date.toDateString() === selectedRange.start.toDateString() ||
      date.toDateString() === selectedRange.end.toDateString();
  };

  const isDateInRange = (date: Date): boolean => {
    if (mode === 'single') return false;
    return date >= selectedRange.start && date <= selectedRange.end;
  };

  const handleDayClick = (date: Date) => {
    if (mode === 'single') {
      setSelectedDate(date);
    } else {
      if (selectingStart) {
        setSelectedRange({ start: date, end: date });
        setSelectingStart(false);
      } else {
        if (date < selectedRange.start) {
          setSelectedRange({ start: date, end: selectedRange.start });
        } else {
          setSelectedRange({ ...selectedRange, end: date });
        }
        setSelectingStart(true);
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

  const handleConfirm = () => {
    if (mode === 'single') {
      // Navigate back to symptoms or record with date/time params
      const dateStr = formatLocalDate(selectedDate);
      const returnTo = searchParams.get('returnTo') || '/symptoms';
      navigate(`${returnTo}?date=${dateStr}&hour=${selectedHour}&minute=${selectedMinute}`);
    } else {
      const startStr = formatLocalDate(selectedRange.start);
      const endStr = formatLocalDate(selectedRange.end);
      const from = searchParams.get('from');
      if (from === 'export') {
        navigate(`/export?range=custom&start=${startStr}&end=${endStr}`);
      } else {
        navigate(`/trends?start=${startStr}&end=${endStr}`);
      }
    }
  };

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
  };

  const monthYearText = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-[#140c1d] dark:text-white antialiased touch-none flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 bg-background-light dark:bg-background-dark z-20 shrink-0">
        <button onClick={() => navigate(-1)} className="px-2 py-2 text-base font-medium text-gray-500 dark:text-gray-400 active:text-gray-800 dark:active:text-gray-200 transition-colors">取消</button>
        <h1 className="text-lg font-bold tracking-tight">{mode === 'single' ? '选择日期与时间' : '选择日期范围'}</h1>
        <div className="w-[48px]"></div>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-2 pb-6 gap-4 overflow-y-auto no-scrollbar relative z-10">
        {/* Range mode indicator */}
        {mode === 'range' && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className={selectingStart ? 'text-primary font-bold' : 'text-gray-400'}>
              开始: {selectedRange.start.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-gray-300">→</span>
            <span className={!selectingStart ? 'text-primary font-bold' : 'text-gray-400'}>
              结束: {selectedRange.end.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white dark:bg-[#1f122b] rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-6 px-1">
            <button onClick={() => navigateMonth(-1)} className="size-8 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 transition-colors">
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="text-lg font-bold tracking-tight">{monthYearText}</span>
            <button onClick={() => navigateMonth(1)} className="size-8 flex items-center justify-center rounded-full hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500 transition-colors">
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2 text-center">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 justify-items-center">
            {calendarData.map((item, index) => {
              const isSelected = isDateSelected(item.date);
              const inRange = isDateInRange(item.date);

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(item.date)}
                  className={`size-10 flex items-center justify-center rounded-full text-[15px] transition-all
                    ${!item.isCurrentMonth ? 'text-gray-300 dark:text-gray-700' : ''}
                    ${isSelected
                      ? 'font-bold text-white bg-primary shadow-glow'
                      : inRange
                        ? 'bg-primary/10 text-primary font-medium'
                        : item.isCurrentMonth
                          ? 'font-medium text-[#140c1d] dark:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                          : ''
                    }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Picker - only for single date mode */}
        {showTime && (
          <div className="flex flex-col gap-3">
            <label className="px-2 text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">schedule</span> 选择时间
            </label>
            <div className="bg-white dark:bg-[#1f122b] rounded-[24px] h-48 relative overflow-hidden flex items-center justify-center border border-gray-100 dark:border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <div className="absolute w-[80%] h-12 bg-gray-50 dark:bg-white/5 rounded-xl top-1/2 -translate-y-1/2 z-0 pointer-events-none border border-primary/10"></div>

              {/* Hour Column */}
              <div
                ref={hourRef}
                onScroll={() => handleScroll('hour', hourRef)}
                className="flex-1 h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar relative z-10"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-[80px]"></div>
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedHour(i);
                      hourRef.current?.scrollTo({ top: i * 40, behavior: 'smooth' });
                    }}
                    className={`h-10 flex items-center justify-center text-xl snap-center cursor-pointer transition-all
                      ${i === selectedHour ? 'text-3xl font-bold text-[#140c1d] dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
                  >
                    {String(i).padStart(2, '0')}
                  </div>
                ))}
                <div className="h-[80px]"></div>
              </div>

              <div className="text-2xl font-bold text-[#140c1d] dark:text-white z-10">:</div>

              {/* Minute Column */}
              <div
                ref={minuteRef}
                onScroll={() => handleScroll('minute', minuteRef)}
                className="flex-1 h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar relative z-10"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="h-[80px]"></div>
                {Array.from({ length: 60 }, (_, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedMinute(i);
                      minuteRef.current?.scrollTo({ top: i * 40, behavior: 'smooth' });
                    }}
                    className={`h-10 flex items-center justify-center text-xl snap-center cursor-pointer transition-all
                      ${i === selectedMinute ? 'text-3xl font-bold text-[#140c1d] dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
                  >
                    {String(i).padStart(2, '0')}
                  </div>
                ))}
                <div className="h-[80px]"></div>
              </div>

              <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white dark:from-[#1f122b] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#1f122b] to-transparent z-20 pointer-events-none"></div>
            </div>
          </div>
        )}

        {/* Quick select options - for range mode */}
        {mode === 'range' && (
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: '今天', days: 0 },
              { label: '最近7天', days: 6 },
              { label: '最近30天', days: 29 },
              { label: '本月', days: -1 },
            ].map(option => (
              <button
                key={option.label}
                onClick={() => {
                  const end = new Date();
                  let start = new Date();
                  if (option.days === -1) {
                    start = new Date(end.getFullYear(), end.getMonth(), 1);
                  } else {
                    start.setDate(start.getDate() - option.days);
                  }
                  setSelectedRange({ start, end });
                  setSelectingStart(true);
                }}
                className="px-4 py-2 text-sm font-medium rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </main>

      <div className="bg-background-light dark:bg-background-dark pb-safe px-6 pt-2 z-30">
        <button onClick={handleConfirm} className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all">
          确认
        </button>
      </div>
    </div>
  );
};

export default DateSelection;