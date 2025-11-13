import { Course } from '../../config/database.js';

// GET /api/admin/courses/diagnose
// Diagnose course field issues
export async function diagnoseCourses(req, res) {
  try {
    const totalCourses = await Course.countDocuments();
    
    if (totalCourses === 0) {
      return res.json({
        success: true,
        message: 'No courses in database',
        data: {
          totalCourses: 0,
          coursesWithAllFields: 0,
          needsFix: true,
          issues: ['No courses found in database']
        }
      });
    }

    const coursesWithYearLevel = await Course.countDocuments({ yearLevel: { $exists: true, $ne: null } });
    const coursesWithSemester = await Course.countDocuments({ semester: { $exists: true, $ne: null } });
    const coursesWithDepartment = await Course.countDocuments({ department: { $exists: true, $ne: null } });
    const coursesWithAll = await Course.countDocuments({ 
      yearLevel: { $exists: true, $ne: null },
      semester: { $exists: true, $ne: null },
      department: { $exists: true, $ne: null }
    });

    const sampleCourses = await Course.find().limit(5).select('code name department yearLevel semester');
    const departments = await Course.distinct('department');

    const issues = [];
    if (coursesWithYearLevel < totalCourses) issues.push(`${totalCourses - coursesWithYearLevel} courses missing yearLevel`);
    if (coursesWithSemester < totalCourses) issues.push(`${totalCourses - coursesWithSemester} courses missing semester`);
    if (coursesWithDepartment < totalCourses) issues.push(`${totalCourses - coursesWithDepartment} courses missing department`);

    res.json({
      success: true,
      data: {
        totalCourses,
        coursesWithYearLevel,
        coursesWithSemester,
        coursesWithDepartment,
        coursesWithAll,
        needsFix: coursesWithAll < totalCourses,
        issues,
        sampleCourses,
        departments
      }
    });
  } catch (error) {
    console.error('Diagnose courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to diagnose courses' });
  }
}

// POST /api/admin/courses/fix
// Fix missing course fields
export async function fixCourses(req, res) {
  try {
    const { defaultDepartment = 'IT', defaultSemester = 'First Term' } = req.body;

    // Find courses missing required fields
    const coursesNeedingFix = await Course.find({
      $or: [
        { yearLevel: { $exists: false } },
        { yearLevel: null },
        { semester: { $exists: false } },
        { semester: null },
        { department: { $exists: false } },
        { department: null }
      ]
    });

    let updated = 0;
    const updates = [];

    for (const course of coursesNeedingFix) {
      const courseUpdates = {};

      // Set department if missing
      if (!course.department) {
        courseUpdates.department = defaultDepartment;
      }

      // Try to extract year level from course code
      if (!course.yearLevel) {
        const match = course.code.match(/(\d)/);
        if (match) {
          const digit = match[1];
          if (['1', '2', '3', '4'].includes(digit)) {
            courseUpdates.yearLevel = digit;
          } else {
            courseUpdates.yearLevel = '1';
          }
        } else {
          courseUpdates.yearLevel = '1';
        }
      }

      // Set semester if missing
      if (!course.semester) {
        courseUpdates.semester = defaultSemester;
      }

      if (Object.keys(courseUpdates).length > 0) {
        await Course.updateOne({ _id: course._id }, { $set: courseUpdates });
        updated++;
        updates.push({
          code: course.code,
          name: course.name,
          updates: courseUpdates
        });
      }
    }

    res.json({
      success: true,
      message: `Fixed ${updated} courses`,
      data: {
        totalFixed: updated,
        updates: updates.slice(0, 10) // Return first 10 for preview
      }
    });
  } catch (error) {
    console.error('Fix courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fix courses' });
  }
}
