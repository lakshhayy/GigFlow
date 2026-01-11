import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, PlusCircle, Briefcase, User as UserIcon, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logoutUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Briefcase className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold text-gray-900">GigFlow</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
              Browse Gigs
            </Link>
            
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <LayoutDashboard className="w-4 h-4 mr-1"/> Dashboard
                </Link>
                <Link 
                  to="/create-gig" 
                  className="bg-primary text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Post a Job
                </Link>
                <div className="relative ml-3 flex items-center">
                   <span className="text-sm font-medium text-gray-700 mr-4">Hi, {user?.name}</span>
                   <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
                     <LogOut className="w-5 h-5" />
                   </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Login
                </Link>
                <Link to="/register" className="bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-md text-sm font-medium">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
