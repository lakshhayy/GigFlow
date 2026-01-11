import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login, Register } from './pages/AuthPages';
import { CreateGig } from './pages/CreateGig';
import { GigDetails } from './pages/GigDetails';
import { Dashboard } from './pages/Dashboard';
import { RealtimeNotifier } from './components/RealtimeNotifier';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <>
      <Navbar />
      <RealtimeNotifier />
      <div className="min-h-screen bg-gray-50 pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/create-gig" 
            element={
              <ProtectedRoute>
                <CreateGig />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/gigs/:id" 
            element={
              <ProtectedRoute>
                <GigDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </>
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
