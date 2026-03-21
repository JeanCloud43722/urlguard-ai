import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, FileJson, FileText, FileCode } from "lucide-react";
import { toast } from "sonner";

export default function Export() {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const exportJSONQuery = trpc.urlChecker.exportJSON.useQuery({ limit: 100 }, { enabled: false });
  const exportCSVQuery = trpc.urlChecker.exportCSV.useQuery({ limit: 100 }, { enabled: false });
  const exportHTMLQuery = trpc.urlChecker.exportHTML.useQuery({ limit: 100 }, { enabled: false });

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = async () => {
    setIsLoading(true);
    try {
      const data = await exportJSONQuery.refetch();
      if (data.data) {
        downloadFile(data.data, `urlguard-report-${Date.now()}.json`, "application/json");
        toast.success("Report exported as JSON");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setIsLoading(true);
    try {
      const data = await exportCSVQuery.refetch();
      if (data.data) {
        downloadFile(data.data, `urlguard-report-${Date.now()}.csv`, "text/csv");
        toast.success("Report exported as CSV");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportHTML = async () => {
    setIsLoading(true);
    try {
      const data = await exportHTMLQuery.refetch();
      if (data.data) {
        downloadFile(data.data, `urlguard-report-${Date.now()}.html`, "text/html");
        toast.success("Report exported as HTML");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <Card className="p-8 text-center">
          <p className="text-slate-600 mb-4">Please sign in to export reports</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Export Reports</h1>
          <p className="text-slate-600 mb-8">Download your URL check history in various formats</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* JSON Export */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 mb-4">
                <FileJson className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">JSON Export</h3>
              <p className="text-sm text-slate-600 mb-4">
                Export your data as structured JSON for integration with other tools
              </p>
              <Button
                onClick={handleExportJSON}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download JSON
                  </>
                )}
              </Button>
            </Card>

            {/* CSV Export */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 mb-4">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">CSV Export</h3>
              <p className="text-sm text-slate-600 mb-4">
                Export your data as CSV for use in spreadsheets and databases
              </p>
              <Button
                onClick={handleExportCSV}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                  </>
                )}
              </Button>
            </Card>

            {/* HTML Export */}
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 mb-4">
                <FileCode className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">HTML Report</h3>
              <p className="text-sm text-slate-600 mb-4">
                Export a beautiful HTML report for viewing in your browser
              </p>
              <Button
                onClick={handleExportHTML}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download HTML
                  </>
                )}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
