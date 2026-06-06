import React from 'react';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    isEnabled: boolean;
    isSaving: boolean;
    permissionStatus: NotificationPermission | 'unsupported';
    setupMessage?: string;
    onEnable: () => void;
    onDisable: () => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({ isOpen, onClose, isEnabled, isSaving, permissionStatus, setupMessage, onEnable, onDisable }) => {
    if (!isOpen) return null;

    const permissionDenied = permissionStatus === 'denied';
    const unsupported = permissionStatus === 'unsupported';
    const primaryLabel = isEnabled
        ? '智能提醒已开启'
        : isSaving
            ? '正在开启...'
            : permissionDenied
                ? '我已开启，重新检测'
                : '开启智能提醒';

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300">
            <div
                className="w-full max-w-md bg-background-light dark:bg-[#1f122b] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-6 sm:hidden"></div>

                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold text-[#140c1d] dark:text-white">智能提醒</h2>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="bg-gray-50 dark:bg-white/5 rounded-[24px] p-5 border border-gray-100 dark:border-white/5 mb-6">
                    <div className={`size-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${permissionDenied ? 'bg-orange-50 text-orange-500 dark:bg-orange-900/20' : unsupported ? 'bg-gray-100 text-gray-400 dark:bg-white/5' : 'bg-primary/10 text-primary'}`}>
                        <span className="material-symbols-outlined text-[30px]">{permissionDenied ? 'notifications_off' : 'notifications_active'}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                        {permissionDenied
                            ? '当前设备已关闭通知权限，需要先在系统设置里允许通知。'
                            : unsupported
                                ? '当前浏览器暂不支持推送通知。'
                                : '开启后，我们会根据您最近几天的记录习惯，在常用记录时间过后仍未打卡时发送提醒。'}
                    </p>
                    <p className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
                        {permissionDenied
                            ? 'iPhone：设置 → 通知 → 找到此应用 → 打开允许通知。Android：长按应用图标 → 应用信息 → 通知。'
                            : 'iOS/Android 需要通过主屏幕图标打开应用，并允许通知权限。'}
                    </p>
                    {setupMessage && (
                        <p className="mt-3 text-xs text-orange-500 dark:text-orange-300 text-center leading-relaxed">
                            {setupMessage}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={onEnable}
                        disabled={isSaving || isEnabled || unsupported}
                        className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-lg h-14 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    >
                        {primaryLabel}
                    </button>
                    <button
                        onClick={onDisable}
                        disabled={isSaving || !isEnabled}
                        className="w-full bg-transparent text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed font-medium text-sm h-10 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/5 transition-colors"
                    >
                        {isSaving ? '正在处理...' : '关闭提醒'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReminderModal;
