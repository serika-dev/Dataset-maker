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
          note: 'API key required for OpenRouter. Please provide an API key.'
        });
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
          throw new Error(`OpenRouter API returned ${response.status}`);
        }

        const data = await response.json();
        
        // Extract models and add "custom" option
        const models = [...data.data.map(model => ({ id: model.id })), { id: 'custom' }];
        
        return NextResponse.json({ models });
      } catch (error) {
        console.error('Error fetching OpenRouter models:', error);
        return NextResponse.json({
          models: [{ id: 'custom' }],
          note: `Error fetching models: ${error.message}`
        });
      }
    } else {
      // OpenAI API models fetch remains the same
      // ... existing OpenAI code ...
      
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
          note: 'Using default models list. Please provide an API key for actual models.'
        });
      }

      // Set up OpenAI client with the API key
      const openai = new OpenAI({
        apiKey: apiKeyToUse,
        baseURL: apiEndpoint
      });

      const response = await openai.models.list();
      
      // Return all models
      return NextResponse.json({ models: response.data });
    }
  } catch (error) {
    console.error('Error in models endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 