import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, ReferenceLine } from 'recharts';
import { vitalService, profileService } from '../services/api';
import {
  VitalRecord,
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  formatRecordsForDisplay,
  formatDateRange,
  isSameDay,
  formatTime,
  getBPThresholds,
  getHRThresholds
} from '../utils/dataAggregation';

const Trends: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Parse date range from URL params
  const getInitialDates = () => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (startParam && endParam) {
      return {
        start: new Date(startParam),
        end: new Date(endParam)
      };
    }

    // Default: last 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start, end };
  };

  const [dateRange, setDateRange] = useState(getInitialDates());
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month' | 'record'>('day');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profile, setProfile] = useState<{ age?: number; gender?: string } | null>(null);

  // Load vitals data on mount only
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    loadVitals();
    loadProfile();
  }, [dateRange]);

  const loadProfile = async () => {
    try {
      const cached = localStorage.getItem('healthguard_profile_cache');
      if (cached) {
        const { data } = JSON.parse(cached);
        if (data) setProfile(data);
      } else {
        const data = await profileService.get();
        if (data) setProfile(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadVitals = async (silent = false) => {
    // Only show full loading state on initial load
    // Subsequent loads keep chart visible
    if (!silent && !isInitialLoad) setLoading(true);
    try {
      const data = await vitalService.getAll();
      // Filter by date range
      const filtered = data.filter((v: VitalRecord) => {
        const recordDate = new Date(v.recorded_at);
        return recordDate >= dateRange.start && recordDate <= new Date(dateRange.end.getTime() + 86400000); // Include end date
      });
      setVitals(filtered);
    } catch (error) {
      console.error('Failed to load vitals:', error);
    } finally {
      if (!silent) setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Aggregate data based on active tab
  const chartData = useMemo(() => {
    if (vitals.length === 0) return [];

    const isSingleDay = isSameDay(dateRange.start, dateRange.end);

    switch (activeTab) {
      case 'day':
        if (isSingleDay) {
          // Single day: show all records with time
          return formatRecordsForDisplay(vitals);
        } else {
          // Multi-day: show daily averages
          return aggregateByDay(vitals);
        }
      case 'week':
      case 'month':
        // Show daily averages across the selected 14 or 30 day range
        return aggregateByDay(vitals);
      case 'record':
        return formatRecordsForDisplay(vitals);
      default:
        return aggregateByDay(vitals);
    }
  }, [vitals, activeTab, dateRange]);

  // Calculate averages for display
  const avgStats = useMemo(() => {
    const validVitals = vitals.filter(v =>
      typeof v.systolic === 'number' &&
      typeof v.diastolic === 'number' &&
      typeof v.heart_rate === 'number'
    );

    if (validVitals.length === 0) {
      return { systolic: 0, diastolic: 0, heartRate: 0, min: 0, max: 0 };
    }
    const count = validVitals.length;
    return {
      systolic: Math.round(validVitals.reduce((sum, v) => sum + v.systolic, 0) / count),
      diastolic: Math.round(validVitals.reduce((sum, v) => sum + v.diastolic, 0) / count),
      heartRate: Math.round(validVitals.reduce((sum, v) => sum + v.heart_rate, 0) / count),
      min: Math.min(...validVitals.map(v => v.heart_rate)),
      max: Math.max(...validVitals.map(v => v.heart_rate))
    };
  }, [vitals]);

  // Format records for list display
  const displayedRecords = useMemo(() => {
    const records = vitals
      .filter(v => v.recorded_at)
      .map(v => {
        const dateObj = new Date(v.recorded_at);
        const isValidDate = !isNaN(dateObj.getTime());
        return {
          id: v.id,
          time: isValidDate ? formatTime(dateObj) : '--:--',
          date: isValidDate ? dateObj.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '未知',
          rawDate: isValidDate ? dateObj.getTime() : 0,
          bp: `${v.systolic || '--'}/${v.diastolic || '--'}`,
          hr: String(v.heart_rate || '--'),
          label: '记录'
        };
      })
      .sort((a, b) => b.rawDate - a.rawDate);

    return showAllRecords ? records : records.slice(0, 3);
  }, [vitals, showAllRecords]);

  const handleDateSelect = () => {
    const startStr = dateRange.start.toISOString().split('T')[0];
    const endStr = dateRange.end.toISOString().split('T')[0];
    navigate(`/date-select?from=trends&start=${startStr}&end=${endStr}`, { state: { hideTime: true } });
  };

  const navigateDay = (direction: number) => {
    const newStart = new Date(dateRange.start);
    const newEnd = new Date(dateRange.end);
    newStart.setDate(newStart.getDate() + direction);
    newEnd.setDate(newEnd.getDate() + direction);
    setDateRange({ start: newStart, end: newEnd });
  };

  const handleTabChange = (tab: 'day' | 'week' | 'month' | 'record') => {
    setActiveTab(tab);
    if (tab === 'week') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 13);
      setDateRange({ start, end });
    } else if (tab === 'month') {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      setDateRange({ start, end });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0 || isDeleting) return;

    if (confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) {
      setIsDeleting(true);
      try {
        await vitalService.deleteMany(selectedIds);
        await loadVitals(true); // Silent reload
        setSelectedIds([]);
        setIsEditMode(false);
      } catch (error) {
        console.error('Failed to delete records:', error);
        alert('删除失败，请重试。');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const dateDisplayText = formatDateRange(dateRange.start, dateRange.end);
  const isToday = isSameDay(dateRange.end, new Date());

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-24 bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-100 dark:border-white/5 pb-2">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2 text-[#140c1d] dark:text-white">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <h1 className="text-lg font-bold text-[#140c1d] dark:text-white tracking-tight">趋势分析</h1>

          <button onClick={handleDateSelect} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -mr-2 text-gray-600 dark:text-gray-300">
            <span className="material-symbols-outlined text-[24px]">calendar_month</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-2">
          <div className="flex p-1 bg-gray-200/50 dark:bg-[#2a1d36] rounded-xl relative">
            <div
              className="absolute top-1 bottom-1 w-[24%] bg-white dark:bg-[#7b00ff] rounded-lg shadow-sm border border-gray-200/50 dark:border-none transition-all duration-300 ease-out"
              style={{ left: activeTab === 'day' ? '1%' : activeTab === 'week' ? '26%' : activeTab === 'month' ? '51%' : '75%' }}
            ></div>
            <button onClick={() => handleTabChange('day')} className={`relative flex-1 py-1.5 text-sm font-medium z-10 transition-colors ${activeTab === 'day' ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>日</button>
            <button onClick={() => handleTabChange('week')} className={`relative flex-1 py-1.5 text-sm font-medium z-10 transition-colors ${activeTab === 'week' ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>周</button>
            <button onClick={() => handleTabChange('month')} className={`relative flex-1 py-1.5 text-sm font-medium z-10 transition-colors ${activeTab === 'month' ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>月</button>
            <button onClick={() => handleTabChange('record')} className={`relative flex-1 py-1.5 text-sm font-medium z-10 transition-colors ${activeTab === 'record' ? 'text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>记录</button>
          </div>

          <div className="flex items-center justify-between px-2 pt-1">
            <button onClick={() => navigateDay(-1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            <button
              onClick={handleDateSelect}
              className="flex flex-col items-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 px-4 py-1 transition-colors"
            >
              <span className="text-base font-bold text-[#140c1d] dark:text-white">{dateDisplayText}</span>
              <span className="text-xs text-gray-400 font-medium">{isToday ? '今天' : ''}</span>
            </button>

            <button onClick={() => navigateDay(1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-6 px-4 py-4 relative">
        {/* Vitals Charts Section */}
        <section className="flex flex-col gap-6">
          {/* BP Chart */}
          <div className="flex flex-col gap-4 bg-white dark:bg-[#231530] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#352345] min-h-[300px] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                    <span className="material-symbols-outlined text-[20px]">favorite</span>
                  </div>
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">血压</h2>
                </div>
                <div className={`mt-2 flex items-baseline gap-2 transition-opacity duration-300 ${loading && vitals.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
                  <span className="text-3xl font-bold tracking-tight text-[#140c1d] dark:text-white">
                    {vitals.length > 0 ? `${avgStats.systolic}/${avgStats.diastolic}` : '--/--'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">mmHg (平均)</span>
                </div>
              </div>
              {!loading && vitals.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-md self-end">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> 正常
                </span>
              )}
            </div>

            <div className="relative w-full h-[180px] mt-2 select-none flex items-center justify-center">
              {loading && vitals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 animate-pulse w-full">
                  <div className="w-full h-32 bg-gray-100 dark:bg-white/5 rounded-xl"></div>
                  <span className="text-xs text-gray-400">正在获取数据...</span>
                </div>
              ) : vitals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <span className="material-symbols-outlined text-[32px] text-gray-200">sentiment_dissatisfied</span>
                  <span className="text-sm text-gray-400">该时段暂无记录</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradSys" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7b00ff" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#7b00ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDia" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#7b00ff', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area isAnimationActive={!loading} name="收缩压" type="monotone" dataKey="systolic" stroke="#7b00ff" fill="url(#gradSys)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#7b00ff', strokeWidth: 2 }} />
                    <Area isAnimationActive={!loading} name="舒张压" type="monotone" dataKey="diastolic" stroke="#38bdf8" fill="url(#gradDia)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#38bdf8', strokeWidth: 2 }} />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).systolic} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '偏高/高收缩压警戒', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).diastolic} stroke="#f97316" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: '偏高/高舒张压警戒', fill: '#f97316', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {loading && vitals.length > 0 && !isDeleting && (
                <div className="absolute inset-x-0 bottom-0 top-0 bg-white/40 dark:bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10 transition-all">
                  <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* HR Chart */}
          <div className="flex flex-col gap-4 bg-white dark:bg-[#231530] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#352345] min-h-[220px] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                    <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                  </div>
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">心率</h2>
                </div>
                <div className={`mt-2 flex items-baseline gap-2 transition-opacity duration-300 ${loading && vitals.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
                  <span className="text-3xl font-bold tracking-tight text-[#140c1d] dark:text-white">
                    {vitals.length > 0 ? avgStats.heartRate : '--'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">bpm (平均)</span>
                </div>
              </div>
            </div>

            <div className="relative w-full h-[140px] mt-2 select-none flex items-center justify-center">
              {loading && vitals.length === 0 ? (
                <div className="w-full h-24 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
              ) : vitals.length === 0 ? (
                <div className="text-sm text-gray-400 font-medium">暂无记录</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area isAnimationActive={!loading} name="心率" type="monotone" dataKey="heart_rate" stroke="#3b82f6" fill="url(#gradHr)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#3b82f6', strokeWidth: 2 }} />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).max} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '心率过快', fill: '#ef4444', fontSize: 10 }} />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).min} stroke="#eab308" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: '心率过缓', fill: '#eab308', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Record List Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[#140c1d] dark:text-white">详细记录</h2>
            {vitals.length > 0 && (
              <button
                onClick={() => {
                  if (isEditMode) {
                    setSelectedIds([]);
                  }
                  setIsEditMode(!isEditMode);
                }}
                className={`text-sm font-semibold px-3 py-1.5 rounded-full transition-all ${isEditMode ? 'bg-red-50 text-red-500' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
              >
                {isEditMode ? '取消选择' : '批量管理'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 min-h-[100px]">
            {loading && vitals.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-white dark:bg-[#231530] rounded-2xl animate-pulse border border-gray-100 dark:border-[#352345]"></div>
              ))
            ) : vitals.length === 0 ? (
              <div className="bg-white dark:bg-[#231530] rounded-2xl p-8 border border-gray-100 dark:border-[#352345] flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-gray-200 text-[40px]">history</span>
                <p className="text-gray-400 text-sm">暂无详细记录</p>
              </div>
            ) : (
              displayedRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => isEditMode && record.id && toggleSelect(record.id)}
                  className={`group relative flex items-center justify-between p-4 bg-white dark:bg-[#231530] rounded-2xl shadow-sm border transition-all active:scale-[0.98] ${isEditMode && record.id && selectedIds.includes(record.id) ? 'border-primary ring-1 ring-primary' : 'border-gray-100 dark:border-[#352345]'}`}
                >
                  <div className="flex items-center gap-4">
                    {isEditMode && (
                      <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${record.id && selectedIds.includes(record.id) ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                        {record.id && selectedIds.includes(record.id) && <span className="material-symbols-outlined text-[14px] text-white font-bold">check</span>}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <p className="text-[#140c1d] dark:text-white font-bold text-lg leading-tight">
                        {record.bp}
                        <span className="ml-2 text-xs text-gray-400 font-normal uppercase">mmHg</span>
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{record.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col">
                      <p className="text-[#140c1d] dark:text-white font-bold leading-tight">{record.hr}<span className="text-[10px] text-gray-400 font-normal ml-0.5 uppercase">bpm</span></p>
                      {record.rawDate > new Date().setHours(0, 0, 0, 0) && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block">新记录</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {!showAllRecords && vitals.length > 3 && (
              <button
                onClick={() => setShowAllRecords(true)}
                className="w-full py-4 text-sm font-bold text-gray-500 hover:text-primary transition-colors hover:bg-white dark:hover:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 mt-2"
              >
                查看全部 {vitals.length} 条记录
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Bulk Action Bar */}
      {isEditMode && selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#140c1d] text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3 pl-2">
              <span className="text-sm font-medium">已选择 <span className="text-primary-light font-bold text-lg">{selectedIds.length}</span> 项记录</span>
            </div>
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-[0.95] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              {isDeleting ? '正在删除...' : '删除记录'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trends;