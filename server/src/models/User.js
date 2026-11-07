import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { isValidPhone } from '../utils/phone.js';

export const ROLES = ['buyer', 'seller', 'admin'];
// disabled = retired account (e.g. a replaced .env admin); logs in as "Incorrect email or password".
export const USER_STATUSES = ['active', 'suspended', 'disabled'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      // Sellers need a phone. Buyers too, except Google sign-ups (they give their M-Pesa number at checkout).
      // The .env admin may not have one.
      required: [
        function phoneRequired() {
          return this.role === 'seller' || (this.role === 'buyer' && !this.googleId);
        },
        'Phone number is required',
      ],
      validate: { validator: isValidPhone, message: 'Phone must be 2547XXXXXXXX or 2541XXXXXXXX' },
    },
    // Google-only accounts have no password until they set one.
    password: {
      type: String,
      required: [
        function passwordRequired() {
          return !this.googleId;
        },
        'Password is required',
      ],
      minlength: 8,
      select: false,
    },
    // Not select:false — the phone/password rules above read it on every save. Hidden in toJSON.
    googleId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ROLES, default: 'buyer' },
    avatar: { type: String, default: null },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    // The owner admin managed by ADMIN_EMAIL/ADMIN_PASSWORD. Cannot be suspended or demoted from the dashboard.
    isEnvOwner: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.googleId;
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password || typeof candidate !== 'string') return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
