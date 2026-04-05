import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, AlertTriangle, CheckCircle2, Link2, History } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import BorderGlow from "@/components/BorderGlow";
import Aurora from "@/components/Aurora";
import DotGrid from "@/components/DotGrid";
import StarBorder from "@/components/StarBorder";
import ResultModal from '@/components/ResultModal';
import DecryptedText from '@/components/DecryptedText';

interface CheckResult {
  id: number;
  url: string;
  normalizedUrl: string;
  riskScore: number;
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string;
  indicators: string[];
  confidence: number;
  createdAt: Date;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkURLMutation = trpc.urlChecker.checkURL.useMutation();
  const historyQuery = trpc.urlChecker.getHistory.useQuery({ limit: 10 }, { enabled: showHistory && isAuthenticated });

  const handleCheckURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsLoading(true);
    try {
      const res = await checkURLMutation.mutateAsync({ url: urlInput });
      setResult(res as CheckResult);
      setUrlInput("");
      setShowResultModal(true);
      toast.success("URL analyzed successfully");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "safe":
        return "text-green-600";
      case "suspicious":
        return "text-yellow-600";
      case "dangerous":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case "safe":
        return "bg-green-50 border-green-200";
      case "suspicious":
        return "bg-yellow-50 border-yellow-200";
      case "dangerous":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "safe":
        return <CheckCircle2 className="w-8 h-8 text-green-600" />;
      case "suspicious":
        return <AlertTriangle className="w-8 h-8 text-yellow-600" />;
      case "dangerous":
        return <Shield className="w-8 h-8 text-red-600" />;
      default:
        return <Link2 className="w-8 h-8 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark relative">
      {/* Aurora Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Aurora 
          colorStops={['#0ea5e9', '#3b82f6', '#1e40af']}
          amplitude={0.8}
          blend={0.5}
        />
      </div>

      {/* DotGrid Background */}
      {mounted && (
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <DotGrid
            dotSize={5}
            gap={15}
            baseColor="#1e293b"
            activeColor="#3b82f6"
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
          />
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-50 w-full">
        <BorderGlow 
          glowColor="210 100 50" 
          borderRadius={0} 
          glowIntensity={1.2} 
          edgeSensitivity={40}
          backgroundColor="#060010"
          animated={true}
        >
          <div className="bg-slate-900/90 backdrop-blur-md border-b border-white/10">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-400" />
                <h1 className="text-2xl font-bold text-slate-100">URLGuard AI</h1>
              </div>
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-300">{user?.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/batch")}>
                    Batch Check
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/export")}>
                    Export
                  </Button>
                  <Button variant="outline" size="sm">
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => (window.location.href = getLoginUrl())}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </BorderGlow>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-12 relative z-10 overflow-y-auto" style={{maxHeight: 'calc(100vh - 80px)'}}>
        <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            <DecryptedText 
              text="Phishing Detection Made Simple" 
              speed={50}
              maxIterations={15}
              sequential={true}
              revealDirection="center"
              animateOn="view"
              className="text-slate-100"
              encryptedClassName="text-blue-400/60"
            />
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            <DecryptedText 
              text="Analyze URLs in real-time with AI-powered phishing detection. Protect yourself from malicious links." 
              speed={30}
              maxIterations={20}
              sequential={true}
              revealDirection="start"
              animateOn="view"
              className="text-slate-400"
              encryptedClassName="text-slate-500/40"
            />
          </p>
        </div>

