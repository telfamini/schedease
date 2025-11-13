import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Clock, MapPin, User, GripVertical, Save, Sparkles } from 'lucide-react';
import apiService from '../services/api';
import { toast } from 'sonner';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Course {
  _id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  duration: number;
  instructorName?: string;
  department?: string;
}

interface Room {
  _id: string;
  name: string;
  building: string;
  capacity: number;
}

interface Instructor {
  _id: string;
  userId: {
    name: string;
  };
}

interface ScheduleBlock {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  instructorId?: string;
  instructorName: string;
  roomId?: string;
  roomName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  duration: number;
  color: string;
  yearLevel?: string;
  section?: string;
  year?: number;
  semester?: string;
}

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const START_HOUR = 7; // 7 AM
const END_HOUR = 19; // 7 PM
const SLOT_HEIGHT = 60; // pixels per hour

// Generate time slots
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const label = `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
    slots.push({ hour, minute: 0, label });
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Droppable sidebar for returning courses
function UnscheduledCoursesArea({ courses, onDrop }: { 
  courses: Course[];
  onDrop: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled-area',
    data: { type: 'unscheduled-area' }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`max-h-[calc(100vh-200px)] overflow-y-auto ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400 dark:ring-blue-600 ring-inset' : ''
      }`}
    >
      {courses.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
          All courses are scheduled!
        </p>
      ) : (
        courses.map(course => (
          <DraggableCourse key={course._id} course={course} />
        ))
      )
      }
    </div>
  );
}

// Draggable course item
function DraggableCourse({ course }: { course: Course }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${course._id}`,
    data: { course, type: 'unscheduled' }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const durationHours = course.duration / 60;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-200">{course.code}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{course.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300">
              {durationHours}h
            </Badge>
            <Badge variant="secondary" className="text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {course.type}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

