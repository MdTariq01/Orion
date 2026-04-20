import { google } from 'googleapis'
import { getOAuthClient } from '../auth/googleAuth.js'
import User from '../models/User.model.js'
import { v4 as uuidv4 } from 'uuid'
import PendingAction from '../models/PendingAction.model.js'
// this is calendarTools.js

async function getCalendarClient(userId) {
  const user = await User.findOne({ userId })

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  })

  // refresh token if expired
  const { credentials } = await oauth2Client.refreshAccessToken()
  oauth2Client.setCredentials(credentials)

  // save new access token
  await User.findOneAndUpdate(
    { userId },
    { googleAccessToken: credentials.access_token }
  )

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function getCalendarEvents(userId, days = 7, maxResults = 10) {
  try {
    const calendar = await getCalendarClient(userId)

    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    })

    const events = response.data.items
    if (!events || events.length === 0) {
      return { events: [], message: 'No upcoming events found.' }
    }

    const formatted = events.map(event => ({
      id: event.id,
      title: event.summary || 'No title',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location || null,
      description: event.description || null,
      isAllDay: !event.start.dateTime  // true if date-only (no time)
    }))

    return { events: formatted }
  } catch (error) {
    console.error('Get calendar events error:', error)
    return { error: error.message }
  }
}

export async function requestCreateEvent(userId, telegramChatId, title, date, startTime, endTime, description, location, context, bot) {
  const actionId = uuidv4()

  const payload = { title, date, startTime, endTime, description, location }

  await PendingAction.create({
    actionId,
    userId,
    type: 'create_event',
    payload,
    context
  })

  const displayDesc = description ? `\n*Description:* ${description}` : ''
  const displayLoc = location ? `\n*Location:* ${location}` : ''

  const message = await bot.sendMessage(
    telegramChatId,
    `📅 *I want to create this calendar event:*\n\n` +
    `*Title:* ${title}\n` +
    `*Date:* ${date}\n` +
    `*Time:* ${startTime} → ${endTime}` +
    displayLoc +
    displayDesc +
    `\n\n*Reason:* ${context}\n\n` +
    `Should I create it?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Yes, Create', callback_data: `approve_${actionId}` },
          { text: '❌ No, Cancel', callback_data: `reject_${actionId}` }
        ]]
      }
    }
  )

  await PendingAction.findOneAndUpdate(
    { actionId },
    { telegramMessageId: message.message_id }
  )

  return {
    status: 'pending_approval',
    message: 'Calendar event creation request sent to user'
  }
}

export async function createEvent(user, title, date, startTime, endTime, description, location) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  oauth2Client.setCredentials(credentials)
  await User.findOneAndUpdate({ userId: user.userId }, { googleAccessToken: credentials.access_token })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const event = {
    summary: title,
    location: location || undefined,
    description: description || undefined,
    start: {
      dateTime: `${date}T${startTime}:00`,
      timeZone: 'Asia/Kolkata'
    },
    end: {
      dateTime: `${date}T${endTime}:00`,
      timeZone: 'Asia/Kolkata'
    }
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event
  })

  console.log(`Calendar event created: ${title} on ${date}`)
  return response.data
}

export async function requestDeleteEvent(userId, telegramChatId, eventId, title, context, bot) {
  const actionId = uuidv4()

  await PendingAction.create({
    actionId,
    userId,
    type: 'delete_event',
    payload: { eventId, title },
    context
  })

  const message = await bot.sendMessage(
    telegramChatId,
    `🗑️ *I want to delete this calendar event:*\n\n` +
    `*Title:* ${title}\n\n` +
    `*Reason:* ${context}\n\n` +
    `Should I delete it?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Yes, Delete', callback_data: `approve_${actionId}` },
          { text: '❌ No, Cancel', callback_data: `reject_${actionId}` }
        ]]
      }
    }
  )

  await PendingAction.findOneAndUpdate(
    { actionId },
    { telegramMessageId: message.message_id }
  )

  return {
    status: 'pending_approval',
    message: 'Calendar event deletion request sent to user'
  }
}

