import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Link2, BarChart3, TrendingUp } from 'lucide-react';

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(7);

  const { data: suspiciousPatterns, isLoading: patternsLoading } =
    trpc.analytics.getTopSuspiciousPatterns.useQuery({ days, limit: 10 });
  const { data: topSources, isLoading: sourcesLoading } =
    trpc.analytics.getTopRedirectSources.useQuery({ days, limit: 10 });
  const { data: chainDistribution, isLoading: distLoading } =
    trpc.analytics.getChainLengthDistribution.useQuery();
  const { data: recentSuspicious, isLoading: recentLoading } =
    trpc.analytics.getRecentSuspiciousRedirects.useQuery({ limit: 20 });
  const { data: stats } = trpc.analytics.getRedirectStats.useQuery();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Redirect Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">Monitor redirect patterns and phishing campaigns</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Total Redirects</div>
            <div className="text-2xl font-bold text-white">{stats?.totalRedirects || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Suspicious</div>
            <div className="text-2xl font-bold text-red-400">{stats?.suspiciousRedirects || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Avg Hops</div>
            <div className="text-2xl font-bold text-blue-400">{(stats?.avgHopsPerChain || 0).toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-400 mb-1">Top Source</div>
            <div className="text-sm font-mono text-slate-300 truncate">{stats?.topSourceDomain || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="patterns" className="space-y-4">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="patterns">Suspicious Patterns</TabsTrigger>
          <TabsTrigger value="sources">Top Sources</TabsTrigger>
          <TabsTrigger value="distribution">Chain Length</TabsTrigger>
          <TabsTrigger value="recent">Recent Alerts</TabsTrigger>
        </TabsList>

        {/* Suspicious Patterns Tab */}
        <TabsContent value="patterns">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Most Common Suspicious Redirect Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patternsLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : suspiciousPatterns && suspiciousPatterns.length > 0 ? (
                <div className="space-y-3">
                  {suspiciousPatterns.map((pattern: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs font-mono text-slate-300">
                            {pattern.originalDomain} → {pattern.finalDomain}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-400">{pattern.count}</p>
                          <p className="text-xs text-slate-400">occurrences</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Avg {(pattern.avgRedirectCount || 0).toFixed(1)} hops
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No suspicious patterns found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Sources Tab */}
        <TabsContent value="sources">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Link2 className="w-5 h-5" />
                Top Redirect Sources (URL Shorteners, Trackers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourcesLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : topSources && topSources.length > 0 ? (
                <div className="space-y-3">
                  {topSources.map((source: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-800 rounded border border-slate-700">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-mono text-slate-300">{source.sourceDomain}</p>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-bold text-blue-400">{source.totalRedirects}</p>
                          <p className="text-xs text-slate-400">{source.uniqueTargets} targets</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No redirect sources found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chain Length Distribution Tab */}
        <TabsContent value="distribution">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <BarChart3 className="w-5 h-5" />
                Redirect Chain Length Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {distLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : chainDistribution && chainDistribution.length > 0 ? (
                <div className="space-y-3">
                  {chainDistribution.map((item: any) => {
                    const maxCount = Math.max(...chainDistribution.map((c: any) => c.count || 0));
                    const percentage = ((item.count || 0) / maxCount) * 100;
                    return (
                      <div key={item.redirectCount} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">{item.redirectCount} hop(s)</span>
                          <span className="font-bold text-slate-300">{item.count}</span>
                        </div>
                        <div className="h-6 bg-slate-800 rounded overflow-hidden border border-slate-700">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No distribution data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Alerts Tab */}
        <TabsContent value="recent">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <TrendingUp className="w-5 h-5" />
                Recent Suspicious Redirects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : recentSuspicious && recentSuspicious.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentSuspicious.map((alert: any) => (
                    <div key={alert.id} className="p-3 bg-slate-800 rounded border border-slate-700 text-xs">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400">
                          {alert.detectedAt
                            ? new Date(alert.detectedAt).toLocaleString()
                            : 'Unknown time'}
                        </span>
                        <span className="text-red-400 font-bold">{alert.redirectCount} hops</span>
                      </div>
                      <p className="text-slate-300 font-mono break-all mb-1">{alert.originalUrl}</p>
                      <p className="text-slate-400">→</p>
                      <p className="text-slate-300 font-mono break-all">{alert.finalUrl}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No recent suspicious redirects</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
