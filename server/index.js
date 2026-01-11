import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, Gig, Bid } from './models.js';

// Configuration for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Use Environment Variables for Production
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gigflow';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: CLIENT_URL, 
  credentials: true, 
}));

// --- Socket.io Setup ---
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  // console.log('New client connected:', socket.id);

  // Clients join a room named after their userId
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      // console.log(`Socket ${socket.id} joined room ${userId}`);
    }
  });

  socket.on('disconnect', () => {
    // console.log('Client disconnected:', socket.id);
  });
});


// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-prod', (err, user) => {
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
    
    const token = jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET || 'your-secret-key-change-in-prod', { expiresIn: '1d' });
    
    // Set HttpOnly Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({ user: { id: user._id, name: user.name, email: user.email } });
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

    const token = jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET || 'your-secret-key-change-in-prod', { expiresIn: '1d' });

    // Set HttpOnly Cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.sendStatus(404);
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.sendStatus(500);
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

// General bids query (e.g. for freelancer dashboard "My Bids")
app.get('/api/bids', authenticateToken, async (req, res) => {
  try {
    const { freelancerId } = req.query;
    let query = {};
    if (freelancerId) query.freelancerId = freelancerId;

    const bids = await Bid.find(query);
    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Specific route for a gig's bids
app.get('/api/bids/:gigId', authenticateToken, async (req, res) => {
  try {
    const { gigId } = req.params;
    const bids = await Bid.find({ gigId });
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
app.patch('/api/bids/:bidId/hire', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { bidId } = req.params;
    
    // 1. Fetch Bid to identify the freelancer and gig
    const bidToHire = await Bid.findById(bidId).session(session);
    if (!bidToHire) throw new Error('Bid not found');
    
    const gigId = bidToHire.gigId;

    // 2. Validate Gig
    const gig = await Gig.findById(gigId).session(session);
    if (!gig || gig.ownerId.toString() !== req.user.id) {
      throw new Error('Unauthorized or Gig not found');
    }
    if (gig.status !== 'open') throw new Error('Gig is not open');

    // 3. Update Statuses
    gig.status = 'assigned';
    await gig.save({ session });

    await Bid.updateMany({ gigId }, { status: 'rejected' }, { session });
    await Bid.findByIdAndUpdate(bidId, { status: 'hired' }, { session });

    // 4. Commit
    await session.commitTransaction();

    // 5. Emit Real-time Notification to the Freelancer
    // We send enough data for the frontend notification to display
    io.to(bidToHire.freelancerId.toString()).emit('notification', {
      id: bidToHire._id,
      gigId: gig._id,
      price: bidToHire.price,
      status: 'hired'
    });

    res.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// --- Production: Serve Static Frontend ---
if (process.env.NODE_ENV === 'production') {
  // Serve any static files from the dist folder (Vite build output)
  // Assuming the folder structure is root/server/index.js and root/dist
  app.use(express.static(path.join(__dirname, '../dist')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });
}

// Connect DB and Start Server
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Changed app.listen to server.listen for Socket.io
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));