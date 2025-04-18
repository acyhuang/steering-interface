import { vi } from 'vitest';
import { SteerFeatureResponse } from '@/types/steering/feature';
import { ChatMessage, ChatResponse } from '@/types/conversation';
import { mockFeaturesApi, mockChatApi } from './__mocks__';

// API response mock types that match the actual API response types
export const mockVariantJson = {
  edits: [
    { feature_label: 'test_feature', value: 0.4 },
    { feature_label: 'another_feature', value: -0.8 },
  ],
};

export const mockSteerFeatureResponse: SteerFeatureResponse = {
  label: 'test_feature', 
  activation: 0.4,
  modified_value: 0.4
};

export const mockClearFeatureResponse = {
  label: 'test_feature',
};

export const mockChatResponse: ChatResponse = {
  content: 'This is a mock response',
  variant_id: 'default',
};

// Mock messages for testing
export const mockMessages: ChatMessage[] = [
  { role: 'user', content: 'Test message' },
  { role: 'assistant', content: 'Test response' }
];

// Re-export the mock APIs
export { mockFeaturesApi, mockChatApi };

// Configure API mocks with custom responses
export const configureMockApis = (options: {
  getModifiedFeaturesResponse?: any;
  steerFeatureResponse?: SteerFeatureResponse;
  clearFeatureResponse?: any;
  createChatCompletionResponse?: ChatResponse;
  shouldFailApis?: boolean;
} = {}) => {
  const {
    getModifiedFeaturesResponse = mockVariantJson,
    steerFeatureResponse = mockSteerFeatureResponse,
    clearFeatureResponse = mockClearFeatureResponse,
    createChatCompletionResponse = mockChatResponse,
    shouldFailApis = false
  } = options;

  if (shouldFailApis) {
    mockFeaturesApi.getModifiedFeatures.mockRejectedValue(new Error('API error'));
    mockFeaturesApi.steerFeature.mockRejectedValue(new Error('API error'));
    mockFeaturesApi.clearFeature.mockRejectedValue(new Error('API error'));
    mockChatApi.createChatCompletion.mockRejectedValue(new Error('API error'));
  } else {
    mockFeaturesApi.getModifiedFeatures.mockResolvedValue(getModifiedFeaturesResponse);
    mockFeaturesApi.steerFeature.mockResolvedValue(steerFeatureResponse);
    mockFeaturesApi.clearFeature.mockResolvedValue(clearFeatureResponse);
    mockChatApi.createChatCompletion.mockResolvedValue(createChatCompletionResponse);
  }
};

// Reset all mocks
export const resetMockApis = () => {
  vi.clearAllMocks();
}; 