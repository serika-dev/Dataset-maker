import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { apiKey, apiEndpoint, isOpenRouter } = await request.json();
    
    // For OpenRouter, only use the provided API key
    // For OpenAI, use provided key or fall back to environment variable
    const apiKeyToUse = isOpenRouter 
      ? apiKey  // No fallback to env for OpenRouter
      : (apiKey || process.env.OPENAI_API_KEY);
    
    const isUsingEnvKey = !apiKey && !isOpenRouter && process.env.OPENAI_API_KEY;
    
    // For OpenRouter, fetch models from the OpenRouter API
    if (isOpenRouter) {
      if (!apiKeyToUse) {
        // Return a message that API key is required for OpenRouter
        return NextResponse.json({ 
          models: [],
          error: 'API key required for OpenRouter. Please provide an API key.'
        }, { status: 400 });
      }

      try {
        // Fetch models directly from OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKeyToUse}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Rayen AI Training Data'
          }
        });

        if (!response.ok) {
          const responseData = await response.text();
          let errorMessage = `OpenRouter API returned ${response.status}`;
          
          try {
            // Try to parse the error response as JSON
            const errorJson = JSON.parse(responseData);
            if (errorJson.error) {
              errorMessage = errorJson.error.message || errorJson.error;
            }
          } catch (e) {
            // If parsing fails, use the text response
            if (responseData) {
              errorMessage += `: ${responseData}`;
            }
          }
          
          // Return specific error for 401 Unauthorized
          if (response.status === 401) {
            return NextResponse.json({ 
              error: 'Invalid OpenRouter API key. Please check your API key and try again.'
            }, { status: 401 });
          }
          
          return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const data = await response.json();
        
        // Extract models and add "custom" option
        const models = [...data.data.map(model => ({ id: model.id })), { id: 'custom' }];
        
        return NextResponse.json({ models });
      } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
        return NextResponse.json({
          models: [{ id: 'custom' }],
          error: `Error fetching models: ${error.message}`
        }, { status: 500 });
      }
    } else {
      // OpenAI API models fetch
      
      if (!apiKeyToUse) {
        // Return a default set of models if no API key is available
        return NextResponse.json({ 
          models: [
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-3.5-turbo-16k' },
            { id: 'gpt-4' },
            { id: 'gpt-4-turbo' },
            { id: 'gpt-4-32k' },
          ],
          error: 'No API key provided. Using default models list.'
        }, { status: 400 });
      }

      try {
        // Set up OpenAI client with the API key
        const openai = new OpenAI({
          apiKey: apiKeyToUse,
          baseURL: apiEndpoint
        });

        const response = await openai.models.list();
        
        // Return all models
        return NextResponse.json({ models: response.data });
      } catch (error) {
        console.error('Error fetching OpenAI models:', error);
        
        // Extract the error message
        let errorMessage = error.message || 'Failed to fetch models';
        
        // Check for common API key errors
        if (error.status === 401 || errorMessage.includes('auth') || errorMessage.includes('key')) {
          return NextResponse.json({ 
            error: 'Invalid OpenAI API key. Please check your API key and try again.'
          }, { status: 401 });
        }
        
        return NextResponse.json({ error: errorMessage }, { status: error.status || 500 });
      }
    }
  } catch (error) {
    console.error('Error in models endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 