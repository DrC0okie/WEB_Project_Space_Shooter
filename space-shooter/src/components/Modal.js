import React from 'react';
import './Modal.css';

/**
 * Modal component to display a modal dialog.
 *
 * @param {object} props - The props for the component.
 * @param {boolean} props.show - Whether the modal should be shown.
 * @param {function} props.onClose - The function to call when closing the modal.
 * @param {string} props.title - The title of the modal.
 * @param {React.ReactNode} props.children - The content of the modal.
 * @returns {JSX.Element|null} The rendered modal component.
 */
const Modal = ({ show, onClose, title, children }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
