// API Types - matching backend schemas
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VariantSummary {
  uuid: string;
  label: string;
}

export interface ConversationCreateResponse {
  uuid: string;
  current_variant: VariantSummary;
  created_at: string;
}

export interface UnifiedFeature {
  uuid: string;
  label: string;
  activation: number;
  modification: number;
  pending_modification: number;
}

// UI State Types
export interface ConversationState {
  id: string | null;
  messages: ChatMessage[];
  currentVariant: VariantSummary | null;
  isLoading: boolean;
}

export interface FeatureState {
  features: UnifiedFeature[];
  isLoading: boolean;
  error: string | null;
}

// Filter and Sort Types
export type FilterOption = 'all' | 'activated' | 'modified'
export type SortOption = 'label' | 'activation' | 'modification'
export type SortOrder = 'asc' | 'desc'

export interface FilterSortState {
  filterBy: FilterOption
  sortBy: SortOption
  sortOrder: SortOrder
}

// Search Types
export interface SearchState {
  isSearching: boolean
  query: string
  results: UnifiedFeature[]
  isLoading: boolean
}

