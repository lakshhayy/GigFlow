import { User, Gig, Bid, AuthResponse } from '../types';

// --- LocalStorage Helpers (Fallback Mechanism) ---
const DELAY = 500; // Simulate network latency for fallback

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateId = () => Math.random().toString(36).substr(2, 9);

const getLS = <T>(key: string): T[] => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return [];
    const parsed = JSON.parse(item);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn(`Corrupt data in localStorage for key "${key}". Resetting to empty array.`);
    localStorage.removeItem(key);
    return [];
  }
};

const setLS = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Hybrid Request Handler ---
// Tries Fetch first, falls back to LS logic ONLY if Backend is unreachable or returns 5xx
async function requestWithFallback<T>(
  fetchFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<T> {
  try {
    // Try the real backend
    const response = await fetchFn();
    return response;
  } catch (error: any) {
    // If the server responded with a 4xx error (e.g. 400 Bad Request, 401 Unauthorized),
    // it means the server IS running and we should respect its logic decision.
    // Do not fallback to mock data in this case.
    
    // EXCEPTION: If 404, it implies the route is missing. In a hybrid/demo app, 
    // we often want to fallback to the mock implementation if the real API endpoint isn't there yet.
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 404) {
      throw error;
    }

    // Backend unavailable (Network Error), 404 Not Found, or 5xx Server Error.
    console.warn('Backend unavailable, route missing (404), or returned 5xx. Switching to LocalStorage fallback.', error);
    await sleep(DELAY);
    try {
      return await fallbackFn();
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Helper for Fetch requests with Auth Header
const getHeaders = () => {
  const token = localStorage.getItem('gigflow_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  // If we get HTML (e.g. 404 page from Vite proxy fallback), treat as network error
  if (contentType && contentType.indexOf("application/json") === -1) {
    throw new Error("Server returned non-JSON response (likely 404/500)");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    const error: any = new Error(errorData.message || 'Request failed');
    error.status = response.status; // Attach status code for fallback logic
    throw error;
  }
  return response.json();
};

// --- Auth Services ---

export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  return requestWithFallback(
    async () => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      return handleResponse(response);
    },
    async () => {
      const users = getLS<User>('gigflow_users');
      if (users.find(u => u.email === email)) throw new Error('User already exists');
      const newUser: User = { id: generateId(), name, email, password }; 
      setLS('gigflow_users', [...users, newUser]);
      return { user: newUser, token: 'mock-jwt-token-' + newUser.id };
    }
  );
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  return requestWithFallback(
    async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response);
    },
    async () => {
      const users = getLS<User>('gigflow_users');
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid credentials');
      return { user, token: 'mock-jwt-token-' + user.id };
    }
  );
};

// --- Gig Services ---

export const getGigs = async (search?: string): Promise<Gig[]> => {
  return requestWithFallback(
    async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const response = await fetch(`/api/gigs?${params.toString()}`);
      return handleResponse(response);
    },
    async () => {
      let gigs = getLS<Gig>('gigflow_gigs');
      // Seed if empty for demo
      if (gigs.length === 0) {
        gigs = [
          {
            id: '1',
            title: 'Build a React Native App',
            description: 'Looking for an expert to build a delivery app.',
            budget: 5000,
            ownerId: 'demo-owner',
            ownerName: 'Alice Client',
            status: 'open',
            createdAt: new Date().toISOString(),
          }
        ];
        setLS('gigflow_gigs', gigs);
      }
      
      if (search) {
        return gigs.filter(g => g.title.toLowerCase().includes(search.toLowerCase()) && g.status === 'open');
      }
      return gigs.filter(g => g.status === 'open');
    }
  );
};

export const getMyGigs = async (userId: string): Promise<Gig[]> => {
  return requestWithFallback(
    async () => {
      const response = await fetch(`/api/gigs?ownerId=${userId}`);
      return handleResponse(response);
    },
    async () => {
      const gigs = getLS<Gig>('gigflow_gigs');
      return gigs.filter(g => g.ownerId === userId);
    }
  );
};

