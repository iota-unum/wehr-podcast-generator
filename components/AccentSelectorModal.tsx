import React from 'react';

interface AccentSelectorModalProps {
  word: string;
  onSelect: (newWord: string) => void;
  onClose: () => void;
}

const isVowel = (char: string): boolean => 'aeiouAEIOU'.includes(char);

const getAccentedVowel = (char: string): string => {
    switch (char.toLowerCase()) {
        case 'a': return 'à';
        case 'e': return 'è';
        case 'i': return 'ì';
        case 'o': return 'ò';
        case 'u': return 'ù';
        default: return char;
    }
};

export const AccentSelectorModal: React.FC<AccentSelectorModalProps> = ({ word, onSelect, onClose }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  const handleVowelClick = (index: number) => {
      const char = word[index];
      if (isVowel(char)) {
          const accentedChar = getAccentedVowel(char);
          const newWord = word.substring(0, index) + accentedChar + word.substring(index + 1);
          onSelect(newWord);
      }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accent-modal-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md text-center transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="accent-modal-title" className="text-xl font-bold mb-4">Add Stress Accent</h2>
        <p className="text-gray-400 mb-6">
            Click on the vowel you want to stress in the word below.
        </p>
        <div className="flex justify-center items-center p-4 bg-gray-900 rounded-lg text-4xl tracking-widest">
            {word.split('').map((char, index) => (
                isVowel(char) ? (
                    <button 
                        key={index} 
                        onClick={() => handleVowelClick(index)}
                        className="text-purple-300 hover:text-white hover:bg-purple-600 rounded-md px-1 transition-colors"
                        aria-label={`Stress vowel ${char}`}
                    >
                        {char}
                    </button>
                ) : (
                    <span key={index} className="text-gray-500">{char}</span>
                )
            ))}
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};
