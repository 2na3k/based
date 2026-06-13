import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  titleId: string;
  onClose: () => void;
  closeTitle?: string;
  className?: string;
  children: ReactNode;
}

export function Modal({ open, title, titleId, onClose, closeTitle = "Close", className = "", children }: ModalProps) {
  return (
    <div
      className={`modal-backdrop${open ? " show" : ""}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`settings-panel${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="settings-head">
          <div className="settings-title" id={titleId}>
            {title}
          </div>
          <button className="icon-btn" title={closeTitle} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
