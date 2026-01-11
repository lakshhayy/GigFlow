import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyBids } from '../services/mockApi'; // Using the API service
import { Bid } from '../types';
import { X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RealtimeNotifier: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Bid[]>([]);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkHires = async () => {
      try {
        // Fetch fresh bids from server
        const myBidsWithGigs = await getMyBids(user.id);
        
        // Filter for hired bids
        const hiredBids = myBidsWithGigs
          .map(item => item.bid)
          .filter(b => b.status === 'hired');

        const newNotifications = hiredBids.filter(b => !notifiedIds.has(b.id));

        if (newNotifications.length > 0) {
          setNotifications(prev => [...prev, ...newNotifications]);
          setNotifiedIds(prev => {
            const next = new Set(prev);
            newNotifications.forEach(n => next.add(n.id));
            return next;
          });
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    const interval = setInterval(checkHires, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [user, isAuthenticated, notifiedIds]);

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
              <Link to={`/gigs/${notification.gigId}`} className="text-xs text-primary font-medium hover:underline mt-2 block">
                View Gig Details
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
