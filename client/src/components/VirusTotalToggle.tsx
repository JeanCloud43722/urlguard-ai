import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VirusTotalToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function VirusTotalToggle({
  checked,
  onChange,
  disabled = false,
  isLoading = false,
}: VirusTotalToggleProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
      <div className="flex items-center gap-2 flex-1">
        <Checkbox
          id="virustotal-toggle"
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled || isLoading}
          className="cursor-pointer"
        />
        <label
          htmlFor="virustotal-toggle"
          className="flex items-center gap-2 cursor-pointer flex-1"
        >
          <span className="text-sm font-medium text-slate-700">
            Include VirusTotal Scan
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Check this URL against VirusTotal's database of known malicious
                  sites. This provides additional threat intelligence from multiple
                  antivirus engines.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </label>
      </div>

      {/* Status Badge */}
      {checked && (
        <div className="flex items-center gap-2">
          {isLoading ? (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-blue-600 font-medium">Scanning...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600 font-medium">Enabled</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
