import React, { useState } from 'react';
import { X, Star, Heart, ThumbsUp, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api';

const PRAISE_TAGS = [
  '😋 Delicious Food',
  '⚡ Fast Service',
  '📲 Easy QR Ordering',
  '👨‍🍳 Courteous Staff',
  '🔥 Hot & Fresh',
  '🛋️ Great Ambiance'
];

const PROBLEM_TAGS = [
  '⏳ Long Wait Time',
  '❄️ Food Temperature',
  '🌶️ Too Spicy / Salty',
  '💧 Water Refill Delay',
  '🧾 Bill Delay',
  '💨 AC / Temperature'
];

export default function FeedbackModal({ isOpen, onClose, orderId, tableId, restaurantId, onSubmitSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const isGoodReview = (hoverRating || rating) >= 4;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleRatingChange = (newRating) => {
    setRating(newRating);
    setSelectedTags([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.submitFeedback(orderId, rating, comments, {
        tags: selectedTags,
        tableId,
        restaurantId
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        if (onSubmitSuccess) onSubmitSuccess('Thank you for your valuable feedback!');
        onClose();
      }, 1600);
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-[#120F0C] rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/15 text-stone-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-base text-white">
                Rate Your Experience
              </h3>
            </div>
            <p className="text-xs text-amber-300/80">Your review helps our chefs at KRISH improve!</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/40 text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <Heart className="w-7 h-7 fill-rose-500" />
            </div>
            <p className="font-bold text-white text-base">Thank You for Dining at KRISH!</p>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              Our culinary team and manager review every comment to deliver the best dining experience.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-3 space-y-4">
            
            {/* 5 Stars Rating Bar */}
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRatingChange(star)}
                    className="p-1 focus:outline-hidden transition-transform hover:scale-120 active:scale-95 cursor-pointer"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        (hoverRating || rating) >= star
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(255,196,0,0.6)]'
                          : 'text-stone-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className={`text-[11px] font-bold mt-2 ${isGoodReview ? 'text-emerald-400' : 'text-amber-300'}`}>
                {rating === 5 ? '🌟 Exceptional & Delicious!' :
                 rating === 4 ? '😊 Really Good Experience' :
                 rating === 3 ? '😐 Average / Can Improve' :
                 rating === 2 ? '⚠️ Disappointing Meal' : '❌ Needs Immediate Attention'}
              </span>
            </div>

            {/* Smart One-Click Quick Tags */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-300 block flex items-center gap-1">
                {isGoodReview ? (
                  <>
                    <ThumbsUp className="w-3 h-3 text-emerald-400" />
                    <span>What did you love most? (Tap to select)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span>What can we improve? (Tap to select)</span>
                  </>
                )}
              </label>

              <div className="flex flex-wrap gap-1.5">
                {(isGoodReview ? PRAISE_TAGS : PROBLEM_TAGS).map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? isGoodReview
                            ? 'bg-emerald-600 text-white shadow-md font-bold'
                            : 'bg-rose-600 text-white shadow-md font-bold'
                          : 'bg-stone-900 text-stone-300 hover:text-white border border-white/10'
                      }`}
                    >
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Box */}
            <div>
              <textarea
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={isGoodReview ? 'Any dish you loved? Tell the chef...' : 'Tell us more so we can make it right next time...'}
                className="w-full text-xs p-3 rounded-xl border border-white/15 outline-none focus:border-amber-400 bg-stone-900 text-white placeholder-stone-500 resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 krish-gradient-gold hover:brightness-110 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-[0_4px_16px_rgba(255,196,0,0.35)] cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
