import React, { useEffect, useRef, useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Patient } from '@/lib/types';
import { Microphone as Mic, PaperPlaneTilt as Send, BookOpen, Sparkle as Sparkles, WaveSine as Waves, Plus, Upload, X, CheckCircle, XCircle, Stethoscope, ArrowUpRight } from '@phosphor-icons/react';
import Mark from '@/components/brand/Mark';
import MarkLoader from '@/components/brand/MarkLoader';
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
      <div className="mt-2 rounded-md border border-critical-line bg-critical-soft p-3">
        <h4 className="label-caps mb-1 !text-critical">The chart did not load</h4>
        <p className="text-sm text-critical">
          Failed to load image: <code>{imageId}</code>
        </p>
      </div>
    );
  }
  
  return (
    <div className="mt-3 rounded-md border border-border bg-card p-3">
      <h4 className="label-caps mb-2">Chart</h4>
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

// Questions a visitor can start from.
const ADVISOR_SUGGESTIONS = [
  'A patient on warfarin was just started on glyburide. What should I check?',
  'First-line management of migraine without aura in a 46-year-old',
  'Which labs should follow-up include for AML in complete remission?',
];

function ToggleChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] transition-colors [&_svg]:size-4',
        active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-well',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function AdvisorView() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: uuidv4(), role: "system", content: "Ask a clinical question" }]);
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
      <ContentSurface fullBleed>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-8 pb-56">
            {messages.length <= 1 ? (
              <div className="pt-[8vh]">
                <Mark size={30} className="text-ink" />
                <h1 className="title-display mt-5 text-[2rem] sm:text-[2.5rem]">Ask a clinical question</h1>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">
                  Answers draw on clinical guidelines and, when you attach one with <span className="whitespace-nowrap">+</span>, a patient&apos;s chart.
                  It can run Python to chart a patient&apos;s labs.
                </p>
                <ul className="mt-8 divide-y divide-border border-y border-border">
                  {ADVISOR_SUGGESTIONS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                        className="row-link flex w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm text-ink"
                      >
                        {q}
                        <ArrowUpRight size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {messages.map((msg) => {
              if (msg.role === 'system') return null;
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-well px-4 py-3 text-[0.9375rem] text-ink sm:max-w-[75%]">
                      {typeof msg.content === 'string' ? msg.content : null}
                    </div>
                  </div>
                );
              }
              if (msg.role !== 'assistant' || typeof msg.content !== 'object') return null;
              const content = msg.content as AssistantMessageContent;
              const waiting = msg.isStreaming && (content.content?.length ?? 0) === 0;
              return (
                <article key={msg.id} className="text-[0.9375rem] leading-relaxed text-ink">
                  <p className="label-caps mb-2 flex items-center gap-2">
                    <Mark size={12} /> Answer
                  </p>
                  <AssistantMessageRenderer
                    assistantMessage={content}
                    isStreaming={msg.isStreaming}
                    markdownRootDiv={markdownRootsRef.current[msg.id]}
                    onGuidelineReferenceClick={handleGuidelineReferenceClick}
                  />
                  {waiting && isSending ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <MarkLoader size={16} className="text-ink" /> {thinkMode ? 'Reasoning' : 'Writing'}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        {voiceMode && (
          <div className="glass-backdrop fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 text-center">
            <MarkLoader size={56} className="mb-6 text-ink" />
            <p className="mb-4 font-display text-2xl">Ask your question aloud</p>
            <Button variant="secondary" iconLeft={<X />} onClick={() => setVoiceMode(false)}>Exit voice mode</Button>
          </div>
        )}
      </ContentSurface>
      {mounted && createPortal(
        <div
          className="pointer-events-none fixed bottom-3 flex justify-center px-3 sm:bottom-5 sm:px-6"
          style={{
            left: 'var(--actual-sidebar-width, 0rem)',
            width: 'calc(100% - var(--actual-sidebar-width, 0rem))',
            transition: 'left 0.2s ease, width 0.2s ease',
          }}
        >
          <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-1 rounded-xl border border-input bg-card px-3 pb-2 pt-2.5 shadow-float">
            <label htmlFor="advisor-input" className="sr-only">Your question</label>
            <Textarea
              id="advisor-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={includePapers
                ? "Ask, and recent research papers will be searched too"
                : thinkMode
                ? "Reasoning mode: for harder questions"
                : "Ask a clinical question"}
              rows={1}
              className="max-h-32 min-h-[2.5rem] resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-1 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ height: 'auto', minHeight: '2.5rem' }}
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

            {showSuggestion && suggestedSpecialty && (
              <div className="flex items-center gap-3 rounded-md border border-info/30 bg-info-soft px-3 py-2">
                <Stethoscope className="h-4 w-4 shrink-0 text-info" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-sm text-ink">
                  Suggested specialty for this patient: <span className="font-medium">{suggestedSpecialty}</span>
                </p>
                <Button size="sm" variant="ghost" onClick={handleApplySuggestion} className="h-7 px-2" iconLeft={<CheckCircle />}>Apply</Button>
                <Button size="icon" variant="ghost" onClick={handleDismissSuggestion} className="h-7 w-7" aria-label="Dismiss suggestion"><XCircle /></Button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <SpecialtyDropdown selectedSpecialty={selectedSpecialty} onSpecialtyChange={setSelectedSpecialty} disabled={isSending} />
                <ToggleChip active={includePapers} onClick={() => setIncludePapers((v) => !v)} icon={<BookOpen />} label="Papers" />
                <ToggleChip active={thinkMode} onClick={() => setThinkMode((v) => !v)} icon={<Sparkles />} label="Think" />
              </div>

              <div className="flex min-w-0 items-center gap-1">
                {selectedPatientForContext && (
                  <span className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border border-border bg-well py-0.5 pl-2.5 pr-1 text-xs text-ink">
                    <span className="truncate">{selectedPatientForContext.name || `${selectedPatientForContext.firstName ?? ''} ${selectedPatientForContext.lastName ?? ''}`.trim() || selectedPatientForContext.id}</span>
                    <button type="button" className="rounded-full p-0.5 hover:bg-card" onClick={() => setSelectedPatientForContext(null)} aria-label="Remove the patient's chart">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Attach a patient's chart or a file">
                      <Plus />
                    </Button>
                  </DropdownMenuTrigger>
                  <PatientSelectionDropdown onPatientSelect={handlePatientSelectForContext} onFileUpload={handleFileUpload} />
                </DropdownMenu>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,application/msword,text/plain"
                  multiple={false}
                  className="hidden"
                  onChange={handleFileChange}
                />
                {!voiceMode && typeof window !== "undefined" &&
                  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                    <Button size="icon" variant={dictating ? "default" : "ghost"} onClick={toggleDictation} className="h-8 w-8" aria-label={dictating ? 'Stop dictation' : 'Dictate'} aria-pressed={dictating}>
                      <Mic />
                    </Button>
                  )}
                {input.trim().length > 0 ? (
                  <Button size="icon" onClick={() => handleSend()} disabled={isSending} className="h-8 w-8" aria-label="Send">
                    <Send />
                  </Button>
                ) : (
                  <Button size="icon" variant={voiceMode ? "default" : "ghost"} onClick={() => setVoiceMode((v) => !v)} className="h-8 w-8" aria-label="Voice mode" aria-pressed={voiceMode}>
                    <Waves />
                  </Button>
                )}
              </div>
            </div>
            <p className="hidden px-1.5 text-[0.6875rem] text-muted-foreground sm:block">Enter to send · Shift+Enter for a new line</p>
          </div>
        </div>,
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
    h1: ({node, ...props}: any) => <h1 className="font-display text-2xl font-normal my-3" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="font-display text-xl font-normal my-3" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="label-caps !text-ink mt-4 mb-1" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 my-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 my-2" {...props} />,
    p: ({node, ...props}: any) => <p className="my-2" {...props} />,
    table: ({node, ...props}: any) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm" {...props} /></div>,
    thead: ({node, ...props}: any) => <thead className="border-b border-ink/60" {...props} />,
    th: ({node, ...props}: any) => <th className="label-caps px-2 py-1.5 text-left" {...props} />,
    td: ({node, ...props}: any) => <td className="border-b border-border px-2 py-1.5" {...props} />,
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
          <pre className="data-mono my-2 overflow-x-auto rounded-md bg-well p-3 text-sm" {...props}>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      }
      
      // Inline code
      return <code className="data-mono rounded bg-well px-1 text-[0.875em]" {...props}>{children}</code>;
    },
  };

  // Common rendering for tool outputs
  const renderToolOutputs = () => (
    <>
      {/* Hide code execution blocks - users only want to see results */}
      {assistantMessage.codeInterpreterTableData ? (
        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <h4 className="label-caps mb-2">Table</h4>
          <DataTable
            columns={assistantMessage.codeInterpreterTableData.columns as ColumnDef<unknown, any>[]}
            data={assistantMessage.codeInterpreterTableData.data}
          />
        </div>
      ) : assistantMessage.codeInterpreterOutputText && (
        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <h4 className="label-caps">Output</h4>
          <pre className="data-mono mt-2 overflow-x-auto rounded bg-well p-2 text-xs">{assistantMessage.codeInterpreterOutputText}</pre>
        </div>
      )}
      {assistantMessage.chartLoading && !assistantMessage.codeInterpreterImageId && (
        <div className="mt-3 rounded-md border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <MarkLoader size={16} className="text-ink" />
            <span className="text-sm text-muted-foreground">Drawing the chart</span>
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
        <div ref={containerRef} className="prose max-w-none" />
        {renderToolOutputs()}
        {renderGuidelineReferences()}
      </>
    );
  } else if (assistantMessage.finalMarkdown) {
    // Stream finished, render with ReactMarkdown (PRIORITY: final markdown over fallback)
    const cleanHtml = DOMPurify.sanitize(assistantMessage.finalMarkdown);
    
    return (
      <div className="prose max-w-none">
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
      <div className="prose max-w-none">
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
          <div className="mb-2 text-sm text-muted-foreground">
            {assistantMessage.heartbeatMessage}
          </div>
        )}
        {/* Optional: could show a generic "Assistant is working..." or specific tool call indicators */}
        {/* For now, tool outputs will cover this if they arrive before markdown */}
        {renderToolOutputs()}
        {renderGuidelineReferences()}
        {/* Show pulsing if no tool output yet and no heartbeat */}
        {!assistantMessage.toolCode && !assistantMessage.codeInterpreterOutputText && !assistantMessage.codeInterpreterImageId && !assistantMessage.heartbeatMessage && (
            <div className="text-sm text-muted-foreground">Thinking</div>
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
         <div className="text-sm text-muted-foreground">Writing</div>
      )}
    </div>
  );
};