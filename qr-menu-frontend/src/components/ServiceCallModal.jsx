import React, { useState } from 'react';
import { X, Droplets, Utensils, Receipt, BellRing, Check } from 'lucide-react';
import { api } from '../api';

export default function ServiceCallModal({
  isOpen,
  onClose,
  tableId,
  tableNumber,
  sessionToken,
  sessionLabel,
  customerName,
  onCallSuccess
}) {
  const [selectedType, setSelectedType] = useState('WATER');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const requestOptions = [
    { type: 'WATER', label: 'Cold Water', icon: Droplets, desc: 'Fresh bottled or filtered water' },
    { type: 'CUTLERY', label: 'Cutlery & Napkins', icon: Utensils, desc: 'Extra forks, spoons or tissues' },
    { type: 'BILL', label: 'Request Bill', icon: Receipt, desc: 'Ready for table checkout' },
    { type: 'CALL_WAITER', label: 'Call Waiter', icon: BellRing, desc: 'General table assistance' },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.callWaiter(tableId, selectedType, note, sessionToken, sessionLabel, customerName);
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        if (onCallSuccess) onCallSuccess(`Waiter alerted for ${selectedType.replace('_', ' ')}!`);
        onClose();
      }, 1200);
    } catch (err) {
      alert(err.message || 'Failed to call waiter');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">
              Table #{tableNumber} {sessionLabel ? `• ${sessionLabel}` : ''}
            </h3>
            <p className="text-xs text-stone-500">How can our staff assist you right now?</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <p className="font-bold text-stone-900 text-sm">Waiter Notified!</p>
            <p className="text-xs text-stone-500">A team member will be right with you at Table #{tableNumber}.</p>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {requestOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedType(opt.type)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-amber-600' : 'text-stone-600'}`} />
                    <p className={`text-xs font-bold ${isSelected ? 'text-amber-950' : 'text-stone-900'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-stone-500 leading-tight mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>

            <div>
              <input
                type="text"
                placeholder="Optional note (e.g. 2 glasses, warm water)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 outline-none focus:border-amber-500"
              />
            </div>

            <button
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full py-2.5 bg-stone-900 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-xs disabled:bg-stone-300"
            >
              {isSubmitting ? 'Summoning...' : 'Alert Staff'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

