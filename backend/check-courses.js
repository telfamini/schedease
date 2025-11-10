import mongoose from 'mongoose';
import { Course } from './config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkCourses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedease_db');
    console.log('✅ Connected to MongoDB\n');

    const count = await Course.countDocuments();
    console.log(`📊 Total courses in database: ${count}\n`);

    if (count > 0) {
      const courses = await Course.find({}).limit(10);
      console.log('📋 Sample courses:');
      courses.forEach((course, index) => {
        console.log(`${index + 1}. ${course.code} - ${course.name}`);
        console.log(`   Year: ${course.yearLevel || 'N/A'}, Section: ${course.section || 'N/A'}, Semester: ${course.semester || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No courses found in database!');
      console.log('💡 Run: npm run reset-db to seed the database');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCourses();
