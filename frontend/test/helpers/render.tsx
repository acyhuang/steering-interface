import { render, RenderOptions } from '@testing-library/react';
import { ComparisonProvider } from '@/contexts/ComparisonContext';
import { ReactElement } from 'react';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Custom render function that wraps components with necessary providers
 * @param ui - The React component to render
 * @param options - Additional render options
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: WrapperProps) => (
    <ComparisonProvider>
      {children}
    </ComparisonProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything
export * from '@testing-library/react'; 