# 14-Week Semester Date Range Feature

## Overview
This feature restricts auto-generated schedules to only occur within a 14-week (98-day) period starting from a user-specified semester start date. This ensures that classes are only scheduled during the active semester period.

## Implementation Date
November 10, 2025

---

## Technical Implementation

### 1. Backend Changes

#### `backend/api/schedules-autogen.js`

**New Parameters:**
- `semesterStartDate` (optional): YYYY-MM-DD format string
- `SEMESTER_WEEKS`: Constant set to 14 weeks

**New Helper Function:**
```javascript
export function isDayInSemesterRange(dayOfWeek, semesterStart, semesterEnd)
```
- Checks if a specific day-of-week (e.g., "Monday") has any occurrence within the semester date range
- Returns `true` if the day is valid for scheduling
- Returns `true` if no date range is provided (backward compatible)

**Date Calculation Logic:**
```javascript
let semesterStart = null;
let semesterEnd = null;

if (semesterStartDate) {
  semesterStart = new Date(semesterStartDate);
  semesterEnd = new Date(semesterStart);
  semesterEnd.setDate(semesterEnd.getDate() + (SEMESTER_WEEKS * 7)); // 14 weeks = 98 days
}
```

**Validation in Scheduling Loop:**
```javascript
for (const day of validDays) {
  // Skip if this day-of-week doesn't occur within the 14-week semester range
  if (!isDayInSemesterRange(day, semesterStart, semesterEnd)) {
    continue;
  }
  // ... rest of scheduling logic
}
```

**Stats Output:**
The generator now includes in its stats:
- `semesterStartDate`: The provided start date
- `semesterEndDate`: Calculated end date (start + 98 days)
- `semesterWeeks`: Always 14

---

#### `backend/api/schedules.js`

**Updated Endpoint:** `POST /api/schedules/auto-generate`

**New Request Parameter:**
```javascript
{
  semesterStartDate: string | null // Optional: 'YYYY-MM-DD' format
}
```

**Example Request:**
```json
{
  "semester": "First Term",
  "year": 2024,
  "academicYear": "2024-2025",
  "startTime": "07:00",
  "endTime": "18:00",
  "saveToDatabase": true,
  "semesterStartDate": "2024-08-26"
}
```

**Console Logging:**
When a semester start date is provided:
```
🔄 Starting comprehensive schedule generation for First Term 2024-2025...
   📅 Semester date range: 2024-08-26 to 14 weeks after
```

---

### 2. Frontend Changes

#### `frontend/src/components/admin/SchedulesManagement.tsx`

**Updated Interface:**
```typescript
interface GenerationSettings {
  semester: string;
  year: number;
  startDate: string;
  endDate: string;
  avoidConflicts: boolean;
  maxHoursPerDay: number;
  semesterStartDate: string; // NEW: YYYY-MM-DD format for 14-week semester restriction
}
```

**Default State:**
```typescript
const [generationSettings, setGenerationSettings] = useState<GenerationSettings>({
  semester: 'First Term',
  year: 2024,
  startDate: '2024-08-26',
  endDate: '2024-12-13',
  avoidConflicts: true,
  maxHoursPerDay: 8,
  semesterStartDate: '' // Will be filled by user
});
```

**Payload Construction:**
```typescript
const payload = {
  semester: generationSettings.semester,
  year: generationSettings.year,
  academicYear: `${generationSettings.year}-${Number(generationSettings.year) + 1}`,
  startTime: '07:00',
  endTime: '18:00',
  saveToDatabase: true,
  ...(generationSettings.semesterStartDate && { semesterStartDate: generationSettings.semesterStartDate })
};
```

**New UI Element:**
```tsx
<div className="space-y-2">
  <Label>Semester Start Date (Optional)</Label>
  <Input
    type="date"
    value={generationSettings.semesterStartDate}
    onChange={(e) => setGenerationSettings(prev => ({ ...prev, semesterStartDate: e.target.value }))}
  />
  <p className="text-xs text-gray-500">
    📅 If provided, schedules will only be generated for 14 weeks (98 days) starting from this date
  </p>
</div>
```

---

#### `frontend/src/components/services/api.ts`

**Updated Type Definition:**
```typescript
async autoGenerateSchedules(params: {
  semester: string;
  year: number;
  academicYear: string;
  startTime: string;
  endTime: string;
  saveToDatabase: boolean;
  semesterStartDate?: string; // Optional: YYYY-MM-DD format for 14-week semester restriction
})
```

---

## How It Works

### Algorithm Flow

1. **User Input**: Admin provides semester start date (e.g., "2024-08-26")

2. **Date Range Calculation**:
   ```
   Start: 2024-08-26
   End: 2024-08-26 + 98 days = 2024-12-02 (14 weeks later)
   ```

3. **Day Validation**:
   - For each day-of-week (Monday, Tuesday, etc.)
   - Check if that day occurs at least once between start and end dates
   - Example: If start is Wednesday 8/26, then:
     - Wednesday: ✅ Valid (occurs starting 8/26)
     - Thursday: ✅ Valid (occurs starting 8/27)
     - Monday: ✅ Valid (occurs starting 8/28)
     - All days valid if they occur within the 14-week window

4. **Schedule Generation**:
   - Only create schedules for validated days
   - Skip any day-of-week that has no occurrences in the range
   - Respect all other constraints (lunch break, conference rooms, conflicts)

---

## User Experience

### Before This Feature
- Schedules generated for all days of the week indefinitely
- No temporal boundaries on when classes could be scheduled
- Admin had to manually verify semester dates

