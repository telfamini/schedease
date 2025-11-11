import { initializeDatabase, User, Instructor, Course, Room, Schedule, ScheduleRequest } from '../config/database.js';
import chalk from 'chalk';

async function testBorrowSchedule() {
  try {
    console.log(chalk.blue('🧪 Testing Borrow Schedule Feature...\n'));
    
    // Initialize database connection
    await initializeDatabase();
    console.log(chalk.green('✓ Database connected\n'));

    // Find or create two instructors
    let instructor1User = await User.findOne({ email: 'instructor@university.edu' });
    let instructor2User = await User.findOne({ email: 'instructor2@university.edu' });

    if (!instructor1User) {
      console.log(chalk.yellow('⚠ Creating instructor1@university.edu...'));
      instructor1User = new User({
        name: 'Prof. Michael Chen',
        email: 'instructor@university.edu',
        password: 'password',
        role: 'instructor',
        department: 'Computer Science'
      });
      await instructor1User.save();
      const instructor1 = new Instructor({
        userId: instructor1User._id,
        maxHoursPerWeek: 20,
        specializations: ['Programming', 'Algorithms']
      });
      await instructor1.save();
      instructor1User = await User.findById(instructor1User._id);
    }

    if (!instructor2User) {
      console.log(chalk.yellow('⚠ Creating instructor2@university.edu...'));
      instructor2User = new User({
        name: 'Dr. Emily Rodriguez',
        email: 'instructor2@university.edu',
        password: 'password',
        role: 'instructor',
        department: 'Mathematics'
      });
      await instructor2User.save();
      const instructor2 = new Instructor({
        userId: instructor2User._id,
        maxHoursPerWeek: 20,
        specializations: ['Calculus', 'Statistics']
      });
      await instructor2.save();
      instructor2User = await User.findById(instructor2User._id);
    }

    const instructor1Profile = await Instructor.findOne({ userId: instructor1User._id });
    const instructor2Profile = await Instructor.findOne({ userId: instructor2User._id });

    if (!instructor1Profile || !instructor2Profile) {
      throw new Error('Instructor profiles not found');
    }

    console.log(chalk.green(`✓ Instructor 1: ${instructor1User.name} (${instructor1Profile._id})`));
    console.log(chalk.green(`✓ Instructor 2: ${instructor2User.name} (${instructor2Profile._id})\n`));

    // Find or create a course
    let course = await Course.findOne({ code: 'ITCC111-LEC' });
    if (!course) {
      console.log(chalk.yellow('⚠ Creating test course...'));
      course = new Course({
        code: 'ITCC111-LEC',
        name: 'Computer Programming 1 (lec)',
        department: 'IT',
        credits: 3,
        type: 'lecture',
        duration: 90,
        requiredCapacity: 40,
        specialRequirements: ['projector']
      });
      await course.save();
    }
    console.log(chalk.green(`✓ Course: ${course.code} - ${course.name}\n`));

    // Find or create a room
    let room = await Room.findOne({ name: '101' });
    if (!room) {
      console.log(chalk.yellow('⚠ Creating test room...'));
      room = new Room({
        name: '101',
        type: 'classroom',
        capacity: 50,
        building: 'Main Building',
        floor: 1,
        equipment: ['whiteboard']
      });
      await room.save();
    }
    console.log(chalk.green(`✓ Room: ${room.name} (${room.building})\n`));

    // Create a schedule for instructor2 (the one being borrowed from)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    let semester = 'First Term';
    if (currentMonth >= 0 && currentMonth <= 3) semester = 'Second Term';
    else if (currentMonth >= 4 && currentMonth <= 7) semester = 'Third Term';

    let targetSchedule = await Schedule.findOne({
      instructorId: instructor2Profile._id,
      courseId: course._id,
      roomId: room._id,
      dayOfWeek: 'Monday',
      semester: semester,
      year: currentYear
    });

    if (!targetSchedule) {
      console.log(chalk.yellow('⚠ Creating target schedule for instructor2...'));
      targetSchedule = new Schedule({
        courseId: course._id,
        instructorId: instructor2Profile._id,
        roomId: room._id,
        dayOfWeek: 'Monday',
        startTime: '10:00',
        endTime: '11:30',
        semester: semester,
        year: currentYear,
        academicYear: `${currentYear}-${currentYear + 1}`,
        status: 'published',
        courseCode: course.code,
        courseName: course.name,
        instructorName: instructor2User.name,
        roomName: room.name,
        building: room.building
      });
      await targetSchedule.save();
    }
    console.log(chalk.green(`✓ Target Schedule: ${targetSchedule.dayOfWeek} ${targetSchedule.startTime}-${targetSchedule.endTime}\n`));

    // Create a borrow schedule request from instructor1 to borrow instructor2's schedule
    const borrowDate = new Date();
    borrowDate.setDate(borrowDate.getDate() + 7); // Next week
    const borrowDateStr = borrowDate.toISOString().split('T')[0];

    // Check if request already exists
    let borrowRequest = await ScheduleRequest.findOne({
      instructorId: instructor1Profile._id,
      scheduleId: targetSchedule._id,
      requestType: 'borrow_schedule',
      date: borrowDateStr
    });

    if (!borrowRequest) {
      console.log(chalk.yellow('📝 Creating borrow schedule request...'));
      borrowRequest = new ScheduleRequest({
        instructorId: instructor1Profile._id,
        courseId: course._id,
        scheduleId: targetSchedule._id,
        roomId: room._id,
        date: borrowDateStr,
        dayOfWeek: targetSchedule.dayOfWeek,
        startTime: targetSchedule.startTime,
        endTime: targetSchedule.endTime,
        semester: targetSchedule.semester,
        year: targetSchedule.year,
        purpose: 'borrow schedule',
        notes: `Test borrow request: ${instructor1User.name} wants to borrow ${instructor2User.name}'s schedule on ${borrowDateStr}`,
        requestType: 'borrow_schedule',
        details: `Borrowing schedule from ${instructor2User.name}`,
        status: 'pending',
        originalInstructorId: instructor2Profile._id,
        originalInstructorName: instructor2User.name,
        conflict_flag: false,
        conflicts: []
      });

      // Denormalize fields
      borrowRequest.instructorName = instructor1User.name;
      borrowRequest.courseName = course.name;
      borrowRequest.courseCode = course.code;
      borrowRequest.roomName = room.name;

      await borrowRequest.save();
      console.log(chalk.green(`✓ Borrow Request Created: ${borrowRequest._id}\n`));
    } else {
      console.log(chalk.yellow(`⚠ Borrow Request already exists: ${borrowRequest._id}\n`));
    }

    // Approve the request
    if (borrowRequest.status === 'pending') {
      console.log(chalk.yellow('✅ Approving borrow schedule request...'));
      borrowRequest.status = 'approved';
      borrowRequest.updatedAt = new Date();

      // Create the borrowed schedule instance
      const replacementInstructor = await Instructor.findById(borrowRequest.instructorId).populate('userId');
      if (!replacementInstructor) {
        throw new Error('Replacement instructor not found');
      }

      const existingBorrowedSchedule = await Schedule.findOne({ borrowRequestId: borrowRequest._id });
      if (!existingBorrowedSchedule) {
        const newScheduleData = {
          courseId: borrowRequest.courseId || targetSchedule.courseId,
          instructorId: borrowRequest.instructorId,
          roomId: borrowRequest.roomId || targetSchedule.roomId,
          dayOfWeek: borrowRequest.dayOfWeek || targetSchedule.dayOfWeek,
          startTime: borrowRequest.startTime || targetSchedule.startTime,
          endTime: borrowRequest.endTime || targetSchedule.endTime,
          semester: borrowRequest.semester || targetSchedule.semester,
          year: borrowRequest.year || targetSchedule.year,
          academicYear: targetSchedule.academicYear || `${currentYear}-${currentYear + 1}`,
          status: 'published',
          conflicts: [],
          scheduleDate: new Date(`${borrowDateStr}T00:00:00`),
          courseCode: targetSchedule.courseCode || course.code,
          courseName: targetSchedule.courseName || course.name,
          instructorName: replacementInstructor.userId.name,
          roomName: targetSchedule.roomName || room.name,
          building: targetSchedule.building || room.building,
          isBorrowedInstance: true,
          borrowRequestId: borrowRequest._id,
          borrowedFromScheduleId: targetSchedule._id,
          borrowOriginalInstructorId: targetSchedule.instructorId,
          borrowOriginalInstructorName: targetSchedule.instructorName || instructor2User.name,
          borrowDate: borrowDateStr
        };

        const borrowedSchedule = await Schedule.create(newScheduleData);
        console.log(chalk.green(`✓ Borrowed Schedule Created: ${borrowedSchedule._id}\n`));

        // Update target schedule with borrowed instance
        if (!targetSchedule.borrowedInstances) {
          targetSchedule.borrowedInstances = [];
        }
        const alreadyLogged = targetSchedule.borrowedInstances.some(
          entry => entry.requestId && String(entry.requestId) === String(borrowRequest._id)
        );
        if (!alreadyLogged) {
          targetSchedule.borrowedInstances.push({
            date: borrowDateStr,
            requestId: borrowRequest._id,
            replacementInstructorId: borrowRequest.instructorId,
            replacementInstructorName: replacementInstructor.userId.name
          });
          await targetSchedule.save();
          console.log(chalk.green(`✓ Target schedule updated with borrow instance\n`));
        }
      }

      await borrowRequest.save();
      console.log(chalk.green(`✓ Request Approved!\n`));
    } else {
      console.log(chalk.yellow(`⚠ Request already ${borrowRequest.status}\n`));
    }

    // Verify the data
    console.log(chalk.blue('📊 Verification:\n'));
    console.log(chalk.gray('─'.repeat(60)));

    const approvedRequest = await ScheduleRequest.findById(borrowRequest._id)
      .populate('instructorId', 'userId')
      .populate('scheduleId')
      .populate('courseId')
      .populate('roomId');

    console.log(chalk.cyan('Borrow Request Details:'));
    console.log(chalk.white(`  ID: ${approvedRequest._id}`));
    console.log(chalk.white(`  Status: ${approvedRequest.status}`));
    console.log(chalk.white(`  Requesting Instructor: ${approvedRequest.instructorName || approvedRequest.instructorId?.userId?.name}`));
    console.log(chalk.white(`  Original Instructor: ${approvedRequest.originalInstructorName}`));
    console.log(chalk.white(`  Date: ${approvedRequest.date}`));
    console.log(chalk.white(`  Time: ${approvedRequest.startTime} - ${approvedRequest.endTime}`));
    console.log(chalk.white(`  Room: ${approvedRequest.roomName || approvedRequest.roomId?.name}`));
    console.log(chalk.white(`  Course: ${approvedRequest.courseName || approvedRequest.courseId?.name}\n`));

    const borrowedSchedule = await Schedule.findOne({ borrowRequestId: borrowRequest._id });
    if (borrowedSchedule) {
      console.log(chalk.cyan('Borrowed Schedule Instance:'));
      console.log(chalk.white(`  ID: ${borrowedSchedule._id}`));
      console.log(chalk.white(`  Instructor: ${borrowedSchedule.instructorName}`));
      console.log(chalk.white(`  Original Instructor: ${borrowedSchedule.borrowOriginalInstructorName}`));
      console.log(chalk.white(`  Date: ${borrowedSchedule.borrowDate || borrowedSchedule.scheduleDate}`));
      console.log(chalk.white(`  Is Borrowed: ${borrowedSchedule.isBorrowedInstance}`));
      console.log(chalk.white(`  Status: ${borrowedSchedule.status}\n`));
    }

    const updatedTargetSchedule = await Schedule.findById(targetSchedule._id);
    if (updatedTargetSchedule.borrowedInstances && updatedTargetSchedule.borrowedInstances.length > 0) {
      console.log(chalk.cyan('Target Schedule Borrowed Instances:'));
      updatedTargetSchedule.borrowedInstances.forEach((instance, idx) => {
        console.log(chalk.white(`  ${idx + 1}. Date: ${instance.date}, Replacement: ${instance.replacementInstructorName}`));
      });
      console.log('');
    }

    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.green('\n✅ Test completed successfully!\n'));
    console.log(chalk.blue('📝 Next Steps:'));
    console.log(chalk.white('  1. Log in as instructor@university.edu'));
    console.log(chalk.white('  2. Go to Schedule Requests'));
    console.log(chalk.white('  3. Verify the approved borrow request appears'));
    console.log(chalk.white('  4. Log in as admin@university.edu'));
    console.log(chalk.white('  5. Go to Schedule Requests'));
    console.log(chalk.white('  6. Verify the borrow request details\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testBorrowSchedule();

