# My-Agent - AI-Powered Personal Assistant

An autonomous AI agent that integrates with Telegram, Google Calendar, Gmail, and local LLM to act as your personal assistant. The agent continuously monitors your emails, calendar events, and tasks, using AI to intelligently notify you of important updates and help you manage your daily workflow.

## Overview

**My-Agent** is a Node.js-based autonomous system that runs a "brain loop" to:
- Check your emails and calendar events periodically
- Use AI (Ollama LLM) to intelligently assess what needs your attention
- Send notifications via Telegram when something important requires action
- Execute tools on your behalf (send emails, create calendar events, etc.)
- Maintain an audit log of all actions taken

## Architecture

### Core Components

#### 1. **Telegram Bot** (`telegram/bot.js`)
- Integrates with Telegram to communicate with the user
- Acts as the primary interface for user interactions
- AI-powered chatbot that understands natural language commands
- Routes user requests to appropriate tools

#### 2. **Brain Loop** (`core/brainLoop.js`)
- Runs on a scheduled interval (background check system)
- Gathers current data: emails, calendar events, tasks, pending actions
- Sends data to Ollama LLM for intelligent analysis
- Decides autonomously if user needs to be notified
- Runs continuously to keep the agent "alive"

#### 3. **Tool Executor** (`core/toolExecutor.js`)
- Central hub for executing available tools
- Parses AI-generated tool calls and executes them
- Captures results and logs actions
- Supports chainable tool executions

#### 4. **Authentication** (`auth/googleAuth.js`)
- Google OAuth 2.0 authentication
- Secures access to Google Calendar and Gmail APIs
- Manages user authentication and token refresh

### Data Models

Located in `models/`:

- **User.model.js** - Stores user profile and credentials
- **Profile.model.js** - User profile information
- **ActionLog.model.js** - Audit log of all actions performed by the agent
- **PendingAction.model.js** - Queue of actions awaiting user approval

### Tools

Located in `tools/`:

#### **emailTools.js**
- `getEmails()` - Fetch recent emails from Gmail
- `sendEmail()` - Send emails on behalf of the user

#### **calendarTools.js**
- `getCalendarEvents()` - Fetch upcoming calendar events
- `getTasks()` - Retrieve task list
- `createEvent()` - Create new calendar events
- `deleteEvent()` - Remove calendar events

#### **systemTools.js**
- `getCurrentTime()` - Get current date and time
- System utilities for the agent

## How It Works

### 1. **Initialization Flow**
```
Start Application
    ↓
Connect to MongoDB Database
    ↓
Start Telegram Bot
    ↓
Authenticate with Google (OAuth)
    ↓
Start Brain Loop
    ↓
Agent is Ready
```

### 2. **Brain Loop Execution** (Runs Periodically)
```
Collect Data
├── Current time
├── Recent emails from Gmail
├── Upcoming calendar events
├── Pending tasks
└── Pending actions

    ↓ (Send to AI)
    
Query Ollama LLM
    ↓
AI Analyzes Context
    ↓
Decision Point
├── NO_ACTION → Sleep and check again
└── ACTION_NEEDED → Send Telegram notification ✅
    ↓
Log Action to Database
```

### 3. **User Interaction Flow**
```
User sends Telegram message
    ↓
Bot receives message
    ↓
AI processes natural language
    ↓
Generate tool calls (if needed)
    ↓
Tool Executor runs tools
    ↓
Results sent back to user via Telegram
    ↓
Action logged to database
```

## Installation

### Prerequisites
- Node.js (v18+)
- MongoDB (local or cloud instance)
- Ollama running locally (`http://localhost:11434`)
- Google API credentials
- Telegram Bot Token

### Setup Steps

