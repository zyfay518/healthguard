import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { vitalService, symptomService } from '../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const ExportReport: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'custom'>((searchParams.get('range') as any) || '30days');

  const [vitals, setVitals] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedData, setSelectedData] = useState({
    bp: true,
    hr: true,
    symptoms: true
  });

  // Calculate preset dates
  const dates = useMemo(() => {
    const today = new Date();
    const last7Start = new Date();
    last7Start.setDate(today.getDate() - 6);
    const last30Start = new Date();
    last30Start.setDate(today.getDate() - 29);

    let currentStart = last30Start;
    let currentEnd = today;

    if (timeRange === '7days') {
      currentStart = last7Start;
    } else if (timeRange === 'custom') {
      const s = searchParams.get('start');
      const e = searchParams.get('end');
      if (s && e) {
        currentStart = new Date(s);
        currentEnd = new Date(e);
      }
    }

    return {
      today,
      last7Start,
      last30Start,
      currentStart,
      currentEnd
    };
  }, [timeRange, searchParams]);

  useEffect(() => {
    const range = searchParams.get('range');
    if (range === '7days' || range === '30days' || range === 'custom') {
      setTimeRange(range as any);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vData, sData] = await Promise.all([
        vitalService.getAll(),
        symptomService.getAll()
      ]);
      setVitals(vData);
      setSymptoms(sData);
    } catch (error) {
      console.error('Failed to load data for export', error);
    }
  };

  const filteredData = useMemo(() => {
    const start = dates.currentStart;
    start.setHours(0, 0, 0, 0);
    const end = new Date(dates.currentEnd);
    end.setHours(23, 59, 59, 999);

    const vFiltered = vitals.filter(v => {
      const d = new Date(v.recorded_at);
      return d >= start && d <= end;
    });

    const sFiltered = symptoms.filter(s => {
      const d = new Date(s.created_at);
      return d >= start && d <= end;
    });

    return {
      vitals: vFiltered,
      symptoms: sFiltered
    };
  }, [vitals, symptoms, dates]);

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}.${date.getDate()}`;
  };

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  };

  const allSelected = Object.values(selectedData).every(Boolean);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedData({ bp: false, hr: false, symptoms: false });
    } else {
      setSelectedData({ bp: true, hr: true, symptoms: true });
    }
  };

  const toggleItem = (key: keyof typeof selectedData) => {
    setSelectedData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    setIsGenerating(true);
    try {
      // 1. Prepare Data
      const allData: any[] = [];

      if (selectedData.bp) {
        filteredData.vitals.forEach(v => {
          allData.push({
            time: new Date(v.recorded_at),
            type: '血压/心率',
            value: `${v.systolic}/${v.diastolic} mmHg`,
            heartRate: `${v.heart_rate} bpm`,
            note: '-'
          });
        });
      }

      if (selectedData.symptoms) {
        filteredData.symptoms.forEach(s => {
          allData.push({
            time: new Date(s.created_at),
            type: '身体状况',
            value: Array.isArray(s.symptoms) ? s.symptoms.join(', ') : (s.symptom_name || s.symptom_id || '-'),
            heartRate: '-',
            note: s.note || '-'
          });
        });
      }

      // Sort by time descending
      allData.sort((a, b) => b.time.getTime() - a.time.getTime());

      const fileName = `健康报告_${formatDateFull(dates.currentStart)}_至_${formatDateFull(dates.currentEnd)}`;

      if (format === 'pdf') {
        const printElement = document.getElementById('print-area');
        if (!printElement) throw new Error('Print area not found');

        printElement.style.display = 'block';

        const canvas = await html2canvas(printElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        printElement.style.display = 'none';

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // At scale 2, we need to handle the canvas pixels correctly.
        // A4 ratio is ~1.414.
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Add more pages if content exceeds A4 height
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`${fileName}.pdf`);
      } else {
        // CSV Generation with BOM
        const headers = ['时间', '类型', '数值', '心率', '备注'];
        const csvRows = [
          headers.join(','),
          ...allData.map(item => [
            `"${item.time.toLocaleString('zh-CN')}"`,
            `"${item.type}"`,
            `"${item.value}"`,
            `"${item.heartRate}"`,
            `"${item.note}"`
          ].join(','))
        ];

        const csvContent = "\uFEFF" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${fileName}.csv`);
        link.click();
      }

      setTimeout(() => {
        alert('报告已成功生成并尝试下载！');
      }, 500);

    } catch (error) {
      console.error('Export failed:', error);
      alert('生成报告失败，请重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const getRangeClasses = (range: string) => {
    const isSelected = timeRange === range;
    const baseClasses = "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all h-24 cursor-pointer";
    if (isSelected) {
      return `${baseClasses} bg-primary text-white shadow-lg shadow-primary/20 ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark`;
    }
    return `${baseClasses} bg-white dark:bg-[#231530] border border-transparent hover:border-gray-200 dark:hover:border-[#352345] group`;
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col pb-64 bg-background-light dark:bg-background-dark">
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <button onClick={() => navigate('/')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors -ml-2">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-wide">导出健康报告</h1>
        <div className="size-10"></div>
      </header>

      <main className="flex flex-col gap-8 px-5 pt-2">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">时间范围</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTimeRange('7days')}
              className={getRangeClasses('7days')}
            >
              <span className={`text-sm mb-1 ${timeRange === '7days' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>最近 7 天</span>
              <span className={`text-xs font-bold leading-tight ${timeRange === '7days' ? 'text-white' : 'text-[#140c1d] dark:text-white'}`}>
                {formatDate(dates.last7Start)} - {formatDate(dates.today)}
              </span>
              <div className={`absolute top-2 right-2 transition-opacity ${timeRange === '7days' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className={`material-symbols-outlined text-[18px] ${timeRange === '7days' ? 'text-white' : 'text-gray-300'}`}>
                  {timeRange === '7days' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </div>
            </button>

            <button
              onClick={() => setTimeRange('30days')}
              className={getRangeClasses('30days')}
            >
              <span className={`text-sm mb-1 ${timeRange === '30days' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>最近 30 天</span>
              <span className={`text-xs font-bold leading-tight ${timeRange === '30days' ? 'text-white' : 'text-[#140c1d] dark:text-white'}`}>
                {formatDate(dates.last30Start)} - {formatDate(dates.today)}
              </span>
              <div className={`absolute top-2 right-2 transition-opacity ${timeRange === '30days' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className={`material-symbols-outlined text-[18px] ${timeRange === '30days' ? 'text-white' : 'text-gray-300'}`}>
                  {timeRange === '30days' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </div>
            </button>

            <button
              onClick={() => navigate('/date-select?from=export')}
              className={getRangeClasses('custom')}
            >
              <span className={`material-symbols-outlined mb-1 text-[24px] ${timeRange === 'custom' ? 'text-white' : 'text-primary'}`}>calendar_month</span>
              <span className={`text-sm font-bold ${timeRange === 'custom' ? 'text-white' : 'text-[#140c1d] dark:text-white'}`}>
                {timeRange === 'custom' ? `${formatDate(dates.currentStart)} - ${formatDate(dates.currentEnd)}` : '自定义'}
              </span>
              <div className={`absolute top-2 right-2 transition-opacity ${timeRange === 'custom' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <span className={`material-symbols-outlined text-[18px] ${timeRange === 'custom' ? 'text-white' : 'text-gray-300'}`}>
                  {timeRange === 'custom' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </div>
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">选择数据</h2>
            <button onClick={toggleSelectAll} className="text-primary text-sm font-medium hover:underline">全选</button>
          </div>
          <div className="flex flex-col gap-3">
            <label
              className={`flex items-center justify-between p-4 bg-white dark:bg-[#231530] rounded-xl border-2 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a1d36] transition-colors ${selectedData.bp ? 'border-primary/20' : 'border-transparent'}`}
              onClick={() => toggleItem('bp')}
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                  <span className="material-symbols-outlined text-[20px]">favorite</span>
                </div>
                <div>
                  <p className="font-bold text-[#140c1d] dark:text-white">血压与心率</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{filteredData.vitals.length} 条记录</p>
                </div>
              </div>
              <div className={selectedData.bp ? "text-primary" : "text-gray-300 dark:text-gray-600"}>
                <span className="material-symbols-outlined text-[24px]">{selectedData.bp ? 'check_box' : 'check_box_outline_blank'}</span>
              </div>
            </label>

            <label
              className={`flex items-center justify-between p-4 bg-white dark:bg-[#231530] rounded-xl border-2 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a1d36] transition-colors ${selectedData.symptoms ? 'border-primary/20' : 'border-transparent'}`}
              onClick={() => toggleItem('symptoms')}
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
                  <span className="material-symbols-outlined text-[20px]">healing</span>
                </div>
                <div>
                  <p className="font-bold text-[#140c1d] dark:text-white">身体症状</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{filteredData.symptoms.length} 条记录</p>
                </div>
              </div>
              <div className={selectedData.symptoms ? "text-primary" : "text-gray-300 dark:text-gray-600"}>
                <span className="material-symbols-outlined text-[24px]">{selectedData.symptoms ? 'check_box' : 'check_box_outline_blank'}</span>
              </div>
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">导出格式</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setFormat('pdf')}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl ${format === 'pdf' ? 'bg-white dark:bg-[#231530] border-2 border-primary' : 'bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345]'} shadow-sm active:scale-[0.98] transition-all`}
            >
              <div className="size-12 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-[28px]">picture_as_pdf</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-[#140c1d] dark:text-white">PDF 文档</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">适合打印与分享</span>
              </div>
              <div className={`absolute top-3 right-3 ${format === 'pdf' ? 'text-primary' : 'text-gray-200'}`}>
                <span className="material-symbols-outlined text-[20px] fill-current">{format === 'pdf' ? 'check_circle' : 'radio_button_unchecked'}</span>
              </div>
            </button>
            <button
              onClick={() => setFormat('excel')}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl ${format === 'excel' ? 'bg-white dark:bg-[#231530] border-2 border-primary' : 'bg-white dark:bg-[#231530] border border-gray-100 dark:border-[#352345]'} shadow-sm active:scale-[0.98] transition-all`}
            >
              <div className="size-12 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center mb-1">
                <span className="material-symbols-outlined text-[28px]">table_view</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-[#140c1d] dark:text-white">Excel 表格</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">适合数据分析</span>
              </div>
              <div className={`absolute top-3 right-3 ${format === 'excel' ? 'text-primary' : 'text-gray-200'}`}>
                <span className="material-symbols-outlined text-[20px] fill-current">{format === 'excel' ? 'check_circle' : 'radio_button_unchecked'}</span>
              </div>
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto p-4 bg-white/90 dark:bg-[#1f122b]/90 backdrop-blur-md border-t border-gray-100 dark:border-[#352345] z-50">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">预计文件大小</p>
          <p className="text-sm font-bold text-[#140c1d] dark:text-white">2.4 MB</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isGenerating || (!selectedData.bp && !selectedData.symptoms)}
          className="w-full flex items-center justify-center gap-2 bg-primary disabled:bg-gray-300 hover:bg-primary/90 text-white rounded-xl py-4 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">{isGenerating ? 'hourglass_empty' : 'ios_share'}</span>
          <span className="text-lg font-bold tracking-wide">{isGenerating ? '生成中...' : '生成并导出'}</span>
        </button>
      </div>

      {/* Hidden area for PDF generation */}
      <div
        id="print-area"
        style={{
          display: 'none',
          width: '800px',
          padding: '40px',
          backgroundColor: '#fff',
          color: '#000',
          fontFamily: 'sans-serif'
        }}
      >
        <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>健康报告 (HealthGuard)</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          报告周期: {formatDateFull(dates.currentStart)} 至 {formatDateFull(dates.currentEnd)}<br />
          生成时间: {new Date().toLocaleString('zh-CN')}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>时间</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>类型</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>数据/症状</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>心率</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>备注</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Prepare sorted data specifically for the hidden table
              const tableData: any[] = [];
              if (selectedData.bp) {
                filteredData.vitals.forEach(v => {
                  tableData.push({
                    time: new Date(v.recorded_at),
                    type: '血压/心率',
                    value: `${v.systolic}/${v.diastolic} mmHg`,
                    heartRate: `${v.heart_rate} bpm`,
                    note: '-'
                  });
                });
              }
              if (selectedData.symptoms) {
                filteredData.symptoms.forEach(s => {
                  tableData.push({
                    time: new Date(s.created_at),
                    type: '身体状况',
                    value: Array.isArray(s.symptoms) ? s.symptoms.join(', ') : (s.symptom_name || s.symptom_id || '-'),
                    heartRate: '-',
                    note: s.note || '-'
                  });
                });
              }
              tableData.sort((a, b) => b.time.getTime() - a.time.getTime());

              return tableData.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '15px 10px', border: '1px solid #ddd', fontSize: '12px' }}>{item.time.toLocaleString('zh-CN')}</td>
                  <td style={{ padding: '15px 10px', border: '1px solid #ddd', fontSize: '12px' }}>{item.type}</td>
                  <td style={{ padding: '15px 10px', border: '1px solid #ddd', fontSize: '12px' }}>{item.value}</td>
                  <td style={{ padding: '15px 10px', border: '1px solid #ddd', fontSize: '12px' }}>{item.heartRate}</td>
                  <td style={{ padding: '15px 10px', border: '1px solid #ddd', fontSize: '12px' }}>{item.note}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExportReport;