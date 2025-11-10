# Authentication Testing Guide

## Testing the 401 Fix

### Step 1: Clear Browser Storage
1. Open browser DevTools (F12)
2. Go to Application/Storage tab
3. Clear all localStorage items
4. Refresh the page

### Step 2: Login Test
1. Go to http://localhost:3000
2. Login with test credentials:
   - **Admin**: admin@university.edu / password
   - **Instructor**: instructor@university.edu / password
   - **Student**: student@university.edu / password

### Step 3: Verify Token Storage
After login, check in DevTools > Application > LocalStorage:
- `authToken` should contain a JWT token
- `currentUser` should contain user data

### Step 4: Test API Calls
1. Navigate to Admin Dashboard
2. Open Network tab in DevTools
3. Filter by "api"
4. Verify all requests show:
   - Status: 200 OK
   - Request Headers contain: `Authorization: Bearer <token>`

### Step 5: Test Token Expiration
Option A - Manual test:
1. In DevTools Console, run:
   ```javascript
   localStorage.setItem('authToken', 'invalid-token')
   ```
2. Refresh the page
3. Should redirect to login with "expired token" message

Option B - Wait for actual expiration:
1. Token expires in 7 days (TOKEN_EXPIRATION_HOURS=7d)
2. Or modify backend/.env to set shorter expiration:
   ```
   TOKEN_EXPIRATION_HOURS=1h
   ```

### Expected Behaviors:

✅ **Valid Token**:
- All API calls succeed with 200 status
- Dashboard loads data properly
- No 401 errors in console

✅ **Invalid/Expired Token**:
- API calls return 401
- Error message: "Invalid or expired token"
- Token cleared from localStorage
- User redirected to login page

✅ **No Token**:
- Immediate redirect to login
- Message: "Please log in to continue"

### Common Issues:

**Issue**: Still getting 401 errors
**Fix**: 
1. Stop both frontend and backend
2. Clear browser cache and localStorage
3. Restart backend: `cd backend; npm run dev`
4. Restart frontend: `cd frontend; npm run dev`
5. Login again with fresh credentials

**Issue**: Token not being saved
**Fix**:
1. Check browser console for errors during login
2. Verify backend login endpoint returns both `user` and `token`
3. Check CORS settings in backend/server.js

**Issue**: Token format incorrect
**Fix**:
1. Verify JWT_SECRET is set in backend/.env
2. Check token in DevTools - should look like: `eyJhbGciOi...`
3. Ensure Authorization header format: `Bearer <token>` (not just `<token>`)

### Debug Endpoints:

Test authentication manually:

```bash
# 1. Login and get token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@university.edu","password":"password"}'

# 2. Use token to access protected endpoint
curl http://localhost:3001/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Verify token with /auth/me
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Files Modified:
- ✅ `frontend/src/components/admin/apiService.ts`
- ✅ `frontend/src/lib/api.ts`
- ✅ `frontend/src/components/AuthContext.tsx`
- ✅ `frontend/src/components/dashboards/AdminDashboard.tsx`

### Backend Verification:
All protected routes correctly use `requireAuth` middleware:
- ✅ `/api/courses`
- ✅ `/api/rooms`
- ✅ `/api/schedules`
- ✅ `/api/users`
- ✅ `/api/instructors`
- ✅ `/api/enrollments`
