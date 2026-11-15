import mongoose from 'mongoose';

export const QUEUE_NOTE_MAX = 140;
export const QUEUE_STATUSES = ['waiting', 'at_counter', 'done', 'left', 'skipped', 'cancelled'];

// A buyer waiting to be served at the counter (doc 05 queueEntries, doc 07 §4).
const queueEntrySchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomSession', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // "Ask to see this"
    note: { type: String, trim: true, maxlength: QUEUE_NOTE_MAX, default: '' },
    status: { type: String, enum: QUEUE_STATUSES, default: 'waiting' },
    // true while waiting or at the counter: one active entry per buyer per session (unique index below).
    active: { type: Boolean, default: true },
    calledAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

queueEntrySchema.index({ session: 1, buyer: 1 }, { unique: true, partialFilterExpression: { active: true } });
queueEntrySchema.index({ session: 1, status: 1, createdAt: 1 });

export const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);
