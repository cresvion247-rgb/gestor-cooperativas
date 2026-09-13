import React, { useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, Plus, Mic, Square, Volume2, VolumeX } from 'lucide-react';
import { agentsStub as agents } from '@/api/agentsStub';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { useSpeechInput } from '@/lib/speech';
import { useSpokenReplies } from '@/lib/spokenReplies';
import { useToast } from '@/components/ui/use-toast';
import MessageBubble from '@/components/concierge/MessageBubble';

const AGENT = 'concierge';

// Panel deslizante del conserje digital: reutiliza la última conversación del
// usuario con el agente (o crea una nueva), sincronizada en tiempo real.
export default function ConciergePanel({ onClose }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const [speakerOn, setSpeakerOn] = useState(true);
  const { speakingId } = useSpokenReplies(messages, { enabled: speakerOn, lang, loading });
  const voice = useSpeechInput({ lang, onResult: text => send(text) });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await agents.listConversations({ agent_name: AGENT });
        let conv = Array.isArray(list) ? list[0] : list?.data?.[0];
        if (conv) {
          conv = (await agents.getConversation(conv.id)) || conv;
        } else {
          conv = await agents.createConversation({
            agent_name: AGENT,
            metadata: { name: t('concierge.title'), description: `email: ${user?.email || ''}` }
          });
        }
        if (active) {
          setConversation(conv);
          setMessages(conv?.messages || []);
        }
      } catch (e) {
        if (active) toast({ title: t('concierge.failed'), description: String(e?.message || e), variant: 'destructive' });
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    return agents.subscribeToConversation(conversation.id, data => setMessages(data?.messages || []));
  }, [conversation?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (voiceContent) => {
    const content = (voiceContent ?? input).trim();
    if (!content || !conversation || sending) return;
    setInput('');
    setSending(true);
    try {
      await agents.addMessage(conversation, { role: 'user', content });
    } catch (e) {
      toast({ title: t('concierge.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
    setSending(false);
  };

  const newChat = async () => {
    try {
      const conv = await agents.createConversation({
        agent_name: AGENT,
        metadata: { name: t('concierge.title'), description: `email: ${user?.email || ''}` }
      });
      setConversation(conv);
      setMessages([]);
    } catch (e) {
      toast({ title: t('concierge.failed'), description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const waitingReply = messages.length > 0 && messages[messages.length - 1].role === 'user';

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-[#102A43] px-5 py-4 text-white">
          <div>
            <p className="font-bold">{t('concierge.title')}</p>
            <p className="mt-0.5 text-xs text-slate-300">{t('concierge.desc')}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSpeakerOn(!speakerOn)} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label={speakerOn ? t('concierge.speakOn') : t('concierge.speakOff')} title={speakerOn ? t('concierge.speakOn') : t('concierge.speakOff')}>
              {speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button onClick={newChat} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label={t('concierge.newChat')} title={t('concierge.newChat')}><Plus className="h-4 w-4" /></button>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label={t('concierge.title')}><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#F4F7F9] p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">{t('concierge.loadingChat')}</p>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={m.id || i} message={m} speaking={speakingId === (m.id || `idx-${i}`)} />)}
              {waitingReply && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-400">{t('concierge.thinking')}</div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={t('concierge.placeholder')}
              className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
            />
            {voice.supported && (
              <button onClick={voice.toggle} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white transition ${voice.listening ? 'animate-pulse bg-red-600 motion-reduce:animate-none' : 'bg-[#102A43] hover:bg-[#173F5F]'}`} aria-label={voice.listening ? t('concierge.listening') : t('concierge.mic')} title={voice.listening ? t('concierge.listening') : t('concierge.mic')}>
                {voice.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button onClick={() => send()} disabled={sending || !input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 disabled:opacity-40" aria-label={t('concierge.send')}>
              <Send className="h-4 w-4" />
            </button>
          </div>
          <a href={agents.getWhatsAppConnectURL(AGENT)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:underline">
            <MessageCircle className="h-3.5 w-3.5" />{t('concierge.whatsapp')}
          </a>
        </div>
      </aside>
    </div>
  );
}