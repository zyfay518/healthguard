import React, { useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { vitalService, symptomService, profileService } from './services/api';
import { getDeviceId } from './utils/device';

// Lazy load pages for better initial load performance
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Symptoms = lazy(() => import('./pages/Symptoms'));
const RecordVitals = lazy(() => import('./pages/RecordVitals'));
const BMIInfo = lazy(() => import('./pages/BMIInfo'));
const Trends = lazy(() => import('./pages/Trends'));
const ExportReport = lazy(() => import('./pages/ExportReport'));
const DateSelection = lazy(() => import('./pages/DateSelection'));
const AuthPage = lazy(() => import('./pages/auth/AuthPage'));
const BottomNav = lazy(() => import('./components/BottomNav'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 text-sm">加载中...</p>
    </div>
  </div>
);

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

  // Register device on login/app mount
  useEffect(() => {
    if (session) {
      const deviceId = getDeviceId();
      profileService.update({ last_device_id: deviceId }).catch(err => {
        console.warn('Failed to register device ID:', err);
      });
    }
  }, [session]);

  // Inactivity check logic (7 days)
  useEffect(() => {
    if (session) {
      checkInactivity();
      // Update last active timestamp on every meaningful route change
      localStorage.setItem('healthguard_last_active', Date.now().toString());
    }
  }, [session, location.pathname]);

  const checkInactivity = async () => {
    try {
      // Use import.meta.env.PROD for Vite/Vercel production check
      if (!import.meta.env.PROD) return;

      const lastActive = localStorage.getItem('healthguard_last_active');
      if (!lastActive) {
        localStorage.setItem('healthguard_last_active', Date.now().toString());
        return;
      }

      const diffDays = (Date.now() - parseInt(lastActive)) / (1000 * 60 * 60 * 24);

      if (diffDays >= 7) {
        alert('由于您已超过 7 天未登录使用，为了安全起见，请重新登录。');
        await signOut();
      }
    } catch (error) {
      console.warn('Inactivity check failed:', error);
    }
  };

  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
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