import mongoose from 'mongoose';

export const CHAT_MAX_LENGTH = 300;

// Public chat in a live room (doc 05 chatMessages, doc 07 §6). Contacts are masked before saving.
const chatMessageSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomSession', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for system messages
    senderName: { type: String, default: null }, // kept so history reads right if the account is renamed or deleted
    isSeller: { type: Boolean, default: false },
    type: { type: String, enum: ['text', 'system', 'offer', 'purchase'], default: 'text' },
    body: { type: String, required: true, maxlength: CHAT_MAX_LENGTH * 2 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatMessageSchema.index({ session: 1, createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export function publicMessage(m) {
  return {
    id: m._id.toString(),
    type: m.type,
    body: m.body,
    sender: m.sender ? { id: m.sender.toString(), name: m.senderName, isSeller: m.isSeller } : null,
    createdAt: m.createdAt,
  };
}
