import { OpenAI } from 'openai';

export async function POST(request) {
  try {
    const { messages, systemPrompt, apiKey } = await request.json();
    
    // Use the provided API key or fall back to the environment variable
    const finalApiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!finalApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages must be a valid array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = new OpenAI({
      apiKey: finalApiKey,
    });

    const allMessages = [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant named Riko.' },
      ...messages,
    ];

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      return new Response(JSON.stringify({ 
        message: response.choices[0].message.content, 
        id: response.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Handle specific OpenAI API errors
      if (openaiError.status === 401) {
        return new Response(JSON.stringify({ error: 'Invalid API key. Please check your API key and try again.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (openaiError.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ error: openaiError.message || 'Error connecting to OpenAI API' }), {
          status: openaiError.status || 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'Server error processing your request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 