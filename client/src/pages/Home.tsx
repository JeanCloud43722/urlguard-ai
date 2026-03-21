import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Shield, AlertTriangle, CheckCircle2, Link2, History } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { VirusTotalToggle } from "@/components/VirusTotalToggle";
import { VirusTotalResults } from "@/components/VirusTotalResults";

interface CheckResult {
  id: number;
  url: string;
  normalizedUrl: string;
  riskScore: number;
  riskLevel: "safe" | "suspicious" | "dangerous";
  analysis: string;
  indicators: string[];
  confidence: number;
  certificateInfo?: any;
  virusTotalReport?: {
    malicious: number;
    suspicious: number;
    harmless: number;
  };
  createdAt: Date;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [includeVirusTotal, setIncludeVirusTotal] = useState(false);
  const [vtLoading, setVtLoading] = useState(false);

  const checkURLMutation = trpc.urlChecker.checkURL.useMutation();
  const historyQuery = trpc.urlChecker.getHistory.useQuery({ limit: 10 }, { enabled: showHistory && isAuthenticated });

  const handleCheckURL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsLoading(true);
    if (includeVirusTotal) {
      setVtLoading(true);
    }
    try {
      const res = await checkURLMutation.mutateAsync({
        url: urlInput,
        includeVirusTotal,
      });
      setResult(res as CheckResult);
      setUrlInput("");
      if (includeVirusTotal) {
        toast.success("URL analyzed with VirusTotal scan");
      } else {
        toast.success("URL analyzed successfully");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
      setVtLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">URLGuard AI</h1>
          </div>
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">{user?.name}</span>
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Phishing Detection Made Simple
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Analyze URLs in real-time with AI-powered phishing detection. Protect yourself from malicious links.
          </p>
        </div>

        {/* URL Checker Card */}
        <div className="max-w-2xl mx-auto mb-12">
          <Card className="p-8 shadow-lg border-0">
            <form onSubmit={handleCheckURL} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Enter URL to Check</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading} className="px-8">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      "Check"
                    )}
                  </Button>
                </div>
              </div>

              {/* VirusTotal Toggle */}
              {isAuthenticated && (
                <VirusTotalToggle
                  checked={includeVirusTotal}
                  onChange={setIncludeVirusTotal}
                  disabled={isLoading}
                  isLoading={vtLoading}
                />
              )}
            </form>
          </Card>
        </div>

        {/* Results Section */}
        {result && (
          <div className="max-w-2xl mx-auto mb-12">
            <Card className={`p-8 border-2 ${getRiskBgColor(result.riskLevel)}`}>
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
              <div className="bg-white/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-slate-500 mb-1">Analyzed URL</p>
                <p className="text-sm font-mono text-slate-700 break-all">{result.normalizedUrl}</p>
              </div>

              {/* Indicators */}
              {result.indicators.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Detected Indicators</p>
                  <div className="space-y-2">
                    {result.indicators.map((indicator, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-slate-400 mt-1">•</span>
                        <span>{indicator}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VirusTotal Results */}
              {result.virusTotalReport && (
                <div className="mt-6">
                  <VirusTotalResults
                    stats={result.virusTotalReport}
                    scanDate={result.createdAt?.toString()}
                  />
                </div>
              )}
            </Card>
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
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Checks</h3>
                <div className="space-y-3">
                  {historyQuery.data.length === 0 ? (
                    <p className="text-sm text-slate-500">No checks yet</p>
                  ) : (
                    historyQuery.data.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-slate-700 truncate">{check.url}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(check.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                          check.riskLevel === "safe"
                            ? "bg-green-100 text-green-700"
                            : check.riskLevel === "suspicious"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}>
                          {check.riskScore}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
