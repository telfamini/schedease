import mongoose from 'mongoose';
import { Course } from './config/database.js';

async function checkCourses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/schedease_db');
    console.log('✅ Connected to MongoDB\n');

    const allCourses = await Course.find().sort({ yearLevel: 1, semester: 1, section: 1, code: 1 });
    
    console.log(`📊 Total courses in database: ${allCourses.length}\n`);

    // Group by year and term
    const grouped = {};
    for (const course of allCourses) {
      const year = course.yearLevel || '1';
      const term = course.semester || 'First Term';
      const key = `Year ${year} - ${term}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(course);
    }

    // Display breakdown
    console.log('📋 Courses by Year and Term:\n');
    for (const [key, courses] of Object.entries(grouped)) {
      console.log(`\n${key}: ${courses.length} courses`);
      console.log('─'.repeat(60));
      
      // Group by section
      const sections = {};
      for (const c of courses) {
        const section = c.section || 'Unknown';
        if (!sections[section]) sections[section] = [];
        sections[section].push(c);
      }
      
      for (const [section, sectionCourses] of Object.entries(sections)) {
        console.log(`\n  Section ${section} (${sectionCourses.length} courses):`);
        sectionCourses.forEach(c => {
          console.log(`    - ${c.code.padEnd(20)} ${c.name} (${c.credits} units, ${c.type})`);
        });
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCourses();
