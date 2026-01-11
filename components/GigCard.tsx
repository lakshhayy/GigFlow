import React from 'react';
import { Link } from 'react-router-dom';
import { Gig } from '../types';
import { DollarSign, Clock, User } from 'lucide-react';

interface GigCardProps {
  gig: Gig;
}

export const GigCard: React.FC<GigCardProps> = ({ gig }) => {
  const isAssigned = gig.status === 'assigned';

  return (
    <Link to={`/gigs/${gig.id}`} className="block h-full">
      <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow h-full flex flex-col border border-gray-100">
        <div className="px-4 py-5 sm:p-6 flex-grow">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-medium leading-6 text-gray-900 truncate pr-4">{gig.title}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isAssigned ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
              {gig.status.toUpperCase()}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500 line-clamp-3">
            {gig.description}
          </p>
        </div>
        <div className="bg-gray-50 px-4 py-4 sm:px-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div className="flex items-center">
              <DollarSign className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-900">${gig.budget}</span>
            </div>
            <div className="flex items-center">
               <User className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
               <span>{gig.ownerName}</span>
            </div>
            <div className="flex items-center">
              <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
              <span>{new Date(gig.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
