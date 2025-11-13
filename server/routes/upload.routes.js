import express from 'express';
import multer from 'multer';
import { processUpload, getUploadHistory, getFileDetails } from '../services/upload.service.js';
import { verifyFirebaseToken } from '../config/firebaseAdmin.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

// Middleware to extract user ID from Firebase token or use demo user
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decodedToken = await verifyFirebaseToken(token);
      req.userId = decodedToken.uid;
    } else {
      // Use demo user for testing
      req.userId = req.query.user_id || 'demo_user';
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    // Fallback to demo user on error
    req.userId = 'demo_user';
    next();
  }
}

// Upload endpoint
router.post('/upload', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    console.log(`📁 Received upload request: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Process the upload
    const result = await processUpload(req.file, req.userId);
    
    res.json(result);
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process upload'
    });
  }
});

// Get upload history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await getUploadHistory(req.userId, limit);
    
    res.json({
      success: true,
      files: history,
      count: history.length
    });
    
  } catch (error) {
    console.error('Error fetching upload history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch upload history'
    });
  }
});

// Get file details with chunks
router.get('/file/:fileId', authenticateUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    const details = await getFileDetails(fileId, req.userId);
    
    res.json({
      success: true,
      ...details
    });
    
  } catch (error) {
    console.error('Error fetching file details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch file details'
    });
  }
});

// Health check for upload service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'upload',
    maxFileSize: '10MB',
    supportedTypes: [
      'PDF',
      'DOCX',
      'DOC',
      'TXT',
      'MD',
      'JPEG/JPG',
      'PNG',
      'GIF',
      'WEBP',
      'BMP'
    ]
  });
});

export default router;
