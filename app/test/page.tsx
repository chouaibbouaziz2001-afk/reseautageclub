"use client";

export default function TestPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <div className="text-6xl">✅</div>
        <h1 className="text-4xl font-bold text-green-400">Application is Working!</h1>

        <div className="bg-gray-900 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-semibold text-amber-400">System Check</h2>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-gray-400 text-sm">Next.js Version:</p>
              <p className="text-white font-mono">14.2.32</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">React Version:</p>
              <p className="text-white font-mono">18.2.0</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">Environment:</p>
              <p className="text-white font-mono">{process.env.NODE_ENV || 'development'}</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">Timestamp:</p>
              <p className="text-white font-mono text-xs">{new Date().toISOString()}</p>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-400 text-sm">Supabase URL:</p>
            <p className="text-green-400 font-mono text-xs break-all">
              {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'}
            </p>
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-400 text-sm">Anon Key Status:</p>
            <p className="text-green-400 font-mono">
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?
                `✓ SET (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)` :
                '✗ NOT SET'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <a
            href="/"
            className="block bg-amber-500 hover:bg-amber-600 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Go to Home Page
          </a>

          <a
            href="/sign-up"
            className="block bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Go to Sign Up
          </a>
        </div>

        <p className="text-sm text-gray-500">
          If you can see this page, the application is compiled and running correctly.
          <br />
          The blank page issue may be related to authentication or provider initialization.
        </p>
      </div>
    </div>
  );
}
