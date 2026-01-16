import React from 'react';
import { useNavigate } from 'react-router-dom';

const BMIInfo: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-24 bg-background-light dark:bg-background-dark">
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1f122b] sticky top-0 z-40 border-b border-gray-100 dark:border-[#352345]">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-[#140c1d] dark:text-white">BMI 标准说明</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex flex-col gap-5 p-4">
        <section className="bg-white dark:bg-[#231530] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#352345]">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-xl shrink-0">
              <span className="material-symbols-outlined">info</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#140c1d] dark:text-white mb-2">什么是 BMI?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed text-justify">
                BMI（身体质量指数）是国际上常用的衡量人体胖瘦程度以及是否健康的一个标准。它是通过体重（公斤）除以身高（米）的平方计算得出的。
              </p>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-[#140c1d] dark:text-white">BMI 分类标准</h3>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-[#352345] px-2 py-1 rounded">WHO 标准参考</span>
        </div>

        <div className="flex flex-col gap-3">
          {/* Underweight */}
          <div className="bg-white dark:bg-[#231530] rounded-xl overflow-hidden shadow-sm border border-blue-100 dark:border-blue-900/30 flex relative group">
            <div className="w-1.5 bg-blue-500 absolute left-0 top-0 bottom-0"></div>
            <div className="p-5 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">偏瘦</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">&lt; 18.5</span>
                </div>
                <span className="material-symbols-outlined text-blue-200 dark:text-blue-900/40 text-3xl">sentiment_worried</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">您的体重过轻。建议咨询营养师制定增重计划，摄入富含营养的食物并进行适当的力量训练。</p>
            </div>
          </div>

          {/* Normal */}
          <div className="bg-white dark:bg-[#231530] rounded-xl overflow-hidden shadow-sm border border-green-100 dark:border-green-900/30 flex relative">
            <div className="w-1.5 bg-green-500 absolute left-0 top-0 bottom-0"></div>
            <div className="p-5 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">正常</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">18.5 - 23.9</span>
                </div>
                <span className="material-symbols-outlined text-green-200 dark:text-green-900/40 text-3xl">sentiment_satisfied</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">恭喜！您的体重处于健康范围内。请继续保持均衡饮食和规律运动的生活习惯。</p>
            </div>
          </div>

          {/* Overweight */}
          <div className="bg-white dark:bg-[#231530] rounded-xl overflow-hidden shadow-sm border border-orange-100 dark:border-orange-900/30 flex relative">
            <div className="w-1.5 bg-orange-500 absolute left-0 top-0 bottom-0"></div>
            <div className="p-5 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">过重</span>
                  <span className="text-lg font-bold text-orange-600 dark:text-orange-400">24.0 - 27.9</span>
                </div>
                <span className="material-symbols-outlined text-orange-200 dark:text-orange-900/40 text-3xl">sentiment_neutral</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">您的体重略微超标。建议适当控制饮食热量，增加有氧运动量，以防发展为肥胖。</p>
            </div>
          </div>

          {/* Obese */}
          <div className="bg-white dark:bg-[#231530] rounded-xl overflow-hidden shadow-sm border border-red-100 dark:border-red-900/30 flex relative">
            <div className="w-1.5 bg-red-500 absolute left-0 top-0 bottom-0"></div>
            <div className="p-5 w-full">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">肥胖</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">≥ 28.0</span>
                </div>
                <span className="material-symbols-outlined text-red-200 dark:text-red-900/40 text-3xl">sentiment_very_dissatisfied</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">您的体重已达到肥胖标准，患心血管疾病风险较高。强烈建议寻求医生帮助，制定科学减重方案。</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 mt-2">
          <h3 className="font-bold text-[#140c1d] dark:text-white">标准体重参考表</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">height</span> 基于身高
          </span>
        </div>

        <div className="bg-white dark:bg-[#231530] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#352345]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="pb-2 border-b border-gray-100 dark:border-[#352345] font-bold text-gray-400 text-xs uppercase tracking-wider pl-2">身高 (cm)</div>
            <div className="pb-2 border-b border-gray-100 dark:border-[#352345] font-bold text-gray-400 text-xs uppercase tracking-wider text-right pr-2">正常体重范围 (kg)</div>
            
            {[
              { h: 150, w: '41.6 - 53.8' },
              { h: 155, w: '44.4 - 57.4' },
              { h: 160, w: '47.4 - 61.2' },
              { h: 165, w: '50.4 - 65.1' },
              { h: 170, w: '53.5 - 69.1' },
              { h: 175, w: '56.7 - 73.2' },
              { h: 180, w: '60.0 - 77.4' },
              { h: 185, w: '63.3 - 81.8' },
            ].map((row, idx) => (
              <React.Fragment key={row.h}>
                <div className={`py-2 pl-2 text-gray-700 dark:text-gray-200 font-medium ${idx % 2 !== 0 ? 'bg-gray-50 dark:bg-[#2a1d36] rounded-lg -mx-2 px-4' : ''}`}>{row.h}</div>
                <div className={`py-2 pr-2 text-gray-700 dark:text-gray-200 text-right font-mono ${idx % 2 !== 0 ? 'bg-gray-50 dark:bg-[#2a1d36] rounded-lg -mx-2 px-4' : ''}`}>{row.w}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default BMIInfo;