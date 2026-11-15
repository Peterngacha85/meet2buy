import mongoose from 'mongoose';

// One live session of a shop's room, from "Go live" to "End" (doc 05 roomSessions, doc 07).
const roomSessionSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    livekitRoom: { type: String, required: true, unique: true },
    status: { type: String, enum: ['live', 'ended'], default: 'live' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: null }, // 'seller' | 'seller_gone' | 'suspended' | 'admin' | 'account_deleted'
    pinnedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    counterBuyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Sprint 5
    peakViewers: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 }, // Sprint 6
  },
  { timestamps: true },
);

// A shop has at most one live session at a time.
roomSessionSchema.index({ store: 1 }, { unique: true, partialFilterExpression: { status: 'live' } });
roomSessionSchema.index({ status: 1 });

export const RoomSession = mongoose.model('RoomSession', roomSessionSchema);

/** What anyone in the room may see. Pass the populated pinned product (or null). */
export function publicSession(session, pinnedProduct = null) {
  return {
    id: session._id.toString(),
    store: session.store._id ? session.store._id.toString() : session.store.toString(),
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    pinnedProduct: pinnedProduct ? (pinnedProduct.toJSON?.() ?? pinnedProduct) : null,
  };
}
