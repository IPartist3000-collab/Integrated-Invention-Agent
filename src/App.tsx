import React, { useState, useEffect } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight, Scroll } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState('IDF'); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [idf, setIdf] = useState({ title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: '' });
  const [spec, setSpec] = useState({ title: '', technical_field: '', background: '', problem: '', solution: '', effects: '', claims: [], abstract: '' });
  const [messages, setMessages] = useState([{ role: 'bot', content: '지능형 발명 에이전트입니다. 엔진을 확인 중입니다...' }]);
  const [input, setInput] = useState('');
  const [validModelName, setValidModelName] = useState(null);

  // 엔진 체크 로직
  useEffect(() => {
    const findWorkingModel = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.models) {
          const generateModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
          const targetModel = generateModels.find(m => m.name.includes("flash")) || generateModels[0];
          if (targetModel) {
            setValidModelName(targetModel.name);
            setMessages([{ role: 'bot', content: '✅ 엔진 연결 성공! 222nm 살균 장치 아이디어를 입력해 보세요.' }]);
          }
        }
      } catch (error) {
        setMessages([{ role: 'bot', content: '❌ 엔진 연결 실패. API 설정을 확인하세요.' }]);
      }
    };
    findWorkingModel();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !validModelName) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    // [프롬프트 설계]
    const idfPrompt = `당신은 전문 IP 컨설턴트입니다. 다음 아이디어를 분석하여 반드시 JSON 형식으로만 응답하세요: { "title": "명칭", "problem": "기존 한계", "novelty": "핵심 신규성", "technical_key": "구현 방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    
    const specInstructions = `당신은 20년 경력의 대한민국 특허청 심사관입니다. 다음 IDF 데이터를 바탕으로 법률적 명세서를 작성하세요.
    - 독립항은 필수 구성요소를 모두 포함한 하나의 문장으로 구성할 것.
    - 청구항 1은 전체 시스템을, 청구항 2는 그 특징적 구성을 한정할 것.
    - 반드시 JSON 형식으로만 응답하세요: { "title": "명칭", "technical_field": "기술분야", "background": "배경기술", "problem": "해결하려는 과제", "solution": "과제의 해결수단", "effects": "발명의 효과", "claims": ["청구항1 내용", "청구항2 내용"], "abstract": "요약" }`;

    const promptText = (mode === 'IDF') 
      ? `${idfPrompt}\n\n입력: "${userText}"` 
      : `${specInstructions}\n\n[작성된 IDF 데이터]: ${JSON.stringify(idf)}\n\n[사용자 요청]: "${userText}"`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
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
        setMessages(prev => [...prev, { role: 'bot', content: "✅ 특허 명세서 설계 완료." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: `❌ 오류: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const linkIdfToSpec = () => {
    setMode('SPEC');
    setInput(`${idf.title}에 대한 전문 특허 명세서를 설계해줘.`);
  };

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽: 대화창 */}
      <div className="w-[35%] flex flex-col bg-white border-r shadow-2xl z-20">
        <div className="p-5 bg-indigo-900 text-white flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2"><Bot size={24}/> <h1 className="font-bold">Invention Agent Pro</h1></div>
          <div className="flex bg-indigo-800 rounded-md p-1 font-bold text-[10px]">
            <button onClick={() => setMode('IDF')} className={`px-4 py-1 rounded transition-colors ${mode === 'IDF' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>IDF</button>
            <button onClick={() => setMode('SPEC')} className={`px-4 py-1 rounded transition-colors ${mode === 'SPEC' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400'}`}>SPEC</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] break-words ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center pl-2"><Loader2 size={14} className="animate-spin"/> AI가 설계 중...</div>}
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="메시지 입력..." disabled={!validModelName} />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-lg hover:bg-indigo-800 transition-transform active:scale-95" disabled={!validModelName}><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽: 문서 프리뷰 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200 scroll-smooth">
        {/* 수정된 버튼 레이아웃: 정렬 및 간격 보정 */}
        <div className="flex gap-4 mb-8 sticky top-0 z-10 bg-slate-200 py-2">
          <button onClick={() => setMode('IDF')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700 shadow-xl scale-[1.02]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 1</span>
            <div className="flex items-center gap-2 font-black text-sm"><Lightbulb size={18}/> 발명 특정 (IDF)</div>
          </button>
          
          <div className="flex items-center">
            {idf.title && <button onClick={linkIdfToSpec} className="bg-emerald-600 text-white p-3 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"><ChevronRight size={24}/></button>}
          </div>
          
          <button onClick={() => setMode('SPEC')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700 shadow-xl scale-[1.02]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 2</span>
            <div className="flex items-center gap-2 font-black text-sm"><Zap size={18}/> 권리 보호 (명세서)</div>
          </button>
        </div>

        {/* 수정된 종이 레이아웃: 내용 넘침 방지(break-words) */}
        <div className="bg-white shadow-2xl p-10 lg:p-16 rounded-xl min-h-screen border border-slate-300 mx-auto w-full max-w-4xl break-words">
          {mode === 'IDF' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-black text-emerald-900 border-b-8 border-emerald-900 pb-3 italic uppercase tracking-tighter">Invention Disclosure Form</h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2 p-8 bg-slate-50 rounded-xl border-l-[12px] border-emerald-500 shadow-sm">
                  <h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Title of Invention</h3>
                  <p className="text-2xl font-bold text-slate-800 leading-tight">{idf.title || "아이디어를 기다리고 있습니다"}</p>
                </div>
                <div className="p-8 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Core Novelty</h3>
                  <p className="text-sm font-medium leading-relaxed">{idf.novelty}</p>
                </div>
                <div className="p-8 bg-blue-50/50 rounded-xl border border-blue-100">
                  <h3 className="text-xs font-black text-blue-700 mb-3 uppercase tracking-widest">Commercial Value</h3>
                  <p className="text-sm font-medium leading-relaxed">{idf.commercial_value}</p>
                </div>
                <div className="col-span-2 p-8 border border-slate-200 rounded-xl bg-white shadow-inner">
                  <h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Technical Implementation</h3>
                  <p className="text-sm whitespace-pre-wrap leading-loose text-slate-700">{idf.technical_key}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">
              <h1 className="text-2xl font-bold mb-10 border-b-2 border-slate-900 pb-2 text-center uppercase tracking-[0.2em]">【특허 명세서】</h1>
              <div className="space-y-8">
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0 min-w-[100px]">【명칭】</span><p className="text-indigo-900 font-black">{spec.title}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【해결하려는 과제】</span><p className="text-sm text-slate-700 leading-relaxed pl-4">{spec.problem}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【과제의 해결수단】</span><p className="text-sm text-slate-700 leading-relaxed pl-4">{spec.solution}</p></div>
                
                <div className="mt-12 p-8 bg-red-50/20 border-2 border-red-100 rounded-2xl shadow-inner">
                  <h3 className="font-black text-red-800 mb-6 flex items-center gap-2"><Scroll size={20}/> 【특허청구범위】</h3>
                  {spec.claims.length > 0 ? spec.claims.map((c, i) => ( 
                    <div key={i} className="mb-6 last:mb-0">
                      <h4 className="font-black text-xs text-red-600 mb-2 underline decoration-red-200 underline-offset-4 tracking-widest">【청구항 {i+1}】</h4>
                      <p className="text-sm pl-4 leading-8 text-slate-800 border-l-2 border-red-100 font-medium">{c}</p>
                    </div> 
                  )) : <p className="text-slate-400 text-sm italic py-10 text-center w-full">데이터를 기반으로 청구항을 생성하려면 전송 버튼을 눌러주세요.</p>}
                </div>

                <div className="flex flex-col gap-2 border-t pt-8"><span className="font-bold text-slate-900">【요약】</span><p className="text-sm text-slate-600 leading-relaxed pl-4 italic">{spec.abstract}</p></div>
              </div>
            </div>
          )}
        </div>
        <div className="h-20 w-full shrink-0"></div> {/* 하단 여백 확보 */}
      </div>
    </div>
  );
}
