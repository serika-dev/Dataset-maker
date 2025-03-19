# Rayen AI Training Data Collection

A Next.js application for collecting AI conversation data to fine-tune language models. This tool allows you to chat with an AI using OpenAI's API, set system prompts, and edit AI messages. Conversations are formatted with conversation IDs, speaker roles, and messages.

## Features

- Chat with an AI using OpenAI's API
- Set custom system prompts
- Edit AI responses
- Organize conversations with conversation IDs
- Format data in a style compatible with fine-tuning datasets
- Export conversations as CSV, JSON, or directly to Google Sheets for model fine-tuning
- Auto-save conversations in your browser for persistence

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (see Environment Variables section below)
4. Run the development server:
   ```
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# OpenAI API (optional - users can provide their own key in the UI)
OPENAI_API_KEY=your_openai_api_key

# Google Sheets API (required for Google Sheets export)
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email@example.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key with \n for newlines\n-----END PRIVATE KEY-----"
GOOGLE_SHEETS_PROJECT_ID=your_google_project_id
GOOGLE_SHEETS_SHEET_ID=your_sheet_id
```

**Important Note for Google Sheets Private Key:**

When using the application in production environments (like Coolify), pay special attention to the `GOOGLE_SHEETS_PRIVATE_KEY` format:

1. The key must be enclosed in double quotes
2. Newlines must be represented as `\n` characters
3. Make sure the key starts with `-----BEGIN PRIVATE KEY-----\n` and ends with `\n-----END PRIVATE KEY-----`

If you're experiencing the error `error:1E08010C:DECODER routines::unsupported`, it means the private key format is incorrect. Check that your environment variable has the proper newline characters.

## Usage

1. Enter your OpenAI API key in the provided field
2. Set a system prompt (default: "You are a helpful assistant named Riko.")
3. Start chatting with the AI
4. Create new conversations or switch between existing ones
5. Edit AI responses by clicking on them
6. Export your data in CSV, JSON, or directly to Google Sheets

## Data Format

Conversations are displayed in a table with the following columns:

1. **Conversation ID**: Identifies which conversation a message belongs to
2. **Speaker**: Identifies if a user is speaking, or if Riko (AI) is speaking
3. **Message**: The actual message content

### Export Formats

#### CSV Export
The CSV export includes three columns: Conversation ID, Speaker, and Message. This format is easy to import into spreadsheet applications for further processing.

#### JSON Export
The JSON export format is structured to be compatible with fine-tuning datasets, with each message having "from" and "value" fields where "from" can be either "human" or "gpt".

## Persistence

Conversations are automatically saved in your browser's localStorage, so they will persist even if you close the browser or refresh the page.

## License

This project is MIT licensed.
