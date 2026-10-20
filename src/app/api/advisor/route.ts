import { NextRequest } from "next/server";
import OpenAI from "openai";
import { supabaseDataService } from "@/lib/supabaseDataService";
import { searchGuidelines } from "@/services/guidelines/search-service";
import { Specialty } from "@/types/guidelines";
import { AIModelType } from "@/types/ai-models";

// The advisor: streams an answer from OpenAI's Responses API as server-sent
// events, with Code Interpreter for charts and tables. The client renders the
// Markdown (sanitised with DOMPurify) and fetches charts from ./image.

// Enhanced system prompt for OpenAI Code Interpreter with Clinical Guidelines
const baseSystemPrompt = `You are Foresight, an AI medical advisor for US physicians. Your responses should be comprehensive, empathetic, and formatted in clear, easy-to-read GitHub-flavored Markdown. Use headings, lists, bolding, and other Markdown features appropriately to structure your answer for optimal readability. Avoid overly technical jargon where simpler terms suffice, but maintain medical accuracy.

**CLINICAL GUIDELINES INTEGRATION**: You have access to evidence-based clinical guidelines from authoritative sources including USPSTF, NICE, NCI PDQ, and RxNorm. When relevant to the clinical question or patient scenario:

1. **Reference Clinical Guidelines**: Cite relevant guidelines with their source, grade/strength of recommendation, and publication date
2. **Evidence-Based Recommendations**: Provide specific recommendations based on clinical guidelines when applicable
3. **Screening Guidelines**: Reference appropriate screening recommendations for preventive care
4. **Drug Guidelines**: Include medication recommendations, contraindications, and interactions based on RxNorm data
5. **Specialty Guidelines**: Reference specialty-specific guidelines when relevant to the clinical scenario

When data analysis, tables, or charts would enhance your medical explanation or are explicitly requested:

1. **Automatic Chart/Table Generation**: Use the code_interpreter tool to create visualizations automatically. When you generate charts or tables, they will be displayed directly to the physician without requiring additional steps.

**IMPORTANT**: Even when the user doesn't explicitly request visualizations, you should proactively create relevant charts or tables when:
- Patient data contains time-series information (lab results, vital signs, medication history)
- Multiple diagnoses or treatments can be compared
- Clinical trends or patterns would be medically significant
- A timeline of clinical events would aid understanding
Choose the most appropriate visualization type (timeline charts, comparison tables, trend graphs, etc.) based on the clinical data available.

2. **Data Requirements**: 
   - Utilize the provided patient context FIRST (see 'Current Patient Information' section above if present)
   - If the necessary data for a clinically relevant visualization is not available, clearly state what specific data points you need
   - Do NOT invent patient data - always work with real data provided or create educational examples when appropriate

3. **Chart Guidelines**:
   - Create clear, professional medical visualizations with high visual quality
   - Use appropriate chart types (line charts for trends, bar charts for comparisons, scatter plots for correlations)
   - Include descriptive titles, axis labels, and legends
   - Use professional color schemes suitable for medical documentation
   - **Important**: Filter out empty/null dates and focus only on actual data points to avoid sparse timelines
   - Set appropriate figure sizes (figsize=(12, 6) minimum) for clarity
   - Use proper date formatting and smart date ranges (avoid showing empty periods)
   - Always explain the medical significance of the visualization

4. **Table Guidelines**:
   - Structure data clearly with appropriate headers
   - Include relevant medical units and reference ranges where applicable
   - Sort or organize data in clinically meaningful ways
   - Explain the clinical significance of the data patterns

5. **Code Interpreter Usage**:
   - Use Python with matplotlib, pandas, seaborn, and numpy as needed
   - Create professional-quality visualizations with proper styling
   - **Performance**: Keep data processing efficient - focus on the most relevant clinical data points
   - Filter data intelligently to avoid empty periods in timelines
   - Use datetime parsing and proper date ranges for time-based charts
   - Return structured data for tables when appropriate
   - Always provide clear medical interpretation of the results

When responding to general medical queries:
1. Provide evidence-based information
2. Include relevant medical context and differential diagnoses when appropriate
3. Suggest appropriate next steps or follow-up care
4. Use clear, professional language that respects both the physician's expertise and patient welfare
5. When in doubt, recommend consultation with specialists or additional testing
6. **Always reference relevant clinical guidelines when applicable**

Remember: You are assisting qualified medical professionals, not providing direct patient care. Charts and tables you create will be automatically displayed to enhance clinical understanding.`;

