# Schedule Builder - Movable Blocks Update

## New Feature: Move Schedule Blocks After Placement

### What Changed

Previously, schedule blocks could only be dragged from the sidebar to the calendar. Once placed, they were static.

Now, **schedule blocks can be moved to different time slots and days** after being placed on the calendar.

### How It Works

1. **Drag from Sidebar** (as before):
   - Drag an unscheduled course from the sidebar
   - Drop it on any calendar cell (day + time)
   - Block appears with the course details

2. **Move Existing Blocks** (NEW):
   - Click and drag any schedule block on the calendar
   - Drop it on a different day or time slot
   - Block moves to the new location
   - Time automatically updates based on the new slot

### Visual Feedback

- **Grab Cursor**: Hover over any block to see the grab cursor
- **Grip Icon**: Each block now shows a grip icon (⋮⋮) indicating it's draggable
- **Drag Overlay**: Shows "Moving schedule..." when dragging an existing block
- **Shadow Effect**: Blocks show a shadow on hover for better UX
- **Opacity**: Dragged block becomes semi-transparent

### Save Functionality

The "Save Changes" button now tracks:
- **New schedules**: Courses dragged from sidebar (created in database)
- **Modified schedules**: Existing blocks that were moved (updated in database)

**Badge Counter**: Shows the total number of unsaved changes (new + modified)

### Technical Implementation

1. **Made ScheduleBlockComponent Draggable**:
   - Uses `useDraggable` hook from `@dnd-kit/core`
   - Each block has a unique ID: `scheduled-{schedule.id}`
   - Passes schedule data in drag event

2. **Updated handleDragEnd**:
   - Detects if dragging an existing schedule (`type: 'scheduled'`)
   - Calculates new start/end times based on drop location
   - Updates schedule in state
   - Marks schedule as modified

3. **Modified Schedule Tracking**:
   - New state: `modifiedScheduleIds` (Set of schedule IDs)
   - Tracks which existing schedules have been moved
   - Only non-temp schedules are marked as modified

4. **Enhanced Save Function**:
   - Creates new schedules (temp-* IDs)
   - Updates modified schedules via API
   - Shows count of created vs updated schedules
   - Clears modified tracking after successful save

### API Calls

**Create New Schedule**:
```javascript
apiService.createSchedule({
  courseId, instructorId, roomId,
  dayOfWeek, startTime, endTime,
  status: 'published'
})
```

**Update Moved Schedule**:
```javascript
apiService.updateSchedule(scheduleId, {
  dayOfWeek, startTime, endTime
})
```

### User Experience

**Before**:
- Drag course → Drop → Fixed position
- To change: Delete and re-add

**After**:
- Drag course → Drop → Can move anytime
- Drag existing block → Drop → New position
- Save all changes at once

### Example Workflow

1. Admin drags "CS101" from sidebar to Monday 9 AM
2. Block appears on calendar
3. Admin realizes it should be Tuesday 10 AM
4. Admin drags the CS101 block to Tuesday 10 AM
5. Block moves, time updates automatically
6. "Save Changes" button shows badge: 1 (modified)
7. Admin clicks "Save Changes"
8. Toast: "Schedules saved: 1 updated"
9. Changes persist to database

### Benefits

✅ **Flexible Scheduling**: Easily rearrange schedules without deleting
✅ **Visual Feedback**: Clear indication of what's being moved
✅ **Batch Updates**: Save multiple changes at once
✅ **Undo-friendly**: Changes only persist when saved
✅ **Better UX**: Intuitive drag-and-drop for all operations

### Files Modified

- `frontend/src/components/admin/ScheduleBuilder.tsx`
  - Made `ScheduleBlockComponent` draggable
  - Added `modifiedScheduleIds` state tracking
  - Updated `handleDragEnd` to handle moving blocks
  - Enhanced `handleSaveSchedules` to update moved schedules
  - Updated Save button to show change count
  - Improved DragOverlay feedback

### Testing

1. Log in as Admin
2. Go to Schedule Builder
3. Drag a course to the calendar
4. Try dragging the placed block to a different day/time
5. Verify the block moves and time updates
6. Check that Save button shows the change count
7. Click Save and verify update succeeds
8. Refresh and verify the new position persists

### Notes

- Blocks maintain their color when moved
- Duration-based sizing is preserved
- Conflicts are still detected by backend
- Only saves when "Save Changes" is clicked
- Can move both new (temp) and existing schedules
