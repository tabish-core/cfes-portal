/**
 * Timetable.model.js — Mongoose schema for faculty weekly timetables with consulting hours.
 *
 * Logical Identity:
 *   Faculty-specific per academic semester: { faculty: UserRef, semester: SemesterRef }.
 *   A faculty member can teach multiple courses but maintains one unified timetable per semester.
 *   Timetable data is NOT course-specific.
 */
const mongoose = require('mongoose');

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const timeSlotSchema = new mongoose.Schema(
  {
    slotId: {
      type: String,
      required: [true, 'Slot ID is required'],
      trim: true
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true
    },
    label: {
      type: String,
      trim: true,
      default: ''
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const dayConfigSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: [true, 'Day name is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of the week'
      }
    },
    isOffDay: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Activity ID is required'],
      trim: true
    },
    day: {
      type: String,
      required: [true, 'Activity day is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day'
      }
    },
    startSlotId: {
      type: String,
      required: [true, 'Start slot ID is required'],
      trim: true
    },
    endSlotId: {
      type: String,
      required: [true, 'End slot ID is required'],
      trim: true
    },
    activityType: {
      type: String,
      trim: true,
      default: 'Class'
    },
    title: {
      type: String,
      trim: true,
      default: ''
    },
    venue: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const consultingHourSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Consulting hour ID is required'],
      trim: true
    },
    day: {
      type: String,
      required: [true, 'Day is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day'
      }
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      trim: true
    },
    location: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const facultyInfoSchema = new mongoose.Schema(
  {
    facultyName: {
      type: String,
      trim: true,
      default: ''
    },
    designation: {
      type: String,
      trim: true,
      default: '' // Academic designation (e.g. Assistant Professor, Lecturer). User.designation remains system role.
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    facultySchool: {
      type: String,
      trim: true,
      default: 'Faculty of Engineering Sciences and Technology'
    },
    academicTerm: {
      type: String,
      trim: true,
      default: ''
    },
    effectiveDate: {
      type: String,
      trim: true,
      default: ''
    },
    roomNo: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty reference is required']
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      required: [true, 'Semester reference is required']
    },
    facultyInfo: {
      type: facultyInfoSchema,
      default: () => ({})
    },
    timeSlots: {
      type: [timeSlotSchema],
      default: []
    },
    days: {
      type: [dayConfigSchema],
      default: []
    },
    activities: {
      type: [activitySchema],
      default: []
    },
    consultingHours: {
      type: [consultingHourSchema],
      default: []
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'submitted'],
        message: "Status must be 'draft' or 'submitted'"
      },
      default: 'draft'
    }
  },
  { timestamps: true }
);

// Compound unique index ensuring one timetable per faculty per semester
timetableSchema.index({ faculty: 1, semester: 1 }, { unique: true });

// Virtuals in JSON / Object serialization
timetableSchema.set('toJSON', { virtuals: true });
timetableSchema.set('toObject', { virtuals: true });

module.exports = {
  Timetable: mongoose.model('Timetable', timetableSchema),
  DAYS_OF_WEEK
};
