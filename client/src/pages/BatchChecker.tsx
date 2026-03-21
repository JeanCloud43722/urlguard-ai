import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";

export default function BatchChecker() {
  const { isAuthenticated } = useAuth();
  const [urlsInput, setUrlsInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const startBatchMutation = trpc.urlChecker.startBatchCheck.useMutation();

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlsInput
      .split("\n")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    if (urls.length > 50) {
      toast.error("Maximum 50 URLs per batch");
      return;
    }

    setIsLoading(true);
    try {
      const res = await startBatchMutation.mutateAsync({ urls });
      setJobId(res.jobId);
      setUrlsInput("");
      toast.success("Batch check started");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-600 mb-4">Please sign in to use batch checker</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Batch URL Checker</h1>
          <p className="text-slate-600 mb-8">Analyze up to 50 URLs at once</p>

          <Card className="p-8 shadow-lg border-0 mb-8">
            <form onSubmit={handleStartBatch} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Enter URLs (one per line)</label>
                <Textarea
                  placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
                  value={urlsInput}
                  onChange={(e) => setUrlsInput(e.target.value)}
                  disabled={isLoading}
                  rows={10}
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">
                  {urlsInput.split("\n").filter((u) => u.trim()).length} URLs entered
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Start Batch Check
                  </>
                )}
              </Button>
            </form>
          </Card>

          {jobId && (
            <Card className="p-8 bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Batch Job Started</h3>
              <p className="text-sm text-slate-600 mb-4">Job ID: {jobId}</p>
              <p className="text-sm text-slate-600">
                Your batch check is processing. Results will be available shortly.
              </p>
              <Button className="mt-4" onClick={() => setJobId(null)}>
                <Download className="w-4 h-4 mr-2" />
                Check Results
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
