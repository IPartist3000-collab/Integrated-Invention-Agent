import React, { useState } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState('IDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [idf, setIdf] = useState({ title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: '' });
  const [spec, setSpec] = useState({ title: '', problem: '', solution: '', claims: [] });
  const [messages, setMessages] = useState([{ role: 'bot', content: '지능형 발명 에이전트입니다. 222nm 살균 장치와 같은 아이디어를 입력하세요.' }]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    const idfPrompt = "당신은 전문 IP 컨설턴트입니다. 다음 기술 아이디어를 분석하여 반드시 JSON 형식으로만 응답하세요: { \"title\": \"명칭\", \"problem\": \"기존한계\", \"novelty\": \"핵심신규성\", \"technical_key\": \"구현방법\", \"effects\": \"효과\", \"commercial_value\": \"상업성\", \"summary\": \"요약\" }";
    const specInstructions = "당신은 20년 경력의 특허청 심사관입니다. 다음 IDF를 바탕으로 법률적 명세서를 작성하세요. 반드시 JSON 형식으로 응답하세요: { \"title\": \"명칭\", \"problem\": \"과제\", \"solution\": \"해결수단\", \"claims\": [\"청구항1\", \"청구항2\"] }";
    const promptText = (mode === 'IDF') ? `${idfPrompt}\n\n입력 내용: "${userText}"` : `${specInstructions}\n\n대상 데이터: "${JSON.stringify(idf)}"`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });
      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const aiResponse = JSON.parse(jsonMatch[0]);

      if (mode === 'IDF') {
        setIdf(aiResponse);
        setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 분석 완료: ${aiResponse.title}` }]);
      } else {
        setSpec({ ...aiResponse, claims: Array.isArray(aiResponse.claims) ? aiResponse.claims : [aiResponse.claims] });
        setMessages(prev => [...prev, { role: 'bot', content: "✅ 명세서 설계 완료." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "❌ 오류가 발생했습니다. API 키와 설정을 확인하세요." }]);
    } finally { setIsGenerating(false); }
  };

  const linkIdfToSpec = () => { setMode('SPEC'); setInput(`${idf.title}에 대한 전문 특허 명세서를 설계해줘.`); };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      <div className="w-[35%] flex flex-col bg-white border-r shadow-2xl">
        <div className="p-5 bg-indigo-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2"><Bot size={24}/><h1 className="font-bold text-sm">Invention Agent Pro</h1></div>
          <div className="flex bg-indigo-800 rounded-md p-1">
            <button onClick={() => setMode('IDF')} className={`px-3 py-1 text-[10px] rounded ${mode === 'IDF' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>IDF</button>
            <button onClick={() => setMode('SPEC')} className={`px-3 py-1 text-[10px] rounded ${mode === 'SPEC' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>SPEC</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl text-xs shadow-sm max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex gap-2 text-slate-400 text-[10px] items-center"><Loader2 size={12} className="animate-spin"/> 엔진 가동 중...</div>}
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="아이디어를 입력하세요..." />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl"><Send size={16}/></button>
        </div>
      </div>
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-6">
          <button className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-50">STEP 1</span>
            <div className="flex items-center gap-2 font-bold text-sm"><Lightbulb size={16}/> 발명 특정 (IDF)</div>
          </button>
          {idf.title && <button onClick={linkIdfToSpec} className="bg-emerald-600 text-white px-4 rounded-xl shadow-lg hover:scale-105 transition-all"><ChevronRight size={24}/></button>}
          <button className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-50">STEP 2</span>
            <div className="flex items-center gap-2 font-bold text-sm"><Zap size={16}/> 권리 보호 (SPEC)</div>
          </button>
        </div>
        <div className="bg-white shadow-2xl p-8 rounded-xl min-h-screen border border-slate-300">
          {mode === 'IDF' ? (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-emerald-900 border-b-2 border-emerald-900 pb-1 uppercase italic">Invention Disclosure</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 p-4 bg-slate-50 rounded-lg border-l-4 border-emerald-500"><h3 className="text-[10px] font-black text-emerald-700 mb-1 uppercase">Title</h3><p className="text-sm font-bold">{idf.title || "발명의 명칭"}</p></div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100"><h3 className="text-[10px] font-black text-emerald-700 mb-1 uppercase">Novelty</h3><p className="text-xs">{idf.novelty}</p></div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100"><h3 className="text-[10px] font-black text-blue-700 mb-1 uppercase">Value</h3><p className="text-xs">{idf.commercial_value}</p></div>
                <div className="col-span-2 p-4 border rounded-lg"><h3 className="text-[10px] font-black text-slate-500 mb-1 uppercase">Tech Key</h3><p className="text-xs whitespace-pre-wrap">{idf.technical_key}</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h1 className="text-lg font-bold mb-4 border-b-2 border-black pb-1 text-center">【명세서】</h1>
              <div className="text-xs font-bold">【발명의 명칭】: <span className="text-indigo-800">{spec.title}</span></div>
              <div className="text-xs">【해결하려는 과제】: {spec.problem}</div>
              <div className="mt-6 p-4 bg-red-50/30 border border-red-100 rounded-lg text-xs">
                <h3 className="font-bold text-red-800 mb-2">【청구범위】</h3>
                {spec.claims.map((c, i) => ( <div key={i} className="mb-2"><b>【청구항 {i+1}】</b> {c}</div> ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
