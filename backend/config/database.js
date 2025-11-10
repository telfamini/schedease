import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// MongoDB connection configuration
const dbConfig = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/schedease_db',
  options: {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    w: 'majority'
  }
};

// Database connection
let isConnected = false;

export async function initializeDatabase() {
  try {
    if (isConnected) {
      console.log('📊 Database already connected');
      return mongoose.connection;
    }

    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 MongoDB URI: ${dbConfig.mongoUri.replace(/\/\/.*@/, '//***@')}`); // Hide credentials in log
    
    // Connect to MongoDB with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await mongoose.connect(dbConfig.mongoUri, dbConfig.options);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️ Connection attempt failed. Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      }
    }
    
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
    
    // Test the connection
    await mongoose.connection.db.admin().ping();
    console.log('🔵 Database ping successful');

    // Only seed if SEED_DATABASE environment variable is set to true
    if (process.env.SEED_DATABASE === 'true') {
      await seedDatabase();
      console.log('🌱 Database seeded successfully');
    } else {
      console.log('ℹ️  Database seeding skipped (set SEED_DATABASE=true to enable)');
    }
    
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    if (error.name === 'MongooseServerSelectionError') {
      console.error('💡 Possible reasons:');
      console.error('   1. MongoDB service is not running');
      console.error('   2. Connection string is incorrect');
      console.error('   3. Network connectivity issues');
      console.error('   4. Firewall blocking the connection');
    }
    throw error;
  }
}

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'instructor', 'student'],
    required: true
  },
  department: {
    type: String,
    trim: true
  },
  // Student specific fields
  section: {
    type: String,
    trim: true,
    // Only required if role is student
    required: function() {
      return this.role === 'student';
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Department Schema
const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Room Schema
const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['classroom', 'laboratory', 'computer_lab', 'auditorium'],
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  building: {
    type: String,
    required: true,
    trim: true
  },
  floor: {
    type: Number,
    required: true
  },
  equipment: [{
    type: String,
    trim: true
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Course Schema
const courseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  credits: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['lecture', 'lab', 'seminar'],
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 30 // Duration in minutes
  },
  studentsEnrolled: {
    type: Number,
    default: 0,
    min: 0
  },
  requiredCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  specialRequirements: [{
    type: String,
    trim: true
  }],
  // Optional reference to an Instructor profile
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instructor'
  },
  // Denormalized instructor name for quick display on frontend
  instructorName: {
    type: String,
    trim: true
  },
  // Year level and section for course assignment
  yearLevel: {
    type: String,
    enum: ['1', '2', '3', '4'],
    trim: true
  },
  section: {
    type: String,
    trim: true
  },
  semester: {
    type: String,
    enum: ['First Term', 'Second Term', 'Third Term'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to denormalize instructorName from Instructor -> User
courseSchema.pre('save', async function(next) {
  try {
    // If an instructorId is set, populate the instructor's user name
    if (this.instructorId) {
      // Use the Instructor model to look up the linked User's name
      const InstructorModel = mongoose.model('Instructor');
      const instr = await InstructorModel.findById(this.instructorId).populate('userId');
      if (instr && instr.userId && instr.userId.name) {
        this.instructorName = instr.userId.name;
      }
    } else {
      this.instructorName = undefined;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Instructor Schema
const instructorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  maxHoursPerWeek: {
    type: Number,
    default: 20,
    min: 1
  },
  specializations: [{
    type: String,
    trim: true
  }],
  availability: {
    type: Map,
    of: [{
      startTime: String,
      endTime: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Student Schema
const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    required: true,
    enum: ['1', '2', '3', '4'],
    validate: {
      validator: function(v) {
        return ['1', '2', '3', '4'].includes(v);
      },
      message: props => `${props.value} is not a valid year!`
    }
  },
  section: {
    type: String,
    required: true,
    trim: true
  },
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Student enrollments and schedule data moved to their respective schema sections

// Schedule Request Schema
const scheduleRequestSchema = new mongoose.Schema({
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instructor',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  },
  requestType: {
    type: String,
    enum: ['room_change', 'time_change', 'schedule_conflict'],
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  // Room for which the request is made (room booking)
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  // Specific date for the request (YYYY-MM-DD)
  date: {
    type: String
  },
  dayOfWeek: {
    type: String
  },
  startTime: {
    type: String
  },
  endTime: {
    type: String
  },
  semester: {
    type: String
  },
  year: {
    type: Number
  },
  purpose: {
    type: String,
    enum: ['make-up class', 'quiz', 'unit test'],
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Flag set when a conflict with an approved request is detected
  conflict_flag: {
    type: Boolean,
    default: false
  },
  conflicts: [{ type: String }],
  // denormalized display fields
  instructorName: { type: String },
  courseName: { type: String },
  courseCode: { type: String },
  roomName: { type: String },
  details: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Schedule Schema
const scheduleSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Instructor',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  // Actual date for the schedule (for 14-week semester restriction)
  scheduleDate: {
    type: Date,
    required: false // Optional for backward compatibility
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['First Term', 'Second Term', 'Third Term']
  },
  year: {
    type: Number,
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'conflict', 'canceled'],
    default: 'published'
  },
  conflicts: [{
    type: String
  }],
  // Denormalized fields for easier querying
  courseCode: String,
  courseName: String,
  instructorName: String,
  roomName: String,
  building: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt timestamp
scheduleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Enrollment Schema - links students to courses/schedules/instructors
const enrollmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' },
  yearLevel: { type: String, enum: ['1','2','3','4'] },
  section: { type: String },
  department: { type: String },
  // Denormalized fields for quick access
  studentName: { type: String },
  courseName: { type: String },
  courseCode: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Pre-save middleware to populate denormalized fields
enrollmentSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('studentId') || this.isModified('courseId')) {
      // Populate student name
      const student = await mongoose.model('Student').findById(this.studentId).populate('userId');
      if (student && student.userId) {
        this.studentName = student.userId.name;
        // Store department from Student or User for quick filtering
        this.department = student.department || student.userId.department || this.department;
      }

      // Populate course details
      const course = await mongoose.model('Course').findById(this.courseId);
      if (course) {
        this.courseName = course.name;
        this.courseCode = course.code;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Notification Schema - stores all notifications for users
const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional - can be null for role-based notifications
  },
  role: {
    type: String,
    enum: ['admin', 'instructor', 'student'],
    required: false // Optional - can be null for user-specific notifications
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'schedule', 'enrollment', 'request'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  readAt: {
    type: Date,
    required: false
  }
});

// Index for faster queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ role: 1, read: 1, createdAt: -1 });

//Create Models
export const User = mongoose.model('User', userSchema);
export const Department = mongoose.model('Department', departmentSchema);
export const Room = mongoose.model('Room', roomSchema);
export const Course = mongoose.model('Course', courseSchema);
export const Schedule = mongoose.model('Schedule', scheduleSchema);
export const Instructor = mongoose.model('Instructor', instructorSchema);
export const Student = mongoose.model('Student', studentSchema);
export const ScheduleRequest = mongoose.model('ScheduleRequest', scheduleRequestSchema);
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
// Subject Schema - Possible Subjects list imported by Admin
const subjectSchema = new mongoose.Schema({
  subjectCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  prerequisite: {
    type: String,
    trim: true
  },
  equivalentSubjectCode: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  units: {
    type: Number,
    required: true,
    min: 0
  },
  schoolYear: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: String,
    required: true,
    trim: true
  },
  instructorName: {
    type: String,
    trim: true
  },
  day: {
    type: String,
    trim: true
  },
  time: {
    type: String,
    trim: true
  },
  yearLevel: {
    type: String,
    enum: ['1','2','3','4']
  },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  createdAt: { type: Date, default: Date.now }
});
// Prevent duplicates for same subject & term/year
subjectSchema.index({ subjectCode: 1, semester: 1, schoolYear: 1 }, { unique: true });
export const Subject = mongoose.model('Subject', subjectSchema);

export async function seedDatabase() {
  try {
    console.log('Seeding database...');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@university.edu' });
    if (!existingAdmin) {
      const adminUser = new User({
        name: 'Admin User',
        email: 'admin@university.edu',
        password: 'password',
        role: 'admin',
        department: 'IT'
      });
      await adminUser.save();
      console.log('Admin user created');
    }

    // Create default instructor user
    const existingInstructor = await User.findOne({ email: 'instructor@university.edu' });
    if (!existingInstructor) {
      const instructorUser = new User({
        name: 'Instructor User',
        email: 'instructor@university.edu',
        password: 'password',
        role: 'instructor',
        department: 'IT'
      });
      await instructorUser.save();
      console.log('Instructor user created');
    }

    // Create default student user
    const existingStudent = await User.findOne({ email: 'student@university.edu' });
    if (!existingStudent) {
      const studentUser = new User({
        name: 'Student User',
        email: 'student@university.edu',
        password: 'password',
        role: 'student',
        department: 'IT',
        section: '1A'
      });
      await studentUser.save();
      console.log('Student user created');
    }

    // Insert IT department
    const existingDept = await Department.findOne({ code: 'IT' });
    if (!existingDept) {
      await Department.create({ code: 'IT', name: 'Information Technology' });
      console.log('IT Department seeded');
    }

    // Insert actual rooms
    const roomsCount = await Room.countDocuments();
    if (roomsCount === 0) {
      const rooms = [
        { name: '101', type: 'classroom', capacity: 50, building: 'Main Building', floor: 1, equipment: ['whiteboard'] },
        { name: '102', type: 'classroom', capacity: 50, building: 'Main Building', floor: 1, equipment: ['whiteboard'] },
        { name: '103', type: 'classroom', capacity: 50, building: 'Main Building', floor: 1, equipment: ['whiteboard'] },
        { name: '201', type: 'classroom', capacity: 50, building: 'Main Building', floor: 2, equipment: ['projector', 'whiteboard'] },
        { name: '202', type: 'classroom', capacity: 50, building: 'Main Building', floor: 2, equipment: ['projector', 'whiteboard'] },
        { name: '203', type: 'classroom', capacity: 50, building: 'Main Building', floor: 2, equipment: ['whiteboard', 'projector'] },
        { name: '301', type: 'computer_lab', capacity: 50, building: 'Main Building', floor: 3, equipment: ['projector', 'whiteboard', 'computers'] },
        { name: '302', type: 'computer_lab', capacity: 50, building: 'Main Building', floor: 3, equipment: ['projector', 'whiteboard', 'computers'] },
        { name: '304', type: 'computer_lab', capacity: 50, building: 'Main Building', floor: 3, equipment: ['whiteboard', 'projector'] },
        { name: 'Conference Room', type: 'auditorium', capacity: 300, building: 'Main Building', floor: 4, equipment: ['projector', 'audio_system', 'speaker'] }
      ];
      await Room.insertMany(rooms);
      console.log('Rooms seeded');
    }

    // Insert BSIT courses for all years (1-4) and all terms (First, Second, Third) for both sections A and B
    const coursesCount = await Course.countDocuments();
    if (coursesCount === 0) {
      // Course templates by year level and term
      const courseTemplates = {
        '1': {
          'First Term': [
            { code: 'ITCC111-LAB', name: 'Computer Programming 1 (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC111-LEC', name: 'Computer Programming 1 (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITMS110', name: 'Discrete Mathematics', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'whiteboard'] },
            { code: 'DRAW1', name: 'Engineering Drawing and Plans (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: [] },
            { code: 'ITCI110', name: 'Human Computer Interaction', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITCC110', name: 'Introduction to Computing', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'PATHFIT1', name: 'Physical Activities Towards Health and Fitness 1', department: 'IT', credits: 2, type: 'lecture', duration: 120, requiredCapacity: 40, specialRequirements: [] },
            { code: 'GEC5', name: 'Purposive Communication', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'NSTP1', name: 'National Service Training Program 1', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: [] }
          ],
          'Second Term': [
            { code: 'ITCC112-LAB', name: 'Computer Programming 2 (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC112-LEC', name: 'Computer Programming 2 (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITMS111', name: 'Statistics and Probability', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC4', name: 'Mathematics in the Modern World', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'whiteboard'] },
            { code: 'PATHFIT2', name: 'Physical Activities Towards Health and Fitness 2', department: 'IT', credits: 2, type: 'lecture', duration: 120, requiredCapacity: 40, specialRequirements: [] },
            { code: 'GEC6', name: 'Art Appreciation', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'NSTP2', name: 'National Service Training Program 2', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: [] }
          ],
          'Third Term': [
            { code: 'ITCC121-LAB', name: 'Data Structures and Algorithms (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC121-LEC', name: 'Data Structures and Algorithms (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITCC120', name: 'Object-Oriented Programming', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC1', name: 'Understanding the Self', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC7', name: 'Science, Technology and Society', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'PATHFIT3', name: 'Physical Activities Towards Health and Fitness 3', department: 'IT', credits: 2, type: 'lecture', duration: 120, requiredCapacity: 40, specialRequirements: [] }
          ]
        },
        '2': {
          'First Term': [
            { code: 'ITCC211-LAB', name: 'Web Development (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC211-LEC', name: 'Web Development (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITCC210', name: 'Database Management Systems', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'computers'] },
            { code: 'ITCI210', name: 'Information Management', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC2', name: 'Readings in Philippine History', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'PATHFIT4', name: 'Physical Activities Towards Health and Fitness 4', department: 'IT', credits: 2, type: 'lecture', duration: 120, requiredCapacity: 40, specialRequirements: [] }
          ],
          'Second Term': [
            { code: 'ITCC212-LAB', name: 'Mobile Application Development (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC212-LEC', name: 'Mobile Application Development (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITNE210', name: 'Networking 1', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'networking equipment'] },
            { code: 'ITIS210', name: 'Information Assurance and Security', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC3', name: 'The Contemporary World', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'GEC8', name: 'Ethics', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] }
          ],
          'Third Term': [
            { code: 'ITCC220-LAB', name: 'Advanced Database Systems (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC220-LEC', name: 'Advanced Database Systems (lec)', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITNE211', name: 'Networking 2', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'networking equipment'] },
            { code: 'ITSE210', name: 'Software Engineering 1', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITEL210', name: 'Platform Technologies', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] }
          ]
        },
        '3': {
          'First Term': [
            { code: 'ITCC311', name: 'Systems Integration and Architecture', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITSE311', name: 'Software Engineering 2', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITAI310', name: 'Introduction to Artificial Intelligence', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'computers'] },
            { code: 'ITSM310', name: 'Systems Administration and Maintenance', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITSP310', name: 'Social and Professional Issues', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] }
          ],
          'Second Term': [
            { code: 'ITCC312', name: 'Application Development and Emerging Technologies', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'computers'] },
            { code: 'ITQM310', name: 'Quantitative Methods', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'whiteboard'] },
            { code: 'ITCC313-LAB', name: 'Capstone Project 1 (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC313-LEC', name: 'Capstone Project 1 (lec)', department: 'IT', credits: 2, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITEL310', name: 'Elective 1 - Cloud Computing', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] }
          ],
          'Third Term': [
            { code: 'ITCC320', name: 'Big Data and Analytics', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector', 'computers'] },
            { code: 'ITEL320', name: 'Elective 2 - DevOps Fundamentals', department: 'IT', credits: 3, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] },
            { code: 'ITCC321-LAB', name: 'Capstone Project 2 (lab)', department: 'IT', credits: 1, type: 'lab', duration: 180, requiredCapacity: 35, specialRequirements: ['computers'] },
            { code: 'ITCC321-LEC', name: 'Capstone Project 2 (lec)', department: 'IT', credits: 2, type: 'lecture', duration: 90, requiredCapacity: 40, specialRequirements: ['projector'] }
          ]
        },
        '4': {
          'First Term': [
            { code: 'ITPRAC1', name: 'Practicum (540 hours)', department: 'IT', credits: 9, type: 'lab', duration: 540, requiredCapacity: 5, specialRequirements: [] }
          ],
          'Second Term': [
            { code: 'ITPRAC2', name: 'Practicum Continuation', department: 'IT', credits: 3, type: 'lab', duration: 180, requiredCapacity: 5, specialRequirements: [] }
          ],
          'Third Term': []
        }
      };

      const courses = [];
      // Generate courses for all years, terms, and sections
      for (const yearLevel of ['1', '2', '3', '4']) {
        for (const semester of ['First Term', 'Second Term', 'Third Term']) {
          const templates = courseTemplates[yearLevel][semester] || [];
          for (const section of ['A', 'B']) {
            for (const courseTemplate of templates) {
              courses.push({
                ...courseTemplate,
                code: `${courseTemplate.code}-${yearLevel}${section}`,
                yearLevel,
                section,
                semester,
                studentsEnrolled: 0
              });
            }
          }
        }
      }

      await Course.insertMany(courses);
      console.log(`✅ BSIT Courses seeded: ${courses.length} courses across 4 years, 3 terms, and 2 sections each`);
    }

    // Create instructor profiles
    const instructorUsers = await User.find({ role: 'instructor' });
    for (const instructorUser of instructorUsers) {
      const existingInstructor = await Instructor.findOne({ userId: instructorUser._id });
      if (!existingInstructor) {
        const instructor = new Instructor({
          userId: instructorUser._id,
          maxHoursPerWeek: 20,
          specializations: ['Information Technology', 'Programming', 'Web Development'],
          availability: new Map([
            ['Monday', [{ startTime: '07:00', endTime: '18:00' }]],
            ['Tuesday', [{ startTime: '07:00', endTime: '18:00' }]],
            ['Wednesday', [{ startTime: '07:00', endTime: '18:00' }]],
            ['Thursday', [{ startTime: '07:00', endTime: '18:00' }]],
            ['Friday', [{ startTime: '07:00', endTime: '18:00' }]]
          ])
        });
        await instructor.save();
      }
    }

    // Create student profiles
    const studentUsers = await User.find({ role: 'student' });
    for (const studentUser of studentUsers) {
      const existingStudent = await Student.findOne({ userId: studentUser._id });
      if (!existingStudent) {
        const courses = await Course.find().limit(3);
        const student = new Student({
          userId: studentUser._id,
          studentId: `BSIT-${Date.now()}`,
          department: 'IT',
          year: '1',
          section: studentUser.section || '1A',
          enrolledCourses: courses.map(c => c._id)
        });
        await student.save();
      }
    }

    // Insert sample schedules
    const schedulesCount = await Schedule.countDocuments();
    if (schedulesCount === 0) {
      const courses = await Course.find();
      const instructors = await Instructor.find();
      const rooms = await Room.find({ isAvailable: true });

      if (courses.length > 0 && instructors.length > 0 && rooms.length > 0) {
        const schedules = [
          {
            courseId: courses[0]._id,
            instructorId: instructors[0]._id,
            roomId: rooms[2]._id, // Room 103 (computer lab)
            dayOfWeek: 'Monday',
            startTime: '07:00',
            endTime: '10:00',
            semester: 'First Term',
            year: 2024,
            academicYear: '2024-2025'
          },
          {
            courseId: courses[1]._id,
            instructorId: instructors[0]._id,
            roomId: rooms[0]._id, // Room 101
            dayOfWeek: 'Tuesday',
            startTime: '10:00',
            endTime: '11:30',
            semester: 'First Term',
            year: 2024,
            academicYear: '2024-2025'
          },
          {
            courseId: courses[2]._id,
            instructorId: instructors[0]._id,
            roomId: rooms[1]._id, // Room 102
            dayOfWeek: 'Wednesday',
            startTime: '13:00',
            endTime: '14:30',
            semester: 'First Term',
            year: 2024,
            academicYear: '2024-2025'
          }
        ];
        await Schedule.insertMany(schedules);
        console.log('Schedules seeded');
      }
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

export function getConnection() {
  if (!isConnected) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return mongoose.connection;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (isConnected) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
});

export default {
  initializeDatabase,
  seedDatabase,
  getConnection,
  User,
  Department,
  Room,
  Course,
  Instructor,
  Student,
  Schedule,
  ScheduleRequest,
  Enrollment,
  Notification
};