import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { vitalService, symptomService } from '../services/api';
import { VitalRecord, aggregateByDay, getTimeAgoString } from '../utils/dataAggregation';
import ReminderModal from '../components/ReminderModal';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [vitals, setVitals] = useState<VitalRecord[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderTime, setReminderTime] = useState<{ hour: number; minute: number } | null>(null);

  useEffect(() => {
    loadVitals();
    loadSymptoms();
    const saved = localStorage.getItem('healthguard_reminder');
    if (saved) {
      setReminderTime(JSON.parse(saved));
    }
  }, []);

  // Notification logic
  useEffect(() => {
    if (!reminderTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour === reminderTime.hour && currentMinute === reminderTime.minute) {
        checkAndNotify();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [reminderTime, vitals, symptoms]);

  const checkAndNotify = async () => {
    // Check if notification permission is granted
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    // Check if any data exists for TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordedToday = [
      ...vitals.map(v => new Date(v.recorded_at)),
      ...symptoms.map(s => new Date(s.created_at || s.recorded_at))
    ].some(d => d >= today);

    if (!recordedToday) {
      new Notification('健康助手提醒', {
        body: '记录时刻到啦！如果您还没记录今天的血压或症状，请及时打卡哦。',
        icon: '/logo192.png' // Use a relative or actual icon path if available
      });
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

  const handleSaveReminder = (time: { hour: number; minute: number }) => {
    localStorage.setItem('healthguard_reminder', JSON.stringify(time));
    setReminderTime(time);
    // Trigger permission request immediately when setting up
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    alert(`提醒设置成功：${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`);
  };

  // Get latest vital for display
  const latestVital = useMemo(() => {
    if (vitals.length === 0) return null;
    return vitals[0]; // Assuming sorted by date desc
  }, [vitals]);

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

  // Calculate average stats
  const avgStats = useMemo(() => {
    if (!vitals || !Array.isArray(vitals) || vitals.length === 0) {
      return { systolic: 0, diastolic: 0, heartRate: 0 };
    }
    // Use last 7 days for averages
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const recentVitals = vitals.filter(v => new Date(v.recorded_at) >= sevenDaysAgo);

    const validVitals = recentVitals.filter(v =>
      typeof v.systolic === 'number' &&
      typeof v.diastolic === 'number' &&
      typeof v.heart_rate === 'number'
    );

    if (validVitals.length === 0) return { systolic: 0, diastolic: 0, heartRate: 0 };

    if (validVitals.length === 0) {
      return { systolic: 0, diastolic: 0, heartRate: 0 };
    }

    const count = validVitals.length;
    return {
      systolic: Math.round(validVitals.reduce((sum, v) => sum + v.systolic, 0) / count),
      diastolic: Math.round(validVitals.reduce((sum, v) => sum + v.diastolic, 0) / count),
      heartRate: Math.round(validVitals.reduce((sum, v) => sum + v.heart_rate, 0) / count)
    };
  }, [vitals]);

  // Get last record time
  const lastRecordTime = useMemo(() => {
    if (!latestVital) return '暂无记录';
    return getTimeAgoString(new Date(latestVital.recorded_at));
  }, [latestVital]);

  // Determine BP status
  const getBpStatus = (systolic: number, diastolic: number) => {
    if (systolic < 90 || diastolic < 60) return { text: '偏低', color: 'yellow' };
    if (systolic <= 120 && diastolic <= 80) return { text: '正常', color: 'green' };
    if (systolic <= 139 || diastolic <= 89) return { text: '偏高', color: 'yellow' };
    return { text: '高血压', color: 'red' };
  };

  const bpStatus = latestVital
    ? getBpStatus(latestVital.systolic, latestVital.diastolic)
    : { text: '正常', color: 'green' };

  return (
    <div className="flex flex-col gap-0 pb-6 relative">
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 pb-2 bg-background-light dark:bg-background-dark">
        <div className="flex items-center h-12 justify-between">
          <div className="flex items-center gap-3" onClick={() => navigate('/profile')}>
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border-2 border-primary/20 cursor-pointer"
              style={{ backgroundImage: 'url("https://picsum.photos/id/64/100/100")' }}
            >
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">欢迎回来，</p>
              <p className="text-[#140c1d] dark:text-white text-lg font-bold leading-tight">{user?.email?.split('@')[0] || '用户'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNotificationModal(true)}
            className="flex items-center justify-center rounded-full size-10 bg-white dark:bg-[#2a1d36] shadow-sm text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-outlined">notifications</span>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3 rounded-xl p-5 bg-white dark:bg-[#231530] shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined text-[20px]">favorite</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">血压</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <p className="text-[#140c1d] dark:text-white text-2xl font-bold leading-tight">
                  {latestVital?.systolic || avgStats.systolic || '--'}
                </p>
                <span className="text-gray-400 text-lg">/</span>
                <p className="text-[#140c1d] dark:text-white text-2xl font-bold leading-tight">
                  {latestVital?.diastolic || avgStats.diastolic || '--'}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">mmHg</p>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              <span className={`material-symbols-outlined text-${bpStatus.color}-500 text-[16px]`}>check_circle</span>
              <p className={`text-${bpStatus.color}-600 dark:text-${bpStatus.color}-400 text-sm font-medium`}>{bpStatus.text}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl p-5 bg-white dark:bg-[#231530] shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">心率</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <p className="text-[#140c1d] dark:text-white text-3xl font-bold leading-tight">
                  {latestVital?.heart_rate || avgStats.heartRate || '--'}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">bpm</p>
            </div>
            <div className="flex items-center gap-1 mt-auto">
              <span className="material-symbols-outlined text-green-500 text-[16px]">check_circle</span>
              <p className="text-green-600 dark:text-green-400 text-sm font-medium">静息</p>
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
            <p className="text-gray-500 dark:text-gray-400 text-sm">收缩压趋势</p>
          </div>
          <button onClick={() => navigate('/trends')} className="text-primary text-sm font-semibold hover:underline">查看报告</button>
        </div>
        <div className="bg-white dark:bg-[#231530] rounded-xl p-6 shadow-sm border border-gray-100 dark:border-[#352345] min-h-[220px]">
          <div className="flex justify-between items-end mb-4">
            <div className={`transition-opacity duration-300 ${loading && chartData.length === 0 ? 'opacity-30' : 'opacity-100'}`}>
              <p className="text-[#140c1d] dark:text-white tracking-light text-[32px] font-bold leading-tight">
                {chartData.length > 0 ? '稳定' : loading ? '加载中' : '暂无数据'}
              </p>
              <div className="flex items-center gap-1 text-green-500 mt-1">
                <span className="material-symbols-outlined text-[16px]">trending_flat</span>
                <span className="text-xs font-medium">处于健康范围内</span>
              </div>
            </div>
            <p className="text-gray-400 text-xs font-medium bg-gray-50 dark:bg-white/5 px-2 py-1 rounded">过去 7 天</p>
          </div>

          <div className="w-full h-[140px] relative flex items-center justify-center">
            {loading && chartData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 animate-pulse w-full">
                <div className="w-full h-24 bg-gray-100 dark:bg-white/5 rounded-xl"></div>
                <span className="text-xs text-gray-400">正在同步...</span>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7b00ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7b00ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#7b00ff', fontWeight: 'bold' }}
                    cursor={{ stroke: '#7b00ff', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Area
                    isAnimationActive={!loading}
                    name="收缩压"
                    type="monotone"
                    dataKey="systolic"
                    stroke="#7b00ff"
                    strokeWidth={3}
                    fill="url(#gradient)"
                    dot={{ fill: '#fff', stroke: '#7b00ff', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, fill: '#7b00ff', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-gray-300 text-[32px]">show_chart</span>
                <span className="text-sm text-gray-400">暂无趋势记录</span>
              </div>
            )}
            {loading && chartData.length > 0 && (
              <div className="absolute inset-x-0 bottom-0 top-0 bg-white/40 dark:bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10 transition-all">
                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
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
        onSave={handleSaveReminder}
        initialTime={reminderTime || undefined}
      />
    </div>
  );
};

export default Home;