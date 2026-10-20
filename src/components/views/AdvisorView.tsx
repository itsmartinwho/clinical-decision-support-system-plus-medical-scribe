import React, { useEffect, useRef, useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Patient } from '@/lib/types';
import { Microphone as Mic, PaperPlaneTilt as Send, BookOpen, Sparkle as Sparkles, WaveSine as Waves, Plus, Upload, X, CheckCircle, XCircle, Stethoscope } from '@phosphor-icons/react';
import { createPortal } from "react-dom";
import ContentSurface from '@/components/layout/ContentSurface';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, AssistantMessageContent } from '../advisor/chat-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { parser as smd_parser, default_renderer as smd_default_renderer, parser_write as smd_parser_write, parser_end as smd_parser_end } from '../advisor/streaming-markdown/smd';
import PatientSelectionDropdown from "@/components/advisor/PatientSelectionDropdown";
import SpecialtyDropdown from "@/components/advisor/SpecialtyDropdown";
import GuidelineReferences from "@/components/advisor/GuidelineReferences";
import GuidelineModal from "@/components/guidelines/GuidelineModal";
import { Specialty, GuidelineModalData } from '@/types/guidelines';
import { GuidelineReference } from '@/components/advisor/chat-types';
import { convertReferenceToModalData, isGuidelineBookmarked, toggleGuidelineBookmark } from '@/services/guidelines/guidelineModalService';
import { SpecialtySuggestionService } from '@/services/guidelines/specialtySuggestionService';
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { DataTable } from "@/components/ui/data-table"; // Added
import type { ColumnDef } from "@tanstack/react-table"; // Added
import Image from 'next/image';
import { ChartRenderer } from '@/components/advisor/chart-renderer';
// Removed old Pyodide-based chart and table renderers - now using OpenAI Code Interpreter

// Local types for Web Speech API to avoid 'any'
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

// NOTE: This component was created to fix a Next.js build warning (`@next/next/no-img-element`)
// It replaces the native `<img>` tag with Next's `<Image>` component, providing optimizations
// and proper error handling for dynamically generated charts.
const AssistantGeneratedImage = ({ imageId }: { imageId: string }) => {
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    console.error('Failed to load assistant image:', imageId);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/30 rounded">
        <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">Chart Loading Error</h4>
        <p className="text-sm text-red-700 dark:text-red-300">
          Failed to load image: <code>{imageId}</code>
        </p>
      </div>
    );
  }
  
  return (
    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
      <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Generated Chart/Visualization:</h4>
      {/* Using aspect-video as a sensible default for chart visualizations */}
      <div className="relative aspect-video w-full mt-1"> 
        <Image 
          src={`/api/advisor/image/${imageId}`}
          alt="Assistant generated chart or visualization"
          fill
          className="rounded border"
          style={{ objectFit: 'contain' }}
          onError={handleError}
        />
      </div>
    </div>
  );
};

