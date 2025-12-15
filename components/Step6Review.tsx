import React, { useState, useEffect } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { Spinner } from './Spinner';
import { getPhonemeForWord } from '../services/geminiService';
import { AccentSelectorModal } from './AccentSelectorModal';

interface Step6ReviewProps {
  audioSegments: string[];
  scriptSegments: string[];
  onConfirm: () => void;
  onRegenerate: (index: number, newScript: string) => void;
  regeneratingIndex: number | null;
}

export const Step6Review: React.FC<Step6ReviewProps> = ({ audioSegments, scriptSegments, onConfirm, onRegenerate, regeneratingIndex }) => {
  const [editedScripts, setEditedScripts] = useState<string[]>(scriptSegments);
  const [selection, setSelection] = useState<{ index: number; start: number; end: number; text: string } | null>(null);
  const [isFixingPronunciation, setIsFixingPronunciation] = useState(false);
  const [pronunciationError, setPronunciationError] = useState<string | null>(null);
  const [accentModalState, setAccentModalState] = useState<{ word: string; onAccent: (newWord: string) => void } | null>(null);

  useEffect(() => {
    // If the scriptSegments prop changes (e.g., loading a new project or after regeneration), reset the local state.
    setEditedScripts(scriptSegments);
  }, [scriptSegments]);

  const handleScriptChange = (index: number, newText: string) => {
    const newScripts = [...editedScripts];
    newScripts[index] = newText;
    setEditedScripts(newScripts);
  };
  
  const handleFixPronunciation = async () => {
    if (!selection) return;

    if (selection.text.trim().includes(' ') || selection.text.length > 50) {
        setPronunciationError("Seleziona una sola parola per la correzione fonetica.");
        setTimeout(() => setPronunciationError(null), 3000);
        return;
    }

    setIsFixingPronunciation(true);
    setPronunciationError(null);
    try {
        const ipa = await getPhonemeForWord(selection.text);
        
        const phonemeTag = `<phoneme alphabet="ipa" ph="${ipa}">${selection.text}</phoneme>`;

        const index = selection.index;
        const currentScript = editedScripts[index];
        const newScript = 
            currentScript.substring(0, selection.start) +
            phonemeTag +
            currentScript.substring(selection.end);
        
        const newScripts = [...editedScripts];
        newScripts[index] = newScript;
        setEditedScripts(newScripts);
        
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setPronunciationError(err.message);
        console.error(error);
        setTimeout(() => setPronunciationError(null), 5000);
    } finally {
        setIsFixingPronunciation(false);
        setSelection(null);
    }
  };
  
  const openAccentModal = () => {
      if (!selection) return;
      
      if (selection.text.trim().includes(' ') || selection.text.length > 50) {
        setPronunciationError("Seleziona una sola parola per aggiungere l'accento.");
        setTimeout(() => setPronunciationError(null), 3000);
        return;
      }
      
      setAccentModalState({
          word: selection.text,
          onAccent: (newWord) => {
              const index = selection.index;
              const currentScript = editedScripts[index];
              const newScript = 
                  currentScript.substring(0, selection.start) +
                  newWord +
                  currentScript.substring(selection.end);
              
              const newScripts = [...editedScripts];
              newScripts[index] = newScript;
              setEditedScripts(newScripts);
              setAccentModalState(null);
              setSelection(null);
          }
      });
  };


  return (
    <>
      {accentModalState && (
        <AccentSelectorModal 
            word={accentModalState.word}
            onSelect={accentModalState.onAccent}
            onClose={() => setAccentModalState(null)}
        />
      )}
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-semibold mb-2 text-center">Step 7: Review & Refine Audio</h2>
        <p className="text-gray-400 mb-2 text-center max-w-2xl">
          Listen to each segment. If you notice any pronunciation errors, edit the script in the text box below the player and click "Re-generate Segment" to create a new audio file for just that part. You can also re-generate without editing to get a different vocal take.
        </p>
        <p className="text-gray-400 mb-6 text-center max-w-2xl text-sm">
            <strong className="text-teal-400">Pro Tip:</strong> To fix a specific word's pronunciation, highlight it and use the helper buttons. "Add Stress Accent" (recommended) inserts an accent mark. "Get Phoneme" uses SSML tags (less reliable).
        </p>
        
        {pronunciationError && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded-lg relative mb-4 w-full max-w-xl" role="alert">
              <strong className="font-bold">Pronunciation Error: </strong>
              <span className="block sm:inline">{pronunciationError}</span>
            </div>
        )}

        <div className="w-full space-y-6 mb-6 max-h-[60vh] overflow-y-auto p-2">
          {audioSegments.map((base64Audio, index) => (
            <div key={index} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
              <div className="flex items-center">
                <span className="font-bold text-lg text-purple-400 mr-4">Segment {index + 1}</span>
                <AudioPlayer base64Audio={base64Audio} />
              </div>
              <div className="mt-4 relative">
                <label htmlFor={`script-segment-${index}`} className="block text-sm font-medium text-gray-300 mb-1">
                  Segment Script (Editable)
                </label>
                <textarea
                  id={`script-segment-${index}`}
                  value={editedScripts[index] || ''}
                  onChange={(e) => handleScriptChange(index, e.target.value)}
                  onSelect={(e) => {
                    const target = e.currentTarget;
                    const text = target.value.substring(target.selectionStart, target.selectionEnd);
                    if (text.trim()) {
                        setSelection({
                            index: index,
                            start: target.selectionStart,
                            end: target.selectionEnd,
                            text: text
                        });
                    } else if (selection) {
                        setSelection(null);
                    }
                  }}
                  className="w-full h-32 p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 text-gray-300 font-mono text-sm resize-y"
                  aria-label={`Script for segment ${index + 1}`}
                  disabled={regeneratingIndex !== null || isFixingPronunciation}
                />
                <div className="mt-2 flex justify-end gap-2 flex-wrap">
                  <button
                      onClick={openAccentModal}
                      disabled={regeneratingIndex !== null || isFixingPronunciation || !selection || selection.index !== index}
                      className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm"
                      title="Select a word in the text box above to add a stress accent"
                  >
                      Add Stress Accent
                  </button>
                  <button
                      onClick={handleFixPronunciation}
                      disabled={regeneratingIndex !== null || isFixingPronunciation || !selection || selection.index !== index}
                      className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm"
                      title="Select a word in the text box above to get its phoneme"
                  >
                      {isFixingPronunciation && selection?.index === index ? (
                          <>
                              <Spinner />
                              <span className="ml-2">Working...</span>
                          </>
                      ) : (
                          'Get Phoneme (SSML)'
                      )}
                  </button>
                  <button
                      onClick={() => onRegenerate(index, editedScripts[index])}
                      disabled={regeneratingIndex !== null || isFixingPronunciation}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-all text-sm"
                  >
                      {regeneratingIndex === index ? (
                      <>
                          <Spinner />
                          <span className="ml-2">Generating...</span>
                      </>
                      ) : (
                      'Re-generate Segment'
                      )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onConfirm}
          disabled={regeneratingIndex !== null || isFixingPronunciation}
          className="w-full max-w-md bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:bg-gray-600"
        >
          Looks Good, Combine & Finish
        </button>
      </div>
    </>
  );
};