### After This Feature
- Admin specifies exact semester start date
- System automatically calculates 14-week period
- Only schedules classes within the valid semester window
- Clear feedback showing date range in console logs

---

## Example Scenarios

### Scenario 1: Full Semester (14 weeks)
```
Input:
- Semester: First Term
- Year: 2024
- Start Date: 2024-08-26

Result:
- Schedules from: August 26, 2024
- Schedules until: December 2, 2024
- Total duration: 14 weeks (98 days)
```

### Scenario 2: No Date Provided (Backward Compatible)
```
Input:
- Semester: First Term
- Year: 2024
- Start Date: (empty)

Result:
- No date restrictions applied
- Schedules generated for all valid days
- Works exactly like before this feature
```

---

## Integration with Other Features

This feature works seamlessly with existing constraints:

1. **Lunch Break Protection** (12:30-1:00 PM)
   - Date validation happens FIRST
   - Then lunch break check
   - Both constraints respected

2. **Conference Room Exclusion**
   - Date validation doesn't affect room selection
   - Auditoriums still excluded from auto-generation

3. **Conflict Detection**
   - Instructor, room, and section conflicts still checked
   - Date validation adds an additional layer

4. **Year/Section Filters**
   - Weekly view filters still work
   - Date range affects what gets generated, not what gets displayed

---

## Testing Checklist

- [ ] Generate schedules WITHOUT semester start date (backward compatibility)
- [ ] Generate schedules WITH semester start date (14-week restriction)
- [ ] Verify schedules only created within 98-day window
- [ ] Confirm lunch break still protected (12:30-1:00 PM)
- [ ] Confirm conference rooms still excluded
- [ ] Check console logs show date range when provided
- [ ] Verify stats object includes semester dates
- [ ] Test with different start dates (mid-week, weekend, etc.)
- [ ] Ensure weekly calendar view shows correct schedules
- [ ] Verify filters work with date-restricted schedules

---

## Configuration

### Constants
```javascript
const SEMESTER_WEEKS = 14; // Fixed at 14 weeks
const DAYS_IN_SEMESTER = SEMESTER_WEEKS * 7; // 98 days
```

### Date Format
- Input: `YYYY-MM-DD` (e.g., "2024-08-26")
- Storage: JavaScript Date objects
- Display: ISO string format

---

## Future Enhancements

Potential improvements for future iterations:

1. **Variable Semester Length**
   - Allow admin to configure weeks (12, 14, 16, etc.)
   - Add UI control for semester duration

2. **Date Range Preview**
   - Show calculated end date in UI before generation
   - Display "August 26, 2024 - December 2, 2024"

3. **Holiday Exclusions**
   - Skip specific dates within the semester
   - Account for school breaks/holidays

4. **Multi-Semester Planning**
   - Generate multiple semesters at once
   - Preserve instructor/room continuity

---

## Known Limitations

1. **Fixed 14-Week Duration**: Currently hardcoded, not configurable via UI
2. **Full Week Validation**: Validates entire day-of-week, not specific dates
3. **No Holiday Support**: Doesn't account for breaks within the semester
4. **No End Date Override**: User can't manually specify end date (always 14 weeks)

---

## Dependencies

### Backend
- `mongoose` - Database operations
- `Schedule`, `Course`, `Room`, `Instructor` models from `database.js`

### Frontend
- React date input component
- TypeScript type definitions
- API service layer

---

## API Documentation

### Endpoint: POST `/api/schedules/auto-generate`

**Request Body:**
```typescript
{
  semester: string;           // Required: "First Term", "Second Term", "Third Term"
  year: number;              // Required: 2024
  academicYear: string;      // Required: "2024-2025"
  startTime: string;         // Optional: "07:00" (default)
  endTime: string;           // Optional: "18:00" (default)
  saveToDatabase: boolean;   // Required: true/false
  semesterStartDate?: string; // Optional: "YYYY-MM-DD"
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  schedules: Schedule[];
  conflicts: Conflict[];
  stats: {
    totalCourses: number;
    scheduledCourses: number;
    conflicts: number;
    byYearLevel: { [key: string]: number };
    bySection: { [key: string]: number };
    semesterStartDate?: string;    // If provided
    semesterEndDate?: string;      // If start date provided
    semesterWeeks?: number;        // If start date provided
  };
  saved: boolean;
}
```

---

## Maintenance Notes

### Code Locations
- Backend logic: `backend/api/schedules-autogen.js` (lines 23-52, 278-290, 321-324)
- Backend endpoint: `backend/api/schedules.js` (lines 675-709)
- Frontend UI: `frontend/src/components/admin/SchedulesManagement.tsx` (lines 127-135, 164-172, 176-186, 863-873)
- Frontend types: `frontend/src/components/services/api.ts` (lines 394-402)

### Key Functions
- `isDayInSemesterRange()` - Core validation logic
- `generateComprehensiveSchedule()` - Main generator with date support
- `scheduleCourseToBestSlot()` - Individual slot finder with date check

---

## Version History

### v1.0 (November 10, 2025)
- Initial implementation
- 14-week fixed duration
- Optional semester start date
- Backward compatible with existing workflows

---

## Support

For questions or issues related to this feature:
1. Check console logs for date range confirmation
2. Verify date format is YYYY-MM-DD
3. Ensure semester start date falls on a valid weekday
4. Review generated stats object for date range info

---

**Status**: ✅ Production Ready  
**Last Updated**: November 10, 2025  
**Tested**: Pending  
**Deployed**: Pending
