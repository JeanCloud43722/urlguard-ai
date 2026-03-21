import { AlertTriangle, CheckCircle2, Shield, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface VirusTotalStats {
  malicious: number;
  suspicious: number;
  harmless: number;
}

interface VirusTotalResultsProps {
  stats: VirusTotalStats;
  scanDate?: string;
  vendors?: string[];
}

export function VirusTotalResults({
  stats,
  scanDate,
  vendors = [],
}: VirusTotalResultsProps) {
  const total = stats.malicious + stats.suspicious + stats.harmless;
  const detectionRate = total > 0 ? Math.round((stats.malicious / total) * 100) : 0;

  const getRiskLevel = () => {
    if (stats.malicious > 0) return "dangerous";
    if (stats.suspicious > 0) return "suspicious";
    return "safe";
  };

  const getRiskColor = () => {
    const level = getRiskLevel();
    switch (level) {
      case "dangerous":
        return "text-red-600";
      case "suspicious":
        return "text-yellow-600";
      default:
        return "text-green-600";
    }
  };

  const getRiskBgColor = () => {
    const level = getRiskLevel();
    switch (level) {
      case "dangerous":
        return "bg-red-50 border-red-200";
      case "suspicious":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-green-50 border-green-200";
    }
  };

  const getRiskIcon = () => {
    const level = getRiskLevel();
    switch (level) {
      case "dangerous":
        return <Shield className="w-6 h-6 text-red-600" />;
      case "suspicious":
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      default:
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
    }
  };

  return (
    <Card className={`p-6 border-2 ${getRiskBgColor()}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">{getRiskIcon()}</div>
          <div className="flex-1">
            <h4 className={`text-lg font-bold mb-1 ${getRiskColor()}`}>
              VirusTotal Report
            </h4>
            <p className="text-sm text-slate-600">
              Scanned against {total} antivirus engines
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Malicious */}
          <div className="bg-white/60 rounded-lg p-3 border border-red-100">
            <p className="text-xs text-slate-500 mb-1">Malicious</p>
            <p className="text-2xl font-bold text-red-600">{stats.malicious}</p>
          </div>

          {/* Suspicious */}
          <div className="bg-white/60 rounded-lg p-3 border border-yellow-100">
            <p className="text-xs text-slate-500 mb-1">Suspicious</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.suspicious}</p>
          </div>

          {/* Harmless */}
          <div className="bg-white/60 rounded-lg p-3 border border-green-100">
            <p className="text-xs text-slate-500 mb-1">Harmless</p>
            <p className="text-2xl font-bold text-green-600">{stats.harmless}</p>
          </div>
        </div>

        {/* Detection Rate */}
        {stats.malicious > 0 && (
          <div className="bg-white/60 rounded-lg p-3 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-slate-700">Detection Rate</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(detectionRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 mt-1">{detectionRate}% of engines flagged this URL</p>
          </div>
        )}

        {/* Vendors List */}
        {vendors.length > 0 && (
          <div className="bg-white/60 rounded-lg p-3 border border-red-100">
            <p className="text-sm font-medium text-slate-700 mb-2">Flagged by:</p>
            <div className="flex flex-wrap gap-2">
              {vendors.slice(0, 5).map((vendor) => (
                <span
                  key={vendor}
                  className="inline-block bg-red-100 text-red-700 text-xs px-2 py-1 rounded"
                >
                  {vendor}
                </span>
              ))}
              {vendors.length > 5 && (
                <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded">
                  +{vendors.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Scan Date */}
        {scanDate && (
          <p className="text-xs text-slate-500">
            Last scanned: {new Date(scanDate).toLocaleString()}
          </p>
        )}
      </div>
    </Card>
  );
}
