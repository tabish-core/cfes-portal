/**
 * User.model.js — Mongoose schema for users (Admin & Faculty).
 *
 * Fields:
 *  name        – Full name
 *  email       – Unique, lowercased
 *  password    – Bcrypt-hashed (never returned in JSON)
 *  role        – 'admin' | 'faculty'
 *  department  – Optional string
 *  isActive    – Soft-disable accounts without deletion
 *  timestamps  – createdAt + updatedAt via Mongoose
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:    false, // never returned by default queries
    },
    designation: {
      type:    String,
      enum:    { values: ['dean', 'hod', 'faculty'], message: 'Designation must be dean, hod, or faculty' },
      default: 'faculty',
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ── Hooks ─────────────────────────────────────────────── */

// Hash password before every save (only when modified)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt    = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ── Instance methods ───────────────────────────────────── */

/**
 * Compare a plain-text candidate password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Strip the password field from any JSON serialisation
 * (belt-and-suspenders alongside select: false).
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
