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
    { type: 'WATER', label: 'Cold Water', icon: Droplets, desc: 'Fresh bottled or chilled water' },
    { type: 'CUTLERY', label: 'Cutlery & Napkins', icon: Utensils, desc: 'Extra spoons, forks, tissues' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-[#120F0C] rounded-3xl p-5 shadow-2xl border border-white/15 text-stone-100">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="font-bold text-base text-white">
              Table #{tableNumber} {sessionLabel ? `• ${sessionLabel}` : ''}
            </h3>
            <p className="text-xs text-amber-300/80">How can our team assist you right now?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccess ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <p className="font-bold text-white text-sm">Waiter Notified!</p>
            <p className="text-xs text-stone-400">A team member will be right with you at Table #{tableNumber}.</p>
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
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'krish-glass-gold border-amber-400/80 shadow-[0_4px_16px_rgba(255,196,0,0.2)]'
                        : 'bg-stone-900/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-amber-300' : 'text-stone-400'}`} />
                    <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-stone-200'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-stone-400 leading-tight mt-0.5">{opt.desc}</p>
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
                className="w-full text-xs p-2.5 rounded-xl border border-white/15 bg-stone-900 text-white placeholder-stone-500 outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full py-3 krish-gradient-gold hover:brightness-110 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-[0_4px_16px_rgba(255,196,0,0.35)] cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? 'Summoning...' : 'Alert Staff'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
