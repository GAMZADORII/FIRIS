import { useEffect, useRef } from "react";
import "./Console.css";

export function downloadFile(name, content, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`console-modal ${wide ? "console-modal--wide" : ""}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      aria-labelledby="console-modal-title"
    >
      <header className="console-modal__header">
        <div>
          <h2 id="console-modal-title">{title}</h2>
          <small>{subtitle}</small>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function PageHeading({ eyebrow, title, children }) {
  return (
    <header className="console-heading">
      <div>
        <p className="console-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="console-actions">{children}</div>
    </header>
  );
}

export function Badge({ children, tone = "" }) {
  return (
    <span className={`console-badge ${tone ? `console-badge--${tone}` : ""}`}>
      {children}
    </span>
  );
}