export const getGigById = async (id: string): Promise<Gig | undefined> => {
  return requestWithFallback(
    async () => {
      const response = await fetch(`/api/gigs/${id}`);
      if (response.status === 404) return undefined;
      return handleResponse(response);
    },
    async () => {
      const gigs = getLS<Gig>('gigflow_gigs');
      return gigs.find(g => g.id === id);
    }
  );
};

export const createGig = async (gigData: Omit<Gig, 'id' | 'createdAt' | 'status'>): Promise<Gig> => {
  return requestWithFallback(
    async () => {
      const response = await fetch('/api/gigs', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(gigData),
      });
      return handleResponse(response);
    },
    async () => {
      const gigs = getLS<Gig>('gigflow_gigs');
      const newGig: Gig = {
        ...gigData,
        id: generateId(),
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      setLS('gigflow_gigs', [newGig, ...gigs]);
      return newGig;
    }
  );
};

// --- Bid Services ---

export const getBidsForGig = async (gigId: string): Promise<Bid[]> => {
  return requestWithFallback(
    async () => {
      const response = await fetch(`/api/bids?gigId=${gigId}`, {
        headers: getHeaders(),
      });
      return handleResponse(response);
    },
    async () => {
      const bids = getLS<Bid>('gigflow_bids');
      return bids.filter(b => b.gigId === gigId);
    }
  );
};

export const getMyBids = async (userId: string): Promise<{ bid: Bid, gig: Gig }[]> => {
  return requestWithFallback(
    async () => {
      const bidsResponse = await fetch(`/api/bids?freelancerId=${userId}`, {
        headers: getHeaders(),
      });
      const bids: Bid[] = await handleResponse(bidsResponse);
      const results = await Promise.all(bids.map(async (bid) => {
        const gig = await getGigById(bid.gigId);
        if (!gig) return null;
        return { bid, gig };
      }));
      return results.filter(Boolean) as { bid: Bid, gig: Gig }[];
    },
    async () => {
      const bids = getLS<Bid>('gigflow_bids');
      const myBids = bids.filter(b => b.freelancerId === userId);
      const gigs = getLS<Gig>('gigflow_gigs');
      
      return myBids.map(bid => {
        const gig = gigs.find(g => g.id === bid.gigId);
        if (!gig) return null;
        return { bid, gig };
      }).filter(Boolean) as { bid: Bid, gig: Gig }[];
    }
  );
};

export const createBid = async (bidData: Omit<Bid, 'id' | 'createdAt' | 'status'>): Promise<Bid> => {
  return requestWithFallback(
    async () => {
      const response = await fetch('/api/bids', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(bidData),
      });
      return handleResponse(response);
    },
    async () => {
      const bids = getLS<Bid>('gigflow_bids');
      const existing = bids.find(b => b.gigId === bidData.gigId && b.freelancerId === bidData.freelancerId);
      if (existing) throw new Error('Already bid on this gig');

      const newBid: Bid = {
        ...bidData,
        id: generateId(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      setLS('gigflow_bids', [...bids, newBid]);
      return newBid;
    }
  );
};

// --- Hiring Logic ---

export const hireFreelancer = async (gigId: string, bidId: string): Promise<void> => {
  return requestWithFallback(
    async () => {
      const response = await fetch('/api/hire', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ gigId, bidId }),
      });
      return handleResponse(response);
    },
    async () => {
      const gigs = getLS<Gig>('gigflow_gigs');
      const bids = getLS<Bid>('gigflow_bids');

      const gigIndex = gigs.findIndex(g => g.id === gigId);
      if (gigIndex === -1) throw new Error('Gig not found');

      // Update Gig Status
      gigs[gigIndex].status = 'assigned';
      setLS('gigflow_gigs', gigs);

      // Update Bids Status
      const updatedBids = bids.map(b => {
        if (b.gigId === gigId) {
          return { ...b, status: b.id === bidId ? 'hired' : 'rejected' } as Bid;
        }
        return b;
      });
      setLS('gigflow_bids', updatedBids);
    }
  );
};

export const checkForNewHires = async (userId: string): Promise<Bid[]> => {
    return [];
};
