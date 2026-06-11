'use client';

import { useEffect, useState } from 'react';
import { auth, rtdb } from '@/lib/firebase/client';
import { ref, set, get, child } from 'firebase/database';

export default function TestDatabasePage() {
  const [status, setStatus] = useState<string>('Testing...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function test() {
      try {
        // Test Auth
        const authStatus = auth ? '✅ Auth initialized' : '❌ Auth failed';
        
        // Test Realtime Database
        let dbStatus = 'Testing...';
        
        try {
          const testRef = ref(rtdb, 'test/connection');
          await set(testRef, {
            message: 'UniLeave connection successful',
            timestamp: Date.now(),
          });
          
          const snapshot = await get(child(ref(rtdb), 'test/connection'));
          if (snapshot.exists()) {
            dbStatus = `✅ Realtime DB connected: ${snapshot.val().message}`;
          } else {
            dbStatus = '⚠️ Realtime DB: Write succeeded but read returned null';
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          dbStatus = `❌ Realtime DB error: ${errorMessage}`;
        }
        
        setStatus(`${authStatus}\n${dbStatus}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setStatus(`❌ Error: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    test();
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Firebase Realtime Database Test</h1>
        
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-4">
              <pre className="bg-gray-100 p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">
                {status}
              </pre>
            </div>
            
            {status.includes('✅') && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✅ Realtime Database is active</p>
              </div>
            )}
            
            {status.includes('❌') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">❌ Connection Failed</p>
                <p className="text-red-600 text-sm mt-1">Check your .env.local configuration</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}