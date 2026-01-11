import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGigById, getBidsForGig, createBid, hireFreelancer } from '../services/mockApi';
import { Gig, Bid } from '../types';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Clock, User, Briefcase, CheckCircle, XCircle } from 'lucide-react';

export const GigDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gig, setGig] = useState<Gig | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Bid Form State
  const [bidMessage, setBidMessage] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState('');

  // Hiring State
  const [isHiring, setIsHiring] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (gigId: string) => {
    setLoading(true);
    try {
      const gigData = await getGigById(gigId);
      if (!gigData) {
        navigate('/'); // Redirect if not found
        return;
      }
      setGig(gigData);

      // Load bids if owner
      if (user && gigData.ownerId === user.id) {
        const bidsData = await getBidsForGig(gigId);
        setBids(bidsData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !gig) return;

    setIsSubmittingBid(true);
    setBidError('');
    try {
      await createBid({
        gigId: gig.id,
        freelancerId: user.id,
        freelancerName: user.name,
        message: bidMessage,
        price: Number(bidPrice),
      });
      alert('Bid submitted successfully!');
      setBidMessage('');
      setBidPrice('');
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleHire = async (bidId: string) => {
    if (!gig || isHiring) return;
    if (!window.confirm("Are you sure you want to hire this freelancer? This will reject all other bids.")) return;

    setIsHiring(true);
    try {
      await hireFreelancer(gig.id, bidId);
      // Refresh data
      await loadData(gig.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsHiring(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">Loading...</div>;
  if (!gig) return null;

  const isOwner = user?.id === gig.ownerId;
  const isAssigned = gig.status === 'assigned';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl leading-6 font-bold text-gray-900">{gig.title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Posted by {gig.ownerName}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${isAssigned ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
            {gig.status.toUpperCase()}
          </span>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Briefcase className="w-4 h-4 mr-2" /> Description
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{gig.description}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <DollarSign className="w-4 h-4 mr-2" /> Budget
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 text-xl font-semibold">${gig.budget}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Posted On
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{new Date(gig.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Owner View: List of Bids */}
      {isOwner && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Received Bids ({bids.length})</h3>
          {bids.length === 0 ? (
            <p className="text-gray-500 bg-white p-6 rounded-lg shadow">No bids yet.</p>
          ) : (
            <div className="grid gap-4">
              {bids.map(bid => (
                <div key={bid.id} className={`bg-white shadow rounded-lg p-6 border-l-4 ${
                  bid.status === 'hired' ? 'border-green-500' : bid.status === 'rejected' ? 'border-red-300 opacity-75' : 'border-yellow-400'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-gray-900 mr-2">{bid.freelancerName}</span>
                        {bid.status === 'hired' && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold">HIRED</span>}
                        {bid.status === 'rejected' && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">REJECTED</span>}
                      </div>
                      <p className="text-gray-600 mt-2">{bid.message}</p>
                      <p className="text-sm text-gray-400 mt-2">Bid: ${bid.price}</p>
                    </div>
                    {gig.status === 'open' && bid.status === 'pending' && (
                      <button
                        onClick={() => handleHire(bid.id)}
                        disabled={isHiring}
                        className="bg-primary hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-colors"
                      >
                        Hire Now
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Freelancer View: Bid Form */}
      {!isOwner && user && gig.status === 'open' && (
        <div className="bg-white shadow sm:rounded-lg p-6 border border-gray-100">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Submit a Bid</h3>
          {bidError && <p className="text-red-600 mb-4">{bidError}</p>}
          <form onSubmit={handleBidSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Proposal Message</label>
              <textarea
                rows={3}
                required
                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border bg-white text-gray-900"
                placeholder="Why are you a good fit?"
                value={bidMessage}
                onChange={e => setBidMessage(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Your Price ($)</label>
              <input
                type="number"
                required
                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md p-2 border bg-white text-gray-900"
                placeholder="0.00"
                value={bidPrice}
                onChange={e => setBidPrice(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmittingBid}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary ${isSubmittingBid ? 'opacity-70' : ''}`}
            >
              {isSubmittingBid ? 'Submitting...' : 'Send Bid'}
            </button>
          </form>
        </div>
      )}

      {/* Closed State for Non-Owners */}
      {!isOwner && gig.status !== 'open' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">This gig is closed</h3>
          <p className="text-gray-500 mt-2">A freelancer has already been hired for this project.</p>
        </div>
      )}
    </div>
  );
};