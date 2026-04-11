import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VMDetail from './pages/VMDetail';
import Console from './pages/Console';
import Admin from './pages/Admin';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Navbar />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vm/:node/:type/:vmid" element={<VMDetail />} />
                <Route path="/console/:node/:type/:vmid" element={<Console />} />
                {isAdmin && <Route path="/admin" element={<Admin />} />}
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
