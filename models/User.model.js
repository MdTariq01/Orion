import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  telegramChatId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: null
  },
  googleAccessToken: {
    type: String,
    default: null
  },
  googleRefreshToken: {
    type: String,
    default: null
  },
  gmailConnected: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
} , {
    timestamps: true
})

export default mongoose.model('User', userSchema)