export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In a real app, never store/send plain text
}

export type GigStatus = 'open' | 'assigned';

export interface Gig {
  id: string;
  title: string;
  description: string;
  budget: number;
  ownerId: string;
  ownerName: string;
  status: GigStatus;
  createdAt: string;
}

export type BidStatus = 'pending' | 'hired' | 'rejected';

export interface Bid {
  id: string;
  gigId: string;
  freelancerId: string;
  freelancerName: string;
  message: string;
  price: number;
  status: BidStatus;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}
