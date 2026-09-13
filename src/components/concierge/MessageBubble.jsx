import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Volume2 } from 'lucide-react';

// Chip de herramienta invocada por el agente: estado visible y, si procede,
// parámetros/resultado desplegables (respeta display_projection del agente).
function ToolCall({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const p = toolCall.display_projection || {};
  const hideDetails = p.hide_details && p.details_redacted;
  const failed = ['failed', 'error'].includes(toolCall.status);
  const running = ['pending', 'running', 'in_progress'].includes(toolCall.status);
  const label = (failed && p.error_label) || (running && p.active_label) || p.label || toolCall.name;
  let results = toolCall.results;
  try { results = JSON.parse(results); } catch (e) { /* texto plano */ }
  return (
    <div className="mt-1.5 text-xs">
      <button
        onClick={() => !hideDetails && setExpanded(!expanded)}
        className={`hover:underline ${failed ? 'text-red-500' : 'text-slate-400'}`}
      >
        {label} · {toolCall.status}
      </button>
      {expanded && !hideDetails && (
        <div className="mt-1 rounded-lg bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-500">
          <p className="break-all">Params: {String(toolCall.arguments_string || '')}</p>
          <p className="mt-1 break-all">Result: {typeof results === 'object' ? JSON.stringify(results) : String(results ?? '')}</p>
        </div>
      )}
    </div>
  );
}

// Burbuja de conversación: contenido plano del usuario, markdown del agente.
export default function MessageBubble({ message, speaking }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${isUser ? 'bg-[#102A43] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
        {message.content && (isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed [&_p]:mb-1 [&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 last:[&_p]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ))}
        {message.tool_calls?.map((tc, i) => <ToolCall key={i} toolCall={tc} />)}
        {speaking && (
          <div className="mt-1 flex items-center gap-1.5 text-teal-700">
            <Volume2 className="h-3.5 w-3.5 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}