1. **Clone and Install Dependencies**
   ```bash
   cd c:\CODE\My-agent
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file with:
   ```
   TELEGRAM_TOKEN=your_telegram_bot_token
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   MONGODB_URI=mongodb://localhost:27017/my-agent
   OLLAMA_HOST=http://localhost:11434
   ```

3. **Start Ollama**
   ```bash
   ollama serve
   # or pull a model
   ollama pull llama2
   ```

4. **Start the Agent**
   ```bash
   npm start          # Production mode
   # OR
   npm run dev        # Development mode with auto-reload
   ```

## Configuration

### Database Setup (`config/db.js`)
- Configures MongoDB connection
- Initializes Mongoose models
- Handles connection pooling

### Tools Configuration (`config/tools.js`)
- Defines available tools the AI can call
- Tool descriptions, parameters, and schemas
- Tool availability conditions

## Key Features

### 🤖 Intelligent Decision Making
- Uses Ollama LLM to understand context
- Only notifies when something is genuinely important
- Filters out noise (job postings, automated emails, newsletters)

### 📧 Email Intelligence
- Classifies emails as URGENT, NORMAL, or IGNORE
- Cross-references emails with calendar events
- Drafts intelligent replies

### 📅 Calendar Integration
- Tracks upcoming events
- Identifies conflicts and overlaps
- Reminds about important meetings

### 🔐 Secure OAuth
- Google API authentication
- Token refresh handling
- Secure credential storage

### 📝 Audit Trail
- Logs all actions with timestamps
- Tracks pending approvals
- Maintains action history

### 💬 Natural Language Interface
- Communicate via Telegram
- Give commands in natural language
- Receive contextual responses

## Project Structure

```
My-agent/
├── index.js                 # Entry point
├── package.json            # Dependencies
├── .env                    # Environment variables
│
├── auth/
│   └── googleAuth.js       # Google OAuth & API setup
│
├── config/
│   ├── db.js               # MongoDB configuration
│   └── tools.js            # Tool definitions
│
├── core/
│   ├── brainLoop.js        # Main autonomous loop
│   └── toolExecutor.js     # Tool execution engine
│
├── models/
│   ├── User.model.js       # User schema
│   ├── Profile.model.js    # Profile schema
│   ├── ActionLog.model.js  # Action audit log
│   └── PendingAction.model.js  # Pending actions queue
│
├── telegram/
│   ├── bot.js              # Telegram bot & LLM integration
│   └── registration.js     # User registration logic
│
├── tools/
│   ├── emailTools.js       # Gmail operations
│   ├── calendarTools.js    # Google Calendar & Tasks
│   └── systemTools.js      # System utilities
│
├── utils/                  # Utility functions (if any)
└── workers/                # Background workers (if any)
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **express** | ^5.2.1 | Web framework |
| **mongoose** | ^9.2.4 | MongoDB ORM |
| **node-telegram-bot-api** | ^0.67.0 | Telegram integration |
| **googleapis** | ^171.4.0 | Google APIs (Calendar, Gmail) |
| **ollama** | ^0.6.3 | Local LLM interface |
| **node-cron** | ^4.2.1 | Scheduled tasks |
| **dotenv** | ^17.3.1 | Environment variables |
| **google-auth-library** | ^10.6.1 | OAuth authentication |
| **uuid** | ^13.0.0 | Unique ID generation |
| **mongodb** | ^7.1.0 | Database driver |

## Usage Examples

### Start the Agent
```bash
npm start
```

### Typical Interactions

**User → Telegram Bot:**
```
"Send an email to john@example.com saying I'll be there tomorrow"
```

**Agent Response:**
```
✉️ Email sent to john@example.com
"I'll be there tomorrow"
```

**Brain Loop Notification:**
```
🧠 Your interview with TechCorp is tomorrow at 2 PM.
You still haven't replied to their confirmation email.
```

## AI Prompts

### Brain Loop Prompt
The agent uses a strict decision-making prompt that ensures notifications are only sent when genuinely necessary:
- Real humans waiting for replies
- Time-sensitive calendar events
- Related email + calendar correlations
- Overdue tasks
- Long-pending actions

### Telegram Bot Prompt
"Jarvis" personality with strict email filtering rules:
- Classifies emails as URGENT, NORMAL, or IGNORE
- Ignores job boards, automated emails, and newsletters
- Drafts professional email replies

## Development

### Available Scripts
```bash
npm start    # Start in production mode
npm run dev  # Start with hot-reload (nodemon)
```

### Debugging
- Check logs for errors
- Verify Ollama is running
- Ensure MongoDB connection is active
- Test Google OAuth setup
- Confirm Telegram token is valid

## Technologies Used

- **Backend**: Node.js with Express
- **Database**: MongoDB + Mongoose
- **AI/LLM**: Ollama (local)
- **APIs**: Google APIs (Calendar, Gmail)
- **Chat**: Telegram Bot API
- **Scheduling**: node-cron
- **Authentication**: OAuth 2.0

## Future Enhancements

- [ ] Multi-user support
- [ ] Web dashboard for action history
- [ ] Custom automation rules
- [ ] Integration with more email providers
- [ ] Advanced scheduling and reminders
- [ ] Voice command support
- [ ] Mobile app companion

## License

ISC

## Author

Your Name/Team

---

**Note**: This agent requires:
- Active Ollama instance running locally
- MongoDB database running
- Valid Google API credentials
- Telegram Bot token from BotFather
- Proper `.env` configuration

For more details, refer to specific module documentation in their respective files.
