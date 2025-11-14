import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function buildCredentialFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, "base64").toString("utf8");
      return cert(JSON.parse(decoded));
    } catch (error) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error.message);
    }
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return applicationDefault();
  }

  return null; // Return null instead of throwing error
}

let firebaseAuth = null;

// Initialize Firebase Admin if credentials are available
if (!getApps().length) {
  const credential = buildCredentialFromEnv();
  if (credential) {
    initializeApp({
      credential,
    });
    firebaseAuth = getAuth();
    console.log('✅ Firebase Admin initialized');
  } else {
    console.warn('⚠️  Firebase Admin not configured - using mock auth mode');
  }
}

export async function verifyFirebaseToken(token) {
  // In mock mode, extract user info from token if possible  
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'mock') {
    console.warn('⚠️  Firebase Admin not configured - accepting token without verification (mock mode)');
    if (token) {
      try {
        // Try to decode the token to get user info
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          return { 
            uid: payload.user_id || payload.uid || payload.sub || 'demo_user', 
            email: payload.email || 'demo@example.com',
            name: payload.name || payload.email?.split('@')[0] || 'User',
            mock: true
          };
        }
      } catch (e) {
        // Ignore decoding errors
      }
    }
    return { uid: 'demo_user', email: 'demo@example.com', mock: true };
  }

  if (!token) {
    const authError = new Error("Authorization token missing.");
    authError.code = "auth/missing-token";
    throw authError;
  }

  try {
    return await firebaseAuth.verifyIdToken(token);
  } catch (error) {
    const authError = new Error("Invalid or expired authorization token.");
    authError.code = "auth/invalid-token";
    authError.original = error;
    throw authError;
  }
}

