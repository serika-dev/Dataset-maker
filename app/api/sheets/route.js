import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY,
    project_id: process.env.GOOGLE_SHEETS_PROJECT_ID,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1VxAfyQ5fwr6PUU56i2JqPo7C3NOs-gjMu1ZWmIo7PDo';
const SHEET_GID = process.env.GOOGLE_SHEETS_SHEET_ID;

export async function POST(request) {
  try {
    const { data, submitterName } = await request.json();

    // Get current sheet data to find the latest conversation ID
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: false,
    });
    
    // Find the title of the sheet with our GID
    const sheetInfo = response.data.sheets.find(sheet => 
      sheet.properties.sheetId.toString() === SHEET_GID
    );
    
    if (!sheetInfo) {
      throw new Error(`Sheet with GID ${SHEET_GID} not found`);
    }
    
    const sheetTitle = sheetInfo.properties.title;
    
    // Now get the values from the sheet
    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A:D`,
    });

    const rows = valuesResponse.data.values || [];
    let latestId = 0;

    // Find the latest conversation ID
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0]) {
        const id = parseInt(rows[i][0]);
        if (!isNaN(id) && id > latestId) {
          latestId = id;
        }
      }
    }

    // Prepare data for insertion
    const values = data.map(msg => {
      const nextId = latestId + parseInt(msg.conversationId);
      return [
        nextId.toString(),
        msg.speaker,
        msg.message,
        submitterName
      ];
    });

    // Append the data to the sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ 
      success: true, 
      updatedRows: appendResponse.data.updates?.updatedRows || 0 
    });
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
    return NextResponse.json(
      { error: 'Error writing to Google Sheets: ' + error.message },
      { status: 500 }
    );
  }
} 