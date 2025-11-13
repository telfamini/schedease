import { Student, Subject, Course } from '../config/database.js';

// GET /api/student/curriculum
// Fetches all courses organized by year level and semester
export async function getCurriculum(req, res) {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const student = await Student.findOne({ userId: authUserId });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    console.log('Student department:', student.department);

    // Fetch all courses for the student's department
    // Group by base course code (without section suffix) to avoid duplicates
    const allCourses = await Course.find({ 
      department: student.department || 'IT' 
    })
      .populate('instructorId')
      .sort({ yearLevel: 1, semester: 1, code: 1 });

    console.log('Total courses found for department:', allCourses.length);
    console.log('Sample course data:', allCourses.slice(0, 2).map(c => ({
      code: c.code,
      name: c.name,
      yearLevel: c.yearLevel,
      semester: c.semester,
      department: c.department
    })));

    // Deduplicate courses by base code (remove section suffix like -1A, -2B)
    const courseMap = new Map();
    allCourses.forEach(course => {
      // Extract base code by removing section suffix pattern (-1A, -2B, etc.)
      const baseCode = course.code.replace(/-\d[A-Z]$/, '');
      if (!courseMap.has(baseCode)) {
        courseMap.set(baseCode, course);
      }
    });
    const courses = Array.from(courseMap.values());

    // Organize courses by year and semester
    const curriculum = {
      '1': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
      '2': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
      '3': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
      '4': { 'First Term': [], 'Second Term': [], 'Third Term': [] }
    };

    courses.forEach(course => {
      const year = course.yearLevel;
      const semester = course.semester;
      
      if (year && semester && curriculum[year] && curriculum[year][semester]) {
        curriculum[year][semester].push({
          id: course._id,
          code: course.code,
          name: course.name,
          credits: course.credits,
          type: course.type,
          duration: course.duration,
          instructorName: course.instructorName,
          yearLevel: course.yearLevel,
          semester: course.semester,
          department: course.department
        });
      }
    });

    console.log('Final curriculum structure:');
    Object.keys(curriculum).forEach(year => {
      Object.keys(curriculum[year]).forEach(term => {
        console.log(`Year ${year}, ${term}: ${curriculum[year][term].length} courses`);
      });
    });

    res.json({ success: true, data: curriculum });
  } catch (error) {
    console.error('Get curriculum error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch curriculum' });
  }
}

// GET /api/student/subjects?semester=First%20Term
// Uses authenticated student's year level automatically
export async function getMySubjects(req, res) {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const student = await Student.findOne({ userId: authUserId });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const { semester, schoolYear } = req.query;
    const filter = { yearLevel: student.year };
    if (semester) filter.semester = String(semester);
    if (schoolYear) filter.schoolYear = String(schoolYear);

    const subjects = await Subject.find(filter)
      .populate('courseId')
      .populate('scheduleId')
      .sort({ semester: 1, subjectCode: 1 });

    const data = subjects.map(s => ({
      id: s._id,
      subjectCode: s.subjectCode,
      description: s.description,
      units: s.units,
      semester: s.semester,
      schoolYear: s.schoolYear,
      yearLevel: s.yearLevel,
      instructorName: s.instructorName,
      dayOfWeek: s.scheduleId?.dayOfWeek || null,
      startTime: s.scheduleId?.startTime || null,
      endTime: s.scheduleId?.endTime || null,
      courseId: s.courseId?._id || null,
      courseCode: s.courseId?.code || s.subjectCode,
      courseName: s.courseId?.name || s.description
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get my subjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
}


