import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  badge?: string;
}

interface CustomSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top' | 'auto';
  placeholder?: string;
  fullWidth?: boolean;
}

export function CustomSelect<T = string | number>({
  value,
  onChange,
  options,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
  align = 'left',
  placement = 'auto',
  placeholder = 'Select option',
  fullWidth = false,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updateCoords = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let usePlacement: 'top' | 'bottom' = 'bottom';
    if (placement === 'top') {
      usePlacement = 'top';
    } else if (placement === 'bottom') {
      usePlacement = 'bottom';
    } else {
      // 'auto': flip to top if space below is too tight and space above has more room
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        usePlacement = 'top';
      } else {
        usePlacement = 'bottom';
      }
    }

    const calculatedWidth = fullWidth ? rect.width : Math.max(rect.width, 220);

    if (usePlacement === 'bottom') {
      const availableHeight = Math.max(160, Math.min(320, spaceBelow - 16));
      setCoords({
        top: rect.bottom + 6,
        left: align === 'right' ? undefined : Math.min(rect.left, viewportWidth - calculatedWidth - 12),
        right: align === 'right' ? Math.max(12, viewportWidth - rect.right) : undefined,
        width: calculatedWidth,
        maxHeight: availableHeight,
      });
    } else {
      const availableHeight = Math.max(160, Math.min(320, spaceAbove - 16));
      setCoords({
        bottom: viewportHeight - rect.top + 6,
        left: align === 'right' ? undefined : Math.min(rect.left, viewportWidth - calculatedWidth - 12),
        right: align === 'right' ? Math.max(12, viewportWidth - rect.right) : undefined,
        width: calculatedWidth,
        maxHeight: availableHeight,
      });
    }
  }, [align, fullWidth, placement]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    } else {
      setCoords(null);
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'w-full block' : 'inline-block'} text-left ${className}`}
    >
      {/* Select Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`custom-select-trigger ${fullWidth ? 'w-full' : ''} bg-dark-900 border border-dark-700/80 hover:border-brand-500/60 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 flex items-center justify-between gap-2.5 transition-all shadow-sm group select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'
        } ${isOpen ? 'ring-1 ring-brand-500/50 border-brand-500/60' : ''} ${triggerClassName}`}
      >
        <span className="truncate font-medium">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 group-hover:text-brand-400 shrink-0 ${
            isOpen ? 'rotate-180 text-brand-400' : ''
          }`}
        />
      </button>

      {/* Themed Dropdown Menu Popup - Rendered into body via Portal to avoid clipping */}
      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            left: coords.left !== undefined ? `${coords.left}px` : undefined,
            right: coords.right !== undefined ? `${coords.right}px` : undefined,
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 99999,
          }}
          className={`custom-select-menu overflow-y-auto bg-dark-900/98 backdrop-blur-2xl border border-dark-700 rounded-xl shadow-2xl p-1.5 space-y-0.5 transition-all launcher-card animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={String(option.value)}
                onClick={() => handleSelect(option.value)}
                className={`custom-select-option px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-between gap-3 select-none ${
                  isSelected
                    ? 'is-selected bg-brand-500/15 text-brand-400 font-semibold border border-brand-500/30'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-dark-800/80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{option.label}</span>
                  {option.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-brand-500/20 text-brand-400 border border-brand-500/30">
                      {option.badge}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check size={13} className="text-brand-400 shrink-0 ml-1" />
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
