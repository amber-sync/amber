/**
 * TIM-207: Tests for Palette UI component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette, PaletteSection, PaletteItem, PaletteEmpty } from '../components/ui/Palette';

describe('Palette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    children: <div>Test content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when closed', () => {
    render(<Palette {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render dialog when open', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render placeholder text', () => {
    render(<Palette {...defaultProps} placeholder="Type to search..." />);
    expect(screen.getByPlaceholderText('Type to search...')).toBeInTheDocument();
  });

  it('should call onQueryChange when typing', async () => {
    const user = userEvent.setup();
    render(<Palette {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');

    expect(defaultProps.onQueryChange).toHaveBeenCalledWith('t');
    expect(defaultProps.onQueryChange).toHaveBeenCalledWith('e');
    expect(defaultProps.onQueryChange).toHaveBeenCalledWith('s');
    expect(defaultProps.onQueryChange).toHaveBeenCalledWith('t');
  });

  it('should display current query value', () => {
    render(<Palette {...defaultProps} query="existing query" />);
    expect(screen.getByDisplayValue('existing query')).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<Palette {...defaultProps} />);

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should show loading spinner when isLoading is true', () => {
    render(<Palette {...defaultProps} isLoading={true} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show loading spinner when isLoading is false', () => {
    render(<Palette {...defaultProps} isLoading={false} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  it('should render default keyboard hints', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should render custom keyboard hints', () => {
    const customHints = [
      { keys: ['⌘', 'K'], label: 'Open' },
      { keys: ['Tab'], label: 'Switch' },
    ];
    render(<Palette {...defaultProps} keyboardHints={customHints} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('should render header content when provided', () => {
    render(<Palette {...defaultProps} header={<div>Header content</div>} />);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('should apply correct size class', () => {
    const { rerender } = render(<Palette {...defaultProps} size="sm" />);
    expect(document.querySelector('.max-w-md')).toBeInTheDocument();

    rerender(<Palette {...defaultProps} size="lg" />);
    expect(document.querySelector('.max-w-2xl')).toBeInTheDocument();
  });

  it('should focus input when opened', async () => {
    render(<Palette {...defaultProps} />);

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox'));
    });
  });
});

describe('PaletteSection', () => {
  it('should render title', () => {
    render(
      <PaletteSection title="Section Title">
        <div>Content</div>
      </PaletteSection>
    );
    expect(screen.getByText('Section Title')).toBeInTheDocument();
  });

  it('should render children content', () => {
    render(
      <PaletteSection title="Test">
        <div>Section content</div>
      </PaletteSection>
    );
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <PaletteSection title="Test" icon={<span data-testid="section-icon">★</span>}>
        <div>Content</div>
      </PaletteSection>
    );
    expect(screen.getByTestId('section-icon')).toBeInTheDocument();
  });
});

describe('PaletteItem', () => {
  const defaultItemProps = {
    title: 'Item Title',
    isSelected: false,
    onClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title', () => {
    render(<PaletteItem {...defaultItemProps} />);
    expect(screen.getByText('Item Title')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<PaletteItem {...defaultItemProps} description="Item description" />);
    expect(screen.getByText('Item description')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(<PaletteItem {...defaultItemProps} icon={<span data-testid="item-icon">🔥</span>} />);
    expect(screen.getByTestId('item-icon')).toBeInTheDocument();
  });

  it('should render trailing content when provided', () => {
    render(<PaletteItem {...defaultItemProps} trailing={<kbd>⌘K</kbd>} />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    render(<PaletteItem {...defaultItemProps} />);

    await user.click(screen.getByRole('button'));
    expect(defaultItemProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('should call onMouseEnter when hovered', () => {
    const onMouseEnter = vi.fn();
    render(<PaletteItem {...defaultItemProps} onMouseEnter={onMouseEnter} />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });

  it('should have selected styling when isSelected is true', () => {
    render(<PaletteItem {...defaultItemProps} isSelected={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-selected', 'true');
  });

  it('should not have selected styling when isSelected is false', () => {
    render(<PaletteItem {...defaultItemProps} isSelected={false} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-selected', 'false');
  });
});

describe('PaletteEmpty', () => {
  it('should render message', () => {
    render(<PaletteEmpty message="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});
