import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { trpc } from '../lib/trpc';
import './ResultModal.css';

export interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    id?: number;
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
    ocrResults?: {
      extractedText: string;
      indicators: string[];
      confidence: number;
      summary: string;
    };
    screenshotUrl?: string;
    ocrQueued?: boolean;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'ocr' | 'metadata' | 'xml'>('overview');
  const [ocrData, setOcrData] = useState<any>(null);
  const [metadataData, setMetadataData] = useState<any>(null);
  const [xmlData, setXmlData] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Polling queries
  const ocrQuery = trpc.screenshots.getOCR.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  const metadataQuery = trpc.screenshots.getStructuredMetadata.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  const xmlQuery = trpc.screenshots.getXmlData.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  // Start polling when modal opens
  useEffect(() => {
    if (!isOpen || !result.id) return;

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const [ocr, metadata, xml] = await Promise.all([
          ocrQuery.refetch(),
          metadataQuery.refetch(),
          xmlQuery.refetch(),
        ]);

        if (ocr.data) setOcrData(ocr.data);
        if (metadata.data) setMetadataData(metadata.data);
        if (xml.data) setXmlData(xml.data);

        // Stop polling if all data is loaded
        if (ocr.data && metadata.data && xml.data) {
          setIsPolling(false);
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.error('[ResultModal] Polling error:', e);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, result.id]);

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

  const tabClasses = (tab: string) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'text-white border-b-2 border-blue-400'
        : 'text-slate-400 hover:text-slate-300 border-b-2 border-transparent'
    }`;

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
        className={`result-modal fixed top-1/2 left-1/2 z-50 w-full max-w-3xl transform transition-all duration-500 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{ transform: isClosing ? 'translate(-50%, -50%) scale(0.95)' : 'translate(-50%, -50%) scale(1)' }}
      >
        <div className={`relative bg-gradient-to-br ${riskColor} border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl max-h-[80vh] overflow-y-auto`}>
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
            <div
              className={`w-3 h-3 rounded-full ${
                result.riskLevel === 'safe'
                  ? 'bg-green-400'
                  : result.riskLevel === 'suspicious'
                    ? 'bg-yellow-400'
                    : 'bg-red-400'
              }`}
            />
            <span className={`text-sm font-semibold uppercase tracking-wide ${riskTextColor}`}>
              {result.riskLevel}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 border-b border-white/10">
            <button onClick={() => setActiveTab('overview')} className={tabClasses('overview')}>
              Overview
            </button>
            <button onClick={() => setActiveTab('ocr')} className={tabClasses('ocr')}>
              OCR {ocrData && '✓'}
            </button>
            <button onClick={() => setActiveTab('metadata')} className={tabClasses('metadata')}>
              Metadata {metadataData && '✓'}
            </button>
            <button onClick={() => setActiveTab('xml')} className={tabClasses('xml')}>
              XML {xmlData && '✓'}
            </button>
          </div>

          {/* Tab Content */}
          <div className="mb-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
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
              </div>
            )}

            {/* OCR Tab */}
            {activeTab === 'ocr' && (
              <div>
                {isPolling && !ocrData && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading OCR data...</span>
                  </div>
                )}
                {ocrData?.ocrText && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-xs text-slate-400 font-semibold mb-2">Extracted Text</p>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {ocrData.ocrText.substring(0, 1000)}...
                    </p>
                    {ocrData.ocrProcessedAt && (
                      <p className="text-xs text-slate-500 mt-2">
                        Processed: {new Date(ocrData.ocrProcessedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {!ocrData && !isPolling && (
                  <p className="text-xs text-slate-400">No OCR data available</p>
                )}
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div>
                {isPolling && !metadataData && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading metadata...</span>
                  </div>
                )}
                {metadataData?.metadata && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 max-h-64 overflow-y-auto">
                    <p className="text-xs text-slate-400 font-semibold mb-2">Page Metadata</p>
                    <pre className="text-xs text-slate-300 font-mono">
                      {JSON.stringify(metadataData.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                {!metadataData && !isPolling && (
                  <p className="text-xs text-slate-400">No metadata available</p>
                )}
              </div>
            )}

            {/* XML Tab */}
            {activeTab === 'xml' && (
              <div>
                {isPolling && !xmlData && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading XML data...</span>
                  </div>
                )}
                {xmlData?.xmlData && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 max-h-64 overflow-y-auto">
                    <p className="text-xs text-slate-400 font-semibold mb-2">XML Data (Sitemap/RSS)</p>
                    <pre className="text-xs text-slate-300 font-mono">
                      {JSON.stringify(xmlData.xmlData, null, 2)}
                    </pre>
                  </div>
                )}
                {!xmlData && !isPolling && (
                  <p className="text-xs text-slate-400">No XML data available</p>
                )}
              </div>
            )}
          </div>

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