export async function deleteEvent(user, eventId) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  oauth2Client.setCredentials(credentials)
  await User.findOneAndUpdate({ userId: user.userId }, { googleAccessToken: credentials.access_token })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  await calendar.events.delete({
    calendarId: 'primary',
    eventId
  })

  console.log(`Calendar event deleted: ${eventId}`)
}

export async function requestCreateTask(userId, telegramChatId, title, dueDate, notes, context, bot) {
  try {
    const actionId = uuidv4()

    const payload = { title, dueDate, notes }

    await PendingAction.create({
      actionId,
      userId,
      type: 'create_task',
      payload,
      context
    })

    const displayDue = dueDate ? `\n*Due:* ${dueDate}` : ''
    const displayNotes = notes ? `\n*Notes:* ${notes}` : ''

    console.log(`Sending task approval message to ${telegramChatId}`)

    const message = await bot.sendMessage(
      telegramChatId,
      `📝 *I want to create this task:*\n\n` +
      `*Title:* ${title}` +
      displayDue +
      displayNotes +
      `\n\n*Reason:* ${context}\n\n` +
      `Should I create it?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Yes, Create', callback_data: `approve_${actionId}` },
            { text: '❌ No, Cancel', callback_data: `reject_${actionId}` }
          ]]
        }
      }
    )

    console.log(`Task approval message sent, message_id: ${message.message_id}`)

    await PendingAction.findOneAndUpdate(
      { actionId },
      { telegramMessageId: message.message_id }
    )

    return {
      status: 'pending_approval',
      message: 'Task creation request sent to user'
    }
  } catch (error) {
    console.error('requestCreateTask error:', error.message)
    throw error
  }
}

export async function createTask(user, title, dueDate, notes) {
  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken
  })

  const { credentials } = await oauth2Client.refreshAccessToken()
  oauth2Client.setCredentials(credentials)
  await User.findOneAndUpdate({ userId: user.userId }, { googleAccessToken: credentials.access_token })

  const tasks = google.tasks({ version: 'v1', auth: oauth2Client })

  // get the default task list
  const listRes = await tasks.tasklists.list({ maxResults: 1 })
  const taskLists = listRes.data.items || []
  
  if (taskLists.length === 0) {
    throw new Error('No default task list found. Please create one in Google Tasks first.')
  }

  const taskListId = taskLists[0].id

  const task = {
    title: title,
    notes: notes || undefined,
    due: dueDate ? new Date(dueDate).toISOString() : undefined
  }

  const response = await tasks.tasks.insert({
    tasklist: taskListId,
    requestBody: task
  })

  console.log(`Task created: ${title}${dueDate ? ' due ' + dueDate : ''}`)
  return response.data
}

export async function getTasks(userId, maxResults = 10) {
  try {
    const user = await User.findOne({ userId })
    const oauth2Client = getOAuthClient()
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken
    })
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)
    await User.findOneAndUpdate({ userId }, { googleAccessToken: credentials.access_token })

    const tasks = google.tasks({ version: 'v1', auth: oauth2Client })

    // get all task lists first
    const listRes = await tasks.tasklists.list({ maxResults: 10 })
    const taskLists = listRes.data.items || []

    if (taskLists.length === 0) return { tasks: [], message: 'No task lists found.' }

    // fetch tasks from each list
    const allTasks = await Promise.all(
      taskLists.map(async (list) => {
        const res = await tasks.tasks.list({
          tasklist: list.id,
          maxResults,
          showCompleted: false,
          showHidden: false
        })
        return (res.data.items || []).map(t => ({
          id: t.id,
          title: t.title,
          due: t.due || null,
          notes: t.notes || null,
          status: t.status,
          listName: list.title
        }))
      })
    )

    const flat = allTasks.flat()
    if (flat.length === 0) return { tasks: [], message: 'No pending tasks found.' }

    return { tasks: flat }
  } catch (error) {
    console.error('Get tasks error:', error)
    return { error: error.message }
  }
}