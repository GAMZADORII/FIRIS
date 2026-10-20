import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

export default function Modal({ open, onClose, title, children, className = '' }) {
  const headingId = useId();
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const elements = panelRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section ref={panelRef} className={`dialog-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <header className="dialog-header">
          <h2 id={headingId}>{title}</h2>
          <button type="button" className="dialog-close" ref={closeRef} onClick={onClose} aria-label="창 닫기">×</button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
