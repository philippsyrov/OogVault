interface VaultMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: string;
}

interface VaultConversation {
  id: string;
  platform?: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  is_auto_saved?: number;
  url?: string;
  messages?: VaultMessage[];
}

interface VaultNugget {
  id?: string;
  conversation_id?: string;
  question: string;
  answer: string;
  category?: string;
  created_at?: string;
  platform?: string;
}

interface VaultStats {
  conversations: number;
  messages: number;
  nuggets: number;
}

interface SearchConversationResult extends VaultConversation {
  messages: VaultMessage[];
  score: number;
  matchedContent: string;
}

interface SimilarQuestionResult {
  question: string;
  answer: string | null;
  conversationId: string;
  conversationTitle: string;
  platform: string;
  timestamp: string;
  score: number;
  source: 'conversation' | 'nugget';
}

interface OogVaultAutocomplete {
  attach: (
    inputElement: HTMLElement,
    platform: string,
    findInputFn?: () => HTMLElement | null,
  ) => void;
}

interface Window {
  OogVaultAutocomplete: OogVaultAutocomplete;
}

interface VaultSettings {
  autoSave?: boolean;
  autocompleteEnabled?: boolean;
  autocompleteMinLength?: number;
  theme?: string;
}

type MessageType =
  | 'SAVE_CONVERSATION'
  | 'GET_CONVERSATION'
  | 'GET_ALL_CONVERSATIONS'
  | 'DELETE_CONVERSATION'
  | 'SEARCH'
  | 'SEARCH_SIMILAR'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'GET_TAGS'
  | 'EXPORT_MARKDOWN'
  | 'GENERATE_SUMMARY'
  | 'GET_ALL_NUGGETS'
  | 'SEARCH_NUGGETS'
  | 'EXPORT_KNOWLEDGE'
  | 'EXPORT_KNOWLEDGE_CATEGORY'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_STATS';

interface VaultRequest {
  type: MessageType;
  [key: string]: unknown;
}
