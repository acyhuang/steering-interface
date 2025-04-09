import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { VariantProvider } from '../VariantContext';
import { configureMockApis, resetMockApis } from './api-mocks';

// Re-export the mocking helpers
export { configureMockApis, resetMockApis };

// Create a wrapper component for tests
interface TestWrapperProps {
  children: ReactNode;
  variantId?: string;
  sessionId?: string;
}

export const TestWrapper: React.FC<TestWrapperProps> = ({
  children,
  variantId = 'test-variant',
  sessionId = 'test-session',
}) => {
  return (
    <VariantProvider defaultVariantId={variantId} defaultSessionId={sessionId}>
      {children}
    </VariantProvider>
  );
};

// Custom renderer that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  variantId?: string;
  sessionId?: string;
}

export function renderWithVariantContext(
  ui: ReactElement,
  {
    variantId = 'test-variant',
    sessionId = 'test-session',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  return render(
    <VariantProvider defaultVariantId={variantId} defaultSessionId={sessionId}>
      {ui}
    </VariantProvider>,
    renderOptions
  );
} 