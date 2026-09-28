import React, { useState, useEffect, useRef } from 'react';
import { Server as ServerIcon, RotateCw, GripVertical } from 'lucide-react';
import { WizardStatus } from '../pages/CreateServer';
import { useI18n } from '../i18n';

interface DraggableFloatingWizardProps {
  wizardStatus: WizardStatus;
  onClick: () => void;
}

export const DraggableFloatingWizard: React.FC<DraggableFloatingWizardProps> = ({
  wizardStatus,
  onClick,
}) => {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('llsm_floating_box_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return {
            x: Math.max(12, Math.min(window.innerWidth - 310, parsed.x)),
            y: Math.max(45, Math.min(window.innerHeight - 85, parsed.y)),
          };
        }
      }
    } catch {
      // ignore JSON error
    }
    // Default: Top-Right corner below TitleBar
    return {
      x: Math.max(12, window.innerWidth - 325),
      y: 50,
    };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    hasMoved: false,
  });

  // Keep card within viewport bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.max(12, Math.min(window.innerWidth - 310, prev.x)),
        y: Math.max(45, Math.min(window.innerHeight - 85, prev.y)),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      hasMoved: false,
    };
    setIsDragging(true);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - dragInfo.current.startX;
    const dy = e.clientY - dragInfo.current.startY;

    if (!dragInfo.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragInfo.current.hasMoved = true;
    }

    if (dragInfo.current.hasMoved) {
      const cardWidth = cardRef.current?.offsetWidth || 300;
      const cardHeight = cardRef.current?.offsetHeight || 72;

      const newX = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, dragInfo.current.originX + dx));
      const newY = Math.max(45, Math.min(window.innerHeight - cardHeight - 12, dragInfo.current.originY + dy));

      setPos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!dragInfo.current.hasMoved) {
      onClick();
    } else {
      try {
        localStorage.setItem('llsm_floating_box_pos', JSON.stringify(pos));
      } catch {
        // ignore
      }
    }
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 9999,
        minWidth: '290px',
        maxWidth: '360px',
        touchAction: 'none',
      }}
      className={`floating-wizard-card flex items-center gap-3 p-3 rounded-2xl border select-none transition-shadow duration-150 group ${
        isDragging
          ? 'cursor-grabbing shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_25px_rgba(var(--brand-500),0.4)] scale-[1.03] ring-2 ring-brand-400'
          : 'cursor-grab shadow-2xl hover:scale-[1.02] active:scale-95'
      }`}
      title={isDragging ? t('floatingMoving', 'Moving...') : t('floatingTooltip', 'Drag to move, or click to return to Create Server wizard')}
    >
      {/* Drag Grip Handle */}
      <div 
        className="text-slate-500 hover:text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5"
        title={t('dragToReposition', 'Drag to reposition')}
      >
        <GripVertical size={16} />
      </div>

      {/* Status Icon */}
      <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 text-brand-400 group-hover:text-brand-300">
        {wizardStatus.isInstalling ? (
          <RotateCw size={18} className="animate-spin text-brand-400" />
        ) : (
          <ServerIcon size={18} />
        )}
      </div>

      {/* Info Details */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="floating-wizard-title text-xs font-black text-slate-100 group-hover:text-brand-300 transition-colors truncate">
            {wizardStatus.isInstalling ? t('installingServer', 'Installing Server...') : (wizardStatus.name || t('creatingServerFloating', 'Creating Server'))}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-brand-500/20 text-brand-400 border border-brand-500/30 uppercase shrink-0">
            {wizardStatus.isInstalling ? `${wizardStatus.percent}%` : `Step ${wizardStatus.step}/7`}
          </span>
        </div>
        <p className="floating-wizard-desc text-[11px] text-slate-400 truncate">
          {wizardStatus.isInstalling ? (wizardStatus.statusText || t('deployingBdsLevi', 'Deploying BDS & LeviLamina...')) : t('clickReturnWizard', 'Click to return to wizard')}
        </p>
      </div>
    </div>
  );
};