export default function AdvisorView() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: uuidv4(), role: "system", content: "Ask Foresight" }]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  const userHasScrolledUpRef = useRef(userHasScrolledUp); // Ref to hold the latest userHasScrolledUp
  const [dictating, setDictating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [includePapers, setIncludePapers] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedPatientForContext, setSelectedPatientForContext] = useState<Patient | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty>('All');
  
  // Specialty suggestion state
  const [suggestedSpecialty, setSuggestedSpecialty] = useState<Specialty | null>(null);
  const [suggestionReason, setSuggestionReason] = useState<string>('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  // Guideline modal state
  const [guidelineModalData, setGuidelineModalData] = useState<GuidelineModalData | null>(null);
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Refs for streaming-markdown (one parser + root div per assistant message)
  const parsersRef = useRef<Record<string, any>>({});
  const markdownRootsRef = useRef<Record<string, HTMLDivElement>>({});
  const rawMarkdownAccumulatorRef = useRef<Record<string, string>>({}); // Added ref for accumulating raw markdown

  // Use a ref to store the ID of the current assistant message being streamed to.
  // This helps manage state updates correctly within the EventSource callbacks.
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-resize textarea when input changes programmatically
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
    }
  }, [input]);

  // Sync userHasScrolledUp state to ref
  useEffect(() => {
    userHasScrolledUpRef.current = userHasScrolledUp;
  }, [userHasScrolledUp]);

  const SCROLL_THRESHOLD = 1; // Pixels from bottom to consider "not at bottom" - Extremely sensitive

  // Re-enable user scroll effect: remove comment markers
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => { 
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceToBottom <= SCROLL_THRESHOLD;
      const newScrolledUpState = !atBottom;
      
      setUserHasScrolledUp(prevScrolledUp => prevScrolledUp !== newScrolledUpState ? newScrolledUpState : prevScrolledUp);
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }, []); // scrollRef.current is stable, so empty dependency array is fine.

  // Auto-scroll when messages change
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) {
      return;
    }

    const animationFrameId = requestAnimationFrame(() => {
      const lastMessage = messages[messages.length - 1];
      const assistantIsResponding = lastMessage && lastMessage.role === "assistant";

      // Only auto-scroll if the user hasn't manually scrolled up (checked via ref) AND the assistant is the one "typing".
      // Scrolling for new user messages is handled in handleSend.
      if (!userHasScrolledUpRef.current && assistantIsResponding) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" }); // Changed to 'auto' for immediacy
      }
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [messages]); // Now only depends on messages, reads userHasScrolledUp from ref

  // Voice dictation setup
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPart + " ";
            }
          }
          if (finalTranscript) {
            setInput((prev) => prev + finalTranscript);
          }
        };
      }
    }
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) return;
    if (!dictating) {
      recognitionRef.current.start();
    } else {
      recognitionRef.current.stop();
    }
    setDictating(!dictating);
  };

  const speak = (text: string) => {
    if (!voiceMode) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    let queryContent = input.trim();
    if (includePapers) queryContent += "\n\nInclude recent peer-reviewed medical papers.";

    // Prepare user message and assistant placeholder
    const userMessage: ChatMessage = { id: uuidv4(), role: "user", content: queryContent };
    const assistantId = uuidv4();
    currentAssistantMessageIdRef.current = assistantId;
    const markdownRootDiv = document.createElement('div');
    markdownRootsRef.current[assistantId] = markdownRootDiv;
    parsersRef.current[assistantId] = smd_parser(smd_default_renderer(markdownRootDiv));
    rawMarkdownAccumulatorRef.current[assistantId] = ""; // Initialize accumulator

    setMessages((prev) => [...prev, userMessage, {
      id: assistantId,
      role: "assistant",
      content: { isMarkdownStream: true } as AssistantMessageContent,
      isStreaming: true,
    }]);
    setInput("");
    setIsSending(true);
    setUserHasScrolledUp(false);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }
    });

    // Build payload with optional patient context, past messages, and new user message.
    const existingPayload = messages.reduce((acc, msg) => {
      if (msg.role === 'user' && typeof msg.content === 'string') {
        acc.push({ role: 'user' as const, content: msg.content });
      } else if (msg.role === 'assistant' && typeof msg.content === 'object') {
        // Attempt to get rendered text from the markdownRootDiv for previous assistant messages
        const rootDiv = markdownRootsRef.current[msg.id];
        if (rootDiv && rootDiv.innerText) {
          acc.push({ role: 'assistant' as const, content: rootDiv.innerText });
        } else if ((msg.content as AssistantMessageContent).isFallback && (msg.content as AssistantMessageContent).fallbackMarkdown) {
          // If it was a fallback, use that markdown
          acc.push({ role: 'assistant' as const, content: (msg.content as AssistantMessageContent).fallbackMarkdown! });
        } 
        // Optionally, add a placeholder if no content can be extracted, e.g.:
        // else { acc.push({ role: 'assistant' as const, content: "[Assistant provided a response]" }); }
      }
      return acc;
    }, [] as Array<{role: 'user' | 'assistant', content: string}>);

    // Insert patient context at the beginning if present
    const apiPayloadMessages = [] as Array<{role: 'system' | 'user' | 'assistant', content: string}>;
    if (selectedPatientForContext) {
      // Attach patient context as a system message
      apiPayloadMessages.push({
        role: 'system' as const,
        content: JSON.stringify({ patient: selectedPatientForContext }),
      });
    }
    // Append existing conversation history
    apiPayloadMessages.push(...existingPayload);
    // Add the current user's new message
    apiPayloadMessages.push({ role: 'user' as const, content: queryContent });

    // Build the API URL with patientId and specialty if available
    let apiUrl = `/api/advisor?payload=${encodeURIComponent(JSON.stringify({ messages: apiPayloadMessages }))}&think=${thinkMode}`;
    if (selectedPatientForContext?.id) {
      apiUrl += `&patientId=${encodeURIComponent(selectedPatientForContext.id)}`;
    }
    if (selectedSpecialty && selectedSpecialty !== 'All') {
      apiUrl += `&specialty=${encodeURIComponent(selectedSpecialty)}`;
    }
    
    const eventSource = new EventSource(apiUrl);
    console.log('EventSource created with URL:', apiUrl);

    eventSource.onmessage = (ev) => {
      console.log('SSE message received:', ev.data);
      
      // Gracefully handle the end of the stream
      if (ev.data === '[DONE]') {
        console.log('Stream ended with [DONE]');
        handleStreamEnd();
        eventSource.close();
        return;
      }

      try {
        const data = JSON.parse(ev.data);
        console.log('Parsed SSE data:', data);
        
        if (data.content) {
          console.log('Processing content:', data.content);
          resetStreamEndTimeout(); // Reset timeout on new content
          if (parsersRef.current[currentAssistantMessageIdRef.current!]) { // Check if parser exists
            smd_parser_write(parsersRef.current[currentAssistantMessageIdRef.current!], data.content);
          }
          if (currentAssistantMessageIdRef.current! in rawMarkdownAccumulatorRef.current) {
            rawMarkdownAccumulatorRef.current[currentAssistantMessageIdRef.current!] += data.content;
          }
        } else if (data.type === "tool_code_chunk" && currentAssistantMessageIdRef.current) {
          console.log('Processing tool_code_chunk:', data);
          setMessages(prev => prev.map(m => {
            if (m.id === currentAssistantMessageIdRef.current && typeof m.content === 'object') {
              const currentToolCode = (m.content as AssistantMessageContent).toolCode;
              return {
                ...m,
                content: {
                  ...(m.content as AssistantMessageContent),
                  toolCode: {
                    language: data.language,
                    content: currentToolCode?.content ? currentToolCode.content + data.content : data.content,
                  }
                }
              };
            }
            return m;
          }));
        } else if (data.type === "code_interpreter_output" && currentAssistantMessageIdRef.current) {
          console.log('Processing code_interpreter_output:', data);
          setMessages(prev => prev.map(m => {
            if (m.id === currentAssistantMessageIdRef.current && typeof m.content === 'object') {
              let parsedTableData = null;
              let outputFormat: 'json' | 'csv' | 'plaintext' = 'plaintext';
              let outputText = data.content; // Default to full content as text

              if (data.content && typeof data.content === 'string' &&
                  (data.content.trim().startsWith('[') && data.content.trim().endsWith(']'))) {
                try {
                  const jsonData = JSON.parse(data.content);
                  if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === 'object') {
                    const firstRowKeys = Object.keys(jsonData[0]);
                    const columns: ColumnDef<Record<string, any>>[] = firstRowKeys.map(key => ({
                      accessorKey: key,
                      header: key.charAt(0).toUpperCase() + key.slice(1),
                    }));
                    parsedTableData = { columns, data: jsonData };
                    outputFormat = 'json';
                    outputText = ""; // Clear outputText if table is successfully parsed
                  }
                } catch (e) {
                  // Not valid JSON or not the expected table structure, keep as plaintext
                  console.warn("Code interpreter output looked like JSON array but failed to parse as table:", e);
                }
              }

              const existingContent = m.content as AssistantMessageContent;
              return {
                ...m,
                content: {
                  ...existingContent,
                  codeInterpreterTableData: parsedTableData ? parsedTableData : existingContent.codeInterpreterTableData, // Preserve existing table if new data is not a table
                  codeInterpreterOutputFormat: parsedTableData ? outputFormat : existingContent.codeInterpreterOutputFormat || 'plaintext',
                  codeInterpreterOutputText: outputText ? (existingContent.codeInterpreterOutputText || "") + outputText : existingContent.codeInterpreterOutputText,
                }
              };
            }
            return m;
          }));

        } else if (data.type === "code_interpreter_code" && currentAssistantMessageIdRef.current) {
          // Handle code execution - show chart loading placeholder
          if (data.content && data.content.includes('plt.') || data.content.includes('matplotlib')) {
            setMessages(prev => prev.map(m => {
              if (m.id === currentAssistantMessageIdRef.current && typeof m.content === 'object') {
                const existingContent = m.content as AssistantMessageContent;
                return {
                  ...m,
                  content: {
                    ...existingContent,
                    chartLoading: true,
                    toolCode: { language: 'python', content: data.content }
                  }
                };
              }
              return m;
            }));
          }
        } else if (data.type === "code_interpreter_image" && currentAssistantMessageIdRef.current) {
          // Handle images generated by the assistant - remove loading state
          setMessages(prev => prev.map(m => {
            if (m.id === currentAssistantMessageIdRef.current && typeof m.content === 'object') {
              const existingContent = m.content as AssistantMessageContent;
              return {
                ...m,
                content: {
                  ...existingContent,
                  chartLoading: false,
                  codeInterpreterImageId: data.file_id
                }
              };
            }
            return m;
          }));
        } else if (data.type === "code_interpreter_image_id" && currentAssistantMessageIdRef.current) {
          console.log('Processing code_interpreter_image_id:', data);
          setMessages(prev => prev.map(m => {
            if (m.id === currentAssistantMessageIdRef.current && typeof m.content === 'object') {
              return {
                ...m,
                content: {
                  ...(m.content as AssistantMessageContent),
                  // A chart from the Responses API lives in a container
                  codeInterpreterImageId: data.container_id
                    ? `${data.file_id}?container_id=${encodeURIComponent(data.container_id)}`
                    : data.file_id,
                }
              };
            }
            return m;
          }));
        } else if (data.error) {
          console.error("SSE Error:", data.error);
          if (parsersRef.current[currentAssistantMessageIdRef.current!]) {
            smd_parser_end(parsersRef.current[currentAssistantMessageIdRef.current!]);
            delete parsersRef.current[currentAssistantMessageIdRef.current!];
          }
          setMessages(prev => prev.map(m => m.id === currentAssistantMessageIdRef.current ? { ...m, isStreaming: false, content: { ...(m.content as AssistantMessageContent), isFallback: true, fallbackMarkdown: `**Error:** ${data.error}` } } : m));
          setIsSending(false);
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE data", ev.data, err);
      }
    };

    // Handle natural end of stream
    const handleStreamEnd = () => {
      console.log('handleStreamEnd called');
      const assistantMessageId = currentAssistantMessageIdRef.current;
      if (assistantMessageId) {
        console.log('Processing stream end for message:', assistantMessageId);
        if (parsersRef.current[assistantMessageId]) {
          smd_parser_end(parsersRef.current[assistantMessageId]);
        }

        const accumulatedRawMarkdown = rawMarkdownAccumulatorRef.current[assistantMessageId] || "";
        console.log('Accumulated markdown:', accumulatedRawMarkdown);

        // Clean up refs for this specific message
        delete parsersRef.current[assistantMessageId];
        delete markdownRootsRef.current[assistantMessageId];
        delete rawMarkdownAccumulatorRef.current[assistantMessageId];

        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
          ? {
              ...m,
              isStreaming: false,
              content: {
                ...(m.content as AssistantMessageContent),
              isMarkdownStream: false,
              finalMarkdown: accumulatedRawMarkdown,
              }
            }
          : m
        ));
        setIsSending(false);
      }
    };

    // Use a timeout to detect when the stream has ended naturally
    let streamEndTimeout: NodeJS.Timeout;
    const resetStreamEndTimeout = () => {
      console.log('Resetting stream timeout');
      if (streamEndTimeout) clearTimeout(streamEndTimeout);
      streamEndTimeout = setTimeout(() => {
        // This logic is now a fallback, as [DONE] is the primary signal
        console.warn("Stream end timeout reached, forcing closure.");
        handleStreamEnd();
        eventSource.close();
      }, 5000); // 5 second timeout after last message
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      console.error("EventSource readyState:", eventSource.readyState);
      if (parsersRef.current[currentAssistantMessageIdRef.current!]) {
        smd_parser_end(parsersRef.current[currentAssistantMessageIdRef.current!]);
        delete parsersRef.current[currentAssistantMessageIdRef.current!];
      }
      setMessages(prev => prev.map(m => m.id === currentAssistantMessageIdRef.current ? { ...m, isStreaming: false, content: { ...(m.content as AssistantMessageContent), isFallback: true, fallbackMarkdown: "**Error:** Connection issue or stream interrupted." } } : m));
      setIsSending(false);
      eventSource.close();
    };

    eventSource.onopen = (event) => {
      console.log('EventSource connection opened:', event);
    };
  };

  // ESC key exits voice mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVoiceMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Implement file attachment state and UI similar to patient context
    }
  };

  const handlePatientSelectForContext = async (patient: Patient) => {
    // Set patient context attachment
    setSelectedPatientForContext(patient);
    // Close dropdown automatically handled by Radix on item click
    
    // Get specialty suggestion based on patient context
    try {
      const suggested = await SpecialtySuggestionService.suggestSpecialtyFromPatient(patient);
      const reason = await SpecialtySuggestionService.getSpecialtySuggestionReason(patient, suggested);
      
      // Only show suggestion if it's not the default/current selection
      if (suggested !== 'All' && suggested !== selectedSpecialty) {
        setSuggestedSpecialty(suggested);
        setSuggestionReason(reason);
        setShowSuggestion(true);
      } else {
        setShowSuggestion(false);
      }
    } catch (error) {
      console.error('Error getting specialty suggestion:', error);
      setShowSuggestion(false);
    }
  };

  // Specialty suggestion handlers
  const handleApplySuggestion = () => {
    if (suggestedSpecialty) {
      setSelectedSpecialty(suggestedSpecialty);
      setShowSuggestion(false);
    }
  };

  const handleDismissSuggestion = () => {
    setShowSuggestion(false);
  };

  // Guideline modal handlers
  const handleGuidelineReferenceClick = async (reference: GuidelineReference) => {
    try {
      const modalData = await convertReferenceToModalData(reference);
      const bookmarkStatus = await isGuidelineBookmarked(reference.id);
      
      setGuidelineModalData(modalData);
      setIsBookmarked(bookmarkStatus);
      setIsGuidelineModalOpen(true);
    } catch (error) {
      console.error('Error opening guideline modal:', error);
    }
  };

  const handleCloseGuidelineModal = () => {
    setIsGuidelineModalOpen(false);
    setGuidelineModalData(null);
  };

  const handleBookmarkToggle = async () => {
    if (!guidelineModalData) return;
    
    try {
      const newBookmarkStatus = await toggleGuidelineBookmark(guidelineModalData.id.toString());
      setIsBookmarked(newBookmarkStatus);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  return (
    <>
      <ContentSurface fullBleed className="">
        {/* Removed static header; using system message in chat */}

        {/* Using Radix ScrollArea now -  REPLACE with native scroll div */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 p-6 overflow-y-auto"
        >
          <div className="w-full max-w-5xl mx-auto space-y-6 pb-44"> {/* Centered to input box width */}
            {/* Temporary Debug Component */}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col items-start gap-2",
                  msg.role === "user" ? "items-end" : ""
                )}
              >
                <div
                  className={cn(
                    msg.role === "user"
                      ? "max-w-[66.666%] w-fit bg-neon/30 text-black p-6"
                      : msg.role === "assistant"
                      ? "max-w-full w-fit bg-white/90 text-gray-800 p-6"
                      : msg.role === "system"
                      ? "max-w-full w-fit bg-white/90 text-gray-800 p-6"
                      : "hidden",
                    "rounded-lg text-sm shadow-sm"
                  )}
                >
                  {msg.role === "user" && typeof msg.content === 'string' && msg.content}
                  {msg.role === "system" && typeof msg.content === 'string' && (
                    msg.content === "Ask Foresight" ? (
                      <div className="flex justify-center items-center">
                        <span className="bg-gradient-to-br from-custom-blue-teal to-white bg-clip-text text-transparent font-medium sheen">
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <span>{msg.content}</span>
                    )
                  )}
                  {msg.role === "assistant" && typeof msg.content === 'object' && (
                    <AssistantMessageRenderer 
                      assistantMessage={msg.content as AssistantMessageContent} 
                      isStreaming={msg.isStreaming} 
                      markdownRootDiv={markdownRootsRef.current[msg.id]}
                      onGuidelineReferenceClick={handleGuidelineReferenceClick}
                    />
                  )}
                  {/* Loading indicators */}
                  {msg.role === "assistant" && 
                   msg.isStreaming && 
                   typeof msg.content === 'object' && 
                   (((msg.content as AssistantMessageContent).content?.length ?? 0) === 0) && (
                    <> {/* Use a fragment to conditionally render one of the indicators */}
                      {thinkMode && (
                        <div className="animate-pulse">Thinking...</div>
                      )}
                      {!thinkMode && isSending && (
                        <div className="animate-pulse">Foresight is typing...</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Voice mode overlay */}
        {voiceMode && (
          <div className="fixed inset-0 z-[9999] glass-backdrop flex flex-col items-center justify-center text-center px-6">
            <div className="animate-pulse mb-6">
              <Waves className="h-16 w-16 text-teal-300" />
            </div>
            <p className="text-lg mb-4">Ask your question aloud</p>
            <Button variant="secondary" iconLeft={<X />} onClick={() => setVoiceMode(false)}>Exit voice mode</Button>
          </div>
        )}
      </ContentSurface>
      {mounted && createPortal(
        <>
          <div
            className="fixed bottom-4 flex justify-center px-6 pointer-events-none"
            style={{
              left: 'var(--actual-sidebar-width, 0rem)',
              width: 'calc(100% - var(--actual-sidebar-width, 0rem))',
              transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out',
            }}
          >
            <div
              className="w-full max-w-5xl bg-[rgba(255,255,255,0.35)] backdrop-blur-lg border border-white/25 rounded-2xl px-3 py-2 flex flex-col gap-0 pointer-events-auto shadow-lg"
            >
              {/* Textarea input */}
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={includePapers
                  ? "Ask anything, we'll look for recent research papers in the area"
                  : thinkMode
                  ? "Reasoning mode selected for your harder medical queries"
                  : "Ask anything"}
                rows={1}
                className="resize-none bg-transparent border-0 shadow-none outline-none ring-0 ring-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:ring-0 focus-visible:ring-transparent text-base px-2 py-1 min-h-[2.5rem] max-h-32 overflow-y-auto mb-2"
                style={{ 
                  height: 'auto',
                  minHeight: '2.5rem'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />

              {/* Specialty Suggestion Banner */}
              {showSuggestion && suggestedSpecialty && (
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 border border-teal-200 dark:border-teal-700 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-teal-900 dark:text-teal-100 truncate">
                        Suggested specialty based on patient profile: <span className="font-semibold">{suggestedSpecialty}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleApplySuggestion}
                        className="h-8 px-3 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-800"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDismissSuggestion}
                        className="h-8 w-8 p-0 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-800"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  {/* Specialty Filter Dropdown */}
                  <SpecialtyDropdown 
                    selectedSpecialty={selectedSpecialty}
                    onSpecialtyChange={setSelectedSpecialty}
                    disabled={isSending}
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={includePapers ? "default" : "ghost"}
                          size="icon"
                          onClick={() => setIncludePapers((v) => !v)}
                          className={cn(
                            "group",
                            includePapers && "w-auto px-3", // Active state
                            "hover:w-auto hover:px-3"     // Hover state
                          )}
                        >
                          <BookOpen className="h-4 w-4" />
                          <span className={cn("ml-2 whitespace-nowrap", includePapers ? "inline" : "hidden", "group-hover:inline")}>
                            Papers
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Papers</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={thinkMode ? "default" : "ghost"}
                          size="icon"
                          onClick={() => setThinkMode((v) => !v)}
                          className={cn(
                            "group",
                            thinkMode && "w-auto px-3", // Active state
                            "hover:w-auto hover:px-3"    // Hover state
                          )}
                        >
                          <Sparkles className="h-4 w-4" />
                          <span className={cn("ml-2 whitespace-nowrap", thinkMode ? "inline" : "hidden", "group-hover:inline")}>
                            Think
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Think</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex items-center gap-2">
                  {/* Patient context attachment tag */}
                  {selectedPatientForContext && (
                    <span className="inline-flex items-center bg-muted/20 text-step--1 rounded-full px-3 py-1">
                      {selectedPatientForContext.name || `${selectedPatientForContext.firstName ?? ''} ${selectedPatientForContext.lastName ?? ''}`.trim() || selectedPatientForContext.id}
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-2" onClick={() => setSelectedPatientForContext(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  )}
                  {/* Context and File Upload Dropdown */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "group",
                                "hover:w-auto hover:px-3" // Hover state only for this button
                              )}
                            >
                              <span className={cn("mr-2 whitespace-nowrap hidden group-hover:inline")}>
                                Attach
                              </span>
                              <Plus className="h-4 w-4 text-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <PatientSelectionDropdown
                            onPatientSelect={handlePatientSelectForContext}
                            onFileUpload={handleFileUpload}
                          />
                        </DropdownMenu>
                      </TooltipTrigger>
                      <TooltipContent><p>Attach</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Hidden File Input for onFileUpload handler */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,application/msword,text/plain"
                    multiple={false}
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {/* Dictation (if not in voice mode) */}
                  {!voiceMode && typeof window !== "undefined" &&
                    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant={dictating ? "default" : "ghost"}
                              onClick={toggleDictation}
                              className={cn(
                                "group",
                                dictating && "w-auto px-3", // Active state
                                "hover:w-auto hover:px-3"   // Hover state
                              )}
                            >
                              <span className={cn("mr-2 whitespace-nowrap", dictating ? "inline" : "hidden", "group-hover:inline")}>
                                Dictate
                              </span>
                              <Mic className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Dictate</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  {/* Voice or Send based on input */}
                  {input.trim().length > 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon" // Will be icon only initially
                            onClick={() => handleSend()}
                            disabled={isSending}
                            className={cn(
                              "group bg-gradient-to-br from-teal-500 to-cyan-500 hover:opacity-90 text-white",
                              "hover:w-auto hover:px-3" // Expands on hover
                            )}
                          >
                            <span className={cn("mr-2 whitespace-nowrap hidden group-hover:inline")}>
                              Send
                            </span>
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Send</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant={voiceMode ? "default" : "ghost"}
                            onClick={() => setVoiceMode((v) => !v)}
                            className={cn(
                              "group",
                              voiceMode && "w-auto px-3", // Active state
                              "hover:w-auto hover:px-3"  // Hover state
                            )}
                          >
                            <span className={cn("mr-2 whitespace-nowrap", voiceMode ? "inline" : "hidden", "group-hover:inline")}>
                              Voice Mode
                            </span>
                            <Waves className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Voice Mode</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Guideline Modal */}
      {guidelineModalData && (
        <GuidelineModal
          modalData={guidelineModalData}
          isOpen={isGuidelineModalOpen}
          onClose={handleCloseGuidelineModal}
          isBookmarked={isBookmarked}
          onBookmarkToggle={handleBookmarkToggle}
        />
      )}
    </>
  );
}

const AssistantMessageRenderer: React.FC<{ 
  assistantMessage: AssistantMessageContent, 
  isStreaming?: boolean, 
  markdownRootDiv?: HTMLDivElement,
  onGuidelineReferenceClick?: (reference: GuidelineReference) => void
}> = ({ assistantMessage, isStreaming, markdownRootDiv, onGuidelineReferenceClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    if (containerRef.current && markdownRootDiv) {
      // Clear previous children
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      containerRef.current.appendChild(markdownRootDiv);
    }
  }, [markdownRootDiv]);

  const handleReferenceClick = (target: string) => {
    const element = document.getElementById(target);
    if (element) {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        let urlToOpen = target;
        try {
          const urlObj = new URL(target);
          urlObj.searchParams.append('utm_source', 'foresight');
          urlObj.searchParams.append('utm_medium', 'inline_chat_reference');
          urlToOpen = urlObj.toString();
        } catch (e) {
          console.warn("Failed to append UTM codes to URL:", target, e);
        }
        window.open(urlToOpen, '_blank');
      } else {
        const footnoteElement = document.getElementById(`footnote-${target}`);
        footnoteElement?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Helper for custom components for ReactMarkdown
  const reactMarkdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold my-2" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-xl font-semibold my-2" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-lg font-medium my-2" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 my-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
    p: ({node, ...props}: any) => <p className="my-1" {...props} />,
    table: ({node, ...props}: any) => <table className="table-auto w-full my-2 border-collapse border border-gray-300 dark:border-gray-600" {...props} />,
    thead: ({node, ...props}: any) => <thead className="bg-gray-100 dark:bg-gray-800" {...props} />,
    th: ({node, ...props}: any) => <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left" {...props} />,
    td: ({node, ...props}: any) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1" {...props} />,
    code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match && match[1];
      const codeContent = String(children).replace(/\n$/, '');
      
      // Check if this is a Python code block containing matplotlib
      if (!inline && language === 'python' && (codeContent.includes('plt.') || codeContent.includes('matplotlib'))) {
        return (
          <ChartRenderer 
            pythonCode={codeContent}
            description="Generated visualization from AI response"
          />
        );
      }
      
      // Regular code block rendering
      if (!inline) {
        return (
          <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-2" {...props}>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      }
      
      // Inline code
      return <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm" {...props}>{children}</code>;
    },
  };

  // Common rendering for tool outputs
  const renderToolOutputs = () => (
    <>
      {/* Hide code execution blocks - users only want to see results */}
      {assistantMessage.codeInterpreterTableData ? (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Data Table ({assistantMessage.codeInterpreterOutputFormat}):</h4>
          <DataTable
            columns={assistantMessage.codeInterpreterTableData.columns as ColumnDef<unknown, any>[]}
            data={assistantMessage.codeInterpreterTableData.data}
          />
        </div>
      ) : assistantMessage.codeInterpreterOutputText && (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Code Output ({assistantMessage.codeInterpreterOutputFormat || 'plaintext'}):</h4>
          <pre className="text-xs overflow-x-auto bg-white dark:bg-gray-700 p-2 rounded mt-1">{assistantMessage.codeInterpreterOutputText}</pre>
        </div>
      )}
      {assistantMessage.chartLoading && !assistantMessage.codeInterpreterImageId && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Generating Chart/Visualization...</h4>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600 dark:text-blue-300">Creating visualization based on clinical data...</span>
          </div>
        </div>
      )}
      {assistantMessage.codeInterpreterImageId && (
        <AssistantGeneratedImage imageId={assistantMessage.codeInterpreterImageId} />
      )}
    </>
  );

  // Render guideline references if available
  const renderGuidelineReferences = () => (
    assistantMessage.guidelineReferences && assistantMessage.guidelineReferences.length > 0 ? (
      <GuidelineReferences 
        references={assistantMessage.guidelineReferences}
        onReferenceClick={onGuidelineReferenceClick}
      />
    ) : null
  );

  if (assistantMessage.isMarkdownStream && isStreaming && markdownRootDiv) {
    // Actively streaming with smd.js
    return (
      <>
        <div ref={containerRef} className="prose prose-sm max-w-none dark:prose-invert" />
        {renderToolOutputs()}
        {renderGuidelineReferences()}
      </>
    );
  } else if (assistantMessage.finalMarkdown) {
    // Stream finished, render with ReactMarkdown (PRIORITY: final markdown over fallback)
    const cleanHtml = DOMPurify.sanitize(assistantMessage.finalMarkdown);
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={reactMarkdownComponents}>
          {cleanHtml}
        </ReactMarkdown>
        
        {renderToolOutputs()}
        {renderGuidelineReferences()}
      </div>
    );
  } else if (assistantMessage.fallbackMarkdown) {
    // Fallback logic (only if no finalMarkdown)
    const cleanHtml = DOMPurify.sanitize(assistantMessage.fallbackMarkdown);
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={reactMarkdownComponents}>
          {cleanHtml}
        </ReactMarkdown>
        
        {renderToolOutputs()}
        {renderGuidelineReferences()}
      </div>
    );
  } else if (isStreaming) {
    // Still streaming but not yet using smd.js container (e.g. only tool calls so far)
    // or if markdownRootDiv is not yet available for some reason.
    return (
      <>
        {/* Show heartbeat message during processing */}
        {assistantMessage.heartbeatMessage && (
          <div className="animate-pulse text-blue-600 dark:text-blue-400 text-sm mb-2">
            {assistantMessage.heartbeatMessage}
          </div>
        )}
        {/* Optional: could show a generic "Assistant is working..." or specific tool call indicators */}
        {/* For now, tool outputs will cover this if they arrive before markdown */}
        {renderToolOutputs()}
        {renderGuidelineReferences()}
        {/* Show pulsing if no tool output yet and no heartbeat */}
        {!assistantMessage.toolCode && !assistantMessage.codeInterpreterOutputText && !assistantMessage.codeInterpreterImageId && !assistantMessage.heartbeatMessage && (
            <div className="animate-pulse">Thinking...</div>
        )}
      </>
    );
  }

  // Default/Empty case or non-markdown structured content (legacy, if any)
  // This also includes rendering tool outputs if the message is not streaming and has no markdown.
  return (
    <div>
      {(assistantMessage.content || []).map((element, index) => {
        return (
          <Fragment key={index}>
            {element.element === "paragraph" && <p className="mb-2">{element.text}</p>}
            {/* ... other legacy structured element rendering ... */}
          </Fragment>
        );
      })}
      {renderToolOutputs()}
      {renderGuidelineReferences()}
      
      {/* Tool outputs are now handled by OpenAI Code Interpreter */}
      
      {/* Loading indicator if nothing else is there but it's supposed to be streaming */}
      {isStreaming && !assistantMessage.finalMarkdown && !assistantMessage.fallbackMarkdown && (!assistantMessage.content || assistantMessage.content.length === 0) && !assistantMessage.toolCode && !assistantMessage.codeInterpreterOutputText && !assistantMessage.codeInterpreterImageId && (
         <div className="animate-pulse">Foresight is typing...</div>
      )}
    </div>
  );
};