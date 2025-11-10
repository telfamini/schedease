# SchedEase Backend Troubleshooting Guide

## Issue: Backend Won't Start or Can't Connect to MongoDB

### Step 1: Check if MongoDB is Running

#### Option A: Check Windows Service
```powershell
Get-Service -Name MongoDB* | Select-Object Name, Status
```

If Status is "Stopped", start it:
```powershell
Start-Service -Name MongoDB
```

#### Option B: Check if MongoDB Process is Running
```powershell
Get-Process -Name mongod -ErrorAction SilentlyContinue
```

If nothing shows up, MongoDB is not running.

### Step 2: Start MongoDB Manually

If MongoDB is installed but not running:

```powershell
# Navigate to MongoDB bin directory (adjust path if different)
cd "C:\Program Files\MongoDB\Server\7.0\bin"

# Start MongoDB
.\mongod.exe --dbpath "C:\data\db"
```

**Note**: You may need to create the data directory first:
```powershell
mkdir C:\data\db
```

### Step 3: Verify .env File

Check `backend/.env` contains:
```
MONGODB_URI=mongodb://localhost:27017/schedease_db
```

### Step 4: Test MongoDB Connection

Open a new PowerShell window and run:
```powershell
cd backend
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/schedease_db').then(() => { console.log('✅ Connected!'); process.exit(0); }).catch(err => { console.error('❌ Error:', err.message); process.exit(1); });"
```

### Step 5: Start Backend Server

```powershell
cd backend
npm run dev
```

Look for these messages:
- ✅ `🔄 Connecting to MongoDB...`
- ✅ `✅ MongoDB connected successfully`
- ✅ `🌟 SchedEase API Server running on port 3001`

### Common Errors & Solutions

#### Error: "ECONNREFUSED"
**Cause**: MongoDB is not running
**Solution**: Start MongoDB service (see Step 1)

#### Error: "Connection timeout"
**Cause**: Wrong connection string or firewall
**Solution**: 
- Verify MONGODB_URI in .env
- Check firewall settings
- Try `mongodb://127.0.0.1:27017/schedease_db` instead

#### Error: "Authentication failed"
**Cause**: MongoDB requires authentication
**Solution**: Update .env with credentials:
```
MONGODB_URI=mongodb://username:password@localhost:27017/schedease_db
```

#### Error: "Cannot find module 'dotenv'"
**Cause**: Dependencies not installed
**Solution**: 
```powershell
cd backend
npm install
```

### Step 6: Start Frontend

Once backend is running:
```powershell
cd frontend
npm run dev
```

### Step 7: Access the App

1. Go to: http://localhost:3000
2. Use debug tool: http://localhost:3000/debug.html
3. Login with:
   - Email: `admin@university.edu`
   - Password: `password`

---

## Quick Checklist

- [ ] MongoDB is installed
- [ ] MongoDB service is running
- [ ] `backend/.env` file exists with correct MONGODB_URI
- [ ] Backend dependencies installed (`npm install`)
- [ ] Backend starts without errors
- [ ] Frontend dependencies installed
- [ ] Frontend starts without errors
- [ ] Can access http://localhost:3000

## Still Having Issues?

### Check Backend Logs
Look for the exact error message when starting backend

### Check MongoDB Logs
```powershell
# Default log location
Get-Content "C:\Program Files\MongoDB\Server\7.0\log\mongod.log" -Tail 50
```

### Alternative: Use MongoDB Atlas (Cloud)
If local MongoDB won't work, use MongoDB Atlas (free):
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update backend/.env:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/schedease_db
```

---

## Need Help?
Check the console output for specific error messages and search for solutions based on the exact error.
