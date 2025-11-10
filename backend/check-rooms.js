import mongoose from 'mongoose';
import { Room } from './config/database.js';

async function checkRooms() {
  try {
    await mongoose.connect('mongodb://localhost:27017/schedease_db');
    console.log('Connected to MongoDB');

    const rooms = await Room.find().sort({ name: 1 });
    
    console.log('\n=== ROOMS IN DATABASE ===');
    console.log('Total rooms:', rooms.length);
    
    // Group by type
    const roomsByType = {};
    rooms.forEach(room => {
      if (!roomsByType[room.type]) {
        roomsByType[room.type] = [];
      }
      roomsByType[room.type].push(room);
    });

    console.log('\n📊 Rooms by Type:');
    for (const [type, typeRooms] of Object.entries(roomsByType)) {
      console.log(`\n${type.toUpperCase()} (${typeRooms.length} rooms):`);
      typeRooms.forEach(room => {
        console.log(`  - ${room.name} (${room.building}, Floor ${room.floor})`);
        console.log(`    Capacity: ${room.capacity} students`);
        if (room.equipment && room.equipment.length > 0) {
          console.log(`    Equipment: ${room.equipment.join(', ')}`);
        }
      });
    }

    // Calculate statistics
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const avgCapacity = (totalCapacity / rooms.length).toFixed(1);
    const minCapacity = Math.min(...rooms.map(r => r.capacity));
    const maxCapacity = Math.max(...rooms.map(r => r.capacity));

    console.log('\n📈 Statistics:');
    console.log(`   Total capacity: ${totalCapacity} students`);
    console.log(`   Average capacity: ${avgCapacity} students`);
    console.log(`   Range: ${minCapacity} - ${maxCapacity} students`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRooms();
