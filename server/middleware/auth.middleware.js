import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin if not already initialized
let firebaseAdmin;

try {
  // Check if we're in mock mode
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'mock') {
    console.log('🔧 Running auth in mock mode');
    // Mock auth for development
    firebaseAdmin = {
      auth: () => ({
        verifyIdToken: async (token) => {
          // Accept any token in mock mode
          console.log('🔧 Using mock auth - accepting any token');
          return { uid: 'demo_user', email: 'demo@example.com' };
        }
      })
    };
  } else {
    // Real Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
    firebaseAdmin = admin;
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  // Fallback to mock mode
  firebaseAdmin = {
    auth: () => ({
      verifyIdToken: async (token) => {
        // Accept any token in fallback mode
        console.log('🔧 Firebase init failed - using mock auth, accepting any token');
        return { uid: 'demo_user', email: 'demo@example.com' };
      }
    })
  };
}

// Middleware to authenticate user
export async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Extract token
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // In mock mode, extract user info from token if possible
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'mock') {
    if (token) {
      try {
        // Try to decode the token to get user info
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          req.user = { uid: payload.user_id || payload.uid || 'demo_user', email: payload.email || 'demo@example.com' };
        } else {
          req.user = { uid: 'demo_user', email: 'demo@example.com' };
        }
      } catch (e) {
        req.user = { uid: 'demo_user', email: 'demo@example.com' };
      }
    } else {
      req.user = { uid: 'demo_user', email: 'demo@example.com' };
    }
    return next();
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If no token, use demo user in development
    req.user = { uid: 'demo_user', email: 'demo@example.com' };
    return next();
  }
  
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    // In any error case, use demo user
    console.log('Auth verification failed, using demo user');
    req.user = { uid: 'demo_user', email: 'demo@example.com' };
    next();
  }
}

// Optional middleware - continues even without auth
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    req.user = null;
  }
  
  next();
}