// Made on first request, so that building the app does not need the key.
let openai: OpenAI | null = null;
const getOpenAI = () => (openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

async function enrichWithGuidelines(query: string, patientData?: any, specialty?: Specialty): Promise<string> {
  try {
    // Extract medical terms and conditions for guideline search
    const searchTerms = extractMedicalTerms(query, patientData);
    
    if (searchTerms.length === 0) {
      return '';
    }

    // Search for relevant guidelines
    const guidelines = await searchGuidelines({
      query: searchTerms.join(' '),
      specialty: specialty,
      limit: 5,
      searchType: 'combined'
    });

    if (guidelines.length === 0) {
      return '';
    }

    // Format guidelines for inclusion in system prompt
    const guidelinesText = guidelines.map(guideline => {
      const metadata = guideline.metadata || {};
      return `**${metadata.source || 'Unknown'} Guideline**: ${metadata.title || 'Untitled'}
- **Grade/Strength**: ${metadata.grade || 'Not specified'}
- **Specialty**: ${metadata.specialty || 'General Medicine'}
- **Content Preview**: ${guideline.content?.substring(0, 300) + '...' || 'No content available'}
- **Similarity Score**: ${Math.round(guideline.similarity * 100)}%
---`;
    }).join('\n');

    return `

## Relevant Clinical Guidelines

The following evidence-based clinical guidelines are relevant to this query:

${guidelinesText}

Please incorporate these guidelines into your response where appropriate, citing the source and strength of recommendations.

---

`;
  } catch (error) {
    console.error('Error enriching with guidelines:', error);
    return '';
  }
}

function extractMedicalTerms(query: string, patientData?: any): string[] {
  const terms: string[] = [];
  
  // Extract from query
  const queryTerms = query.toLowerCase().match(/\b(diabetes|hypertension|cancer|screening|vaccination|cholesterol|depression|anxiety|obesity|smoking|alcohol|cardiovascular|cardiac|pulmonary|renal|hepatic|endocrine|neurological|psychiatric|dermatology|oncology|pediatric|geriatric|emergency|surgery|anesthesia|radiology|pathology|laboratory|pharmacy|medication|drug|treatment|therapy|diagnosis|prevention|guidelines|recommendations)\b/g);
  if (queryTerms) {
    terms.push(...queryTerms);
  }

  // Extract from patient data if available
  if (patientData) {
    // Look for conditions, medications, etc.
    const patientStr = JSON.stringify(patientData).toLowerCase();
    const patientTerms = patientStr.match(/\b(diabetes|hypertension|cancer|cholesterol|depression|anxiety|obesity|cardiovascular|cardiac|pulmonary|renal|hepatic|endocrine|neurological|psychiatric)\b/g);
    if (patientTerms) {
      terms.push(...patientTerms);
    }
  }

  // Remove duplicates
  return [...new Set(terms)];
}

export async function GET(req: NextRequest) {
  const requestAbortController = new AbortController();
  req.signal.addEventListener('abort', () => {
    requestAbortController.abort();
  }, { once: true });

  try {
    const url = new URL(req.url);
    const payloadParam = url.searchParams.get("payload");
    const patientId = url.searchParams.get("patientId");
    const specialty = url.searchParams.get("specialty");
    let messagesFromClient: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
    let patientSummaryBlock: string = ""; 

    if (!payloadParam) {
      if (!requestAbortController.signal.aborted) requestAbortController.abort();
      return new Response(JSON.stringify({ error: "Payload missing." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const parsedPayload = JSON.parse(payloadParam);
      if (!Array.isArray(parsedPayload.messages) || parsedPayload.messages.length === 0) {
        throw new Error("Messages array is missing or empty in payload.");
      }
      messagesFromClient = parsedPayload.messages;

      // If patientId is provided, fetch complete patient data
      if (patientId) {
        try {
  
          const completePatientData = await supabaseDataService.getPatientData(patientId);
          
          if (completePatientData && completePatientData.patient) {
            // Format comprehensive patient data for clinical context
            const patientInfo = completePatientData.patient;
            const encounters = completePatientData.encounters || [];
            
            // Calculate age from dateOfBirth if available
            let ageText = 'Unknown';
            if (patientInfo.dateOfBirth) {
              try {
                const birthDate = new Date(patientInfo.dateOfBirth);
                const today = new Date();
                const age = today.getFullYear() - birthDate.getFullYear();
                ageText = `${age} years old`;
              } catch (e) {
                console.warn('Could not calculate age from dateOfBirth:', patientInfo.dateOfBirth);
              }
            }

            // Optimized clinical context - demographics, SOAP notes, and lab results (no transcripts)
            let clinicalContext = `### Patient Clinical Summary\n`;
            clinicalContext += `**Patient:** ${patientInfo.firstName} ${patientInfo.lastName} (ID: ${patientInfo.id})\n`;
            clinicalContext += `**Demographics:** ${ageText}, ${patientInfo.gender || 'Unknown gender'}\n`;
            if (patientInfo.dateOfBirth) clinicalContext += `**Date of Birth:** ${patientInfo.dateOfBirth}\n`;
            if (patientInfo.race) clinicalContext += `**Race:** ${patientInfo.race}\n`;
            if (patientInfo.ethnicity) clinicalContext += `**Ethnicity:** ${patientInfo.ethnicity}\n`;
            if (patientInfo.maritalStatus) clinicalContext += `**Marital Status:** ${patientInfo.maritalStatus}\n`;
            if (patientInfo.language) clinicalContext += `**Language:** ${patientInfo.language}\n`;
            
            // Only include SOAP notes from encounters (exclude soft-deleted)
            const activeEncounters = encounters.filter(enc => !enc.encounter.isDeleted);
            const allLabResults: any[] = [];
            
            if (activeEncounters.length > 0) {
              clinicalContext += `\n**Clinical Encounters (${activeEncounters.length} total):**\n`;
              activeEncounters.forEach(encounterWrapper => {
                const encounter = encounterWrapper.encounter;
                const date = encounter.scheduledStart.split('T')[0];
                clinicalContext += `\n**${date}: ${encounter.reasonDisplayText || encounter.reasonCode || 'General visit'}**\n`;
                
                // Include SOAP notes if available - check for rich content fields
                const hasSOAP = encounter.diagnosis_rich_content || encounter.treatments_rich_content;
                
                if (hasSOAP) {
                  // Extract SOAP-like content from rich content fields
                  if (encounter.diagnosis_rich_content) {
                    try {
                      const diagContent = typeof encounter.diagnosis_rich_content === 'string' 
                        ? JSON.parse(encounter.diagnosis_rich_content) 
                        : encounter.diagnosis_rich_content;
                      
                      if (diagContent.subjective || diagContent.objective || diagContent.assessment) {
                        if (diagContent.subjective) {
                          clinicalContext += `- **S:** ${diagContent.subjective}\n`;
                }
                        if (diagContent.objective) {
                          clinicalContext += `- **O:** ${diagContent.objective}\n`;
                        }
                        if (diagContent.assessment) {
                          clinicalContext += `- **A:** ${diagContent.assessment}\n`;
                        }
                      }
                    } catch (e) {
                      // Parsing failed, skip
                    }
                  }
                  
                  if (encounter.treatments_rich_content) {
                    try {
                      const treatContent = typeof encounter.treatments_rich_content === 'string' 
                        ? JSON.parse(encounter.treatments_rich_content) 
                        : encounter.treatments_rich_content;
                      
                      if (treatContent.plan) {
                        clinicalContext += `- **P:** ${treatContent.plan}\n`;
                      }
                    } catch (e) {
                      // Parsing failed, skip
                    }
                  }
                }
                
                // Collect lab results from this encounter
                allLabResults.push(...encounterWrapper.labResults);
              });
            }

            // Include lab results
            if (allLabResults.length > 0) {
              clinicalContext += `\n**Laboratory Results:**\n`;
              allLabResults.forEach(lab => {
                clinicalContext += `- ${lab.dateTime ? lab.dateTime.split('T')[0] : 'Unknown date'}: ${lab.name} = ${lab.value}`;
                if (lab.units) clinicalContext += ` ${lab.units}`;
                if (lab.referenceRange) clinicalContext += ` (Ref: ${lab.referenceRange})`;
                if (lab.flag) clinicalContext += ` [${lab.flag}]`;
                clinicalContext += `\n`;
              });
            }

            // Include clinical alerts
            if (patientInfo.alerts && patientInfo.alerts.length > 0) {
              clinicalContext += `\n**Active Clinical Alerts:**\n`;
              patientInfo.alerts.forEach(alert => {
                clinicalContext += `- ${alert.severity?.toUpperCase()}: ${alert.msg || 'No message'}\n`;
              });
            }

            clinicalContext += `\n**Chart Creation Instructions:** 
- When creating timeline charts, only plot actual encounter dates
- Use compact, focused date ranges that highlight actual clinical activity
- For medical timelines: focus on encounter dates and key clinical events
- Ensure charts are visually clean with proper spacing

**Analysis Instructions:** Provide focused medical insights based on the SOAP notes and demographics. Generate charts and tables for trends when clinically appropriate.\n\n--------------------\n\n`;
            
            patientSummaryBlock = clinicalContext;
          }
        } catch (error) {
          console.error("Failed to fetch patient data:", error);
          // Continue without patient data but log the error
        }
      }

      // Legacy support: Check for basic patient context in system messages
      if (!patientSummaryBlock && messagesFromClient.length > 0 && messagesFromClient[0].role === 'system') {
        try {
          const patientData = JSON.parse(messagesFromClient[0].content);
          if (patientData.patient) {
            const patientDetails = Object.entries(patientData.patient)
              .map(([key, value]) => {                
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return `- ${formattedKey}: ${value}`;
              })
              .join('\n'); 
            
            if (patientDetails) {
              patientSummaryBlock = `### Current Patient Information & Directives\nThis is the primary data for the current consultation. Analyze and use this information first. If specific data points are missing for a visualization YOU DEEM CLINICALLY RELEVANT, clearly state what is needed. Do not invent data.\n\n**Patient Summary:**\n${patientDetails}\n\n--------------------\n\n### Your Role and General Instructions\n`;
            }
            messagesFromClient.shift(); 
          }
        } catch (e) {
          console.warn("Could not parse patient context from system message:", e);
        }
      }
    } catch (e: any) {
      console.error("Failed to parse payload or invalid messages format:", e.message);
      if (!requestAbortController.signal.aborted) requestAbortController.abort();
      return new Response(JSON.stringify({ error: `Invalid payload: ${e.message}` }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // Update assistant instructions with patient context if available
    if (patientSummaryBlock) {

      // We'll add patient context as the first user message instead of system prompt
      messagesFromClient.unshift({ role: "user", content: patientSummaryBlock });
    }

    // Wrap everything inside a ReadableStream so we can choose strategy (chat vs assistant) and stream back to client quickly
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const isControllerClosedRef = { value: false };

        const closeControllerOnce = () => {
          if (!isControllerClosedRef.value) {
            isControllerClosedRef.value = true;
            try { controller.close(); } catch {/* ignore */}
          }
        };

        const mainAbortListener = () => { closeControllerOnce(); };
        requestAbortController.signal.addEventListener('abort', mainAbortListener, { once: true });

        if (requestAbortController.signal.aborted) {
          closeControllerOnce();
          requestAbortController.signal.removeEventListener('abort', mainAbortListener);
          return;
        }

        // One model, gpt-6-astra: OpenAI's most capable, and its model page lists
        // Code Interpreter among its tools. Think mode makes it reason harder.
        const thinkParamRaw = url.searchParams.get("think");
        const thinkMode = thinkParamRaw === "true"; // treat any value other than explicit 'true' as false

        const modelName = AIModelType.GPT_6_ASTRA;
        const reasoningEffort = thinkMode ? "high" : "low";
        console.log(`Advisor mode: ${thinkMode ? 'think' : 'non-think'}, using model: ${modelName} (${reasoningEffort} effort)`);

        try {
          // Enhanced system prompt for Code Interpreter
          const enhancedSystemPrompt = `${baseSystemPrompt}

CRITICAL INSTRUCTIONS FOR CHART GENERATION:
When the user asks for charts, visualizations, or visual summaries:
1. You MUST use the Python tool (code_interpreter) to generate actual charts
2. DO NOT output placeholder markdown images like ![Chart description]
3. Use matplotlib to create the visualization and save it
4. The generated chart will be automatically displayed to the user

Example: If asked for a timeline chart, write Python code like:
\`\`\`python
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime

# Create the data
dates = ['2025-05-24', '2025-06-09', '2025-06-17']
events = ['URI diagnosis', 'Headache presentation', 'RA diagnosis']

# Convert to datetime
dates = pd.to_datetime(dates)

# Create timeline
fig, ax = plt.subplots(figsize=(12, 6))
ax.scatter(dates, [1, 1, 1], s=100, c='blue')

for i, (date, event) in enumerate(zip(dates, events)):
    ax.annotate(event, (date, 1), xytext=(0, 20), 
                textcoords='offset points', ha='center')

ax.set_ylim(0.5, 1.5)
ax.set_xlabel('Date')
ax.set_title('Patient Clinical Timeline')
ax.grid(True, axis='x')
plt.tight_layout()
plt.savefig('timeline.png')
plt.show()
\`\`\``;

          // One streamed request to the Responses API (OpenAI shut the Assistants
          // API down on 2026-08-26). It sees the whole conversation, the patient
          // context included, and runs Python in a container when a chart helps.
          const send = (data: unknown) => {
            if (isControllerClosedRef.value) return;
            const payload = typeof data === "string" ? data : JSON.stringify(data);
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          };

          const input = messagesFromClient.map((m) => ({ role: m.role, content: m.content }));
          const containerIds = new Set<string>();

          const response = await getOpenAI().responses.create(
            {
              model: modelName,
              reasoning: { effort: reasoningEffort },
              instructions: enhancedSystemPrompt,
              input,
              tools: [{ type: "code_interpreter", container: { type: "auto" } }],
              stream: true,
            },
            { signal: requestAbortController.signal }
          );

          for await (const event of response) {
            if (requestAbortController.signal.aborted) break;
            switch (event.type) {
              case "response.output_text.delta":
                send({ content: event.delta });
                break;
              case "response.code_interpreter_call_code.delta":
                send({ type: "tool_code_chunk", language: "python", content: event.delta });
                break;
              case "response.output_item.done":
                if (event.item.type === "code_interpreter_call" && event.item.container_id) {
                  containerIds.add(event.item.container_id);
                }
                break;
              case "response.failed":
                throw new Error(event.response.error?.message || "The response failed");
              case "error":
                throw new Error(event.message || "The stream failed");
            }
          }

          // A chart the code saved is a file in its container: pass on its id.
          for (const containerId of containerIds) {
            for await (const file of getOpenAI().containers.files.list(containerId)) {
              if (/\.(png|jpe?g|gif|webp)$/i.test(file.path)) {
                send({ type: "code_interpreter_image_id", file_id: file.id, container_id: containerId });
              }
            }
          }

          send("[DONE]");
          closeControllerOnce();
        } catch (error: any) {
          if (requestAbortController.signal.aborted) {
            closeControllerOnce();
            return;
          }
          console.error('Advisor error:', {
            message: error.message,
            status: error.status,
            code: error.code,
            type: error.type
          });

          // Send error to client
          if (!isControllerClosedRef.value) {
            const errorData = `data: ${JSON.stringify({
              error: `API error: ${error.message || 'Failed to process request'}. Please try again.`
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
          }
          closeControllerOnce();
        }
      }
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
    });

  } catch (error: unknown) {
    let errorMessage = "An unexpected error occurred processing the request.";
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;
    if (!requestAbortController.signal.aborted) {
        requestAbortController.abort();
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
