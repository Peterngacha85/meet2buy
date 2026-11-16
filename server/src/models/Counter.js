import mongoose from 'mongoose';

// Gap-free-ish running numbers (receipts, after-sales tickets). One document per sequence.
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.model('Counter', counterSchema);

/** The next number in a sequence, atomically: 1, 2, 3… */
export async function nextSeq(name) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return c.seq;
}
