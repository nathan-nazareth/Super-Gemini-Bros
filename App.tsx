import React, { useState, useRef, useEffect } from 'react';
import GameCanvas, { GameCanvasHandle } from './components/GameCanvas';
import AIOverlay from './components/AIOverlay';

export default function App() {
  const [hasKey, setHasKey] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const gameRef = useRef<GameCanvasHandle>(null);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    const win = window as any;
    if (win.aistudio) {
      try {
        const selected = await win.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        console.error(e);
        // If check fails, default to false to force selection
        setHasKey(false);
      }
    } else {
      // Fallback for environments without the specific window object
      setHasKey(true);
    }
  };

  const handleSelectKey = async () => {
    const win = window as any;
    if (win.aistudio) {
      try {
        await win.aistudio.openSelectKey();
        // Assume success as per instructions
        setHasKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  const handleGameOver = (score: number) => {
    console.log("Game Over. Score:", score);
  };

  const getSnapshot = () => {
    return gameRef.current?.getSnapshot() || "";
  };

  // Enforce API Key Selection
  if (!hasKey && typeof window !== 'undefined' && (window as any).aistudio) {
     return (
        <div className="flex h-screen w-screen bg-slate-950 items-center justify-center flex-col gap-8 p-4 font-sans">
           <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-2xl">
                <span className="text-blue-500">Super</span> <span className="text-white">Gemini</span> <span className="text-red-500">Bros</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
                 To unlock the power of Generative AI for asset creation and game editing, 
                 please select a Google Cloud Project with billing enabled.
              </p>
           </div>
           
           <button 
             onClick={handleSelectKey}
             className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold text-xl shadow-lg hover:shadow-blue-500/25 transition-all transform hover:-translate-y-1 hover:scale-105 active:scale-95"
           >
             Select API Key
           </button>

           <a 
             href="https://ai.google.dev/gemini-api/docs/billing" 
             target="_blank" 
             rel="noreferrer"
             className="text-slate-500 hover:text-blue-400 text-sm underline underline-offset-4 transition-colors"
           >
             Billing Documentation
           </a>
        </div>
     );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <GameCanvas 
          ref={gameRef}
          onGameOver={handleGameOver} 
          backgroundImage={bgImage} 
        />
      </div>
      <AIOverlay 
        onApplyBackground={setBgImage}
        getSnapshot={getSnapshot}
      />
    </div>
  );
}