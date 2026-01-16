import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Symptoms from './pages/Symptoms';
import RecordVitals from './pages/RecordVitals';
import BMIInfo from './pages/BMIInfo';
import Trends from './pages/Trends';
import ExportReport from './pages/ExportReport';
import DateSelection from './pages/DateSelection';
import AuthPage from './pages/auth/AuthPage';
import BottomNav from './components/BottomNav';
import { vitalService, symptomService } from './services/api';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const { session, signOut } = useAuth();

  // Hide bottom nav on specific full-screen interaction pages or if not logged in
  const hideNavRoutes = ['/record', '/symptoms', '/date-select', '/bmi-info', '/auth'];
  const showNav = session && !hideNavRoutes.includes(location.pathname);

  // Inactivity check logic (7 days)
  useEffect(() => {
    if (session) {
      checkInactivity();
    }
  }, [session, location.pathname]);

  const checkInactivity = async () => {
    try {
      const [vitals, symptoms] = await Promise.all([
        vitalService.getAll(),
        symptomService.getAll()
      ]);

      const latestDates = [
        ...vitals.map((v: any) => new Date(v.recorded_at).getTime()),
        ...symptoms.map((s: any) => new Date(s.created_at || s.recorded_at).getTime())
      ].filter(t => !isNaN(t));

      if (latestDates.length === 0) return; // No data yet, don't logout

      const latestTime = Math.max(...latestDates);
      const diffDays = (Date.now() - latestTime) / (1000 * 60 * 60 * 24);

      if (diffDays >= 7) {
        alert('由于您已连续 7 天未记录任何健康数据，为了安全起见，请重新登录。');
        await signOut();
      }
    } catch (error) {
      console.error('Failed to check inactivity:', error);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden">
      <div className={`flex-1 overflow-y-auto no-scrollbar ${showNav ? 'pb-20' : ''}`}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/symptoms" element={<ProtectedRoute><Symptoms /></ProtectedRoute>} />
          <Route path="/record" element={<ProtectedRoute><RecordVitals /></ProtectedRoute>} />
          <Route path="/bmi-info" element={<ProtectedRoute><BMIInfo /></ProtectedRoute>} />
          <Route path="/trends" element={<ProtectedRoute><Trends /></ProtectedRoute>} />
          <Route path="/export" element={<ProtectedRoute><ExportReport /></ProtectedRoute>} />
          <Route path="/date-select" element={<ProtectedRoute><DateSelection /></ProtectedRoute>} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;