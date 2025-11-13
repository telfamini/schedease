/**
 * Comprehensive Auto-Schedule Generator
 * Generates complete semester schedules for all year levels and sections
 * with intelligent conflict avoidance and optimal time slot allocation
 */

import mongoose from 'mongoose';
import { Schedule, Course, Room, Instructor } from '../config/database.js';

// Time utility functions
export function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Get the first occurrence date of a day-of-week within semester range
 * @param {string} dayOfWeek - Day name (Monday, Tuesday, etc.)
 * @param {Date} semesterStart - Semester start date
 * @returns {Date|null} The first date of that day-of-week, or null if not applicable
 */
export function getFirstOccurrenceDate(dayOfWeek, semesterStart) {
  if (!semesterStart) return null;
  
  const dayMap = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  
  const targetDay = dayMap[dayOfWeek];
  if (targetDay === undefined) return null;
  
  // Find the first occurrence of this day-of-week on or after semesterStart
  const current = new Date(semesterStart);
  const currentDay = current.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  current.setDate(current.getDate() + daysUntilTarget);
  
  return current;
}

/**
 * Check if a day-of-week has any occurrences within the semester date range
 * @param {string} dayOfWeek - Day name (Monday, Tuesday, etc.)
 * @param {Date} semesterStart - Semester start date
 * @param {Date} semesterEnd - Semester end date
 * @returns {boolean} True if the day occurs at least once in the range
 */
export function isDayInSemesterRange(dayOfWeek, semesterStart, semesterEnd) {
  if (!semesterStart || !semesterEnd) return true; // No restriction if dates not provided
  
  const dayMap = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  
  const targetDay = dayMap[dayOfWeek];
  if (targetDay === undefined) return false;
  
  // Find the first occurrence of this day-of-week on or after semesterStart
  const current = new Date(semesterStart);
  const currentDay = current.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  current.setDate(current.getDate() + daysUntilTarget);
  
  // Check if this first occurrence is within the semester range
  return current <= semesterEnd;
}

/**
 * Main auto-schedule generation function
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Generated schedules and statistics
 */
