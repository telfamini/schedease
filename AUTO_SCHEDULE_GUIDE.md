# Auto-Schedule Generator Guide

## Overview
The new comprehensive auto-schedule generator creates complete semester schedules for all year levels and sections with intelligent conflict avoidance.

## Features

### ✅ Comprehensive Coverage
- **4 Year Levels**: Generates schedules for Years 1-4
- **2 Sections per Year**: Sections A and B for each year level
- **Total**: 8 unique section schedules per semester

### ✅ Smart Scheduling
- **No Time Conflicts**: Ensures no student, instructor, or room conflicts
- **Section-Specific Schedules**: Each section gets different time slots
- **Optimal Room Assignment**: Matches course requirements with room capabilities
- **Instructor Management**: Respects instructor availability and prevents double-booking

### ✅ Flexible Time Slots
- **Days**: Monday through Saturday (Sunday excluded)
- **Customizable Hours**: Default 7:00 AM - 6:00 PM (configurable)
- **14-Week Semester**: Schedules designed for standard semester length

### ✅ Course Types
- **Lectures**: Standard classroom courses (90 minutes)
- **Labs**: Hands-on practical courses (180 minutes)
- **Seminars**: Discussion-based courses

## API Usage

### Generate Schedules (Preview Mode)

```http
POST /api/schedules/auto-generate
Content-Type: application/json

{
  "semester": "First Term",
  "year": 2024,
  "academicYear": "2024-2025",
  "startTime": "07:00",
  "endTime": "18:00",
  "saveToDatabase": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 18 schedules for First Term 2024-2025",
  "schedules": [
    {
      "courseId": "...",
      "courseCode": "ITCC111-LAB-T-A",
      "courseName": "Computer Programming 1 (lab)",
      "instructorId": "...",
      "instructorName": "Instructor User",
      "roomId": "...",
      "roomName": "301",
      "building": "Main Building",
      "dayOfWeek": "Monday",
      "startTime": "07:00",
      "endTime": "10:00",
      "yearLevel": "1",
      "section": "A",
      "semester": "First Term",
      "year": 2024,
      "academicYear": "2024-2025"
    }
    // ... more schedules
  ],
  "conflicts": [],
  "stats": {
    "totalCourses": 18,
    "scheduledCourses": 18,
    "conflicts": 0,
    "byYearLevel": {
      "1": 18,
      "2": 0,
      "3": 0,
      "4": 0
    },
    "bySection": {
      "1A": 9,
      "1B": 9
    }
  },
  "saved": false
}
```

### Save to Database

Set `"saveToDatabase": true` to automatically save generated schedules:

```json
{
  "semester": "First Term",
  "year": 2024,
  "academicYear": "2024-2025",
  "saveToDatabase": true
}
```

This will:
1. Delete existing schedules for the semester/year
2. Generate new schedules
3. Save them to the database
4. Return the saved schedules

## Course Setup Requirements

### 1. Add Year Level and Section to Courses

When creating courses, include:
```json
{
  "code": "ITCC111-LAB-T-A",
  "name": "Computer Programming 1 (lab)",
  "department": "IT",
  "credits": 1,
  "type": "lab",
  "duration": 180,
  "requiredCapacity": 35,
  "yearLevel": "1",
  "section": "A",
  "semester": "First Term"
}
```

### 2. Room Requirements

Rooms must have:
- **capacity**: Number of students the room can accommodate
- **type**: `classroom`, `computer_lab`, `laboratory`, or `auditorium`
- **equipment**: Array of available equipment (e.g., `['computers', 'projector']`)

### 3. Instructor Availability

Instructors should have availability set:
```json
{
  "availability": {
    "Monday": [{ "startTime": "07:00", "endTime": "18:00" }],
    "Tuesday": [{ "startTime": "07:00", "endTime": "18:00" }],
    // ... other days
  }
}
```

## Schedule Output Format

Each generated schedule includes:
- **Course Information**: code, name, credits, type, duration
- **Instructor**: name and ID
- **Room**: name, building, capacity
- **Time**: day of week, start time, end time
- **Classification**: year level, section, semester

## Conflict Resolution

The system prevents:
1. **Room Conflicts**: Same room, same time
2. **Instructor Conflicts**: Same instructor, same time
3. **Student Conflicts**: Same section, same time
4. **Course Duplicates**: Same course scheduled multiple times

## Testing the System

1. **Reset Database** with sample courses:
   ```bash
   cd backend
   npm run reset-db
   ```

2. **Start Backend**:
   ```bash
   npm run dev
   ```

3. **Test Auto-Generate** (using curl, Postman, or frontend):
   ```bash
   curl -X POST http://localhost:3001/api/schedules/auto-generate \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "semester": "First Term",
       "year": 2024,
       "academicYear": "2024-2025",
       "saveToDatabase": false
     }'
   ```

4. **View Generated Schedules**:
   - Frontend: Navigate to Admin Dashboard → Schedules
   - API: GET `/api/schedules?semester=First Term&academicYear=2024-2025`

## Schedule View

The generated schedules can be displayed in a weekly calendar view showing:
- **Monday through Saturday** (6-day week)
- **Time slots** from 7:00 AM to 6:00 PM
- **Color-coded** by year level or section
- **Room assignments** for each class
- **Instructor names** for each class

## Troubleshooting

### No Schedules Generated
- Check that courses have `yearLevel` and `section` set
- Verify rooms have sufficient capacity
- Ensure instructors are available

### Conflicts Detected
- Review the `conflicts` array in the response
- Adjust course durations or room capacities
- Add more rooms or instructors if needed

### Performance Issues
- The generator processes all courses sequentially
- For large datasets (100+ courses), expect 5-10 seconds
- Consider generating schedules during off-peak hours

## Next Steps

1. **Add More Courses**: Create courses for Years 2-4
2. **Customize Time Slots**: Adjust `startTime` and `endTime`
3. **View in Calendar**: Integrate with frontend calendar component
4. **Export Schedules**: Add PDF export functionality
5. **Manual Adjustments**: Allow admins to modify generated schedules

## Database Schema Updates

The Course schema now includes:
```javascript
yearLevel: { type: String, enum: ['1', '2', '3', '4'] }
section: { type: String }
semester: { type: String, enum: ['First Term', 'Second Term', 'Third Term'] }
```

Make sure to update existing courses with these fields!
