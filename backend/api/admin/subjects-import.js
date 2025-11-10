import multer from 'multer';
import XLSX from 'xlsx';
import { Subject, User, Instructor, Course, Room, Schedule } from '../../config/database.js';

// Configure Multer to keep file in memory (no disk temp files)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      return cb(new Error('Only .xlsx or .xls files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('file');

function normalizeSemester(v) {
  if (!v) return '';
  const s = String(v).trim().toLowerCase();
  if (s.includes('1') || s.includes('first')) return 'First Term';
  if (s.includes('2') || s.includes('second')) return 'Second Term';
  if (s.includes('3') || s.includes('third')) return 'Third Term';
  return String(v).trim();
}

function normalizeDay(v) {
  if (!v) return '';
  const s = String(v).trim().toLowerCase();
  const map = {
    mon: 'Monday', monday: 'Monday',
    tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
    wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
    thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
    fri: 'Friday', friday: 'Friday',
    sat: 'Saturday', saturday: 'Saturday',
    sun: 'Sunday', sunday: 'Sunday'
  };
  return map[s] || String(v).trim();
}

// parses "09:00-10:30" or "9:00 AM - 10:30 AM"
function parseTimeRange(timeStr) {
  if (!timeStr) return { start: null, end: null };
  const s = String(timeStr).replace(/\s+/g, ' ').trim();

  const ampm = s.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[-–]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (ampm) {
    return { start: to24h(ampm[1]), end: to24h(ampm[2]) };
  }

  const hhmm = s.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (hhmm) {
    return { start: pad24(hhmm[1]), end: pad24(hhmm[2]) };
  }

  return { start: null, end: null };
}

function to24h(t) {
  const m = String(t).trim().match(/^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'AM') {
    if (hh === 12) hh = 0;
  } else {
    if (hh !== 12) hh += 12;
  }
  return `${String(hh).padStart(2,'0')}:${mm}`;
}

function pad24(t) {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${String(parseInt(m[1],10)).padStart(2,'0')}:${m[2]}`;
}

async function ensureTbaRoom() {
  let room = await Room.findOne({ name: 'TBA' });
  if (!room) {
    room = await Room.create({
      name: 'TBA',
      type: 'classroom',
      capacity: 1,
      building: 'TBA',
      floor: 1,
      equipment: [],
      isAvailable: true
    });
  }
  return room;
}

async function findInstructorByName(name) {
  if (!name) return null;
  const user = await User.findOne({ role: 'instructor', name: name.trim() });
  if (!user) return null;
  return Instructor.findOne({ userId: user._id });
}

async function getOrCreateCourse(subjectCode, description) {
  if (!subjectCode) return null;
  const code = String(subjectCode).trim().toUpperCase();
  let course = await Course.findOne({ code });
  if (course) return course;
  course = await Course.create({
    code,
    name: description || code,
    department: 'BSIT',
    credits: 3,
    type: 'lecture',
    duration: 90,
    studentsEnrolled: 0,
    requiredCapacity: 30,
    specialRequirements: []
  });
  return course;
}

export function importSubjects(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Use field name "file".' });
    }

    try {
      const overrideYear = (req.body?.yearLevel || req.query?.yearLevel || '').toString().trim();
      const yearLevelOverride = ['1','2','3','4'].includes(overrideYear) ? overrideYear : undefined;
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: 'The Excel file is empty.' });
      }

      const col = (row, keys) => {
        for (const k of keys) {
          if (row[k] !== undefined) return row[k];
        }
        return '';
      };

      const tbaRoom = await ensureTbaRoom();

      let inserted = 0;
      let duplicates = 0;
      let schedulesCreated = 0;
      let schedulesSkipped = 0;
      const duplicateKeys = [];
      const scheduleSkips = [];

      for (const row of rows) {
        const subjectCode = String(col(row, ['Subject Code','SubjectCode','Code'])).trim().toUpperCase();
        const prerequisite = String(col(row, ['Prerequisite','Pre-requisite','PreRequisite'])).trim();
        const equivalentSubjectCode = String(col(row, ['Equivalent Subject Code','Equivalent','EquivalentCode'])).trim().toUpperCase();
        const description = String(col(row, ['Description','Subject Description','Name'])).trim();
        const unitsRaw = col(row, ['Units','Unit']);
        const units = Number(unitsRaw) || 0;

        const schoolYear = String(col(row, ['School Year','SY','Academic Year','AY'])).trim();
        const semester = normalizeSemester(col(row, ['Semester','Term']));
        const instructorName = String(col(row, ['Instructor Name','Instructor','Teacher'])).trim();
        const day = normalizeDay(col(row, ['Day','Days']));
        const time = String(col(row, ['Time','Schedule'])).trim();
        const yearLevelParsed = String(col(row, ['Year Level','Year','YearLevel'])).trim();

        if (!subjectCode || !description || !schoolYear || !semester) {
          continue;
        }

        const exists = await Subject.findOne({ subjectCode, semester, schoolYear });
        if (exists) {
          duplicates++;
          duplicateKeys.push(`${subjectCode} | ${semester} | ${schoolYear}`);
          continue;
        }

        const course = await getOrCreateCourse(subjectCode, description);
        const instructor = await findInstructorByName(instructorName);

        const subjectDoc = await Subject.create({
          subjectCode,
          prerequisite,
          equivalentSubjectCode,
          description,
          units,
          schoolYear,
          semester,
          instructorName,
          day,
          time,
          yearLevel: yearLevelOverride ?? (['1','2','3','4'].includes(yearLevelParsed) ? yearLevelParsed : undefined),
          instructorId: instructor?._id || undefined,
          courseId: course?._id || undefined
        });
        inserted++;

        const { start, end } = parseTimeRange(time);
        const academicYear = schoolYear;

        if (!instructor || !day || !start || !end || !course) {
          schedulesSkipped++;
          scheduleSkips.push(subjectCode);
          continue;
        }

        const schedule = await Schedule.create({
          courseId: course._id,
          instructorId: instructor._id,
          roomId: tbaRoom._id,
          dayOfWeek: day,
          startTime: start,
          endTime: end,
          semester,
          year: Number(academicYear.split('-')[0]) || new Date().getFullYear(),
          academicYear,
          status: 'draft',
          courseCode: course.code,
          courseName: course.name,
          instructorName: instructorName || undefined,
          roomName: tbaRoom.name,
          building: tbaRoom.building
        });

        subjectDoc.scheduleId = schedule._id;
        await subjectDoc.save();
        schedulesCreated++;
      }

      return res.json({
        success: true,
        message: 'Import completed',
        inserted,
        duplicates,
        schedulesCreated,
        schedulesSkipped,
        duplicateKeys,
        scheduleSkips
      });
    } catch (e) {
      console.error('Import error:', e);
      return res.status(500).json({ success: false, message: 'Failed to import subjects', error: e.message });
    }
  });
}


