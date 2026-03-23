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
  }
]