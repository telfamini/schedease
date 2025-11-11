import { useState, useEffect } from 'react';
import apiService from '../services/api';
import { DashboardLayout } from '../layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  Clock,
  Users,
  Settings,
  Plus,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  CalendarDays,
  Bell,
  Download,
  Upload,
  XCircle
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';

interface Schedule {
  _id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  roomName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  studentsEnrolled: number;
  capacity: number;
  semester?: string;
  year?: number;
  isBorrowed?: boolean;
  borrowOriginalInstructorName?: string;
  borrowDate?: string;
}

interface Course {
  _id: string;
  code: string;
  name: string;
  department: string;
  credits: number;
  type: string;
  studentsEnrolled: number;
  description?: string;
}

interface Student {
  _id: string;
  name: string;
  email: string;
  studentId: string;
  year: number;
  department?: string;
  courses: string[];
  attendance?: number;
  performance?: 'excellent' | 'good' | 'average' | 'needs_improvement';
}

interface Room {
  _id: string;
  name: string;
  building: string;
  capacity: number;
  equipment?: string[];
  type?: string;
}

interface BorrowableSchedule {
  _id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  instructorId: string;
  instructorName: string;
  roomId: string;
  roomName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester?: string;
  year?: number;
  academicYear?: string;
}

interface RequestFormData {
  courseId: string;
  roomId: string;
  scheduleId?: string;
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: string;
  year: number;
  purpose: string;
  notes: string;
  type?: 'lecture' | 'lab' | 'seminar';
  requestType: 'room_change' | 'borrow_schedule';
}

interface ScheduleRequest {
  _id: string;
  type: 'room_change' | 'time_change' | 'schedule_conflict' | 'borrow_schedule';
  courseId: string;
  courseName: string;
  details: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  createdAt: string;
  requestType?: 'room_change' | 'time_change' | 'schedule_conflict' | 'borrow_schedule';
  originalInstructorName?: string;
  originalInstructorId?: string;
  borrowDate?: string;
  roomName?: string;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string;
  __raw?: any;
}

interface Availability {
  Monday: { startTime: string; endTime: string }[];
  Tuesday: { startTime: string; endTime: string }[];
  Wednesday: { startTime: string; endTime: string }[];
  Thursday: { startTime: string; endTime: string }[];
  Friday: { startTime: string; endTime: string }[];
  Saturday: { startTime: string; endTime: string }[];
  Sunday: { startTime: string; endTime: string }[];
}

// Default availability times for instructors
const DEFAULT_AVAILABILITY: Availability = {
  Monday: [{ startTime: '09:00', endTime: '17:00' }],
  Tuesday: [{ startTime: '09:00', endTime: '17:00' }],
  Wednesday: [{ startTime: '09:00', endTime: '17:00' }],
  Thursday: [{ startTime: '09:00', endTime: '17:00' }],
  Friday: [{ startTime: '09:00', endTime: '15:00' }],
  Saturday: [],
  Sunday: []
};

interface InstructorUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: 'instructor';
  department?: string;
}

interface InstructorProfile {
  _id: string;
  userId: string | InstructorUser;
  maxHoursPerWeek: number;
  specializations: string[];
  availability: Record<string, { startTime: string; endTime: string }[]>;
}

interface RoomAvailability {
  available: boolean;
  conflicts: Array<{
    roomId?: string;
    startTime: string;
    endTime: string;
    courseName?: string;
    instructorName?: string;
  }>;
}

interface RoomFilters {
  minCapacity: string;
  equipment: string[];
  building: string;
}