export async function generateComprehensiveSchedule(params) {
  const {
    semester,
    year,
    academicYear,
    startTime = '07:00',
    endTime = '18:00',
    saveToDatabase = false,
    semesterStartDate = null // Format: 'YYYY-MM-DD'
  } = params;

  const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SLOT_DURATION = 30; // 30-minute time slots for granularity
  const SEMESTER_WEEKS = 14; // 14-week semester duration
  const MAX_SUBJECTS_PER_DAY = 2; // Maximum 2 different subjects per day per section (strict limit)
  
  // Calculate semester date range
  let semesterStart = null;
  let semesterEnd = null;
  
  if (semesterStartDate) {
    semesterStart = new Date(semesterStartDate);
    semesterEnd = new Date(semesterStart);
    semesterEnd.setDate(semesterEnd.getDate() + (SEMESTER_WEEKS * 7)); // 14 weeks = 98 days
  }
  
  // Initialize tracking structures
  const generatedSchedules = [];
  const conflicts = [];
  const stats = {
    totalCourses: 0,
    scheduledCourses: 0,
    conflicts: 0,
    byYearLevel: { '1': 0, '2': 0, '3': 0, '4': 0 },
    bySection: {},
    semesterStartDate: semesterStartDate || 'Not specified',
    semesterEndDate: semesterEnd ? semesterEnd.toISOString().split('T')[0] : 'Not specified',
    semesterWeeks: SEMESTER_WEEKS,
    maxSubjectsPerDay: MAX_SUBJECTS_PER_DAY
  };

  try {
    // Fetch all required data
    const [courses, instructors, rooms] = await Promise.all([
      Course.find({ semester }).sort({ yearLevel: 1, section: 1, type: 1 }),
      Instructor.find().populate('userId'),
      Room.find({ isAvailable: true }).sort({ capacity: -1 })
    ]);

    stats.totalCourses = courses.length;

    if (courses.length === 0) {
      return {
        success: false,
        message: 'No courses found for the specified semester',
        stats
      };
    }

    // Group courses by year level and section
    const courseGroups = groupCoursesByYearAndSection(courses);

    // Initialize conflict tracking matrices
    const roomTimeSlots = initializeTimeSlotMatrix(rooms, VALID_DAYS);
    const instructorTimeSlots = initializeTimeSlotMatrix(instructors, VALID_DAYS);
    const sectionTimeSlots = {};

    // Process each year level and section
    for (const yearLevel of ['1', '2', '3', '4']) {
      for (const section of ['A', 'B']) {
        const sectionKey = `${yearLevel}${section}`;
        const sectionCourses = courseGroups[sectionKey] || [];

        if (sectionCourses.length === 0) continue;

        // Initialize section time tracking
        sectionTimeSlots[sectionKey] = initializeSectionTimeSlots(VALID_DAYS);

        // ALL courses need to be scheduled (lectures AND labs are separate classes)
        console.log(`\n📋 Section ${sectionKey}: ${sectionCourses.length} total classes to schedule`);

        // Sort courses by duration (longer courses first for better fitting)
        const sortedCourses = sectionCourses.sort((a, b) => b.duration - a.duration);

        // Distribute classes across days evenly using strict round-robin
        const daysNeeded = Math.ceil(sortedCourses.length / MAX_SUBJECTS_PER_DAY);
        console.log(`   Distributing ${sortedCourses.length} classes across ${daysNeeded} days (max ${MAX_SUBJECTS_PER_DAY} classes per day)`);

        // Each section gets its own day counter starting from a different day
        // This prevents sections from overlapping on the same days
        const sectionStartDay = (parseInt(yearLevel) * 2 + (section === 'B' ? 1 : 0)) % VALID_DAYS.length;
        let currentDayIdx = sectionStartDay;
        console.log(`   Starting from ${VALID_DAYS[currentDayIdx]} for section ${sectionKey}`);
        
        for (const course of sortedCourses) {
          let scheduled = false;
          let attempts = 0;
          
          // Try each day starting from current day index
          while (!scheduled && attempts < VALID_DAYS.length) {
            const dayToTry = VALID_DAYS[currentDayIdx];
            
            // Check if this day can accept more classes (max 2)
            const classesOnDay = sectionTimeSlots[sectionKey][dayToTry].length;
            
            console.log(`   🔍 Trying ${course.code} on ${dayToTry} (currently has ${classesOnDay}/${MAX_SUBJECTS_PER_DAY} classes)`);
            
            if (classesOnDay < MAX_SUBJECTS_PER_DAY) {
              // This day has space, try to schedule here
              const result = await scheduleCourseToBestSlot({
                course,
                instructors,
                rooms,
                yearLevel,
                section,
                sectionKey,
                semester,
                year,
                academicYear,
                startTime,
                endTime,
                validDays: [dayToTry], // Only try THIS specific day
                roomTimeSlots,
                instructorTimeSlots,
                sectionTimeSlots,
                slotDuration: SLOT_DURATION,
                semesterStart,
                semesterEnd,
                maxSubjectsPerDay: MAX_SUBJECTS_PER_DAY
              });

              if (result.success) {
                generatedSchedules.push(result.schedule);
                stats.scheduledCourses++;
                stats.byYearLevel[yearLevel]++;
                stats.bySection[sectionKey] = (stats.bySection[sectionKey] || 0) + 1;
                scheduled = true;
                
                const newCount = sectionTimeSlots[sectionKey][dayToTry].length;
                console.log(`   ✅ ${course.code} scheduled on ${dayToTry} (now has ${newCount}/${MAX_SUBJECTS_PER_DAY} classes)`);
                
                // If this day now has max classes, move to next day
                if (newCount >= MAX_SUBJECTS_PER_DAY) {
                  console.log(`   ➡️  ${dayToTry} is now FULL, moving to next day`);
                  currentDayIdx = (currentDayIdx + 1) % VALID_DAYS.length;
                }
              } else {
                // Failed on this day, try next day
                console.log(`   ⚠️  ${course.code} failed on ${dayToTry}: ${result.reason}`);
                currentDayIdx = (currentDayIdx + 1) % VALID_DAYS.length;
                attempts++;
              }
            } else {
              // This day is full, move to next day
              currentDayIdx = (currentDayIdx + 1) % VALID_DAYS.length;
              attempts++;
            }
          }
          
          if (!scheduled) {
            console.log(`   ❌ Failed to schedule ${course.code} after trying all days`);
            conflicts.push({
              course: course.code,
              yearLevel,
              section,
              reason: 'No available slot found on any day'
            });
            stats.conflicts++;
          }
        }
      }
    }

    // Optionally save to database
    if (saveToDatabase && generatedSchedules.length > 0) {
      // Delete existing schedules for this semester/year
      await Schedule.deleteMany({ semester, year, academicYear });
      
      // Insert new schedules
      const scheduleDocuments = generatedSchedules.map(s => ({
        courseId: s.courseId,
        instructorId: s.instructorId,
        roomId: s.roomId,
        dayOfWeek: s.dayOfWeek,
        scheduleDate: s.scheduleDate, // Include actual date
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration, // Preserve exact course duration from database
        semester,
        year,
        academicYear,
        status: 'published',
        courseCode: s.courseCode,
        courseName: s.courseName,
        instructorName: s.instructorName,
        roomName: s.roomName,
        building: s.building
      }));

      await Schedule.insertMany(scheduleDocuments);
    }

    return {
      success: true,
      schedules: generatedSchedules,
      conflicts,
      stats,
      saved: saveToDatabase
    };

  } catch (error) {
    console.error('Error generating comprehensive schedule:', error);
    throw error;
  }
}

