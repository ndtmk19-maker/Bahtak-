import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { triggerPrintDocument } from './lib/printDocument';

// تحويل أي استدعاء لـ window.print() في تطبيق أندرويد إلى واجهة الطباعة الأصلية
if (typeof window !== 'undefined') {
  const nativePrint = window.print.bind(window);
  window.print = () => {
    if ((window as any).AndroidNativePrint?.print) {
      (window as any).AndroidNativePrint.print(document.title || 'بحث_جامعي_منسق');
      return;
    }
    triggerPrintDocument().catch(() => nativePrint());
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
