/**
 * Script to fix department names in the database
 * Run this once to update department codes to full names
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Department } from '../config/database.js';

dotenv.config();

const departmentMapping = {
  // Old codes to new codes (if needed)
  'EXAD': 'BASD',
  'MCAD': 'MAAD',
  'BASO': 'BASD',
  'CAAO': 'CAAD',
  // Keep existing codes as-is
  'CAAD': 'CAAD',
  'MAAD': 'MAAD',
  'EAAD': 'EAAD',
  'BASD': 'BASD'
};

async function fixDepartments() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedease');
    console.log('✅ Connected to MongoDB');

    // Get all departments
    const departments = await Department.find();
    console.log(`\n📋 Found ${departments.length} departments in database`);

    // Update each department
    for (const dept of departments) {
      const oldName = dept.name;
      const oldCode = dept.code;
      
      // If the name is a code, update it to full name
      if (departmentMapping[oldName]) {
        dept.name = departmentMapping[oldName];
        await dept.save();
        console.log(`✅ Updated: "${oldName}" → "${dept.name}"`);
      } else if (departmentMapping[oldCode]) {
        // If code exists in mapping but name doesn't match
        if (dept.name !== departmentMapping[oldCode]) {
          dept.name = departmentMapping[oldCode];
          await dept.save();
          console.log(`✅ Updated: "${oldName}" → "${dept.name}" (from code: ${oldCode})`);
        }
      } else {
        console.log(`ℹ️  Kept: "${dept.name}" (code: ${dept.code})`);
      }
    }

    console.log('\n✅ Department names updated successfully!');
    
    // Display final list
    const updatedDepts = await Department.find().sort({ name: 1 });
    console.log('\n📋 Final department list:');
    updatedDepts.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code})`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing departments:', error);
    process.exit(1);
  }
}

fixDepartments();
