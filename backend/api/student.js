import { Student, Subject } from '../config/database.js';

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


