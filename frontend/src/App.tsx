import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Browse from './pages/Browse';
import SubjectDetail from './pages/SubjectDetail';
import NoteDetail from './pages/NoteDetail';
import UploadNote from './pages/UploadNote';
import GenerateProblems from './pages/GenerateProblems';
import ProblemSetList from './pages/ProblemSetList';
import ProblemSet from './pages/ProblemSet';
import ProblemSetHistory from './pages/ProblemSetHistory';
import NoteAnalytics from './pages/NoteAnalytics';
import Bookmarks from './pages/Bookmarks';
import { Bell } from 'lucide-react';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ToastLayer() {
  const { toasts, dismissToast } = useNotifications();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismissToast(t.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Bell size={16} /> {t.message}
        </div>
      ))}
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      {user && <ToastLayer />}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
        <Route path="/subject/:id" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />
        <Route path="/note/:id" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><UploadNote /></ProtectedRoute>} />
        <Route path="/note/:id/generate-problems" element={<ProtectedRoute><GenerateProblems /></ProtectedRoute>} />
        <Route path="/note/:id/problem-sets" element={<ProtectedRoute><ProblemSetList /></ProtectedRoute>} />
        <Route path="/note/:id/analytics" element={<ProtectedRoute><NoteAnalytics /></ProtectedRoute>} />
        <Route path="/problem-set/:id/take" element={<ProtectedRoute><ProblemSet /></ProtectedRoute>} />
        <Route path="/problem-set/:id/session/:sessionId/history" element={<ProtectedRoute><ProblemSetHistory /></ProtectedRoute>} />
        <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
