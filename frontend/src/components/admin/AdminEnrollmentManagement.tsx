import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { FileDown, Search, UserPlus, Users } from 'lucide-react';
import { apiClient } from '../../lib/api';
import type { EnrolledStudent, ScheduleSummary, EnrollmentFilters } from '../../types/enrollment';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import Papa from 'papaparse';

export function AdminEnrollmentManagement() {
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EnrollmentFilters>({
    yearLevel: 'all',
    section: 'all',
    department: 'all',
    search: '',
    semester: 'all'
  });
  const [scheduleSummaries, setScheduleSummaries] = useState<ScheduleSummary[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  
  // Enrollment dialog state for schedule summary
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [selectedScheduleForEnrollment, setSelectedScheduleForEnrollment] = useState<ScheduleSummary | null>(null);
  const [enrollmentMode, setEnrollmentMode] = useState<'bulk' | 'individual'>('bulk');
  const [bulkYearLevel, setBulkYearLevel] = useState<string>('');
  const [bulkSection, setBulkSection] = useState<string>('');
  const [enrollmentDialogStudentIds, setEnrollmentDialogStudentIds] = useState<Set<string>>(new Set());
  const [enrollmentDialogFilterYear, setEnrollmentDialogFilterYear] = useState<string>('all');
  const [enrollmentDialogFilterSection, setEnrollmentDialogFilterSection] = useState<string>('all');
  const [enrollmentDialogFilterDept, setEnrollmentDialogFilterDept] = useState<string>('all');
  const [enrollingFromDialog, setEnrollingFromDialog] = useState(false);

  // --- New enrollment UI state ---
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  interface Student {
    docId: string;
    userId: string | null;
    name: string;
    year: string;
    yearLevel?: string;
    section: string;
    department: string;
    email: string;
  }
  
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [filterYearLevel, setFilterYearLevel] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [loadingEnrollPanel, setLoadingEnrollPanel] = useState(false);

  useEffect(() => {
    loadEnrolledStudents();
  }, [filters]);

  // load schedules and students for enrollment panel on mount
  useEffect(() => {
    loadEnrollmentLookups();
  }, []);

  const loadEnrolledStudents = async () => {
    try {
      setLoading(true);
      
      // Load enrolled students and schedules in parallel
      const [enrolled, schedules] = await Promise.all([
        apiClient.getEnrollments(),
        apiClient.getSchedules()
      ]);
      
      console.debug('Raw enrollments response:', enrolled);
      console.debug('Raw schedules response:', schedules);

      // Extract enrollments and build schedule enrollment counts map
      const enrollmentsList = enrolled?.enrollments || [];
      const enrollmentsBySchedule = new Map();
      
      // Map to normalized structure and build schedule counts
      const normalizedEnrolledStudents: EnrolledStudent[] = enrollmentsList.map((e: any) => {
        // Extract all relevant objects
        const student = e.studentId || e.student || {};
        const studentUser = student.userId || student.user || {};
        const course = e.courseId || e.course || {};
        const schedule = e.scheduleId || e.schedule || {};
        const instructor = e.instructorId || schedule.instructor || {};
        const instructorUser = instructor.userId || instructor.user || {};
        
        // Track enrollments per schedule
        const scheduleId = schedule._id || schedule.id || e.scheduleId;
        if (scheduleId) {
          const currentCount = enrollmentsBySchedule.get(scheduleId) || 0;
          enrollmentsBySchedule.set(scheduleId, currentCount + 1);
        }

        const normalized = {
          id: e._id || e.id || '',
          studentId: student._id || student.id || e.studentId || '',
          studentName: studentUser.name || student.name || e.studentName || 'Unknown Student',
          yearLevel: student.yearLevel || student.year || studentUser.yearLevel || e.yearLevel || '1',
          section: student.section || studentUser.section || e.section || '',
          department: studentUser.department || student.department || e.department || '',
          courseId: course._id || course.id || e.courseId || '',
          courseCode: course.code || course.courseCode || e.courseCode || '',
          courseName: course.name || course.courseName || e.courseName || '',
          scheduleId: scheduleId || '',
          instructorName: instructorUser.name || instructor.name || e.instructorName || '',
          dayOfWeek: schedule.dayOfWeek || e.dayOfWeek || '',
          startTime: schedule.startTime || e.startTime || '',
          endTime: schedule.endTime || e.endTime || '',
          semester: schedule.semester || e.semester || '',
          academicYear: schedule.academicYear || schedule.year || e.academicYear || ''
        };

        console.debug('Normalized enrollment:', normalized);
        return normalized;
      });

      // Process schedules with accurate enrollment counts
      const schedulesList = schedules?.schedules || [];
      console.debug('Processing schedules:', schedulesList);

      const normalizedSummaries: ScheduleSummary[] = schedulesList.map((s: any) => {
        const scheduleId = s._id || s.id;
        const course = s.courseId || s.course || {};
        const instructor = s.instructorId || s.instructor || {};
        const instructorUser = instructor.userId || instructor.user || {};
        const room = s.roomId || s.room || {};

        const normalized = {
          id: scheduleId,
          courseId: course._id || course.id || s.courseId || '',
          courseCode: course.code || s.courseCode || '',
          courseName: course.name || s.courseName || '',
          instructorName: instructorUser.name || instructor.name || s.instructorName || '',
          roomName: room.name || s.roomName || '',
          dayOfWeek: s.dayOfWeek || s.day || '',
          startTime: s.startTime || s.start || '',
          endTime: s.endTime || s.end || '',
          semester: s.semester || '',
          academicYear: s.academicYear || s.year || '',
          // Use our tracked count or fallback to API-provided count
          enrolledCount: enrollmentsBySchedule.get(scheduleId) || s.enrolledCount || 0
        };

        console.debug('Normalized schedule with count:', {
          scheduleId,
          count: normalized.enrolledCount,
          trackedCount: enrollmentsBySchedule.get(scheduleId),
          apiCount: s.enrolledCount
        });
        
        return normalized;
      });

      setEnrolledStudents(normalizedEnrolledStudents);
      setScheduleSummaries(normalizedSummaries);
    } catch (error) {
      console.error('Failed to load enrollment data:', error);
      toast.error('Failed to load enrollment data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    try {
      const csvData = Papa.unparse(enrolledStudents.map(student => ({
        'Student Name': student.studentName,
        'Year Level': student.yearLevel,
        'Section': student.section,
        'Department': student.department,
        'Course Code': student.courseCode,
        'Course Name': student.courseName,
        'Instructor': student.instructorName,
        'Day': student.dayOfWeek,
        'Time': `${student.startTime}-${student.endTime}`,
        'Semester': student.semester,
        'Academic Year': student.academicYear
      })));

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `enrolled-students-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Failed to export data:', error);
      toast.error('Failed to export data');
    }
  };

  useEffect(() => {
    // apply filters locally to the admin students list
    const result = (allStudents || []).filter((s: any) => {
      // For year level, check both the year field and if it matches the first digit of section
      const studentYear = String(s.year || s.yearLevel || '');
      const sectionYear = (s.section || '').charAt(0);
      const yearMatches = filterYearLevel === 'all' || 
                         studentYear === String(filterYearLevel) ||
                         sectionYear === String(filterYearLevel);

      // For section, check exact match with new format (e.g., "1A", "2B")
      const matchesSection = filterSection === 'all' || 
                           (s.section || '').trim() === filterSection;

      // For department, normalize case and trim
      const studentDept = (s.department || '').trim();
      const matchesDept = filterDepartment === 'all' || 
                         studentDept.toLowerCase() === filterDepartment.toLowerCase();

      return yearMatches && matchesSection && matchesDept;
    });
    setFilteredStudents(result);
    // reset selected ids if they are not in filtered set
    setSelectedStudentIds(prev => {
      const next = new Set(Array.from(prev).filter(id => result.some((r: any) => (r._id === id || r.id === id))));
      return next;
    });
  }, [allStudents, filterYearLevel, filterSection, filterDepartment]);

  // loadEnrollments is now replaced by loadEnrolledStudents

  const loadEnrollmentLookups = async () => {
    setLoadingEnrollPanel(true);
    try {
      // Load schedules and students in parallel
      const [schedulesResponse, studentsResponse] = await Promise.all([
        apiClient.getSchedules().catch((err: Error) => {
          console.error('Failed to load schedules:', err);
          return null;
        }),
        apiClient.getAdminStudents().catch((err: Error) => {
          console.error('Failed to load students:', err);
          return null;
        })
      ]);

      console.debug('Raw schedules response:', schedulesResponse);
      console.debug('Raw students response:', studentsResponse);

      // Process schedules
      if (schedulesResponse?.success) {
        const schedulesList = schedulesResponse.schedules || [];
        console.debug('Processing schedules:', schedulesList);

        const normalized = schedulesList.map((s: any) => {
          // Extract nested objects
          const course = s.course || {};
          const instructor = s.instructor || {};
          const instructorUser = instructor.user || instructor.userId || {};
          const room = s.room || {};

          const scheduleId = s._id || s.id;
          return {
            _id: scheduleId,
            courseId: course._id || course.id || s.courseId || '',
            courseCode: course.code || s.courseCode || '',
            courseName: course.name || s.courseName || '',
            instructorId: instructor._id || instructor.id || s.instructorId || '',
            instructorName: instructorUser.name || instructor.name || s.instructorName || '',
            roomName: room.name || s.roomName || '',
            dayOfWeek: s.dayOfWeek || s.day || '',
            startTime: s.startTime || s.start || '',
            endTime: s.endTime || s.end || '',
            semester: s.semester || s.academicTerm || '',
            year: s.year || s.academicYear || '',
            active: s.status !== 'canceled'
          };
        });

        console.debug('Normalized schedules:', normalized);
        setSchedules(normalized);
      } else {
        toast.error('Failed to load schedules. Please try again.');
        setSchedules([]);
      }

      // Process students
      if (studentsResponse?.success && studentsResponse.students) {
        const studentsList = studentsResponse.students;
        console.debug('Processing students:', studentsList);

        const normalizedStudents = studentsList.map((st: any) => {
          // Extract user info
          const user = st.user || st.userId || {};

          return {
            docId: st._id || st.id || '',
            userId: user._id || user.id || st.userId || null,
            name: user.name || st.name || '',
            year: st.year || st.yearLevel || user.year || user.yearLevel || '',
            section: st.section || user.section || '',
            department: user.department || st.department || '',
            email: user.email || st.email || ''
          };
        });

        console.debug('Normalized students:', normalizedStudents);
        
        // Filter out incomplete student records
        const validStudents = normalizedStudents.filter((s: { docId: string; name: string }) => s.docId && s.name);
        if (validStudents.length === 0) {
          console.warn('No valid student records found after normalization');
          toast.error('No valid student records found. Please check the data.');
        }
        
        setAllStudents(validStudents);
      } else {
        toast.error('Failed to load students. Please try again.');
        setAllStudents([]);
      }

    } catch (error) {
      console.error('loadEnrollmentLookups error:', error);
      toast.error('Failed to load enrollment data. Please check your connection and try again.');
    } finally {
      setLoadingEnrollPanel(false);
    }
  };

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedStudentIds(new Set(filteredStudents.map(s => s.docId)));
  };

  const clearSelected = () => setSelectedStudentIds(new Set());
  const [enrolling, setEnrolling] = useState(false);

  const handleEnrollSelected = async () => {
    setEnrolling(true);
    if (!selectedSchedule) {
      toast.error('Please select a schedule to enroll students into');
      setEnrolling(false);
      return;
    }
    if (selectedStudentIds.size === 0) {
      toast.error('No students selected for enrollment');
      setEnrolling(false);
      return;
    }

    try {
      const studentIds = Array.from(selectedStudentIds);
      const payload = {
        scheduleId: selectedSchedule._id,
        courseId: selectedSchedule.courseId,
        instructorId: selectedSchedule.instructorId,
        students: studentIds
      };

      console.debug('Enrollment payload:', payload);

      // Use POST /schedules endpoint for enrollment
      const res = await apiClient.createEnrollment(payload) as any;
      
      console.debug('Enrollment response:', res);

      const created = res.created || [];
      const conflicts = res.conflicts || [];
      const createdCount = created.length;
      const conflictCount = conflicts.length;

      if (res && res.success === false) {
        const message = res.message || 'Enrollment failed';
        console.warn('Enrollment API returned failure:', res);
        toast.error(message);
      } else {
        if (createdCount > 0) {
          if (conflictCount > 0) {
            toast.success(
              `Successfully enrolled ${createdCount} student(s). ${conflictCount} conflict(s) detected.`,
              { duration: 5000 }
            );
          } else {
            toast.success(`Successfully enrolled ${createdCount} student(s)`);
          }
          // refresh data immediately
          await loadEnrolledStudents();
        } else if (conflictCount > 0) {
          toast.error(`Failed to enroll students: ${conflictCount} conflict(s) detected.`);
        } else {
          toast.error('No students were enrolled. Please try again.');
        }
      }

      // refresh lookups after showing feedback
      await loadEnrollmentLookups();
      clearSelected();
    } catch (error: any) {
      console.error('Enrollment failed:', error);
      // Prefer message from our backend validation
      const msg = error?.message || 'Failed to enroll students';
      toast.error(msg);
    } finally {
      setEnrolling(false);
    }
  };

  // Utility function to sort enrolled students
  const sortEnrolledStudents = (a: EnrolledStudent, b: EnrolledStudent) => {
    if (a.yearLevel !== b.yearLevel) return a.yearLevel.localeCompare(b.yearLevel);
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.studentName.localeCompare(b.studentName);
  };

  // Filter enrolled students based on filters
  const filteredEnrolledStudents = enrolledStudents.filter((student) => {
    // Year level filter
    if (filters.yearLevel !== 'all' && student.yearLevel !== filters.yearLevel) {
      return false;
    }
    
    // Section filter
    if (filters.section !== 'all' && !student.section.includes(filters.section)) {
      return false;
    }
    
    // Department filter
    if (filters.department !== 'all' && student.department !== filters.department) {
      return false;
    }
    
    // Semester filter
    if (filters.semester !== 'all' && student.semester !== filters.semester) {
      return false;
    }
    
    // Search filter (search in student name or course code/name)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = student.studentName.toLowerCase().includes(searchLower);
      const matchesCourseCode = student.courseCode.toLowerCase().includes(searchLower);
      const matchesCourseName = student.courseName.toLowerCase().includes(searchLower);
      
      if (!matchesName && !matchesCourseCode && !matchesCourseName) {
        return false;
      }
    }
    
    return true;
  });

  // Filter students for enrollment dialog
  const enrollmentDialogFilteredStudents = allStudents.filter((s: any) => {
    const studentYear = String(s.year || s.yearLevel || '');
    const sectionYear = (s.section || '').charAt(0);
    const yearMatches = enrollmentDialogFilterYear === 'all' || 
                       studentYear === String(enrollmentDialogFilterYear) ||
                       sectionYear === String(enrollmentDialogFilterYear);
    const matchesSection = enrollmentDialogFilterSection === 'all' || 
                         (s.section || '').trim() === enrollmentDialogFilterSection;
    const studentDept = (s.department || '').trim();
    const matchesDept = enrollmentDialogFilterDept === 'all' || 
                       studentDept.toLowerCase() === enrollmentDialogFilterDept.toLowerCase();
    return yearMatches && matchesSection && matchesDept;
  });

  // Clear section when year level changes
  useEffect(() => {
    if (bulkYearLevel && bulkSection) {
      // Check if the section matches the selected year
      const sectionYear = bulkSection.charAt(0);
      if (sectionYear !== bulkYearLevel) {
        setBulkSection('');
      }
    }
  }, [bulkYearLevel]);

  // Open enrollment dialog for a schedule
  const handleOpenEnrollmentDialog = (schedule: ScheduleSummary, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click handler
    // Find the full schedule object from schedules list
    const fullSchedule = schedules.find(s => s._id === schedule.id || s.courseId === schedule.courseId);
    if (fullSchedule) {
      setSelectedScheduleForEnrollment({
        ...schedule,
        ...fullSchedule
      } as ScheduleSummary);
    } else {
      setSelectedScheduleForEnrollment(schedule);
    }
    setShowEnrollmentDialog(true);
    setEnrollmentMode('bulk');
    setBulkYearLevel('');
    setBulkSection('');
    setEnrollmentDialogStudentIds(new Set());
  };

  // Handle bulk enrollment (by year and section)
  const handleBulkEnrollment = async () => {
    if (!selectedScheduleForEnrollment) {
      toast.error('No schedule selected');
      return;
    }
    if (!bulkYearLevel || !bulkSection) {
      toast.error('Please select both year level and section');
      return;
    }

    setEnrollingFromDialog(true);
    try {
      // Find the full schedule object
      const fullSchedule = schedules.find(s => 
        (s._id === selectedScheduleForEnrollment.id) || 
        (s.courseId === selectedScheduleForEnrollment.courseId)
      );

      if (!fullSchedule) {
        toast.error('Schedule not found');
        return;
      }

      const payload = {
        scheduleId: fullSchedule._id,
        courseId: fullSchedule.courseId || selectedScheduleForEnrollment.courseId,
        instructorId: fullSchedule.instructorId,
        yearLevel: bulkYearLevel,
        section: bulkSection
      };

      console.debug('Bulk enrollment payload:', payload);
      const res = await apiClient.createEnrollment(payload) as any;
      console.debug('Bulk enrollment response:', res);

      const created = res.created || [];
      const conflicts = res.conflicts || [];
      const createdCount = created.length;
      const conflictCount = conflicts.length;

      if (res && res.success === false) {
        toast.error(res.message || 'Enrollment failed');
      } else {
        if (createdCount > 0) {
          if (conflictCount > 0) {
            toast.success(
              `Successfully enrolled ${createdCount} student(s) from ${bulkYearLevel}${bulkSection}. ${conflictCount} conflict(s) detected.`,
              { duration: 5000 }
            );
          } else {
            toast.success(`Successfully enrolled ${createdCount} student(s) from ${bulkYearLevel}${bulkSection}`);
          }
          await loadEnrolledStudents();
          setShowEnrollmentDialog(false);
        } else if (conflictCount > 0) {
          toast.error(`Failed to enroll students: ${conflictCount} conflict(s) detected.`);
        } else {
          toast.error('No students found matching the selected year and section');
        }
      }
    } catch (error: any) {
      console.error('Bulk enrollment failed:', error);
      toast.error(error?.message || 'Failed to enroll students');
    } finally {
      setEnrollingFromDialog(false);
    }
  };

  // Handle individual student enrollment from dialog
  const handleIndividualEnrollment = async () => {
    if (!selectedScheduleForEnrollment) {
      toast.error('No schedule selected');
      return;
    }
    if (enrollmentDialogStudentIds.size === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setEnrollingFromDialog(true);
    try {
      const fullSchedule = schedules.find(s => 
        (s._id === selectedScheduleForEnrollment.id) || 
        (s.courseId === selectedScheduleForEnrollment.courseId)
      );

      if (!fullSchedule) {
        toast.error('Schedule not found');
        return;
      }

      const studentIds = Array.from(enrollmentDialogStudentIds);
      const payload = {
        scheduleId: fullSchedule._id,
        courseId: fullSchedule.courseId || selectedScheduleForEnrollment.courseId,
        instructorId: fullSchedule.instructorId,
        students: studentIds
      };

      console.debug('Individual enrollment payload:', payload);
      const res = await apiClient.createEnrollment(payload) as any;
      console.debug('Individual enrollment response:', res);

      const created = res.created || [];
      const conflicts = res.conflicts || [];
      const createdCount = created.length;
      const conflictCount = conflicts.length;

      if (res && res.success === false) {
        toast.error(res.message || 'Enrollment failed');
      } else {
        if (createdCount > 0) {
          if (conflictCount > 0) {
            toast.success(
              `Successfully enrolled ${createdCount} student(s). ${conflictCount} conflict(s) detected.`,
              { duration: 5000 }
            );
          } else {
            toast.success(`Successfully enrolled ${createdCount} student(s)`);
          }
          await loadEnrolledStudents();
          setShowEnrollmentDialog(false);
          setEnrollmentDialogStudentIds(new Set());
        } else if (conflictCount > 0) {
          toast.error(`Failed to enroll students: ${conflictCount} conflict(s) detected.`);
        } else {
          toast.error('No students were enrolled. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Individual enrollment failed:', error);
      toast.error(error?.message || 'Failed to enroll students');
    } finally {
      setEnrollingFromDialog(false);
    }
  };

  const toggleEnrollmentDialogStudent = (studentId: string) => {
    setEnrollmentDialogStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectAllEnrollmentDialogStudents = () => {
    setEnrollmentDialogStudentIds(new Set(enrollmentDialogFilteredStudents.map(s => s.docId)));
  };

  const clearEnrollmentDialogSelection = () => {
    setEnrollmentDialogStudentIds(new Set());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students</CardTitle>
          <CardDescription>View and manage enrolled students across courses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Select
              value={filters.yearLevel}
              onValueChange={(value) => setFilters(prev => ({ ...prev, yearLevel: value }))}
            >
              <SelectTrigger className="w-[180px] bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                <SelectValue placeholder="Year Level" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Years</SelectItem>
                <SelectItem value="1" className="hover:bg-blue-50 bg-white">First Year</SelectItem>
                <SelectItem value="2" className="hover:bg-blue-50 bg-white">Second Year</SelectItem>
                <SelectItem value="3" className="hover:bg-blue-50 bg-white">Third Year</SelectItem>
                <SelectItem value="4" className="hover:bg-blue-50 bg-white">Fourth Year</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.section}
              onValueChange={(value) => setFilters(prev => ({ ...prev, section: value }))}
            >
              <SelectTrigger className="w-[180px] bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Sections</SelectItem>
                <SelectItem value="A" className="hover:bg-blue-50 bg-white">Section A</SelectItem>
                <SelectItem value="B" className="hover:bg-blue-50 bg-white">Section B</SelectItem>
                <SelectItem value="C" className="hover:bg-blue-50 bg-white">Section C</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.department}
              onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
            >
              <SelectTrigger className="w-[180px] bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Departments</SelectItem>
                <SelectItem value="BSIT" className="hover:bg-blue-50 bg-white">BSIT</SelectItem>
                <SelectItem value="BSBA" className="hover:bg-blue-50 bg-white">BSBA</SelectItem>
                <SelectItem value="BSHM" className="hover:bg-blue-50 bg-white">BSHM</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.semester}
              onValueChange={(value) => setFilters(prev => ({ ...prev, semester: value }))}
            >
              <SelectTrigger className="w-[180px] bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Semesters</SelectItem>
                <SelectItem value="Fall 2025" className="hover:bg-blue-50 bg-white">Fall 2025</SelectItem>
                <SelectItem value="Spring 2026" className="hover:bg-blue-50 bg-white">Spring 2026</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-[240px] relative">
              <Input
                placeholder="Search by name or course..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11 pr-3 rounded"
              />
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>

            <Button variant="outline" onClick={handleExportData} className="h-11 bg-white border-2 border-gray-300 hover:bg-blue-50 hover:border-blue-400">
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Schedule Summary Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Schedule Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduleSummaries.map((schedule) => (
                <Card 
                  key={schedule.id} 
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedSummaryId === schedule.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedSummaryId(schedule.id === selectedSummaryId ? null : schedule.id)}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{schedule.courseCode}</h4>
                        <p className="text-sm text-gray-500">{schedule.courseName}</p>
                      </div>
                      <Badge>{`${schedule.enrolledCount} enrolled`}</Badge>
                    </div>
                    <p className="text-sm">{schedule.instructorName}</p>
                    <p className="text-sm">{`${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`}</p>
                    <p className="text-sm text-gray-500">{`${schedule.semester} ${schedule.academicYear}`}</p>
                  </div>
                  
                  {selectedSummaryId === schedule.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium">Enrolled Students</h5>
                        <Button
                          size="sm"
                          onClick={(e) => handleOpenEnrollmentDialog(schedule, e)}
                          className="h-8"
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Enroll
                        </Button>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Year</TableHead>
                              <TableHead>Section</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {enrolledStudents
                              .filter(student => {
                                // Add debug logging to see the IDs being compared
                                console.debug('Comparing schedule IDs:', {
                                  studentScheduleId: student.scheduleId,
                                  scheduleId: schedule.id,
                                  student: student
                                });
                                // Normalize IDs for comparison
                                const normalizedStudentScheduleId = String(student.scheduleId).replace(/[^0-9a-fA-F]/g, '');
                                const normalizedScheduleId = String(schedule.id).replace(/[^0-9a-fA-F]/g, '');
                                return normalizedStudentScheduleId === normalizedScheduleId;
                              })
                              .sort((a, b) => {
                                if (a.yearLevel !== b.yearLevel) return a.yearLevel.localeCompare(b.yearLevel);
                                if (a.section !== b.section) return a.section.localeCompare(b.section);
                                return a.studentName.localeCompare(b.studentName);
                              })
                              .map(student => (
                                <TableRow key={student.id}>
                                  <TableCell className="py-2">{student.studentName}</TableCell>
                                  <TableCell className="py-2">{student.yearLevel}</TableCell>
                                  <TableCell className="py-2">{student.section}</TableCell>
                                </TableRow>
                              ))}
                            {enrolledStudents.filter(student => {
                                const normalizedStudentScheduleId = String(student.scheduleId).replace(/[^0-9a-fA-F]/g, '');
                                const normalizedScheduleId = String(schedule.id).replace(/[^0-9a-fA-F]/g, '');
                                return normalizedStudentScheduleId === normalizedScheduleId;
                              }).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-2 text-gray-500">
                                  No students enrolled
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  {selectedSummaryId !== schedule.id && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleOpenEnrollmentDialog(schedule, e)}
                        className="w-full"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Enroll Students
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Enrolled Students Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Semester</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filteredEnrolledStudents].sort(sortEnrolledStudents).map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.studentName}</TableCell>
                  <TableCell>{student.yearLevel}</TableCell>
                  <TableCell>{student.section}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{student.courseCode}</div>
                      <div className="text-sm text-gray-500">{student.courseName}</div>
                    </div>
                  </TableCell>
                  <TableCell>{`${student.dayOfWeek} ${student.startTime}-${student.endTime}`}</TableCell>
                  <TableCell>{student.instructorName}</TableCell>
                  <TableCell>{`${student.semester} ${student.academicYear}`}</TableCell>
                </TableRow>
              ))}
              {filteredEnrolledStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    {loading ? 'Loading...' : 'No enrolled students found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Enroll Students Panel */}
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <CardTitle className="text-xl font-bold text-gray-900">Enroll Students</CardTitle>
          <CardDescription className="text-gray-700 mt-1">
            Enroll students into a selected schedule by Year / Section / Department
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-gray-50 p-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Courses Available</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Select Course <span className="text-red-500">*</span></label>
              <Select
                value={selectedSchedule?._id || ''}
                onValueChange={(val) => setSelectedSchedule(schedules.find(s => s._id === val) || null)}
              >
                <SelectTrigger className="w-full bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                  <SelectValue placeholder="Choose course" />
                </SelectTrigger>
                <SelectContent 
                  className="!bg-white !border-2 !border-gray-300 !shadow-xl rounded-lg max-h-[400px] z-50 min-w-[450px]"
                  position="popper"
                  sideOffset={5}
                >
                  {schedules
                    .filter(s => s.active !== false) // Only show active schedules
                    .sort((a, b) => {
                      // Sort by course code, then day of week
                      if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode);
                      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
                    })
                    .map((s) => (
                      <SelectItem 
                        key={s._id} 
                        value={s._id}
                        className="!bg-white hover:!bg-blue-50 focus:!bg-blue-50 data-[highlighted]:!bg-blue-50 cursor-pointer !py-3 !px-4 text-sm border-b border-gray-200 last:border-b-0"
                      >
                        <span className="block">
                          <span className="block font-semibold text-gray-900">{s.courseCode} - {s.courseName}</span>
                          <span className="block text-xs text-gray-600 mt-1">{s.dayOfWeek} {s.startTime}-{s.endTime} • {s.instructorName}</span>
                          {s.roomName && (
                            <span className="block text-xs text-gray-500 mt-0.5">Room: {s.roomName}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Year Level</label>
              <Select value={filterYearLevel} onValueChange={setFilterYearLevel}>
                <SelectTrigger className="w-full bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                  <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Years</SelectItem>
                  {Array.from(new Set(allStudents.map(s => String(s.year || s.yearLevel || '')))).filter(Boolean).map(y => (
                    <SelectItem key={y} value={y} className="hover:bg-blue-50 bg-white">Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Section</label>
              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger className="w-full bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                  <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Sections</SelectItem>
                  {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'].map(sec => (
                    <SelectItem key={sec} value={sec} className="hover:bg-blue-50 bg-white">{`Section ${sec}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Department</label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="w-full bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-gray-300 shadow-lg rounded-lg">
                    <SelectItem value="all" className="hover:bg-blue-50 bg-white">All Departments</SelectItem>
                    {Array.from(new Set(allStudents
                      .map(s => (s.department || '').trim())
                      .filter(Boolean) // Remove empty values
                      .sort() // Sort alphabetically
                    )).map(dept => (
                      <SelectItem key={dept} value={dept} className="hover:bg-blue-50 bg-white">{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={selectAllFiltered}
                  className="bg-white border-2 border-gray-300 hover:bg-blue-50 hover:border-blue-400"
                >
                  Select All ({filteredStudents.length})
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={clearSelected}
                  className="hover:bg-gray-200"
                >
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {selectedStudentIds.size} student(s) selected
                </div>
                <Button 
                  onClick={handleEnrollSelected} 
                  disabled={enrolling || !selectedSchedule || selectedStudentIds.size === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrolling ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Enrolling...
                    </span>
                  ) : (
                    `Enroll ${selectedStudentIds.size} Student(s)`
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Student List</h3>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 bg-gray-50">
                        <Checkbox
                          checked={filteredStudents.length > 0 && 
                                  filteredStudents.every(s => selectedStudentIds.has(s.docId))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllFiltered();
                            } else {
                              clearSelected();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="bg-gray-50 font-semibold text-gray-900">Student Name</TableHead>
                      <TableHead className="bg-gray-50 font-semibold text-gray-900">Year</TableHead>
                      <TableHead className="bg-gray-50 font-semibold text-gray-900">Section</TableHead>
                      <TableHead className="bg-gray-50 font-semibold text-gray-900">Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s, index) => {
                      const id = s.docId;
                      const checked = selectedStudentIds.has(id);
                      return (
                        <TableRow 
                          key={id}
                          className={`hover:bg-blue-50 transition-colors ${checked ? 'bg-blue-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <TableCell className="py-3">
                            <Checkbox checked={checked} onCheckedChange={() => toggleSelectStudent(id)} />
                          </TableCell>
                          <TableCell className="py-3 font-medium text-gray-900">{s.name}</TableCell>
                          <TableCell className="py-3 text-gray-700">{s.year}</TableCell>
                          <TableCell className="py-3 text-gray-700">{s.section}</TableCell>
                          <TableCell className="py-3 text-gray-700">{s.department}</TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500 bg-gray-50">
                          {loadingEnrollPanel ? 'Loading students...' : 'No students found for selected filters'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enrollment Dialog for Schedule Summary */}
      <Dialog open={showEnrollmentDialog} onOpenChange={setShowEnrollmentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-50 border-2 border-gray-200 shadow-2xl">
          <DialogHeader className="bg-white rounded-t-lg p-6 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">Enroll Students</DialogTitle>
            <DialogDescription>
              {selectedScheduleForEnrollment && (
                <div className="mt-3 space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg text-gray-900">
                        {selectedScheduleForEnrollment.courseCode} - {selectedScheduleForEnrollment.courseName}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">Schedule:</span> {selectedScheduleForEnrollment.dayOfWeek} {selectedScheduleForEnrollment.startTime}-{selectedScheduleForEnrollment.endTime}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Instructor:</span> {selectedScheduleForEnrollment.instructorName}
                      </p>
                      {selectedScheduleForEnrollment.roomName && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Room:</span> {selectedScheduleForEnrollment.roomName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 p-6 bg-gray-50">
            {/* Mode Selection */}
            <div className="flex gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
              <Button
                variant={enrollmentMode === 'bulk' ? 'default' : 'outline'}
                onClick={() => setEnrollmentMode('bulk')}
                className={`flex items-center gap-2 flex-1 transition-all ${
                  enrollmentMode === 'bulk' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Users className="h-4 w-4" />
                Enroll by Year & Section
              </Button>
              <Button
                variant={enrollmentMode === 'individual' ? 'default' : 'outline'}
                onClick={() => setEnrollmentMode('individual')}
                className={`flex items-center gap-2 flex-1 transition-all ${
                  enrollmentMode === 'individual' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Enroll Individual Students
              </Button>
            </div>

            {/* Bulk Enrollment Mode */}
            {enrollmentMode === 'bulk' && (
              <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Enrollment</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-year" className="text-sm font-semibold text-gray-700">
                      Year Level <span className="text-red-500">*</span>
                    </Label>
                    <Select value={bulkYearLevel} onValueChange={setBulkYearLevel}>
                      <SelectTrigger 
                        id="bulk-year" 
                        className="bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11"
                      >
                        <SelectValue placeholder="Select year level" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="1" className="hover:bg-blue-50">Year 1</SelectItem>
                        <SelectItem value="2" className="hover:bg-blue-50">Year 2</SelectItem>
                        <SelectItem value="3" className="hover:bg-blue-50">Year 3</SelectItem>
                        <SelectItem value="4" className="hover:bg-blue-50">Year 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-section" className="text-sm font-semibold text-gray-700">
                      Section <span className="text-red-500">*</span>
                    </Label>
                    <Select 
                      value={bulkSection} 
                      onValueChange={setBulkSection}
                      disabled={!bulkYearLevel}
                    >
                      <SelectTrigger 
                        id="bulk-section"
                        className="bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <SelectValue placeholder={bulkYearLevel ? "Select section" : "Select year first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        {bulkYearLevel && ['A', 'B', 'C'].map(sec => (
                          <SelectItem key={sec} value={`${bulkYearLevel}${sec}`} className="hover:bg-blue-50">
                            Section {bulkYearLevel}{sec}
                          </SelectItem>
                        ))}
                        {!bulkYearLevel && (
                          <>
                            <SelectItem value="1A" className="hover:bg-blue-50">Section 1A</SelectItem>
                            <SelectItem value="1B" className="hover:bg-blue-50">Section 1B</SelectItem>
                            <SelectItem value="2A" className="hover:bg-blue-50">Section 2A</SelectItem>
                            <SelectItem value="2B" className="hover:bg-blue-50">Section 2B</SelectItem>
                            <SelectItem value="3A" className="hover:bg-blue-50">Section 3A</SelectItem>
                            <SelectItem value="3B" className="hover:bg-blue-50">Section 3B</SelectItem>
                            <SelectItem value="4A" className="hover:bg-blue-50">Section 4A</SelectItem>
                            <SelectItem value="4B" className="hover:bg-blue-50">Section 4B</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-500 rounded-full p-2 mt-0.5">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900 mb-1">Bulk Enrollment Summary</p>
                      <p className="text-sm text-blue-800">
                        This will enroll <strong>all students</strong> from <strong className="text-blue-900">Year {bulkYearLevel || '?'} Section {bulkSection || '?'}</strong> into this schedule.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Enrollment Mode */}
            {enrollmentMode === 'individual' && (
              <div className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Student Selection</h3>
                
                {/* Filters */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Year Level</Label>
                    <Select value={enrollmentDialogFilterYear} onValueChange={setEnrollmentDialogFilterYear}>
                      <SelectTrigger className="bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                        <SelectValue placeholder="All years" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="all" className="hover:bg-blue-50">All Years</SelectItem>
                        {Array.from(new Set(allStudents.map(s => String(s.year || s.yearLevel || '')))).filter(Boolean).map(y => (
                          <SelectItem key={y} value={y} className="hover:bg-blue-50">Year {y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Section</Label>
                    <Select value={enrollmentDialogFilterSection} onValueChange={setEnrollmentDialogFilterSection}>
                      <SelectTrigger className="bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                        <SelectValue placeholder="All sections" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="all" className="hover:bg-blue-50">All Sections</SelectItem>
                        {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'].map(sec => (
                          <SelectItem key={sec} value={sec} className="hover:bg-blue-50">Section {sec}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Department</Label>
                    <Select value={enrollmentDialogFilterDept} onValueChange={setEnrollmentDialogFilterDept}>
                      <SelectTrigger className="bg-white border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 h-11">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200 shadow-lg">
                        <SelectItem value="all" className="hover:bg-blue-50">All Departments</SelectItem>
                        {Array.from(new Set(allStudents
                          .map(s => (s.department || '').trim())
                          .filter(Boolean)
                          .sort()
                        )).map(dept => (
                          <SelectItem key={dept} value={dept} className="hover:bg-blue-50">{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllEnrollmentDialogStudents}
                      className="bg-white hover:bg-blue-50 border-gray-300"
                    >
                      Select All ({enrollmentDialogFilteredStudents.length})
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearEnrollmentDialogSelection}
                      className="hover:bg-gray-200"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {enrollmentDialogStudentIds.size} student(s) selected
                    </div>
                  </div>
                </div>

                {/* Student List */}
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <div className="max-h-[350px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-gray-50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-12 bg-gray-50">
                            <Checkbox
                              checked={enrollmentDialogFilteredStudents.length > 0 && 
                                      enrollmentDialogFilteredStudents.every(s => enrollmentDialogStudentIds.has(s.docId))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  selectAllEnrollmentDialogStudents();
                                } else {
                                  clearEnrollmentDialogSelection();
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="bg-gray-50 font-semibold text-gray-900">Student Name</TableHead>
                          <TableHead className="bg-gray-50 font-semibold text-gray-900">Year</TableHead>
                          <TableHead className="bg-gray-50 font-semibold text-gray-900">Section</TableHead>
                          <TableHead className="bg-gray-50 font-semibold text-gray-900">Department</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollmentDialogFilteredStudents.map((student, index) => {
                          const isSelected = enrollmentDialogStudentIds.has(student.docId);
                          return (
                            <TableRow 
                              key={student.docId}
                              className={`hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                            >
                              <TableCell className="py-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleEnrollmentDialogStudent(student.docId)}
                                />
                              </TableCell>
                              <TableCell className="py-3 font-medium text-gray-900">{student.name}</TableCell>
                              <TableCell className="py-3 text-gray-700">{student.year || student.yearLevel}</TableCell>
                              <TableCell className="py-3 text-gray-700">{student.section}</TableCell>
                              <TableCell className="py-3 text-gray-700">{student.department}</TableCell>
                            </TableRow>
                          );
                        })}
                        {enrollmentDialogFilteredStudents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-gray-500 bg-gray-50">
                              No students found matching the filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-white border-t border-gray-200 p-6 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setShowEnrollmentDialog(false);
                setEnrollmentDialogStudentIds(new Set());
                setBulkYearLevel('');
                setBulkSection('');
              }}
              className="border-2 border-gray-300 hover:bg-gray-50 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={enrollmentMode === 'bulk' ? handleBulkEnrollment : handleIndividualEnrollment}
              disabled={enrollingFromDialog || 
                       (enrollmentMode === 'bulk' && (!bulkYearLevel || !bulkSection)) ||
                       (enrollmentMode === 'individual' && enrollmentDialogStudentIds.size === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enrollingFromDialog ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Enrolling...
                </span>
              ) : enrollmentMode === 'bulk' ? (
                `Enroll All from ${bulkYearLevel}${bulkSection || ''}`
              ) : (
                `Enroll ${enrollmentDialogStudentIds.size} Student(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}