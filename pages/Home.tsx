import React, { useEffect, useState } from 'react';
import { getGigs } from '../services/mockApi';
import { Gig } from '../types';
import { GigCard } from '../components/GigCard';
import { Search, Loader } from 'lucide-react';

export const Home: React.FC = () => {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadGigs();
  }, []);

  const loadGigs = async (search?: string) => {
    setLoading(true);
    try {
      const data = await getGigs(search);
      setGigs(data);
    } catch (error) {
      console.error('Failed to load gigs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadGigs(searchTerm);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
          Find your next <span className="text-primary">Gig</span>
        </h1>
        <p className="max-w-xl mx-auto mt-5 text-xl text-gray-500">
          Connect with clients and start working on projects you love.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-12">
        <form onSubmit={handleSearch} className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-primary focus:border-primary block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3 bg-white text-gray-900"
            placeholder="Search jobs by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute inset-y-0 right-0 px-4 py-2 bg-primary text-white rounded-r-md hover:bg-indigo-700 text-sm font-medium"
          >
            Search
          </button>
        </form>
      </div>

      {/* Gig Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : gigs.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No open gigs found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} />
          ))}
        </div>
      )}
    </div>
  );
};