          {/* URL Checker Card */}
          <div className="max-w-2xl mx-auto mb-12">
            <BorderGlow glowColor="210 100 50" borderRadius={28} glowIntensity={1.2} edgeSensitivity={40} backgroundColor="#060010" animated={true}>
              <Card className="p-8 shadow-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl text-slate-100 rounded-[28px]">
                <form onSubmit={handleCheckURL} className="space-y-6">
                  <div className="space-y-4">
                    <label htmlFor="url-input" className="text-center block text-2xl md:text-3xl font-bold text-slate-100">Enter URL to Check</label>
                    <div className="flex flex-col gap-4">
                      <input
                        id="url-input"
                        type="url"
                        placeholder="https://example.com"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-6 py-3 rounded-full bg-slate-800/50 border border-blue-500/30 text-slate-100 placeholder-slate-500 text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        autoComplete="url"
                        spellCheck="false"
                        aria-label="Search input field"
                      />
                      <BorderGlow
                        borderRadius={28}
                        glowIntensity={1.2}
                        edgeSensitivity={40}
                        className="w-full"
                      >
                        <StarBorder
                          as="button"
                          type="submit"
                          disabled={isLoading}
                          color="#3b82f6"
                          speed="6s"
                          thickness={2}
                          className="w-full px-6 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-lg border border-blue-500/30 text-center"
                          aria-label="Check URL for phishing"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin inline" />
                          ) : (
                            "CHECK"
                          )}
                        </StarBorder>
                      </BorderGlow>
                    </div>
                  </div>
                </form>
              </Card>
            </BorderGlow>
          </div>

          {/* Loading State */}
          {isLoading && (
          <div className="max-w-2xl mx-auto mb-12">
            <BorderGlow 
              glowColor="210 100 50"
              borderRadius={28}
              glowIntensity={1.2}
              edgeSensitivity={40}
              backgroundColor="#060010"
              animated={true}
            >
              <Card className="p-8 border border-white/10 bg-slate-900/40 backdrop-blur-xl rounded-[28px]">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="h-8 bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-700 to-slate-600 rounded w-3/4 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gradient-to-r from-slate-700 to-slate-600 rounded animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-700 to-slate-600 rounded w-5/6 animate-pulse" />
                    <div className="h-4 bg-gradient-to-r from-slate-700 to-slate-600 rounded w-4/6 animate-pulse" />
                  </div>
                </div>
              </Card>
            </BorderGlow>
          </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="max-w-2xl mx-auto mb-12">
            <BorderGlow 
              glowColor={result.riskLevel === 'safe' ? '120 100 50' : result.riskLevel === 'suspicious' ? '40 100 50' : '0 100 50'}
              borderRadius={28}
              glowIntensity={1.2}
              edgeSensitivity={40}
              backgroundColor="#060010"
            >
              <Card className="max-w-2xl mx-auto p-8 border border-white/10 bg-slate-900/40 backdrop-blur-xl text-slate-100 rounded-[28px]">
              <div className="flex items-start gap-6 mb-6">
                <div className="flex-shrink-0">{getRiskIcon(result.riskLevel)}</div>
                <div className="flex-1">
                  <h3 className={`text-2xl font-bold mb-2 ${getRiskColor(result.riskLevel)}`}>
                    {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">{result.analysis}</p>
                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500">Risk Score</p>
                      <p className={`text-3xl font-bold ${getRiskColor(result.riskLevel)}`}>
                        {result.riskScore}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Confidence</p>
                      <p className="text-3xl font-bold text-blue-600">{Math.round(result.confidence * 100)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL Info */}
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-400 mb-1">Analyzed URL</p>
                <p className="text-sm font-mono text-slate-200 break-all">{result.normalizedUrl}</p>
              </div>

              {/* Indicators */}
              {result.indicators.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-200 mb-3">Detected Indicators</p>
                  <div className="space-y-2">
                    {result.indicators.map((indicator, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-slate-500 mt-1">•</span>
                        <span>{indicator}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            </BorderGlow>
          </div>
          )}

          {/* History Section */}
          {isAuthenticated && (
            <div className="max-w-2xl mx-auto">
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full mb-4"
            >
              <History className="w-4 h-4 mr-2" />
              {showHistory ? "Hide" : "Show"} History
            </Button>

            {showHistory && historyQuery.data && (
              <Card className="p-6 border border-white/10 bg-slate-900/40 backdrop-blur-xl max-h-96 overflow-y-auto">
                <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Checks</h3>
                <div className="space-y-3">
                  {historyQuery.data.length === 0 ? (
                    <p className="text-sm text-slate-400">No checks yet</p>
                  ) : (
                    historyQuery.data.map((check) => {
                      let phishingReasons: string[] = [];
                      try {
                        phishingReasons = check.phishingReasons && typeof check.phishingReasons === 'string' ? JSON.parse(check.phishingReasons) : (Array.isArray(check.phishingReasons) ? check.phishingReasons : []);
                      } catch (e) {
                        console.warn('Failed to parse phishingReasons:', e);
                      }
                      let deepseekAnalysis: any = null;
                      try {
                        deepseekAnalysis = check.deepseekAnalysis && typeof check.deepseekAnalysis === 'string' ? JSON.parse(check.deepseekAnalysis) : check.deepseekAnalysis;
                      } catch (e) {
                        console.warn('Failed to parse deepseekAnalysis:', e);
                      }
                      let affiliateInfo: any = null;
                      try {
                        affiliateInfo = check.affiliateInfo && typeof check.affiliateInfo === 'string' ? JSON.parse(check.affiliateInfo) : check.affiliateInfo;
                      } catch (e) {
                        console.warn('Failed to parse affiliateInfo:', e);
                      }
                      
                      return (
                      <div
                        key={check.id}
                        className="p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-slate-200 break-all">{check.url}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(check.createdAt).toLocaleDateString()} at {new Date(check.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            check.riskLevel === "safe"
                              ? "bg-green-500/20 text-green-300 border border-green-500/30"
                              : check.riskLevel === "suspicious"
                                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                                : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}>
                            {check.riskScore}%
                          </div>
                        </div>
                        {(check as any).normalizedUrl && (check as any).normalizedUrl !== check.url && (
                          <div>
                            <p className="text-xs text-slate-400 font-semibold">Normalized:</p>
                            <p className="text-xs text-slate-300 font-mono break-all">{(check as any).normalizedUrl}</p>
                          </div>
                        )}
                        {phishingReasons.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 font-semibold">Indicators:</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {phishingReasons.map((reason: string, idx: number) => (
                                <span key={idx} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(check as any).screenshotUrl && (
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                            Screenshot available
                          </div>
                        )}
                      </div>
                    );
                    })
                  )}
                </div>
              </Card>
            )}
            </div>
          )}
        </div>
      </div>
      </div>
  );
}
