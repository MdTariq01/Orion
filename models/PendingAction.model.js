import mongoose from 'mongoose'

const pendingActionSchema = new mongoose.Schema({
  actionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  context: {
    type: String,
    default: null
  },
  telegramMessageId: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['awaiting', 'approved', 'rejected', 'expired'],
    default: 'awaiting'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
})

export default mongoose.model('PendingAction', pendingActionSchema)