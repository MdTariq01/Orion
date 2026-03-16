import mongoose from 'mongoose'

const actionLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  result: {
    success: Boolean,
    message: String,
    error: String
  },
  approvedBy: {
    type: String,
    enum: ['user', 'auto'],
    default: 'auto'
  },
  pendingActionId: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model('ActionLog', actionLogSchema)