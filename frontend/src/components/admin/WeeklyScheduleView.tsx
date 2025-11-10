import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { Button } from '../ui/button';

interface Schedule {
  _id: string;
  courseCode: string;
  courseName: string;
  instructorName: string;
  roomName: string;
  building: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  scheduleDate?: string; // Optional: actual date for 14-week semester restriction
  semester: string;
  year: number;
  academicYear: string;
  conflicts?: string[];
}

interface WeeklyScheduleViewProps {
  schedules: Schedule[];
  onClose: () => void;
}

export default function WeeklyScheduleView({ schedules, onClose }: WeeklyScheduleViewProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Get Monday of the current week
  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  }

  // Generate array of dates for the week (Mon-Sun)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  // Format date as "MMM DD"
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date range for header
  const formatDateRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Time slots (7 AM to 6 PM in 30-minute intervals)
  const timeSlots = Array.from({ length: 23 }, (_, i) => {
    const hour = Math.floor(7 + i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  // Convert time string to minutes for positioning
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Extract year level and section from course code (e.g., "ITCC111-1A" -> year: "1", section: "A")
  const extractYearSection = (courseCode: string) => {
    const match = courseCode?.match(/-(\d)([A-Z])$/);
    return match ? { year: match[1], section: match[2] } : { year: null, section: null };
  };

  // Filter schedules based on selected year level, section, and date range
  const filteredSchedules = schedules.filter(schedule => {
    const { year, section } = extractYearSection(schedule.courseCode);
    
    if (selectedYearLevel !== 'all' && year !== selectedYearLevel) {
      return false;
    }
    
    if (selectedSection !== 'all' && section !== selectedSection) {
      return false;
    }
    
    // If schedule has an actual date, check if it falls within the current week view
    if (schedule.scheduleDate) {
      const schedDate = new Date(schedule.scheduleDate);
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Sunday)
      
      // Only show schedules that fall within the displayed week
      if (schedDate < currentWeekStart || schedDate > weekEnd) {
        return false;
      }
    }
    
    return true;
  });

  // Get schedules for a specific day
  const getSchedulesForDay = (dayOfWeek: string) => {
    return filteredSchedules.filter(s => s.dayOfWeek === dayOfWeek);
  };

  // Calculate position and height for schedule block
  const getScheduleStyle = (startTime: string, endTime: string) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const duration = endMinutes - startMinutes;
    
    // Base time is 7:00 AM (420 minutes from midnight)
    const baseTime = 7 * 60;
    const topOffset = startMinutes - baseTime;
    
    // Each 30-minute slot is represented by a pixel height
    const pixelsPerMinute = 2; // 60 pixels per 30 minutes
    
    return {
      top: `${topOffset * pixelsPerMinute}px`,
      height: `${duration * pixelsPerMinute}px`
    };
  };

  // Get color for schedule block based on course type or conflicts
  const getScheduleColor = (schedule: Schedule) => {
    if (schedule.conflicts && schedule.conflicts.length > 0) {
      return 'bg-red-100 border-red-400 text-red-900';
    }
    
    // Color by course code prefix
    const prefix = schedule.courseCode?.substring(0, 4) || '';
    const colors: Record<string, string> = {
      'ITCC': 'bg-blue-100 border-blue-400 text-blue-900',
      'ITMS': 'bg-purple-100 border-purple-400 text-purple-900',
      'ITCI': 'bg-green-100 border-green-400 text-green-900',
      'ITNE': 'bg-orange-100 border-orange-400 text-orange-900',
      'ITSE': 'bg-pink-100 border-pink-400 text-pink-900',
      'ITEL': 'bg-indigo-100 border-indigo-400 text-indigo-900',
      'GEC': 'bg-yellow-100 border-yellow-400 text-yellow-900',
      'PATH': 'bg-teal-100 border-teal-400 text-teal-900',
      'NSTP': 'bg-cyan-100 border-cyan-400 text-cyan-900',
    };
    
    return colors[prefix] || 'bg-gray-100 border-gray-400 text-gray-900';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Calendar className="h-6 w-6" />
              <div>
                <h2 className="text-xl font-bold">Weekly Schedule View</h2>
                <p className="text-sm text-blue-100">{formatDateRange()}</p>
              </div>
            </div>
            
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters and Navigation */}
          <div className="flex items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Year Level Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-white whitespace-nowrap">Year Level:</label>
                <select
                  value={selectedYearLevel}
                  onChange={(e) => setSelectedYearLevel(e.target.value)}
                  className="px-3 py-1.5 rounded border border-blue-300 text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="all">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              {/* Section Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-white whitespace-nowrap">Section:</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-1.5 rounded border border-blue-300 text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="all">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="text-sm text-blue-100 ml-2">
                Showing {filteredSchedules.length} of {schedules.length} schedules
              </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
            <Button
              onClick={goToPreviousWeek}
              variant="outline"
              size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={goToCurrentWeek}
              variant="outline"
              size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              Today
            </Button>
            <Button
              onClick={goToNextWeek}
              variant="outline"
              size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[1200px]">
            {/* Days Header */}
            <div className="grid grid-cols-8 border-b border-gray-300 bg-gray-50 sticky top-0 z-10">
              <div className="p-3 text-sm font-semibold text-gray-600 border-r border-gray-300">
                Time
              </div>
              {daysOfWeek.map((day, index) => {
                const date = weekDates[index];
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={day}
                    className={`p-3 text-center border-r border-gray-300 ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`font-semibold text-sm ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className={`text-xs mt-1 ${isToday ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                      {formatDate(date)}
                      {isToday && <span className="ml-1 text-xs">(Today)</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div className="grid grid-cols-8 relative">
              {/* Time Labels Column */}
              <div className="border-r border-gray-300">
                {timeSlots.map((time, index) => (
                  <div
                    key={time}
                    className="h-[60px] border-b border-gray-200 p-2 text-xs text-gray-600 font-medium"
                  >
                    {index % 2 === 0 ? time : ''}
                  </div>
                ))}
              </div>

              {/* Schedule Columns for Each Day */}
              {daysOfWeek.map((day, dayIndex) => {
                const daySchedules = getSchedulesForDay(day);
                const isToday = weekDates[dayIndex].toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={day}
                    className={`border-r border-gray-300 relative ${
                      isToday ? 'bg-blue-50 bg-opacity-30' : ''
                    }`}
                  >
                    {/* Time slot grid lines */}
                    {timeSlots.map((time) => (
                      <div
                        key={time}
                        className="h-[60px] border-b border-gray-200"
                      />
                    ))}

                    {/* Schedule Blocks */}
                    <div className="absolute inset-0 pointer-events-none">
                      {daySchedules.map((schedule) => {
                        const style = getScheduleStyle(schedule.startTime, schedule.endTime);
                        const colorClass = getScheduleColor(schedule);
                        
                        return (
                          <div
                            key={schedule._id}
                            className={`absolute left-1 right-1 border-l-4 rounded p-1 text-xs overflow-hidden pointer-events-auto cursor-pointer hover:shadow-lg transition-shadow ${colorClass}`}
                            style={style}
                            title={`${schedule.courseCode} - ${schedule.courseName}\n${schedule.instructorName}\nRoom: ${schedule.roomName}\n${schedule.startTime} - ${schedule.endTime}`}
                          >
                            <div className="font-bold truncate">{schedule.courseCode}</div>
                            <div className="text-[10px] truncate">{schedule.courseName}</div>
                            <div className="text-[10px] truncate mt-1">
                              👨‍🏫 {schedule.instructorName || 'TBA'}
                            </div>
                            <div className="text-[10px] truncate">
                              🏫 {schedule.roomName || 'TBA'}
                            </div>
                            <div className="text-[10px] font-semibold mt-1">
                              🕐 {schedule.startTime} - {schedule.endTime}
                            </div>
                            {schedule.conflicts && schedule.conflicts.length > 0 && (
                              <div className="text-[10px] font-bold text-red-700 mt-1">
                                ⚠️ {schedule.conflicts.length} conflict(s)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded"></div>
                <span>Core Courses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
                <span>GE Courses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded"></div>
                <span>Conflicts</span>
              </div>
            </div>
            <div className="text-gray-500">
              Displaying: <span className="font-semibold text-gray-700">{filteredSchedules.length}</span>
              {filteredSchedules.length !== schedules.length && (
                <span className="ml-1">of {schedules.length}</span>
              )}
              {' '}schedule{filteredSchedules.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