/**
 * Group courses by year level and section
 */
function groupCoursesByYearAndSection(courses) {
  const groups = {};
  
  for (const course of courses) {
    const yearLevel = course.yearLevel || '1';
    const section = course.section || 'A';
    const key = `${yearLevel}${section}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(course);
  }
  
  return groups;
}

/**
 * Initialize time slot matrix for rooms/instructors robustly.
 * Ensures each item has entries for all validDays even if no availability initially present.
 */
function initializeTimeSlotMatrix(items, validDays) {
  const matrix = {};
  if (!Array.isArray(validDays)) validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (const item of (items || [])) {
    const itemId = String(item._id || item.id || item).toString();
    matrix[itemId] = {};
    for (const day of validDays) {
      matrix[itemId][day] = matrix[itemId][day] || []; // array of { start, end }
    }
  }
  return matrix;
}

/**
 * Initialize section-specific time slots
 */
function initializeSectionTimeSlots(validDays) {
  const slots = {};
  
  for (const day of validDays) {
    slots[day] = []; // Array of { start, end, courseId } time ranges
  }
  
  return slots;
}

/**
 * Find best time slot for a course
 */
async function scheduleCourseToBestSlot(params) {
  const {
    course,
    instructors,
    rooms,
    yearLevel,
    section,
    sectionKey,
    semester,
    year,
    academicYear,
    startTime,
    endTime,
    validDays,
    roomTimeSlots,
    instructorTimeSlots,
    sectionTimeSlots,
    slotDuration,
    semesterStart,
    semesterEnd,
    maxSubjectsPerDay = 3
  } = params;

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const courseDuration = Number(course.duration || 90);

  // find an instructor (prefer assigned)
  const instructor = findSuitableInstructor(course, instructors);
  if (!instructor) return { success: false, reason: 'No suitable instructor available' };

  // find and sort suitable rooms
  const suitableRooms = findSuitableRooms(course, rooms);
  if (suitableRooms.length === 0) return { success: false, reason: 'No suitable room available' };

  // Try each day in provided validDays (usually single-day list from caller)
  for (const day of (validDays || [])) {
    if (!isDayInSemesterRange(day, semesterStart, semesterEnd)) continue;

    // lunch break window
    const LUNCH_START = toMinutes('12:00');
    const LUNCH_END = day === 'Wednesday' ? toMinutes('14:00') : toMinutes('13:00');

    for (let timeSlot = startMinutes; timeSlot + courseDuration <= endMinutes; timeSlot += slotDuration) {
      const slotEnd = timeSlot + courseDuration;

      if (rangesOverlap(timeSlot, slotEnd, LUNCH_START, LUNCH_END)) continue;

      // instructor availability and existing occupancy
      if (!isInstructorAvailable(instructor, day, timeSlot, slotEnd, instructorTimeSlots)) continue;

      // section availability (no student conflicts)
      if (!isSectionAvailable(sectionKey, day, timeSlot, slotEnd, sectionTimeSlots)) continue;

      // select a room candidate using best-fit
      const roomCandidate = pickBestRoomForCourse(course, suitableRooms);
      if (!roomCandidate) continue;

      // verify the chosen room is available
      if (!isRoomAvailable(roomCandidate, day, timeSlot, slotEnd, roomTimeSlots)) {
        // try next suitable room (if any) — remove the unavailable room temporarily from candidates
        const nextRooms = suitableRooms.filter(r => String(r._id) !== String(roomCandidate._id));
        for (const rc of nextRooms) {
          if (isRoomAvailable(rc, day, timeSlot, slotEnd, roomTimeSlots)) {
            // use rc
            markTimeSlotOccupied(rc._id.toString(), day, timeSlot, slotEnd, roomTimeSlots);
            markTimeSlotOccupied(instructor._id.toString(), day, timeSlot, slotEnd, instructorTimeSlots);
            markSectionTimeSlotOccupied(sectionKey, day, timeSlot, slotEnd, course._id, sectionTimeSlots);
            const scheduleDate = getFirstOccurrenceDate(day, semesterStart);
            return {
              success: true,
              schedule: {
                courseId: course._id,
                courseCode: course.code,
                courseName: course.name,
                instructorId: instructor._id,
                instructorName: instructor.userId?.name || 'Unknown',
                roomId: rc._id,
                roomName: rc.name,
                building: rc.building || 'Main Building',
                dayOfWeek: day,
                scheduleDate,
                startTime: toHHMM(timeSlot),
                endTime: toHHMM(slotEnd),
                duration: courseDuration,
                yearLevel,
                section,
                semester,
                year,
                academicYear
              }
            };
          }
        }
        // no available rooms at this timeslot, continue to next timeslot
        continue;
      }

      // If chosen room is available, occupy and return
      markTimeSlotOccupied(roomCandidate._id.toString(), day, timeSlot, slotEnd, roomTimeSlots);
      markTimeSlotOccupied(instructor._id.toString(), day, timeSlot, slotEnd, instructorTimeSlots);
      markSectionTimeSlotOccupied(sectionKey, day, timeSlot, slotEnd, course._id, sectionTimeSlots);
      const scheduleDate = getFirstOccurrenceDate(day, semesterStart);

      return {
        success: true,
        schedule: {
          courseId: course._id,
          courseCode: course.code,
          courseName: course.name,
          instructorId: instructor._id,
          instructorName: instructor.userId?.name || 'Unknown',
          roomId: roomCandidate._id,
          roomName: roomCandidate.name,
          building: roomCandidate.building || 'Main Building',
          dayOfWeek: day,
          scheduleDate,
          startTime: toHHMM(timeSlot),
          endTime: toHHMM(slotEnd),
          duration: courseDuration,
          yearLevel,
          section,
          semester,
          year,
          academicYear
        }
      };
    }
  }

  return { success: false, reason: 'No available time slot found' };
}

/**
 * Find suitable instructor for a course
 */
function findSuitableInstructor(course, instructors) {
  // First try assigned instructor
  if (course.instructorId) {
    const assigned = instructors.find(i => i._id.toString() === course.instructorId.toString());
    if (assigned) return assigned;
  }

  // Otherwise find any available instructor
  // You can add more sophisticated matching logic here
  return instructors[0] || null;
}

/**
 * Find suitable rooms for a course and sort by best-fit (smallest sufficient capacity first).
 * Avoid auditoriums by default and match room.type and equipment requirements.
 */
function findSuitableRooms(course, rooms) {
  const requiredCapacity = Number(course.requiredCapacity || course.studentsEnrolled || 50);
  const courseType = course.type || 'lecture';
  const requirements = Array.isArray(course.specialRequirements) ? course.specialRequirements : [];

  // Filter rooms that meet basic constraints
  const candidates = rooms.filter(room => {
    // Exclude auditoriums for normal auto-assignment unless explicitly required
    if (room.type === 'auditorium') return false;

    // Capacity check
    if ((room.capacity || 0) < requiredCapacity) return false;

    // Type matching (labs must go to lab-like rooms)
    if (courseType === 'lab' && room.type !== 'computer_lab' && room.type !== 'laboratory') {
      return false;
    }

    // Equipment requirements
    if (requirements.length > 0) {
      const hasAll = requirements.every(req => (room.equipment || []).includes(req));
      if (!hasAll) return false;
    }

    return true;
  });

  // Sort by closest-fit capacity (ascending) then prefer computer_lab for labs
  candidates.sort((a, b) => {
    const capDiff = (a.capacity || 0) - (b.capacity || 0);
    if (capDiff !== 0) return capDiff;
    // prefer computer_lab for labs
    if (courseType === 'lab') {
      if (a.type === 'computer_lab' && b.type !== 'computer_lab') return -1;
      if (b.type === 'computer_lab' && a.type !== 'computer_lab') return 1;
    }
    return 0;
  });

  return candidates;
}

/**
 * Check if instructor is available at given time
 */
function isInstructorAvailable(instructor, day, start, end, instructorTimeSlots) {
  const instructorId = instructor._id.toString();
  const occupiedSlots = instructorTimeSlots[instructorId][day];

  // Check against occupied time slots
  for (const slot of occupiedSlots) {
    if (rangesOverlap(start, end, slot.start, slot.end)) {
      return false;
    }
  }

  // Check instructor availability preferences (if set)
  const availability = instructor.availability?.get?.(day) || instructor.availability?.[day];
  if (availability && availability.length > 0) {
    const withinAvailability = availability.some(avail => {
      const availStart = toMinutes(avail.startTime);
      const availEnd = toMinutes(avail.endTime);
      return start >= availStart && end <= availEnd;
    });
    return withinAvailability;
  }

  return true;
}

/**
 * Check if section (students) is available at given time
 */
function isSectionAvailable(sectionKey, day, start, end, sectionTimeSlots) {
  const occupiedSlots = sectionTimeSlots[sectionKey][day];

  for (const slot of occupiedSlots) {
    if (rangesOverlap(start, end, slot.start, slot.end)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if room is available at given time using the roomTimeSlots occupancy matrix.
 * Also verifies the provided room object exists in matrix and handles missing keys gracefully.
 */
function isRoomAvailable(room, day, start, end, roomTimeSlots) {
  if (!room || !room._id) return false;
  const roomId = String(room._id);
  const roomSlots = roomTimeSlots[roomId];
  if (!roomSlots) return true; // no recorded occupancy -> considered available

  const occupiedSlots = roomSlots[day] || [];
  for (const slot of occupiedSlots) {
    if (rangesOverlap(start, end, slot.start, slot.end)) return false;
  }
  return true;
}

/**
 * Mark time slot as occupied for room/instructor
 */
function markTimeSlotOccupied(itemId, day, start, end, timeSlots) {
  timeSlots[itemId][day].push({ start, end });
}

/**
 * Mark time slot as occupied for section
 */
function markSectionTimeSlotOccupied(sectionKey, day, start, end, courseId, sectionTimeSlots) {
  sectionTimeSlots[sectionKey][day].push({ start, end, courseId });
}

/**
 * Count unique subjects (courses) scheduled for a section on a specific day
 * @param {string} sectionKey - Section identifier (e.g., "1-A")
 * @param {string} day - Day of week
 * @param {Object} sectionTimeSlots - Section time slots data
 * @returns {number} Number of unique courses scheduled
 */
function getUniqueCourseCountForDay(sectionKey, day, sectionTimeSlots) {
  if (!sectionTimeSlots[sectionKey] || !sectionTimeSlots[sectionKey][day]) {
    return 0;
  }
  
  const uniqueCourseIds = new Set();
  for (const slot of sectionTimeSlots[sectionKey][day]) {
    if (slot.courseId) {
      uniqueCourseIds.add(slot.courseId.toString());
    }
  }
  
  return uniqueCourseIds.size;
}
