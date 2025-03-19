'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState('1');
  const [message, setMessage] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [usingEnvApiKey, setUsingEnvApiKey] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importTarget, setImportTarget] = useState('new');
  const [regeneratingMessageId, setRegeneratingMessageId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [apiEndpoint, setApiEndpoint] = useState('https://api.openai.com/v1');
  const [isCustomEndpoint, setIsCustomEndpoint] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isOpenRouter, setIsOpenRouter] = useState(false);
  const [customOpenRouterModel, setCustomOpenRouterModel] = useState('');
  const [modelError, setModelError] = useState('');

  // Helper function to check if model is custom
  const isCustomModel = (model) => {
    return model === 'custom' || 
      model.toString().toLowerCase().trim() === 'custom' ||
      model === 'other' ||
      model.toString().toLowerCase().trim() === 'other';
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.systemPrompt) setSystemPrompt(parsed.systemPrompt);
        
        // Don't load 'invalid-api-key' as a valid model
        if (parsed.selectedModel && parsed.selectedModel !== 'invalid-api-key') {
          setSelectedModel(parsed.selectedModel);
        }
        
        if (parsed.apiEndpoint) setApiEndpoint(parsed.apiEndpoint);
        if (parsed.isCustomEndpoint !== undefined) setIsCustomEndpoint(parsed.isCustomEndpoint);
        if (parsed.isOpenRouter !== undefined) setIsOpenRouter(parsed.isOpenRouter);
        if (parsed.customOpenRouterModel) setCustomOpenRouterModel(parsed.customOpenRouterModel);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    // If invalid API key is selected, prompt the user to fix it
    if (selectedModel === 'invalid-api-key') {
      alert('Please enter a valid API key or select a different model.');
      return;
    }

    // If there's an API error, make the user aware
    if (modelError) {
      const confirmSave = window.confirm(`There was an error with your API settings: "${modelError}". Do you still want to save these settings?`);
      if (!confirmSave) {
        return;
      }
    }

    // If OpenRouter is selected but no API key provided, show error
    if (isOpenRouter && !apiKey.trim()) {
      alert('OpenRouter requires an API key. Please enter your API key or switch to OpenAI.');
      return;
    }
    
    // If user selected custom model but didn't enter a value
    if (isOpenRouter && isCustomModel(selectedModel) && !customOpenRouterModel.trim()) {
      alert('Please enter an other model identifier or select a pre-defined model.');
      return;
    }

    try {
      localStorage.setItem('settings', JSON.stringify({
        systemPrompt,
        apiKey,
        selectedModel,
        apiEndpoint,
        isCustomEndpoint,
        isOpenRouter,
        customOpenRouterModel
      }));
      
      setShowSettingsModal(false);
      
      // Refetch models in case API key or endpoint changed
      fetchAvailableModels();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  // Fetch available models from the appropriate API
  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    setModelError(''); // Clear any previous errors at the start of the function
    
    try {
      // Determine API endpoint based on settings
      const endpoint = isOpenRouter 
        ? 'https://openrouter.ai/api/v1'
        : (isCustomEndpoint ? apiEndpoint : 'https://api.openai.com/v1');
      
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey, // This can be empty for OpenAI, server will use env variable
          apiEndpoint: endpoint,
          isOpenRouter
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Extract error message from the response if available
        const errorMessage = data.error || 'Failed to fetch models';
        console.error('API Error:', errorMessage);
        setModelError(errorMessage);
        
        // Set appropriate error state
        if (isOpenRouter) {
          setAvailableModels([{ id: 'custom' }]);
        } else {
          setAvailableModels([{ id: 'invalid-api-key' }]);
        }
        return;
      }
      
      // If the API returns an empty list or error, show appropriate message
      if (!data.models || data.models.length === 0) {
        if (isOpenRouter) {
          // For OpenRouter, always show custom option
          setAvailableModels([{ id: 'custom' }]);
        } else {
          // For OpenAI, show an "Invalid API key" option
          setAvailableModels([{ id: 'invalid-api-key' }]);
        }
        return;
      }
      
      // Filter models based on API type
      let filteredModels;
      
      if (isOpenRouter) {
        // For OpenRouter, ensure custom option is included
        const hasCustomOption = data.models.some(model => model.id === 'custom');
        filteredModels = hasCustomOption 
          ? data.models 
          : [...data.models, { id: 'custom' }];
      } else {
        // For OpenAI API, apply regular filtering
        filteredModels = data.models.filter(model => {
          // When using a custom API key, show all GPT models
          if (apiKey) return model.id.startsWith('gpt-');
          
          // When using environment API key, filter out restricted models
          return !model.id.includes('gpt-4.5') && 
                !model.id.toLowerCase().includes('realtime') &&
                !model.id.toLowerCase().includes('search') &&
                !model.id.toLowerCase().includes('audio') &&
                model.id.startsWith('gpt-');
        });
      }
      
      // Ensure we have at least one model option
      if (filteredModels.length === 0) {
        if (isOpenRouter) {
          filteredModels = [{ id: 'custom' }];
        } else {
          filteredModels = [{ id: 'invalid-api-key' }];
        }
      }
      
      setAvailableModels(filteredModels);
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelError(error.message || 'Failed to fetch models');
      // Show appropriate error state
      if (isOpenRouter) {
        setAvailableModels([{ id: 'custom' }]);
      } else {
        setAvailableModels([{ id: 'invalid-api-key' }]);
      }
    } finally {
      setIsLoadingModels(false);
      // Don't clear error here
    }
  };

  // Add mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth <= 768) {
        setIsSidebarVisible(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && isSidebarVisible) {
        const sidebar = document.querySelector(`.${styles.sidebar}`);
        const menuButton = document.querySelector(`.${styles.menuButton}`);
        if (sidebar && !sidebar.contains(event.target) && !menuButton.contains(event.target)) {
          setIsSidebarVisible(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isSidebarVisible]);

  // Load conversations from localStorage on initial load
  useEffect(() => {
    const savedConversations = localStorage.getItem('conversations');
    if (savedConversations) {
      try {
        setConversations(JSON.parse(savedConversations));
      } catch (error) {
        console.error('Error loading saved conversations:', error);
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Load prompt from API on initial load
  useEffect(() => {
    fetch('/api/prompt')
      .then(res => res.json())
      .then(data => {
        if (data.prompt) {
          setSystemPrompt(data.prompt);
        }
      })
      .catch(error => {
        console.error('Error loading prompt:', error);
      });
  }, []);

  // Add a side effect to load models when the settings modal is shown
  useEffect(() => {
    if (showSettingsModal) {
      fetchAvailableModels();
    }
  }, [showSettingsModal, apiKey, apiEndpoint, isCustomEndpoint]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Check if invalid API key is selected
    if (selectedModel === 'invalid-api-key') {
      alert('Please enter a valid API key in settings.');
      return;
    }

    // Check if OpenRouter is selected but no API key is provided
    if (isOpenRouter && !apiKey.trim()) {
      alert('OpenRouter requires an API key. Please enter your API key in settings.');
      return;
    }
    
    // Check if OpenRouter custom model is selected but empty
    if (isOpenRouter && isCustomModel(selectedModel) && !customOpenRouterModel.trim()) {
      alert('Please enter an other model identifier in settings.');
      return;
    }

    // Only check for restricted models when using env API key
    if (!isOpenRouter && !apiKey && selectedModel.includes('gpt-4.5')) {
      alert('GPT-4.5 models are restricted and cannot be used with the environment API key. Please select a different model in Settings.');
      return;
    }
    
    // Add user message to conversation
    const userMessage = { 
      role: 'user', 
      content: message,
      id: generateUniqueId()
    };
    
    addMessageToConversation(userMessage);
    setMessage('');
    resetTextareaHeight();
    setIsLoading(true);
    
    try {
      // Get current conversation messages
      const currentConvo = conversations.find(c => c.id === currentConversationId) || { messages: [] };
      const messages = [...currentConvo.messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          systemPrompt,
          apiKey, // This can be empty, and the server will use env variable
          model: isOpenRouter && isCustomModel(selectedModel) ? customOpenRouterModel : selectedModel,
          apiEndpoint: isCustomEndpoint || isOpenRouter ? apiEndpoint : undefined,
          isOpenRouter
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // If we didn't provide an API key but got a successful response,
        // we must be using the environment variable
        if (!apiKey.trim()) {
          setUsingEnvApiKey(true);
        }
        
        // Add AI response to conversation
        addMessageToConversation({
          role: 'assistant',
          content: data.message,
          id: generateUniqueId()
        });
      } else {
        console.error('Error from API:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Get formatted date for timestamps
  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to generate a unique message ID
  const generateUniqueId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `msg-${timestamp}-${random}`;
  };

  // Modified addMessageToConversation to include timestamp and unique ID
  const addMessageToConversation = (message) => {
    const messageWithMetadata = {
      ...message,
      timestamp: message.timestamp || getFormattedDate(),
      id: message.id || generateUniqueId()
    };
    
    setConversations(prevConversations => {
      const conversationIndex = prevConversations.findIndex(c => c.id === currentConversationId);
      
      if (conversationIndex >= 0) {
        // Update existing conversation
        const updatedConversations = [...prevConversations];
        updatedConversations[conversationIndex] = {
          ...updatedConversations[conversationIndex],
          messages: [...updatedConversations[conversationIndex].messages, messageWithMetadata]
        };
        return updatedConversations;
      } else {
        // Create new conversation
        return [
          ...prevConversations, 
          { 
            id: currentConversationId, 
            messages: [messageWithMetadata],
            createdAt: getFormattedDate()
          }
        ];
      }
    });
  };

  const startNewConversation = () => {
    const newId = (parseInt(currentConversationId) + 1).toString();
    setCurrentConversationId(newId);
  };

  const switchConversation = (id) => {
    setCurrentConversationId(id);
  };

  const startEditingMessage = (message) => {
      setEditingMessageId(message.id);
      setEditedContent(message.content);
  };

  const saveEditedMessage = () => {
    if (!editingMessageId) return;

    setConversations(prevConversations => {
      return prevConversations.map(convo => {
        if (convo.id !== currentConversationId) return convo;
        
        const updatedMessages = convo.messages.map(msg => {
          if (msg.id === editingMessageId) {
            return { 
              ...msg, 
              content: editedContent,
              edited: true, 
              editedAt: getFormattedDate() 
            };
          }
          return msg;
        });
        
        return { ...convo, messages: updatedMessages };
      });
    });
    
    setEditingMessageId(null);
    setEditedContent('');
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedContent('');
  };

  // Export conversations to JSONL format for fine-tuning
  const exportConversations = () => {
    // Create JSONL content
    let jsonlContent = "";
    
    conversations.forEach(convo => {
      // Group messages by conversation
      const messages = convo.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add the conversation as a JSONL entry
      jsonlContent += JSON.stringify({ messages }) + "\n";
    });
    
    // Create a blob and download link
    const blob = new Blob([jsonlContent], { type: 'application/jsonl;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'rayen-ai-training-data.jsonl');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export conversations in JSON format compatible with fine-tuning
  const exportJSON = () => {
    const formattedData = conversations.map(convo => {
      return {
        id: convo.id,
        messages: convo.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };
    });
    
    const jsonString = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'rayen-ai-training-data.json');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get current conversation
  const currentConversation = conversations.find(c => c.id === currentConversationId) || { id: currentConversationId, messages: [] };

  // Helper function to get a truncated preview of the conversation
  const getConversationPreview = (conversation) => {
    if (!conversation.messages || conversation.messages.length === 0) {
      return 'Empty conversation';
    }
    
    // Get the first user message, or any message if there's no user message
    const firstUserMessage = conversation.messages.find(msg => msg.role === 'user');
    const message = firstUserMessage || conversation.messages[0];
    
    // Truncate message if it's too long
    const maxLength = 30;
    const content = message.content;
    return content.length > maxLength 
      ? content.substring(0, maxLength) + '...' 
      : content;
  };

  // Helper function to get message count for a conversation
  const getMessageCount = (conversation) => {
    return conversation.messages ? conversation.messages.length : 0;
  };

  // Delete a conversation
  const deleteConversation = (id) => {
    setConversations(prevConversations => 
      prevConversations.filter(c => c.id !== id)
    );
    
    // If we deleted the current conversation, switch to another one
    if (id === currentConversationId) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        startNewConversation();
      }
    }
    
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  // Delete a message from a conversation
  const deleteMessage = (messageId) => {
    setConversations(prevConversations => {
      return prevConversations.map(convo => {
        if (convo.id !== currentConversationId) return convo;
        
        return {
          ...convo,
          messages: convo.messages.filter(msg => msg.id !== messageId)
        };
      });
    });
    
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  // Confirm before deletion
  const confirmDelete = (type, id) => {
    setItemToDelete({ type, id });
    setShowDeleteConfirm(true);
  };

  // Cancel deletion
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  // Export conversations to CSV format
  const exportCSV = () => {
    // Create CSV content
    let csvContent = "Conversation ID,Role,Content\n";
    
    conversations.forEach(convo => {
      convo.messages.forEach(msg => {
        // Escape quotes in the message content and wrap in quotes
        const safeContent = msg.content.replace(/"/g, '""');
        csvContent += `${convo.id},"${msg.role}","${safeContent}"\n`;
      });
    });
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'rayen-ai-training-data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle import button click
  const openImportModal = () => {
    setShowImportModal(true);
  };

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check file size (limit to 5MB to prevent browser freezing)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert(`File is too large. Maximum size is 5MB. Please select a smaller file or split your data.`);
        e.target.value = '';
        return;
      }

      // Check file extension
      const fileExt = file.name.split('.').pop().toLowerCase();
      if (!['jsonl', 'json', 'txt'].includes(fileExt)) {
        alert('Please select a .jsonl, .json or .txt file');
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
    }
  };

  // Import JSONL file
  const importJSONL = async () => {
    if (!selectedFile) {
      alert('Please select a file to import');
      return;
    }

    try {
      const fileContent = await selectedFile.text();
      
      // First, try to parse the entire file as a single JSON object/array
      try {
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();
        
        if (fileExt === 'json') {
          // Try parsing as a single JSON object or array
          const jsonData = JSON.parse(fileContent.trim());
          
          // Handle array of messages
          if (Array.isArray(jsonData) && jsonData.some(item => item.role && item.content)) {
            const validData = [{ messages: jsonData }];
            processImportData(validData);
            return;
          }
          
          // Handle array of input_text/output_text pairs
          if (Array.isArray(jsonData) && jsonData.some(item => item.input_text && item.output_text)) {
            const convertedData = jsonData
              .filter(item => item.input_text && item.output_text)
              .map(item => {
                const messages = [
                  { role: 'user', content: item.input_text },
                  { role: 'assistant', content: item.output_text }
                ];
                // Pass through any ID field if present to allow grouping
                if (item.id || item.conversation_id || item.convo_id) {
                  return { 
                    id: item.id || item.conversation_id || item.convo_id,
                    messages 
                  };
                }
                return { messages };
              });
            
            if (convertedData.length > 0) {
              processImportData(convertedData);
              return;
            }
          }
          
          // Handle array of conversation objects
          if (Array.isArray(jsonData) && jsonData.some(item => item.messages || item.conversations)) {
            const validData = jsonData
              .filter(item => item.messages || item.conversations)
              .map(item => {
                if (item.messages) return item;
                
                // Convert from custom format
                if (item.conversations) {
                  const messages = item.conversations.map(conv => ({
                    role: conv.from === 'human' ? 'user' : 'assistant',
                    content: conv.value
                  }));
                  return { messages };
                }
                
                return null;
              })
              .filter(item => item !== null);
              
            if (validData.length > 0) {
              processImportData(validData);
              return;
            }
          }
        }
      } catch (e) {
        // If parsing as single JSON fails, continue with line-by-line parsing
        console.log('Single JSON parse failed, trying line-by-line', e);
      }
      
      // Process line by line (JSONL format)
      const lines = fileContent.trim().split('\n');
      
      // Check if this looks like a formatted JSON array with line breaks
      const isFormattedJsonArray = (
        lines[0]?.trim().startsWith('[') && 
        lines[lines.length-1]?.trim().endsWith(']')
      );
      
      if (isFormattedJsonArray) {
        // Try parsing the entire content as a single JSON array
        try {
          const jsonArray = JSON.parse(fileContent.trim());
          
          if (Array.isArray(jsonArray)) {
            // Handle array of input_text/output_text pairs
            if (jsonArray.some(item => item.input_text && item.output_text)) {
              const convertedData = jsonArray
                .filter(item => item.input_text && item.output_text)
                .map(item => {
                  const messages = [
                    { role: 'user', content: item.input_text },
                    { role: 'assistant', content: item.output_text }
                  ];
                  // Pass through any ID field if present to allow grouping
                  if (item.id || item.conversation_id || item.convo_id) {
                    return { 
                      id: item.id || item.conversation_id || item.convo_id,
                      messages 
                    };
                  }
                  return { messages };
                });
              
              if (convertedData.length > 0) {
                processImportData(convertedData);
                return;
              }
            }
            
            // Other array formats can be handled here
          }
        } catch (e) {
          console.error('Error parsing formatted JSON array:', e);
        }
      }
      
      // If we get here, proceed with line-by-line JSONL parsing
      // Process each line as a JSON object
      const importedData = lines.map(line => {
        try {
          // Skip empty lines and lines that are just brackets, braces, or commas
          const trimmedLine = line.trim();
          if (!trimmedLine || 
              trimmedLine === '[' || 
              trimmedLine === ']' || 
              trimmedLine === '{' || 
              trimmedLine === '}' ||
              trimmedLine === ',' ||
              trimmedLine.startsWith('"') && trimmedLine.endsWith(',') ||
              trimmedLine.startsWith('}') && trimmedLine.endsWith(',')) {
            return null;
          }
          
          // Handle lines that might be part of a formatted JSON
          // Try to fix common issues with partial JSON lines
          let jsonLine = trimmedLine;
          
          // If line starts with a property name
          if (jsonLine.startsWith('"') && !jsonLine.includes('{')) {
            jsonLine = `{${jsonLine}}`;
            // If it ends with a comma, remove it
            if (jsonLine.endsWith(',}')) {
              jsonLine = jsonLine.replace(',}', '}');
            }
          }
          
          return JSON.parse(jsonLine);
        } catch (err) {
          console.error('Error parsing line:', line, err);
          return null;
        }
      }).filter(item => item !== null);
      
      if (importedData.length === 0) {
        alert('No valid data found in the file');
        return;
      }
      
      // Check if importedData contains valid messages structure
      const validData = importedData.filter(item => 
        item.messages && Array.isArray(item.messages) && item.messages.length > 0
      );
      
      if (validData.length === 0) {
        // Try alternative format
        const altFormatData = [];
        
        for (const item of importedData) {
          // Check if this is an array of messages directly
          if (Array.isArray(item) && item.some(m => m.role && m.content)) {
            altFormatData.push({ messages: item });
          } 
          // Check if this has a 'conversations' field
          else if (item.conversations && Array.isArray(item.conversations)) {
            // Convert from the format with 'human' and 'gpt' to OpenAI format
            const messages = item.conversations.map(conv => ({
              role: conv.from === 'human' ? 'user' : 'assistant',
              content: conv.value
            }));
            
            if (messages.length > 0) {
              altFormatData.push({ messages });
            }
          }
          // Check for input_text/output_text format
          else if (item.input_text && item.output_text) {
            const messages = [
              { role: 'user', content: item.input_text },
              { role: 'assistant', content: item.output_text }
            ];
            // Pass through any ID field if present to allow grouping
            if (item.id || item.conversation_id || item.convo_id) {
              altFormatData.push({ 
                id: item.id || item.conversation_id || item.convo_id,
                messages 
              });
            } else {
              altFormatData.push({ messages });
            }
          }
        }
        
        // If still no valid data and it's a formatted JSON array, try manual extraction
        if (altFormatData.length === 0 && isFormattedJsonArray) {
          // Try manual object extraction for input_text/output_text pairs
          const extractedObjects = [];
          let currentObject = null;
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Start of a new object
            if (trimmedLine === '{') {
              currentObject = {};
            } 
            // End of current object
            else if (trimmedLine === '}' || trimmedLine === '},') {
              if (currentObject && currentObject.input_text && currentObject.output_text) {
                const messageObj = {
                  messages: [
                    { role: 'user', content: currentObject.input_text },
                    { role: 'assistant', content: currentObject.output_text }
                  ]
                };
                
                // Add conversation ID if found
                if (currentObject.id || currentObject.conversation_id || currentObject.convo_id) {
                  messageObj.id = currentObject.id || currentObject.conversation_id || currentObject.convo_id;
                }
                
                extractedObjects.push(messageObj);
              }
              currentObject = null;
            } 
            // Process key-value pairs
            else if (currentObject && trimmedLine.startsWith('"') && trimmedLine.includes(':')) {
              const colonPos = trimmedLine.indexOf(':');
              const key = trimmedLine.substring(1, colonPos - 1).trim(); // Extract key without quotes
              
              let value = trimmedLine.substring(colonPos + 1).trim();
              // Remove trailing comma if present
              if (value.endsWith(',')) {
                value = value.substring(0, value.length - 1);
              }
              
              // Handle JSON string values properly
              try {
                // First try to parse the value as JSON
                if (value.startsWith('"')) {
                  // Parse the value as a JSON string to handle escapes properly
                  value = JSON.parse(value);
                }
              } catch (err) {
                // If parsing fails, try to clean up the string manually
                console.error('Error parsing value:', value, err);
                
                // Remove surrounding quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                  value = value.substring(1, value.length - 1);
                }
                
                // Replace escaped quotes with actual quotes
                value = value.replace(/\\"/g, '"');
              }
              
              // Track all fields that might be useful
              if (key === 'input_text' || key === 'output_text' || 
                  key === 'id' || key === 'conversation_id' || key === 'convo_id') {
                currentObject[key] = value;
              }
            }
          }
          
          if (extractedObjects.length > 0) {
            processImportData(extractedObjects);
            return;
          }
        }
        
        if (altFormatData.length === 0) {
          alert('No valid conversation data found in the file. Please ensure it contains messages in one of the supported formats.');
          return;
        }
        
        // Use the alternative format data
        validData.push(...altFormatData);
      }

      processImportData(validData);
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error importing file: ' + error.message);
    }
  };
  
  // Process the imported data
  const processImportData = (validData) => {
    try {
      if (importTarget === 'new') {
        // Group conversations by ID if they have one
        const groupedData = validData.reduce((groups, item) => {
          // If the conversation has a defined ID, use it for grouping
          const conversationId = item.id || null;
          
          if (conversationId) {
            if (!groups[conversationId]) {
              groups[conversationId] = [];
            }
            groups[conversationId].push(item);
          } else {
            // If no ID, treat it as a separate conversation
            // Use a unique key for these to avoid merging unrelated conversations
            const randomId = `unidentified-${Math.random().toString(36).substring(2, 9)}`;
            groups[randomId] = [item];
          }
          
          return groups;
        }, {});

        // Create a new conversation for each group
        const existingIds = conversations.map(c => parseInt(c.id) || 0);
        let nextId = Math.max(...existingIds, 0) + 1;
        
        const newConversations = [];
        
        Object.entries(groupedData).forEach(([groupId, items]) => {
          // If groupId is a number and not an "unidentified" random ID
          // we use that as conversation ID if it doesn't already exist
          const existingConvo = conversations.find(c => c.id === groupId);
          
          const isNumericGroupId = !isNaN(parseInt(groupId)) && !groupId.startsWith('unidentified');
          const newId = isNumericGroupId && !existingConvo ? groupId : (nextId++).toString();
          
          // Collect system message from any of the conversations in the group
          let systemMessageContent = null;
          const allMessages = [];
          
          // Process all items in the group
          items.forEach(item => {
            const systemMessage = item.messages.find(m => m.role === 'system');
            const otherMessages = item.messages.filter(m => m.role !== 'system');
            
            // Set system prompt if found
            if (systemMessage && !systemMessageContent) {
              systemMessageContent = systemMessage.content;
              setSystemPrompt(systemMessage.content);
            }
            
            // Format messages with IDs and timestamps
            const formattedMessages = otherMessages.map(m => ({
              role: m.role,
              content: m.content,
              id: generateUniqueId(),
              timestamp: getFormattedDate()
            }));
            
            allMessages.push(...formattedMessages);
          });
          
          // Check if we need to append to existing conversation or create new one
          if (existingConvo) {
            setConversations(prev => prev.map(convo => 
              convo.id === existingConvo.id 
                ? { ...convo, messages: [...convo.messages, ...allMessages] }
                : convo
            ));
          } else {
            // Create a new conversation with all messages from this group
            newConversations.push({
              id: newId,
              messages: allMessages,
              createdAt: getFormattedDate()
            });
          }
        });
        
        if (newConversations.length > 0) {
          setConversations(prev => [...prev, ...newConversations]);
          
          // Switch to the first new conversation
          setCurrentConversationId(newConversations[0].id);
        }
        
        // Display success message
        const totalConvos = newConversations.length + 
          Object.values(groupedData)
            .filter(items => conversations.some(c => c.id === items[0].id))
            .length;

        const totalMessages = newConversations.reduce((sum, convo) => sum + convo.messages.length, 0) + 
          Object.values(groupedData)
            .filter(items => conversations.some(c => c.id === items[0].id))
            .flat()
            .reduce((sum, item) => sum + item.messages.filter(m => m.role !== 'system').length, 0);
        
        if (totalConvos > 0) {
          alert(`Import successful! ${
            newConversations.length > 0 ? `Created ${newConversations.length} new conversation${newConversations.length !== 1 ? 's' : ''}` : ''
          }${
            Object.values(groupedData).some(items => conversations.some(c => c.id === items[0].id)) 
              ? `${newConversations.length > 0 ? ' and ' : ''}Updated existing conversation${
                Object.values(groupedData).filter(items => conversations.some(c => c.id === items[0].id)).length !== 1 ? 's' : ''}`
              : ''
          } with ${totalMessages} message${totalMessages !== 1 ? 's' : ''}.`);
        }
      } else {
        // Add to current conversation
        const allMessages = validData.flatMap(item => 
          item.messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role,
            content: m.content,
            id: generateUniqueId(),
            timestamp: getFormattedDate()
          }))
        );
        
        setConversations(prev => 
          prev.map(convo => 
            convo.id === currentConversationId
              ? { 
                  ...convo, 
                  messages: [...convo.messages, ...allMessages] 
                }
              : convo
          )
        );
        
        // Display success message
        alert(`Import successful! Added ${allMessages.length} message${allMessages.length !== 1 ? 's' : ''} to the current conversation.`);
      }
      
      // Close modal and reset
      setShowImportModal(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error processing import data:', error);
      alert('Error processing import data: ' + error.message);
    }
  };

  // Handle textarea auto-grow
  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    
    // Auto-adjust height
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };
  
  // Reset textarea height when message is sent
  const resetTextareaHeight = () => {
    const textarea = document.getElementById('messageInput');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  };

  // Add regenerate message function
  const regenerateMessage = async (assistantMessageId) => {
    setRegeneratingMessageId(assistantMessageId);

    // Check if invalid API key is selected
    if (selectedModel === 'invalid-api-key') {
      alert('Please enter a valid API key in settings.');
      setRegeneratingMessageId(null);
      return;
    }

    // Check if OpenRouter is selected but no API key is provided
    if (isOpenRouter && !apiKey.trim()) {
      alert('OpenRouter requires an API key. Please enter your API key in settings.');
      setRegeneratingMessageId(null);
      return;
    }

    // Check if OpenRouter custom model is selected but empty
    if (isOpenRouter && isCustomModel(selectedModel) && !customOpenRouterModel.trim()) {
      alert('Please enter an other model identifier in settings.');
      setRegeneratingMessageId(null);
      return;
    }

    // Only check for restricted models when using env API key
    if (!isOpenRouter && !apiKey && selectedModel.includes('gpt-4.5')) {
      alert('GPT-4.5 models are restricted and cannot be used with the environment API key. Please select a different model in Settings.');
      setRegeneratingMessageId(null);
      return;
    }

    // Find the assistant message to regenerate
    const currentConvo = conversations.find(c => c.id === currentConversationId);
    if (!currentConvo) return;

    const assistantIndex = currentConvo.messages.findIndex(msg => msg.id === assistantMessageId);
    if (assistantIndex <= 0) return;

    const userMessage = currentConvo.messages[assistantIndex - 1];
    if (userMessage.role !== 'user') return;

    setIsLoading(true);

    try {
      // Get messages up to the user message
      const messages = currentConvo.messages.slice(0, assistantIndex).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          systemPrompt,
          apiKey,
          model: isOpenRouter && isCustomModel(selectedModel) ? customOpenRouterModel : selectedModel,
          apiEndpoint: isCustomEndpoint || isOpenRouter ? apiEndpoint : undefined,
          isOpenRouter
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the assistant message with the new response
        setConversations(prev => prev.map(convo => {
          if (convo.id !== currentConversationId) return convo;
          
          const updatedMessages = [...convo.messages];
          updatedMessages[assistantIndex] = {
            role: 'assistant',
            content: data.message,
            id: generateUniqueId(),
            timestamp: getFormattedDate()
          };
          
          return { ...convo, messages: updatedMessages };
        }));
      } else {
        console.error('Error from API:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error regenerating message:', error);
      alert('Error regenerating message: ' + error.message);
    } finally {
      setIsLoading(false);
      setRegeneratingMessageId(null);
    }
  };

  // Add Google Sheets export function
  const exportToGoogleSheets = async () => {
    if (!submitterName.trim()) {
      setShowNamePrompt(true);
      return;
    }

    try {
      // Set loading state
      setIsExporting(true);
      
      // Prepare data for export
      const exportData = conversations.map(convo => {
        return convo.messages.map(msg => ({
          conversationId: convo.id,
          speaker: msg.role === 'user' ? 'user' : 'riko',
          message: msg.content
        }));
      }).flat();

      // Send data to our API endpoint
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: exportData,
          submitterName
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to export to Google Sheets');
      }
      
      // Close modals first (better UX than showing alert while modal is open)
      setShowExportModal(false);
      setShowNamePrompt(false);
      setSubmitterName('');
      
      // Show success message after modals are closed
      setTimeout(() => {
        alert(`Successfully exported ${result.updatedRows || 'data'} to Google Sheets!`);
      }, 100);
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      
      // Show error message
      setTimeout(() => {
        alert('Error exporting to Google Sheets: ' + error.message);
      }, 100);
    } finally {
      // Reset loading state
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container} data-sidebar-hidden={!isSidebarVisible ? "true" : "false"}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button 
            className={styles.menuButton} 
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            aria-label="Toggle sidebar"
          >
            {isSidebarVisible ? '◀' : '▶'}
          </button>
          <h1>
            <span className={styles.logoIcon}>✨</span> 
            {isMobile ? 'Rayen AI' : 'Rayen AI Training Data'}
        </h1>
        </div>
        <div className={styles.exportButtons}>
          <button 
            className={styles.exportButton} 
            onClick={() => setShowSettingsModal(true)}
            aria-label="Settings"
          >
            <span>⚙️</span> {!isMobile && 'Settings'}
          </button>
          <button 
            className={styles.exportButton} 
            onClick={openImportModal}
          >
            <span>📥</span> {!isMobile && 'Import JSONL'}
          </button>
          <button 
            className={styles.exportButton} 
            onClick={() => setShowExportModal(true)}
          >
            <span>📤</span> Export
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {isSidebarVisible && (
          <aside className={styles.sidebar}>
            <h2>
              <span className={styles.sidebarIcon}>💬</span> 
              Conversations
            </h2>
          <div className={styles.conversationList}>
              {conversations.map(conversation => (
                <div 
                  key={conversation.id}
                  className={conversation.id === currentConversationId 
                    ? styles.activeConversation 
                    : styles.conversationButton
                  }
                >
                  <div 
                    className={styles.conversationContent}
                    onClick={() => {
                      switchConversation(conversation.id);
                      if (isMobile) {
                        setIsSidebarVisible(false);
                      }
                    }}
              >
                <div className={styles.conversationHeader}>
                      <span>Conversation {conversation.id}</span>
                      <div className={styles.conversationActions}>
                        <span className={styles.messageCount}>
                          {getMessageCount(conversation)}
                        </span>
                        <button 
                          className={styles.deleteConvoButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete('conversation', conversation.id);
                          }}
                          aria-label="Delete conversation"
                        >
                          🗑️
                        </button>
                      </div>
                </div>
                <div className={styles.conversationPreview}>
                      {getConversationPreview(conversation)}
                </div>
                  <div className={styles.conversationTime}>
                      {conversation.createdAt || getFormattedDate()}
                  </div>
                  </div>
                </div>
            ))}
          </div>
            <button 
              className={styles.newConversationButton} 
              onClick={() => {
                startNewConversation();
                if (isMobile) {
                  setIsSidebarVisible(false);
                }
              }}
            >
              <span>➕</span> New Conversation
          </button>
          </aside>
        )}

        <div className={styles.chatContainer}>
          <div className={styles.messages}>
            {currentConversation && currentConversation.messages.length > 0 ? (
              <table className={styles.messageTable}>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Content</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentConversation.messages.map(msg => (
                    <tr 
                      key={msg.id} 
                      className={msg.role === 'user' ? styles.userRow : styles.assistantRow}
                    >
                      <td className={styles.speaker}>
                          <span className={styles.speakerIcon}>
                            {msg.role === 'user' ? '👤' : '🤖'}
                          </span>
                      </td>
                      <td>
                        {editingMessageId === msg.id ? (
                          <div className={styles.editContainer}>
                            <textarea
                              className={styles.editTextarea}
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              autoFocus
                            />
                            <div className={styles.editButtons}>
                              <button onClick={saveEditedMessage}>Save</button>
                              <button onClick={cancelEditing}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.messageText}>
                            {msg.content}
                            {msg.edited && (
                              <span className={styles.editedIndicator} title={`Edited on ${msg.editedAt}`}>
                                (edited)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={styles.messageTime}>
                        {msg.timestamp || getFormattedDate()}
                      </td>
                      <td className={styles.messageActions}>
                        <button 
                          className={styles.editButton} 
                          onClick={() => startEditingMessage(msg)}
                          aria-label="Edit message"
                        >
                          ✏️
                        </button>
                        {msg.role === 'assistant' && (
                          <button
                            className={styles.regenButton}
                            onClick={() => regenerateMessage(msg.id)}
                            disabled={isLoading || regeneratingMessageId === msg.id}
                            aria-label="Regenerate response"
                          >
                            {regeneratingMessageId === msg.id ? '⌛' : '🔄'}
                          </button>
                        )}
                        <button 
                          className={styles.deleteButton}
                          onClick={() => confirmDelete('message', msg.id)}
                          aria-label="Delete message"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyMessages}>
                <div className={styles.emptyMessagesIcon}>💬</div>
                <h3>No messages yet</h3>
                <p>Start a conversation by typing a message below.</p>
              </div>
            )}
            
            {isLoading && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingText}>
                  <div className={styles.loadingDot}></div>
                  <div className={styles.loadingDot}></div>
                  <div className={styles.loadingDot}></div>
                </div>
              </div>
            )}
          </div>

          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <textarea
              id="messageInput"
              className={styles.messageInput}
              placeholder="Type your message here..."
              value={message}
              onChange={handleTextareaChange}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button 
              className={styles.sendButton} 
              type="submit" 
              disabled={!message.trim() || isLoading}
            >
              <span>📤</span> Send
            </button>
          </form>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>
                Confirm Delete
              </h3>
              <p className={styles.modalText}>
                {itemToDelete?.type === 'conversation' 
                  ? 'Are you sure you want to delete this entire conversation?' 
                  : 'Are you sure you want to delete this message?'}
              </p>
              <div className={styles.modalButtons}>
                <button 
                  className={styles.deleteConfirmButton}
                  onClick={() => {
                    if (itemToDelete?.type === 'conversation') {
                      deleteConversation(itemToDelete.id);
                    } else {
                      deleteMessage(itemToDelete.id);
                    }
                  }}
                >
                  Delete
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={cancelDelete}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import modal */}
        {showImportModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>
                Import JSONL Conversations
              </h3>
              <div className={styles.modalContent}>
                <p className={styles.modalText}>
                  Upload a file containing conversations in one of these formats:
                </p>
                <ul className={styles.formatList}>
                  <li>
                    <strong>OpenAI JSONL</strong>: Each line contains a JSON object with a &quot;messages&quot; array of role/content pairs
                  </li>
                  <li>
                    <strong>JSON Array</strong>: An array of messages with role/content pairs
                  </li>
                  <li>
                    <strong>Custom JSON</strong>: JSON with &quot;conversations&quot; containing &quot;human&quot;/&quot;gpt&quot; pairs
                  </li>
                  <li>
                    <strong>Input/Output Pairs</strong>: JSON array with &quot;input_text&quot; and &quot;output_text&quot; fields
                  </li>
                </ul>
                
                <div className={styles.fileUploadContainer}>
                  <label className={styles.fileInputLabel}>
                    <div className={styles.uploadIcon}>📂</div>
                    <div className={styles.uploadText}>
                      {selectedFile ? 
                        `Selected: ${selectedFile.name}` : 
                        'Click to select a file or drag and drop'
                      }
                    </div>
                    <input 
                      type="file"
                      accept=".jsonl,.json,.txt"
                      onChange={handleFileChange}
                      className={styles.fileInput}
                      ref={fileInputRef}
                    />
                  </label>
                  <div className={styles.supportedFormats}>
                    Supported formats: .jsonl, .json, .txt
                  </div>
                </div>
                
                <div className={styles.importOptions}>
                  <label className={styles.radioLabel}>
                    <input 
                      type="radio" 
                      name="importTarget"
                      value="new"
                      checked={importTarget === 'new'}
                      onChange={() => setImportTarget('new')}
                    />
                    Create new conversation(s)
                  </label>
                  <label className={styles.radioLabel}>
                    <input 
                      type="radio" 
                      name="importTarget"
                      value="current"
                      checked={importTarget === 'current'}
                      onChange={() => setImportTarget('current')}
                      disabled={!currentConversation}
                    />
                    Add to current conversation
                  </label>
                </div>
              </div>

              <div className={styles.modalButtons}>
                <button 
                  className={styles.primaryButton}
                  onClick={importJSONL}
                  disabled={!selectedFile}
                >
                  Import
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export modal */}
        {showExportModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>
                Export Conversations
              </h3>
              <div className={styles.modalContent}>
                <p className={styles.modalText}>
                  Choose an export format:
                </p>
                <div className={styles.exportOptions}>
                  <button 
                    className={styles.exportOptionButton}
                    onClick={() => {
                      setShowExportModal(false);
                      setTimeout(() => {
                        exportConversations();
                      }, 100);
                    }}
                  >
                    <span>📄</span> Export as JSONL
                  </button>
                  <button 
                    className={styles.exportOptionButton}
                    onClick={() => {
                      setShowExportModal(false);
                      setTimeout(() => {
                        exportJSON();
                      }, 100);
                    }}
                  >
                    <span>⚙️</span> Export JSON
                  </button>
                  <button 
                    className={styles.exportOptionButton}
                    onClick={() => {
                      setShowExportModal(false);
                      setTimeout(() => {
                        exportCSV();
                      }, 100);
                    }}
                  >
                    <span>📊</span> Export CSV
                  </button>
                  <button 
                    className={styles.exportOptionButton}
                    onClick={() => {
                      setShowExportModal(false);
                      setShowNamePrompt(true);
                    }}
                  >
                    <span>📑</span> Export to Google Sheets
                  </button>
                </div>
              </div>
              <div className={styles.modalButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Name prompt modal */}
        {showNamePrompt && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>
                Enter Your Name
              </h3>
              <div className={styles.modalContent}>
                <p className={styles.modalText}>
                  Please enter your name to be credited in the Google Sheet:
                </p>
                <input
                  type="text"
                  className={styles.systemPromptInput}
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className={styles.modalButtons}>
                <button 
                  className={styles.primaryButton}
                  onClick={exportToGoogleSheets}
                  disabled={!submitterName.trim() || isExporting}
                >
                  {isExporting ? 'Loading...' : 'Export'}
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowNamePrompt(false);
                    setSubmitterName('');
                  }}
                  disabled={isExporting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings modal */}
        {showSettingsModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>
                Settings
              </h3>
              <div className={styles.modalContent}>
                <div className={styles.settingsGroup}>
                  <label htmlFor="systemPrompt" className={styles.settingsLabel}>
                    System Prompt
                  </label>
                  <textarea
                    id="systemPrompt"
                    className={styles.settingsTextarea}
                    placeholder="Define the assistant's behavior..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className={styles.settingsGroup}>
                  <label htmlFor="selectedModel" className={styles.settingsLabel}>
                    Model
                  </label>
                  <select
                    id="selectedModel"
                    className={styles.settingsSelect}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels ? (
                      <option value="">Loading models...</option>
                    ) : availableModels.length > 0 ? (
                      availableModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.id === 'custom' ? 'Other...' : 
                           model.id === 'invalid-api-key' ? 'Invalid API Key' : 
                           model.id}
                        </option>
                      ))
                    ) : (
                      <option value="">No models available</option>
                    )}
                  </select>
                  {modelError && (
                    <div className={styles.modelWarning}>
                      {modelError}
                    </div>
                  )}
                  {selectedModel === 'invalid-api-key' && !modelError && (
                    <div className={styles.modelWarning}>
                      Unable to fetch models. Please check your API key or try again later.
                    </div>
                  )}
                  {!apiKey && selectedModel.includes('gpt-4.5') && (
                    <div className={styles.modelWarning}>
                      GPT-4.5 models are restricted when using the environment API key.
                    </div>
                  )}
                </div>
                
                {/* Custom model input field that appears when "Other..." is selected */}
                {console.log('Debug - selectedModel:', selectedModel, 'isOpenRouter:', isOpenRouter, 'Type:', typeof selectedModel)}
                {isOpenRouter && 
                  (selectedModel === 'custom' || 
                   selectedModel.toString().toLowerCase().trim() === 'custom' ||
                   selectedModel === 'other' ||
                   selectedModel.toString().toLowerCase().trim() === 'other') && (
                  <div className={styles.settingsGroup}>
                    <label htmlFor="customOpenRouterModel" className={styles.settingsLabel}>
                      Other Model Identifier
                    </label>
                    <input
                      id="customOpenRouterModel"
                      type="text"
                      className={styles.settingsInput}
                      placeholder="e.g. anthropic/claude-3-opus-20240229"
                      value={customOpenRouterModel}
                      onChange={(e) => setCustomOpenRouterModel(e.target.value)}
                    />
                    <div className={styles.settingHint}>
                      Enter a valid OpenRouter model identifier, including the provider prefix
                    </div>
                  </div>
                )}
                
                <div className={styles.settingsGroup}>
                  <label className={styles.settingsLabel}>
                    {isOpenRouter ? 'OpenRouter API Key' : 'OpenAI API Key'}
                    {!isOpenRouter && usingEnvApiKey && <span className={styles.envKeyIndicator}>Using ENV</span>}
                  </label>
                  <input
                    type="password"
                    className={styles.settingsInput}
                    placeholder={isOpenRouter ? "Your OpenRouter API Key (required)" : "Your OpenAI API Key (optional if set in env)"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (e.target.value.trim()) {
                        setUsingEnvApiKey(false);
                      }
                    }}
                  />
                  {isOpenRouter && (
                    <div className={styles.modelWarning}>
                      OpenRouter requires an API key. Environment variables are not supported.
                    </div>
                  )}
                </div>
                
                <div className={styles.settingsGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={isOpenRouter}
                      onChange={(e) => {
                        setIsOpenRouter(e.target.checked);
                        if (e.target.checked) {
                          setApiEndpoint('https://openrouter.ai/api/v1');
                          setIsCustomEndpoint(false);
                        } else {
                          setApiEndpoint('https://api.openai.com/v1');
                        }
                      }}
                    />
                    Use OpenRouter API
                  </label>
                  {isOpenRouter && (
                    <div className={styles.settingHint}>
                      OpenRouter provides access to various LLMs through a unified API
                    </div>
                  )}
                </div>
                
                {!isOpenRouter && (
                  <div className={styles.settingsGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isCustomEndpoint}
                        onChange={(e) => setIsCustomEndpoint(e.target.checked)}
                      />
                      Use custom API endpoint
                    </label>
                  </div>
                )}
                
                {isCustomEndpoint && (
                  <div className={styles.settingsGroup}>
                    <label htmlFor="apiEndpoint" className={styles.settingsLabel}>
                      API Endpoint URL
                    </label>
                    <input
                      id="apiEndpoint"
                      type="text"
                      className={styles.settingsInput}
                      placeholder="https://api.openai.com/v1"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div className={styles.modalButtons}>
                <button 
                  className={styles.primaryButton}
                  onClick={saveSettings}
                >
                  Save
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowSettingsModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
