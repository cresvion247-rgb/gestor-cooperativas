// Shared formatting for the whole app: EUR currency, DD/MM/YYYY dates and
// 24-hour times, es-ES locale (Europe/Madrid conventions).

const eurNoDecimals = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurFull = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
});

export const formatEur = (n, decimals = false) => (decimals ? eurFull : eurNoDecimals).format(n || 0);

export const formatDate = (value) => (value ? dateFmt.format(new Date(value)) : '—');

export const formatDateTime = (value) => (value ? dateTimeFmt.format(new Date(value)) : '—');