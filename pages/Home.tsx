import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { vitalService, symptomService, profileService, glucoseService, notificationService } from '../services/api';
import {
  VitalRecord,
  GlucoseRecord,
  aggregateByDay,
  aggregateGlucoseByDay,
  evaluateGlucose,
  formatGlucoseContext,
  getLatestGlucoseRecord,
  getTimeAgoString,
  getLastNRecords,
  getLatestHeartRateRecord,
  evaluateBP
} from '../utils/dataAggregation';
import ReminderModal from '../components/ReminderModal';

const formatCardDateTime = (date: Date) => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dayLabel = isToday
    ? '今天'
    : date.toDateString() === yesterday.toDateString()
      ? '昨天'
      : `${date.getMonth() + 1}月${date.getDate()}日`;
  const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${dayLabel} ${timeLabel}`;
};

const getTrendText = (values: number[]) => {
  if (values.length < 2) return '暂无趋势';
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  if (Math.abs(diff) < 3) return '整体平稳';
  return diff > 0 ? '较前上升' : '较前下降';
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [glucoseRecords, setGlucoseRecords] = useState<GlucoseRecord[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartReminderEnabled, setSmartReminderEnabled] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);

  // Profile state for avatar and name
  const [profile, setProfile] = useState<{ avatar_url?: string; full_name?: string } | null>(null);

  useEffect(() => {
    loadVitals();
    loadGlucose();
    loadSymptoms();
    loadProfile();
    setSmartReminderEnabled(localStorage.getItem('healthguard_smart_reminder') === 'enabled');
  }, []);

  // Load profile with caching (5 minutes)
  const loadProfile = async () => {
    try {
      // Check cache first
      const cached = localStorage.getItem('healthguard_profile_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        if (cacheAge < CACHE_DURATION && data) {
          setProfile(data);
          return;
        }
      }

      // Fetch from API
      const data = await profileService.get();
      if (data) {
        setProfile(data);
        // Save to cache
        localStorage.setItem('healthguard_profile_cache', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    }
  };

  const loadVitals = async () => {
    setLoading(true);
    try {
      const data = await vitalService.getAll();
      setVitals(data || []);
    } catch (error) {
      console.error('Failed to load vitals', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSymptoms = async () => {
    try {
      const data = await symptomService.getAll();
      setSymptoms(data || []);
    } catch (error) {
      console.error('Failed to load symptoms', error);
    }
  };

  const loadGlucose = async () => {
    try {
      const data = await glucoseService.getAll();
      setGlucoseRecords(data || []);
    } catch (error) {
      console.error('Failed to load glucose records', error);
      setGlucoseRecords([]);
    }
  };

  const handleEnableReminder = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      alert('当前浏览器暂不支持推送通知。iOS/Android 请先将应用添加到主屏幕，再从主屏幕图标打开。');
      return;
    }

    setSavingReminder(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('通知权限没有开启。请在系统或浏览器设置里允许通知后再试。');
        return;
      }

      const publicKey = await notificationService.getVapidPublicKey();
      if (!publicKey) {
        alert('通知服务正在配置中，暂时无法开启。请稍后再试。');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await notificationService.subscribe(subscription);
      localStorage.setItem('healthguard_smart_reminder', 'enabled');
      localStorage.removeItem('healthguard_reminder');
      setSmartReminderEnabled(true);
      setShowNotificationModal(false);
      alert('智能提醒已开启。我们会根据您最近的记录习惯，在可能漏记时提醒您。');
    } catch (error) {
      console.error('Failed to enable push reminder', error);
      alert('开启提醒失败，请稍后重试。');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleDisableReminder = async () => {
    setSavingReminder(true);
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
      const subscription = registration ? await registration.pushManager.getSubscription() : null;

      if (subscription) {
        await notificationService.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }

      localStorage.removeItem('healthguard_smart_reminder');
      localStorage.removeItem('healthguard_reminder');
      setSmartReminderEnabled(false);
      setShowNotificationModal(false);
    } catch (error) {
      console.error('Failed to disable push reminder', error);
      alert('关闭提醒失败，请稍后重试。');
    } finally {
      setSavingReminder(false);
    }
  };

  // Get latest vital for display
  const latestVital = useMemo(() => {
    if (vitals.length === 0) return null;
    return vitals[0]; // Assuming sorted by date desc
  }, [vitals]);

  const latestHeartRateRecord = useMemo(() => getLatestHeartRateRecord(vitals), [vitals]);

  // Get last 7 days of data aggregated by day for chart
  const chartData = useMemo(() => {
    if (!vitals || !Array.isArray(vitals) || vitals.length === 0) return [];

    // Filter to last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentVitals = vitals.filter(v => new Date(v.recorded_at) >= sevenDaysAgo);
    const aggregated = aggregateByDay(recentVitals);

    return aggregated.map(a => ({
      label: a.label || '',
      systolic: a.systolic || 0,
      diastolic: a.diastolic || 0,
      heart_rate: a.heart_rate || 0
    }));
  }, [vitals]);

  const glucoseChartData = useMemo(() => {
    if (!glucoseRecords || !Array.isArray(glucoseRecords) || glucoseRecords.length === 0) return [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return aggregateGlucoseByDay(glucoseRecords.filter(record => new Date(record.recorded_at) >= sevenDaysAgo));
  }, [glucoseRecords]);

  // Calculate average stats based on last 3 records
  const avgStats = useMemo(() => {
    if (!vitals || !Array.isArray(vitals) || vitals.length === 0) {
      return { systolic: 0, diastolic: 0, heartRate: 0 };
    }

    // Grab the latest 3 valid records matching user requirement
    const recentVitals = getLastNRecords(vitals, 3);

    if (recentVitals.length === 0) return { systolic: 0, diastolic: 0, heartRate: 0 };

    const count = recentVitals.length;
    return {
      systolic: Math.round(recentVitals.reduce((sum, v) => sum + v.systolic, 0) / count),
      diastolic: Math.round(recentVitals.reduce((sum, v) => sum + v.diastolic, 0) / count),
      heartRate: Math.round(recentVitals.reduce((sum, v) => sum + v.heart_rate, 0) / count)
    };
  }, [vitals]);

  const bloodPressureTimeRange = useMemo(() => {
    const recentVitals = getLastNRecords(vitals, 3);
    if (recentVitals.length === 0) return '暂无记录';

    const times = recentVitals
      .map(v => new Date(v.recorded_at))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (times.length === 0) return '暂无记录';
    if (times.length === 1) return formatCardDateTime(times[0]);

    return `${formatCardDateTime(times[0])} - ${formatCardDateTime(times[times.length - 1])}`;
  }, [vitals]);

  const heartRateRecordTime = useMemo(() => {
    if (!latestHeartRateRecord?.recorded_at) return '暂无记录';
    return formatCardDateTime(new Date(latestHeartRateRecord.recorded_at));
  }, [latestHeartRateRecord]);

  const latestGlucose = useMemo(() => getLatestGlucoseRecord(glucoseRecords), [glucoseRecords]);
  const glucoseStatus = useMemo(() => evaluateGlucose(latestGlucose), [latestGlucose]);
  const glucoseRecordTime = useMemo(() => {
    if (!latestGlucose?.recorded_at) return '暂无记录';
    return formatCardDateTime(new Date(latestGlucose.recorded_at));
  }, [latestGlucose]);

  const bloodPressureTrendText = useMemo(() => (
    getTrendText(chartData.map(item => item.systolic).filter(Boolean))
  ), [chartData]);

  const heartRateTrendText = useMemo(() => (
    getTrendText(chartData.map(item => item.heart_rate).filter(Boolean))
  ), [chartData]);

  const glucoseTrendText = useMemo(() => (
    getTrendText(glucoseChartData.map(item => item.value).filter(Boolean))
  ), [glucoseChartData]);

  // Get last record time
  const lastRecordTime = useMemo(() => {
    if (!latestVital) return '暂无记录';
    return getTimeAgoString(new Date(latestVital.recorded_at));
  }, [latestVital]);

  // Determine BP status
  const bpStatus = useMemo(() => {
    if (vitals.length === 0 || !avgStats.systolic) {
      return { text: '暂无', color: 'gray', advice: '' };
    }

    // Extract profile stats
    const age = profile?.age || 30;
    const gender = profile?.gender || 'unknown';
    const height = profile?.height || 170;
    const weight = profile?.weight || 65;
    const bmi = weight / ((height / 100) * (height / 100)) || 22;

    // Based on latest 3 records average
    return evaluateBP(avgStats.systolic, avgStats.diastolic, age, gender, bmi);
  }, [vitals, avgStats, profile]);

  return (
    <div className="flex flex-col gap-0 pb-6 relative">
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 pb-2 bg-background-light dark:bg-background-dark">
        <div className="flex items-center h-12 justify-between">
          <div className="flex items-center gap-3" onClick={() => navigate('/profile')}>
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20 cursor-pointer"
              style={{ backgroundImage: `url("${profile?.avatar_url || '/default-avatar.png'}")` }}
            >
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">欢迎回来，</p>
              <p className="text-[#140c1d] dark:text-white text-lg font-bold leading-tight">{profile?.full_name || user?.email?.split('@')[0] || '用户'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNotificationModal(true)}
            className={`flex items-center justify-center rounded-full size-10 bg-white dark:bg-[#2a1d36] shadow-sm transition-colors ${smartReminderEnabled ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-primary hover:bg-primary/5'}`}
          >
            <span className="material-symbols-outlined">{smartReminderEnabled ? 'notifications_active' : 'notifications'}</span>
          </button>
        </div>
      </header>

      {/* Last Record Info */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px]">history</span>
            <p className="text-blue-900 dark:text-blue-100 text-sm font-medium">上次记录: {lastRecordTime}</p>
          </div>
          <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
      </div>

      {/* Vitals Cards */}
      <section className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex min-h-[150px] flex-col gap-2 rounded-xl p-3 bg-white dark:bg-[#231530] shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="size-7 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined text-[18px]">favorite</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-xs font-medium">血压</p>
            </div>
            <div>
              <div className="flex items-baseline gap-0.5">
                <p className="text-[#140c1d] dark:text-white text-xl font-bold leading-tight">
                  {vitals.length > 0 ? avgStats.systolic : '--'}
                </p>
                <span className="text-gray-400 text-base">/</span>
                <p className="text-[#140c1d] dark:text-white text-xl font-bold leading-tight">
                  {vitals.length > 0 ? avgStats.diastolic : '--'}
                </p>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">mmHg</p>
              <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{bloodPressureTimeRange}</p>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              {vitals.length > 0 && <span className={`material-symbols-outlined text-${bpStatus.color}-500 text-[16px]`}>
                {bpStatus.color === 'green' || bpStatus.color === 'blue' ? 'check_circle' : 'warning'}
              </span>}
              <p className={`text-${bpStatus.color}-600 dark:text-${bpStatus.color}-400 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis`} title={bpStatus.advice}>{bpStatus.text}</p>
            </div>
          </div>

          <div className="flex min-h-[150px] flex-col gap-2 rounded-xl p-3 bg-white dark:bg-[#231530] shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="size-7 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                <span className="material-symbols-outlined text-[18px]">bloodtype</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-xs font-medium">血糖</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <p className="text-[#140c1d] dark:text-white text-2xl font-bold leading-tight">
                  {latestGlucose ? latestGlucose.value.toFixed(1) : '--'}
                </p>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">mmol/L</p>
              <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{glucoseRecordTime}</p>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              {latestGlucose && <span className={`material-symbols-outlined text-${glucoseStatus.color}-500 text-[16px]`}>
                {glucoseStatus.color === 'green' || glucoseStatus.color === 'blue' ? 'check_circle' : 'warning'}
              </span>}
              <p className={`text-${glucoseStatus.color}-600 dark:text-${glucoseStatus.color}-400 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis`} title={glucoseStatus.advice}>{glucoseStatus.text}</p>
            </div>
          </div>

          <div className="flex min-h-[150px] flex-col gap-2 rounded-xl p-3 bg-white dark:bg-[#231530] shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="size-7 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-[18px]">monitor_heart</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-xs font-medium">心率</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <p className="text-[#140c1d] dark:text-white text-2xl font-bold leading-tight">
                  {latestHeartRateRecord?.heart_rate || avgStats.heartRate || '--'}
                </p>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">bpm</p>
              <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{heartRateRecordTime}</p>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              <span className="material-symbols-outlined text-green-500 text-[16px]">check_circle</span>
              <p className="text-green-600 dark:text-green-400 text-xs font-semibold">静息</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Button */}
      <div className="px-4 py-2">
        <button
          onClick={() => navigate('/symptoms')}
          className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary-dark text-white rounded-xl py-4 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[24px]">add_circle</span>
          <span className="text-lg font-bold tracking-wide">记录体征</span>
        </button>
      </div>

      {/* Chart Section */}
      <section className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[#140c1d] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">每周概览</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">过去 7 天趋势</p>
          </div>
          <button onClick={() => navigate('/trends')} className="text-primary text-sm font-semibold hover:underline">查看报告</button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345] shadow-sm p-4 min-h-[150px] flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-[20px]">favorite</span>
                <p className="text-sm font-bold text-[#140c1d] dark:text-white">血压趋势</p>
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{loading ? '同步中' : bloodPressureTrendText}</p>
            </div>
            <div className="mt-3 h-20">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="bpMiniGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7b00ff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#7b00ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area isAnimationActive={!loading} type="monotone" dataKey="systolic" stroke="#7b00ff" strokeWidth={2} fill="url(#bpMiniGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="material-symbols-outlined text-[24px]">show_chart</span>
                    <span className="text-sm">暂无趋势记录</span>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">过去 7 天收缩压变化</p>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345] shadow-sm p-4 min-h-[150px] flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500 text-[20px]">bloodtype</span>
              <p className="text-sm font-bold text-[#140c1d] dark:text-white">血糖趋势</p>
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{glucoseTrendText}</p>
            </div>
            <div className="mt-3 h-20">
              {glucoseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={glucoseChartData}>
                    <defs>
                      <linearGradient id="glucoseMiniGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area isAnimationActive={!loading} type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#glucoseMiniGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="material-symbols-outlined text-[24px]">show_chart</span>
                    <span className="text-sm">等待血糖记录</span>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">{latestGlucose ? formatGlucoseContext(latestGlucose) : '接入血糖后显示最近趋势'}</p>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345] shadow-sm p-4 min-h-[150px] flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">monitor_heart</span>
                <p className="text-sm font-bold text-[#140c1d] dark:text-white">心率趋势</p>
              </div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{loading ? '同步中' : heartRateTrendText}</p>
            </div>
            <div className="mt-3 h-20">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="hrMiniGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area isAnimationActive={!loading} type="monotone" dataKey="heart_rate" stroke="#3b82f6" strokeWidth={2} fill="url(#hrMiniGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-lg bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="material-symbols-outlined text-[24px]">show_chart</span>
                    <span className="text-sm">暂无趋势记录</span>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">过去 7 天平均心率变化</p>
          </div>
        </div>
      </section>

      {/* Quick Check */}
      <section className="pb-6">
        <h2 className="text-[#140c1d] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-3">快速检查</h2>
        <div className="flex overflow-x-auto gap-3 px-4 pb-4 no-scrollbar snap-x">
          {[
            { id: '1', icon: 'sentiment_satisfied', label: '状态良好', color: 'orange' },
            { id: '2', icon: 'healing', label: '头痛', color: 'purple' },
            { id: '3', icon: 'shutter_speed', label: '头晕', color: 'blue' },
            { id: '4', icon: 'ecg_heart', label: '心悸', color: 'red' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/symptoms?id=${item.id}`)}
              className="flex min-w-[100px] flex-col items-center gap-2 rounded-xl p-4 bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345] shadow-sm snap-start active:bg-primary/5 transition-colors group"
            >
              <div className={`bg-${item.color}-50 dark:bg-${item.color}-900/20 rounded-full p-2 group-hover:bg-${item.color}-100 transition-colors text-${item.color}-500`}>
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Reminder Modal */}
      <ReminderModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        isEnabled={smartReminderEnabled}
        isSaving={savingReminder}
        onEnable={handleEnableReminder}
        onDisable={handleDisableReminder}
      />
    </div>
  );
};

export default Home;
