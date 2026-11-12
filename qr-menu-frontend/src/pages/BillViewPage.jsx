import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Receipt, Search, CheckCircle2, Printer, AlertCircle } from 'lucide-react';
import { api } from '../api';
import KrishLogo from '../components/KrishLogo';
import { encodeCode128B } from '../utils/barcode';
import { parseUtcTimestamp } from '../utils/time';

export default function BillViewPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [lookupInput, setLookupInput] = useState(code || '');
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(Boolean(code));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) {
      setLoading(false);
      setBill(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setLookupInput(code);

    api.getReceiptByCode(code)
      .then((data) => {
        if (!cancelled) setBill(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setBill(null);
          setError(err.message || 'Could not find bill information for this barcode.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleLookupSubmit = (e) => {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    if (!cleaned) return;
    navigate(`/bill/${encodeURIComponent(cleaned)}`);
  };

  const barcode = encodeCode128B(bill?.barcodeCode || code || 'KR-000000');

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-stone-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-5">
        {/* Top Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <KrishLogo size="md" showMascot={true} />
          <p className="text-[11px] uppercase tracking-widest font-bold text-amber-400">
            Official Digital Bill Verification
          </p>
        </div>

        {/* Barcode / Receipt Lookup Form */}
        <form onSubmit={handleLookupSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Scan or enter receipt code (e.g. KR-937DFD)"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-xs font-mono text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shrink-0"
          >
            View Bill
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-stone-400">Loading bill details for {code}...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-950/40 border border-rose-500/40 rounded-3xl p-6 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-rose-200">Bill Not Found</p>
            <p className="text-xs text-rose-300/80">{error}</p>
          </div>
        )}

        {/* Itemized Digital Bill Card */}
        {!loading && bill && (
          <div className="bg-[#FAF9F6] text-stone-950 rounded-3xl p-6 shadow-2xl border border-stone-300 space-y-4">
            <div className="text-center space-y-1 border-b-2 border-dashed border-stone-300 pb-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <img src="/krish_chef_mascot.png" alt="Chef" className="h-11 w-auto object-contain" />
                <img src="/krish_logo.png" alt="KRISH Cafe & Restaurant" className="h-12 w-auto object-contain" />
              </div>
              <h1 className="font-mono font-bold text-base uppercase tracking-wide">
                {bill.restaurantName}
              </h1>
              <p className="font-mono text-[11px] text-stone-600">{bill.address}</p>
              <p className="font-mono text-[11px] text-stone-600">PHONE: {bill.phone}</p>
            </div>

            {/* Meta Info */}
            <div className="font-mono text-xs space-y-1 border-b border-stone-300 pb-3">
              <div className="flex justify-between">
                <span className="text-stone-500">RECEIPT:</span>
                <span className="font-bold">{bill.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">TABLE:</span>
                <span className="font-bold">
                  {Number(bill.tableNumber) === 0 ? 'PARCEL' : `T${String(bill.tableNumber ?? 1).padStart(2, '0')}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">GUEST:</span>
                <span className="font-bold">{bill.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">DATE &amp; TIME:</span>
                <span>{parseUtcTimestamp(bill.paidAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>
            </div>

            {/* Dishes */}
            <div className="space-y-1.5 font-mono text-xs border-b border-stone-300 pb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                Ordered Items ({bill.items?.length || 0})
              </p>
              {(bill.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between gap-3">
                  <span>{it.quantity}X {String(it.name || '').toUpperCase()}</span>
                  <span className="font-semibold shrink-0">₹{Number(it.line_total || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="font-mono text-xs space-y-1 border-b border-stone-300 pb-3">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>₹{Number(bill.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(bill.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>DISCOUNT:</span>
                  <span>-₹{Number(bill.discountAmount).toFixed(2)}</span>
                </div>
              )}
              {Number(bill.taxAmount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>TAX (GST):</span>
                  <span>₹{Number(bill.taxAmount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1">
                <span>TOTAL:</span>
                <span>₹{Number(bill.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="font-mono text-xs flex items-center justify-between bg-stone-100 px-3.5 py-2.5 rounded-xl border border-stone-200">
              <div>
                <span className="text-[10px] text-stone-500 block">PAYMENT METHOD</span>
                <span className="font-bold">{bill.paymentMethod}</span>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                bill.status === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {bill.status}
              </span>
            </div>

            {/* Code-128B Barcode Display */}
            <div className="bg-white rounded-2xl p-3 border border-stone-200 flex flex-col items-center">
              <svg
                className="w-full max-w-[230px] h-11 block"
                viewBox={`0 0 ${barcode.totalWidth} 44`}
                preserveAspectRatio="none"
                shapeRendering="crispEdges"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="0" y="0" width={barcode.totalWidth} height="44" fill="#ffffff" />
                {barcode.bars.map((b, idx) => (
                  <rect key={idx} x={b.x} y={0} width={b.w} height={44} fill="#111111" />
                ))}
              </svg>
              <span className="font-mono text-xs font-bold tracking-[0.2em] mt-1 text-stone-900">
                {bill.barcodeCode}
              </span>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer print:hidden"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>
          </div>
        )}

        {!loading && !bill && !error && (
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-7 text-center space-y-2">
            <Receipt className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-white">Verify Any KRISH Thermal Bill</p>
            <p className="text-xs text-stone-400">
              Scan the QR or Code-128 barcode printed on a KRISH Cafe receipt to display the full itemized bill.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
