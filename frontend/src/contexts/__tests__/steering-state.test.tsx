import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureProvider, useFeatures } from '@/contexts/FeatureContext';

// Test component that exposes context methods
function TestComponent() {
  const {
    features,
    isComparing,
    setPendingValue,
    confirmFeature,
    cancelFeature,
    confirmAllFeatures,
    cancelAllFeatures,
    getFeatureState
  } = useFeatures();

  return (
    <div>
      <div data-testid="comparing-state">{isComparing ? 'comparing' : 'not-comparing'}</div>
      <div data-testid="feature-count">{features.size}</div>
      <button onClick={() => setPendingValue('test-feature', 0.8)} data-testid="set-pending">
        Set Pending
      </button>
      <button onClick={() => setPendingValue('test-feature-2', 0.4)} data-testid="set-pending-2">
        Set Pending 2
      </button>
      <button onClick={() => confirmFeature('test-feature')} data-testid="confirm-feature">
        Confirm Feature
      </button>
      <button onClick={() => cancelFeature('test-feature')} data-testid="cancel-feature">
        Cancel Feature
      </button>
      <button onClick={confirmAllFeatures} data-testid="confirm-all">
        Confirm All
      </button>
      <button onClick={cancelAllFeatures} data-testid="cancel-all">
        Cancel All
      </button>
      <div data-testid="feature-state">
        {JSON.stringify(getFeatureState('test-feature'))}
      </div>
      <div data-testid="feature-state-2">
        {JSON.stringify(getFeatureState('test-feature-2'))}
      </div>
    </div>
  );
}

describe('Steering State Management', () => {
  beforeEach(() => {
    render(
      <FeatureProvider>
        <TestComponent />
      </FeatureProvider>
    );
  });

  it('initializes with empty state', () => {
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
    expect(screen.getByTestId('feature-count')).toHaveTextContent('0');
    expect(screen.getByTestId('feature-state')).toHaveTextContent('');
  });

  it('sets pending value and updates comparison state', () => {
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    expect(screen.getByTestId('comparing-state')).toHaveTextContent('comparing');
    expect(screen.getByTestId('feature-count')).toHaveTextContent('1');
    
    const featureState = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    expect(featureState.status).toBe('PENDING');
    expect(featureState.value).toBe(0.8);
  });

  it('confirms a pending feature', () => {
    // Set pending first
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    // Then confirm
    act(() => {
      screen.getByTestId('confirm-feature').click();
    });

    const featureState = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    expect(featureState.status).toBe('CONFIRMED');
    expect(featureState.value).toBe(0.8);
  });

  it('cancels a pending feature', () => {
    // Set pending first
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    // Then cancel
    act(() => {
      screen.getByTestId('cancel-feature').click();
    });

    expect(screen.getByTestId('feature-state')).toHaveTextContent('');
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
  });

  it('confirms all pending features', () => {
    // Set pending first
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    // Then confirm all
    act(() => {
      screen.getByTestId('confirm-all').click();
    });

    const featureState = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    expect(featureState.status).toBe('CONFIRMED');
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
  });

  it('cancels all pending features', () => {
    // Set pending first
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    // Then cancel all
    act(() => {
      screen.getByTestId('cancel-all').click();
    });

    expect(screen.getByTestId('feature-state')).toHaveTextContent('');
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
    expect(screen.getByTestId('feature-count')).toHaveTextContent('0');
  });

  it('maintains confirmed state when setting new pending values', () => {
    // Set and confirm first value
    act(() => {
      screen.getByTestId('set-pending').click();
      screen.getByTestId('confirm-feature').click();
    });

    // Set new pending value
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    const featureState = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    expect(featureState.status).toBe('PENDING');
    
    // Cancel pending change
    act(() => {
      screen.getByTestId('cancel-feature').click();
    });

    // Should restore to confirmed state
    const restoredState = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    expect(restoredState.status).toBe('CONFIRMED');
    expect(restoredState.value).toBe(0.8);
  });

  it('maintains multiple pending features until confirmation', () => {
    // Set first pending feature
    act(() => {
      screen.getByTestId('set-pending').click();
    });

    // Set second pending feature
    act(() => {
      screen.getByTestId('set-pending-2').click();
    });

    // Verify both features are pending
    const feature1State = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    const feature2State = JSON.parse(screen.getByTestId('feature-state-2').textContent || '{}');
    
    expect(feature1State.status).toBe('PENDING');
    expect(feature1State.value).toBe(0.8);
    expect(feature2State.status).toBe('PENDING');
    expect(feature2State.value).toBe(0.4);
    expect(screen.getByTestId('feature-count')).toHaveTextContent('2');

    // Confirm all features
    act(() => {
      screen.getByTestId('confirm-all').click();
    });

    // Verify both features are now confirmed
    const feature1StateAfter = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    const feature2StateAfter = JSON.parse(screen.getByTestId('feature-state-2').textContent || '{}');
    
    expect(feature1StateAfter.status).toBe('CONFIRMED');
    expect(feature1StateAfter.value).toBe(0.8);
    expect(feature2StateAfter.status).toBe('CONFIRMED');
    expect(feature2StateAfter.value).toBe(0.4);
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
  });

  it('cancels all pending features while preserving confirmed ones', () => {
    // Set and confirm first feature
    act(() => {
      screen.getByTestId('set-pending').click();
      screen.getByTestId('confirm-feature').click();
    });

    // Set second feature as pending
    act(() => {
      screen.getByTestId('set-pending-2').click();
    });

    // Cancel all pending changes
    act(() => {
      screen.getByTestId('cancel-all').click();
    });

    // Verify first feature remains confirmed while second is removed
    const feature1State = JSON.parse(screen.getByTestId('feature-state').textContent || '{}');
    const feature2Element = screen.getByTestId('feature-state-2');
    
    expect(feature1State.status).toBe('CONFIRMED');
    expect(feature1State.value).toBe(0.8);
    expect(feature2Element).toHaveTextContent('');
    expect(screen.getByTestId('comparing-state')).toHaveTextContent('not-comparing');
  });
}); 