import React, { useState, useEffect } from 'react';
import { decodeBase64, encodePcmToMp3Blob } from '../utils/audioUtils';
import { Spinner } from './Spinner';
import JSZip from 'jszip';
// FIX: Corrected the function name from `exportToSupabase` to `exportProjectToSupabase` to match the exported member from the service.
import { exportProjectToSupabase } from '../services/supabaseService';
import { Project } from '../types';

declare const lamejs: any;

interface Step7FinalProps {
  audioSegments: string[];
  onRestart: () => void;
  subject: string;
  fullScript: string | null;
  studyMaterialsJson: string;
  timelineJson: string;
}

const createFileName = (title: string, extension: string): string => {
    // Replace invalid characters with an underscore, trim, and convert to lowercase.
    const sanitized = title.replace(/[\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').toLowerCase();
    // Ensure the filename is not empty.
    return `${sanitized || 'podcast'}.${extension}`;
};

export const Step7Final: React.FC<Step7FinalProps> = ({ audioSegments, onRestart, subject, fullScript, studyMaterialsJson, timelineJson }) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isZipping, setIsZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    
    const processAudio = () => {
        if (typeof lamejs === 'undefined') {
            setError("MP3 encoding library not loaded.");
            setIsLoading(false);
            return;
        }
        if (audioSegments.length === 0) {
            setError("No audio segments to process.");
            setIsLoading(false);
            return;
        }

        try {
            const pcmChunks = audioSegments.map(decodeBase64);
            
            const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combinedPcm = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of pcmChunks) {
                combinedPcm.set(chunk, offset);
                offset += chunk.length;
            }
            
            const finalMp3Blob = encodePcmToMp3Blob(combinedPcm);
            setMp3Blob(finalMp3Blob);
            url = URL.createObjectURL(finalMp3Blob);
            setDownloadUrl(url);
        } catch (e) {
            const err = e instanceof Error ? e : new Error('An unknown error occurred');
            console.error("Failed to combine and encode audio files:", err);
            setError(`Failed to create MP3 file: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const timer = setTimeout(processAudio, 100);

    return () => {
      clearTimeout(timer);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioSegments]);

  useEffect(() => {
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    if (savedUrl) setSupabaseUrl(savedUrl);
    if (savedKey) setSupabaseKey(savedKey);
  }, []);
  
  const handleDownloadZip = async () => {
    if (!audioSegments || audioSegments.length === 0) {
        setError("No audio segments to process for ZIP.");
        return;
    }
    
    setIsZipping(true);
    setError(null);
    
    try {
        const zip = new JSZip();
        for (let i = 0; i < audioSegments.length; i++) {
            const pcmData = decodeBase64(audioSegments[i]);
            const mp3Blob = encodePcmToMp3Blob(pcmData);
            zip.file(`podcast_segment_${i + 1}.mp3`, mp3Blob);
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = createFileName(subject + '_segments', 'zip');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
    } catch (e) {
        const err = e instanceof Error ? e : new Error('An unknown error occurred');
        console.error("Failed to create ZIP file:", err);
        setError(`Failed to create ZIP file: ${err.message}`);
    } finally {
        setIsZipping(false);
    }
  };

    const handleDownloadTimeline = () => {
    if (!timelineJson) return;
    const blob = new Blob([timelineJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = createFileName(subject + '_timeline', 'json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveCredentials = () => {
      localStorage.setItem('supabaseUrl', supabaseUrl);
      localStorage.setItem('supabaseKey', supabaseKey);
      setExportSuccess('Credentials saved in browser for next time!');
      setTimeout(() => setExportSuccess(null), 3000);
  };

  const handleExport = async () => {
      if (!mp3Blob || !fullScript || !studyMaterialsJson) {
          setExportError('Missing data required for export. Please ensure script and audio are generated.');
          return;
      }
      setIsExporting(true);
      setExportError(null);
      setExportSuccess(null);

      // FIX: The export function expects a `Project` object. We construct one here
      // with the available data to match the required signature.
      const projectForExport: Project = {
        subject,
        fullScript,
        studyMaterialsJson,
        timelineJson,
        createdAt: new Date(),
        // Dummy values for type compliance, not used by the export function
        uploadedFiles: [],
        outlineJson: null,
        audioSegments: [],
      };

      try {
          const result = await exportProjectToSupabase(
              supabaseUrl,
              supabaseKey,
              projectForExport,
              mp3Blob
          );
          setExportSuccess(`Successfully exported! Audio available at: ${result.audioUrl}`);
      } catch (e) {
          const err = e instanceof Error ? e : new Error('An unknown error occurred');
          let friendlyMessage = `Export failed: ${err.message}`;
          if (err.message.toLowerCase().includes('bucket not found')) {
              friendlyMessage = "Export Failed: The 'podcasts' bucket was not found in your Supabase project. Please go to your Supabase dashboard, navigate to Storage, and create a new public bucket named exactly 'podcasts'.";
          }
          setExportError(friendlyMessage);
      } finally {
          setIsExporting(false);
      }
  };


  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-semibold mb-4">Your Podcast is Ready!</h2>
      
      {isLoading && (
        <>
            <p className="text-gray-400 mb-6 max-w-lg">
                Please wait while the final audio file is being created. This should be quick!
            </p>
            <div className="flex items-center justify-center space-x-2">
                <Spinner large />
                <span className="text-lg text-gray-300 animate-pulse">Combining & Encoding...</span>
            </div>
        </>
      )}

      {!isLoading && error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 w-full max-w-md" role="alert">
              <strong className="font-bold">Processing Failed: </strong>
              <span className="block sm:inline">{error}</span>
          </div>
      )}

      {!isLoading && !error && (
        <>
            <p className="text-gray-400 mb-8 max-w-lg">
                The audio segments have been combined into a single MP3 file. Download your complete podcast now or export it.
            </p>
            <div className="w-full max-w-md space-y-4">
              {downloadUrl && (
                <a
                    href={downloadUrl}
                    download={createFileName(subject, 'mp3')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105"
                >
                    Download Full Podcast (.mp3)
                </a>
              )}
               <button
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isZipping ? (
                      <>
                          <Spinner />
                          <span className="ml-2">Creating ZIP...</span>
                      </>
                  ) : (
                      'Download All Segments (.zip)'
                  )}
               </button>
                <button
                    onClick={handleDownloadTimeline}
                    disabled={!timelineJson || timelineJson === '{"events":[]}'}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    Download Timeline (.json)
                </button>
            </div>
        </>
      )}

      <div className="w-full max-w-md mt-8 border-t border-gray-700 pt-6">
        <h3 className="text-xl font-semibold mb-4 text-purple-300">Export to Supabase</h3>
        <p className="text-sm text-gray-400 mb-4">Upload the final MP3 and project data to your Supabase instance.</p>
        
        <div className="space-y-4 text-left">
            <div>
                <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-300">Supabase Project URL</label>
                <input 
                    type="url" 
                    id="supabase-url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://your-project-ref.supabase.co"
                    className="w-full mt-1 p-2 bg-gray-900 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
            </div>
             <div>
                <label htmlFor="supabase-key" className="block text-sm font-medium text-gray-300">Supabase Anon Key</label>
                <input 
                    type="password" 
                    id="supabase-key"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="your-public-anon-key"
                    className="w-full mt-1 p-2 bg-gray-900 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
            </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
                onClick={handleSaveCredentials}
                disabled={!supabaseUrl || !supabaseKey}
                className="flex-1 w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors disabled:bg-gray-800 disabled:text-gray-500 text-sm"
            >
                Save Credentials
            </button>
            <button
                onClick={handleExport}
                disabled={isExporting || !supabaseUrl || !supabaseKey || !mp3Blob}
                className="flex-1 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center transition-colors disabled:bg-gray-600"
            >
                {isExporting ? <><Spinner /><span className="ml-2">Exporting...</span></> : 'Export'}
            </button>
        </div>

        {exportError && (
             <div className="mt-4 bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-sm" role="alert">
                {exportError}
             </div>
        )}
        {exportSuccess && (
             <div className="mt-4 bg-green-900 border border-green-700 text-green-200 px-4 py-2 rounded-lg text-sm break-all" role="alert">
                {exportSuccess}
             </div>
        )}
      </div>
      
      <div className="w-full max-w-md mt-6">
        <button
          onClick={onRestart}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
        >
          Create Another Podcast
        </button>
      </div>
    </div>
  );
};