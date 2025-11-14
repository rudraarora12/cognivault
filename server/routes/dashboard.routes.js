import { Router } from 'express';
import { verifyFirebaseToken } from '../config/firebaseAdmin.js';
import * as dashboardService from '../services/dashboard.service.js';

const router = Router();

// Middleware to verify Firebase token
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log(`[Dashboard API] ${req.method} ${req.path} - Token present: ${!!token}`);

  try {
    if (!token) {
      console.warn('[Dashboard API] No token provided');
      return res.status(401).json({ error: 'Authorization token missing.' });
    }

    const decoded = await verifyFirebaseToken(token);
    req.userId = decoded.uid;
    req.userEmail = decoded.email || '';
    req.userName = decoded.name || decoded.email?.split('@')[0] || 'User';
    console.log(`[Dashboard API] Authenticated user: ${req.userId}`);
    next();
  } catch (error) {
    console.error(`[Dashboard API] Authentication failed:`, error.message);
    const statusCode = error.code === 'auth/missing-token' ? 401 : 403;
    return res.status(statusCode).json({ error: error.message });
  }
}

// GET /api/dashboard/overview - Get comprehensive dashboard data
router.get('/overview', authenticate, async (req, res) => {
  try {
    console.log(`[Dashboard API] GET /overview for user: ${req.userId}`);
    
    const overview = await dashboardService.getDashboardOverview(
      req.userId,
      req.userEmail,
      req.userName
    );
    
    console.log(`[Dashboard API] Returning overview with ${overview.totalUploads} uploads`);
    res.json(overview);
  } catch (error) {
    console.error('[Dashboard API] Error fetching dashboard overview:', error.message);
    console.error('[Dashboard API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

export default router;

