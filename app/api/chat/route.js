import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages, systemPrompt, apiKey, model, apiEndpoint, isOpenRouter } = await request.json();
    
    // For OpenRouter, only use the provided API key
    // For OpenAI, use provided key or fall back to environment variable
    const apiKeyToUse = isOpenRouter 
      ? apiKey  // No fallback to env for OpenRouter
      : (apiKey || process.env.OPENAI_API_KEY);
    
    const isUsingEnvKey = !apiKey && !isOpenRouter && process.env.OPENAI_API_KEY;
    
    if (!apiKeyToUse) {
      return NextResponse.json(
        { error: isOpenRouter ? 'OpenRouter API key is required' : 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    // Block GPT-4.5 models only when using environment API key
    const modelToUse = model || 'gpt-3.5-turbo';
    if (isUsingEnvKey && !isOpenRouter && modelToUse.includes('gpt-4.5')) {
      return NextResponse.json(
        { error: 'GPT-4.5 models are restricted when using the environment API key' },
        { status: 403 }
      );
    }

    // Configure OpenAI client with optional custom endpoint
    const openaiConfig = {
      apiKey: apiKeyToUse,
    };
    
    // Add baseURL if a custom endpoint is provided
    if (apiEndpoint) {
      openaiConfig.baseURL = apiEndpoint;
    }
    
    // For OpenRouter, add specific headers
    if (isOpenRouter) {
      openaiConfig.defaultHeaders = {
        'HTTP-Referer': 'https://github.com/RayenAI/RayenAI-Trainingdata-site',
        'X-Title': 'RayenAI Training Data',
      };
    }
    
    const openai = new OpenAI(openaiConfig);
    
    // Add system message if provided
    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    
    let completionOptions = {
      messages: allMessages,
    };
    
    // For OpenRouter, use the full model path; for OpenAI, use the model ID
    if (isOpenRouter) {
      completionOptions.model = model; // OpenRouter uses full model paths like "openai/gpt-4"
    } else {
      completionOptions.model = modelToUse; // OpenAI uses model IDs like "gpt-4"
    }
    
    const completion = await openai.chat.completions.create(completionOptions);
    
    const message = completion.choices[0].message.content;
    
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error in OpenAI API call:', error);
    
    // Extract the most relevant error message
    let errorMessage = 'An error occurred while processing your request';
    
    if (error.response) {
      // OpenAI API error
      errorMessage = error.response.data?.error?.message || errorMessage;
    } else if (error.message) {
      // Network or other error
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 