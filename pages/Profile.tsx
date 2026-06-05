import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/api';

type HealthGoals = {
  bpSystolic: number;
  bpDiastolic: number;
  glucoseMin: number;
  glucoseMax: number;
  heartRateMin: number;
  heartRateMax: number;
};

const defaultHealthGoals: HealthGoals = {
  bpSystolic: 120,
  bpDiastolic: 80,
  glucoseMin: 4.4,
  glucoseMax: 7.2,
  heartRateMin: 60,
  heartRateMax: 100,
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState(28);
  const [height, setHeight] = useState(165);
  const [weight, setWeight] = useState(61);
  const [fullName, setFullName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('/default-avatar.png');
  const [isSaving, setIsSaving] = useState(false);
  const [healthGoals, setHealthGoals] = useState<HealthGoals>(defaultHealthGoals);
  const [goalDraft, setGoalDraft] = useState<HealthGoals>(defaultHealthGoals);
  const [isEditingGoals, setIsEditingGoals] = useState(false);

  // Editing states for chips
  const [editingField, setEditingField] = useState<string | null>(null);

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: '偏瘦', color: 'text-blue-500', bg: 'bg-blue-50', icon: 'sentiment_neutral', emoji: '🥗' };
    if (bmi < 24) return { label: '正常', color: 'text-green-500', bg: 'bg-green-50', icon: 'sentiment_very_satisfied', emoji: '✨' };
    if (bmi < 28) return { label: '偏胖', color: 'text-orange-500', bg: 'bg-orange-50', icon: 'sentiment_satisfied', emoji: '🏃' };
    return { label: '肥胖', color: 'text-red-500', bg: 'bg-red-50', icon: 'sentiment_dissatisfied', emoji: '🔥' };
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Check cache first for instant display
      const cached = localStorage.getItem('healthguard_profile_cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for profile page
        if (cacheAge < CACHE_DURATION && data) {
          setProfile(data);
          setFullName(data.full_name || '');
          if (data.gender) setGender(data.gender);
          if (data.age) setAge(data.age);
          if (data.height) setHeight(data.height);
          if (data.weight) setWeight(data.weight);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
          loadGoalsFromProfile(data);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const data = await profileService.get();
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        if (data.gender) setGender(data.gender);
        if (data.age) setAge(data.age);
        if (data.height) setHeight(data.height);
        if (data.weight) setWeight(data.weight);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
        loadGoalsFromProfile(data);
        // Update cache
        localStorage.setItem('healthguard_profile_cache', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoalsFromProfile = (data: any) => {
    const cachedGoals = localStorage.getItem('healthguard_health_goals');
    const nextGoals = data?.health_goals || (cachedGoals ? JSON.parse(cachedGoals) : null) || defaultHealthGoals;
    setHealthGoals({ ...defaultHealthGoals, ...nextGoals });
    setGoalDraft({ ...defaultHealthGoals, ...nextGoals });
  };

  const updateGoalDraft = (field: keyof HealthGoals, value: string) => {
    const parsed = Number(value);
    setGoalDraft(prev => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? parsed : prev[field],
    }));
  };

  const handleSaveGoals = async () => {
    const normalizedGoals = {
      bpSystolic: Math.round(goalDraft.bpSystolic),
      bpDiastolic: Math.round(goalDraft.bpDiastolic),
      glucoseMin: Number(goalDraft.glucoseMin.toFixed(1)),
      glucoseMax: Number(goalDraft.glucoseMax.toFixed(1)),
      heartRateMin: Math.round(goalDraft.heartRateMin),
      heartRateMax: Math.round(goalDraft.heartRateMax),
    };

    setIsSaving(true);
    try {
      setHealthGoals(normalizedGoals);
      setGoalDraft(normalizedGoals);
      localStorage.setItem('healthguard_health_goals', JSON.stringify(normalizedGoals));
      await profileService.update({ health_goals: normalizedGoals });
      localStorage.removeItem('healthguard_profile_cache');
      setIsEditingGoals(false);
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || '';
      if (message.includes('health_goals') || message.includes('column')) {
        setIsEditingGoals(false);
        alert('目标已保存在本机。上线前执行 health_goals SQL 后，可同步到账号。');
      } else {
        alert('保存失败，请重试。');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveField = async (fields: any) => {
    setIsSaving(true);
    try {
      await profileService.update(fields);
      // Clear Home page cache so it refreshes on next visit
      localStorage.removeItem('healthguard_profile_cache');
      // Update local state without full reload if possible, or just reload
      await loadProfile();
      setIsEditingName(false);
      setEditingField(null);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      // Check if the error is about a missing column (like avatar_url)
      const errorMsg = error.response?.data?.error || '';
      if (errorMsg.includes('column') && errorMsg.includes('avatar_url')) {
        alert('系统升级中：头像存储功能暂不可用，已为您保存其他资料。');
        // Try saving again without avatar_url
        const { avatar_url, ...rest } = fields;
        if (Object.keys(rest).length > 0) {
          await profileService.update(rest);
          await loadProfile();
        }
      } else {
        alert('保存失败，请检查网络或重试。');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB)
    const MAX_SIZE = 500 * 1024; // 500KB
    if (file.size > MAX_SIZE) {
      alert('图片文件过大，请选择小于 500KB 的图片');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('请选择有效的图片文件');
      return;
    }

    setIsSaving(true);
    try {
      // Import supabase client
      const { supabase } = await import('../lib/supabase');

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('上传失败: ' + uploadError.message);
      }

      // Get public URL
      const { publicURL, error: urlError } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (urlError || !publicURL) {
        throw new Error('获取图片链接失败');
      }

      // Save to profile
      setAvatarUrl(publicURL);
      await handleSaveField({ avatar_url: publicURL });

    } catch (error: any) {
      console.error('Avatar upload failed:', error);
      alert('头像上传失败：' + (error.message || '请检查网络'));
    } finally {
      setIsSaving(false);
    }
  };

  const bmi = weight / ((height / 100) * (height / 100)) || 0;
  const bmiInfo = getBMICategory(bmi);
  const referenceCards = [
    {
      title: '血压参考',
      icon: 'favorite',
      tone: 'red',
      value: '<120 / <80',
      unit: 'mmHg',
      detail: `${age}岁成人正常血压通常参考收缩压低于 120 且舒张压低于 80；年龄会影响风险评估，但家庭记录仍建议先按成人通用分类观察趋势。`,
      source: '来源：American Heart Association - Understanding Blood Pressure Readings',
    },
    {
      title: '血糖参考',
      icon: 'bloodtype',
      tone: 'green',
      value: '4.4-7.2',
      unit: 'mmol/L',
      detail: `当前 BMI 为 ${bmi.toFixed(1)}。ADA 成人糖尿病管理目标常用餐前 4.4-7.2 mmol/L；餐后峰值通常参考低于 10.0 mmol/L，目标需结合年龄、用药和医生建议个体化。`,
      source: '来源：ADA Standards of Care in Diabetes 2026',
    },
    {
      title: '心率参考',
      icon: 'monitor_heart',
      tone: 'blue',
      value: '60-100',
      unit: 'bpm',
      detail: `${age}岁成人安静状态下心率常见范围为 60-100 bpm；运动水平、药物、压力、睡眠和咖啡因都会影响心率。`,
      source: '来源：American Heart Association - All About Heart Rate',
    },
  ];
  const referenceToneClass = {
    red: {
      icon: 'bg-red-50 dark:bg-red-900/20 text-red-500',
      badge: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300',
    },
    green: {
      icon: 'bg-green-50 dark:bg-green-900/20 text-green-500',
      badge: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300',
    },
    blue: {
      icon: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
      badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    },
  } as const;

  if (loading) return <div>Loading...</div>;

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-24 bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1f122b] sticky top-0 z-40 border-b border-gray-100 dark:border-[#352345]">
        <button onClick={() => navigate('/')} className="flex items-center justify-center size-10 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-[#140c1d] dark:text-white">身体档案</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex flex-col gap-5 p-4">
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative group">
            <div
              className="size-24 rounded-full bg-cover bg-center border-4 border-white dark:border-[#2a1d36] shadow-md overflow-hidden bg-gray-100"
              style={{ backgroundImage: `url("${avatarUrl}")` }}
            ></div>
            <label className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 border-2 border-white dark:border-[#2a1d36] shadow-sm flex items-center justify-center hover:scale-110 transition-transform active:scale-95 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>

          <div className="mt-3 flex flex-col items-center gap-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="bg-transparent border-b-2 border-primary text-xl font-bold text-center text-[#140c1d] dark:text-white focus:outline-none min-w-[150px]"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleSaveField({ full_name: fullName })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ full_name: fullName })}
                />
              </div>
            ) : (
              <h2
                onClick={() => setIsEditingName(true)}
                className="text-xl font-bold text-[#140c1d] dark:text-white cursor-pointer hover:text-primary transition-colors flex items-center gap-2 px-4 py-1 rounded-lg hover:bg-white/40 dark:hover:bg-white/5"
              >
                {fullName || '点击设置姓名'}
                <span className="material-symbols-outlined text-sm text-gray-400">edit</span>
              </h2>
            )}

            <div className="flex flex-wrap justify-center items-center gap-2 mt-2 px-4">
              {/* Gender Chip */}
              <div
                onClick={() => setEditingField(editingField === 'gender' ? null : 'gender')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${editingField === 'gender' ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30' : 'bg-white/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-white/5'}`}
              >
                <span className={`material-symbols-outlined text-sm ${editingField === 'gender' ? 'text-white' : 'text-gray-400'}`}>
                  {gender === 'female' ? 'female' : 'male'}
                </span>
                <span className="text-xs font-bold">{gender === 'female' ? '女性' : '男性'}</span>
              </div>

              {/* Age Chip */}
              <div
                onClick={() => setEditingField(editingField === 'age' ? null : 'age')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${editingField === 'age' ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30' : 'bg-white/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-white/5'}`}
              >
                <span className={`material-symbols-outlined text-sm ${editingField === 'age' ? 'text-white' : 'text-gray-400'}`}>cake</span>
                <span className="text-xs font-bold">{age}岁</span>
              </div>

              {/* Height Chip */}
              <div
                onClick={() => setEditingField(editingField === 'height' ? null : 'height')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${editingField === 'height' ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30' : 'bg-white/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-white/5'}`}
              >
                <span className={`material-symbols-outlined text-sm ${editingField === 'height' ? 'text-white' : 'text-gray-400'}`}>height</span>
                <span className="text-xs font-bold">{height}cm</span>
              </div>

              {/* Weight Chip */}
              <div
                onClick={() => setEditingField(editingField === 'weight' ? null : 'weight')}
                className={`px-3 py-1.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${editingField === 'weight' ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30' : 'bg-white/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-white/5'}`}
              >
                <span className={`material-symbols-outlined text-sm ${editingField === 'weight' ? 'text-white' : 'text-gray-400'}`}>weight</span>
                <span className="text-xs font-bold">{weight}kg</span>
              </div>
            </div>

            {/* Quick Inline Editor for Chips */}
            {editingField && (
              <div className="mt-4 w-full max-w-[min(280px,90vw)] mx-auto bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-xl border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200 box-border">
                <div className="flex flex-col gap-4">
                  {editingField === 'gender' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveField({ gender: 'male' })}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${gender === 'male' ? 'bg-primary border-primary text-white' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-400 font-medium'}`}
                      >
                        男性
                      </button>
                      <button
                        onClick={() => handleSaveField({ gender: 'female' })}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${gender === 'female' ? 'bg-primary border-primary text-white' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-400 font-medium'}`}
                      >
                        女性
                      </button>
                    </div>
                  )}
                  {editingField === 'age' && (
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 min-w-0 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={age}
                        onChange={(e) => setAge(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ age })}
                      />
                      <button onClick={() => handleSaveField({ age })} className="flex-shrink-0 bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                  {editingField === 'height' && (
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 min-w-0 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={height}
                        onChange={(e) => setHeight(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ height })}
                      />
                      <span className="flex-shrink-0 text-gray-400 font-bold">cm</span>
                      <button onClick={() => handleSaveField({ height })} className="flex-shrink-0 bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                  {editingField === 'weight' && (
                    <div className="flex items-center gap-2 w-full overflow-hidden">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 min-w-0 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={weight}
                        onChange={(e) => setWeight(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ weight })}
                      />
                      <span className="flex-shrink-0 text-gray-400 font-bold">kg</span>
                      <button onClick={() => handleSaveField({ weight })} className="flex-shrink-0 bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#352345]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">flag</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#140c1d] dark:text-white">健康目标</h3>
                <p className="text-xs text-gray-400">用于个人记录，不作为诊断依据</p>
              </div>
            </div>
            <button
              onClick={() => {
                setGoalDraft(healthGoals);
                setIsEditingGoals(!isEditingGoals);
              }}
              className="size-9 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-300 flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[20px]">{isEditingGoals ? 'close' : 'edit'}</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-semibold text-gray-400">血压</p>
              <p className="mt-1 text-sm font-black text-[#140c1d] dark:text-white">{healthGoals.bpSystolic}/{healthGoals.bpDiastolic}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-semibold text-gray-400">血糖</p>
              <p className="mt-1 text-sm font-black text-[#140c1d] dark:text-white">{healthGoals.glucoseMin.toFixed(1)}-{healthGoals.glucoseMax.toFixed(1)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3">
              <p className="text-[10px] font-semibold text-gray-400">心率</p>
              <p className="mt-1 text-sm font-black text-[#140c1d] dark:text-white">{healthGoals.heartRateMin}-{healthGoals.heartRateMax}</p>
            </div>
          </div>
          {isEditingGoals && (
            <div className="mt-4 rounded-2xl bg-gray-50 dark:bg-white/5 p-4 border border-gray-100 dark:border-white/10">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">收缩压目标</span>
                  <input type="number" value={goalDraft.bpSystolic} onChange={(e) => updateGoalDraft('bpSystolic', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">舒张压目标</span>
                  <input type="number" value={goalDraft.bpDiastolic} onChange={(e) => updateGoalDraft('bpDiastolic', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">血糖下限</span>
                  <input type="number" step="0.1" value={goalDraft.glucoseMin} onChange={(e) => updateGoalDraft('glucoseMin', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">血糖上限</span>
                  <input type="number" step="0.1" value={goalDraft.glucoseMax} onChange={(e) => updateGoalDraft('glucoseMax', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">心率下限</span>
                  <input type="number" value={goalDraft.heartRateMin} onChange={(e) => updateGoalDraft('heartRateMin', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">心率上限</span>
                  <input type="number" value={goalDraft.heartRateMax} onChange={(e) => updateGoalDraft('heartRateMax', e.target.value)} className="rounded-xl border-transparent bg-white dark:bg-[#231530] text-sm font-bold text-center focus:border-primary focus:ring-primary" />
                </label>
              </div>
              <button
                onClick={handleSaveGoals}
                disabled={isSaving}
                className="mt-4 w-full h-11 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">{isSaving ? 'sync' : 'check'}</span>
                {isSaving ? '保存中...' : '保存目标'}
              </button>
            </div>
          )}
        </section>

        <section onClick={() => navigate('/bmi-info')} className="cursor-pointer bg-white dark:bg-[#231530] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#352345] relative overflow-hidden active:scale-[0.99] transition-transform">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[100px] text-primary">accessibility_new</span>
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-[#140c1d] dark:text-white">体质指数</h3>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-primary">{bmi.toFixed(1)}</p>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${bmiInfo.bg} ${bmiInfo.color}`}>
                  BMI
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`text-xl font-bold ${bmiInfo.color}`}>{bmiInfo.label} {bmiInfo.emoji}</p>
                <p className="text-[10px] text-gray-400 font-medium">身体状态良好</p>
              </div>
              <div className={`size-12 rounded-2xl ${bmiInfo.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined text-[28px] ${bmiInfo.color}`}>{bmiInfo.icon}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#140c1d] dark:text-white">指标参考</h3>
            <span className="text-xs font-semibold text-gray-400">非诊断建议</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {referenceCards.map((item) => (
              <div key={item.title} className="bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#352345]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl ${referenceToneClass[item.tone as keyof typeof referenceToneClass].icon} flex items-center justify-center`}>
                      <span className="material-symbols-outlined">{item.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#140c1d] dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#140c1d] dark:text-white">{item.value}</p>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${referenceToneClass[item.tone as keyof typeof referenceToneClass].badge}`}>参考范围</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.detail}</p>
                <p className="mt-2 text-[10px] font-medium text-gray-400">{item.source}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#352345]">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 flex items-center justify-center">
                <span className="material-symbols-outlined">menu_book</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#140c1d] dark:text-white">指南与来源</h4>
                <p className="text-xs text-gray-400">这些范围用于健康记录参考</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <p>血压分类采用 AHA 成人血压读数口径；单次家庭测量不能替代诊室诊断。</p>
              <p>血糖目标采用 ADA 成人糖尿病管理目标口径；非糖尿病、孕期、儿童或用药人群应遵循医生建议。</p>
              <p>心率范围采用 AHA 成人静息心率常见范围；运动员、服药或存在心血管疾病时可能不同。</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
