/*
 * FICHIER: src/shared/components/ui/ToastContainer.tsx
 * Composant d'affichage des notifications toast (coin bas-droite)
 * Inclus une seule fois dans EntrepriseApp.tsx
 */

import React from 'react';
import { useToast } from '../../context/ToastContext';

// Icônes selon le type de toast
const ICONS: Record<string, string> = {
  s: 'fa-check-circle',
  i: 'fa-circle-info',
  w: 'fa-triangle-exclamation',
  e: 'fa-circle-xmark',
};

export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div id="tct">
      {toasts.map(toast => (
        <div key={toast.id} className={`tmsg ${toast.type} show`}>
          <i className={`fas ${ICONS[toast.type] || 'fa-circle-info'}`}></i>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}