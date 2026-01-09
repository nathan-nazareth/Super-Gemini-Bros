import React, { useState, useEffect } from 'react';
import { generateGameAsset, editGameView, askGameAssistant } from '../services/geminiService';
import { ChatMessage } from '../types';

interface AIOverlayProps {
  onApplyBackground: (url: string) => void;
  getSnapshot: () => string;
}

const AIOverlay: React.FC<AIOverlayProps> = ({ onApplyBackground, getSnapshot }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'chat'>('create');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Create / Edit state
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');

  // Chat options
  const [useThinking, setUseThinking] = useState(false);
  const [useGrounding, setUseGrounding] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setGeneratedImage(null); // Clear previous
    try {
      if (mode === 'generate') {
        const url = await generateGameAsset(prompt, imageSize);
        if (url) setGeneratedImage(url);
      } else {
        const snapshot = getSnapshot();
        if (snapshot) {
          const url = await editGameView(snapshot, prompt);
          if (url) setGeneratedImage(url);
        } else {
            alert("Could not get game snapshot");
        }
      }
    } catch (e: any) {
      console.error(e);
      let msg = "AI Error: Check console";
      if (e.message) msg = e.message;
      if (e.toString().includes('403')) msg = "Permission Denied: Please check your API Key and Billing.";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!prompt) return;
    const newMsg: ChatMessage = { role: 'user', text: prompt };
    setChatHistory(prev => [...prev, newMsg]);
    const currentPrompt = prompt;
    setPrompt('');
    setLoading(true);

    try {
      const response = await askGameAssistant(currentPrompt, chatHistory, useGrounding, useThinking);
      setChatHistory(prev => [...prev, {
        role: 'model',
        text: response.text,
        groundingUrls: response.groundingUrls
      }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full text-sm shrink-0">
      <div className="flex border-b border-slate-700">
        <button 
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-3 font-semibold ${activeTab === 'create' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:bg-slate-700/50'}`}
        >
          Studio
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 font-semibold ${activeTab === 'chat' ? 'bg-slate-700 text-purple-400' : 'text-slate-400 hover:bg-slate-700/50'}`}
        >
          Assistant
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'create' ? (
          <>
            <div className="space-y-2">
              <label className="text-slate-400">Mode</label>
              <div className="flex bg-slate-900 rounded p-1">
                <button 
                  onClick={() => setMode('generate')}
                  className={`flex-1 py-1 rounded text-xs ${mode === 'generate' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  Generate New
                </button>
                <button 
                  onClick={() => setMode('edit')}
                  className={`flex-1 py-1 rounded text-xs ${mode === 'edit' ? 'bg-green-600 text-white' : 'text-slate-400'}`}
                >
                  Edit Screen
                </button>
              </div>
            </div>

            {mode === 'generate' && (
              <div className="space-y-2">
                 <label className="text-slate-400">Size (Gemini 3 Pro)</label>
                 <select 
                   value={imageSize} 
                   onChange={(e) => setImageSize(e.target.value as any)}
                   className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                 >
                   <option value="1K">1K</option>
                   <option value="2K">2K</option>
                   <option value="4K">4K</option>
                 </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-slate-400">
                {mode === 'generate' ? 'Describe the background:' : 'Describe the edit (e.g. "Make it night time"): box'}
              </label>
              <textarea 
                className="w-full h-24 bg-slate-900 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={mode === 'generate' ? "A futuristic neon city with floating platforms..." : "Turn the sky into lava..."}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className={`w-full py-2 rounded font-bold transition-all ${loading ? 'bg-slate-600 cursor-wait' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500'}`}
            >
              {loading ? 'Processing...' : (mode === 'generate' ? 'Generate Assets' : 'Edit View')}
            </button>

            {generatedImage && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-slate-400 text-xs uppercase font-bold tracking-wider">Result</div>
                <img src={generatedImage} alt="Generated" className="w-full rounded border border-slate-600" />
                <button 
                  onClick={() => onApplyBackground(generatedImage)}
                  className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium"
                >
                  Apply as Background
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 flex flex-col h-full">
             <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                   {chatHistory.length === 0 && <div className="text-slate-500 text-center mt-10">Ask me anything about Super Gemini Bros!</div>}
                   {chatHistory.map((msg, i) => (
                      <div key={i} className={`p-3 rounded text-sm ${msg.role === 'user' ? 'bg-slate-700 ml-4' : 'bg-slate-900 mr-4'}`}>
                         <div className="font-bold mb-1 text-xs opacity-50 uppercase">{msg.role === 'model' ? 'AI' : 'You'}</div>
                         <div className="whitespace-pre-wrap">{msg.text}</div>
                         {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-800">
                               <div className="text-xs text-slate-500 mb-1">Sources:</div>
                               {msg.groundingUrls.map((url, idx) => (
                                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="block truncate text-blue-400 hover:underline text-xs">{url}</a>
                               ))}
                            </div>
                         )}
                      </div>
                   ))}
                   {loading && <div className="text-slate-500 text-xs animate-pulse">Thinking...</div>}
                </div>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex gap-4">
                     <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                        <input type="checkbox" checked={useThinking} onChange={e => setUseThinking(e.target.checked)} className="rounded bg-slate-700 border-slate-600" />
                        Thinking
                     </label>
                     <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                        <input type="checkbox" checked={useGrounding} onChange={e => setUseGrounding(e.target.checked)} className="rounded bg-slate-700 border-slate-600" />
                        Grounding
                     </label>
                  </div>
                  <div className="flex gap-2">
                     <input 
                       className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                       value={prompt}
                       onChange={e => setPrompt(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleChat()}
                       placeholder="Ask about mechanics..."
                     />
                     <button onClick={handleChat} disabled={loading || !prompt} className="px-3 bg-blue-600 rounded hover:bg-blue-500 text-white font-bold">→</button>
                  </div>
                </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIOverlay;