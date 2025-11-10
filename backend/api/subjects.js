import { Subject } from '../config/database.js';

// GET /api/subjects?yearLevel=1&semester=First%20Term
// Optional future filters: subjectCode, schoolYear
export async function getSubjects(req, res) {
  try {
    const { yearLevel, semester, subjectCode, schoolYear } = req.query;

    const filter = {};
    if (yearLevel) filter.yearLevel = String(yearLevel);
    if (semester) filter.semester = String(semester);
    if (subjectCode) filter.subjectCode = String(subjectCode).toUpperCase();
    if (schoolYear) filter.schoolYear = String(schoolYear);

    const subjects = await Subject.find(filter)
      .populate('courseId')
      .populate('scheduleId')
      .sort({ subjectCode: 1, semester: 1, schoolYear: -1 });

    const data = subjects.map(s => ({
      id: s._id,
      subjectCode: s.subjectCode,
      description: s.description,
      units: s.units,
      prerequisite: s.prerequisite,
      equivalentSubjectCode: s.equivalentSubjectCode,
      schoolYear: s.schoolYear,
      semester: s.semester,
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
    console.error('Get subjects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
}


