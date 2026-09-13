/**
 * Phase 4 stub for Base44 agents (Concierge).
 * Keeps ConciergePanel UI mounted; conversations are local-only and replies
 * are not generated. Full LLM / WhatsApp / tool wiring is a checklist item.
 */

const STUB_MSG =
  'Concierge agent is not configured yet (Supabase migration Phase 4 stub). See PHASE4_SUMMARY.md.';

let localSeq = 0;

function localConversation(metadata = {}) {
  localSeq += 1;
  return {
    id: `stub-conv-${Date.now()}-${localSeq}`,
    agent_name: 'concierge',
    messages: [],
    metadata,
    _stub: true,
  };
}

export const agentsStub = {
  async listConversations() {
    return [];
  },

  async getConversation(id) {
    return id
      ? { id, agent_name: 'concierge', messages: [], metadata: {}, _stub: true }
      : null;
  },

  async createConversation({ metadata } = {}) {
    return localConversation(metadata);
  },

  async addMessage(_conversation, _message) {
    const err = new Error(STUB_MSG);
    err.code = 'CONCIERGE_STUB';
    throw err;
  },

  /** No-op unsubscribe; no realtime without a real agent backend. */
  subscribeToConversation(_id, _cb) {
    return () => {};
  },

  getWhatsAppConnectURL(_agentName) {
    // Keep <a href> valid; link does nothing useful until WhatsApp connector is wired.
    return '#concierge-whatsapp-not-configured';
  },
};

export const CONCIERGE_STUB_MESSAGE = STUB_MSG;
