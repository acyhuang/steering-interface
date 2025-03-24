import { render, screen, act } from '@testing-library/react';
import { ComparisonProvider, useComparison } from '@/contexts/ComparisonContext';
import { ChatMessage } from '@/types/chat';
import { describe, it, expect } from 'vitest';

// Test component that exposes context methods
function TestComponent() {
  const { state, createNewTurn, storeOriginalResponse, cleanup } = useComparison();
  return (
    <div>
      <div data-testid="turn-id">{state.currentTurnId || 'None'}</div>
      <div data-testid="original-response">
        {state.originalResponse?.content || 'None'}
      </div>
      <button
        onClick={() =>
          createNewTurn({ role: 'user', content: 'Test message' })
        }
        data-testid="create-turn"
      >
        Create Turn
      </button>
      <button
        onClick={() => storeOriginalResponse('Test response')}
        data-testid="store-response"
      >
        Store Response
      </button>
      <button onClick={cleanup} data-testid="cleanup">
        Cleanup
      </button>
    </div>
  );
}

describe('Response Storage', () => {
  it('stores original response only when turn exists', () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    // Try to store response without turn
    act(() => {
      screen.getByTestId('store-response').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('None');

    // Create turn and store response
    act(() => {
      screen.getByTestId('create-turn').click();
    });
    act(() => {
      screen.getByTestId('store-response').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('Test response');
  });

  it('cleans up response when creating new turn', () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    // Create turn and store response
    act(() => {
      screen.getByTestId('create-turn').click();
    });
    act(() => {
      screen.getByTestId('store-response').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('Test response');

    // Create new turn
    act(() => {
      screen.getByTestId('create-turn').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('None');
  });

  it('allows manual cleanup of response', () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    // Create turn and store response
    act(() => {
      screen.getByTestId('create-turn').click();
    });
    act(() => {
      screen.getByTestId('store-response').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('Test response');

    // Manual cleanup
    act(() => {
      screen.getByTestId('cleanup').click();
    });
    expect(screen.getByTestId('original-response')).toHaveTextContent('None');
  });
}); 