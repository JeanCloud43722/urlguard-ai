import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import './ResultModal.css';

export interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    url: string;
    normalizedUrl: string;
    riskScore: number;
    riskLevel: 'safe' | 'suspicious' | 'dangerous';
    analysis: string;
    indicators: string[];
    confidence: number;
    certificateInfo?: {
      isSelfSigned: boolean;
      hasRisks: boolean;
    };
    affiliateInfo?: {
      name?: string;
      domain?: string;
    };
    deepseekAnalysis?: {
      analysis: string;
      phishingIndicators: string[];
    };
    createdAt: Date;
  };
  autoCloseDuration?: number;
}

const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  result,
  autoCloseDuration = 5000,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(autoCloseDuration / 1000);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onClose, 600);
    }, autoCloseDuration);

    const countdownInterval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [isOpen, autoCloseDuration, onClose]);

  if (!isOpen) return null;

  const riskColor =
    result.riskLevel === 'safe'
      ? 'from-green-500/20 to-green-600/20'
      : result.riskLevel === 'suspicious'
        ? 'from-yellow-500/20 to-yellow-600/20'
        : 'from-red-500/20 to-red-600/20';

  const riskBgColor =
    result.riskLevel === 'safe'
      ? 'bg-green-500/10'
      : result.riskLevel === 'suspicious'
        ? 'bg-yellow-500/10'
        : 'bg-red-500/10';

  const riskTextColor =
    result.riskLevel === 'safe'
      ? 'text-green-300'
      : result.riskLevel === 'suspicious'
        ? 'text-yellow-300'
        : 'text-red-300';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`result-modal fixed top-1/2 left-1/2 z-50 w-full max-w-2xl transform transition-all duration-500 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{ transform: isClosing ? 'translate(-50%, -50%) scale(0.95)' : 'translate(-50%, -50%) scale(1)' }}
      >
        <div className={`relative bg-gradient-to-br ${riskColor} border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl`}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-100">Analysis Result</h2>
              <div className={`px-4 py-2 rounded-lg font-semibold text-lg ${riskBgColor} ${riskTextColor}`}>
                {result.riskScore}%
              </div>
            </div>
            <p className="text-sm text-slate-400 break-all">{result.url}</p>
          </div>

          {/* Risk Level Badge */}
          <div className="mb-6 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              result.riskLevel === 'safe'
                ? 'bg-green-400'
                : result.riskLevel === 'suspicious'
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
            }`} />
            <span className={`text-sm font-semibold uppercase tracking-wide ${riskTextColor}`}>
              {result.riskLevel}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
          </div>

          {/* Main Analysis */}
          {result.analysis && (
            <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-slate-300 leading-relaxed">{result.analysis}</p>
            </div>
          )}

          {/* Indicators */}
          {result.indicators.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Detected Indicators</h3>
              <div className="flex flex-wrap gap-2">
                {result.indicators.map((indicator, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded-lg border border-red-500/30"
                  >
                    {indicator}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Certificate & Affiliate Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {result.certificateInfo && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-xs text-slate-400 font-semibold mb-2">Certificate</p>
                <p className="text-xs text-slate-300">
                  {result.certificateInfo.isSelfSigned ? '⚠️ Self-Signed' : '✓ Valid'}
                </p>
                {result.certificateInfo.hasRisks && (
                  <p className="text-xs text-red-300 mt-1">Risks detected</p>
                )}
              </div>
            )}
            {result.affiliateInfo && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-xs text-slate-400 font-semibold mb-2">Affiliate Info</p>
                <p className="text-xs text-slate-300 truncate">
                  {result.affiliateInfo.name || result.affiliateInfo.domain || 'Detected'}
                </p>
              </div>
            )}
          </div>

          {/* Normalized URL */}
          {result.normalizedUrl && result.normalizedUrl !== result.url && (
            <div className="mb-6 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <p className="text-xs text-slate-400 font-semibold mb-1">Normalized URL</p>
              <p className="text-xs text-blue-300 font-mono break-all">{result.normalizedUrl}</p>
            </div>
          )}

          {/* Auto-close Timer */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <p className="text-xs text-slate-400">Auto-closing in {timeLeft}s</p>
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-1000"
                style={{ width: `${(timeLeft / (autoCloseDuration / 1000)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResultModal;
