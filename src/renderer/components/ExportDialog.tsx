import React, { useState } from 'react';
import { Download, FileText, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ExportDialogProps {
  chatId: number | null;
  chatName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'txt' | 'json' | 'html';

const ExportDialog: React.FC<ExportDialogProps> = ({
  chatId,
  chatName,
  open,
  onOpenChange,
}) => {
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = async () => {
    if (!chatId) return;

    setIsExporting(true);
    try {
      const response = await window.electronAPI.exportMessages(chatId, format);

      if (response.success && response.data) {
        setPreviewContent(response.data);
        setShowPreview(true);
      } else {
        toast.error(response.error || 'Failed to generate preview');
      }
    } catch (error) {
      toast.error('Unexpected error occurred');
      console.error('Preview error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    if (!chatId) return;

    setIsExporting(true);
    try {
      const response = await window.electronAPI.exportMessages(chatId, format);

      if (response.success && response.data) {
        // Create a blob and download
        const blob = new Blob([response.data], {
          type: format === 'json' ? 'application/json' : 'text/plain',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chatName}_export_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Chat exported successfully as ${format.toUpperCase()}`);
        onOpenChange(false);
        setShowPreview(false);
        setPreviewContent(null);
      } else {
        toast.error(response.error || 'Failed to export chat');
      }
    } catch (error) {
      toast.error('Unexpected error occurred');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setShowPreview(false);
    setPreviewContent(null);
    onOpenChange(false);
  };

  const formatDescriptions: Record<ExportFormat, string> = {
    txt: 'Plain text format - Simple, readable text file',
    json: 'JSON format - Structured data with all metadata',
    html: 'HTML format - Styled document viewable in browser',
  };

  const formatIcons: Record<ExportFormat, React.ReactNode> = {
    txt: <FileText className="h-5 w-5 text-blue-500" />,
    json: <FileText className="h-5 w-5 text-green-500" />,
    html: <FileText className="h-5 w-5 text-orange-500" />,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        {!showPreview ? (
          <>
            <DialogHeader>
              <DialogTitle>Export Chat</DialogTitle>
              <DialogDescription>
                Export "{chatName}" messages to a file. Choose your preferred format below.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {/* Format Selector */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-3 block">Export Format</Label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <div className="space-y-3">
                    {(['txt', 'json', 'html'] as ExportFormat[]).map((fmt) => (
                      <label
                        key={fmt}
                        htmlFor={`format-${fmt}`}
                        className={cn(
                          'flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
                          format === fmt
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <RadioGroupItem value={fmt} id={`format-${fmt}`} className="mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {formatIcons[fmt]}
                            <span className="font-medium text-sm uppercase">{fmt}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDescriptions[fmt]}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              {/* Info Box */}
              <div className="bg-accent/50 border border-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">What will be included:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• All messages in this chat</li>
                  <li>• Sender names and timestamps</li>
                  <li>• Message edits and reactions (JSON/HTML only)</li>
                  <li>• Reply threads (JSON/HTML only)</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={isExporting}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Export Preview</DialogTitle>
              <DialogDescription>
                Preview of how your exported chat will look ({format.toUpperCase()})
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                  {previewContent}
                </pre>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setPreviewContent(null);
                }}
              >
                Back
              </Button>
              <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
