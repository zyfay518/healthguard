import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileService } from '../services/api';

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
  const [avatarUrl, setAvatarUrl] = useState('https://picsum.photos/id/64/150/150');
  const [isSaving, setIsSaving] = useState(false);

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
      const data = await profileService.get();
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        if (data.gender) setGender(data.gender);
        if (data.age) setAge(data.age);
        if (data.height) setHeight(data.height);
        if (data.weight) setWeight(data.weight);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveField = async (fields: any) => {
    setIsSaving(true);
    try {
      await profileService.update(fields);
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, this would be a Supabase Storage upload or a backend upload
      // For this demo, we'll use a local object URL to show immediate feedback
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      // And we'll "save" it (though without backend support it might fail silently or error)
      handleSaveField({ avatar_url: url });
    }
  };

  const bmi = weight / ((height / 100) * (height / 100)) || 0;
  const bmiInfo = getBMICategory(bmi);

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
              <div className="mt-4 w-full max-w-[280px] bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-xl border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
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
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={age}
                        onChange={(e) => setAge(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ age })}
                      />
                      <button onClick={() => handleSaveField({ age })} className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                  {editingField === 'height' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={height}
                        onChange={(e) => setHeight(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ height })}
                      />
                      <span className="text-gray-400 font-bold">cm</span>
                      <button onClick={() => handleSaveField({ height })} className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                  {editingField === 'weight' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        autoFocus
                        className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl p-2 text-center font-bold text-lg outline-none border-2 border-transparent focus:border-primary"
                        value={weight}
                        onChange={(e) => setWeight(parseInt(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveField({ weight })}
                      />
                      <span className="text-gray-400 font-bold">kg</span>
                      <button onClick={() => handleSaveField({ weight })} className="bg-primary text-white p-2 rounded-xl shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">check</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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
      </main>
    </div>
  );
};

export default Profile;