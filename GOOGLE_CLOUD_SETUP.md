# 🔑 Google Cloud Setup for Gmail Integration

## ⚡ Quick Setup (10 minutes)

This guide helps you get Google OAuth credentials for Gmail integration.

---

## Step 1: Create Google Cloud Project

1. **Go to**: https://console.cloud.google.com/
2. **Click**: "Select a project" → "New Project"
3. **Enter**:
   - Project name: `CogniVault`
   - Leave organization as is
4. **Click**: "Create"
5. **Wait**: ~30 seconds for project creation

---

## Step 2: Enable Gmail API

### Option A: Using Console UI
1. **Go to**: APIs & Services → Library
2. **Search**: "Gmail API"
3. **Click**: Gmail API
4. **Click**: "Enable"

### Option B: Using Search
1. In Google Cloud Console search bar
2. Type: "Gmail API"
3. Click the result
4. Click "Enable"

---

## Step 3: Configure OAuth Consent Screen

1. **Go to**: APIs & Services → OAuth consent screen
2. **Choose**: External (for testing)
3. **Click**: Create

### Fill in required fields:
```
App name: CogniVault
User support email: [your email]
Developer email: [your email]
```

4. **Click**: Save and Continue

### Add Scopes:
1. **Click**: Add or Remove Scopes
2. **Search and add these scopes**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
3. **Click**: Update
4. **Click**: Save and Continue

### Test Users (Optional for testing):
1. Add your email as test user
2. Click: Save and Continue

---

## Step 4: Create OAuth 2.0 Credentials

1. **Go to**: APIs & Services → Credentials
2. **Click**: "+ CREATE CREDENTIALS"
3. **Choose**: "OAuth client ID"

### Configure the OAuth client:

**Application type**: Web application

**Name**: CogniVault Web

**Authorized JavaScript origins**:
```
http://localhost:5173
http://localhost:5001
```
(Click "Add URI" for each)

**Authorized redirect URIs**:
```
http://localhost:5001/api/email/oauth/callback
```
(This MUST match exactly)

4. **Click**: Create

---

## Step 5: Copy Your Credentials

### You'll see a popup with:
```
Client ID: xxxxx.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxx
```

### ⚠️ IMPORTANT: Save these immediately!

Copy and paste into `server/.env`:
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5001/api/email/oauth/callback
```

---

## Step 6: Download Credentials (Optional)

1. Click "Download JSON"
2. Save as `credentials.json` 
3. Keep this file secure (don't commit to git)

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Project created in Google Cloud
- [ ] Gmail API is enabled (check in API Library)
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created
- [ ] Client ID starts with numbers and ends with `.apps.googleusercontent.com`
- [ ] Client Secret starts with `GOCSPX-`
- [ ] Redirect URI is exactly: `http://localhost:5001/api/email/oauth/callback`
- [ ] Credentials added to `server/.env`

---

## 🔍 Common Issues

### "Access blocked" error
- Make sure you're logged into Google
- Check OAuth consent screen is configured
- Add your email as test user if needed

### "Redirect URI mismatch"
- The URI must be EXACTLY: `http://localhost:5001/api/email/oauth/callback`
- No trailing slash
- Check both in Google Console and `.env` file

### "Invalid client"
- Client ID or Secret is wrong
- Check for extra spaces or quotes
- Make sure you're using Web application type

### "Gmail API not enabled"
- Go back to APIs & Services → Library
- Search Gmail API
- Make sure it shows "Manage" not "Enable"

---

## 🎯 Test Your Setup

1. **Start backend**:
```bash
cd server
npm run dev
```

2. **Start frontend**:
```bash
cd client  
npm run dev
```

3. **Test OAuth flow**:
- Go to: http://localhost:5173/dashboard
- Click: "Connect Email"
- Should redirect to Google sign-in
- After sign-in, should redirect back to dashboard

---

## 🔒 Security Notes

### For Development:
- ✅ Using localhost is fine
- ✅ "External" user type is fine
- ✅ Test with your personal Gmail

### For Production:
- ⚠️ Use HTTPS URLs only
- ⚠️ Configure proper domain
- ⚠️ Submit for Google verification
- ⚠️ Never expose Client Secret
- ⚠️ Use environment variables

---

## 📊 Quotas & Limits

### Gmail API Free Tier:
- 1,000,000,000 quota units per day
- Each `messages.list`: 5 units
- Each `messages.get`: 5 units
- **Plenty for testing and small-scale use!**

### Rate Limits:
- 250 quota units per user per second
- Perfect for our use case

---

## 🚀 Ready to Test!

Once you have your credentials:

1. **Add to `.env`**:
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

2. **Restart backend**:
```bash
npm run dev
```

3. **Connect Gmail** from dashboard!

---

## 📚 Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [OAuth 2.0 Overview](https://developers.google.com/identity/protocols/oauth2)
- [API Quotas](https://developers.google.com/gmail/api/reference/quota)

---

## 💡 Tips

- Use a dedicated Google account for testing
- Start with read-only access (safer)
- Test with 5 emails first
- Check logs for detailed errors
- Keep credentials file as backup

---

**Need help? The setup takes ~10 minutes. Follow steps 1-6 above!** 🎉
