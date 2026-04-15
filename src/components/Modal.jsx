export default function Modal({ title, isOpen, onClose, children, size = 'modal-dialog' }) {
  if (!isOpen) return null;

  return (
    <div className="modal fade show d-block modal-overlay" tabIndex="-1" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={`${size} modal-dialog-centered`} role="document" onClick={(event) => event.stopPropagation()}>
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
