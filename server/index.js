import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Gig, Bid } from './models.js';

const app = express();
const PORT = 5000;
const JWT_SECRET = 'your-secret-key-change-in-prod';
const MONGO_URI = 'mongodb://127.0.0.1:27017/gigflow';

app.use(express.json());
app.use(cors());

// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    
    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET);
    res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET);
    res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Gig Routes ---
app.get('/api/gigs', async (req, res) => {
  try {
    const { search, ownerId } = req.query;
    let query = {};
    
    if (ownerId) {
      query.ownerId = ownerId;
    } else {
      query.status = 'open';
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const gigs = await Gig.find(query).sort({ createdAt: -1 });
    res.json(gigs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/gigs/:id', async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig) return res.status(404).json({ message: 'Gig not found' });
    res.json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/gigs', authenticateToken, async (req, res) => {
  try {
    const gig = await Gig.create({
      ...req.body,
      ownerId: req.user.id,
      ownerName: req.user.name,
      status: 'open'
    });
    res.json(gig);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Bid Routes ---
app.get('/api/bids', authenticateToken, async (req, res) => {
  try {
    const { gigId, freelancerId } = req.query;
    let query = {};
    if (gigId) query.gigId = gigId;
    if (freelancerId) query.freelancerId = freelancerId;

    const bids = await Bid.find(query);
    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/bids', authenticateToken, async (req, res) => {
  try {
    const { gigId } = req.body;
    const existingBid = await Bid.findOne({ gigId, freelancerId: req.user.id });
    if (existingBid) return res.status(400).json({ message: 'Already bid on this gig' });

    const bid = await Bid.create({
      ...req.body,
      freelancerId: req.user.id,
      freelancerName: req.user.name,
      status: 'pending'
    });
    res.json(bid);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Hiring Logic ---
app.post('/api/hire', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { gigId, bidId } = req.body;
    
    const gig = await Gig.findById(gigId).session(session);
    if (!gig || gig.ownerId.toString() !== req.user.id) {
      throw new Error('Unauthorized or Gig not found');
    }
    if (gig.status !== 'open') throw new Error('Gig is not open');

    gig.status = 'assigned';
    await gig.save({ session });

    await Bid.updateMany({ gigId }, { status: 'rejected' }, { session });
    await Bid.findByIdAndUpdate(bidId, { status: 'hired' }, { session });

    await session.commitTransaction();
    res.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Connect DB and Start Server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
