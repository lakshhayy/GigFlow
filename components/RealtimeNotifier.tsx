import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bid } from '../types';
import { X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

export const RealtimeNotifier: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Bid[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Connect to the backend
    // If no URL is provided, it defaults to window.location.host
    // This works perfectly for both:
    // 1. Development (via Vite proxy if configured, otherwise needs explicit URL)
    // 2. Production (when frontend is served by backend)
    // For local dev with separate ports (Vite 5173, Server 5000), we need the explicit URL if not proxied for WS.
    // However, in production, they are same origin.
    const socket = io(process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5000');

    // Join room identified by User ID
    socket.emit('join', user.id);

    // Listen for hiring notifications
    socket.on('notification', (newNotification: Bid) => {
      // Add to list if we haven't seen this ID yet (basic dedup)
      setNotifications(prev => {
        if (prev.some(n => n.id === newNotification.id)) return prev;
        return [...prev, newNotification];
      });
    });

    // Cleanup on unmount or user change
    return () => {
      socket.disconnect();
    };
  }, [user, isAuthenticated]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
      {notifications.map(notification => (
        <div key={notification.id} className="bg-white border-l-4 border-green-500 shadow-lg rounded-md p-4 w-80 animate-slide-up relative">
          <button 
            onClick={() => removeNotification(notification.id)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start">
            <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-gray-900">You're Hired!</h4>
              <p className="text-sm text-gray-600 mt-1">
                Your bid of ${notification.price} was accepted.
              </p>
              <Link 
                to={`/gigs/${notification.gigId}`} 
                onClick={() => removeNotification(notification.id)}
                className="text-xs text-primary font-medium hover:underline mt-2 block"
              >
                View Gig Details
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};