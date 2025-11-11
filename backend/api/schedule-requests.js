import { ScheduleRequest, Instructor, Course, Room, Schedule, User } from '../config/database.js';
import { verifyToken } from '../utils/auth.js';
import mongoose from 'mongoose';
import { addNotification } from '../utils/notifications.js';

// Get all schedule requests
export async function getScheduleRequests(req, res) {
  try {
    const requests = await ScheduleRequest.find()
      .populate({
        path: 'instructorId',
        populate: {
          path: 'userId',
          select: 'name email department'
        }
      })
      .populate({
        path: 'originalInstructorId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('courseId', 'code name')
      .populate({
        path: 'scheduleId',
        select: 'dayOfWeek startTime endTime roomName instructorName scheduleDate roomId',
        populate: [
          {
            path: 'instructorId',
            populate: { path: 'userId', select: 'name email' }
          },
          {
            path: 'roomId',
            select: 'name building'
          }
        ]
      })
      .populate('roomId', 'name building')
      .sort({ createdAt: -1 });

    // Return under `data` key for frontend compatibility
    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get schedule requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch schedule requests' });
  }
}

// Get instructor's schedule requests
export async function getInstructorScheduleRequests(req, res) {
  try {
    const { instructorId } = req.params;
    
    const requests = await ScheduleRequest.find({ instructorId })
      .populate('courseId', 'code name')
      .populate({
        path: 'originalInstructorId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate({
        path: 'scheduleId',
        select: 'dayOfWeek startTime endTime roomName instructorName scheduleDate roomId',
        populate: [
          {
            path: 'instructorId',
            populate: { path: 'userId', select: 'name email' }
          },
          {
            path: 'roomId',
            select: 'name building'
          }
        ]
      })
      .populate('roomId', 'name building')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get instructor schedule requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch instructor schedule requests' });
  }
}

// Create a new schedule request
export async function createScheduleRequest(req, res) {
  try {
    // Expected body: { instructorId?, roomId, courseId?, scheduleId?, date or dayOfWeek, startTime, endTime, purpose, notes, semester?, year?, requestType? }
    let {
      instructorId: bodyInstructorId,
      roomId,
      courseId,
      scheduleId,
      date,
      dayOfWeek: bodyDayOfWeek,
      startTime,
      endTime,
      purpose,
      notes,
      semester,
      year,
      requestType: incomingType
    } = req.body;

    const requestType = incomingType || 'room_change';

    // If instructor not provided in body, try req.user (set by requireAuth)
    const instructorId = bodyInstructorId || (req.user && req.user.id);
    if (!instructorId) {
      return res.status(400).json({ success: false, message: 'Instructor ID required' });
    }

    // Verify instructor exists
    const instructor = await Instructor.findById(instructorId);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    let resolvedRoomId = roomId;
    let resolvedCourseId = courseId;
    let resolvedDayOfWeek = bodyDayOfWeek;
    let resolvedStartTime = startTime;
    let resolvedEndTime = endTime;
    let resolvedPurpose = purpose;
    let resolvedSemester = semester;
    let resolvedYear = year;
    let originalInstructorId = null;
    let originalInstructorName = null;
    let room = null;
    let targetSchedule = null;

    if (requestType === 'borrow_schedule') {
      if (!scheduleId) {
        return res.status(400).json({ success: false, message: 'scheduleId is required when borrowing a schedule' });
      }

      targetSchedule = await Schedule.findById(scheduleId)
        .populate({
          path: 'instructorId',
          populate: { path: 'userId', select: 'name email' }
        })
        .populate('roomId')
        .populate('courseId');

      if (!targetSchedule) {
        return res.status(404).json({ success: false, message: 'Target schedule not found' });
      }

      resolvedRoomId = targetSchedule.roomId?._id || targetSchedule.roomId;
      room = targetSchedule.roomId || (resolvedRoomId ? await Room.findById(resolvedRoomId) : null);

      resolvedCourseId = resolvedCourseId || (targetSchedule.courseId?._id || targetSchedule.courseId);
      resolvedDayOfWeek = targetSchedule.dayOfWeek;
      resolvedStartTime = targetSchedule.startTime;
      resolvedEndTime = targetSchedule.endTime;
      resolvedSemester = resolvedSemester || targetSchedule.semester;
      resolvedYear = resolvedYear || targetSchedule.year;
      originalInstructorId = targetSchedule.instructorId?._id || targetSchedule.instructorId;
      originalInstructorName = targetSchedule.instructorName || targetSchedule?.instructorId?.userId?.name || null;

      if (!date) {
        return res.status(400).json({ success: false, message: 'date is required when borrowing a schedule' });
      }

      if (!resolvedPurpose) {
        resolvedPurpose = 'borrow schedule';
      }
    } else {
      if (!resolvedRoomId || (!date && !resolvedDayOfWeek) || !resolvedStartTime || !resolvedEndTime || !resolvedPurpose) {
      return res.status(400).json({ success: false, message: 'roomId, date or dayOfWeek, startTime, endTime and purpose are required' });
    }

    // Verify room exists
      room = await Room.findById(resolvedRoomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
      }
    }

    // Determine dayOfWeek if not already set
    if (!resolvedDayOfWeek && date) {
      resolvedDayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    }

    let conflicts = [];
    let conflict_flag = false;

    if (requestType !== 'borrow_schedule') {
    // Conflict detection against existing Schedules for same room and dayOfWeek
    const overlappingSchedules = await Schedule.find({
        roomId: resolvedRoomId,
        dayOfWeek: resolvedDayOfWeek,
        ...(resolvedSemester ? { semester: resolvedSemester } : {}),
        ...(resolvedYear ? { year: resolvedYear } : {}),
    })
    .select('courseId dayOfWeek startTime endTime')
    .populate('courseId', 'code name');

      conflicts = [];
    for (const s of overlappingSchedules) {
        if (resolvedStartTime < s.endTime && resolvedEndTime > s.startTime) {
        const code = s.courseId?.code || 'Unknown';
        const name = s.courseId?.name || '';
        conflicts.push(`Room conflict with ${code} ${name} (${s.dayOfWeek} ${s.startTime}-${s.endTime})`);
      }
    }
      conflict_flag = conflicts.length > 0;
    }

    // For borrow requests, set status to pending_instructor_approval
    // For other requests, use pending
    const initialStatus = requestType === 'borrow_schedule' ? 'pending_instructor_approval' : 'pending';

    // Save new request
    const request = new ScheduleRequest({
      instructorId,
      courseId: resolvedCourseId || undefined,
      scheduleId: scheduleId || undefined,
      roomId: resolvedRoomId,
      date: date || undefined,
      dayOfWeek: resolvedDayOfWeek,
      startTime: resolvedStartTime,
      endTime: resolvedEndTime,
      semester: resolvedSemester || undefined,
      year: resolvedYear || undefined,
      purpose: resolvedPurpose,
      notes,
      requestType,
      details: (req.body && (req.body.details || req.body.purpose || req.body.notes)) || resolvedPurpose || notes || 'Schedule change request',
      status: initialStatus,
      conflict_flag,
      conflicts
    });

    if (originalInstructorId) {
      request.originalInstructorId = originalInstructorId;
    }
    if (originalInstructorName) {
      request.originalInstructorName = originalInstructorName;
    }

    await request.save();

    // Denormalize display fields
    try {
      const [instr, course, r] = await Promise.all([
        Instructor.findById(instructorId).populate('userId'),
        courseId ? Course.findById(courseId) : null,
        Room.findById(roomId)
      ]);
      if (instr?.userId?.name) request.instructorName = instr.userId.name;
      if (course) {
        request.courseName = course.name;
        request.courseCode = course.code;
      }
      if (r) request.roomName = r.name;
      // Ensure originalInstructorName is set if not already
      if (!request.originalInstructorName) {
        if (targetSchedule?.instructorId?.userId?.name) {
          request.originalInstructorName = targetSchedule.instructorId.userId.name;
        } else if (targetSchedule?.instructorName) {
          request.originalInstructorName = targetSchedule.instructorName;
        } else if (originalInstructorName) {
          request.originalInstructorName = originalInstructorName;
        }
      }
      await request.save();
    } catch {}

    const populated = await ScheduleRequest.findById(request._id)
      .populate({ path: 'instructorId', populate: { path: 'userId', select: 'name email' } })
      .populate('roomId', 'name building')
      .populate('courseId', 'code name');

    // Notify based on request type
    try {
      if (requestType === 'borrow_schedule' && originalInstructorId) {
        // Get the original instructor's userId to send notification
        const originalInstructor = await Instructor.findById(originalInstructorId).populate('userId');
        if (originalInstructor?.userId?._id) {
          await addNotification({
            userId: originalInstructor.userId._id.toString(),
            title: 'Schedule Borrow Request',
            message: `${populated?.instructorId?.userId?.name || 'An instructor'} wants to borrow your schedule for ${populated?.courseId?.code || ''} ${populated?.courseId?.name || ''} on ${date ? new Date(date).toLocaleDateString() : 'a specific date'}`,
            type: 'request'
          });
        }
      } else {
        // Notify Admins: New schedule request (non-borrow)
        await addNotification({
          role: 'admin',
          title: 'New Schedule Request',
          message: `${populated?.instructorId?.userId?.name || 'An instructor'} submitted a schedule request for ${populated?.courseId?.code || ''} ${populated?.courseId?.name || ''}`,
          type: 'request'
        });
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create schedule request error:', error);
    res.status(500).json({ success: false, message: 'Failed to create schedule request' });
  }
}

// Original instructor approves/rejects borrow request
export async function approveBorrowRequestByInstructor(req, res) {
  try {
    const { requestId } = req.params;
    const { approved, rejectionReason } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: 'approved field (boolean) is required' });
    }

    const request = await ScheduleRequest.findById(requestId)
      .populate({ path: 'originalInstructorId', populate: { path: 'userId', select: '_id' } });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Schedule request not found' });
    }

    // Verify this is a borrow request
    if (request.requestType !== 'borrow_schedule') {
      return res.status(400).json({ success: false, message: 'This endpoint is only for borrow schedule requests' });
    }

    // Verify the user is the original instructor
    const originalInstructorUserId = request.originalInstructorId?.userId?._id?.toString() || 
                                     request.originalInstructorId?.userId?.toString();
    if (originalInstructorUserId !== userId?.toString()) {
      return res.status(403).json({ success: false, message: 'Only the original instructor can approve this request' });
    }

    // Update approval status
    request.originalInstructorApproved = approved;
    request.originalInstructorApprovedAt = new Date();
    if (!approved && rejectionReason) {
      request.originalInstructorRejectionReason = rejectionReason;
    }

    // Update request status based on approval
    if (approved) {
      // Move to pending/admin review after instructor approval
      request.status = 'pending';
      // Notify admin
      try {
        await addNotification({
          role: 'admin',
          title: 'Borrow Request Approved by Instructor',
          message: `${request.originalInstructorName || 'An instructor'} approved a borrow request from ${request.instructorName || 'an instructor'}`,
          type: 'request'
        });
      } catch {}
    } else {
      // Rejected by instructor
      request.status = 'rejected';
      // Notify requesting instructor
      try {
        const requestingInstructor = await Instructor.findById(request.instructorId).populate('userId');
        if (requestingInstructor?.userId?._id) {
          await addNotification({
            userId: requestingInstructor.userId._id.toString(),
            title: 'Borrow Request Rejected',
            message: `Your borrow request for ${request.courseCode || ''} ${request.courseName || ''} was rejected by ${request.originalInstructorName || 'the original instructor'}`,
            type: 'request'
          });
        }
      } catch {}
    }

    request.updatedAt = new Date();
    await request.save();

    const populated = await ScheduleRequest.findById(request._id)
      .populate({ path: 'instructorId', populate: { path: 'userId', select: 'name email' } })
      .populate('roomId', 'name building')
      .populate('courseId', 'code name')
      .populate({ path: 'originalInstructorId', populate: { path: 'userId', select: 'name email' } });

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Approve borrow request by instructor error:', error);
    res.status(500).json({ success: false, message: 'Failed to process approval' });
  }
}

