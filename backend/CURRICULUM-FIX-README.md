# Curriculum Display Issue - Diagnosis & Fix

## Problem
The curriculum tab in the student dashboard is showing blank/empty.

## Root Cause
The curriculum display requires courses in the database to have three specific fields:
1. **`department`** - Must match the student's department (e.g., "IT", "CS", "Engineering")
2. **`yearLevel`** - Must be one of: "1", "2", "3", or "4"
3. **`semester`** - Must be one of: "First Term", "Second Term", or "Third Term"

If courses are missing any of these fields, they won't appear in the curriculum view.

## How to Diagnose

### Step 1: Run the Diagnosis Script
```bash
cd backend
node diagnose-curriculum.js
```

This will show you:
- Total courses in the database
- How many courses have the required fields
- Sample course data
- Department breakdown
- Specific recommendations

### Step 2: Check the Logs
When you access the student curriculum page:

**Backend logs** (in your server console):
- Student department
- Total courses found for that department
- Sample course data with yearLevel and semester
- Final curriculum structure showing course counts per year/term

**Frontend logs** (in browser console):
- Curriculum API response
- Whether data was successfully set

## How to Fix

### Option 1: Use the Automated Fix Script
```bash
cd backend
node fix-course-fields.js
```

This interactive script will:
1. Find all courses missing required fields
2. Ask you for default values (department, semester)
3. Attempt to extract year level from course codes
4. Update all courses automatically

### Option 2: Manual Database Update
If you prefer to update courses manually, use MongoDB Compass or the mongo shell:

```javascript
// Update all courses to add missing fields
db.courses.updateMany(
  { department: { $exists: false } },
  { $set: { department: "IT" } }
);

db.courses.updateMany(
  { yearLevel: { $exists: false } },
  { $set: { yearLevel: "1" } }
);

db.courses.updateMany(
  { semester: { $exists: false } },
  { $set: { semester: "First Term" } }
);
```

### Option 3: Update Individual Courses
For more precise control, update courses individually based on their actual year and term:

```javascript
// Example: Update a specific course
db.courses.updateOne(
  { code: "CS101" },
  { 
    $set: { 
      department: "CS",
      yearLevel: "1",
      semester: "First Term"
    }
  }
);
```

## Verification

After fixing the courses:

1. **Run the diagnosis script again**:
   ```bash
   node diagnose-curriculum.js
   ```
   Should show all courses have required fields.

2. **Restart your backend server** (if running):
   ```bash
   # Stop the server (Ctrl+C)
   # Start it again
   npm start
   ```

3. **Refresh the student dashboard** in your browser
   - Open browser console (F12)
   - Navigate to the Curriculum tab
   - Check the console logs for the API response

4. **Verify the curriculum displays**:
   - You should see courses organized by year and term
   - Each term should show the course code, name, credits, type, duration, and instructor

## Additional Notes

### Course Schema Fields
The Course model in `config/database.js` includes:
- `department`: String (e.g., "IT", "CS")
- `yearLevel`: String enum ["1", "2", "3", "4"]
- `semester`: String enum ["First Term", "Second Term", "Third Term"]
- `code`: String (course code)
- `name`: String (course name)
- `credits`: Number
- `type`: String (e.g., "lecture", "lab")
- `duration`: Number (in minutes)
- `instructorId`: Reference to Instructor
- `instructorName`: String (denormalized for display)

### Student-Course Matching
The curriculum API filters courses by:
1. Student's department (from Student.department)
2. Courses must have yearLevel and semester set
3. Courses are deduplicated by base code (removes section suffixes like -1A, -2B)

### Debugging Tips
- Check MongoDB is running: `mongod --version`
- Check database connection in backend logs
- Verify student has a department set
- Ensure course codes follow a consistent pattern
- Check that semester values match exactly (case-sensitive)
