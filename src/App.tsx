import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, FileText, CheckCircle, AlertCircle, Scroll, Loader2, Paperclip, Image as ImageIcon, Trash2, Lock, RotateCcw, Copy, Check, Lightbulb, Zap, ChevronRight } from 'lucide-react';

export default function App() {
  // === 1. 상태 관리: 기존 명세서 데이터 + IDF 데이터 통합 ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [mode, setMode] = useState('IDF'); // 'IDF' (발명 특정) 또는 'SPEC' (명세서 작성)
  const [isGenerating, setIsGenerating] = useState(false);
  
  // IDF 데이터 (연구자 관점의 기술 특정)
  const [idf, setIdf] = useState({
    title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: ''
  });

  // 명세서 데이터 (기존 MAM-i Builder Pro 구조 100% 유지)
  const [spec, setSpec] = useState({ 
    title: '', technical_field: '', background: '', prior_art_patent: '', 
    prior_art_non_patent: '', problem: '', solution: '', effects: '', 
    brief_drawings: '', detailed_description: '', reference_numerals: '', claims: [], abstract: '', drawing_prompts: [] 
  });

  const [messages, setMessages] = useState([{ role: 'bot', content: '지능형 발명 에이전트입니다. 아이디어를 입력하여 IDF를 먼저 작성하거나 바로 명세서 설계를 시작하세요.' }]);
  const [input, setInput] = useState('');
  const [validModelName, setValidModelName] = useState(null);

  // === 2. 핵심 로직: 에이전트 페르소나 및 연동 엔진 ===
  const handleSend = async () => {
    if (!input.trim() || !validModelName) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    // [프롬프트 전략] 모드에 따라 AI의 전문성을 다르게 설정
    const idfPrompt = `당신은 연구자의 모호한 아이디어를 과학적으로 분석하여 '발명'으로 특정해주는 전문 IP 컨설턴트입니다. 다음 형식의 JSON으로만 응답하세요: { "title": "명칭", "problem": "기존 한계", "novelty": "핵심 신규성", "technical_key": "구현 방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    
    const specInstructions = `당신은 20년 경력의 대한민국 특허청 심사관입니다. [청구범위 작성 절대 원칙]: 1. 독립항은 필수 구성요소를 모두 포함한 하나의 문장으로 구성... (기존 명세서 로직 유지)`;

    const promptText = (mode === 'IDF') 
      ? `${idfPrompt}\n\n입력 내용: "${userText}"` 
      : `${specInstructions}\n\n[분석 대상]: "${userText}"`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], tools: [{ google_search: {} }] })
      });

      const data = await response.json();
      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const aiResponse = JSON.parse(rawText.match(/\{[\s\S]*\}/)[0]);

      if (mode === 'IDF') {
        setIdf(aiResponse);
        setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 생성 완료: ${aiResponse.summary}` }]);
      } else {
        setSpec({ ...aiResponse, claims: Array.isArray(aiResponse.claims) ? aiResponse.claims : [aiResponse.claims] });
        setMessages(prev => [...prev, { role: 'bot', content: `✅ 명세서 설계 완료.` }]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  // [연동 엔진] IDF 데이터를 명세서 작성의 기반 입력값으로 자동 주입
  const linkIdfToSpec = () => {
    setMode('SPEC');
    setInput(`작성된 IDF의 핵심 신규성("${idf.novelty}")과 해결 수단("${idf.technical_key}")을 바탕으로 법률적 명세서를 설계해줘.`);
  };

  // === 3. UI 레이아웃: 전주기 에이전트 인터페이스 ===
  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽: 지능형 대화창 */}
      <div className="w-[35%] flex flex-col bg-white border-r shadow-2xl">
        <div className="p-5 bg-indigo-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2"><Bot size={24}/> <h1 className="font-bold">Invention Agent Pro</h1></div>
          <div className="flex bg-indigo-800 rounded-md p-1">
            <button onClick={() => setMode('IDF')} className={`px-3 py-1 text-[10px] rounded ${mode === 'IDF' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>IDF</button>
            <button onClick={() => setMode('SPEC')} className={`px-3 py-1 text-[10px] rounded ${mode === 'SPEC' ? 'bg-blue-500 text-white' : 'text-slate-400'}`}>SPEC</button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center"><Loader2 size={14} className="animate-spin"/> 분석 중...</div>}
        </div>

        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder={`${mode === 'IDF' ? '아이디어' : '수정 사항'} 입력...`} />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-md"><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽: 문서 프리뷰 및 워크플로우 컨트롤 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-6 sticky top-0 z-10">
          <button onClick={() => setMode('IDF')} className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700 shadow-md' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-50">STEP 1. IDENTIFY</span>
            <div className="flex items-center gap-2 font-bold"><Lightbulb size={18}/> 발명 특정 (IDF)</div>
          </button>
          
          {idf.title && <button onClick={linkIdfToSpec} className="bg-emerald-600 text-white px-4 rounded-xl shadow-lg hover:scale-105 transition-all"><ChevronRight size={32}/></button>}
          
          <button onClick={() => setMode('SPEC')} className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700 shadow-md' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-50">STEP 2. LEGALIZE</span>
            <div className="flex items-center gap-2 font-bold"><Zap size={18}/> 권리 보호 (명세서)</div>
          </button>
        </div>

        <div className="bg-white shadow-2xl p-12 lg:p-20 rounded-xl min-h-screen border border-slate-300">
          {mode === 'IDF' ? (
            <div className="space-y-8">
              <h2 className="text-2xl font-black text-emerald-900 border-b-4 border-emerald-900 pb-2">Invention Disclosure Form</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 p-6 bg-slate-50 rounded-lg border-l-8 border-emerald-500"><h3 className="text-xs font-black text-emerald-700 mb-2 uppercase">Title of Invention</h3><p className="text-xl font-bold">{idf.title || "발명의 명칭"}</p></div>
                <div className="p-6 bg-emerald-50 rounded-lg border border-emerald-100"><h3 className="text-xs font-black text-emerald-700 mb-2 uppercase">Core Novelty</h3><p className="text-sm leading-relaxed">{idf.novelty}</p></div>
                <div className="p-6 bg-blue-50 rounded-lg border border-blue-100"><h3 className="text-xs font-black text-blue-700 mb-2 uppercase">Commercial Value</h3><p className="text-sm leading-relaxed">{idf.commercial_value}</p></div>
                <div className="col-span-2 p-6 border rounded-lg"><h3 className="text-xs font-black text-slate-500 mb-2 uppercase">Technical Description</h3><p className="text-sm whitespace-pre-wrap">{idf.technical_key}</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h1 className="text-xl font-bold mb-8 border-b-2 border-black pb-1 text-center uppercase tracking-tighter">【명세서】</h1>
              <div className="mb-4"><h3 className="font-bold">【발명(고안)의 명칭】</h3><p className="pl-4 text-indigo-800 font-bold">{spec.title}</p></div>
              <div className="mb-4"><h3 className="font-bold">【해결하려는 과제】</h3><p className="pl-4 text-sm">{spec.problem}</p></div>
              <div className="mt-10 p-6 bg-red-50/30 border border-red-100 rounded-xl">
                <h3 className="font-bold text-red-800 mb-4">【청구범위】</h3>
                {spec.claims.map((c, i) => ( <div key={i} className="mb-4"><h4 className="font-bold text-xs text-red-600 mb-1">【청구항 {i+1}】</h4><p className="text-sm pl-2 leading-relaxed">{c}</p></div> ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
