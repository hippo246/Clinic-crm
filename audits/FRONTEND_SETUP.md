# Frontend Setup Guide - Firebase Authentication Integration

## Overview
The Clinic CRM frontend now uses Firebase for authentication while keeping data storage on the Rust backend. This hybrid approach provides secure, easy-to-use authentication while maintaining HIPAA compliance with on-premises data storage.

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name (e.g., "clinic-crm")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication
1. In Firebase Console, go to "Authentication"
2. Click "Get Started"
3. Select "Email/Password" sign-in provider
4. Enable "Email/Password" sign-in
5. Click "Save"

### 3. Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Enter app name (e.g., "Clinic CRM Web")
5. Copy the configuration values

### 4. Configure Environment Variables
Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your Firebase configuration:

```bash
# Firebase Configuration (from Firebase Console)
VITE_FIREBASE_API_KEY=AIzaSyD-Your-API-Key-Here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Rust Backend API URL
VITE_API_URL=https://127.0.0.1:8443
```

## Frontend Architecture

### Components Created

#### 1. Firebase Configuration (`src/firebase.ts`)
- Firebase app initialization
- Authentication functions (login, logout, token management)
- Auth state change listeners

#### 2. Authentication Components
- **Login** (`src/ui/components/Login.tsx`): Email/password login with Firebase
- **Signup** (`src/ui/components/Signup.tsx`): User registration with Firebase

#### 3. Updated API Client (`src/ui/api.ts`)
- Uses Firebase tokens for authentication
- Token management (set, clear, validate)
- All API endpoints protected with Firebase tokens

#### 4. Updated App Component (`src/ui/App.tsx`)
- Firebase auth state management
- Shows login/signup when not authenticated
- Shows CRM interface when authenticated
- Logout functionality in TopBar

### Authentication Flow

```
1. User enters credentials in Login component
2. Firebase validates credentials
3. Firebase returns JWT token
4. Token stored in API client
5. Token sent with all API requests
6. Rust backend validates Firebase token
7. Backend processes request
8. Data returned to frontend
```

## Running the Frontend

### Development Mode
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Production Build
```bash
npm run build
```

The production files will be in the `dist/` directory

### Preview Production Build
```bash
npm run preview
```

## Testing Firebase Authentication

### 1. Test Login
1. Start the frontend: `npm run dev`
2. Open browser to `http://localhost:5173`
3. You should see the login screen
4. Enter email and password
5. Click "Login"
6. If successful, you'll be redirected to the CRM interface

### 2. Test Signup
1. On the login screen, click "Sign Up" link
2. Enter your details (name, email, password)
3. Click "Sign Up"
4. If successful, you'll be redirected to the CRM interface

### 3. Test Logout
1. Click the logout button in the top-right corner
2. You'll be logged out and returned to the login screen

### 4. Test Token Persistence
1. Login successfully
2. Refresh the page
3. You should remain logged in (token persisted in localStorage)

## Backend Integration

The frontend expects the Rust backend to have the following Firebase authentication endpoint:

```rust
POST /api/auth/firebase-login
Content-Type: application/json

{
  "token": "firebase-jwt-token"
}

Response:
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "doctor"
}
```

The backend should:
1. Validate the Firebase token using Firebase Admin SDK
2. Check if the user exists in the database
3. Return user information to the frontend
4. Create user if they don't exist (for new signups)

## Troubleshooting

### Firebase Configuration Errors
**Error**: "Firebase: Error (auth/invalid-api-key)"
**Solution**: Check your `VITE_FIREBASE_API_KEY` in `.env` file

**Error**: "Firebase: Error (auth/configuration-not-found)"
**Solution**: Ensure all Firebase configuration variables are set in `.env`

### Authentication Errors
**Error**: "Login failed. Please check your credentials."
**Solution**: 
- Verify email/password are correct
- Check if Email/Password auth is enabled in Firebase Console
- Ensure user account exists in Firebase

**Error**: "An account with this email already exists"
**Solution**: Use a different email or login with existing account

### API Errors
**Error**: "Request failed" or "HTTP 401"
**Solution**:
- Ensure Rust backend is running
- Check `VITE_API_URL` in `.env` file
- Verify backend accepts Firebase tokens
- Check browser console for detailed error messages

### CORS Errors
**Error**: "Access to fetch at '...' has been blocked by CORS policy"
**Solution**:
- Ensure Rust backend has CORS configured
- Add frontend URL to backend CORS allowed origins

## Security Considerations

### Firebase Security Rules
In Firebase Console, configure Firestore security rules (if using Firestore):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Deny all client-side access (we use backend)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Environment Variables
- Never commit `.env` file to version control
- Use `.env.example` as a template
- Keep Firebase API keys secure
- Use different configurations for development and production

### Token Management
- Firebase tokens are stored in localStorage
- Tokens are automatically refreshed by Firebase SDK
- Tokens are sent with every API request
- Tokens are cleared on logout

## Next Steps

### 1. Complete Backend Integration
- Implement Firebase Admin SDK in Rust backend
- Add `/api/auth/firebase-login` endpoint
- Validate Firebase tokens on all API endpoints
- Create user records in PostgreSQL on signup

### 2. Add MFA Support
- Enable MFA in Firebase Console
- Update login flow to handle MFA
- Add MFA verification component

### 3. Add Role-Based Access Control
- Implement RBAC in backend
- Store user roles in PostgreSQL
- Enforce role permissions in API endpoints
- Update frontend to respect role permissions

### 4. Add Real-time Features (Optional)
- Enable Firebase Realtime Database
- Implement real-time patient updates
- Add real-time notifications

### 5. Add File Upload with Firebase Storage (Optional)
- Enable Firebase Storage
- Configure storage security rules
- Update file upload components
- Integrate with backend file handling

## Deployment

### Production Environment Variables
Create `.env.production`:

```bash
VITE_FIREBASE_API_KEY=your-production-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-production-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-production-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-production-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-production-messaging-sender-id
VITE_FIREBASE_APP_ID=your-production-app-id

VITE_API_URL=https://clinic.yourdomain.com/api
```

### Build for Production
```bash
npm run build
```

### Deploy to Server
1. Copy `dist/` directory to server
2. Configure Nginx to serve static files
3. Set up SSL certificates
4. Configure environment variables on server

## Support

### Firebase Documentation
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

### Project Documentation
- Architecture: `ARCHITECTURE.md`
- Deployment: `DEPLOYMENT_GUIDE.md`
- Security: `SECURITY_IMPLEMENTATION_SUMMARY.md`

## Summary

The frontend now uses Firebase for authentication with the following features:
- ✅ Firebase Email/Password authentication
- ✅ Login and Signup components
- ✅ Token management and persistence
- ✅ Protected API routes with Firebase tokens
- ✅ Logout functionality
- ✅ Auth state management
- ✅ Integration with existing CRM interface

The backend needs to be updated to validate Firebase tokens and integrate with Firebase Admin SDK for complete authentication flow.
