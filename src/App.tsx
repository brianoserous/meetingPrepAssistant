/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  FileText, 
  Loader2, 
  Download, 
  AlertCircle, 
  CheckCircle2,
  FileUp,
  X,
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pricing constants for Gemini 3 Flash Lite (Approximate)
const INPUT_COST_PER_1M = 0.075;
const OUTPUT_COST_PER_1M = 0.30;

interface JiraTicket {
  task_name: string;
  assignee_suggestion: string;
  priority_level: string;
  due_date_estimate: string;
}

interface MeetingSummary {
  summary: string;
  risks: string[];
  talkingPoints: string[];
  jiraTickets: JiraTicket[];
  imagePrompt: string;
}

interface FileData {
  file: File;
  base64: string;
  mimeType: string;
}

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    await processFiles(selectedFiles);
  };

  const processFiles = async (selectedFiles: File[]) => {
    const newFiles: FileData[] = [];
    const unsupportedFiles: string[] = [];
    
    for (const file of selectedFiles) {
      // Gemini inlineData supports PDF and Text natively. 
      // Office docs (pptx, docx) are not supported as inlineData.
      const isSupported = file.type === 'application/pdf' || file.type.startsWith('text/');
      
      if (!isSupported) {
        unsupportedFiles.push(file.name);
        continue;
      }

      const base64 = await fileToBase64(file);
      newFiles.push({
        file,
        base64: base64.split(',')[1],
        mimeType: file.type || 'application/octet-stream'
      });
    }

    if (unsupportedFiles.length > 0) {
      setError(`Unsupported files: ${unsupportedFiles.join(', ')}. Please upload PDFs or Text files.`);
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateSummary = async () => {
    if (files.length === 0) {
      setError("Please upload at least one file.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSummary(null);
    setCoverImage(null);
    setCost(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // 1. Generate Text Summary
      const textModel = "gemini-flash-lite-latest";
      const prompt = `Analyze the provided documents (notes, slides, etc.) and generate a structured meeting intelligence report.
      
      Follow this exact structure:
      1. Summary: A paragraph summary description of the meeting.
      2. Risks: A detailed bullet set of risks in priority order.
      3. Talking Points: Key talking points proposed for the meeting.
      4. Jira Tickets: A list of next steps formatted as JIRA tickets with fields: task_name, assignee_suggestion, priority_level (Low, Medium, High, Highest), and due_date_estimate.
      5. Image Prompt: A highly descriptive prompt for an AI image generator to create a professional, conceptual cover image for this meeting.

      Return the response in JSON format.`;

      const parts = files.map(f => ({
        inlineData: {
          data: f.base64,
          mimeType: f.mimeType
        }
      }));

      const textResponse = await ai.models.generateContent({
        model: textModel,
        contents: [{ parts: [...parts, { text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              jiraTickets: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    task_name: { type: Type.STRING },
                    assignee_suggestion: { type: Type.STRING },
                    priority_level: { type: Type.STRING },
                    due_date_estimate: { type: Type.STRING }
                  },
                  required: ["task_name", "assignee_suggestion", "priority_level", "due_date_estimate"]
                } 
              },
              imagePrompt: { type: Type.STRING }
            },
            required: ["summary", "risks", "talkingPoints", "jiraTickets", "imagePrompt"]
          }
        }
      });

      const result = JSON.parse(textResponse.text || "{}") as MeetingSummary;
      setSummary(result);

      // Calculate Cost
      if (textResponse.usageMetadata) {
        const inputTokens = textResponse.usageMetadata.promptTokenCount || 0;
        const outputTokens = textResponse.usageMetadata.candidatesTokenCount || 0;
        const totalCost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;
        setCost(totalCost);
      }

      // 2. Generate Cover Image
      const imageModel = "gemini-2.5-flash-image";
      const imageResponse = await ai.models.generateContent({
        model: imageModel,
        contents: [{ parts: [{ text: result.imagePrompt }] }],
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      });

      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setCoverImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadJiraJSON = () => {
    if (!summary?.jiraTickets) return;

    const dataStr = JSON.stringify(summary.jiraTickets, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'jira-tickets.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-light tracking-tight mb-2">Meeting Prep Assistant</h1>
            <p className="text-muted-foreground text-sm">Transform your notes and slides into structured intelligence.</p>
          </div>
          {cost !== null && (
            <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-black/5 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium">Processing Cost: <span className="text-emerald-600">${cost.toFixed(6)}</span></span>
            </div>
          )}
        </header>

        {/* Upload Section */}
        <section className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 mb-8">
          <div 
            className="border-2 border-dashed border-black/10 rounded-2xl p-8 text-center hover:border-black/20 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileUp className="w-6 h-6 text-black/60" />
              </div>
              <div>
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">Notes PDF, Slides (as PDF), or Text files</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Tip: For PowerPoint slides, please <strong>Export to PDF</strong> before uploading for best results.
          </p>

          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-2">Uploaded Files ({files.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-black/5 p-3 rounded-xl group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-4 h-4 flex-shrink-0 text-black/40" />
                      <span className="text-sm truncate font-medium">{f.file.name}</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={generateSummary}
              disabled={isProcessing || files.length === 0}
              className={cn(
                "px-8 py-3 rounded-2xl font-medium transition-all flex items-center gap-2",
                isProcessing || files.length === 0 
                  ? "bg-black/5 text-black/20 cursor-not-allowed" 
                  : "bg-[#1a1a1a] text-white hover:bg-[#333] active:scale-95 shadow-lg shadow-black/10"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Intelligence...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Create Summary
                </>
              )}
            </button>
          </div>
        </section>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Output Section */}
        {(summary || isProcessing) && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-2 px-2">
              <h2 className="text-xl font-medium">Generated Intelligence</h2>
              {summary && (
                <button
                  onClick={downloadJiraJSON}
                  className="flex items-center gap-2 text-sm font-medium hover:text-black/60 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Next Steps into JIRA
                </button>
              )}
            </div>

            <div 
              ref={summaryRef}
              style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}
              className="rounded-[2rem] shadow-xl border overflow-hidden"
            >
              {/* Cover Image */}
              <div className="aspect-video bg-[#f0f0f0] relative overflow-hidden">
                {coverImage ? (
                  <img 
                    src={coverImage} 
                    alt="Meeting Cover" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : isProcessing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f0f0f0] animate-pulse">
                    <ImageIcon className="w-12 h-12 text-[#cccccc]" />
                    <p className="text-xs font-medium text-[#999999] uppercase tracking-widest">Generating Visuals...</p>
                  </div>
                ) : null}
              </div>

              {/* Content */}
              <div className="p-8 md:p-12 space-y-10">
                {isProcessing && !summary ? (
                  <div className="space-y-8">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="space-y-3">
                        <div className="h-6 w-32 bg-[#f0f0f0] rounded-lg animate-pulse" />
                        <div className="h-4 w-full bg-[#f0f0f0] rounded-lg animate-pulse" />
                        <div className="h-4 w-5/6 bg-[#f0f0f0] rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : summary && (
                  <>
                    <section>
                      <h3 className="text-lg font-bold text-[#000000] mb-4">Summary</h3>
                      <p className="text-lg leading-relaxed text-[#333333]">{summary.summary}</p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <section>
                        <h3 className="text-lg font-bold text-[#000000] mb-4">Risks</h3>
                        <ul className="space-y-3">
                          {summary.risks.map((risk, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-relaxed">
                              <span className="text-[#999999] font-mono mt-0.5">{(i + 1).toString().padStart(2, '0')}</span>
                              <span className="text-[#444444]">{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section>
                        <h3 className="text-lg font-bold text-[#000000] mb-4">Talking Points</h3>
                        <ul className="space-y-3">
                          {summary.talkingPoints.map((point, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-relaxed">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#cccccc] mt-2 flex-shrink-0" />
                              <span className="text-[#444444]">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>

                    <section className="pt-8 border-t border-[#eeeeee]">
                      <h3 className="text-lg font-bold text-[#000000] mb-4">Next Steps (JIRA Tickets)</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {summary.jiraTickets.map((ticket, i) => (
                          <div 
                            key={i} 
                            style={{ backgroundColor: '#fafafa', borderColor: '#eeeeee' }}
                            className="p-5 rounded-2xl border flex flex-col gap-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-[#f0f0f0] flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <CheckCircle2 className="w-4 h-4 text-[#999999]" />
                                </div>
                                <h4 className="font-bold text-[#000000]">{ticket.task_name}</h4>
                              </div>
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                                ticket.priority_level === 'Highest' || ticket.priority_level === 'High' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                              )}>
                                {ticket.priority_level}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pl-9 text-xs">
                              <div>
                                <p className="text-[#999999] uppercase tracking-widest font-bold mb-1">Assignee</p>
                                <p className="text-[#444444]">{ticket.assignee_suggestion}</p>
                              </div>
                              <div>
                                <p className="text-[#999999] uppercase tracking-widest font-bold mb-1">Due Date</p>
                                <p className="text-[#444444]">{ticket.due_date_estimate}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
