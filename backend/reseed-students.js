import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Student } from './config/database.js';

dotenv.config();

async function reseedStudents() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kuronini7:hehehe@cluster0.ieladnw.mongodb.net/schedease_db?retryWrites=true&w=majority');
    console.log('✅ Connected to MongoDB\n');

    // Find all users with role='student'
    const studentUsers = await User.find({ role: 'student' });
    console.log(`📊 Found ${studentUsers.length} student users\n`);

    let created = 0;
    let existing = 0;

    for (const studentUser of studentUsers) {
      const existingStudent = await Student.findOne({ userId: studentUser._id });
      
      if (!existingStudent) {
        const studentProfile = new Student({
          userId: studentUser._id,
          studentId: `ST${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          department: studentUser.department || 'IT',
          year: '1',
          section: studentUser.section || '1A',
          enrolledCourses: []
        });
        await studentProfile.save();
        console.log(`✅ Created Student profile for: ${studentUser.name} (${studentUser.email})`);
        created++;
      } else {
        console.log(`ℹ️  Student profile already exists for: ${studentUser.name}`);
        existing++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created} student profiles`);
    console.log(`   Already existed: ${existing} student profiles`);
    console.log(`   Total: ${studentUsers.length} students\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error reseeding students:', error);
    process.exit(1);
  }
}

reseedStudents();
