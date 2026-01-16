import React, { useState, useRef, useEffect } from 'react';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (time: { hour: number; minute: number }) => void;
    initialTime?: { hour: number; minute: number };
}

const ReminderModal: React.FC<ReminderModalProps> = ({ isOpen, onClose, onSave, initialTime }) => {
    const [selectedHour, setSelectedHour] = useState(initialTime?.hour || 8);
    const [selectedMinute, setSelectedMinute] = useState(initialTime?.minute || 0);
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                hourRef.current?.scrollTo({ top: selectedHour * 40, behavior: 'instant' });
                minuteRef.current?.scrollTo({ top: selectedMinute * 40, behavior: 'instant' });
            }, 100);
        }
    }, [isOpen]);

    const handleScroll = (type: 'hour' | 'minute', ref: React.RefObject<HTMLDivElement>) => {
        if (!ref.current) return;
        const scrollTop = ref.current.scrollTop;
        const index = Math.round(scrollTop / 40);
        if (type === 'hour') {
            if (index !== selectedHour && index >= 0 && index < 24) {
                setSelectedHour(index);
            }
        } else {
            if (index !== selectedMinute && index >= 0 && index < 60) {
                setSelectedMinute(index);
            }
        }
    };

    const handleConfirm = () => {
        onSave({ hour: selectedHour, minute: selectedMinute });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
            <div
                className="w-full max-w-md bg-background-light dark:bg-[#1f122b] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-6 sm:hidden"></div>

                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-[#140c1d] dark:text-white">定时提醒设置</h2>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                    我们将每天在设定时间提醒您记录健康数据
                </p>

                <div className="bg-gray-50 dark:bg-white/5 rounded-[24px] h-48 relative overflow-hidden flex items-center justify-center border border-gray-100 dark:border-white/5 mb-8">
                    <div className="absolute w-[80%] h-12 bg-white dark:bg-white/5 rounded-xl top-1/2 -translate-y-1/2 z-0 pointer-events-none border border-primary/20 shadow-sm"></div>

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
                                onClick={() => hourRef.current?.scrollTo({ top: i * 40, behavior: 'smooth' })}
                                className={`h-10 flex items-center justify-center text-xl snap-center cursor-pointer transition-all
                  ${i === selectedHour ? 'text-2xl font-bold text-primary' : 'text-gray-400 dark:text-gray-500'}`}
                            >
                                {String(i).padStart(2, '0')}
                            </div>
                        ))}
                        <div className="h-[80px]"></div>
                    </div>

                    <div className="text-2xl font-bold text-primary z-10">:</div>

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
                                onClick={() => minuteRef.current?.scrollTo({ top: i * 40, behavior: 'smooth' })}
                                className={`h-10 flex items-center justify-center text-xl snap-center cursor-pointer transition-all
                  ${i === selectedMinute ? 'text-2xl font-bold text-primary' : 'text-gray-400 dark:text-gray-500'}`}
                            >
                                {String(i).padStart(2, '0')}
                            </div>
                        ))}
                        <div className="h-[80px]"></div>
                    </div>

                    <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-gray-50 dark:from-[#1f122b] to-transparent z-20 pointer-events-none"></div>
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-gray-50 dark:from-[#1f122b] to-transparent z-20 pointer-events-none"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleConfirm}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        确认开启
                    </button>
                    <button
                        onClick={() => {
                            localStorage.removeItem('healthguard_reminder');
                            onClose();
                        }}
                        className="w-full bg-transparent text-red-500 font-medium text-sm h-10 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                    >
                        关闭提醒
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReminderModal;
