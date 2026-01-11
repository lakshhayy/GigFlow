import { User, Gig, Bid, AuthResponse } from '../types';

// --- LocalStorage Helpers (Fallback Mechanism) ---
const DELAY = 200; // Reduced latency for better UX during fallback

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

// --- HTTP Helpers ---

// Circuit Breaker State
let isBackendOffline = false;

// Wrapper to prevent hanging requests if backend is unresponsive
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 1000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Helper for Fetch requests
// We no longer manually send Authorization header; browser sends Cookie automatically via credentials: 'include'
const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  };
};

const handleResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") === -1) {
    throw new Error("Server returned non-JSON response (likely 404/500)");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText || 'Request failed' }));
    const error: any = new Error(errorData.message || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// --- Hybrid Request Handler ---
async function requestWithFallback<T>(
  fetchFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<T> {
  // 1. Circuit Breaker: If we already detected backend is down, skip network entirely
  if (isBackendOffline) {
    return fallbackFn();
  }

  try {
    // Try the real backend
    const response = await fetchFn();
    return response;
  } catch (error: any) {
    // 2. Error Analysis
    
    // If it's a 4xx client error (e.g., 400 Bad Request, 401 Unauthorized), 
    // it means the server IS working but rejected the request. Do NOT fallback.
    // Exception: 404 might mean the route is missing (e.g. backend not fully set up), so we fallback.
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 404) {
      throw error;
    }

    // 3. Detect Offline/Down State
    // Conditions: Timeout (AbortError), Network Error (TypeError), 404 (Route missing), or 5xx (Server Error)
    const isNetworkError = error.name === 'AbortError' || error.name === 'TypeError' || error.message.includes('non-JSON');
    const isServerError = error.status && (error.status >= 500 || error.status === 404);

    if (isNetworkError || isServerError) {
      if (!isBackendOffline) {
        console.warn('Backend unavailable (Timeout/5xx/404). Switching to Offline Mode.');
        isBackendOffline = true;
      }
    }
    
    // 4. Execute Fallback
    await sleep(DELAY);
    try {
      return await fallbackFn();
    } catch (fallbackError: any) {
      // Suppress logging for expected auth failures in fallback mode (e.g. not logged in)
      if (fallbackError.message !== 'No session') {
        console.error('Fallback also failed:', fallbackError);
      }
      throw fallbackError;
    }
  }
}

// --- Auth Services ---

export const checkSession = async (): Promise<AuthResponse> => {
  return requestWithFallback(
    async () => {
      const response = await fetchWithTimeout('/api/auth/me', {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // Important: Sends the HttpOnly cookie
      });
      return handleResponse(response);
    },
    async () => {
      // Fallback: check if we have a "mock session" in LS
      const sessionUser = localStorage.getItem('gigflow_session_user');
      if (!sessionUser) throw new Error('No session');
      return { user: JSON.parse(sessionUser) };
    }
  );
};

export const register = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  return requestWithFallback(
    async () => {
      const response = await fetchWithTimeout('/api/auth/register', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      return handleResponse(response);
    },
    async () => {
      const users = getLS<User>('gigflow_users');
      if (users.find(u => u.email === email)) throw new Error('User already exists');
      const newUser: User = { id: generateId(), name, email, password }; 
      setLS('gigflow_users', [...users, newUser]);
      
      // Set mock session
      localStorage.setItem('gigflow_session_user', JSON.stringify(newUser));
      return { user: newUser };
    }
  );
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  return requestWithFallback(
    async () => {
      const response = await fetchWithTimeout('/api/auth/login', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response);
    },
    async () => {
      const users = getLS<User>('gigflow_users');
      
      // --- DEMO ACCOUNT LOGIC ---
      // This ensures you can login immediately without creating an account
      if (email === 'demo@gigflow.com' && password === 'password') {
         const demoUser: User = { 
           id: 'demo-owner', 
           name: 'Alice Client', 
           email: 'demo@gigflow.com' 
         };
         // Auto-save to users list if not there, to keep things consistent
         if (!users.find(u => u.email === email)) {
             setLS('gigflow_users', [...users, { ...demoUser, password: 'password' }]);
         }
         localStorage.setItem('gigflow_session_user', JSON.stringify(demoUser));
         return { user: demoUser };
      }
      // ---------------------------

      const user = users.find(u => u.email === email && u.password === password);
      if (!user) throw new Error('Invalid credentials');
      
      // Set mock session
      localStorage.setItem('gigflow_session_user', JSON.stringify(user));
      return { user };
    }
  );
};

export const logout = async (): Promise<void> => {
  return requestWithFallback(
    async () => {
      await fetchWithTimeout('/api/auth/logout', {
         method: 'POST',
         headers: getHeaders(),
         credentials: 'include'
      });
    },
    async () => {
      localStorage.removeItem('gigflow_session_user');
    }
  )
}

// --- Gig Services ---

export const getGigs = async (search?: string): Promise<Gig[]> => {
  return requestWithFallback(
    async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const response = await fetchWithTimeout(`/api/gigs?${params.toString()}`, {
         headers: getHeaders(),
         credentials: 'include'
      });
      return handleResponse(response);
    },
    async () => {
      let gigs = getLS<Gig>('gigflow_gigs');
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
      const response = await fetchWithTimeout(`/api/gigs?ownerId=${userId}`, {
         headers: getHeaders(),
         credentials: 'include'
      });
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
      const response = await fetchWithTimeout(`/api/gigs/${id}`, {
         headers: getHeaders(),
         credentials: 'include'
      });
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
      const response = await fetchWithTimeout('/api/gigs', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
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
      // Changed to use the new route /api/bids/:gigId
      const response = await fetchWithTimeout(`/api/bids/${gigId}`, {
        headers: getHeaders(),
        credentials: 'include',
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
      const bidsResponse = await fetchWithTimeout(`/api/bids?freelancerId=${userId}`, {
        headers: getHeaders(),
        credentials: 'include',
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
      const response = await fetchWithTimeout('/api/bids', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
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
      // Changed to use the new route PATCH /api/bids/:bidId/hire
      const response = await fetchWithTimeout(`/api/bids/${bidId}/hire`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        // No body required for this specific action
      });
      return handleResponse(response);
    },
    async () => {
      const gigs = getLS<Gig>('gigflow_gigs');
      const bids = getLS<Bid>('gigflow_bids');

      const gigIndex = gigs.findIndex(g => g.id === gigId);
      if (gigIndex === -1) throw new Error('Gig not found');

      // Update Gig Status
      // We must spread the object properly
      gigs[gigIndex] = { ...gigs[gigIndex], status: 'assigned' };
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
