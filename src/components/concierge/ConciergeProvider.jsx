import React, { createContext, useContext, useState } from 'react';
import ConciergePanel from '@/components/concierge/ConciergePanel';

const ConciergeContext = createContext(null);
export const useConcierge = () => useContext(ConciergeContext);

// Estado global de apertura del conserje: cualquier punto de la app (cabecera
// o portal del socio) puede abrir el mismo panel de conversación.
export default function ConciergeProvider({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <ConciergeContext.Provider value={{ open, setOpen }}>
      {children}
      {open && <ConciergePanel onClose={() => setOpen(false)} />}
    </ConciergeContext.Provider>
  );
}