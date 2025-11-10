import { Enrollment, Schedule, Course } from '../config/database.js';

// Validate a student's total load for a given semester/academicYear does not exceed 21 units
export async function validateStudentLoad(studentId, newSubjectUnits, { semester, academicYear }) {
  if (!studentId) throw new Error('studentId is required');
  if (typeof newSubjectUnits !== 'number') throw new Error('newSubjectUnits must be a number');
  if (!semester || !academicYear) throw new Error('semester and academicYear are required');

  // Find all enrollments for this student that have schedules in the same semester/year
  const enrollments = await Enrollment.find({ studentId })
    .populate('courseId')
    .populate('scheduleId');

  let currentUnits = 0;
  for (const e of enrollments) {
    const sch = e.scheduleId;
    const crs = e.courseId;
    if (!sch || !crs) continue;
    if (String(sch.semester) === String(semester) && String(sch.academicYear) === String(academicYear)) {
      const units = typeof crs.credits === 'number' ? crs.credits : 0;
      currentUnits += units;
    }
  }

  const projected = currentUnits + (Number.isFinite(newSubjectUnits) ? newSubjectUnits : 0);
  if (projected > 21) {
    const error = new Error('Load limit exceeded: Student already has 21 units for this semester.');
    error.statusCode = 400;
    throw error;
  }

  return { currentUnits, projectedUnits: projected, remainingUnits: Math.max(0, 21 - projected) };
}


