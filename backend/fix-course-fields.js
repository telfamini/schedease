import mongoose from 'mongoose';
import { Course } from './config/database.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function fixCourseFields() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://kuronini7:hehehe@cluster0.ieladnw.mongodb.net/schedease_db?retryWrites=true&w=majority';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('✅ Connected to MongoDB\n');

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

    console.log(`📊 Found ${coursesNeedingFix.length} courses that need fixing\n`);

    if (coursesNeedingFix.length === 0) {
      console.log('✅ All courses already have required fields!');
      await mongoose.connection.close();
      rl.close();
      return;
    }

    console.log('Sample courses that need fixing:');
    coursesNeedingFix.slice(0, 3).forEach((course, idx) => {
      console.log(`\n${idx + 1}. ${course.code} - ${course.name}`);
      console.log(`   Department: ${course.department || '❌ MISSING'}`);
      console.log(`   Year Level: ${course.yearLevel || '❌ MISSING'}`);
      console.log(`   Semester: ${course.semester || '❌ MISSING'}`);
    });

    console.log('\n\nThis script will help you fix courses by:');
    console.log('1. Setting a default department (e.g., "IT")');
    console.log('2. Attempting to extract year level from course code');
    console.log('3. Setting a default semester\n');

    const proceed = await question('Do you want to proceed? (yes/no): ');
    
    if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      await mongoose.connection.close();
      rl.close();
      return;
    }

    const defaultDept = await question('\nEnter default department (e.g., IT, CS, Engineering): ');
    const defaultSemester = await question('Enter default semester (First Term/Second Term/Third Term): ');

    let updated = 0;
    let errors = 0;

    for (const course of coursesNeedingFix) {
      try {
        const updates = {};

        // Set department if missing
        if (!course.department) {
          updates.department = defaultDept.trim();
        }

        // Try to extract year level from course code
        if (!course.yearLevel) {
          // Try to find a digit in the course code (e.g., CS101 -> 1, IT201 -> 2)
          const match = course.code.match(/(\d)/);
          if (match) {
            const digit = match[1];
            if (['1', '2', '3', '4'].includes(digit)) {
              updates.yearLevel = digit;
            } else {
              updates.yearLevel = '1'; // default to year 1
            }
          } else {
            updates.yearLevel = '1'; // default to year 1
          }
        }

        // Set semester if missing
        if (!course.semester) {
          updates.semester = defaultSemester.trim();
        }

        if (Object.keys(updates).length > 0) {
          await Course.updateOne({ _id: course._id }, { $set: updates });
          updated++;
          console.log(`✅ Updated: ${course.code} - ${JSON.stringify(updates)}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error updating ${course.code}:`, error.message);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Updated: ${updated} courses`);
    console.log(`   Errors: ${errors} courses`);
    console.log(`\n✅ Done! Run diagnose-curriculum.js to verify the changes.`);

    await mongoose.connection.close();
    rl.close();
  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
    process.exit(1);
  }
}

fixCourseFields();
