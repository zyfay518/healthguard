import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: 'home', label: '首页' },
    { path: '/trends', icon: 'show_chart', label: '趋势' }, // mapped to trends for demo
    { path: '/export', icon: 'description', label: '报告' },
    { path: '/profile', icon: 'person', label: '我的' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-[#1f122b] border-t border-gray-100 dark:border-[#352345] px-6 py-3 flex justify-between items-center pb-safe z-50">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isActive(item.path)
              ? 'text-primary'
              : 'text-gray-400 dark:text-gray-500 hover:text-primary'
          }`}
        >
          <span className={`material-symbols-outlined ${isActive(item.path) ? 'fill-current' : ''}`}>
            {item.icon}
          </span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;