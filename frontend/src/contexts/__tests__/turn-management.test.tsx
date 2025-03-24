import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Chat } from '@/components/Chat';
import { ComparisonProvider } from '@/contexts/ComparisonContext';
import { chatApi } from '@/lib/api';

// Mock the chat API
vi.mock('@/lib/api', () => ({
  chatApi: {
    createChatCompletion: vi.fn(),
  },
}));

describe('Turn Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new turn when sending a message', async () => {
    const mockResponse = {
      content: 'Test response',
      variant_id: 'test-variant',
    };

    (chatApi.createChatCompletion as any).mockResolvedValueOnce(mockResponse);

    render(
      <ComparisonProvider>
        <Chat />
      </ComparisonProvider>
    );

    // Type and send a message
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByText('Send'));

    // Wait for the response in the chat message
    await waitFor(() => {
      const messages = screen.getAllByText('Test response');
      // At least one message should be visible
      expect(messages.length).toBeGreaterThan(0);
    });

    // Verify turn ID is displayed and not empty
    const turnIdElement = screen.getByText(/Turn ID:/);
    expect(turnIdElement).toBeInTheDocument();
    expect(turnIdElement.textContent).not.toBe('Turn ID: None');
  });
}); 