import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Instructor } from './config/database.js';

const instructorsData = [
  {
    name: 'Dr. Maria Santos',
    email: 'maria.santos@university.edu',
    specializations: ['Data Structures', 'Algorithms', 'Computer Science'],
    maxHoursPerWeek: 25
  },
  {
    name: 'Prof. Juan Cruz',
    email: 'juan.cruz@university.edu',
    specializations: ['Web Development', 'Frontend Development', 'UI/UX'],
    maxHoursPerWeek: 22
  },
  {
    name: 'Dr. Ana Reyes',
    email: 'ana.reyes@university.edu',
    specializations: ['Database Systems', 'SQL', 'Data Management'],
    maxHoursPerWeek: 20
  },
  {
    name: 'Prof. Carlos Torres',
    email: 'carlos.torres@university.edu',
    specializations: ['Networking', 'Systems Administration', 'Infrastructure'],
    maxHoursPerWeek: 24
  },
  {
    name: 'Dr. Lisa Garcia',
    email: 'lisa.garcia@university.edu',
    specializations: ['Software Engineering', 'Project Management', 'Agile'],
    maxHoursPerWeek: 20
  },
  {
    name: 'Prof. Mark Diaz',
    email: 'mark.diaz@university.edu',
    specializations: ['Mobile Development', 'Android', 'iOS'],
    maxHoursPerWeek: 22
  },
  {
    name: 'Dr. Sarah Lopez',
    email: 'sarah.lopez@university.edu',
    specializations: ['Machine Learning', 'AI', 'Data Science'],
    maxHoursPerWeek: 20
  },
  {
    name: 'Prof. David Ramos',
    email: 'david.ramos@university.edu',
    specializations: ['Cybersecurity', 'Information Security', 'Ethical Hacking'],
    maxHoursPerWeek: 23
  },
  {
    name: 'Dr. Michelle Flores',
    email: 'michelle.flores@university.edu',
    specializations: ['Cloud Computing', 'DevOps', 'AWS'],
    maxHoursPerWeek: 21
  },
  {
    name: 'Prof. Robert Santos',
    email: 'robert.santos@university.edu',
    specializations: ['Programming Fundamentals', 'Python', 'Java'],
    maxHoursPerWeek: 24
  }
];

async function seedInstructors() {
  try {
    await mongoose.connect('mongodb://localhost:27017/schedease_db');
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Checking existing instructors...');
    const existingInstructors = await Instructor.find().populate('userId');
    console.log(`   Found ${existingInstructors.length} existing instructor(s)\n`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const instructorData of instructorsData) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: instructorData.email });
      
      if (existingUser) {
        console.log(`⏭️  Skipping ${instructorData.name} (already exists)`);
        skippedCount++;
        continue;
      }

      // Create user account
      const hashedPassword = await bcrypt.hash('instructor123', 10);
      const user = await User.create({
        name: instructorData.name,
        email: instructorData.email,
        password: hashedPassword,
        role: 'instructor',
        department: 'Information Technology'
      });

      // Create instructor profile
      await Instructor.create({
        userId: user._id,
        specializations: instructorData.specializations,
        maxHoursPerWeek: instructorData.maxHoursPerWeek,
        availability: new Map()
      });

      console.log(`✅ Added ${instructorData.name}`);
      console.log(`   Email: ${instructorData.email}`);
      console.log(`   Specializations: ${instructorData.specializations.join(', ')}`);
      console.log('');
      addedCount++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   - Added: ${addedCount} new instructor(s)`);
    console.log(`   - Skipped: ${skippedCount} (already exist)`);
    console.log(`   - Total instructors now: ${existingInstructors.length + addedCount}`);
    console.log('='.repeat(50));

    console.log('\n📝 Default password for all new instructors: instructor123');
    console.log('   (Users should change this on first login)\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding instructors:', error);
    process.exit(1);
  }
}

seedInstructors();
