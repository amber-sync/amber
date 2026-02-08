/**
 * TIM-207: Tests for Card UI component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from '../components/ui/Card';

describe('Card', () => {
  it('should render children content', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('should render as a div element', () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card.tagName).toBe('DIV');
  });

  describe('variants', () => {
    it('should apply default variant by default', () => {
      render(<Card data-testid="card">Default</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('bg-layer-1');
      expect(card.className).toContain('border');
    });

    it('should apply elevated variant', () => {
      render(
        <Card data-testid="card" variant="elevated">
          Elevated
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('bg-layer-1');
      expect(card.className).toContain('shadow-[var(--shadow-elevated)]');
    });

    it('should apply outlined variant', () => {
      render(
        <Card data-testid="card" variant="outlined">
          Outlined
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('bg-transparent');
      expect(card.className).toContain('border-border-highlight');
    });

    it('should apply interactive variant', () => {
      render(
        <Card data-testid="card" variant="interactive">
          Interactive
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('cursor-pointer');
    });
  });

  describe('padding', () => {
    it('should apply medium padding by default', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('p-[var(--card-padding)]');
    });

    it('should apply no padding', () => {
      render(
        <Card data-testid="card" padding="none">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).not.toContain('p-3');
      expect(card.className).not.toContain('p-[var(--card-padding)]');
      expect(card.className).not.toContain('p-6');
    });

    it('should apply small padding', () => {
      render(
        <Card data-testid="card" padding="sm">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('p-3');
    });

    it('should apply large padding', () => {
      render(
        <Card data-testid="card" padding="lg">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card.className).toContain('p-6');
    });
  });

  it('should forward ref to div element', () => {
    const ref = vi.fn();
    render(<Card ref={ref}>Ref Card</Card>);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLDivElement);
  });

  it('should merge custom className', () => {
    render(
      <Card data-testid="card" className="custom-class">
        Custom
      </Card>
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('custom-class');
  });

  it('should pass through additional props', () => {
    render(
      <Card data-testid="card" role="article" aria-label="Custom card">
        Props
      </Card>
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('role', 'article');
    expect(card).toHaveAttribute('aria-label', 'Custom card');
  });

  it('should handle click events on interactive variant', () => {
    const handleClick = vi.fn();
    render(
      <Card data-testid="card" variant="interactive" onClick={handleClick}>
        Clickable
      </Card>
    );

    fireEvent.click(screen.getByTestId('card'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply rounded corners via CSS variable', () => {
    render(<Card data-testid="card">Rounded</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('rounded-lg');
  });

  it('should apply transition styles', () => {
    render(<Card data-testid="card">Transition</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('transition-all');
  });
});
