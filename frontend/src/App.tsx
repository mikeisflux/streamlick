import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { BrandingProvider } from './context/BrandingContext';
import { Login } from './pages/Login';
import { VerifyAuth } from './pages/VerifyAuth';
import { VerifyEmail } from './pages/VerifyEmail';
import { Dashboard } from './pages/Dashboard';
import { Studio } from './pages/Studio';
import { GuestJoin } from './pages/GuestJoin';
import { Landing } from './pages/Landing';
import { Billing } from './pages/Billing';
import { Settings } from './pages/Settings';
import { AdminAssets } from './pages/AdminAssets';
import { AdminLogs } from './pages/AdminLogs';
import AdminSettings from './pages/AdminSettings';
import AdminTesting from './pages/AdminTesting';
import { AdminServers } from './pages/AdminServers';
import { AdminInfrastructure } from './pages/AdminInfrastructure';
import { Admin } from './pages/Admin';
import AdminPageManager from './pages/AdminPageManager';
import { AdminUsers } from './pages/AdminUsers';
import { AdminBroadcasts } from './pages/AdminBroadcasts';
import { AdminTemplates } from './pages/AdminTemplates';
import { AdminAnalytics } from './pages/AdminAnalytics';
import { AdminEmails } from './pages/AdminEmails';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { DataDeletion } from './pages/DataDeletion';
import { FAQ } from './pages/FAQ';
import { Analytics } from './pages/Analytics';
import { OAuthSuccess } from './pages/OAuthSuccess';
import { useEffect } from 'react';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
  }));

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrandingProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<VerifyAuth />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/oauth-success" element={<OAuthSuccess />} />
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
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/assets"
          element={
            <AdminRoute>
              <AdminAssets />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <AdminRoute>
              <AdminLogs />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/testing"
          element={
            <AdminRoute>
              <AdminTesting />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/servers"
          element={
            <AdminRoute>
              <AdminServers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/infrastructure"
          element={
            <AdminRoute>
              <AdminInfrastructure />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/pages"
          element={
            <AdminRoute>
              <AdminPageManager />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/broadcasts"
          element={
            <AdminRoute>
              <AdminBroadcasts />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <AdminRoute>
              <AdminTemplates />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <AdminAnalytics />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/emails"
          element={
            <AdminRoute>
              <AdminEmails />
            </AdminRoute>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/faq" element={<FAQ />} />
      </Routes>
    </BrowserRouter>
    </BrandingProvider>
  );
}

export default App;
