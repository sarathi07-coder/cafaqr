import React, { useState } from 'react';
import { X, Star, Heart } from 'lucide-react';
import { api } from '../api';

export default function FeedbackModal({ isOpen, onClose, orderId, onSubmitSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderId) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await api.submitFeedback(orderId, rating, comments);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        if (onSubmitSuccess) onSubmitSuccess('Thank you for your rating!');
        onClose();
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-serif font-bold text-base text-stone-900">
              Rate Your Meal
            </h3>
            <p className="text-xs text-stone-500">How was your dining experience?</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6 fill-rose-500" />
            </div>
            <p className="font-bold text-stone-900 text-sm">Thank You!</p>
            <p className="text-xs text-stone-500">Your feedback helps our kitchen and service improve every day.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            {/* 5 Stars */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-hidden transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || rating) >= star
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="What did you love? Any dishes you recommend?"
              className="w-full text-xs p-3 rounded-xl border border-stone-200 outline-none focus:border-amber-500"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 font-bold text-stone-950 text-xs rounded-xl transition shadow-xs disabled:bg-stone-300"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

