import mongoose from 'mongoose';
import { User, Instructor } from './config/database.js';

async function checkInstructors() {
  try {
    await mongoose.connect('mongodb://localhost:27017/schedease_db');
    console.log('Connected to MongoDB');

    const instructors = await Instructor.find().populate('userId');
    
    console.log('\n=== INSTRUCTORS IN DATABASE ===');
    console.log('Total instructors:', instructors.length);
    console.log('\nDetailed list:');
    instructors.forEach((inst, index) => {
      console.log(`${index + 1}. ${inst.userId.name}`);
      console.log(`   Email: ${inst.userId.email}`);
      console.log(`   Specializations: ${inst.specializations.join(', ')}`);
      console.log(`   Max Hours/Week: ${inst.maxHoursPerWeek}`);
      console.log('');
    });

    // Count courses to see instructor-course ratio
    const Course = mongoose.model('Course');
    const courseCount = await Course.countDocuments();
    console.log(`\nCourse-to-Instructor Ratio: ${courseCount} courses / ${instructors.length} instructors = ${(courseCount / instructors.length).toFixed(1)} courses per instructor`);
    
    console.log('\n⚠️  Note: You likely need more instructors to handle all courses!');
    console.log('   Recommendation: Add at least 8-10 instructors with different specializations.');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkInstructors();
