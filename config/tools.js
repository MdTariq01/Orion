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
  },
  {
    name: "request_send_email",
    description: "Request to send an email. This will ask the user for approval before sending.",
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
]