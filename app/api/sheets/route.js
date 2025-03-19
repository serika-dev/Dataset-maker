import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// Utility function to format the private key correctly
function formatPrivateKey(privateKey) {
  if (!privateKey) {
    console.error('Private key is missing or empty');
    return '';
  }
  
  try {
    // Log first few characters for debugging (avoid logging the complete key)
    const firstChars = privateKey.substring(0, 25);
    const lastChars = privateKey.substring(privateKey.length - 25);
    console.log(`Private key starts with: ${firstChars}... and ends with ...${lastChars}`);
    console.log(`Private key contains literal '\\n'? ${privateKey.includes('\\n')}`);
    console.log(`Private key contains actual newlines? ${privateKey.includes('\n')}`);
    
    // If the key already contains proper newlines, return it as is
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----\n')) {
      console.log('Private key already has correct formatting');
      return privateKey;
    }
    
    // Replace literal '\n' strings with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // If the private key doesn't have the proper header/footer with newlines, add them
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
      privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
      console.log('Added newline after BEGIN PRIVATE KEY');
    }
    
    if (!privateKey.endsWith('\n-----END PRIVATE KEY-----') && !privateKey.endsWith('\n-----END PRIVATE KEY-----\n')) {
      privateKey = privateKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      console.log('Added newline before END PRIVATE KEY');
    }
    
    return privateKey;
  } catch (error) {
    console.error('Error formatting private key:', error);
    throw new Error('Failed to format private key: ' + error.message);
  }
}

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    // Use the utility function to format the private key
    private_key: formatPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY),
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

    // More detailed environment variable checking
    const missingVars = [];
    if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) missingVars.push('GOOGLE_SHEETS_CLIENT_EMAIL');
    if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) missingVars.push('GOOGLE_SHEETS_PRIVATE_KEY');
    if (!process.env.GOOGLE_SHEETS_PROJECT_ID) missingVars.push('GOOGLE_SHEETS_PROJECT_ID');
    if (!process.env.GOOGLE_SHEETS_SHEET_ID) missingVars.push('GOOGLE_SHEETS_SHEET_ID');
    
    if (missingVars.length > 0) {
      console.error(`Missing required Google Sheets environment variables: ${missingVars.join(', ')}`);
      return NextResponse.json(
        { error: `Server configuration error: Missing Google Sheets credentials (${missingVars.join(', ')})` },
        { status: 500 }
      );
    }

    console.log('Starting Google Sheets data export...');
    console.log(`Using sheet ID: ${SPREADSHEET_ID}, GID: ${SHEET_GID}`);
    console.log(`Submitter: ${submitterName}, Data entries: ${data.length}`);

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
    
    // Provide more detailed error information for debugging
    let errorDetails = error.message;
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    
    // Check for specific error types
    if (error.message.includes('DECODER routines') || error.message.includes('PEM')) {
      errorDetails = 'Private key format error. Please check the GOOGLE_SHEETS_PRIVATE_KEY environment variable format.';
    } else if (error.message.includes('auth') || error.message.includes('credentials')) {
      errorDetails = 'Authentication error. Please check the Google Sheets API credentials.';
    }
    
    return NextResponse.json(
      { error: 'Error writing to Google Sheets: ' + errorDetails },
      { status: 500 }
    );
  }
} 