import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import { glucoseService, vitalService, profileService } from '../services/api';
import {
  GlucoseRecord,
  VitalRecord,
  aggregateGlucoseByDay,
  aggregateByDay,
  aggregateByWeek,
  aggregateByMonth,
  formatRecordsForDisplay,
  formatDateRange,
  isSameDay,
  formatTime,
  getBPThresholds,
  getHRThresholds,
  formatGlucoseContext
} from '../utils/dataAggregation';

type ExportMetric = 'bp' | 'glucose' | 'heartRate';
type ExportRange = 'current' | '7days' | '30days';

const Trends: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordColorClass = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-500',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-500',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
  } as const;

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
  const [selectedRecordKeys, setSelectedRecordKeys] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [profile, setProfile] = useState<{ age?: number; gender?: string } | null>(null);
  const [allVitals, setAllVitals] = useState<VitalRecord[]>([]);
  const [glucoseRecords, setGlucoseRecords] = useState<GlucoseRecord[]>([]);
  const [allGlucoseRecords, setAllGlucoseRecords] = useState<GlucoseRecord[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>('current');
  const [exportMetrics, setExportMetrics] = useState<Record<ExportMetric, boolean>>({
    bp: true,
    glucose: false,
    heartRate: false,
  });

  // Load vitals data on mount only
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const getRecordKey = (type: 'vital' | 'glucose', id?: string) => id ? `${type}:${id}` : '';

  useEffect(() => {
    loadVitals();
    loadGlucose();
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
      setAllVitals(data || []);
      // Filter by date range
      const filtered = (data || []).filter((v: VitalRecord) => {
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

  const loadGlucose = async () => {
    try {
      const data = await glucoseService.getAll();
      setAllGlucoseRecords(data || []);
      const filtered = (data || []).filter((record: GlucoseRecord) => {
        const recordDate = new Date(record.recorded_at);
        return recordDate >= dateRange.start && recordDate <= new Date(dateRange.end.getTime() + 86400000);
      });
      setGlucoseRecords(filtered);
    } catch (error) {
      console.error('Failed to load glucose records:', error);
      setGlucoseRecords([]);
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

  const glucoseChartData = useMemo(() => {
    if (glucoseRecords.length === 0) return [];
    return aggregateGlucoseByDay(glucoseRecords);
  }, [glucoseRecords]);

  const bloodPressureChartData = useMemo(() => (
    chartData.filter(item => item.systolic > 0 || item.diastolic > 0)
  ), [chartData]);

  const heartRateChartData = useMemo(() => (
    chartData.filter(item => item.heart_rate > 0)
  ), [chartData]);

  // Calculate averages for display
  const avgStats = useMemo(() => {
    const bloodPressureRecords = vitals.filter(v =>
      typeof v.systolic === 'number' && v.systolic > 0 &&
      typeof v.diastolic === 'number' && v.diastolic > 0
    );
    const heartRateRecords = vitals.filter(v => typeof v.heart_rate === 'number' && v.heart_rate > 0);

    if (bloodPressureRecords.length === 0 && heartRateRecords.length === 0) {
      return { systolic: 0, diastolic: 0, heartRate: 0, min: 0, max: 0 };
    }

    return {
      systolic: bloodPressureRecords.length > 0 ? Math.round(bloodPressureRecords.reduce((sum, v) => sum + v.systolic, 0) / bloodPressureRecords.length) : 0,
      diastolic: bloodPressureRecords.length > 0 ? Math.round(bloodPressureRecords.reduce((sum, v) => sum + v.diastolic, 0) / bloodPressureRecords.length) : 0,
      heartRate: heartRateRecords.length > 0 ? Math.round(heartRateRecords.reduce((sum, v) => sum + v.heart_rate, 0) / heartRateRecords.length) : 0,
      min: heartRateRecords.length > 0 ? Math.min(...heartRateRecords.map(v => v.heart_rate)) : 0,
      max: heartRateRecords.length > 0 ? Math.max(...heartRateRecords.map(v => v.heart_rate)) : 0
    };
  }, [vitals]);

  const avgGlucose = useMemo(() => {
    const values = glucoseRecords
      .map(record => record.value)
      .filter(value => typeof value === 'number' && value > 0);

    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  }, [glucoseRecords]);

  // Format records for list display
  const displayedRecords = useMemo(() => {
    const vitalRecords = vitals
      .filter(v => v.recorded_at)
      .map(v => {
        const dateObj = new Date(v.recorded_at);
        const isValidDate = !isNaN(dateObj.getTime());
        const hasBloodPressure = v.systolic > 0 && v.diastolic > 0;
        const hasHeartRate = v.heart_rate > 0;
        return {
          id: v.id,
          key: getRecordKey('vital', v.id),
          type: 'vital' as const,
          time: isValidDate ? formatTime(dateObj) : '--:--',
          date: isValidDate ? dateObj.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '未知',
          rawDate: isValidDate ? dateObj.getTime() : 0,
          primary: hasBloodPressure ? `${v.systolic}/${v.diastolic}` : hasHeartRate ? String(v.heart_rate) : '--',
          primaryUnit: hasBloodPressure ? 'mmHg' : hasHeartRate ? 'bpm' : '',
          secondary: hasBloodPressure && hasHeartRate ? `${v.heart_rate} bpm` : '',
          icon: hasBloodPressure ? 'favorite' : 'monitor_heart',
          color: hasBloodPressure ? 'red' : 'blue',
          label: hasBloodPressure ? '血压' : '心率'
        };
      });

    const glucoseList = glucoseRecords
      .filter(record => record.recorded_at)
      .map(record => {
        const dateObj = new Date(record.recorded_at);
        const isValidDate = !isNaN(dateObj.getTime());
        return {
          id: record.id,
          key: getRecordKey('glucose', record.id),
          type: 'glucose' as const,
          time: isValidDate ? formatTime(dateObj) : '--:--',
          date: isValidDate ? dateObj.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '未知',
          rawDate: isValidDate ? dateObj.getTime() : 0,
          primary: record.value.toFixed(1),
          primaryUnit: 'mmol/L',
          secondary: formatGlucoseContext(record),
          icon: 'bloodtype',
          color: 'green',
          label: '血糖'
        };
      });

    const records = [...vitalRecords, ...glucoseList]
      .sort((a, b) => b.rawDate - a.rawDate);

    return showAllRecords ? records : records.slice(0, 3);
  }, [vitals, glucoseRecords, showAllRecords]);

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

  const toggleSelect = (key: string) => {
    setSelectedRecordKeys(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedRecordKeys.length === 0 || isDeleting) return;

    if (confirm(`确定要删除选中的 ${selectedRecordKeys.length} 条记录吗？`)) {
      setIsDeleting(true);
      try {
        const vitalIds = selectedRecordKeys.filter(key => key.startsWith('vital:')).map(key => key.replace('vital:', ''));
        const glucoseIds = selectedRecordKeys.filter(key => key.startsWith('glucose:')).map(key => key.replace('glucose:', ''));

        await Promise.all([
          vitalIds.length > 0 ? vitalService.deleteMany(vitalIds) : Promise.resolve(),
          glucoseIds.length > 0 ? glucoseService.deleteMany(glucoseIds) : Promise.resolve(),
        ]);
        await Promise.all([loadVitals(true), loadGlucose()]);
        setSelectedRecordKeys([]);
        setIsEditMode(false);
      } catch (error) {
        console.error('Failed to delete records:', error);
        alert('删除失败，请重试。');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getExportRangeDates = () => {
    const end = new Date();
    const start = new Date();

    if (exportRange === 'current') {
      return { start: new Date(dateRange.start), end: new Date(dateRange.end) };
    }

    start.setDate(end.getDate() - (exportRange === '7days' ? 6 : 29));
    return { start, end };
  };

  const exportDateRange = useMemo(() => getExportRangeDates(), [exportRange, dateRange]);

  const filterRecordsByRange = <T extends { recorded_at: string }>(records: T[]) => {
    const start = new Date(exportDateRange.start);
    const end = new Date(exportDateRange.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return records.filter(record => {
      const date = new Date(record.recorded_at);
      return date >= start && date <= end;
    });
  };

  const exportVitals = useMemo(() => filterRecordsByRange(allVitals), [allVitals, exportDateRange]);
  const exportGlucose = useMemo(() => filterRecordsByRange(allGlucoseRecords), [allGlucoseRecords, exportDateRange]);

  const exportBloodPressureData = useMemo(() => (
    aggregateByDay(exportVitals).filter(item => item.systolic > 0 || item.diastolic > 0)
  ), [exportVitals]);

  const exportHeartRateData = useMemo(() => (
    aggregateByDay(exportVitals).filter(item => item.heart_rate > 0)
  ), [exportVitals]);

  const exportGlucoseData = useMemo(() => aggregateGlucoseByDay(exportGlucose), [exportGlucose]);

  const openExportModal = (metric: ExportMetric) => {
    setExportMetrics({
      bp: metric === 'bp',
      glucose: metric === 'glucose',
      heartRate: metric === 'heartRate',
    });
    setExportRange('current');
    setShowExportModal(true);
  };

  const toggleExportMetric = (metric: ExportMetric) => {
    setExportMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  const formatExportDate = (date: Date) => (
    date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
  );

  const handleExportPdf = async () => {
    if (!exportMetrics.bp && !exportMetrics.glucose && !exportMetrics.heartRate) {
      alert('请至少选择一个要导出的指标。');
      return;
    }

    setIsExporting(true);
    try {
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const html2canvas = html2canvasModule.default;

      await new Promise(resolve => setTimeout(resolve, 200));
      const report = document.getElementById('trend-export-report');
      if (!report) throw new Error('Report area not found');

      const canvas = await html2canvas(report, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`健康趋势报告_${formatExportDate(exportDateRange.start)}_至_${formatExportDate(exportDateRange.end)}.pdf`);
      setShowExportModal(false);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('生成 PDF 失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const dateDisplayText = formatDateRange(dateRange.start, dateRange.end);
  const isToday = isSameDay(dateRange.end, new Date());
  const metricOptions: Array<{ key: ExportMetric; label: string; count: number; icon: string; color: string }> = [
    { key: 'bp', label: '血压', count: exportBloodPressureData.length, icon: 'favorite', color: 'red' },
    { key: 'glucose', label: '血糖', count: exportGlucose.length, icon: 'bloodtype', color: 'green' },
    { key: 'heartRate', label: '心率', count: exportHeartRateData.length, icon: 'monitor_heart', color: 'blue' },
  ];

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
                    {bloodPressureChartData.length > 0 ? `${avgStats.systolic}/${avgStats.diastolic}` : '--/--'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">mmHg (平均)</span>
                </div>
              </div>
              <button
                onClick={() => openExportModal('bp')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 rounded-lg self-start transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">ios_share</span>
                导出图表与数据
              </button>
            </div>

            <div className="relative w-full h-[180px] mt-2 select-none flex items-center justify-center">
              {loading && vitals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 animate-pulse w-full">
                  <div className="w-full h-32 bg-gray-100 dark:bg-white/5 rounded-xl"></div>
                  <span className="text-xs text-gray-400">正在获取数据...</span>
                </div>
              ) : bloodPressureChartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <span className="material-symbols-outlined text-[32px] text-gray-200">sentiment_dissatisfied</span>
                  <span className="text-sm text-gray-400">该时段暂无记录</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bloodPressureChartData}>
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
                    <YAxis
                      hide
                      domain={[
                        (dataMin: number) => Math.min(dataMin, 50),
                        (dataMax: number) => Math.max(dataMax, getBPThresholds(profile?.age, profile?.gender).systolic + 10)
                      ]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#7b00ff', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area isAnimationActive={!loading} name="收缩压" type="monotone" dataKey="systolic" stroke="#7b00ff" fill="url(#gradSys)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#7b00ff', strokeWidth: 2 }} />
                    <Area isAnimationActive={!loading} name="舒张压" type="monotone" dataKey="diastolic" stroke="#38bdf8" fill="url(#gradDia)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#38bdf8', strokeWidth: 2 }} />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).systolic} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).diastolic} stroke="#f97316" strokeDasharray="3 3" />
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

          {/* Glucose Chart */}
          <div className="flex flex-col gap-4 bg-white dark:bg-[#231530] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#352345] min-h-[220px] transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                    <span className="material-symbols-outlined text-[20px]">bloodtype</span>
                  </div>
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">血糖</h2>
                </div>
                <div className={`mt-2 flex items-baseline gap-2 transition-opacity duration-300 ${loading && glucoseRecords.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
                  <span className="text-3xl font-bold tracking-tight text-[#140c1d] dark:text-white">
                    {glucoseRecords.length > 0 ? avgGlucose.toFixed(1) : '--'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">mmol/L (平均)</span>
                </div>
              </div>
              <button
                onClick={() => openExportModal('glucose')}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">ios_share</span>
                导出
              </button>
            </div>

            <div className="relative w-full h-[140px] mt-2 select-none flex items-center justify-center">
              {loading && glucoseRecords.length === 0 ? (
                <div className="w-full h-24 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
              ) : glucoseRecords.length === 0 ? (
                <div className="text-sm text-gray-400 font-medium">暂无血糖记录</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={glucoseChartData}>
                    <defs>
                      <linearGradient id="gradGlucose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={[(dataMin: number) => Math.min(dataMin, 3), (dataMax: number) => Math.max(dataMax, 12)]} />
                    <Tooltip
                      formatter={(value: number) => [`${Number(value).toFixed(1)} mmol/L`, '血糖']}
                      labelFormatter={(label) => `日期 ${label}`}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area isAnimationActive={!loading} name="血糖" type="monotone" dataKey="value" stroke="#22c55e" fill="url(#gradGlucose)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#22c55e', strokeWidth: 2 }} />
                    <ReferenceLine y={7.2} stroke="#f97316" strokeDasharray="3 3" />
                    <ReferenceLine y={4.4} stroke="#22c55e" strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* HR Chart */}
          <div className="flex flex-col gap-4 bg-white dark:bg-[#231530] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#352345] min-h-[220px] transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                    <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                  </div>
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">心率</h2>
                </div>
                <div className={`mt-2 flex items-baseline gap-2 transition-opacity duration-300 ${loading && vitals.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
                  <span className="text-3xl font-bold tracking-tight text-[#140c1d] dark:text-white">
                    {heartRateChartData.length > 0 ? avgStats.heartRate : '--'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">bpm (平均)</span>
                </div>
              </div>
              <button
                onClick={() => openExportModal('heartRate')}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">ios_share</span>
                导出
              </button>
            </div>

            <div className="relative w-full h-[140px] mt-2 select-none flex items-center justify-center">
              {loading && vitals.length === 0 ? (
                <div className="w-full h-24 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse"></div>
              ) : heartRateChartData.length === 0 ? (
                <div className="text-sm text-gray-400 font-medium">暂无记录</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={heartRateChartData}>
                    <defs>
                      <linearGradient id="gradHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis
                      hide
                      domain={[
                        (dataMin: number) => Math.min(dataMin, getHRThresholds(profile?.age, profile?.gender).min - 10),
                        (dataMax: number) => Math.max(dataMax, getHRThresholds(profile?.age, profile?.gender).max + 10)
                      ]}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area isAnimationActive={!loading} name="心率" type="monotone" dataKey="heart_rate" stroke="#3b82f6" fill="url(#gradHr)" strokeWidth={2.5} dot={{ r: 3, fill: 'white', stroke: '#3b82f6', strokeWidth: 2 }} />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).max} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).min} stroke="#eab308" strokeDasharray="3 3" />
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
            {displayedRecords.length > 0 && (
              <button
                onClick={() => {
                  if (isEditMode) {
                    setSelectedRecordKeys([]);
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
            {loading && displayedRecords.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-white dark:bg-[#231530] rounded-2xl animate-pulse border border-gray-100 dark:border-[#352345]"></div>
              ))
            ) : displayedRecords.length === 0 ? (
              <div className="bg-white dark:bg-[#231530] rounded-2xl p-8 border border-gray-100 dark:border-[#352345] flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-gray-200 text-[40px]">history</span>
                <p className="text-gray-400 text-sm">暂无详细记录</p>
              </div>
            ) : (
              displayedRecords.map((record) => (
                <div
                  key={record.key}
                  onClick={() => isEditMode && record.key && toggleSelect(record.key)}
                  className={`group relative flex items-center justify-between p-4 bg-white dark:bg-[#231530] rounded-2xl shadow-sm border transition-all active:scale-[0.98] ${isEditMode && record.key && selectedRecordKeys.includes(record.key) ? 'border-primary ring-1 ring-primary' : 'border-gray-100 dark:border-[#352345]'}`}
                >
                  <div className="flex items-center gap-4">
                    {isEditMode && (
                      <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${record.key && selectedRecordKeys.includes(record.key) ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                        {record.key && selectedRecordKeys.includes(record.key) && <span className="material-symbols-outlined text-[14px] text-white font-bold">check</span>}
                      </div>
                    )}
                    <div className={`size-10 rounded-xl ${recordColorClass[record.color as keyof typeof recordColorClass]} flex items-center justify-center`}>
                      <span className="material-symbols-outlined text-[20px]">{record.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[#140c1d] dark:text-white font-bold text-lg leading-tight">
                        {record.primary}
                        <span className="ml-2 text-xs text-gray-400 font-normal uppercase">{record.primaryUnit}</span>
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-1">{record.date} {record.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="flex flex-col">
                      <p className="text-[#140c1d] dark:text-white font-bold leading-tight">{record.label}</p>
                      {record.secondary && <p className="text-[10px] text-gray-400 font-normal mt-0.5">{record.secondary}</p>}
                      {record.rawDate > new Date().setHours(0, 0, 0, 0) && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block">新记录</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {!showAllRecords && (vitals.length + glucoseRecords.length) > 3 && (
              <button
                onClick={() => setShowAllRecords(true)}
                className="w-full py-4 text-sm font-bold text-gray-500 hover:text-primary transition-colors hover:bg-white dark:hover:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 mt-2"
              >
                查看全部 {vitals.length + glucoseRecords.length} 条记录
              </button>
            )}
          </div>
        </section>
      </main>

      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-background-light dark:bg-[#1f122b] rounded-t-[28px] sm:rounded-[28px] p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#140c1d] dark:text-white">导出趋势报告</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF 将包含趋势图与原始数据表</p>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="size-10 rounded-full bg-white dark:bg-white/5 flex items-center justify-center text-gray-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">时间范围</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'current' as const, label: '当前范围', sub: dateDisplayText },
                    { key: '7days' as const, label: '最近 7 天', sub: '含今天' },
                    { key: '30days' as const, label: '最近 30 天', sub: '含今天' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setExportRange(item.key)}
                      className={`h-20 rounded-xl border px-2 text-left transition-all ${exportRange === item.key ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-white dark:bg-[#231530] border-gray-100 dark:border-[#352345] text-gray-700 dark:text-gray-200'}`}
                    >
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className={`block text-[11px] mt-1 ${exportRange === item.key ? 'text-white/75' : 'text-gray-400'}`}>{item.sub}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">导出指标</h3>
                <div className="flex flex-col gap-2">
                  {metricOptions.map(item => (
                    <button
                      key={item.key}
                      onClick={() => toggleExportMetric(item.key)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${exportMetrics[item.key] ? 'border-primary/40 bg-primary/5' : 'border-gray-100 dark:border-[#352345] bg-white dark:bg-[#231530]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-9 rounded-lg flex items-center justify-center ${
                          item.color === 'red' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' :
                          item.color === 'green' ? 'bg-green-50 text-green-500 dark:bg-green-900/20' :
                          'bg-blue-50 text-blue-500 dark:bg-blue-900/20'
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                        </div>
                        <div>
                          <p className="font-bold text-[#140c1d] dark:text-white">{item.label}</p>
                          <p className="text-xs text-gray-400">{item.count} 条趋势点/记录</p>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined ${exportMetrics[item.key] ? 'text-primary' : 'text-gray-300'}`}>
                        {exportMetrics[item.key] ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <button
              onClick={handleExportPdf}
              disabled={isExporting || (!exportMetrics.bp && !exportMetrics.glucose && !exportMetrics.heartRate)}
              className="mt-6 w-full h-14 rounded-2xl bg-primary disabled:bg-gray-300 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">{isExporting ? 'hourglass_empty' : 'picture_as_pdf'}</span>
              {isExporting ? '正在生成...' : '生成 PDF'}
            </button>
          </div>
        </div>
      )}

      <div
        id="trend-export-report"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: '760px',
          padding: '34px',
          background: '#ffffff',
          color: '#111827',
          fontFamily: 'Arial, sans-serif',
          zIndex: -1,
        }}
      >
        <h1 style={{ fontSize: 26, margin: '0 0 8px', color: '#111827' }}>健康趋势报告</h1>
        <p style={{ margin: '0 0 22px', color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
          报告周期：{formatExportDate(exportDateRange.start)} 至 {formatExportDate(exportDateRange.end)}<br />
          生成时间：{new Date().toLocaleString('zh-CN')}<br />
          说明：趋势图按日期聚合显示平均值，具体测量记录见每个图表下方的数据表。
        </p>

        {exportMetrics.bp && (
          <section style={{ marginBottom: 34, breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 6px', color: '#991b1b' }}>血压趋势</h2>
            <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: 12 }}>横轴：日期；纵轴：mmHg。紫色为收缩压，蓝色为舒张压；虚线为参考上限。</p>
            <div style={{ height: 240, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              {exportBloodPressureData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={exportBloodPressureData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: '日期', position: 'insideBottom', offset: -4 }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'mmHg', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Area name="收缩压" type="monotone" dataKey="systolic" stroke="#7b00ff" fill="#ede9fe" strokeWidth={2} dot={{ r: 2 }} />
                    <Area name="舒张压" type="monotone" dataKey="diastolic" stroke="#38bdf8" fill="#e0f2fe" strokeWidth={2} dot={{ r: 2 }} />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).systolic} stroke="#ef4444" strokeDasharray="3 3" label="收缩压参考线" />
                    <ReferenceLine y={getBPThresholds(profile?.age, profile?.gender).diastolic} stroke="#f97316" strokeDasharray="3 3" label="舒张压参考线" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>该范围暂无血压记录</div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>时间</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>收缩压</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>舒张压</th>
                </tr>
              </thead>
              <tbody>
                {exportVitals.filter(v => v.systolic && v.diastolic).map(record => (
                  <tr key={`bp-${record.id}`}>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{new Date(record.recorded_at).toLocaleString('zh-CN')}</td>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{record.systolic} mmHg</td>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{record.diastolic} mmHg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {exportMetrics.glucose && (
          <section style={{ marginBottom: 34, breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 6px', color: '#166534' }}>血糖趋势</h2>
            <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: 12 }}>横轴：日期；纵轴：mmol/L。绿色折线为血糖平均值；虚线为常用参考范围提示。</p>
            <div style={{ height: 230, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              {exportGlucoseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={exportGlucoseData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: '日期', position: 'insideBottom', offset: -4 }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'mmol/L', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Area name="血糖" type="monotone" dataKey="value" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} dot={{ r: 2 }} />
                    <ReferenceLine y={7.2} stroke="#f97316" strokeDasharray="3 3" label="餐前参考上限" />
                    <ReferenceLine y={4.4} stroke="#22c55e" strokeDasharray="3 3" label="空腹参考下限" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>该范围暂无血糖记录</div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f0fdf4' }}>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>时间</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>血糖</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>测量场景</th>
                </tr>
              </thead>
              <tbody>
                {exportGlucose.map(record => (
                  <tr key={`glucose-${record.id}`}>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{new Date(record.recorded_at).toLocaleString('zh-CN')}</td>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{Number(record.value).toFixed(1)} mmol/L</td>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{formatGlucoseContext(record)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {exportMetrics.heartRate && (
          <section style={{ marginBottom: 16, breakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 6px', color: '#1d4ed8' }}>心率趋势</h2>
            <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: 12 }}>横轴：日期；纵轴：bpm。蓝色折线为心率平均值；虚线为参考范围提示。</p>
            <div style={{ height: 230, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              {exportHeartRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={exportHeartRateData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: '日期', position: 'insideBottom', offset: -4 }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} label={{ value: 'bpm', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Area name="心率" type="monotone" dataKey="heart_rate" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} dot={{ r: 2 }} />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).max} stroke="#ef4444" strokeDasharray="3 3" label="参考上限" />
                    <ReferenceLine y={getHRThresholds(profile?.age, profile?.gender).min} stroke="#eab308" strokeDasharray="3 3" label="参考下限" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>该范围暂无心率记录</div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#eff6ff' }}>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>时间</th>
                  <th style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'left' }}>心率</th>
                </tr>
              </thead>
              <tbody>
                {exportVitals.filter(v => v.heart_rate).map(record => (
                  <tr key={`hr-${record.id}`}>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{new Date(record.recorded_at).toLocaleString('zh-CN')}</td>
                    <td style={{ border: '1px solid #e5e7eb', padding: 8 }}>{record.heart_rate} bpm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {/* Bulk Action Bar */}
      {isEditMode && selectedRecordKeys.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-[#140c1d] text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10">
            <div className="flex items-center gap-3 pl-2">
              <span className="text-sm font-medium">已选择 <span className="text-primary-light font-bold text-lg">{selectedRecordKeys.length}</span> 项记录</span>
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
