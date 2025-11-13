import mongoose from 'mongoose';
import { Course, Student } from './config/database.js';

async function diagnoseCurriculum() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://kuronini7:hehehe@cluster0.ieladnw.mongodb.net/schedease_db?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('✅ Connected to MongoDB\n');

    // Check total courses
    const totalCourses = await Course.countDocuments();
    console.log(`📊 Total courses in database: ${totalCourses}\n`);

    if (totalCourses === 0) {
      console.log('❌ No courses found in database!');
      console.log('   You need to add courses to the database first.\n');
      await mongoose.connection.close();
      return;
    }

    // Check courses with required fields
    const coursesWithYearLevel = await Course.countDocuments({ yearLevel: { $exists: true, $ne: null } });
    const coursesWithSemester = await Course.countDocuments({ semester: { $exists: true, $ne: null } });
    const coursesWithDepartment = await Course.countDocuments({ department: { $exists: true, $ne: null } });
    const coursesWithAll = await Course.countDocuments({ 
      yearLevel: { $exists: true, $ne: null },
      semester: { $exists: true, $ne: null },
      department: { $exists: true, $ne: null }
    });

    console.log('📋 Course Field Analysis:');
    console.log(`   Courses with yearLevel: ${coursesWithYearLevel}/${totalCourses}`);
    console.log(`   Courses with semester: ${coursesWithSemester}/${totalCourses}`);
    console.log(`   Courses with department: ${coursesWithDepartment}/${totalCourses}`);
    console.log(`   Courses with ALL required fields: ${coursesWithAll}/${totalCourses}\n`);

    if (coursesWithAll === 0) {
      console.log('❌ PROBLEM FOUND: No courses have all required fields (yearLevel, semester, department)');
      console.log('   The curriculum will be empty because courses need these fields to be displayed.\n');
    }

    // Show sample courses
    console.log('📝 Sample courses (first 5):');
    console.log('─'.repeat(80));
    const sampleCourses = await Course.find().limit(5);
    sampleCourses.forEach((course, idx) => {
      console.log(`\n${idx + 1}. ${course.code} - ${course.name}`);
      console.log(`   Department: ${course.department || '❌ MISSING'}`);
      console.log(`   Year Level: ${course.yearLevel || '❌ MISSING'}`);
      console.log(`   Semester: ${course.semester || '❌ MISSING'}`);
      console.log(`   Credits: ${course.credits || 'N/A'}`);
      console.log(`   Type: ${course.type || 'N/A'}`);
    });

    // Check departments
    console.log('\n\n📊 Courses by Department:');
    console.log('─'.repeat(80));
    const departments = await Course.distinct('department');
    for (const dept of departments) {
      const count = await Course.countDocuments({ department: dept });
      const withAllFields = await Course.countDocuments({ 
        department: dept,
        yearLevel: { $exists: true, $ne: null },
        semester: { $exists: true, $ne: null }
      });
      console.log(`   ${dept || '(no department)'}: ${count} courses (${withAllFields} with yearLevel & semester)`);
    }

    // Check students
    console.log('\n\n👥 Student Analysis:');
    console.log('─'.repeat(80));
    const totalStudents = await Student.countDocuments();
    console.log(`   Total students: ${totalStudents}`);
    
    if (totalStudents > 0) {
      const sampleStudent = await Student.findOne();
      console.log(`   Sample student department: ${sampleStudent.department || '❌ MISSING'}`);
      
      const studentDepts = await Student.distinct('department');
      console.log(`   Student departments: ${studentDepts.join(', ')}`);
    }

    // Recommendations
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(80));
    if (coursesWithAll === 0) {
      console.log('1. ❌ Your courses are missing required fields!');
      console.log('   You need to update courses to include:');
      console.log('   - yearLevel: "1", "2", "3", or "4"');
      console.log('   - semester: "First Term", "Second Term", or "Third Term"');
      console.log('   - department: e.g., "IT", "CS", "Engineering", etc.');
      console.log('\n2. You can update courses manually or create a migration script.');
    } else {
      console.log('✅ Courses have required fields.');
      console.log('   If curriculum is still blank, check:');
      console.log('   - Student department matches course departments');
      console.log('   - Backend server logs for errors');
      console.log('   - Browser console for API response');
    }

    await mongoose.connection.close();
    console.log('\n✅ Diagnosis complete');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseCurriculum();
