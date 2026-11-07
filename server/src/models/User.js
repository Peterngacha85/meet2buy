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
      // Buyers and sellers need a phone (M-Pesa, delivery). The .env admin may not have one.
      required: [
        function phoneRequired() {
          return this.role !== 'admin';
        },
        'Phone number is required',
      ],
      validate: { validator: isValidPhone, message: 'Phone must be 2547XXXXXXXX or 2541XXXXXXXX' },
    },
    password: { type: String, required: true, minlength: 8, select: false },
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
        return ret;
      },
    },
  },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
