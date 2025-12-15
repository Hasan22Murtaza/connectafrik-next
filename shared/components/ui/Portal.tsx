import { createPortal } from 'react-dom';
import React from 'react';

export default function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
