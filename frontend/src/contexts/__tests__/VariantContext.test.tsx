// Import mocks first to ensure proper hoisting
import './__mocks__';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useVariant } from '../VariantContext';
import { TestWrapper, configureMockApis, resetMockApis } from './test-utils';
import { mockMessages, mockFeaturesApi, mockChatApi } from './api-mocks';

describe('VariantContext', () => {
  beforeEach(() => {
    // Setup mocks with default responses
    configureMockApis();
  });

  afterEach(() => {
    // Reset all mocks between tests
    resetMockApis();
  });

  it('initializes with default values', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    expect(result.current.variantId).toBe('test-variant');
    expect(result.current.pendingFeatures.size).toBe(0);
    expect(result.current.originalResponse).toBeNull();
    expect(result.current.currentResponse).toBeNull();
    expect(result.current.steeredResponse).toBeNull();
    expect(result.current.isGeneratingSteeredResponse).toBe(false);
    expect(result.current.isComparingResponses).toBe(false);
    expect(result.current.generationError).toBeNull();

    // Wait for initial variant refresh
    await waitFor(() => {
      expect(mockFeaturesApi.getModifiedFeatures).toHaveBeenCalledTimes(1);
    });
  });

  it('applies pending features correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    await act(async () => {
      await result.current.applyPendingFeatures('test_feature', 0.8);
    });

    expect(result.current.pendingFeatures.size).toBe(1);
    expect(result.current.pendingFeatures.get('test_feature')).toBe(0.8);
  });

  it('sets original response correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    act(() => {
      result.current.setOriginalResponseFromChat('Original test response');
    });

    expect(result.current.originalResponse).toBe('Original test response');
    expect(result.current.currentResponse).toBe('Original test response');
  });

  it('generates steered response correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    // First apply a pending feature
    await act(async () => {
      await result.current.applyPendingFeatures('test_feature', 0.8);
    });

    await act(async () => {
      await result.current.generateSteeredResponse(mockMessages);
    });

    // Check that APIs were called correctly
    expect(mockFeaturesApi.steerFeature).toHaveBeenCalledWith({
      session_id: 'test-session',
      variant_id: 'test-variant',
      feature_label: 'test_feature',
      value: 0.8
    });

    expect(mockChatApi.createChatCompletion).toHaveBeenCalledWith({
      messages: mockMessages,
      variant_id: 'test-variant'
    });

    // Verify state updates
    expect(result.current.steeredResponse).toBe('This is a mock response');
    expect(result.current.isGeneratingSteeredResponse).toBe(false);
    expect(result.current.isComparingResponses).toBe(true);
    expect(result.current.generationError).toBeNull();
  });

  it('confirms steered response correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    // Ensure the mock is properly configured
    mockChatApi.createChatCompletion.mockResolvedValue({
      content: 'This is a mock response',
      variant_id: 'test-variant'
    });

    // Setup initial state
    await act(async () => {
      await result.current.applyPendingFeatures('test_feature', 0.8);
      result.current.setOriginalResponseFromChat('Original response');
      await result.current.generateSteeredResponse(mockMessages);
    });

    // Verify steered response was set correctly before confirming
    expect(result.current.steeredResponse).toBe('This is a mock response');
    expect(result.current.isComparingResponses).toBe(true);

    // Confirm steered response
    await act(async () => {
      await result.current.confirmSteeredResponse();
    });

    // Verify state updates
    expect(result.current.pendingFeatures.size).toBe(0);
    expect(result.current.originalResponse).toBe('Original response');
    expect(result.current.currentResponse).toBe('This is a mock response');
    expect(result.current.steeredResponse).toBeNull();
    expect(result.current.isComparingResponses).toBe(false);
    expect(mockFeaturesApi.getModifiedFeatures).toHaveBeenCalledTimes(2); // Initial + confirm
  });

  it('cancels steering correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    // Setup initial state
    await act(async () => {
      await result.current.applyPendingFeatures('test_feature', 0.8);
      result.current.setOriginalResponseFromChat('Original response');
      await result.current.generateSteeredResponse(mockMessages);
    });
    
    // Verify comparing state is true after generating steered response
    expect(result.current.isComparingResponses).toBe(true);

    // Cancel steering
    await act(async () => {
      await result.current.cancelSteering();
    });

    // Verify state updates
    expect(result.current.pendingFeatures.size).toBe(0);
    expect(result.current.steeredResponse).toBeNull();
    expect(result.current.originalResponse).toBe('Original response');
    expect(result.current.currentResponse).toBe('Original response');
    expect(result.current.isComparingResponses).toBe(false);
    expect(mockFeaturesApi.clearFeature).toHaveBeenCalledWith({
      session_id: 'test-session',
      variant_id: 'test-variant',
      feature_label: 'test_feature'
    });
  });

  it('detects pending features correctly', async () => {
    const { result } = renderHook(() => useVariant(), {
      wrapper: TestWrapper
    });

    expect(result.current.hasPendingFeatures()).toBe(false);

    await act(async () => {
      await result.current.applyPendingFeatures('test_feature', 0.8);
    });

    expect(result.current.hasPendingFeatures()).toBe(true);
  });
}); 