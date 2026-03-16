import mongoose from 'mongoose'

const profileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  skills: {
    type: [String],
    default: []
  },
  experienceLevel: {
    type: String,
    enum: ['fresher', 'junior', 'mid'],
    default: 'fresher'
  },
  jobPreferences: {
    jobType: {
    type: [String],
    default: ['internship']
  },
    remote: {
      type: Boolean,
      default: true
    },
    stack: {
      type: [String],
      default: []
    }
  },
  emailRules: {
    type: [
      {
        pattern: String,
        action: String
      }
    ],
    default: [
      { pattern: 'recruiter|hiring|opportunity', action: 'flag_urgent' },
      { pattern: 'newsletter|unsubscribe', action: 'ignore' },
      { pattern: 'OTP|transaction|payment', action: 'ignore' },
      { pattern: 'interview|shortlisted', action: 'flag_urgent' }
    ]
  },
  setupComplete: {
    type: Boolean,
    default: false
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model('Profile', profileSchema)