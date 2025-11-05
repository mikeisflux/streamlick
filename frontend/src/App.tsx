import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { Login } from './pages/Login';
import { VerifyAuth } from './pages/VerifyAuth';
import { Dashboard } from './pages/Dashboard';
import { StudioEnhanced as Studio } from './pages/StudioEnhanced';
import { GuestJoin } from './pages/GuestJoin';
import { Landing } from './pages/Landing';
import { Billing } from './pages/Billing';
import { Settings } from './pages/Settings';
import { AdminAssets } from './pages/AdminAssets';
import { AdminLogs } from './pages/AdminLogs';
import AdminSettings from './pages/AdminSettings';
import AdminTesting from './pages/AdminTesting';
import { AdminServers } from './pages/AdminServers';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { FAQ } from './pages/FAQ';
import { Analytics } from './pages/Analytics';
import { useEffect } from 'react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/verify" element={<VerifyAuth />} />
        <Route path="/join/:token" element={<GuestJoin />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/studio/:broadcastId"
          element={
            <PrivateRoute>
              <Studio />
            </PrivateRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <PrivateRoute>
              <Billing />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <PrivateRoute>
              <Analytics />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/assets"
          element={
            <PrivateRoute>
              <AdminAssets />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <PrivateRoute>
              <AdminLogs />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrivateRoute>
              <AdminSettings />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/testing"
          element={
            <PrivateRoute>
              <AdminTesting />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/servers"
          element={
            <PrivateRoute>
              <AdminServers />
            </PrivateRoute>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
