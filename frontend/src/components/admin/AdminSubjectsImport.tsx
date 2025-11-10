import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { apiService } from './apiService';

export function AdminSubjectsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const onUpload = async () => {
    if (!file) {
      toast.error('Please select an Excel (.xlsx/.xls) file');
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await apiService.importSubjects(file);
      setResult(res);
      toast.success('Subjects imported successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Possible Subjects</CardTitle>
          <CardDescription>
            Upload an Excel file containing subject offerings for BSIT 1st-4th year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subjects-file">Excel File (.xlsx / .xls)</Label>
            <Input id="subjects-file" type="file" accept=".xlsx,.xls" onChange={onFileChange} />
          </div>
          <Button onClick={onUpload} disabled={!file || uploading}>
            {uploading ? 'Importing...' : 'Upload and Import'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div><strong>Inserted:</strong> {result.inserted}</div>
                <div><strong>Duplicates:</strong> {result.duplicates}</div>
              </div>
              <div>
                <div><strong>Schedules Created:</strong> {result.schedulesCreated}</div>
                <div><strong>Schedules Skipped:</strong> {result.schedulesSkipped}</div>
              </div>
            </div>
            {Array.isArray(result.duplicateKeys) && result.duplicateKeys.length > 0 && (
              <div className="mt-4">
                <div className="font-medium mb-1">Duplicate Keys</div>
                <ul className="list-disc ml-6 text-sm text-gray-600">
                  {result.duplicateKeys.slice(0, 20).map((k: string) => (
                    <li key={k}>{k}</li>
                  ))}
                  {result.duplicateKeys.length > 20 && (
                    <li>...and {result.duplicateKeys.length - 20} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