// Droppable calendar cell
function CalendarCell({ day, hour, schedules, onInstructorDrop, onRoomDrop }: { 
  day: string; 
  hour: number; 
  schedules: ScheduleBlock[];
  onInstructorDrop: (scheduleId: string, instructorId: string, instructorName: string) => void;
  onRoomDrop: (scheduleId: string, roomId: string, roomName: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${day}-${hour}`,
    data: { day, hour }
  });

  // Find schedules in this cell
  const cellSchedules = schedules.filter(s => {
    if (s.dayOfWeek !== day) return false;
    const [startHour] = s.startTime.split(':').map(Number);
    return startHour === hour;
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-b border-gray-200 dark:border-gray-700 relative min-h-[60px] ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {cellSchedules.map(schedule => (
        <ScheduleBlockComponent 
          key={schedule.id} 
          schedule={schedule} 
          onInstructorDrop={onInstructorDrop}
          onRoomDrop={onRoomDrop}
        />
      ))}
    </div>
  );
}

// Schedule block component - now draggable and accepts instructor/room drops
function ScheduleBlockComponent({ schedule, onInstructorDrop, onRoomDrop }: { 
  schedule: ScheduleBlock;
  onInstructorDrop: (scheduleId: string, instructorId: string, instructorName: string) => void;
  onRoomDrop: (scheduleId: string, roomId: string, roomName: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${schedule.id}`,
    data: { schedule, type: 'scheduled' }
  });

  const durationHours = schedule.duration / 60;
  const height = durationHours * SLOT_HEIGHT;

  const style = {
    backgroundColor: schedule.color,
    height: `${height}px`,
    zIndex: isDragging ? 20 : 10,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check for instructor drop
    const instructorId = e.dataTransfer.getData('instructorId');
    const instructorName = e.dataTransfer.getData('instructorName');
    if (instructorId && instructorName) {
      onInstructorDrop(schedule.id, instructorId, instructorName);
      return;
    }
    
    // Check for room drop
    const roomId = e.dataTransfer.getData('roomId');
    const roomName = e.dataTransfer.getData('roomName');
    if (roomId && roomName) {
      onRoomDrop(schedule.id, roomId, roomName);
      return;
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="absolute inset-x-1 rounded p-2 text-white text-xs overflow-hidden hover:opacity-90 hover:shadow-lg transition-shadow"
      style={style}
    >
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-3 w-3" />
        <p className="font-bold truncate flex-1">{schedule.courseCode}</p>
      </div>
      <p className="truncate">{schedule.courseName}</p>
      <div className="flex items-center gap-1 mt-1">
        <Clock className="h-3 w-3" />
        <span>{schedule.startTime} - {schedule.endTime}</span>
      </div>
      <div className="flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        <span className="truncate">{schedule.roomName}</span>
      </div>
      <div className="flex items-center gap-1">
        <User className="h-3 w-3" />
        <span className="truncate">{schedule.instructorName}</span>
      </div>
    </div>
  );
}

export function ScheduleBuilder() {
  const [unscheduledCourses, setUnscheduledCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([]); // All schedules from DB
  const [allSchedulesFromDB, setAllSchedulesFromDB] = useState<ScheduleBlock[]>([]); // Keep original DB data
  const [allCoursesFromDB, setAllCoursesFromDB] = useState<Course[]>([]); // Keep all courses from DB
  const [rooms, setRooms] = useState<Room[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Removed selectedRoom - no default room selection
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [scheduleSemester, setScheduleSemester] = useState<string>('First Term');
  const [scheduleYear, setScheduleYear] = useState<number>(new Date().getFullYear());
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [modifiedScheduleIds, setModifiedScheduleIds] = useState<Set<string>>(new Set());
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<Set<string>>(new Set());
  const [showAutoGenerateDialog, setShowAutoGenerateDialog] = useState(false);
  const [availableTerms, setAvailableTerms] = useState<{semesters: string[], yearLevels: string[]}>({semesters: [], yearLevels: []});
  const [autoGenConfig, setAutoGenConfig] = useState({semester: '', year: new Date().getFullYear(), academicYear: '', saveToDatabase: true});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Reload and filter schedules when year, semester, or section changes
  useEffect(() => {
    if (selectedYearLevel && selectedSection) {
      filterSchedulesForCurrentView();
    }
  }, [selectedYearLevel, selectedSection, scheduleSemester, scheduleYear]);

  const getRandomColor = () => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
      '#10b981', '#06b6d4', '#6366f1', '#f97316'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesRes, schedulesRes, roomsRes, instructorsRes] = await Promise.all([
        apiService.getCourses(),
        apiService.getSchedules(),
        apiService.getRooms(),
        apiService.getInstructors()
      ]);

      const allCourses = coursesRes.courses || coursesRes.data || [];
      const allSchedules = schedulesRes.schedules || schedulesRes.data || [];
      const allRooms = roomsRes.rooms || roomsRes.data || [];
      const allInstructors = instructorsRes.instructors || instructorsRes.data || [];

      setRooms(allRooms);
      setInstructors(allInstructors);
      setAllCoursesFromDB(allCourses); // Store all courses
      
      console.log('📚 Loaded from database:', {
        courses: allCourses.length,
        schedules: allSchedules.length,
        rooms: allRooms.length,
        instructors: allInstructors.length
      });

      // Convert existing schedules to blocks
      const blocks: ScheduleBlock[] = allSchedules.map((s: any, idx: number) => {
        // Calculate duration from start/end times if not provided
        let duration = s.duration;
        if (!duration && s.startTime && s.endTime) {
          const [startH, startM] = s.startTime.split(':').map(Number);
          const [endH, endM] = s.endTime.split(':').map(Number);
          duration = (endH * 60 + endM) - (startH * 60 + startM);
        }
        if (!duration) duration = 60; // fallback
        
        return {
          id: s._id || `schedule-${idx}`,
          courseId: s.courseId?._id || s.courseId || '',
          courseCode: s.courseId?.code || s.courseCode || '',
          courseName: s.courseId?.name || s.courseName || '',
          instructorId: s.instructorId?._id || s.instructorId || '',
          instructorName: s.instructorId?.userId?.name || s.instructorName || 'TBA',
          roomId: s.roomId?._id || s.roomId || '',
          roomName: s.roomId?.name || s.roomName || 'TBA',
          dayOfWeek: s.dayOfWeek || '',
          startTime: s.startTime || '',
          endTime: s.endTime || '',
          duration,
          color: getRandomColor(),
          yearLevel: s.yearLevel,
          section: s.section,
          year: s.year,
          semester: s.semester
        };
      });
      
      // Store all schedules from DB
      setAllSchedulesFromDB(blocks);
      
      // Filter for current view if section is selected
      if (selectedYearLevel && selectedSection) {
        filterSchedulesForCurrentView(blocks, allCourses);
      } else {
        setSchedules(blocks);
        setUnscheduledCourses(allCourses);
      }

    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  // Filter schedules for the currently selected year/semester/section
  const filterSchedulesForCurrentView = (schedulesToFilter?: ScheduleBlock[], coursesToFilter?: Course[]) => {
    const blocks = schedulesToFilter || allSchedulesFromDB;
    const allCourses = coursesToFilter || allCoursesFromDB;
    
    if (!selectedYearLevel || !selectedSection) {
      setSchedules([]);
      setUnscheduledCourses([]);
      return;
    }

    console.log('🔍 Filtering schedules:', {
      totalBlocks: blocks.length,
      selectedYear: scheduleYear,
      selectedSemester: scheduleSemester,
      selectedYearLevel,
      selectedSection
    });

    // Filter schedules that match current year, semester, yearLevel, and section
    const filtered = blocks.filter((s: any) => {
      const matches = (
        String(s.year) === String(scheduleYear) &&
        s.semester === scheduleSemester &&
        String(s.yearLevel) === String(selectedYearLevel) &&
        String(s.section) === String(selectedSection)
      );
      
      if (!matches) {
        console.log('❌ Schedule filtered out:', {
          courseCode: s.courseCode,
          scheduleYear: s.year,
          scheduleSemester: s.semester,
          scheduleYearLevel: s.yearLevel,
          scheduleSection: s.section
        });
      }
      
      return matches;
    });
    
    console.log(`✅ Filtered: ${filtered.length} schedules match`);
    setSchedules(filtered);

    // Find unscheduled courses for this section
    const scheduledCourseIds = new Set(filtered.map(b => b.courseId));
    const unscheduled = allCourses.filter((c: Course) => 
      !scheduledCourseIds.has(c._id) &&
      String(c.yearLevel) === String(selectedYearLevel) &&
      String(c.section) === String(selectedSection)
    );
    
    console.log('📖 Unscheduled courses for this section:', {
      totalCourses: allCourses.length,
      matchingYearLevel: allCourses.filter(c => String(c.yearLevel) === String(selectedYearLevel)).length,
      matchingSection: allCourses.filter(c => String(c.section) === String(selectedSection)).length,
      unscheduledCount: unscheduled.length,
      unscheduledCourses: unscheduled.map(c => c.code)
    });
    
    setUnscheduledCourses(unscheduled);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  // Handle instructor drop onto schedule block
  const handleInstructorDrop = (scheduleId: string, instructorId: string, instructorName: string) => {
    // Check if instructor has conflict at this time
    const targetSchedule = schedules.find(s => s.id === scheduleId);
    if (!targetSchedule) return;

    // Check if instructor is already teaching at this time on this day (CHECK ALL SCHEDULES GLOBALLY)
    const instructorConflict = allSchedulesFromDB.find(s => 
      s.id !== scheduleId &&
      s.dayOfWeek === targetSchedule.dayOfWeek &&
      s.instructorId === instructorId &&
      (
        (s.startTime <= targetSchedule.startTime && s.endTime > targetSchedule.startTime) ||
        (s.startTime < targetSchedule.endTime && s.endTime >= targetSchedule.endTime) ||
        (s.startTime >= targetSchedule.startTime && s.endTime <= targetSchedule.endTime)
      )
    );

    if (instructorConflict) {
      const conflictSection = instructorConflict.yearLevel && instructorConflict.section 
        ? `Year ${instructorConflict.yearLevel}-${instructorConflict.section}` 
        : 'another section';
      toast.error(`${instructorName} is already teaching ${instructorConflict.courseCode} (${conflictSection}) at this time`);
      return;
    }

    // Update both schedules and allSchedulesFromDB atomically
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId 
        ? { ...s, instructorId, instructorName }
        : s
    ));
    
    // Update allSchedulesFromDB separately to avoid triggering useEffect re-filter
    setAllSchedulesFromDB(prev => {
      const updated = prev.map(s => 
        s.id === scheduleId 
          ? { ...s, instructorId, instructorName }
          : s
      );
      return updated;
    });

    // Mark as modified if it's not a new schedule
    if (!scheduleId.startsWith('temp-')) {
      setModifiedScheduleIds(prev => new Set(prev).add(scheduleId));
    }

    toast.success(`Assigned ${instructorName} to ${targetSchedule.courseCode}`);
  };

  // Handle room drop onto schedule block
  const handleRoomDrop = (scheduleId: string, roomId: string, roomName: string) => {
    // Check if room has conflict at this time
    const targetSchedule = schedules.find(s => s.id === scheduleId);
    if (!targetSchedule) return;

    // Check if room is already occupied at this time on this day (CHECK ALL SCHEDULES GLOBALLY)
    const roomConflict = allSchedulesFromDB.find(s => 
      s.id !== scheduleId &&
      s.dayOfWeek === targetSchedule.dayOfWeek &&
      s.roomId === roomId &&
      (
        (s.startTime <= targetSchedule.startTime && s.endTime > targetSchedule.startTime) ||
        (s.startTime < targetSchedule.endTime && s.endTime >= targetSchedule.endTime) ||
        (s.startTime >= targetSchedule.startTime && s.endTime <= targetSchedule.endTime)
      )
    );

    if (roomConflict) {
      const conflictSection = roomConflict.yearLevel && roomConflict.section 
        ? `Year ${roomConflict.yearLevel}-${roomConflict.section}` 
        : 'another section';
      toast.error(`${roomName} is already occupied by ${roomConflict.courseCode} (${conflictSection}) at this time`);
      return;
    }

    // Update the schedule with the new room
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId 
        ? { ...s, roomId, roomName }
        : s
    ));
    
    // Also update allSchedulesFromDB for global conflict checking
    setAllSchedulesFromDB(prev => prev.map(s => 
      s.id === scheduleId 
        ? { ...s, roomId, roomName }
        : s
    ));

    // Mark as modified if it's not a new schedule
    if (!scheduleId.startsWith('temp-')) {
      setModifiedScheduleIds(prev => new Set(prev).add(scheduleId));
    }

    toast.success(`Assigned ${roomName} to ${targetSchedule.courseCode}`);
  };

  // Helper function to check for time overlap
  const checkOverlap = (newBlock: { dayOfWeek: string; startTime: string; endTime: string; roomId?: string; instructorId?: string }, excludeId?: string) => {
    // Convert time string "HH:MM" to minutes since midnight
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStart = timeToMinutes(newBlock.startTime);
    const newEnd = timeToMinutes(newBlock.endTime);
    
    const conflicts = schedules.filter(s => {
      if (s.id === excludeId) return false; // Exclude the block being moved
      if (s.dayOfWeek !== newBlock.dayOfWeek) return false;
      
      const existingStart = timeToMinutes(s.startTime);
      const existingEnd = timeToMinutes(s.endTime);
      
      // Check time overlap
      const timeOverlap = newStart < existingEnd && existingStart < newEnd;
      if (!timeOverlap) return false;
      
      // ANY time overlap is a conflict - no two courses can be at the same time
      // This prevents scheduling conflicts regardless of room
      return true;
    });
    
    return conflicts;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current;
    const dropData = over.data.current;

    if (!dragData || !dropData) return;

    // Handle dropping scheduled block back to unscheduled area (DRAG BACK SUBJECTS)
    if (dragData.type === 'scheduled' && dropData.type === 'unscheduled-area') {
      const schedule = dragData.schedule as ScheduleBlock;
      
      console.log(`📤 Dragging back: ${schedule.courseCode}`);
      
      // Remove from schedules state immediately for visual feedback
      setSchedules(prevSchedules => prevSchedules.filter(s => s.id !== schedule.id));
      
      // Remove from modified tracking if it was there
      if (modifiedScheduleIds.has(schedule.id)) {
        const newModified = new Set(modifiedScheduleIds);
        newModified.delete(schedule.id);
        setModifiedScheduleIds(newModified);
      }
      
      // Apply changes immediately if it's a persisted schedule
      if (!schedule.id.startsWith('temp-')) {
        console.log(`🗑️ Deleting schedule immediately: ${schedule.id}`);
        
        // Delete from database immediately
        apiService.deleteSchedule(schedule.id)
          .then(() => {
            console.log(`✅ Deleted: ${schedule.id}`);
            toast.success(`${schedule.courseCode} removed from schedule`);
          })
          .catch(err => {
            console.error(`❌ Failed to delete schedule ${schedule.id}:`, err);
            toast.error(`Failed to remove ${schedule.courseCode} from schedule`);
            // Restore the schedule to state if deletion failed
            const course: Course = {
              _id: schedule.courseId,
              code: schedule.courseCode,
              name: schedule.courseName,
              credits: 3,
              type: 'lecture',
              duration: schedule.duration,
              instructorName: schedule.instructorName,
              department: 'IT',
              yearLevel: (schedule as any).yearLevel,
              section: (schedule as any).section,
              semester: (schedule as any).semester
            };
            setSchedules(prev => [...prev, schedule]);
          });
      } else {
        // If it's a new temp schedule being dragged back, just remove it (no deletion needed)
        console.log(`🧹 Removing temp schedule: ${schedule.id}`);
        toast.success(`${schedule.courseCode} removed from schedule`);
      }
      
      // Add course back to unscheduled list if not already there
      const courseExists = unscheduledCourses.some(c => c._id === schedule.courseId);
      if (!courseExists) {
        const course: Course = {
          _id: schedule.courseId,
          code: schedule.courseCode,
          name: schedule.courseName,
          credits: 3,
          type: 'lecture',
          duration: schedule.duration,
          instructorName: schedule.instructorName,
          department: 'IT',
          yearLevel: (schedule as any).yearLevel,
          section: (schedule as any).section,
          semester: (schedule as any).semester
        };
        setUnscheduledCourses(prev => [...prev, course]);
        console.log(`➕ Added back to unscheduled: ${schedule.courseCode}`);
      }
      
      return;
    }

    // Handle dropping unscheduled course onto calendar
    if (dragData.type === 'unscheduled' && dropData.day && dropData.hour !== undefined) {
      // active.data.current contains `{ course, type: 'unscheduled' }`
      const course = dragData.course as Course;
      const { day, hour } = dropData;

      // No default room - will be assigned later or remain TBA
      const roomId = undefined;
      const roomName = 'TBA';
      const instructorId = selectedInstructor || undefined;
      const instructorName = (instructors.find(i => i._id === instructorId)?.userId?.name) || 'TBA';
      const yearLevel = selectedYearLevel || (course as any)['yearLevel'] || '';
      const section = selectedSection || (course as any)['section'] || '';

      // Calculate exact end time based on duration in minutes
      const durationMinutes = course.duration;
      const startHour = hour;
      const startMinute = 0;
      const endTotalMinutes = startHour * 60 + startMinute + durationMinutes;
      const endHour = Math.floor(endTotalMinutes / 60);
      const endMinute = endTotalMinutes % 60;
      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      const newBlock: ScheduleBlock = {
        id: `temp-${Date.now()}`,
        courseId: course._id,
        courseCode: course.code,
        courseName: course.name,
        instructorName,
        roomName,
        roomId,
        instructorId,
        dayOfWeek: day,
        startTime,
        endTime,
        duration: course.duration,
        color: getRandomColor(),
        yearLevel: selectedYearLevel,
        section: selectedSection,
        year: scheduleYear,
        semester: scheduleSemester
      };

      // Check for overlaps
      const conflicts = checkOverlap(newBlock);
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => 
          `${c.courseCode} (${c.startTime}-${c.endTime})`
        );
        toast.error(`Cannot schedule: Conflicts with ${conflictMessages.join(', ')}`);
        return;
      }

      setSchedules(prev => [...prev, newBlock]);
      setUnscheduledCourses(prev => prev.filter(c => c._id !== course._id));
      toast.success(`${course.code} scheduled for ${day} at ${startTime}-${endTime}`);
    }
    
    // Handle moving existing schedule block to new time slot
    if (dragData.type === 'scheduled' && dropData.day && dropData.hour !== undefined) {
      const schedule = dragData.schedule as ScheduleBlock;
      const { day, hour } = dropData;

      // Calculate exact end time based on duration in minutes
      const durationMinutes = schedule.duration;
      const startHour = hour;
      const startMinute = 0;
      const endTotalMinutes = startHour * 60 + startMinute + durationMinutes;
      const endHour = Math.floor(endTotalMinutes / 60);
      const endMinute = endTotalMinutes % 60;
      const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      // Check for overlaps when moving
      const movedBlock = {
        dayOfWeek: day,
        startTime,
        endTime,
        roomId: schedule.roomId,
        instructorId: schedule.instructorId
      };
      
      const conflicts = checkOverlap(movedBlock, schedule.id);
      if (conflicts.length > 0) {
        const conflictMessages = conflicts.map(c => 
          `${c.courseCode} (${c.startTime}-${c.endTime})`
        );
        toast.error(`Cannot move: Conflicts with ${conflictMessages.join(', ')}`);
        return;
      }

      const updatedSchedules = schedules.map(s => {
        if (s.id === schedule.id) {
          return {
            ...s,
            dayOfWeek: day,
            startTime,
            endTime
          };
        }
        return s;
      });

      setSchedules(updatedSchedules);
      
      if (!schedule.id.startsWith('temp-')) {
        setModifiedScheduleIds(prev => new Set(prev).add(schedule.id));
      }
      
      toast.success(`${schedule.courseCode} moved to ${day} at ${startTime}-${endTime}`);
    }
  };

  const handleSaveSchedules = async () => {
    try {
      const newSchedules = schedules.filter(s => s.id.startsWith('temp-'));
      const modifiedSchedules = schedules.filter(s => modifiedScheduleIds.has(s.id));
      
      let createdCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      
      console.log(`📊 Save Summary: ${newSchedules.length} new, ${modifiedSchedules.length} modified, ${deletedScheduleIds.size} to delete`);
      
      // Create new schedules
      for (const schedule of newSchedules) {
        try {
          const payload = {
            courseId: schedule.courseId,
            instructorId: schedule.instructorId || undefined,
            roomId: schedule.roomId || undefined,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            duration: schedule.duration, // Preserve course duration in minutes
            semester: scheduleSemester,
            year: Number(scheduleYear),
            academicYear: `${scheduleYear}-${Number(scheduleYear) + 1}`,
            yearLevel: selectedYearLevel || undefined,
            section: selectedSection || undefined,
            status: 'published'
          };
          
          // Remove undefined/empty fields to avoid validation issues
          Object.keys(payload).forEach(key => {
            if (payload[key] === undefined || payload[key] === '' || payload[key] === null) {
              delete payload[key];
            }
          });
          
          console.log('📤 Creating schedule with payload:', payload);
          const result = await apiService.createSchedule(payload);
          if (result?.success) {
            createdCount++;
            console.log(`✅ Created: ${schedule.courseCode}`);
          } else {
            console.error(`❌ Failed to create ${schedule.courseCode}:`, result);
            if (result?.conflicts?.length) {
              toast.error(`Conflicts for ${schedule.courseCode}: ${result.conflicts.join('; ')}`);
            } else {
              toast.error(`Failed to create schedule for ${schedule.courseCode}`);
            }
          }
        } catch (err) {
          console.error(`❌ Failed to create ${schedule.courseCode}:`, err);
          toast.error(`Failed to create schedule for ${schedule.courseCode}`);
        }
      }
      
      // Update modified schedules
      for (const schedule of modifiedSchedules) {
        try {
          const updatePayload = {
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            instructorId: schedule.instructorId || undefined,
            roomId: schedule.roomId || undefined,
            semester: scheduleSemester,
            year: Number(scheduleYear)
          };
          
          // Remove undefined fields
          Object.keys(updatePayload).forEach(key => {
            if (updatePayload[key] === undefined || updatePayload[key] === '' || updatePayload[key] === null) {
              delete updatePayload[key];
            }
          });
          
          console.log(`📝 Updating ${schedule.courseCode} with:`, updatePayload);
          await apiService.updateSchedule(schedule.id, updatePayload);
          updatedCount++;
          console.log(`✅ Updated: ${schedule.courseCode}`);
        } catch (err) {
          console.error(`❌ Failed to update ${schedule.courseCode}:`, err);
          toast.error(`Failed to update schedule for ${schedule.courseCode}`);
        }
      }

      // DELETE schedules that were dragged back to unscheduled
      for (const scheduleId of deletedScheduleIds) {
        try {
          await apiService.deleteSchedule(scheduleId);
          deletedCount++;
          console.log(`🗑️ Deleted: ${scheduleId}`);
        } catch (err) {
          console.error(`❌ Failed to delete schedule ${scheduleId}:`, err);
          toast.error(`Failed to delete schedule`);
        }
      }

      const messages = [];
      if (createdCount > 0) messages.push(`${createdCount} created`);
      if (updatedCount > 0) messages.push(`${updatedCount} updated`);
      if (deletedCount > 0) messages.push(`${deletedCount} deleted`);
      
      if (messages.length > 0) {
        toast.success(`✅ Schedules saved: ${messages.join(', ')}`);
      } else {
        toast.info('No changes to save');
      }
      
      // Clear tracking sets after successful save
      setModifiedScheduleIds(new Set());
      setDeletedScheduleIds(new Set());
      
      // Reload data to sync with database
      await loadData();
    } catch (error) {
      console.error('Failed to save schedules:', error);
      toast.error('Failed to save schedules. Please try again.');
    }
  };

  const loadAvailableTerms = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/schedules/available-terms', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setAvailableTerms(data.data);
        if (data.data.semesters.length > 0) {
          setAutoGenConfig(prev => ({ ...prev, semester: data.data.semesters[0] }));
        }
      }
    } catch (error) {
      console.error('Failed to load available terms:', error);
      toast.error('Failed to load available terms');
    }
  };

  const handleAutoGenerate = async () => {
    if (!autoGenConfig.semester) {
      toast.error('Please select a semester');
      return;
    }

    try {
      setGenerating(true);
      const response = await fetch('http://localhost:3001/api/schedules/auto-generate', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('token')}`
         },
         body: JSON.stringify({
           semester: autoGenConfig.semester,
           year: autoGenConfig.year,
           academicYear: autoGenConfig.academicYear || `${autoGenConfig.year}-${autoGenConfig.year + 1}`,
           saveToDatabase: autoGenConfig.saveToDatabase,
           // include cohort info when requested (optional)
           yearLevel: selectedYearLevel || undefined,
           section: selectedSection || undefined,
           startTime: '07:00',
           endTime: '18:00'
         })
       });

       const result = await response.json();
       
       if (result.success) {
         toast.success(`Generated ${result.stats.scheduledCourses} schedules successfully!`);
         setShowAutoGenerateDialog(false);
         loadData(); // Reload to show new schedules
       } else {
         toast.error(result.message || 'Failed to generate schedules');
       }
     } catch (error) {
       console.error('Auto-generate error:', error);
       toast.error('Failed to auto-generate schedules');
     } finally {
       setGenerating(false);
     }
   };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Schedule Builder</h2>
            <p className="text-gray-600 dark:text-gray-400">Drag and drop courses to create schedules</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                loadAvailableTerms();
                setShowAutoGenerateDialog(true);
              }}
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Auto Generate
            </Button>
            <Button 
              onClick={handleSaveSchedules} 
              disabled={!schedules.some(s => s.id.startsWith('temp-')) && modifiedScheduleIds.size === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
              {(schedules.some(s => s.id.startsWith('temp-')) || modifiedScheduleIds.size > 0) && (
                <span className="ml-2 bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {schedules.filter(s => s.id.startsWith('temp-')).length + modifiedScheduleIds.size}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 block">Academic Year & Semester</label>
              <div className="flex gap-2">
                <select 
                  className="text-sm border rounded p-2 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                  value={scheduleYear} 
                  onChange={(e) => setScheduleYear(parseInt(e.target.value))}
                >
                  <option value="2021">2021-2022</option>
                  <option value="2022">2022-2023</option>
                  <option value="2023">2023-2024</option>
                  <option value="2024">2024-2025</option>
                  <option value="2025">2025-2026</option>
                  <option value="2026">2026-2027</option>
                </select>
                <select 
                  className="text-sm border rounded p-2 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                  value={scheduleSemester} 
                  onChange={(e) => setScheduleSemester(e.target.value)}
                >
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-4" aria-label="Sections">
              {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'].map((section) => {
                const [year, sec] = [section[0], section[1]];
                const isActive = selectedYearLevel === year && selectedSection === sec;
                return (
                  <button
                    key={section}
                    onClick={() => {
                      setSelectedYearLevel(year);
                      setSelectedSection(sec);
                    }}
                    className={`
                      px-4 py-2 text-sm font-medium border-b-2 transition-colors
                      ${
                        isActive
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    Year {year} - Section {sec}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Unscheduled Courses Sidebar */}
          <div className="col-span-3">
            <Card className="shadow-sm">
              <CardHeader className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b">
                 <CardTitle className="text-lg text-gray-900 dark:text-white">Unscheduled Courses</CardTitle>
                 <p className="text-sm text-gray-600 dark:text-gray-400">{unscheduledCourses.length} courses</p>
               </CardHeader>
               <CardContent>
                 {/* Resources Section */}
                 <div className="mb-4 space-y-2">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      📚 Currently Viewing: Year {selectedYearLevel} - Section {selectedSection}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {scheduleSemester} {scheduleYear}-{scheduleYear + 1}
                    </p>
                  </div>
                  <hr className="my-2" />
                   <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Available Instructors ({instructors.length})</label>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Drag instructors onto schedule blocks to assign</p>
                   <div className="space-y-2 max-h-[300px] overflow-y-auto">
                     {instructors.length === 0 ? (
                       <p className="text-sm text-gray-500 p-2">No instructors available</p>
                     ) : (
                       instructors.map(instructor => (
                       <div
                         key={instructor._id}
                         draggable
                         onDragStart={(e) => {
                           e.dataTransfer.setData('instructorId', instructor._id);
                           e.dataTransfer.setData('instructorName', instructor.userId?.name || 'Unknown');
                         }}
                         className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded cursor-move hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                       >
                         <div className="flex items-center gap-2">
                           <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                           <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                             {instructor.userId?.name || 'Unknown'}
                           </span>
                         </div>
                         <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">
                           {instructor.userId?.department || 'No department'}
                         </p>
                       </div>
                     ))
                     )}
                   </div>

                   <hr className="my-2" />
                   <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Available Rooms</label>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Drag rooms onto schedule blocks to assign</p>
                   <div className="space-y-2 max-h-[300px] overflow-y-auto">
                     {rooms.map(room => (
                       <div
                         key={room._id}
                         draggable
                         onDragStart={(e) => {
                           e.dataTransfer.setData('roomId', room._id);
                           e.dataTransfer.setData('roomName', room.name);
                         }}
                         className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded cursor-move hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                       >
                         <div className="flex items-center gap-2">
                           <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                           <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                             {room.name}
                           </span>
                         </div>
                         <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">
                           {room.building} {room.capacity ? `• ${room.capacity} seats` : ''}
                         </p>
                       </div>
                     ))}
                   </div>
                 </div>

                {/* Show only courses for selected cohort to avoid duplicates across sections */}
                {!selectedYearLevel || !selectedSection ? (
                  <div className="p-3 text-sm text-gray-500 text-center">
                    <p className="mb-2">👆 Click a section tab above to view courses</p>
                    <p className="text-xs">Example: Year 1 - Section A</p>
                  </div>
                ) : (
                  <UnscheduledCoursesArea 
                    courses={[...unscheduledCourses]
                      .filter(c => String(c.yearLevel) === String(selectedYearLevel) && String(c.section) === String(selectedSection))
                      .sort((a, b) => a.code.localeCompare(b.code))}
                    onDrop={() => {}}
                  />
                )}
               </CardContent>
             </Card>
           </div>

          {/* Calendar Grid */}
          <div className="col-span-9">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[calc(100vh-200px)]">
                  <div className="min-w-[800px]">
                    {/* Header Row */}
                    <div className="grid grid-cols-7 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-20">
                      <div className="p-2 border-r border-gray-300 dark:border-gray-700 font-semibold text-sm text-gray-700 dark:text-gray-200">Time</div>
                      {DAYS.map(day => (
                        <div key={day} className="p-2 border-r border-gray-300 dark:border-gray-700 font-semibold text-sm text-center text-gray-700 dark:text-gray-200">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    {TIME_SLOTS.map(slot => (
                      <div key={slot.hour} className="grid grid-cols-7">
                        <div className="p-2 border-r border-b border-gray-300 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                          {slot.label}
                        </div>
                        {DAYS.map(day => (
                          <CalendarCell
                            key={`${day}-${slot.hour}`}
                            day={day}
                            hour={slot.hour}
                            schedules={schedules}
                            onInstructorDrop={handleInstructorDrop}
                            onRoomDrop={handleRoomDrop}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragId ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-lg opacity-90">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <p className="font-semibold text-sm">
                {activeDragId.startsWith('unscheduled-') 
                  ? 'Dragging course...' 
                  : 'Moving schedule...'}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Auto Generate Dialog */}
      <Dialog open={showAutoGenerateDialog} onOpenChange={setShowAutoGenerateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Auto Generate Schedules</DialogTitle>
            <DialogDescription>
              Automatically generate schedules for all year levels and sections based on available courses.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="semester">Semester / Term</Label>
              <Select
                value={autoGenConfig.semester}
                onValueChange={(value) => setAutoGenConfig(prev => ({ ...prev, semester: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.semesters.map(sem => (
                    <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Academic Year</Label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                value={autoGenConfig.year}
                onChange={(e) => setAutoGenConfig(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                min={2020}
                max={2030}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Academic year: {autoGenConfig.year}-{autoGenConfig.year + 1}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-gray-100">Generation Settings:</h4>
              <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Schedules for all 4 year levels (1-4)</li>
                <li>• 2 sections per year level (A & B)</li>
                <li>• Monday to Saturday (07:00 - 18:00)</li>
                <li>• Lunch break: 12:00-13:00 (Wed: 12:00-14:00)</li>
                <li>• Automatic conflict detection</li>
                <li>• Room assignment based on capacity</li>
                <li>• Different rooms for simultaneous classes</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoGenerateDialog(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleAutoGenerate} disabled={generating || !autoGenConfig.semester}>
              {generating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Schedules
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
