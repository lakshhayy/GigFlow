import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { 
  toJSON: { virtuals: true },
  id: false 
});

const gigSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  budget: { type: Number, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true },
  status: { type: String, enum: ['open', 'assigned'], default: 'open' },
  createdAt: { type: Date, default: Date.now }
}, { 
  toJSON: { virtuals: true },
  id: false 
});

const bidSchema = new mongoose.Schema({
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  freelancerName: { type: String, required: true },
  message: { type: String, required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'hired', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
}, { 
  toJSON: { virtuals: true },
  id: false 
});

export const User = mongoose.model('User', userSchema);
export const Gig = mongoose.model('Gig', gigSchema);
export const Bid = mongoose.model('Bid', bidSchema);
