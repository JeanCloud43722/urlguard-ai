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
    isPreliminary?: boolean;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'ocr' | 'metadata' | 'xml' | 'fingerprint' | 'cluster' | 'deepfake' | 'redirects'>('overview');
  const [ocrData, setOcrData] = useState<any>(null);
  const [metadataData, setMetadataData] = useState<any>(null);
  const [xmlData, setXmlData] = useState<any>(null);
  const [fingerprintData, setFingerprintData] = useState<any>(null);
  const [clusterData, setClusterData] = useState<any>(null);
  const [deepfakeData, setDeepfakeData] = useState<any>(null);
  const [redirectData, setRedirectData] = useState<any>(null);
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

  const fingerprintQuery = trpc.analysis.getFingerprint.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  const deepfakeQuery = trpc.screenshots.getDeepfakeRisk.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  const clusterQuery = trpc.analysis.getCluster.useQuery(
    { checkId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  const redirectQuery = trpc.urlChecker.getRedirectChain.useQuery(
    { urlCheckId: result.id || 0 },
    { enabled: false, staleTime: 0 }
  );

  // Start polling when modal opens
  useEffect(() => {
    if (!isOpen || !result.id) return;

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        const [ocr, metadata, xml, deepfake, redirect] = await Promise.all([
          ocrQuery.refetch(),
          metadataQuery.refetch(),
          xmlQuery.refetch(),
          deepfakeQuery.refetch(),
          redirectQuery.refetch(),
        ]);

        if (ocr.data) setOcrData(ocr.data);
        if (metadata.data) setMetadataData(metadata.data);
        if (xml.data) setXmlData(xml.data);
        if (deepfake.data) setDeepfakeData(deepfake.data);
        if (redirect.data) setRedirectData(redirect.data);

        // Stop polling if all data is loaded
        if (ocr.data && metadata.data && xml.data && deepfake.data) {
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
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-100">Analysis Result</h2>
                {result.isPreliminary && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-semibold animate-pulse border border-yellow-500/30">
                    ⏳ First Scan (Heuristic)
                  </span>
                )}
                {!result.isPreliminary && result.riskScore > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs font-semibold border border-green-500/30">
                    ✅ Deep Analysis Complete
                  </span>
                )}
              </div>
              <div className={`px-4 py-2 rounded-lg font-semibold text-lg ${riskBgColor} ${riskTextColor}`}>
                {result.riskScore}%
              </div>
            </div>
            <p className="text-sm text-slate-400 break-all">{result.url}</p>
            {result.isPreliminary && (
              <p className="text-xs text-yellow-400 mt-2">🔄 Deeper analysis is running in the background. Results will update automatically...</p>
            )}
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
            <button onClick={() => setActiveTab('fingerprint')} className={tabClasses('fingerprint')}>
              Fingerprint {fingerprintData && '✓'}
            </button>
            <button onClick={() => setActiveTab('cluster')} className={tabClasses('cluster')}>
              Campaign {clusterData && '✓'}
            </button>
            <button onClick={() => setActiveTab('deepfake')} className={tabClasses('deepfake')}>
              Deepfake {deepfakeData && '✓'}
            </button>
            <button onClick={() => setActiveTab('redirects')} className={tabClasses('redirects')}>
              Redirects {redirectData && '✓'}
            </button>
          </div>

          {/* Tab Content */}
          <div className="mb-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                {/* Preliminary Analysis Warning */}
                {result.isPreliminary && (
                  <div className="mb-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <p className="text-sm text-yellow-300"><strong>🔄 First analysis based on URL structure.</strong> Deep AI analysis is running in the background and will update within 5-10 seconds.</p>
                  </div>
                )}

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

            {/* Fingerprint Tab */}
            {activeTab === 'fingerprint' && (
              <div>
                {isPolling && !fingerprintData && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Collecting browser fingerprint...</span>
                  </div>
                )}
                {fingerprintData && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Bot Detection</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${fingerprintData.isBotLikely ? 'bg-red-400' : 'bg-green-400'}`} />
                        <span className={`text-xs font-semibold ${fingerprintData.isBotLikely ? 'text-red-300' : 'text-green-300'}`}>
                          {fingerprintData.isBotLikely ? 'Bot-like behavior detected' : 'Real browser detected'}
                        </span>
                      </div>
                    </div>
                    {fingerprintData.botIndicators?.length > 0 && (
                      <div className="mb-3 pb-3 border-b border-white/10">
                        <p className="text-xs text-slate-400 font-semibold mb-2">Bot Indicators</p>
                        <div className="flex flex-wrap gap-1">
                          {fingerprintData.botIndicators.map((indicator: string, idx: number) => (
                            <span key={idx} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30">
                              {indicator}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-slate-400">
                      <p className="mb-1"><strong>Platform:</strong> {fingerprintData.platform}</p>
                      <p className="mb-1"><strong>User Agent:</strong> {fingerprintData.userAgent?.substring(0, 50)}...</p>
                      <p><strong>Timezone:</strong> {fingerprintData.timezone}</p>
                    </div>
                  </div>
                )}
                {!fingerprintData && !isPolling && (
                  <p className="text-xs text-slate-400">No fingerprint data available</p>
                )}
              </div>
            )}

            {/* Campaign Tab */}
            {activeTab === 'cluster' && (
              <div>
                {isPolling && !clusterData && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing campaign...</span>
                  </div>
                )}
                {clusterData && (
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Campaign Info</p>
                      <p className="text-sm font-semibold text-slate-200">{clusterData.clusterName}</p>
                      <p className="text-xs text-slate-400 mt-1">ID: {clusterData.clusterId}</p>
                    </div>
                    <div className="mb-3 pb-3 border-b border-white/10">
                      <p className="text-xs text-slate-400 font-semibold mb-2">Campaign Stats</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-slate-400">Members:</span> <span className="text-slate-200 font-semibold">{clusterData.memberCount}</span></div>
                        <div><span className="text-slate-400">Similarity:</span> <span className="text-slate-200 font-semibold">{clusterData.similarity}%</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-semibold mb-2">Structural Features</p>
                      <div className="text-xs text-slate-300">
                        <p><strong>Forms:</strong> {clusterData.formCount}</p>
                        <p><strong>Input Types:</strong> {clusterData.inputTypes?.join(', ') || 'N/A'}</p>
                        <p><strong>External Scripts:</strong> {clusterData.externalScripts?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
                {!clusterData && !isPolling && (
                  <p className="text-xs text-slate-400">No campaign data available</p>
                )}
              </div>
            )}

            {/* Deepfake Risk Tab */}
            {activeTab === 'deepfake' && (
              <div>
                {deepfakeData ? (
                  <div>
                    {/* Permission Indicators */}
                    <div className="mb-4 space-y-2">
                      {deepfakeData.hasCameraRequest && (
                        <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                          <span className="text-yellow-400 text-lg">⚠️</span>
                          <div>
                            <p className="text-sm font-semibold text-yellow-300">Camera Access Requested</p>
                            <p className="text-xs text-yellow-200 mt-1">This page requests access to your camera</p>
                          </div>
                        </div>
                      )}
                      {deepfakeData.hasMicrophoneRequest && (
                        <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                          <span className="text-yellow-400 text-lg">⚠️</span>
                          <div>
                            <p className="text-sm font-semibold text-yellow-300">Microphone Access Requested</p>
                            <p className="text-xs text-yellow-200 mt-1">This page requests access to your microphone</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Deepfake Analysis Result */}
                    {deepfakeData.deepfakeRisk ? (
                      <div className={`p-4 rounded-lg border ${
                        deepfakeData.deepfakeRisk.isDeepfakeScam
                          ? 'bg-red-500/20 border-red-500/30'
                          : 'bg-green-500/20 border-green-500/30'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">
                            {deepfakeData.deepfakeRisk.isDeepfakeScam ? '🚨' : '✅'}
                          </span>
                          <div className="flex-1">
                            <h4 className={`font-bold text-sm ${
                              deepfakeData.deepfakeRisk.isDeepfakeScam
                                ? 'text-red-300'
                                : 'text-green-300'
                            }`}>
                              {deepfakeData.deepfakeRisk.isDeepfakeScam
                                ? 'Deepfake Scam Detected'
                                : 'No Deepfake Risk Detected'}
                            </h4>
                            <p className="text-xs text-slate-300 mt-2">
                              {deepfakeData.deepfakeRisk.reason}
                            </p>
                            <p className={`text-xs mt-2 font-semibold ${
                              deepfakeData.deepfakeRisk.isDeepfakeScam
                                ? 'text-red-400'
                                : 'text-green-400'
                            }`}>
                              Confidence: {(deepfakeData.deepfakeRisk.confidence * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No deepfake analysis available</p>
                    )}
                  </div>
                ) : !isPolling ? (
                  <p className="text-xs text-slate-400">No deepfake risk data available</p>
                ) : (
                  <p className="text-xs text-slate-400">Loading deepfake analysis...</p>
                )}
              </div>
            )}

            {/* Redirects Tab */}
            {activeTab === 'redirects' && (
              <div>
                {redirectData ? (
                  <div>
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded">
                      <p className="text-xs font-semibold text-amber-300 mb-2">Redirect Chain</p>
                      <p className="text-xs text-amber-200">
                        {redirectData.chain.originalUrl} → {redirectData.chain.redirectCount} hops → {redirectData.chain.finalUrl}
                      </p>
                      {redirectData.chain.isMalicious && (
                        <p className="text-xs text-red-400 mt-2">⚠️ Suspicious redirect pattern detected</p>
                      )}
                    </div>
                    {redirectData.hops.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 mb-2">Redirect Hops</h4>
                        <div className="space-y-2">
                          {redirectData.hops.map((hop: any, idx: number) => (
                            <div key={idx} className="text-xs p-2 bg-white/5 rounded border border-white/10">
                              <p className="text-slate-400">Hop {idx + 1}: {hop.statusCode}</p>
                              <p className="text-slate-500 text-xs mt-1 break-all">{hop.fromUrl}</p>
                              <p className="text-slate-500 text-xs mt-1 break-all">→ {hop.toUrl}</p>
                              <p className="text-slate-600 text-xs mt-1">{hop.responseTimeMs}ms</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : !isPolling ? (
                  <p className="text-xs text-slate-400">No redirect data available</p>
                ) : (
                  <p className="text-xs text-slate-400">Analyzing redirects...</p>
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