export function InstructorDashboard() {
  const { user } = useAuth() as { user: InstructorUser };
  const [activeTab, setActiveTab] = useState('overview');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; subjectCode: string; description: string; units: number; semester: string; schoolYear: string; yearLevel?: string; dayOfWeek?: string; startTime?: string; endTime?: string; courseId?: string; courseCode?: string; courseName?: string }>>([]);
  const [subjectFilters, setSubjectFilters] = useState<{ semester: string; yearLevel: string; course: string }>({ semester: 'all', yearLevel: 'all', course: 'all' });
  const [students, setStudents] = useState<Student[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [borrowRequestsForMe, setBorrowRequestsForMe] = useState<any[]>([]);
  const [loadingBorrowRequests, setLoadingBorrowRequests] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [borrowableSchedules, setBorrowableSchedules] = useState<BorrowableSchedule[]>([]);
  const [borrowSchedulesLoading, setBorrowSchedulesLoading] = useState(false);
  const [selectedBorrowSchedule, setSelectedBorrowSchedule] = useState<BorrowableSchedule | null>(null);
  const [instructorProfileId, setInstructorProfileId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [tempAvailabilitySlots, setTempAvailabilitySlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    scheduleReminders: true,
    studentUpdates: false
  });
  const [loading, setLoading] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [roomFilters, setRoomFilters] = useState({
    minCapacity: '0',
    equipment: [] as string[],
    building: ''
  });
  const [favoriteRooms, setFavoriteRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favoriteRooms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [roomAvailability, setRoomAvailability] = useState<Record<string, RoomAvailability>>({});
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState<string | null>(null);
  const [requestConflicts, setRequestConflicts] = useState<string[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingRequestData, setPendingRequestData] = useState<any>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [scheduleStudents, setScheduleStudents] = useState<Array<{ _id: string; name: string; email: string; studentId: string }>>([]);
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [selectedCourseForDialog, setSelectedCourseForDialog] = useState<Course | null>(null);
  const [selectedCourseScheduleId, setSelectedCourseScheduleId] = useState<string | null>(null);
  const [courseScheduleStudents, setCourseScheduleStudents] = useState<Array<{ _id: string; name: string; email: string; studentId: string }>>([]);

  // Fetch rooms when the New Request dialog opens
  useEffect(() => {
    if (!showRequestDialog) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingRooms(true);
        const res = await apiService.getRooms();
        if (!cancelled) setRooms(res?.rooms || res?.data || []);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load rooms:', error);
          toast.error('Failed to load rooms');
          setRooms([]);
        }
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showRequestDialog]);

  const [roomSchedule, setRoomSchedule] = useState<{
    date: string;
    schedules: Array<{
      startTime: string;
      endTime: string;
      courseName?: string;
      instructorName?: string;
    }>;
  } | null>(null);
  const [requestForm, setRequestForm] = useState<RequestFormData>({
    courseId: '',
    roomId: '',
    scheduleId: '',
    date: '',
    dayOfWeek: '',
    startTime: '',
    endTime: '',
    semester: 'First Term',
    year: new Date().getFullYear(),
    purpose: '',
    notes: '',
    type: 'lecture',
    requestType: 'room_change'
  });

  useEffect(() => {
    if (showRequestDialog && requestForm.requestType === 'borrow_schedule') {
      loadBorrowableSchedules();
    }
  }, [showRequestDialog, requestForm.requestType]);

  // Check for conflicts when form fields change
  useEffect(() => {
    if (!showRequestDialog) {
      setRequestConflicts([]);
      return;
    }
    
    if (requestForm.date && requestForm.roomId && requestForm.startTime && requestForm.endTime) {
      const timeoutId = setTimeout(() => {
        checkRequestConflicts();
      }, 500); // Debounce conflict checking
      return () => clearTimeout(timeoutId);
    } else {
      setRequestConflicts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestForm.date, requestForm.roomId, requestForm.startTime, requestForm.endTime, requestForm.scheduleId, requestForm.requestType, showRequestDialog]);

  const sidebarItems = [
    {
      icon: LayoutDashboard,
      label: 'Overview',
      onClick: () => setActiveTab('overview'),
      active: activeTab === 'overview'
    },
    {
      icon: Calendar,
      label: 'My Schedule',
      onClick: () => setActiveTab('schedule'),
      active: activeTab === 'schedule'
    },
    {
      icon: BookOpen,
      label: 'My Courses',
      onClick: () => setActiveTab('courses'),
      active: activeTab === 'courses'
    },
    {
      icon: Users,
      label: 'Students',
      onClick: () => setActiveTab('students'),
      active: activeTab === 'students'
    },
    {
      icon: MessageSquare,
      label: 'Requests',
      onClick: () => setActiveTab('requests'),
      active: activeTab === 'requests'
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => setActiveTab('settings'),
      active: activeTab === 'settings'
    }
  ];

  useEffect(() => {
    loadInstructorData();
  }, []);

  // Reload borrow requests when Requests tab is opened
  useEffect(() => {
    if (activeTab === 'requests' && instructorProfileId) {
      loadBorrowRequestsForMe(instructorProfileId);
    }
  }, [activeTab, instructorProfileId]);

  // Load notification preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('instructorNotifications');
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load notification preferences', e);
    }
  }, []);

  const loadInstructorData = async () => {
    try {
      setLoading(true);

      // First resolve the instructor profile for the logged-in user
      if (user) {
        try {
          const instRes = await apiService.getInstructors();
          // Normalize possible response shapes
          let instructorsList: any[] = [];
          if (instRes?.instructors) instructorsList = instRes.instructors;
          else if (instRes?.data) instructorsList = instRes.data;
          else if (Array.isArray(instRes)) instructorsList = instRes;

          // Find instructor profile matching the logged-in user
          const match = instructorsList.find((it: any) => {
            const uid = it.userId?._id || it.userId;
            return String(uid) === String(user._id || user.id);
          });

          if (match) {
            const instructorId = match._id || match.id;
            setInstructorProfileId(instructorId);
            
            // Load borrow requests for this instructor
            loadBorrowRequestsForMe(instructorId);

            // Always fetch full profile to ensure we get the latest availability
            // This ensures availability persists after page refresh
            let availabilityData = null;
            try {
              const token = localStorage.getItem('authToken') || localStorage.getItem('token');
              const profileRes = await fetch(`${apiService.baseUrl}/instructor/profile`, {
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
              });
              
              if (profileRes.ok) {
                const profileResult = await profileRes.json();
                if (profileResult.success && profileResult.data?.availability) {
                  availabilityData = profileResult.data.availability;
                }
              }
            } catch (e) {
              console.warn('Failed to fetch instructor profile for availability, falling back to match data', e);
              // Fallback to match data if profile fetch fails
              availabilityData = match.availability;
            }
            
            // If still no availability data, try match data
            if (!availabilityData) {
              availabilityData = match.availability;
            }

            // Load availability from instructor profile
            // Use default availability as base, then override with saved data
            let loadedAvailability: Availability = { ...DEFAULT_AVAILABILITY };
            
            if (availabilityData) {
              // Convert availability from backend format (Map or object) to frontend format
              // Handle both Map objects and plain objects
              let availMap: any = {};
              
              if (availabilityData instanceof Map) {
                // Convert Map to plain object
                availMap = Object.fromEntries(availabilityData);
              } else if (availabilityData && typeof availabilityData === 'object') {
                // Handle plain object - might have Map-like structure after JSON serialization
                // MongoDB Map serializes as an object, but we need to handle it properly
                availMap = availabilityData;
              }
              
              // Normalize each day - check if day exists in saved data
              // If day exists (even if empty array), use saved value
              // If day doesn't exist, use default
              const normalizeDay = (obj: any, dayCapital: string, dayLower: string): { startTime: string; endTime: string }[] | null => {
                // Check if day exists in saved data (even if empty)
                const hasDay = (dayCapital in obj) || (dayLower in obj);
                if (hasDay) {
                  const capital = obj[dayCapital];
                  const lower = obj[dayLower];
                  if (Array.isArray(capital)) return capital;
                  if (Array.isArray(lower)) return lower;
                  return []; // Day exists but invalid format, return empty
                }
                // Day not in saved data, return null to indicate use default
                return null;
              };
              
              // Merge saved data with defaults
              Object.keys(DEFAULT_AVAILABILITY).forEach(day => {
                const dayKey = day as keyof Availability;
                const savedDay = normalizeDay(availMap, day, day.toLowerCase());
                
                if (savedDay !== null) {
                  // Day was saved (even if empty), use saved value
                  loadedAvailability[dayKey] = savedDay;
                }
                // If savedDay is null, keep default value (already set)
              });
            }
            
            // Always set availability (use defaults for days not saved)
            setAvailability(loadedAvailability);

            // Fetch instructor's courses via dedicated endpoint (includes direct and scheduled)
            const coursesRes = await apiService.getInstructorCourses(instructorId);
            const instructorCourses = coursesRes?.courses || coursesRes?.data || [];
            setCourses(instructorCourses);

            // Fetch instructor's schedules via dedicated endpoint
            const schedRes = await apiService.getInstructorSchedules(instructorId);
            const instructorSchedulesRaw = schedRes?.schedules || schedRes?.data || [];
            
            // Map and deduplicate schedules
            const scheduleMap = new Map<string, Schedule>();
            instructorSchedulesRaw.forEach((schedule: any) => {
              const scheduleId = schedule._id || schedule.id;
              const courseId = schedule.courseId?._id || schedule.courseId || '';
              const dayOfWeek = schedule.dayOfWeek || '';
              const startTime = schedule.startTime || '';
              const endTime = schedule.endTime || '';
              
              // Create a unique key for deduplication: courseId + dayOfWeek + startTime + endTime
              const uniqueKey = `${courseId}_${dayOfWeek}_${startTime}_${endTime}`;
              
              const isBorrowed = schedule.isBorrowedInstance || false;
              const existing = scheduleMap.get(uniqueKey);
              
              // Prefer original (non-borrowed) schedules over borrowed ones
              if (!existing || (existing.isBorrowed && !isBorrowed)) {
                scheduleMap.set(uniqueKey, {
                  _id: scheduleId,
                  courseId: courseId,
                  courseName: schedule.courseId?.name || schedule.courseName || '',
                  courseCode: schedule.courseId?.code || schedule.courseCode || '',
                  roomName: schedule.roomId?.name || schedule.roomName || '',
                  dayOfWeek: dayOfWeek,
                  startTime: startTime,
                  endTime: endTime,
                  semester: schedule.semester || '',
                  year: schedule.year || 0,
                  studentsEnrolled: schedule.courseId?.studentsEnrolled || 0,
                  capacity: schedule.roomId?.capacity || schedule.roomId?.capacity || 0,
                  isBorrowed: isBorrowed,
                  borrowOriginalInstructorName: schedule.borrowOriginalInstructorName || '',
                  borrowDate: schedule.borrowDate || ''
                });
              }
            });
            
            const instructorSchedules = Array.from(scheduleMap.values());
            setSchedules(instructorSchedules);

            // Fetch instructor subjects (from imported Excel Subjects collection)
            try {
              const subjRes = await (apiService as any).getInstructorSubjects(instructorId);
              const list = subjRes?.data || [];
              setSubjects(list);
            } catch (e) {
              console.warn('Failed to load instructor subjects', e);
              setSubjects([]);
            }

            // Fetch instructor's students via enrollments
            try {
              const enrollRes = await apiService.getInstructorEnrollments(instructorId);
              const enrollments = enrollRes?.enrollments || enrollRes?.data || [];

              // Build unique students list with enrolled course IDs (UI expects course IDs)
              const studentMap = new Map<string, { _id: string; name: string; email: string; studentId: string; year: number; department?: string; courses: string[] }>();
              for (const e of enrollments) {
                const stud = e.studentId || {};
                const userObj = stud.userId || {};
                const key = String(stud._id || stud.id);
                const name = (
                  userObj.name ||
                  `${(userObj.firstName || '').trim()} ${(userObj.lastName || '').trim()}`.trim()
                ).trim() || 'Unknown Student';
                const email = userObj.email || '';
                const courseId = String(e.courseId?._id || e.courseId || '');
                const studentId = stud.studentId || '';
                const year = Number(stud.year || e.yearLevel || 0) || 0;
                const department = userObj.department || '';

                if (!studentMap.has(key)) {
                  studentMap.set(key, { _id: String(stud._id || key), name, email, studentId, year, department, courses: courseId ? [courseId] : [] });
                } else if (courseId) {
                  const entry = studentMap.get(key)!;
                  if (!entry.courses.includes(courseId)) entry.courses.push(courseId);
                }
              }
              setStudents(Array.from(studentMap.values()));
            } catch (e) {
              console.warn('Failed to load instructor enrollments/students', e);
              setStudents([]);
            }

            // Fetch instructor's schedule requests
            const reqsRes = await apiService.getInstructorScheduleRequests(instructorId);
            const fetchedRequests = reqsRes.data || [];
            setRequests(fetchedRequests.map(normalizeScheduleRequest));
          } else {
            console.warn('No instructor profile found for user', user);
            toast.error('Could not find your instructor profile');
          }
        } catch (err) {
          console.error('Failed to load instructor data:', err);
          toast.error('Failed to load your schedule');
        }
      }

      // Load rooms for schedule requests
      try {
        setLoadingRooms(true);
        const roomsRes = await apiService.getRooms();
        if (roomsRes.success && Array.isArray(roomsRes.data)) {
          setRooms(roomsRes.data);
        }
      } catch (err) {
        console.warn('Failed to fetch rooms:', err);
        toast.error('Failed to load available rooms');
      } finally {
        setLoadingRooms(false);
      }

    } catch (error) {
      console.error('Failed to load instructor data:', error);
      toast.error('Failed to load your schedule');
    } finally {
      setLoading(false);
    }
  };

  const openScheduleDialog = async (schedule: any) => {
    try {
      setSelectedSchedule(schedule);
      setShowScheduleDialog(true);
      const res = await apiService.getScheduleEnrollments(schedule._id);
      const enrollments = res?.enrollments || res?.data || [];
      const items = enrollments.map((e: any) => {
        const stud = e.studentId || {};
        const userObj = stud.userId || {};
        const name = (
          userObj.name || `${(userObj.firstName || '').trim()} ${(userObj.lastName || '').trim()}`.trim()
        ).trim() || 'Unknown Student';
        return {
          _id: String(stud._id || e._id),
          name,
          email: userObj.email || '',
          studentId: stud.studentId || ''
        };
      });
      setScheduleStudents(items);
    } catch (error) {
      console.error('Failed to load schedule enrollments', error);
      toast.error('Failed to load enrolled students');
      setScheduleStudents([]);
    }
  };

  const openCourseDialog = async (course: any) => {
    try {
      setSelectedCourseForDialog(course);
      setShowCourseDialog(true);
      // Find schedules for this course (for this instructor)
      const courseSchedules = schedules.filter(s => String(s.courseId) === String(course._id));
      if (courseSchedules.length > 0) {
        const first = courseSchedules[0];
        setSelectedCourseScheduleId(String(first._id));
        await loadStudentsForCourseSchedule(String(first._id));
      } else {
        setSelectedCourseScheduleId(null);
        setCourseScheduleStudents([]);
      }
    } catch (error) {
      console.error('Failed to open course dialog', error);
      toast.error('Failed to load course details');
    }
  };

  const loadStudentsForCourseSchedule = async (scheduleId: string) => {
    try {
      const res = await apiService.getScheduleEnrollments(scheduleId);
      const enrollments = res?.enrollments || res?.data || [];
      const items = enrollments.map((e: any) => {
        const stud = e.studentId || {};
        const userObj = stud.userId || {};
        const name = (
          userObj.name || `${(userObj.firstName || '').trim()} ${(userObj.lastName || '').trim()}`.trim()
        ).trim() || 'Unknown Student';
        return {
          _id: String(stud._id || e._id),
          name,
          email: userObj.email || '',
          studentId: stud.studentId || ''
        };
      });
      setCourseScheduleStudents(items);
    } catch (error) {
      console.error('Failed to load schedule students', error);
      toast.error('Failed to load enrolled students');
      setCourseScheduleStudents([]);
    }
  };

  // Helper function to get the next date for a specific day of week
  const getNextDateForDayOfWeek = (dayOfWeek: string, startFrom?: Date): string => {
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    const targetDay = dayMap[dayOfWeek];
    if (targetDay === undefined) return '';
    
    const start = startFrom || new Date();
    const current = new Date(start);
    const currentDay = current.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    
    // If today is the target day and we're starting from today, use today
    // Otherwise, get the next occurrence
    if (daysUntilTarget === 0 && (!startFrom || startFrom.toDateString() === new Date().toDateString())) {
      // If starting from today and it's the target day, use today
      // Otherwise, get next week's occurrence
      if (!startFrom || startFrom.toDateString() === new Date().toDateString()) {
        return current.toISOString().split('T')[0];
      }
    }
    
    current.setDate(current.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return current.toISOString().split('T')[0];
  };

  // Helper function to check if a date falls on a specific day of week
  const isDateOnDayOfWeek = (dateStr: string, dayOfWeek: string): boolean => {
    const dayMap: Record<string, number> = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    const targetDay = dayMap[dayOfWeek];
    if (targetDay === undefined) return false;
    
    const date = new Date(dateStr + 'T00:00:00');
    return date.getDay() === targetDay;
  };

  const loadBorrowRequestsForMe = async (instructorId: string) => {
    try {
      setLoadingBorrowRequests(true);
      const res = await apiService.getBorrowRequestsForInstructor(instructorId);
      setBorrowRequestsForMe(res?.data || []);
    } catch (error) {
      console.error('Failed to load borrow requests:', error);
      setBorrowRequestsForMe([]);
    } finally {
      setLoadingBorrowRequests(false);
    }
  };

  const handleApproveBorrowRequest = async (requestId: string, approved: boolean, rejectionReason?: string) => {
    try {
      const response = await apiService.approveBorrowRequestByInstructor(requestId, approved, rejectionReason);
      if (response.success) {
        toast.success(approved ? 'Borrow request approved' : 'Borrow request rejected');
        // Reload borrow requests
        if (instructorProfileId) {
          await loadBorrowRequestsForMe(instructorProfileId);
        }
      } else {
        toast.error(response.message || 'Failed to process request');
      }
    } catch (error: any) {
      console.error('Failed to approve borrow request:', error);
      toast.error(error.message || 'Failed to process request');
    }
  };

  const loadBorrowableSchedules = async () => {
    if (borrowSchedulesLoading || borrowableSchedules.length > 0) return;
    try {
      setBorrowSchedulesLoading(true);
      const res = await apiService.getSchedules();
      const schedules = res?.schedules || res?.data || [];
      const formatted: BorrowableSchedule[] = schedules
        .map((schedule: any) => {
          const instructorDoc = schedule.instructorId || {};
          const instructorUser = instructorDoc.userId || {};
          return {
            _id: String(schedule._id || schedule.id),
            courseId: String(schedule.courseId?._id || schedule.courseId || ''),
            courseName: schedule.courseId?.name || schedule.courseName || '',
            courseCode: schedule.courseId?.code || schedule.courseCode || '',
            instructorId: String(instructorDoc._id || schedule.instructorId || ''),
            instructorName: instructorUser.name || schedule.instructorName || 'Unknown Instructor',
            roomId: String(schedule.roomId?._id || schedule.roomId || ''),
            roomName: schedule.roomId?.name || schedule.roomName || '',
            dayOfWeek: schedule.dayOfWeek || '',
            startTime: schedule.startTime || '',
            endTime: schedule.endTime || '',
            semester: schedule.semester,
            year: schedule.year,
            academicYear: schedule.academicYear
          };
        })
        .filter((item: BorrowableSchedule) => {
          if (!item._id) return false;
          // Filter out schedules owned by the requesting instructor
          if (instructorProfileId) {
            return item.instructorId !== instructorProfileId;
          }
          return true;
        });
      setBorrowableSchedules(formatted);
    } catch (error) {
      console.error('Failed to load schedules for borrowing', error);
      toast.error('Failed to load schedules for borrowing');
      setBorrowableSchedules([]);
    } finally {
      setBorrowSchedulesLoading(false);
    }
  };

  const checkRequestConflicts = async () => {
    const { courseId, roomId, date, dayOfWeek, startTime, endTime, semester, year, requestType, scheduleId } = requestForm;
    const isBorrowRequest = requestType === 'borrow_schedule';
    
    if (!date || !roomId || !startTime || !endTime) {
      setRequestConflicts([]);
      return;
    }

    try {
      setCheckingConflicts(true);
      const allSchedulesRes = await apiService.getSchedules();
      const allSchedules = allSchedulesRes?.schedules || [];
      const weekday = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      
      const conflicts: string[] = [];
      
      // Check for room/time conflicts
      const overlappingSchedules = allSchedules.filter((s: any) => {
        const sRoomId = s.roomId?._id || s.roomId;
        const matchesRoom = String(sRoomId) === String(roomId);
        const matchesDay = s.dayOfWeek === weekday;
        if (!matchesRoom || !matchesDay) return false;
        
        // For borrow requests, exclude the schedule being borrowed
        if (isBorrowRequest && scheduleId && String(s._id) === String(scheduleId)) {
          return false;
        }
        
        // Check time overlap
        return startTime < s.endTime && endTime > s.startTime;
      });

      overlappingSchedules.forEach((s: any) => {
        const courseName = s.courseId?.name || s.courseName || 'Unknown Course';
        const courseCode = s.courseId?.code || s.courseCode || '';
        const instructorName = s.instructorId?.userId?.name || s.instructorName || 'Unknown Instructor';
        conflicts.push(`Room conflict: ${courseCode} ${courseName} (${instructorName}) at ${s.startTime}-${s.endTime}`);
      });

      setRequestConflicts(conflicts);
    } catch (error) {
      console.error('Failed to check conflicts:', error);
      setRequestConflicts([]);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Basic validation
      const { courseId, roomId, date, dayOfWeek, startTime, endTime, semester, year, purpose, requestType } = requestForm;
      const isBorrowRequest = requestType === 'borrow_schedule';

      if (isBorrowRequest && !requestForm.scheduleId) {
        toast.error('Please select a schedule to borrow');
        return;
      }

      // For borrow requests, most fields are auto-filled from the selected schedule
      if (isBorrowRequest) {
        if (!date || !requestForm.scheduleId) {
          toast.error('Please select a schedule and date');
          return;
        }
        
        // Validate that the date matches the schedule's day of week
        if (selectedBorrowSchedule && !isDateOnDayOfWeek(date, selectedBorrowSchedule.dayOfWeek)) {
          toast.error(`The selected date must be a ${selectedBorrowSchedule.dayOfWeek}. Please choose a ${selectedBorrowSchedule.dayOfWeek}.`);
          return;
        }
      } else {
        // For regular requests, validate all required fields
        if (!courseId || !roomId || !date || !dayOfWeek || !startTime || !endTime || !semester || !year || !purpose) {
          toast.error('Please fill in all required fields');
          return;
        }
      }

      // Validate that dayOfWeek matches the selected date
      if (date) {
        const selectedDate = new Date(date + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const actualDayOfWeek = days[selectedDate.getDay()];
        
        if (dayOfWeek !== actualDayOfWeek) {
          toast.error(`Day of week (${dayOfWeek}) does not match the selected date (${actualDayOfWeek}). Please correct this before submitting.`);
          return;
        }
      }

      // Validate time range (only for non-borrow requests, as borrow requests use the schedule's time)
      if (!isBorrowRequest && startTime >= endTime) {
        toast.error('Start time must be before end time');
        return;
      }

      // Check for conflicts before submission
      await checkRequestConflicts();
      if (requestConflicts.length > 0) {
        toast.warning('Conflicts detected. Please review and adjust your request before submitting.');
        return;
      }

      const requestData = {
        ...requestForm,
        // Always use the instructor profile ID for scheduling
        instructorId: instructorProfileId,
        // Backend expects requestType and details fields for schedule requests
        requestType,
        details: requestForm.purpose || requestForm.notes || '',
        // Use semester and year from form (already set by user)
        semester: requestForm.semester,
        year: requestForm.year,
        academicYear: `${requestForm.year}-${Number(requestForm.year) + 1}`
      };

      // Store request data and show confirmation dialog
      setPendingRequestData(requestData);
      setShowConfirmDialog(true);
    } catch (error: any) {
      console.error('Failed to validate schedule request:', error);
      toast.error(error.message || 'Failed to validate request');
    }
  };

  const handleConfirmSubmit = async () => {
    if (!pendingRequestData) return;

    try {
      const response = await apiService.createScheduleRequest(pendingRequestData);

      if (response.success) {
        if (response.data) {
          // Normalize API response to the UI shape and add to list
          setRequests(prev => [normalizeScheduleRequest(response.data), ...prev]);
        } else {
          // Otherwise refresh the full list and normalize
          if (user?.id || instructorProfileId) {
            const instructorId = instructorProfileId || user?.id;
            if (instructorId) {
              const updatedRequests = await apiService.getInstructorScheduleRequests(String(instructorId));
              setRequests((updatedRequests.data || []).map(normalizeScheduleRequest));
            }
          }
        }
        
        toast.success('Schedule request submitted successfully');
        setShowRequestDialog(false);
        setShowConfirmDialog(false);
        setRequestConflicts([]);
        setPendingRequestData(null);
        // Reset form with all fields (default to lecture)
        setRequestForm({
          courseId: '',
          roomId: '',
          scheduleId: '',
          date: '',
          dayOfWeek: '',
          startTime: '',
          endTime: '',
          semester: 'First Term',
          year: new Date().getFullYear(),
          purpose: '',
          notes: '',
          type: 'lecture',
          requestType: 'room_change'
        });
        setSelectedBorrowSchedule(null);
      } else {
        toast.error(response.message || 'Failed to submit request');
        setShowConfirmDialog(false);
        setPendingRequestData(null);
      }
    } catch (error: any) {
      console.error('Failed to submit schedule request:', error);
      toast.error(error.message || 'Failed to submit request');
      setShowConfirmDialog(false);
      setPendingRequestData(null);
    }
  };

  // Normalizes schedule request objects returned by the backend so the UI
  // can rely on stable fields like `courseName`, `details`, and `type`.
  const getSemesterFromDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const month = date.getMonth(); // 0-11
    
    // Define semester ranges (adjust these based on your academic calendar)
    if (month >= 8 && month <= 11) return 'First Term';  // Sep-Dec
    if (month >= 0 && month <= 3) return 'Second Term';  // Jan-Apr
    return 'Third Term';  // May-Aug
  };

  const normalizeScheduleRequest = (r: any) => {
    const derivedType = (r.requestType || r.type || 'room_change') as ScheduleRequest['type'];
    const originalInstructor = r.originalInstructorId || r.originalInstructor;
    
    // Extract original instructor name from various possible sources
    let originalInstructorName = '';
    if (r.originalInstructorName) {
      originalInstructorName = r.originalInstructorName;
    } else if (originalInstructor) {
      // Try to get name from populated instructor object
      if (originalInstructor.userId?.name) {
        originalInstructorName = originalInstructor.userId.name;
      } else if (originalInstructor.name) {
        originalInstructorName = originalInstructor.name;
      } else if (typeof originalInstructor === 'object' && originalInstructor._id) {
        // If it's just an ID, we might need to fetch it, but for now try scheduleId
        if (r.scheduleId?.instructorId?.userId?.name) {
          originalInstructorName = r.scheduleId.instructorId.userId.name;
        } else if (r.scheduleId?.instructorName) {
          originalInstructorName = r.scheduleId.instructorName;
        }
      }
    } else if (r.scheduleId) {
      // Fallback to schedule's instructor info
      if (r.scheduleId.instructorId?.userId?.name) {
        originalInstructorName = r.scheduleId.instructorId.userId.name;
      } else if (r.scheduleId.instructorName) {
        originalInstructorName = r.scheduleId.instructorName;
      }
    }
    
    return {
      _id: r._id || r.id || r._id,
      courseId: r.courseId?._id || r.courseId || r.courseId,
      courseName: r.courseId?.name || r.courseName || r.courseCode || '',
      // UI expects `details` while backend uses `purpose` or `reason`.
      details: r.purpose || r.details || r.reason || '',
      // Keep a `type` field for display; fallback to requestType or a sensible default
      type: derivedType,
      requestType: derivedType,
      status: r.status || 'pending',
      createdAt: r.createdAt || r.created_at || new Date().toISOString(),
      originalInstructorName,
      originalInstructorId: originalInstructor?._id || originalInstructor || undefined,
      borrowDate: r.date || r.borrowDate,
      roomName: r.roomName || r.roomId?.name || r.scheduleId?.roomName || '',
      dayOfWeek: r.dayOfWeek || r.scheduleId?.dayOfWeek || '',
      startTime: r.startTime || r.scheduleId?.startTime || '',
      endTime: r.endTime || r.scheduleId?.endTime || '',
      // keep original for any further needs
      __raw: r
    } as ScheduleRequest;
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview': return 'Instructor Dashboard';
      case 'schedule': return 'My Schedule';
      case 'courses': return 'My Courses';
      case 'students': return 'My Students';
      case 'requests': return 'Schedule Requests';
      case 'settings': return 'Settings & Availability';
      default: return 'Instructor Dashboard';
    }
  };

  const getTodaySchedule = () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    // Filter schedules by today's day, with case-insensitive comparison and trimming
    return schedules.filter(schedule => {
      if (!schedule || !schedule.dayOfWeek) return false;
      // Normalize both strings for comparison (trim whitespace and case-insensitive)
      const scheduleDay = String(schedule.dayOfWeek).trim().toLowerCase();
      const todayDay = String(today).trim().toLowerCase();
      return scheduleDay === todayDay;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      case 'needs_improvement': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleFavoriteRoom = (roomId: string) => {
    setFavoriteRooms(prev => {
      const newFavorites = prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId];
      localStorage.setItem('favoriteRooms', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const fetchRoomSchedule = async (roomId: string, date: string) => {
    try {
      // Get instructor's schedules and filter for room
      // Ensure we have a valid instructor ID before making the API call
      const instructorId = instructorProfileId || user?._id || user?.id;
      if (!instructorId) {
        throw new Error('No valid instructor ID found');
      }
      const instRes = await apiService.getInstructorSchedules(instructorId);
      const allSchedules = instRes?.schedules || [];
      const weekday = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' }) : null;

      const roomSchedules = allSchedules
        .filter((s: any) => {
          const sid = s.roomId?._id || s.roomId || s.room || s.roomId;
          const matchesRoom = String(sid) === String(roomId);
          const matchesDay = weekday ? s.dayOfWeek === weekday : true;
          return matchesRoom && matchesDay;
        })
        .map((s: any) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          courseName: s.courseName || s.courseId?.name || s.courseCode || '',
          instructorName: s.instructorName || s.instructorId?.userId?.name || ''
        }));

      setRoomSchedule({ date, schedules: roomSchedules });
    } catch (error) {
      console.error('Failed to fetch room schedule:', error);
      toast.error('Could not load room schedule');
    }
  };

  const checkRoomAvailability = async (roomId: string, date: string, startTime: string, endTime: string) => {
    try {
      // Get instructor schedules and filter for room conflicts
      const instRes = await apiService.getSchedules(); // Use getSchedules since we want to check ALL schedules
      const allSchedules = instRes?.schedules || [];
      const weekday = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' }) : null;

      type ApiRoomConflict = {
        roomId?: any;
        startTime: string;
        endTime: string;
        courseName?: string;
        instructorName?: string;
      };

      const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
        return aStart < bEnd && bStart < aEnd; // simple overlap check assuming HH:MM strings
      };

      // Find any schedule that overlaps the requested time slot
      const roomConflicts: ApiRoomConflict[] = allSchedules.filter((s: any) => {
        const sid = s.roomId?._id || s.roomId || s.room || s.roomId;
        const matchesRoom = String(sid) === String(roomId);
        const matchesDay = weekday ? s.dayOfWeek === weekday : true;
        if (!matchesRoom || !matchesDay) return false;
        if (!startTime || !endTime) return true; // if times not provided, consider it a conflict
        return overlaps(startTime, endTime, s.startTime, s.endTime);
      }).map((s: any) => ({
        roomId: s.roomId?._id || s.roomId,
        startTime: s.startTime,
        endTime: s.endTime,
        courseName: s.courseName || s.courseCode || s.courseId?.name || '',
        instructorName: s.instructorName || s.instructorId?.userId?.name || ''
      }));

      setRoomAvailability(prev => ({
        ...prev,
        [roomId]: {
          available: roomConflicts.length === 0,
          conflicts: roomConflicts
        }
      }));

      // If this is the selected room, fetch its schedule for display
      if (requestForm.roomId === roomId) {
        await fetchRoomSchedule(roomId, date);
      }
    } catch (error) {
      console.error('Failed to check room availability:', error);
      toast.error('Could not check room availability');
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || student.courses.includes(selectedCourse);
    return matchesSearch && matchesCourse;
  });

  const filteredRooms = rooms.filter(room => {
    const minCap = Number(roomFilters.minCapacity || '0') || 0;
    const meetsCapacity = room.capacity >= minCap;
    const hasRequiredEquipment = roomFilters.equipment.length === 0 || 
      (room.equipment && roomFilters.equipment.every(eq => room.equipment?.includes(eq)));
    const matchesBuilding = !roomFilters.building || 
      room.building.toLowerCase().includes(roomFilters.building.toLowerCase());
    return meetsCapacity && hasRequiredEquipment && matchesBuilding;
  });

  const isBorrowRequest = requestForm.requestType === 'borrow_schedule';

  const OverviewContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    const todaySchedule = getTodaySchedule();
    const totalStudents = students.length;
    const totalClasses = schedules.length;
    
    // Calculate total teaching hours per week
    const totalHours = schedules.reduce((total, schedule) => {
      if (!schedule.startTime || !schedule.endTime) return total;
      const start = parseTime(schedule.startTime);
      const end = parseTime(schedule.endTime);
      const hours = (end - start) / 60; // Convert minutes to hours
      return total + (hours || 0);
    }, 0);
    
    // Helper function to parse time string (HH:MM) to minutes
    function parseTime(timeStr: string): number {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return (hours || 0) * 60 + (minutes || 0);
    }

  // Compute display name from logged-in user (robust):
  // prefer user.name, user.fullName, user.displayName, first+last, or fallback to localStorage currentUser
  const displayName = (() => {
    const src = user || (() => {
      try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })();

    if (!src) return 'Instructor';
    // Common name fields
    // Just use the name property since that's what's defined in InstructorUser
    const nameFields = [src.name];
    for (const f of nameFields) {
      if (f && typeof f === 'string' && f.trim()) return f.trim();
    }
    // Derive from email local part
    const email = src.email;
    if (email && typeof email === 'string') {
      const local = email.split('@')[0];
      const parts = local.split(/[._\-]/).filter(Boolean);
      const human = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      if (human) return human;
    }
    return 'Instructor';
  })();

  return (
      <div className="space-y-6">
        {/* Welcome Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}!</h2>
                <p className="text-gray-600 mt-1">Here's your teaching overview for today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Classes</CardTitle>
              <Calendar className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalClasses}</div>
              <p className="text-xs text-gray-500 mt-1">This semester</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Teaching Hours</CardTitle>
              <Clock className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalHours.toFixed(1)}</div>
              <p className="text-xs text-gray-500 mt-1">Hours per week</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Courses</CardTitle>
              <BookOpen className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{courses.length}</div>
              <p className="text-xs text-gray-500 mt-1">Active courses</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
              <Users className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalStudents}</div>
              <p className="text-xs text-gray-500 mt-1">Total enrolled</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
            <CardDescription>Your classes for today</CardDescription>
          </CardHeader>
          <CardContent>
            {todaySchedule.length > 0 ? (
              <div className="space-y-3">
                {todaySchedule.map((schedule) => (
                  <div key={schedule._id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm transition-shadow">
                    <div>
                      <p className="font-semibold text-gray-900">{schedule.courseCode} - {schedule.courseName}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {schedule.roomName} • {schedule.startTime} - {schedule.endTime}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {schedule.studentsEnrolled}/{schedule.capacity} students
                      </p>
                    </div>
                    <Badge className="bg-black text-white hover:bg-gray-900">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-gray-500">No classes scheduled for today</p>
                <p className="text-sm text-gray-400">Enjoy your day off!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Recent Requests */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start bg-white hover:bg-gray-50 text-gray-900 border shadow-sm" onClick={() => setActiveTab('schedule')}>
                <Calendar className="h-4 w-4 mr-3" />
                View Full Schedule
              </Button>
              <Button className="w-full justify-start bg-white hover:bg-gray-50 text-gray-900 border shadow-sm" onClick={() => setActiveTab('students')}>
                <Users className="h-4 w-4 mr-3" />
                Manage Students
              </Button>
              <Button className="w-full justify-start bg-white hover:bg-gray-50 text-gray-900 border shadow-sm" onClick={() => setShowRequestDialog(true)}>
                <MessageSquare className="h-4 w-4 mr-3" />
                Submit Request
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length > 0 ? (
                <div className="space-y-4">
                  {requests.slice(0, 2).map((request) => (
                    <div key={request._id} className="border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-gray-900">{request.courseName}</p>
                        <Badge className={getStatusColor(request.status)}>
                          {request.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{request.details}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No pending requests</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const ScheduleContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    // Group schedules by semester/year for organization
    const schedulesBySemester = schedules.reduce((acc: any, schedule: any) => {
      const key = `${schedule.semester} ${schedule.year}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(schedule);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {Object.entries(schedulesBySemester).map(([term, termSchedules]: [string, any]) => (
          <Card key={term} className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {term}
              </CardTitle>
              <CardDescription>Your weekly schedule for {term}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                  const daySchedules = termSchedules.filter((s: any) => s.dayOfWeek === day);
                  return (
                    <div key={day} className="border rounded-lg p-4 bg-white">
                      <h3 className="font-semibold mb-3 text-gray-900">{day}</h3>
                      {daySchedules.length > 0 ? (
                        <div className="space-y-2">
                          {daySchedules
                            .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                            .map((schedule: any) => (
                              <div key={schedule._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100" onClick={() => openScheduleDialog(schedule)}>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">
                                      {schedule.courseCode} - {schedule.courseName}
                                    </p>
                                    {schedule.isBorrowed && (
                                      <Badge className="bg-orange-100 text-orange-800 text-xs">
                                        Borrowed
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500">
                                    {schedule.roomName}
                                  </p>
                                  {schedule.isBorrowed && schedule.borrowOriginalInstructorName && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      Originally: {schedule.borrowOriginalInstructorName}
                                      {schedule.borrowDate && ` (${new Date(schedule.borrowDate).toLocaleDateString()})`}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-gray-900">
                                    {schedule.startTime} - {schedule.endTime}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {schedule.studentsEnrolled} / {schedule.capacity} students
                                  </p>
                                </div>
                              </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">No classes scheduled</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {!Object.keys(schedulesBySemester).length && (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-gray-500">No schedules found</p>
            <p className="text-sm text-gray-400">
              You don't have any classes scheduled yet.
            </p>
          </div>
        )}
      </div>
    );
  };

  const CoursesContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    // Optional filter UI backed by subjects data (semester/year level/course)
    const uniqueSemesters = Array.from(new Set(subjects.map(s => s.semester))).filter(Boolean);
    const uniqueYearLevels = Array.from(new Set(subjects.map(s => s.yearLevel).filter(Boolean))) as string[];
    const uniqueCourseCodes = Array.from(new Set(subjects.map(s => s.courseCode || s.subjectCode))).filter(Boolean);

    const filteredSubjects = subjects.filter(s => {
      const semOk = subjectFilters.semester === 'all' || s.semester === subjectFilters.semester;
      const ylOk = subjectFilters.yearLevel === 'all' || String(s.yearLevel) === subjectFilters.yearLevel;
      const courseOk = subjectFilters.course === 'all' || (s.courseCode || s.subjectCode) === subjectFilters.course;
      return semOk && ylOk && courseOk;
    });

    // Group courses by semester for display
    const coursesBySemester = courses.reduce((acc: any, course: any) => {
      const key = `${course.semester || 'Current'} ${course.year || new Date().getFullYear()}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(course);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {/* Subject filters (does not change layout) */}
        <div className="flex flex-wrap gap-3">
          <Select value={subjectFilters.semester} onValueChange={(v) => setSubjectFilters(prev => ({ ...prev, semester: v }))}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {uniqueSemesters.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={subjectFilters.yearLevel} onValueChange={(v) => setSubjectFilters(prev => ({ ...prev, yearLevel: v }))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Year Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {uniqueYearLevels.map(y => (<SelectItem key={y} value={y}>Year {y}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={subjectFilters.course} onValueChange={(v) => setSubjectFilters(prev => ({ ...prev, course: v }))}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {uniqueCourseCodes.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* When filters are applied, show a quick subjects table at top */}
        {filteredSubjects.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>My Subjects</CardTitle>
              <CardDescription>Filtered by your selections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Year Level</TableHead>
                      <TableHead>Schedule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubjects.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.courseCode || s.subjectCode}</TableCell>
                        <TableCell>{s.courseName || s.description}</TableCell>
                        <TableCell>{s.units}</TableCell>
                        <TableCell>{s.semester} {s.schoolYear}</TableCell>
                        <TableCell>{s.yearLevel || '-'}</TableCell>
                        <TableCell>{s.dayOfWeek ? `${s.dayOfWeek} ${s.startTime}-${s.endTime}` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {Object.entries(coursesBySemester).map(([term, termCourses]: [string, any]) => (
          <Card key={term} className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {term}
              </CardTitle>
              <CardDescription>Courses you're teaching this term</CardDescription>
         S </CardHeader>
     s      <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {termCourses.map((course: any) => (
                  <Card key={course._id} className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => openCourseDialog(course)}>
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={course.type === 'lecture' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                          {course.type}
                        </Badge>
                        <span className="text-sm text-gray-500">{course.credits} credits</span>
                      </div>
                      <CardTitle className="text-lg">{course.code}</CardTitle>
                      <CardDescription>{course.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Department:</span>
                          <span className="font-medium">{course.department}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Schedule:</span>
                          <span className="font-medium">
                            {schedules
                              .filter(s => s.courseId === course._id)
                              .map(s => `${s.dayOfWeek} ${s.startTime}-${s.endTime}`)
                              .join(', ') || 'Not scheduled'}
                          </span>
                       </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Enrolled:</span>
                          <span className="font-medium">{course.studentsEnrolled} students</span>
                        </div>
                        {course.description && (
                          <p className="text-xs text-gray-500 mt-3 pt-3 border-t">{course.description}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {!Object.keys(coursesBySemester).length && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg text-gray-500">No courses found</p>
            <p className="text<-sm >ext-gray-400">
              Y ollu haven't been assigned to any courses yet.
            </p>
          </div>
        )}
      </div>
    );
  };

  {/* Schedule Details Dialog */}
  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
    <DialogContent className="bg-white max-w-lg">
      <DialogHeader>
        <DialogTitle>Schedule Details</DialogTitle>
        <DialogDescription>
          {selectedSchedule ? (
            <div className="text-sm text-gray-600">
              {selectedSchedule.courseCode} - {selectedSchedule.courseName} • {selectedSchedule.dayOfWeek} {selectedSchedule.startTime}-{selectedSchedule.endTime}
            </div>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {scheduleStudents.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Student</TableHead>
                  <TableHead className="font-semibold">Student ID</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleStudents.map(s => (
                  <TableRow key={s._id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.studentId}</TableCell>
                    <TableCell>{s.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6">No students enrolled.</div>
        )}
      </div>
    </DialogContent>
  </Dialog>

  {/* Course Details Dialog */}
  <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
    <DialogContent className="bg-white max-w-2xl">
      <DialogHeader>
        <DialogTitle>Course Details</DialogTitle>
        <DialogDescription>
          {selectedCourseForDialog ? (
            <div className="text-sm text-gray-600">
              {selectedCourseForDialog.code} - {selectedCourseForDialog.name}
            </div>
          ) : null}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium">Department:</span>
          <span>{selectedCourseForDialog?.department}</span>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900">Schedules</div>
          <div className="flex flex-wrap gap-2">
            {schedules.filter(s => String(s.courseId) === String(selectedCourseForDialog?._id)).map(s => (
              <Badge key={s._id} className={`cursor-pointer ${String(selectedCourseScheduleId) === String(s._id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`} onClick={() => { setSelectedCourseScheduleId(String(s._id)); loadStudentsForCourseSchedule(String(s._id)); }}>
                {s.dayOfWeek} {s.startTime}-{s.endTime}
              </Badge>
            ))}
            {schedules.filter(s => String(s.courseId) === String(selectedCourseForDialog?._id)).length === 0 && (
              <span className="text-sm text-gray-500">No schedules</span>
            )}
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Student</TableHead>
                <TableHead className="font-semibold">Student ID</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courseScheduleStudents.length > 0 ? courseScheduleStudents.map(s => (
                <TableRow key={s._id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.studentId}</TableCell>
                  <TableCell>{s.email}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500">No students enrolled.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  const StudentsContent = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                My Students
              </CardTitle>
              <CardDescription>Students enrolled in your courses</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="bg-white">
                <Upload className="h-4 w-4 mr-2" />
                Import Grades
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-48 bg-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 shadow-lg">
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course._id} value={course._id}>
                    {course.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Student</TableHead>
                  <TableHead className="font-semibold">Student ID</TableHead>
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Courses</TableHead>
                  <TableHead className="font-semibold">Attendance</TableHead>
                  <TableHead className="font-semibold">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map(student => (
                  <TableRow key={student._id} className="hover:bg-gray-50">
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{student.studentId}</TableCell>
                    <TableCell className="text-gray-600">Year {student.year}</TableCell>
                    <TableCell className="text-gray-600">{student.department || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {student.courses.map(courseId => {
                          const course = courses.find(c => c._id === courseId);
                          return course ? (
                            <Badge key={courseId} variant="outline" className="text-xs bg-white">
                              {course.code}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">{student.attendance}%</div>
                        {student.attendance && student.attendance >= 90 && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {student.attendance && student.attendance < 75 && (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.performance && (
                        <Badge className={getPerformanceColor(student.performance)}>
                          {student.performance.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No students found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const RequestsContent = () => (
    <div className="space-y-6">
      {/* Borrow Requests for My Schedules - Table */}
      <Card className="border-0 shadow-sm border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            Borrow Requests for My Schedules
          </CardTitle>
          <CardDescription>Other instructors want to borrow your schedules. Please review and approve or reject.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBorrowRequests ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : borrowRequestsForMe.length > 0 ? (
            <div className="border rounded-lg bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Course</TableHead>
                    <TableHead className="font-semibold">Requested By</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Schedule</TableHead>
                    <TableHead className="font-semibold">Room</TableHead>
                    <TableHead className="font-semibold">Notes</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {borrowRequestsForMe.map((request: any) => (
                    <TableRow key={request._id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {request.courseCode || ''} {request.courseName || 'Unknown Course'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-700">
                          {request.instructorId?.userId?.name || request.instructorName || 'Unknown Instructor'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {request.date ? new Date(request.date).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        {request.dayOfWeek} {request.startTime} - {request.endTime}
                      </TableCell>
                      <TableCell>
                        {request.roomName || request.roomId?.name || '—'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">{request.notes || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending Your Approval</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApproveBorrowRequest(request._id, true)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt('Please provide a reason for rejection (optional):');
                              handleApproveBorrowRequest(request._id, false, reason || undefined);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-gray-500">No borrow requests pending</p>
              <p className="text-sm text-gray-400">You will see requests here when other instructors want to borrow your schedules</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Schedule Requests
              </CardTitle>
              <CardDescription>Submit and track your schedule change requests</CardDescription>
            </div>
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Submit Schedule Request</DialogTitle>
                  <DialogDescription>
                    Request a change to your schedule or report a conflict
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitRequest} className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 max-h-[75vh] overflow-auto pr-2">
                  <div className="space-y-2">
                    <Label htmlFor="requestType">Request Type</Label>
                    <Select
                      value={requestForm.requestType}
                      onValueChange={(value) => {
                        const nextType = value as 'room_change' | 'borrow_schedule';
                        setRequestForm(prev => ({
                          ...prev,
                          requestType: nextType,
                          scheduleId: '',
                          courseId: nextType === 'borrow_schedule' ? '' : prev.courseId,
                          roomId: '',
                          dayOfWeek: '',
                          startTime: '',
                          endTime: '',
                          purpose: nextType === 'borrow_schedule' ? 'borrow schedule' : ''
                        }));
                        setSelectedBorrowSchedule(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select request type" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="room_change">Request new room/time</SelectItem>
                        <SelectItem value="borrow_schedule">Borrow another instructor's schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isBorrowRequest ? (
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700">
                        {selectedBorrowSchedule
                          ? `${selectedBorrowSchedule.courseCode} - ${selectedBorrowSchedule.courseName}`
                          : 'Select a schedule to borrow'}
                      </div>
                    </div>
                  ) : (
                  <div className="space-y-2">
                    <Label htmlFor="courseId">Course</Label>
                    <Select value={requestForm.courseId} onValueChange={(value) => setRequestForm(prev => ({ ...prev, courseId: value, scheduleId: '' }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        {courses.map(course => (
                          <SelectItem key={course._id} value={course._id}>
                            {course.code} - {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}

                  <div className="space-y-2">
                    {isBorrowRequest ? (
                      <>
                        <Label htmlFor="borrowScheduleId">Schedule to Borrow</Label>
                        <Select
                          value={requestForm.scheduleId || ''}
                          onValueChange={(value) => {
                            const selected = borrowableSchedules.find(item => item._id === value) || null;
                            setSelectedBorrowSchedule(selected);
                            
                            // Auto-set the date to the next occurrence of the schedule's day
                            const nextValidDate = selected?.dayOfWeek 
                              ? getNextDateForDayOfWeek(selected.dayOfWeek)
                              : '';
                            
                            setRequestForm(prev => ({
                              ...prev,
                              scheduleId: value,
                              courseId: selected?.courseId || '',
                              roomId: selected?.roomId || '',
                              dayOfWeek: selected?.dayOfWeek || '',
                              startTime: selected?.startTime || '',
                              endTime: selected?.endTime || '',
                              semester: selected?.semester || prev.semester,
                              year: selected?.year || prev.year,
                              purpose: 'borrow schedule',
                              date: nextValidDate || prev.date
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={borrowSchedulesLoading ? 'Loading schedules...' : 'Select schedule to borrow'} />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg max-h-[300px] overflow-y-auto">
                            {borrowSchedulesLoading ? (
                              <div className="p-4 text-center flex items-center justify-center gap-2 text-sm text-gray-600">
                                <LoadingSpinner size="sm" />
                                Fetching schedules...
                              </div>
                            ) : borrowableSchedules.length > 0 ? (
                              borrowableSchedules.map(schedule => (
                                <SelectItem key={schedule._id} value={schedule._id}>
                                  {schedule.courseCode} • {schedule.dayOfWeek} {schedule.startTime}-{schedule.endTime} • {schedule.roomName} ({schedule.instructorName})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                No schedules available to borrow
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                          {selectedBorrowSchedule
                            ? `Currently assigned to ${selectedBorrowSchedule.instructorName}.`
                            : 'Choose a schedule from another instructor to request a takeover.'}
                        </p>
                      </>
                    ) : (
                      <>
                    <Label htmlFor="scheduleId">Schedule</Label>
                    <Select 
                      value={requestForm.scheduleId || ''}
                      onValueChange={(value) => setRequestForm(prev => ({ ...prev, scheduleId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        {schedules
                          .filter(s => !requestForm.courseId || String(s.courseId) === String(requestForm.courseId))
                          .map(s => (
                            <SelectItem key={s._id} value={s._id}>
                              {s.dayOfWeek} {s.startTime}-{s.endTime} • {s.roomName}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Only your schedules are listed.</p>
                      </>
                    )}
                  </div>

                  {isBorrowRequest ? (
                    <div className="md:col-span-2 space-y-3">
                      <Label>Current Assignment</Label>
                      <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed">
                        {selectedBorrowSchedule ? (
                          <>
                            <div><span className="font-medium">Room:</span> {selectedBorrowSchedule.roomName}</div>
                            <div><span className="font-medium">Day:</span> {selectedBorrowSchedule.dayOfWeek}</div>
                            <div><span className="font-medium">Time:</span> {selectedBorrowSchedule.startTime} - {selectedBorrowSchedule.endTime}</div>
                            <div><span className="font-medium">Instructor:</span> {selectedBorrowSchedule.instructorName}</div>
                          </>
                        ) : (
                          <span>Select a schedule to see its existing assignment.</span>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className="md:col-span-2">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="minCapacity">Minimum Capacity</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            id="minCapacity"
                            value={roomFilters.minCapacity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const digits = raw.replace(/[^0-9]/g, '');
                              setRoomFilters(prev => ({
                                ...prev,
                                minCapacity: digits
                              }));
                            }}
                            placeholder="Min. seats"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="building">Building</Label>
                          <Input
                            type="text"
                            id="building"
                            value={roomFilters.building}
                            onChange={(e) => setRoomFilters(prev => ({
                              ...prev,
                              building: e.target.value
                            }))}
                            placeholder="Search building..."
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="equipment">Required Equipment</Label>
                        <Select
                          value={roomFilters.equipment.join(',')}
                          onValueChange={(value) => setRoomFilters(prev => ({
                            ...prev,
                            equipment: value ? value.split(',') : []
                          }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select equipment" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg">
                            <SelectItem value="projector">Projector</SelectItem>
                            <SelectItem value="whiteboard">Whiteboard</SelectItem>
                            <SelectItem value="computers">Computers</SelectItem>
                            <SelectItem value="audio">Audio System</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="roomId">Select Room</Label>
                        <Select value={requestForm.roomId} onValueChange={(value) => setRequestForm(prev => ({ ...prev, roomId: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select room" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-gray-200 shadow-lg max-h-[300px] overflow-y-auto">
                            {loadingRooms ? (
                              <div className="p-4 text-center">
                                <LoadingSpinner size="sm" />
                                <span className="ml-2">Loading rooms...</span>
                              </div>
                            ) : filteredRooms.length > 0 ? (
                              <>
                                {filteredRooms.map(room => (
                                  <SelectItem key={room._id} value={room._id}>
                                    {room.name} • {room.building} (Capacity: {room.capacity})
                                  </SelectItem>
                                ))}
                              </>
                            ) : (
                              <SelectItem value="none" disabled>
                                No rooms available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">Filtered by your criteria above.</p>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      type="date"
                      id="date"
                      value={requestForm.date}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        
                        // For borrow requests, validate that the date matches the schedule's day
                        if (isBorrowRequest && selectedBorrowSchedule && selectedDate) {
                          if (!isDateOnDayOfWeek(selectedDate, selectedBorrowSchedule.dayOfWeek)) {
                            toast.error(`The selected date must be a ${selectedBorrowSchedule.dayOfWeek}. Please choose a ${selectedBorrowSchedule.dayOfWeek}.`);
                            // Auto-correct to the next valid date
                            const nextValidDate = getNextDateForDayOfWeek(selectedBorrowSchedule.dayOfWeek, new Date(selectedDate + 'T00:00:00'));
                            setRequestForm(prev => ({ 
                              ...prev, 
                              date: nextValidDate,
                              dayOfWeek: selectedBorrowSchedule.dayOfWeek
                            }));
                            return;
                          }
                        }
                        
                        let autoDayOfWeek = '';
                        if (selectedDate) {
                          const dateObj = new Date(selectedDate + 'T00:00:00');
                          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          autoDayOfWeek = days[dateObj.getDay()];
                        }
                        setRequestForm(prev => ({ 
                          ...prev, 
                          date: selectedDate,
                          dayOfWeek: isBorrowRequest ? (selectedBorrowSchedule?.dayOfWeek || prev.dayOfWeek || autoDayOfWeek) : autoDayOfWeek
                        }));
                      }}
                      required
                      min={isBorrowRequest && selectedBorrowSchedule 
                        ? getNextDateForDayOfWeek(selectedBorrowSchedule.dayOfWeek) 
                        : new Date().toISOString().split('T')[0]}
                      // For borrow requests, add a step pattern to only allow the specific day
                      // We'll handle this via validation instead since HTML date input doesn't support day-of-week filtering
                    />
                    {isBorrowRequest && selectedBorrowSchedule && (
                      <p className="text-xs text-gray-500">
                        ⚠️ Only {selectedBorrowSchedule.dayOfWeek}s are allowed for this schedule
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dayOfWeek">Day of Week</Label>
                    <Select
                      value={requestForm.dayOfWeek}
                      onValueChange={(value) => {
                        if (isBorrowRequest) return;
                        if (requestForm.date) {
                          const selectedDate = new Date(requestForm.date + 'T00:00:00');
                          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          const actualDayOfWeek = days[selectedDate.getDay()];
                          
                          if (value !== actualDayOfWeek) {
                            toast.error(`Selected day (${value}) does not match the date (${actualDayOfWeek}). Please select the correct date or day.`);
                            return;
                          }
                        }
                        setRequestForm(prev => ({ ...prev, dayOfWeek: value }));
                      }}
                      required
                      disabled={isBorrowRequest}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="Monday">Monday</SelectItem>
                        <SelectItem value="Tuesday">Tuesday</SelectItem>
                        <SelectItem value="Wednesday">Wednesday</SelectItem>
                        <SelectItem value="Thursday">Thursday</SelectItem>
                        <SelectItem value="Friday">Friday</SelectItem>
                        <SelectItem value="Saturday">Saturday</SelectItem>
                        <SelectItem value="Sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                    {requestForm.date && requestForm.dayOfWeek && (() => {
                      const dateObj = new Date(requestForm.date + 'T00:00:00');
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      const actualDayOfWeek = days[dateObj.getDay()];
                      return requestForm.dayOfWeek !== actualDayOfWeek && !isBorrowRequest ? (
                        <p className="text-xs text-red-600">⚠ Day of week does not match the selected date</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      type="time"
                      id="startTime"
                      value={requestForm.startTime}
                      onChange={(e) => {
                        if (isBorrowRequest) return;
                        const newStartTime = e.target.value;
                        setRequestForm(prev => ({ ...prev, startTime: newStartTime }));
                        if (requestForm.date && newStartTime && requestForm.endTime) {
                          filteredRooms.forEach(room => {
                            checkRoomAvailability(room._id, requestForm.date, newStartTime, requestForm.endTime);
                          });
                        }
                      }}
                      required
                      disabled={isBorrowRequest}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      type="time"
                      id="endTime"
                      value={requestForm.endTime}
                      onChange={(e) => {
                        if (isBorrowRequest) return;
                        const newEndTime = e.target.value;
                        setRequestForm(prev => ({ ...prev, endTime: newEndTime }));
                        if (requestForm.date && requestForm.startTime && newEndTime) {
                          filteredRooms.forEach(room => {
                            checkRoomAvailability(room._id, requestForm.date, requestForm.startTime, newEndTime);
                          });
                        }
                      }}
                      required
                      disabled={isBorrowRequest}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="semester">Semester</Label>
                      <Select
                        value={requestForm.semester}
                        onValueChange={(value) => setRequestForm(prev => ({ ...prev, semester: value }))}
                        required
                        disabled={isBorrowRequest}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-gray-200 shadow-lg">
                          <SelectItem value="First Term">First Term</SelectItem>
                          <SelectItem value="Second Term">Second Term</SelectItem>
                          <SelectItem value="Third Term">Third Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        value={requestForm.year}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                        min={2023}
                        max={2050}
                        required
                        disabled={isBorrowRequest}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="purpose">Purpose</Label>
                    <Select
                      value={requestForm.purpose}
                      onValueChange={(value) => setRequestForm(prev => ({ ...prev, purpose: value }))}
                      required
                      disabled={isBorrowRequest}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="make-up class">Make-up Class</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="unit test">Unit Test</SelectItem>
                        <SelectItem value="borrow schedule">Borrow Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">Additional Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional information or special requirements..."
                      value={requestForm.notes}
                      onChange={(e) => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  {/* Conflict Display */}
                  {requestConflicts.length > 0 && (
                    <div className="md:col-span-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-900 mb-2">Conflicts Detected</h4>
                          <p className="text-sm text-red-700 mb-2">
                            The following conflicts were found. Please adjust your request before submitting:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                            {requestConflicts.map((conflict, idx) => (
                              <li key={idx}>{conflict}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {checkingConflicts && (
                    <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700">
                        <LoadingSpinner size="sm" />
                        <span className="text-sm">Checking for conflicts...</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 md:col-span-2">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowRequestDialog(false);
                      setRequestConflicts([]);
                    }}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-gray-900 hover:bg-gray-800 text-white"
                      disabled={checkingConflicts || requestConflicts.length > 0}
                    >
                      {requestConflicts.length > 0 ? 'Resolve Conflicts First' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle>Confirm Schedule Request</DialogTitle>
                  <DialogDescription>
                    Are you sure about these details? Your actions cannot be changed.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  {pendingRequestData && (
                    <>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-600">Request Type:</span>
                          <span className="text-gray-900">{pendingRequestData.requestType === 'borrow_schedule' ? 'Borrow Schedule' : 'Room/Time Change'}</span>
                        </div>
                        {pendingRequestData.courseId && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Course:</span>
                            <span className="text-gray-900">
                              {courses.find(c => c._id === pendingRequestData.courseId)?.code || 'N/A'}
                            </span>
                          </div>
                        )}
                        {pendingRequestData.date && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Date:</span>
                            <span className="text-gray-900">{new Date(pendingRequestData.date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {pendingRequestData.dayOfWeek && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Day:</span>
                            <span className="text-gray-900">{pendingRequestData.dayOfWeek}</span>
                          </div>
                        )}
                        {pendingRequestData.startTime && pendingRequestData.endTime && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Time:</span>
                            <span className="text-gray-900">{pendingRequestData.startTime} - {pendingRequestData.endTime}</span>
                          </div>
                        )}
                        {pendingRequestData.roomId && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Room:</span>
                            <span className="text-gray-900">
                              {rooms.find(r => r._id === pendingRequestData.roomId)?.name || 'N/A'}
                            </span>
                          </div>
                        )}
                        {pendingRequestData.purpose && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-600">Purpose:</span>
                            <span className="text-gray-900">{pendingRequestData.purpose}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConfirmDialog(false);
                      setPendingRequestData(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-gray-900 hover:bg-gray-800 text-white"
                    onClick={handleConfirmSubmit}
                  >
                    Confirm & Submit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.map(request => (
              <div key={request._id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{request.courseName}</h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {request.type === 'borrow_schedule'
                        ? `Borrow schedule${request.originalInstructorName ? ` from ${request.originalInstructorName}` : ''}`
                        : `${request.type.replace('_', ' ')} request`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.replace('_', ' ')}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{request.details}</p>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {request.roomName && (
                    <div>
                      <span className="font-medium text-gray-600">Room:</span> {request.roomName}
                    </div>
                  )}
                  {request.dayOfWeek && request.startTime && request.endTime && (
                    <div>
                      <span className="font-medium text-gray-600">When:</span> {request.dayOfWeek} {request.startTime} - {request.endTime}
                    </div>
                  )}
                  {request.borrowDate && (
                    <div>
                      <span className="font-medium text-gray-600">Date:</span> {new Date(request.borrowDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-gray-500">No requests submitted yet</p>
                <p className="text-sm text-gray-400">Click "New Request" to submit your first request</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const handleEditAvailability = (day: string) => {
    setEditingDay(day);
    setTempAvailabilitySlots(availability[day as keyof Availability] || []);
    setShowAvailabilityDialog(true);
  };

  const handleSaveAvailability = async () => {
    if (!editingDay) return;

    try {
      // Update local state
      const updatedAvailability = {
        ...availability,
        [editingDay]: tempAvailabilitySlots
      };
      setAvailability(updatedAvailability);

      // Convert to backend format - send all days (empty arrays for unavailable days)
      const backendAvailability: Record<string, { startTime: string; endTime: string }[]> = {};
      Object.entries(updatedAvailability).forEach(([day, slots]) => {
        backendAvailability[day] = slots || [];
      });

      // Save to backend
      if (instructorProfileId) {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${apiService.baseUrl}/instructor/availability`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ availability: backendAvailability })
        });

        const result = await response.json();
        if (result.success) {
          // Update local state with the saved availability from backend
          if (result.data?.availability) {
            const savedAvailability = result.data.availability;
            let availMap: any = {};
            
            if (savedAvailability instanceof Map) {
              availMap = Object.fromEntries(savedAvailability);
            } else if (savedAvailability && typeof savedAvailability === 'object') {
              availMap = savedAvailability;
            }
            
            const normalizeDay = (obj: any, dayCapital: string, dayLower: string) => {
              const capital = obj[dayCapital];
              const lower = obj[dayLower];
              if (Array.isArray(capital)) return capital;
              if (Array.isArray(lower)) return lower;
              return [];
            };
            
            const updatedAvailability: Availability = {
              Monday: normalizeDay(availMap, 'Monday', 'monday'),
              Tuesday: normalizeDay(availMap, 'Tuesday', 'tuesday'),
              Wednesday: normalizeDay(availMap, 'Wednesday', 'wednesday'),
              Thursday: normalizeDay(availMap, 'Thursday', 'thursday'),
              Friday: normalizeDay(availMap, 'Friday', 'friday'),
              Saturday: normalizeDay(availMap, 'Saturday', 'saturday'),
              Sunday: normalizeDay(availMap, 'Sunday', 'sunday')
            };
            
            setAvailability(updatedAvailability);
          }
          
          toast.success('Availability updated successfully');
          setShowAvailabilityDialog(false);
          setEditingDay(null);
          setTempAvailabilitySlots([]);
        } else {
          throw new Error(result.message || 'Failed to update availability');
        }
      } else {
        toast.error('Instructor profile not found');
      }
    } catch (error: any) {
      console.error('Failed to save availability:', error);
      toast.error(error.message || 'Failed to update availability');
    }
  };

  const handleAddTimeSlot = () => {
    setTempAvailabilitySlots([...tempAvailabilitySlots, { startTime: '09:00', endTime: '17:00' }]);
  };

  const handleRemoveTimeSlot = (index: number) => {
    setTempAvailabilitySlots(tempAvailabilitySlots.filter((_, i) => i !== index));
  };

  const handleUpdateTimeSlot = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = [...tempAvailabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setTempAvailabilitySlots(updated);
  };

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    // Save to localStorage
    try {
      localStorage.setItem('instructorNotifications', JSON.stringify(updated));
      toast.success('Notification preferences saved');
    } catch (e) {
      console.error('Failed to save notification preferences', e);
    }
  };

  const SettingsContent = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Availability Settings
          </CardTitle>
          <CardDescription>Set your available hours for scheduling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(availability).map(([day, slots]) => (
              <div key={day} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-24 font-medium text-gray-900">{day}</div>
                  {slots.length > 0 ? (
                    <div className="flex gap-2">
                      {slots.map((slot: { startTime: string; endTime: string }, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white">
                          {slot.startTime} - {slot.endTime}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Not available</span>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white"
                  onClick={() => handleEditAvailability(day)}
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
              <div>
                <div className="font-medium text-gray-900">Email Notifications</div>
                <div className="text-sm text-gray-500">Receive schedule updates via email</div>
              </div>
              <input 
                type="checkbox" 
                checked={notifications.emailNotifications}
                onChange={(e) => handleNotificationChange('emailNotifications', e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer" 
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
              <div>
                <div className="font-medium text-gray-900">Schedule Reminders</div>
                <div className="text-sm text-gray-500">Get reminders before classes</div>
              </div>
              <input 
                type="checkbox" 
                checked={notifications.scheduleReminders}
                onChange={(e) => handleNotificationChange('scheduleReminders', e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer" 
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
              <div>
                <div className="font-medium text-gray-900">Student Updates</div>
                <div className="text-sm text-gray-500">Notifications about student activities</div>
              </div>
              <input 
                type="checkbox" 
                checked={notifications.studentUpdates}
                onChange={(e) => handleNotificationChange('studentUpdates', e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer" 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Edit Dialog */}
      <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Availability - {editingDay}</DialogTitle>
            <DialogDescription>
              Set your available time slots for {editingDay}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tempAvailabilitySlots.length > 0 ? (
              <div className="space-y-3">
                {tempAvailabilitySlots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500">Start Time</Label>
                        <Input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => handleUpdateTimeSlot(index, 'startTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">End Time</Label>
                        <Input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => handleUpdateTimeSlot(index, 'endTime', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveTimeSlot(index)}
                      className="mt-6"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No time slots set. Click "Add Time Slot" to add one.</p>
            )}
            <Button
              variant="outline"
              onClick={handleAddTimeSlot}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Time Slot
            </Button>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAvailabilityDialog(false);
                setEditingDay(null);
                setTempAvailabilitySlots([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAvailability}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <DashboardLayout sidebarItems={sidebarItems} currentPage={getPageTitle()}>
      {activeTab === 'overview' && <OverviewContent />}
      {activeTab === 'schedule' && <ScheduleContent />}
      {activeTab === 'courses' && <CoursesContent />}
      {activeTab === 'students' && <StudentsContent />}
      {activeTab === 'requests' && <RequestsContent />}
      {activeTab === 'settings' && <SettingsContent />}

      {/* Schedule Details Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Details</DialogTitle>
            <DialogDescription>
              {selectedSchedule ? (
                <div className="text-sm text-gray-600">
                  {selectedSchedule.courseCode} - {selectedSchedule.courseName} • {selectedSchedule.dayOfWeek} {selectedSchedule.startTime}-{selectedSchedule.endTime}
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {scheduleStudents.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Student</TableHead>
                      <TableHead className="font-semibold">Student ID</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheduleStudents.map(s => (
                      <TableRow key={s._id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.studentId}</TableCell>
                        <TableCell>{s.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-6">No students enrolled.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Details Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Course Details</DialogTitle>
            <DialogDescription>
              {selectedCourseForDialog ? (
                <div className="text-sm text-gray-600">
                  {selectedCourseForDialog.code} - {selectedCourseForDialog.name}
                </div>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Department:</span>
              <span>{selectedCourseForDialog?.department}</span>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-900">Schedules</div>
              <div className="flex flex-wrap gap-2">
                {schedules.filter(s => String(s.courseId) === String(selectedCourseForDialog?._id)).map(s => (
                  <Badge key={s._id} className={`cursor-pointer ${String(selectedCourseScheduleId) === String(s._id) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`} onClick={() => { setSelectedCourseScheduleId(String(s._id)); loadStudentsForCourseSchedule(String(s._id)); }}>
                    {s.dayOfWeek} {s.startTime}-{s.endTime}
                  </Badge>
                ))}
                {schedules.filter(s => String(s.courseId) === String(selectedCourseForDialog?._id)).length === 0 && (
                  <span className="text-sm text-gray-500">No schedules</span>
                )}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold">Student ID</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseScheduleStudents.length > 0 ? courseScheduleStudents.map(s => (
                    <TableRow key={s._id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.studentId}</TableCell>
                      <TableCell>{s.email}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">No students enrolled.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}