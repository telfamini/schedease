import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initializeDatabase, seedDatabase } from '../config/database.js';

// Load environment variables
dotenv.config();

async function resetDatabase() {
  try {
    console.log('🔄 Starting database reset...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schedease_db', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });

    console.log('✅ Connected to MongoDB\n');

    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    console.log('🗑️  Dropping all collections...');
    for (let collection of collections) {
      await collection.drop();
      console.log(`   ✓ Dropped: ${collection.collectionName}`);
    }
    
    console.log('\n✅ All collections dropped\n');

    // Reseed the database
   console.log('🌱 Seeding database with fresh data...\n');
    await seedDatabase();
    
    console.log('\n✅ Database reset complete!\n');
    console.log('📝 Default accounts created:');
    console.log('   Admin: admin@university.edu / password');
    console.log('   Instructor: instructor@university.edu / password');
    console.log('   Student: student@university.edu / password\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