// Get borrow requests for original instructor
export async function getBorrowRequestsForInstructor(req, res) {
  try {
    const { instructorId } = req.params;
    const userId = req.user?.id || req.user?._id;

    // Verify the instructor exists and user has access
    const instructor = await Instructor.findById(instructorId).populate('userId');
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    // Verify user is the instructor
    if (instructor.userId?._id?.toString() !== userId?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get borrow requests where this instructor is the original instructor
    const requests = await ScheduleRequest.find({
      requestType: 'borrow_schedule',
      originalInstructorId: instructorId,
      originalInstructorApproved: null // Only pending approvals
    })
      .populate({ path: 'instructorId', populate: { path: 'userId', select: 'name email' } })
      .populate('courseId', 'code name')
      .populate('roomId', 'name building')
      .populate('scheduleId', 'dayOfWeek startTime endTime roomName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get borrow requests for instructor error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch borrow requests' });
  }
}

// Update schedule request status
export async function updateScheduleRequestStatus(req, res) {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;

    const request = await ScheduleRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Schedule request not found' });
    }

    // For borrow requests, check if original instructor has approved
    if (request.requestType === 'borrow_schedule' && status === 'approved') {
      if (request.originalInstructorApproved !== true) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot approve borrow request: Original instructor approval required first' 
        });
      }
    }

    // Validate status
    const valid = ['pending', 'approved', 'rejected'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Store original status before updating
    const originalStatus = request.status;
    
    request.status = status;
    if (notes) request.notes = notes;
    request.updatedAt = Date.now();

    // If approved, create or update related schedules and re-check conflicts
    if (status === 'approved') {
      // Check if all required fields are present to create a schedule
      // Only create schedule if request was previously not approved (to avoid duplicates)
      const wasAlreadyApproved = originalStatus === 'approved';
      
      if (request.requestType === 'borrow_schedule') {
        if (!wasAlreadyApproved) {
          try {
            const targetSchedule = await Schedule.findById(request.scheduleId)
              .populate({
                path: 'instructorId',
                populate: { path: 'userId', select: 'name email' }
              })
              .populate('courseId')
              .populate('roomId');

            if (!targetSchedule) {
              return res.status(404).json({ success: false, message: 'Associated schedule not found for borrow request' });
            }

            const replacementInstructor = await Instructor.findById(request.instructorId).populate('userId');
            if (!replacementInstructor) {
              return res.status(404).json({ success: false, message: 'Replacement instructor not found' });
            }

            const borrowDate = request.date || null;
            const semesterValue = request.semester || targetSchedule.semester;
            const yearValue = request.year || targetSchedule.year;
            let academicYearValue = request.academicYear || targetSchedule.academicYear;

            if (!academicYearValue && yearValue) {
              academicYearValue = `${yearValue}-${Number(yearValue) + 1}`;
            }

            // Ensure base fields are synced back to the request
            if (!request.courseId && targetSchedule.courseId) {
              request.courseId = targetSchedule.courseId._id || targetSchedule.courseId;
            }
            if (!request.roomId && targetSchedule.roomId) {
              request.roomId = targetSchedule.roomId._id || targetSchedule.roomId;
            }
            if (!request.dayOfWeek && targetSchedule.dayOfWeek) {
              request.dayOfWeek = targetSchedule.dayOfWeek;
            }
            if (!request.startTime && targetSchedule.startTime) {
              request.startTime = targetSchedule.startTime;
            }
            if (!request.endTime && targetSchedule.endTime) {
              request.endTime = targetSchedule.endTime;
            }
            if (!request.semester && semesterValue) {
              request.semester = semesterValue;
            }
            if (!request.year && yearValue) {
              request.year = yearValue;
            }
            if (!request.originalInstructorId && targetSchedule.instructorId) {
              request.originalInstructorId = targetSchedule.instructorId._id || targetSchedule.instructorId;
            }
            if (!request.originalInstructorName) {
              request.originalInstructorName = targetSchedule.instructorName || targetSchedule.instructorId?.userId?.name || '';
            }

            const existingBorrowedSchedule = await Schedule.findOne({ borrowRequestId: request._id });
            if (!existingBorrowedSchedule) {
              const newScheduleData = {
                courseId: request.courseId || (targetSchedule.courseId?._id || targetSchedule.courseId),
                instructorId: request.instructorId,
                roomId: request.roomId || (targetSchedule.roomId?._id || targetSchedule.roomId),
                dayOfWeek: request.dayOfWeek || targetSchedule.dayOfWeek,
                startTime: request.startTime || targetSchedule.startTime,
                endTime: request.endTime || targetSchedule.endTime,
                semester: semesterValue || targetSchedule.semester,
                year: yearValue || targetSchedule.year,
                academicYear: academicYearValue || targetSchedule.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                status: 'published',
                conflicts: [],
                scheduleDate: borrowDate ? new Date(`${borrowDate}T00:00:00`) : targetSchedule.scheduleDate,
                courseCode: targetSchedule.courseCode || targetSchedule.courseId?.code || '',
                courseName: targetSchedule.courseName || targetSchedule.courseId?.name || '',
                instructorName: replacementInstructor?.userId?.name || 'Unknown Instructor',
                roomName: targetSchedule.roomName || targetSchedule.roomId?.name || '',
                building: targetSchedule.building || targetSchedule.roomId?.building || '',
                isBorrowedInstance: true,
                borrowRequestId: request._id,
                borrowedFromScheduleId: targetSchedule._id,
                borrowOriginalInstructorId: targetSchedule.instructorId?._id || targetSchedule.instructorId,
                borrowOriginalInstructorName: targetSchedule.instructorName || targetSchedule.instructorId?.userId?.name || '',
                borrowDate: borrowDate || null
              };

              await Schedule.create(newScheduleData);
            }

            const replacementName = replacementInstructor?.userId?.name || '';
            const alreadyLogged = (targetSchedule.borrowedInstances || []).some(entry => entry.requestId && String(entry.requestId) === String(request._id));
            if (!alreadyLogged) {
              targetSchedule.borrowedInstances.push({
                date: borrowDate || null,
                requestId: request._id,
                replacementInstructorId: request.instructorId,
                replacementInstructorName: replacementName
              });
              await targetSchedule.save();
            }
          } catch (scheduleError) {
            console.error('Error handling borrowed schedule:', scheduleError);
          }
        }
      } else if (!wasAlreadyApproved && request.courseId && request.instructorId && request.roomId && request.dayOfWeek && 
          request.startTime && request.endTime) {
        try {
          // Determine semester and year if not provided
          let semester = request.semester;
          let year = request.year;
          let academicYear = request.academicYear;

          if (!semester || !year) {
            // Derive from date if available
            if (request.date) {
              const date = new Date(request.date + 'T00:00:00');
              const month = date.getMonth(); // 0-11
              
              // Define semester ranges
              if (month >= 8 && month <= 11) semester = 'First Term';  // Sep-Dec
              else if (month >= 0 && month <= 3) semester = 'Second Term';  // Jan-Apr
              else semester = 'Third Term';  // May-Aug
              
              year = date.getFullYear();
            } else {
              // Use current date as fallback
              const now = new Date();
              const month = now.getMonth();
              if (month >= 8 && month <= 11) semester = 'First Term';
              else if (month >= 0 && month <= 3) semester = 'Second Term';
              else semester = 'Third Term';
              year = now.getFullYear();
            }
          }

          if (!academicYear) {
            academicYear = `${year}-${Number(year) + 1}`;
          }

          // Check for conflicts with existing schedules
          const overlappingSchedules = await Schedule.find({
            roomId: request.roomId,
            dayOfWeek: request.dayOfWeek,
            semester: semester,
            year: year
          })
          .select('courseId dayOfWeek startTime endTime')
          .populate('courseId', 'code name');

          const conflicts = [];
          for (const s of overlappingSchedules) {
            if (request.startTime < s.endTime && request.endTime > s.startTime) {
              const code = s.courseId?.code || 'Unknown';
              const name = s.courseId?.name || '';
              conflicts.push(`Room conflict with ${code} ${name} (${s.dayOfWeek} ${s.startTime}-${s.endTime})`);
            }
          }

          // Get course and room details for denormalized fields
          const [course, room, instructor] = await Promise.all([
            Course.findById(request.courseId),
            Room.findById(request.roomId),
            Instructor.findById(request.instructorId).populate('userId')
          ]);

          // Create the schedule entry
          const scheduleData = {
            courseId: request.courseId,
            instructorId: request.instructorId,
            roomId: request.roomId,
            dayOfWeek: request.dayOfWeek,
            startTime: request.startTime,
            endTime: request.endTime,
            semester: semester,
            year: year,
            academicYear: academicYear,
            status: conflicts.length > 0 ? 'conflict' : 'published',
            conflicts: conflicts,
            // Denormalized fields
            courseCode: course?.code || '',
            courseName: course?.name || '',
            instructorName: instructor?.userId?.name || 'Unknown Instructor',
            roomName: room?.name || '',
            building: room?.building || ''
          };

          const schedule = await Schedule.create(scheduleData);
          console.log('Schedule created from approved request:', schedule._id);
        } catch (scheduleError) {
          console.error('Error creating schedule from approved request:', scheduleError);
          // Don't fail the approval if schedule creation fails, but log the error
        }
      }

      // Re-check conflicts with other approved requests
      if (request.requestType !== 'borrow_schedule') {
      const existingApproved = await ScheduleRequest.find({
        _id: { $ne: request._id },
        roomId: request.roomId,
        date: request.date,
        status: 'approved'
      });

      let conflict_flag = false;
      for (const ex of existingApproved) {
        if (request.startTime < ex.endTime && request.endTime > ex.startTime) {
          conflict_flag = true;
          break;
        }
      }
      request.conflict_flag = conflict_flag;
      }
    }

    await request.save();

    const populated = await ScheduleRequest.findById(request._id)
      .populate({ path: 'instructorId', populate: { path: 'userId', select: 'name email' } })
      .populate('roomId', 'name building')
      .populate({ path: 'originalInstructorId', populate: { path: 'userId', select: 'name email' } });

    // Notify Instructor: status update
    try {
      const instr = await Instructor.findById(populated.instructorId).populate('userId');
      if (instr?.userId?._id) {
        await addNotification({
          userId: instr.userId._id.toString(),
          title: 'Schedule Request Update',
          message: `Your schedule request was ${populated.status}.`,
          type: 'request'
        });
      }
    } catch {}

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('Update schedule request status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update schedule request status' });
  }
}

// Approve via POST /approve
export const approveScheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    // delegate to updateScheduleRequestStatus with status=approved
    req.body = req.body || {};
    req.body.status = 'approved';
    return await updateScheduleRequestStatus(req, res);
  } catch (error) {
    console.error('Approve schedule request error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve schedule request' });
  }
};

// Reject via POST /reject
export const rejectScheduleRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    req.body = req.body || {};
    req.body.status = 'rejected';
    return await updateScheduleRequestStatus(req, res);
  } catch (error) {
    console.error('Reject schedule request error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject schedule request' });
  }
};

// Delete a schedule request
export async function deleteScheduleRequest(req, res) {
  try {
    const { requestId } = req.params;

    const request = await ScheduleRequest.findByIdAndDelete(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Schedule request not found' });
    }

    res.json({ success: true, message: 'Schedule request deleted successfully' });
  } catch (error) {
    console.error('Delete schedule request error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete schedule request' });
  }
}