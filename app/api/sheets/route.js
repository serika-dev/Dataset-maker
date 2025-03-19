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
    
    // The key needs to be processed differently based on its format
    let formattedKey = privateKey;
    
    // If the key already has proper newlines, return it as is
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----\n')) {
      console.log('Private key already has correct formatting');
      return privateKey;
    }
    
    // For Coolify: If the key doesn't have literal '\n' or real newlines,
    // we need to add newlines at the right positions
    if (!privateKey.includes('\\n') && !privateKey.includes('\n')) {
      console.log('Coolify format detected - adding newlines to the raw key');
      
      // Split the key into chunks of 64 characters as per PEM format
      const header = '-----BEGIN PRIVATE KEY-----';
      const footer = '-----END PRIVATE KEY-----';
      
      // Extract the base64 part (remove header and footer)
      let base64Part = privateKey
        .replace(header, '')
        .replace(footer, '')
        .trim();
      
      // Split into 64-character chunks and join with newlines
      const chunks = [];
      for (let i = 0; i < base64Part.length; i += 64) {
        chunks.push(base64Part.substring(i, i + 64));
      }
      
      // Reassemble the key with proper PEM format
      formattedKey = `${header}\n${chunks.join('\n')}\n${footer}`;
      console.log('Formatted key for Coolify environment');
      return formattedKey;
    }
    
    // If the key has literal '\n' strings, replace them with actual newlines
    if (privateKey.includes('\\n')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
      console.log('Replaced literal \\n with actual newlines');
    }
    
    // Ensure proper newlines after BEGIN and before END
    if (!formattedKey.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
      formattedKey = formattedKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n');
      console.log('Added newline after BEGIN PRIVATE KEY');
    }
    
    if (!formattedKey.endsWith('\n-----END PRIVATE KEY-----') && !formattedKey.endsWith('\n-----END PRIVATE KEY-----\n')) {
      formattedKey = formattedKey.replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      console.log('Added newline before END PRIVATE KEY');
    }
    
    return formattedKey;
  } catch (error) {
    console.error('Error formatting private key:', error);
    throw new Error('Failed to format private key: ' + error.message);
  }
}

// For debugging Coolify environment issues
console.log('Initializing Google Sheets API...');
console.log(`Client email defined: ${Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL)}`);
console.log(`Private key defined: ${Boolean(process.env.GOOGLE_SHEETS_PRIVATE_KEY)}`);
console.log(`Project ID defined: ${Boolean(process.env.GOOGLE_SHEETS_PROJECT_ID)}`);
console.log(`Sheet ID defined: ${Boolean(process.env.GOOGLE_SHEETS_SHEET_ID)}`);

// Initialize Google Sheets API
let auth;
try {
  const privateKey = formatPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);
  
  auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: privateKey,
      project_id: process.env.GOOGLE_SHEETS_PROJECT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  console.log('Google Auth initialized successfully');
} catch (error) {
  console.error('Error initializing Google Auth:', error);
  // Create a placeholder auth that will throw a more informative error when used
  auth = {
    getClient: () => {
      throw new Error(`Failed to initialize Google Auth: ${error.message}`);
    }
  };
}

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

    // Get sheet information to find the correct sheet title
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

    // Get current sheet data to find the highest conversation ID
    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetTitle}'!A:A`,
    });

    // Find the highest existing conversation ID in the sheet
    const rows = valuesResponse.data.values || [];
    let highestExistingId = 0;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][0]) {
        const id = parseInt(rows[i][0]);
        if (!isNaN(id) && id > highestExistingId) {
          highestExistingId = id;
        }
      }
    }

    console.log(`Highest existing ID in sheet: ${highestExistingId}`);

    // Group data by conversation ID to organize in continuous blocks
    const dataByConversation = {};
    data.forEach(msg => {
      const convId = msg.conversationId;
      if (!dataByConversation[convId]) {
        dataByConversation[convId] = [];
      }
      dataByConversation[convId].push(msg);
    });

    // Determine if we need to adjust IDs to be higher than existing ones
    const lowestNewId = Math.min(...Object.keys(dataByConversation).map(id => parseInt(id)));
    const needsAdjustment = lowestNewId <= highestExistingId && highestExistingId > 0;
    
    // Prepare values for insertion, adjusting IDs if needed
    const values = [];
    
    if (needsAdjustment) {
      console.log(`Adjusting IDs: lowest new ID (${lowestNewId}) <= highest existing ID (${highestExistingId})`);
      // Create offset to make all new IDs higher than existing ones
      const idOffset = highestExistingId + 1 - lowestNewId;
      
      // Apply the offset to each conversation group
      Object.entries(dataByConversation).forEach(([originalId, messages]) => {
        const adjustedId = (parseInt(originalId) + idOffset).toString();
        
        messages.forEach(msg => {
          values.push([
            adjustedId,
            msg.speaker,
            msg.message,
            submitterName
          ]);
        });
      });
    } else {
      // No adjustment needed, use original IDs
      data.forEach(msg => {
        values.push([
          msg.conversationId.toString(),
          msg.speaker,
          msg.message,
          submitterName
        ]);
      });
    }

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