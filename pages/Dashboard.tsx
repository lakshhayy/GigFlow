import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyGigs, getMyBids } from '../services/mockApi';
import { Gig, Bid } from '../types';
import { Link } from 'react-router-dom';
import { Briefcase, List } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [myBids, setMyBids] = useState<{ bid: Bid, gig: Gig }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      Promise.all([getMyGigs(user.id), getMyBids(user.id)])
        .then(([gigsData, bidsData]) => {
          setMyGigs(gigsData);
          setMyBids(bidsData);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) return <div className="p-12 text-center">Loading dashboard...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Dashboard</h1>

      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Briefcase className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Posted Gigs</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{myGigs.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <List className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Bids</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{myBids.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My Posted Gigs */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Gigs I Posted</h3>
          </div>
          <ul className="divide-y divide-gray-200">
            {myGigs.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-sm">You haven't posted any gigs yet.</li>
            ) : (
              myGigs.map((gig) => (
                <li key={gig.id}>
                  <Link to={`/gigs/${gig.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary truncate">{gig.title}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${gig.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {gig.status.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            Budget: ${gig.budget}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* My Bids */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
           <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">My Bids</h3>
          </div>
          <ul className="divide-y divide-gray-200">
             {myBids.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-sm">You haven't bid on any gigs yet.</li>
            ) : (
              myBids.map(({ bid, gig }) => (
                <li key={bid.id}>
                  <Link to={`/gigs/${gig.id}`} className="block hover:bg-gray-50">
                     <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-primary truncate">Re: {gig.title}</p>
                        <div className="ml-2 flex-shrink-0 flex">
                           <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                             bid.status === 'hired' ? 'bg-green-100 text-green-800' : 
                             bid.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                             'bg-yellow-100 text-yellow-800'
                           }`}>
                            {bid.status.toUpperCase()}
                          </p>
                        </div>
                      </div>
                       <div className="mt-2 flex justify-between">
                          <p className="text-sm text-gray-500">My Bid: ${bid.price}</p>
                       </div>
                    </div>
                  </Link>
                </li>
              ))
             )}
          </ul>
        </div>
      </div>
    </div>
  );
};
