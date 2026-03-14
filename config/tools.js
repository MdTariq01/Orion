export const toolDefinitions = [
  {
    name: "get_current_time",
    description: "Get the current date, time and day.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_emails",
    description: "Read emails from the user's Gmail inbox. Use when user asks to check, read or see their emails.",
    parameters: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of emails to fetch. Default 5."
        }
      },
      required: []
    }
  },
  {
    name: "send_email",
    description: "Send an email on behalf of the user. Always create a pending action first before sending.",
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
          description: "Email body content"
        }
      },
      required: ["to", "subject", "body"]
    }
  }
]