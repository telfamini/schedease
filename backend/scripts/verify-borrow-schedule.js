import { initializeDatabase, ScheduleRequest, Schedule, Instructor, User } from '../config/database.js';
import chalk from 'chalk';

async function verifyBorrowSchedule() {
  try {
    console.log(chalk.blue('🔍 Verifying Borrow Schedule Data...\n'));
    
    await initializeDatabase();
    console.log(chalk.green('✓ Database connected\n'));

    // Find the borrow request
    const borrowRequest = await ScheduleRequest.findOne({ requestType: 'borrow_schedule' })
      .populate({
        path: 'instructorId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('scheduleId')
      .populate('courseId')
      .populate('roomId')
      .sort({ createdAt: -1 });

    if (!borrowRequest) {
      console.log(chalk.red('❌ No borrow schedule request found'));
      process.exit(1);
    }

    console.log(chalk.cyan('📋 Borrow Request Found:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(`  Request ID: ${borrowRequest._id}`));
    console.log(chalk.white(`  Status: ${chalk.green(borrowRequest.status)}`));
    console.log(chalk.white(`  Requesting Instructor: ${borrowRequest.instructorName || borrowRequest.instructorId?.userId?.name}`));
    console.log(chalk.white(`  Original Instructor: ${borrowRequest.originalInstructorName}`));
    console.log(chalk.white(`  Date: ${borrowRequest.date}`));
    console.log(chalk.white(`  Time: ${borrowRequest.startTime} - ${borrowRequest.endTime}`));
    console.log(chalk.white(`  Room: ${borrowRequest.roomName || borrowRequest.roomId?.name}`));
    console.log(chalk.white(`  Course: ${borrowRequest.courseName || borrowRequest.courseId?.name}`));
    console.log('');

    // Find the borrowed schedule instance
    const borrowedSchedule = await Schedule.findOne({ borrowRequestId: borrowRequest._id });
    if (borrowedSchedule) {
      console.log(chalk.cyan('📅 Borrowed Schedule Instance:'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.white(`  Schedule ID: ${borrowedSchedule._id}`));
      console.log(chalk.white(`  Instructor: ${borrowedSchedule.instructorName}`));
      console.log(chalk.white(`  Original Instructor: ${borrowedSchedule.borrowOriginalInstructorName}`));
      console.log(chalk.white(`  Date: ${borrowedSchedule.borrowDate || borrowedSchedule.scheduleDate}`));
      console.log(chalk.white(`  Day: ${borrowedSchedule.dayOfWeek}`));
      console.log(chalk.white(`  Time: ${borrowedSchedule.startTime} - ${borrowedSchedule.endTime}`));
      console.log(chalk.white(`  Room: ${borrowedSchedule.roomName}`));
      console.log(chalk.white(`  Course: ${borrowedSchedule.courseName}`));
      console.log(chalk.white(`  Is Borrowed: ${chalk.green(borrowedSchedule.isBorrowedInstance)}`));
      console.log(chalk.white(`  Status: ${borrowedSchedule.status}`));
      console.log('');
    } else {
      console.log(chalk.yellow('⚠ No borrowed schedule instance found'));
    }

    // Check instructor's requests
    const requestingInstructor = await Instructor.findById(borrowRequest.instructorId);
    if (requestingInstructor) {
      const instructorUser = await User.findById(requestingInstructor.userId);
      console.log(chalk.cyan(`👨‍🏫 Instructor Requests (${instructorUser?.name}):`));
      console.log(chalk.gray('─'.repeat(60)));
      
      const instructorRequests = await ScheduleRequest.find({ instructorId: requestingInstructor._id })
        .populate('scheduleId')
        .populate('courseId')
        .sort({ createdAt: -1 })
        .limit(5);

      instructorRequests.forEach((req, idx) => {
        console.log(chalk.white(`  ${idx + 1}. ${req.requestType} - ${req.status} - ${req.date || req.dayOfWeek}`));
      });
      console.log('');
    }

    // Check all borrow requests
    const allBorrowRequests = await ScheduleRequest.find({ requestType: 'borrow_schedule' })
      .populate({
        path: 'instructorId',
        populate: { path: 'userId', select: 'name' }
      })
      .sort({ createdAt: -1 });

    console.log(chalk.cyan(`📊 All Borrow Requests (${allBorrowRequests.length}):`));
    console.log(chalk.gray('─'.repeat(60)));
    allBorrowRequests.forEach((req, idx) => {
      const statusColor = req.status === 'approved' ? chalk.green : req.status === 'pending' ? chalk.yellow : chalk.red;
      console.log(chalk.white(`  ${idx + 1}. ${req.instructorId?.userId?.name || 'Unknown'} → ${req.originalInstructorName || 'Unknown'} | ${statusColor(req.status)} | ${req.date || 'N/A'}`));
    });
    console.log('');

    // Check borrowed schedule instances
    const allBorrowedSchedules = await Schedule.find({ isBorrowedInstance: true })
      .populate('instructorId', 'userId')
      .sort({ borrowDate: -1, createdAt: -1 });

    console.log(chalk.cyan(`📅 All Borrowed Schedule Instances (${allBorrowedSchedules.length}):`));
    console.log(chalk.gray('─'.repeat(60)));
    allBorrowedSchedules.forEach((sched, idx) => {
      console.log(chalk.white(`  ${idx + 1}. ${sched.instructorName} (replacing ${sched.borrowOriginalInstructorName}) | ${sched.borrowDate || 'N/A'} | ${sched.dayOfWeek} ${sched.startTime}-${sched.endTime}`));
    });
    console.log('');

    console.log(chalk.green('✅ Verification complete!\n'));
    console.log(chalk.blue('💡 To view in the UI:'));
    console.log(chalk.white('  1. Start backend: npm run dev'));
    console.log(chalk.white('  2. Start frontend: cd ../frontend && npm run dev'));
    console.log(chalk.white('  3. Login as instructor@university.edu'));
    console.log(chalk.white('  4. Navigate to Schedule Requests tab'));
    console.log(chalk.white('  5. Login as admin@university.edu'));
    console.log(chalk.white('  6. Navigate to Schedule Requests tab\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Verification failed:'), error);
    console.error(error.stack);
    process.exit(1);
  }
}

verifyBorrowSchedule();

