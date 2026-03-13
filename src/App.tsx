import React, { useState, useEffect } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight, Scroll } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState('IDF'); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState('');
  
  // 데이터 상태 관리
  const [idf, setIdf] = useState({ title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: '' });
  const [spec, setSpec] = useState({ title: '', problem: '', solution: '', claims: [] });
  const [messages, setMessages] = useState([{ role: 'bot', content: '지능형 발명 에이전트입니다. 아이디어를 입력하여 IDF를 작성하거나 명세서 설계를 시작하세요.' }]);

  // [수정 포인트] 모델 이름을 자동으로 설정하는 로직 추가
  const [validModelName, setValidModelName] = useState('models/gemini-1.5-flash');

  const handleSend = async () => {
    if (!input.trim() || !validModelName) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    const idfPrompt = `당신은 전문 IP 컨설턴트입니다. 다음 아이디어를 분석하여 반드시 JSON 형식으로만 응답하세요: { "title": "명칭", "problem": "기존 한계", "novelty": "핵심 신규성", "technical_key": "구현 방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    const specInstructions = `당신은 20년 경력의 대한민국 특허청 심사관입니다. 다음 데이터를 바탕으로 법률적 명세서를 설계하세요. 반드시 JSON 형식으로 응답하세요: { "title": "명칭", "problem": "과제", "solution": "해결수단", "claims": ["청구항1", "청구항2"] }`;

    const promptText = (mode === 'IDF') 
      ? `${idfPrompt}\n\n입력 내용: "${userText}"` 
      : `${specInstructions}\n\n[분석 대상]: "${JSON.stringify(idf)}"`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const aiResponse = JSON.parse(rawText.match(/\{[\s\S]*\}/)[0]);

      if (mode === 'IDF') {
        setIdf(aiResponse);
        setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 생성 완료: ${aiResponse.title}` }]);
      } else {
        setSpec({ ...aiResponse, claims: Array.isArray(aiResponse.claims) ? aiResponse.claims : [aiResponse.claims] });
        setMessages(prev => [...prev, { role: 'bot', content: `✅ 명세서 설계 완료.` }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: "❌ 오류가 발생했습니다. API 키를 확인해 주세요." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const linkIdfToSpec = () => {
    setMode('SPEC');
    setInput(`${idf.title}의 IDF를 바탕으로 법률적 명세서를 설계해줘.`);
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden text-slate-900">
      {/* 왼쪽: 지능형 대화창 */}
      <div className="w-[35%] flex flex-col bg-white border-r shadow-2xl">
        <div className="p-5 bg-indigo-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2"><Bot size={24}/> <h1 className="font-bold">Invention Agent Pro</h1></div>
          <div className="flex bg-indigo-800 rounded-md p-1">
            <button onClick={() => setMode('IDF')} className={`px-3 py-1 text-[10px] rounded font-bold ${mode === 'IDF' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>IDF</button>
            <button onClick={() => setMode('SPEC')} className={`px-3 py-1 text-[10px] rounded font-bold ${mode === 'SPEC' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>SPEC</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center pl-2"><Loader2 size={14} className="animate-spin"/> 엔진 분석 중...</div>}
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="아이디어를 입력하세요..." />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-md"><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽: 문서 프리뷰 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-6 sticky top-0 z-10">
          <button onClick={() => setMode('IDF')} className={`flex-1 p-5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700 shadow-xl' : 'bg-slate-50/50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Step 1. Identify</span>
            <div className="flex items-center gap-2 font-black text-lg"><Lightbulb size={20}/> 발명 특정 (IDF)</div>
          </button>
          {idf.title && <button onClick={linkIdfToSpec} className="bg-emerald-600 text-white px-5 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"><ChevronRight size={32}/></button>}
          <button onClick={() => setMode('SPEC')} className={`flex-1 p-5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700 shadow-xl' : 'bg-slate-50/50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Step 2. Legalize</span>
            <div className="flex items-center gap-2 font-black text-lg"><Zap size={20}/> 권리 보호 (명세서)</div>
          </button>
        </div>

        <div className="bg-white shadow-2xl p-12 lg:p-20 rounded-xl min-h-screen border border-slate-300 mx-auto w-full max-w-4xl">
          {mode === 'IDF' ? (
            <div className="space-y-10">
              <h2 className="text-3xl font-black text-emerald-900 border-b-8 border-emerald-900 pb-3 italic uppercase">Invention Disclosure</h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2 p-8 bg-slate-50 rounded-xl border-l-[12px] border-emerald-500 shadow-sm"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Title of Invention</h3><p className="text-2xl font-bold">{idf.title || "아이디어를 기다리고 있습니다"}</p></div>
                <div className="p-8 bg-emerald-50/50 rounded-xl border border-emerald-100"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Core Novelty</h3><p className="text-sm leading-relaxed">{idf.novelty}</p></div>
                <div className="p-8 bg-blue-50/50 rounded-xl border border-blue-100"><h3 className="text-xs font-black text-blue-700 mb-3 uppercase tracking-widest">Value</h3><p className="text-sm leading-relaxed">{idf.commercial_value}</p></div>
                <div className="col-span-2 p-8 border border-slate-200 rounded-xl bg-white"><h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Technical Implementation</h3><p className="text-sm whitespace-pre-wrap leading-loose text-slate-700">{idf.technical_key}</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold mb-10 border-b-2 border-slate-900 pb-2 text-center uppercase tracking-widest">【특허 명세서】</h1>
              <div className="space-y-6">
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0">【명칭】</span><p className="text-indigo-900 font-black">{spec.title}</p></div>
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0">【과제】</span><p className="text-sm text-slate-700 leading-relaxed">{spec.problem}</p></div>
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0">【수단】</span><p className="text-sm text-slate-700 leading-relaxed">{spec.solution}</p></div>
                <div className="mt-12 p-8 bg-red-50/20 border-2 border-red-100 rounded-2xl">
                  <h3 className="font-black text-red-800 mb-6 flex items-center gap-2">【특허청구범위】</h3>
                  {spec.claims.map((c, i) => ( 
                    <div key={i} className="mb-6 last:mb-0"><h4 className="font-black text-xs text-red-600 mb-2">【청구항 {i+1}】</h4><p className="text-sm pl-4 leading-7 text-slate-800 border-l-2 border-red-100">{c}</p></div> 
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
