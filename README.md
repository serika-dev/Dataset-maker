# Rayen AI Training Data Collection

A Next.js application for collecting AI conversation data to fine-tune language models. This tool allows you to chat with an AI using OpenAI's API, set system prompts, and edit AI messages. Conversations are formatted with conversation IDs, speaker roles, and messages.

## Features

- Chat with an AI using OpenAI's API
- Set custom system prompts
- Edit AI responses
- Organize conversations with conversation IDs
- Format data in a style compatible with fine-tuning datasets
- Export conversations as CSV or JSON for model fine-tuning
- Auto-save conversations in your browser for persistence

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter your OpenAI API key in the provided field
2. Set a system prompt (default: "You are a helpful assistant named Riko.")
3. Start chatting with the AI
4. Create new conversations or switch between existing ones
5. Edit AI responses by clicking on them
6. Export your data in CSV or JSON format for fine-tuning

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
