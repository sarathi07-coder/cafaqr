import React, { useState, useEffect } from 'react';
import SafeQRCode from './SafeQRCode';
import {
  X,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  Clock,
  ArrowRight,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';
import { socket } from '../socket';

// Isolated QR Error Boundary to prevent any SVG/canvas rendering issue from crashing the menu
class QRErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('QRErrorBoundary caught:', err);
  }
  render() {
    if (this.state.hasError || !this.props.value) {
      return (
        <div className="w-[190px] h-[190px] flex flex-col items-center justify-center bg-stone-50 border border-stone-200 rounded-xl p-3 mx-auto">
          <Smartphone className="w-8 h-8 text-emerald-600 mb-1" />
          <span className="text-[11px] font-bold text-stone-800">Scan via UPI App</span>
          <span className="text-[10px] text-stone-500 mt-1">Tap green button below</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function UpiPaymentModal({
  isOpen,
  onClose,
  amount = 0,
  tableId,
  tableNumber = 1,
  orderId,
  sessionToken,
  customerName = '',
  upiEnabled: propUpiEnabled = true,
  upiId: propUpiId = '',
  upiName: propUpiName = 'KRISH Cafe & Restaurant',
  onPaymentSuccess
}) {
  const [upiEnabled, setUpiEnabled] = useState(Boolean(propUpiEnabled));
  const [upiId, setUpiId] = useState(propUpiId || '');
  const [upiName, setUpiName] = useState(propUpiName || 'KRISH Cafe & Restaurant');
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch verified UPI configuration from backend
  useEffect(() => {
    if (isOpen) {
      api.getUpiInfo(tableId)
        .then((info) => {
          setUpiEnabled(Boolean(info?.upiEnabled) && Boolean(info?.upiId));
          setUpiId(info?.upiId || '');
          if (info?.upiName) setUpiName(info.upiName);
        })
        .catch((err) => {
          console.warn('Could not fetch dynamic UPI info:', err.message);
        });
    }
  }, [isOpen, tableId]);

  // Clean bill amount (two decimals)
  const payableAmount = parseFloat(amount || 0).toFixed(2);
  const transactionNote = `Table ${tableNumber} Bill`;

  // Standard NPCI UPI URI Specification
  // Format: upi://pay?pa=<VPA>&pn=<NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${payableAmount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  // Listen for real-time settlement from cashier
  useEffect(() => {
    if (!isOpen) return;

    function handleSettled(data) {
      if (
        data?.tableId === tableId ||
        data?.orderId === orderId ||
        (data?.orderIds && orderId && data.orderIds.includes(orderId))
      ) {
        triggerSuccess();
      }
    }

    function handleOrderStatus(data) {
      if (
        (data?.orderId === orderId || data?.id === orderId) &&
        (data?.status === 'PAID' || data?.newStatus === 'PAID')
      ) {
        triggerSuccess();
      }
    }

    socket.on('table:settled_all', handleSettled);
    socket.on('order:dismissed', handleSettled);
    socket.on('session:ended', handleSettled);
    socket.on('order:status_updated', handleOrderStatus);

    return () => {
      socket.off('table:settled_all', handleSettled);
      socket.off('order:dismissed', handleSettled);
      socket.off('session:ended', handleSettled);
      socket.off('order:status_updated', handleOrderStatus);
    };
  }, [isOpen, tableId, orderId]);

  const triggerSuccess = () => {
    setIsVerified(true);
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      })
      .catch(() => {});

    setTimeout(() => {
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
      onClose();
    }, 1800);
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunchMobileUpi = () => {
    // Open UPI intent in mobile browser
    window.location.href = upiUri;
  };

  const handleSubmitPaymentNotice = async () => {
    if (parseFloat(payableAmount) <= 0) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await api.submitUpiPayment({
        tableId,
        tableNumber,
        orderId,
        sessionToken,
        customerName,
        amount: parseFloat(payableAmount),
        utr: utrNumber.trim() || null,
        upiId
      });
      setPaymentSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit payment alert to cashier');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 z-10 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-stone-900 via-stone-850 to-stone-900 text-white px-5 py-4 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-white tracking-tight leading-none">
                Scan & Pay via UPI
              </h3>
              <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1.5">
                <span>Table #{tableNumber}</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-semibold">Zero Gateway Fees</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Success settlement screen */}
          {isVerified ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-black text-stone-900 font-serif">
                Payment Verified & Settled!
              </h4>
              <p className="text-xs text-stone-600 max-w-xs mx-auto">
                Thank you for dining at {upiName}. Your bill of ₹{payableAmount} has been marked paid.
              </p>
            </div>
          ) : (!upiEnabled || !upiId) ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-stone-900 font-serif">
                UPI Payment Currently Disabled
              </h4>
              <p className="text-xs text-stone-600 max-w-xs mx-auto">
                Online UPI payments are turned off by the restaurant right now. Please settle your bill of ₹{payableAmount} via Cash or Card at the counter.
              </p>
            </div>
          ) : (
            <>
              {/* Total Amount Card */}
              <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                    Amount to Pay
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-stone-950 font-serif">
                      ₹{payableAmount}
                    </span>
                    <span className="text-[10px] text-stone-400">(exact bill total)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-500 font-medium block">Payee</span>
                  <span className="text-xs font-bold text-stone-800 truncate max-w-[130px] block">
                    {upiName}
                  </span>
                </div>
              </div>

              {/* Dynamic QR Code Card */}
              <div className="bg-white rounded-2xl border-2 border-dashed border-stone-200 p-4 text-center shadow-xs">
                <div className="inline-block p-3 bg-white rounded-2xl shadow-sm border border-stone-100">
                  <QRErrorBoundary value={upiUri}>
                    <SafeQRCode
                      value={upiUri}
                      size={190}
                      level="M"
                      className="mx-auto"
                    />
                  </QRErrorBoundary>
                </div>

                <div className="mt-3 flex items-center justify-center gap-2 text-stone-500 text-xs font-semibold">
                  <span>GPay</span>
                  <span>&bull;</span>
                  <span>PhonePe</span>
                  <span>&bull;</span>
                  <span>Paytm</span>
                  <span>&bull;</span>
                  <span>BHIM</span>
                  <span>&bull;</span>
                  <span>CRED</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Scan using any UPI App on your phone
                </p>
              </div>

              {/* Mobile 1-Tap Intent Launcher */}
              <button
                onClick={handleLaunchMobileUpi}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Pay via UPI App (GPay / PhonePe)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* UPI ID Copy Card */}
              <div className="bg-stone-100/80 rounded-xl p-3 border border-stone-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">
                    Restaurant UPI ID
                  </span>
                  <span className="font-mono text-xs font-bold text-stone-800 truncate block select-all">
                    {upiId}
                  </span>
                </div>
                <button
                  onClick={handleCopyUpi}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* UTR / Payment Submission Section */}
              <div className="pt-2 border-t border-stone-200 space-y-2.5">
                {paymentSubmitted ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-amber-800 font-bold text-xs">
                      <Clock className="w-4 h-4 animate-spin text-amber-600" />
                      <span>Awaiting Cashier Verification</span>
                    </div>
                    <p className="text-[11px] text-amber-700">
                      Payment notification sent! Cashier has been alerted on the billing counter. This window will automatically update once verified.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        12-Digit UPI Reference / UTR No. <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        maxLength={20}
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                        placeholder="e.g. 431289123456"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                    </div>

                    {errorMessage && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 text-[11px] text-rose-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <button
                      disabled={isSubmitting}
                      onClick={handleSubmitPaymentNotice}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Sending Alert to Cashier...</span>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>I Have Paid &bull; Notify Cashier</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-5 py-2.5 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-500">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Direct Bank Transfer</span>
          </div>
          <span>NPCI UPI 2.0</span>
        </div>
      </div>
    </div>
  );
}

