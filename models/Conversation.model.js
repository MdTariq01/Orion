import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'tool', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  telegramChatId: {
    type: String,
    required: true,
    unique: true
  },
  messages: {
    type: [messageSchema],
    default: []
  }
}, {
    timestamps: true
})

export default mongoose.model('Conversation', conversationSchema)