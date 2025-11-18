'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface TableStats {
  table: string;
  totalRows: number;
  rowsWithMedia: number;
  storageReferences: number;
  httpUrls: number;
  base64Data: number;
  filesVerified: number;
  filesFailed: number;
  errors: string[];
}

interface VerificationResult {
  summary: {
    totalTables: number;
    totalRows: number;
    totalWithMedia: number;
    totalStorageRefs: number;
    totalHttpUrls: number;
    totalBase64: number;
    totalVerified: number;
    totalFailed: number;
    profilesExcluded: boolean;
  };
  tables: TableStats[];
  errors: string[];
  success: boolean;
}

export default function VerifyStoragePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const runVerification = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/verify-storage');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Storage Migration Verification</h1>
        <p className="text-muted-foreground">
          Verify that all media has been migrated to Supabase Storage (excluding profiles table)
        </p>
      </div>

      <Button onClick={runVerification} disabled={loading} className="mb-6">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running Verification...
          </>
        ) : (
          'Run Verification'
        )}
      </Button>

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                Overall Summary
              </CardTitle>
              <CardDescription>
                {result.summary.profilesExcluded && (
                  <Badge variant="outline" className="mt-2">
                    Profiles table excluded
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-bold">{result.summary.totalTables}</div>
                  <div className="text-sm text-muted-foreground">Tables Scanned</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{result.summary.totalRows}</div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{result.summary.totalWithMedia}</div>
                  <div className="text-sm text-muted-foreground">Rows with Media</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{result.summary.totalStorageRefs}</div>
                  <div className="text-sm text-muted-foreground">Storage References</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{result.summary.totalVerified}</div>
                  <div className="text-sm text-muted-foreground">Files Verified</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{result.summary.totalFailed}</div>
                  <div className="text-sm text-muted-foreground">Files Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{result.summary.totalBase64}</div>
                  <div className="text-sm text-muted-foreground">Base64 Data</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">{result.summary.totalHttpUrls}</div>
                  <div className="text-sm text-muted-foreground">External URLs</div>
                </div>
              </div>

              {result.success ? (
                <Alert className="mt-6 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    All media successfully migrated to Supabase Storage! No base64 data or failed files detected.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="mt-6 border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Migration incomplete. Check the table details below for issues.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {result.tables.map((table) => (
              <Card key={table.table}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{table.table}</span>
                    {table.base64Data === 0 && table.filesFailed === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-semibold">{table.totalRows}</div>
                      <div className="text-muted-foreground">Total Rows</div>
                    </div>
                    <div>
                      <div className="font-semibold">{table.rowsWithMedia}</div>
                      <div className="text-muted-foreground">With Media</div>
                    </div>
                    <div>
                      <div className="font-semibold text-green-600">{table.storageReferences}</div>
                      <div className="text-muted-foreground">Storage Refs</div>
                    </div>
                    <div>
                      <div className="font-semibold text-blue-600">{table.filesVerified}</div>
                      <div className="text-muted-foreground">Verified</div>
                    </div>
                  </div>

                  {(table.base64Data > 0 || table.filesFailed > 0 || table.httpUrls > 0) && (
                    <div className="mt-4 space-y-2">
                      {table.base64Data > 0 && (
                        <Badge variant="destructive">
                          {table.base64Data} Base64 entries
                        </Badge>
                      )}
                      {table.filesFailed > 0 && (
                        <Badge variant="destructive">
                          {table.filesFailed} Failed verifications
                        </Badge>
                      )}
                      {table.httpUrls > 0 && (
                        <Badge variant="secondary">
                          {table.httpUrls} External URLs
                        </Badge>
                      )}
                    </div>
                  )}

                  {table.errors.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-semibold mb-2">Errors:</div>
                      <div className="text-xs space-y-1">
                        {table.errors.slice(0, 5).map((error, i) => (
                          <div key={i} className="text-red-600 font-mono">
                            {error}
                          </div>
                        ))}
                        {table.errors.length > 5 && (
                          <div className="text-muted-foreground">
                            ... and {table.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
