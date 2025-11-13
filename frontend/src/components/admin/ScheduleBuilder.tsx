import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Clock, MapPin, User, GripVertical, Save, Sparkles } from 'lucide-react';
import { apiService } from '../services/api';
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
      )}
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
function CalendarCell({ day, hour, schedules, selectedRoom }: { 
  day: string; 
  hour: number; 
  schedules: ScheduleBlock[];
  selectedRoom?: string;
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

  // Filter by selected room if one is selected
  const filteredSchedules = selectedRoom 
    ? cellSchedules.filter(s => s.roomId === selectedRoom)
    : cellSchedules;

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-b border-gray-200 dark:border-gray-700 relative min-h-[60px] ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {filteredSchedules.map(schedule => (
        <ScheduleBlockComponent key={schedule.id} schedule={schedule} />
      ))}
    </div>
  );
}

// Schedule block component - now draggable
function ScheduleBlockComponent({ schedule }: { schedule: ScheduleBlock }) {
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

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute inset-x-1 rounded p-2 text-white text-xs overflow-hidden cursor-grab active:cursor-grabbing hover:opacity-90 hover:shadow-lg transition-shadow"
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
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [modifiedScheduleIds, setModifiedScheduleIds] = useState<Set<string>>(new Set());
  const [showAutoGenerateDialog, setShowAutoGenerateDialog] = useState(false);
  const [availableTerms, setAvailableTerms] = useState<{semesters: string[], yearLevels: string[]}>({semesters: [], yearLevels: []});
  const [autoGenConfig, setAutoGenConfig] = useState({semester: '', year: new Date().getFullYear(), academicYear: '', saveToDatabase: true});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesRes, schedulesRes, roomsRes, instructorsRes] = await Promise.all([
        apiService.getCourses(),
        apiService.getSchedules(),
        apiService.getRooms(),
        fetch('http://localhost:3001/api/instructors', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.json())
      ]);

      const allCourses = coursesRes.courses || coursesRes.data || [];
      const allSchedules = schedulesRes.schedules || schedulesRes.data || [];
      const allRooms = roomsRes.rooms || roomsRes.data || [];
      const allInstructors = instructorsRes.instructors || instructorsRes.data || [];

      setRooms(allRooms);
      setInstructors(allInstructors);

      // Convert existing schedules to blocks
      const blocks: ScheduleBlock[] = allSchedules.map((s: any, idx: number) => ({
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
        duration: s.duration || 60,
        color: getRandomColor()
      }));
      setSchedules(blocks);

      // Find unscheduled courses
      const scheduledCourseIds = new Set(blocks.map(b => b.courseId));
      const unscheduled = allCourses.filter((c: Course) => !scheduledCourseIds.has(c._id));
      setUnscheduledCourses(unscheduled);

    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const getRandomColor = () => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
      '#10b981', '#06b6d4', '#6366f1', '#f97316'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    
    const { active, over } = event;
    if (!over) return;

    const dragData = active.data.current;
    const dropData = over.data.current;

    if (!dragData || !dropData) return;

    // Handle dropping scheduled block back to unscheduled area
    if (dragData.type === 'scheduled' && dropData.type === 'unscheduled-area') {
      const schedule = dragData.schedule as ScheduleBlock;
      
      // Remove from schedules
      setSchedules(schedules.filter(s => s.id !== schedule.id));
      
      // Remove from modified tracking if it was there
      if (modifiedScheduleIds.has(schedule.id)) {
        const newModified = new Set(modifiedScheduleIds);
        newModified.delete(schedule.id);
        setModifiedScheduleIds(newModified);
      }
      
      // Add back to unscheduled courses if not already there
      const courseExists = unscheduledCourses.some(c => c._id === schedule.courseId);
      if (!courseExists) {
        // Reconstruct course object from schedule
        const course: Course = {
          _id: schedule.courseId,
          code: schedule.courseCode,
          name: schedule.courseName,
          credits: 3, // Default value
          type: 'lecture',
          duration: schedule.duration,
          instructorName: schedule.instructorName
        };
        setUnscheduledCourses([...unscheduledCourses, course]);
      }
      
      toast.success(`${schedule.courseCode} removed from schedule`);
      return;
    }

    // Handle dropping unscheduled course onto calendar
    if (dragData.type === 'unscheduled' && dropData.day && dropData.hour !== undefined) {
      const course = dragData.course as Course;
      const { day, hour } = dropData;

      // Calculate end time
      const durationHours = Math.ceil(course.duration / 60);
      const endHour = hour + durationHours;
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;

      // Create new schedule block
      const newBlock: ScheduleBlock = {
        id: `temp-${Date.now()}`,
        courseId: course._id,
        courseCode: course.code,
        courseName: course.name,
        instructorName: course.instructorName || 'TBA',
        roomName: selectedRoom ? rooms.find(r => r._id === selectedRoom)?.name || 'TBA' : 'TBA',
        roomId: selectedRoom,
        instructorId: selectedInstructor,
        dayOfWeek: day,
        startTime,
        endTime,
        duration: course.duration,
        color: getRandomColor()
      };

      setSchedules([...schedules, newBlock]);
      setUnscheduledCourses(unscheduledCourses.filter(c => c._id !== course._id));
      toast.success(`${course.code} scheduled for ${day} at ${startTime}`);
    }
    
    // Handle moving existing schedule block to new time slot
    if (dragData.type === 'scheduled' && dropData.day && dropData.hour !== undefined) {
      const schedule = dragData.schedule as ScheduleBlock;
      const { day, hour } = dropData;

      // Calculate new end time based on duration
      const durationHours = Math.ceil(schedule.duration / 60);
      const endHour = hour + durationHours;
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;

      // Update the schedule with new day and time
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
      
      // Mark as modified if it's not a new schedule
      if (!schedule.id.startsWith('temp-')) {
        setModifiedScheduleIds(prev => new Set(prev).add(schedule.id));
      }
      
      toast.success(`${schedule.courseCode} moved to ${day} at ${startTime}`);
    }
  };

  const handleSaveSchedules = async () => {
    try {
      // Save all new schedules
      const newSchedules = schedules.filter(s => s.id.startsWith('temp-'));
      const modifiedSchedules = schedules.filter(s => modifiedScheduleIds.has(s.id));
      
      let createdCount = 0;
      let updatedCount = 0;
      
      // Create new schedules
      for (const schedule of newSchedules) {
        await apiService.createSchedule({
          courseId: schedule.courseId,
          instructorId: schedule.instructorId || undefined,
          roomId: schedule.roomId || undefined,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          status: 'published'
        });
        createdCount++;
      }
      
      // Update modified schedules
      for (const schedule of modifiedSchedules) {
        await apiService.updateSchedule(schedule.id, {
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        });
        updatedCount++;
      }

      const messages = [];
      if (createdCount > 0) messages.push(`${createdCount} created`);
      if (updatedCount > 0) messages.push(`${updatedCount} updated`);
      
      toast.success(`Schedules saved: ${messages.join(', ')}`);
      setModifiedScheduleIds(new Set()); // Clear modified tracking
      loadData(); // Reload to get persisted IDs
    } catch (error) {
      console.error('Failed to save schedules:', error);
      toast.error('Failed to save schedules');
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

        <div className="grid grid-cols-12 gap-4">
          {/* Unscheduled Courses Sidebar */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 dark:text-white">Unscheduled Courses</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">{unscheduledCourses.length} courses</p>
              </CardHeader>
              <CardContent>
                {/* Default Room/Instructor Selection */}
                <div className="mb-4 space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    Filter by Room {selectedRoom && <span className="text-blue-600 dark:text-blue-400">(Active)</span>}
                  </label>
                  <select 
                    className="w-full text-sm border rounded p-2 text-gray-900 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                  >
                    <option value="">Select a room to filter</option>
                    {rooms.map(room => (
                      <option key={room._id} value={room._id}>
                        {room.name} - {room.building}
                      </option>
                    ))}
                  </select>

                  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">Default Instructor</label>
                  <select 
                    className="w-full text-sm border rounded p-2 text-gray-900 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                    value={selectedInstructor}
                    onChange={(e) => setSelectedInstructor(e.target.value)}
                  >
                    <option value="">Select Instructor</option>
                    {instructors.map(instructor => (
                      <option key={instructor._id} value={instructor._id}>
                        {instructor.userId?.name || 'Unknown'}
                      </option>
                    ))}
                  </select>
                </div>

                <UnscheduledCoursesArea 
                  courses={[...unscheduledCourses].sort((a, b) => a.code.localeCompare(b.code))}
                  onDrop={() => {}}
                />
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
                            selectedRoom={selectedRoom}
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
