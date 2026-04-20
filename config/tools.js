export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date, time and day.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_emails",
      description: "Read emails from Gmail inbox.",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "Number of emails to fetch"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_send_email",
      description: "Request to send an email. Asks user for approval first.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address"
          },
          subject: {
            type: "string",
            description: "Email subject"
          },
          body: {
            type: "string",
            description: "Email body"
          },
          context: {
            type: "string",
            description: "Why are you sending this email"
          }
        },
        required: ["to", "subject", "body", "context"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Read upcoming events from the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "How many days ahead to fetch events for. Default is 7."
          },
          maxResults: {
            type: "number",
            description: "Maximum number of events to return. Default is 10."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_create_event",
      description: "Request to create a new event on the user's Google Calendar. Asks user for approval first.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title of the event"
          },
          date: {
            type: "string",
            description: "Date of the event in YYYY-MM-DD format"
          },
          startTime: {
            type: "string",
            description: "Start time in HH:MM 24-hour format"
          },
          endTime: {
            type: "string",
            description: "End time in HH:MM 24-hour format"
          },
          description: {
            type: "string",
            description: "Optional description or notes for the event"
          },
          location: {
            type: "string",
            description: "Optional location of the event"
          },
          context: {
            type: "string",
            description: "Why are you creating this event"
          }
        },
        required: ["title", "date", "startTime", "endTime", "context"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_delete_event",
      description: "Request to delete an event from the user's Google Calendar. Asks user for approval first.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The Google Calendar event ID to delete"
          },
          title: {
            type: "string",
            description: "Title of the event being deleted (for display in approval message)"
          },
          context: {
            type: "string",
            description: "Why are you deleting this event"
          }
        },
        required: ["eventId", "title", "context"]
      }
    }
  },
  {
  type: "function",
  function: {
    name: "get_tasks",
    description: "Get the user's pending tasks from Google Tasks.",
    parameters: {
      type: "object",
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of tasks to return. Default is 10."
        }
      },
      required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_create_task",
      description: "Request to create a new task in Google Tasks. Asks user for approval first.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title/description of the task"
          },
          dueDate: {
            type: "string",
            description: "Optional due date in YYYY-MM-DD format"
          },
          notes: {
            type: "string",
            description: "Optional notes or details for the task"
          },
          context: {
            type: "string",
            description: "Why are you creating this task"
          }
        },
        required: ["title", "context"]
      }
    }
  }
]