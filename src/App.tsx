import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight, Scroll, Lock, AlertCircle, FileText, RotateCcw } from 'lucide-react';

export default function App() {
  // === 1. 상태 관리: 인증 + IDF + SPEC 데이터 ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

  const [mode, setMode] = useState('IDF'); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [idf, setIdf] = useState({ title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: '' });
  const [spec, setSpec] = useState({ title: '', technical_field: '', background: '', problem: '', solution: '', effects: '', claims: [], abstract: '' });
  const [messages, setMessages] = useState([{ role: 'bot', content: '지능형 발명 에이전트가 활성화되었습니다. 아이디어를 입력하여 IDF와 명세서 설계를 시작하세요.' }]);
  const [input, setInput] = useState('');
  const [validModelName, setValidModelName] = useState(null);

  // === 2. 엔진 초기화 및 모델 감지 ===
  useEffect(() => {
    if (!isAuthenticated) return;
    const findWorkingModel = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        if (data.models) {
          const generateModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
          const targetModel = generateModels.find(m => m.name.includes("flash")) || generateModels[0];
          if (targetModel) setValidModelName(targetModel.name);
        }
      } catch (error) { console.error(error); }
    };
    findWorkingModel();
  }, [isAuthenticated]);

  // === 3. 인증 핸들러 ===
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput('');
    }
  };

  // === 4. 안전한 파싱 로직 ===
  const safeParse = (data) => {
    try {
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) return null;
      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) { return null; }
  };

  // === 5. 핵심 로직: IDF -> SPEC 전주기 자동 설계 ===
  const handleSend = async () => {
    if (!input.trim() || !validModelName) return;

    const userText = input;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    // [프롬프트 지침] 참고 코드의 실무 원칙 적용
    const idfInstructions = `당신은 전문 IP 컨설턴트입니다. 다음 아이디어를 분석하여 IDF를 JSON으로 반환하세요. { "title": "명칭", "problem": "기존 한계", "novelty": "핵심 신규성", "technical_key": "구현 방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    
    const specInstructions = `당신은 20년 경력의 대한민국 특허청 심사관입니다.
    [청구범위 작성 절대 원칙]:
    1. 독립항(제1항)은 발명의 필수 구성요소를 모두 포함하여 반드시 '하나의 문장'으로 구성하십시오.
    2. 결합 관계 명시: 각 구성요소는 유기적으로 연결되어야 하며, 문장 끝은 "...를 포함하는 [발명의 명칭]."으로 끝나야 합니다.
    3. 종속항: 제2항부터는 "제1항에 있어서, ..."로 시작하여 부가적 특징을 한정하세요.
    반드시 다음 JSON 형식으로만 응답하세요: { "title": "명칭", "technical_field": "분야", "background": "배경", "problem": "과제", "solution": "수단", "effects": "효과", "claims": ["청구항1", "청구항2"], "abstract": "요약" }`;

    try {
      // --- STEP 1: IDF 생성 ---
      const idfRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${idfInstructions}\n\n[입력]: "${userText}"` }] }] })
      });
      const idfData = await idfRes.json();
      const idfResult = safeParse(idfData);
      if (!idfResult) throw new Error("IDF 생성 실패");
      setIdf(idfResult);

      // --- STEP 2: 자동 명세서 생성 ---
      const specRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${specInstructions}\n\n[대상 IDF]: ${JSON.stringify(idfResult)}` }] }] })
      });
      const specData = await specRes.json();
      const specResult = safeParse(specData);

      if (specResult) {
        setSpec({ ...specResult, claims: Array.isArray(specResult.claims) ? specResult.claims : [specResult.claims] });
        setMode('SPEC');
        setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 및 전문 명세서 설계가 완료되었습니다.` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: `❌ 오류: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // === 6. UI 렌더링 (로그인 화면) ===
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full bg-slate-100 items-center justify-center font-sans p-4">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-100 p-4 rounded-full mb-4"><Lock size={32} className="text-indigo-700" /></div>
            <h1 className="text-2xl font-bold text-slate-800">Invention Agent Pro</h1>
            <p className="text-slate-500 text-sm mt-2 text-center">심사관 전용 시스템입니다. 비밀번호를 입력하세요.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" 
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${loginError ? 'border-red-500' : 'border-slate-300'}`} autoFocus />
            {loginError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={14}/> 비밀번호가 틀렸습니다.</p>}
            <button type="submit" className="w-full bg-indigo-700 text-white font-bold p-3 rounded-xl hover:bg-indigo-800 transition-all active:scale-95 shadow-lg">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  // === 7. UI 렌더링 (메인 화면) ===
  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽 대화창 */}
      <div className="w-[35%] flex flex-col bg-white border-r shadow-2xl z-20">
        <div className="p-5 bg-indigo-900 text-white flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2"><Bot size={24}/> <h1 className="font-bold uppercase tracking-tight">Invention Agent Pro</h1></div>
          <div className="flex bg-indigo-800 rounded-md p-1 font-bold text-[10px]">
            <button onClick={() => setMode('IDF')} className={`px-4 py-1 rounded transition-colors ${mode === 'IDF' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'}`}>IDF</button>
            <button onClick={() => setMode('SPEC')} className={`px-4 py-1 rounded transition-colors ${mode === 'SPEC' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400'}`}>SPEC</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm break-words ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center pl-2"><Loader2 size={14} className="animate-spin"/> AI가 정밀 분석 중...</div>}
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="아이디어를 입력하세요..." disabled={isGenerating} />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-lg hover:bg-indigo-800 active:scale-95" disabled={isGenerating}><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽 프리뷰 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-8 sticky top-0 z-10 bg-slate-200 py-2">
          <button onClick={() => setMode('IDF')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700 shadow-xl scale-[1.01]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 1</span>
            <div className="flex items-center gap-2 font-black text-sm"><Lightbulb size={18}/> 발명 특정 (IDF)</div>
          </button>
          <div className="flex items-center">
            {idf.title && <button onClick={() => setMode('SPEC')} className="bg-emerald-600 text-white p-3 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"><ChevronRight size={24}/></button>}
          </div>
          <button onClick={() => setMode('SPEC')} className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700 shadow-xl scale-[1.01]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
            <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 2</span>
            <div className="flex items-center gap-2 font-black text-sm"><Zap size={18}/> 권리 보호 (명세서)</div>
          </button>
        </div>

        <div className="bg-white shadow-2xl p-10 lg:p-16 rounded-xl min-h-screen border border-slate-300 mx-auto w-full max-w-4xl break-words">
          {mode === 'IDF' ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-emerald-900 border-b-8 border-emerald-900 pb-3 italic uppercase tracking-tighter">Invention Disclosure Form</h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2 p-8 bg-slate-50 rounded-xl border-l-[12px] border-emerald-500 shadow-sm"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Title</h3><p className="text-2xl font-bold">{idf.title || "아이디어를 입력하세요"}</p></div>
                <div className="p-8 bg-emerald-50/50 rounded-xl border border-emerald-100"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Novelty</h3><p className="text-sm font-medium">{idf.novelty}</p></div>
                <div className="p-8 bg-blue-50/50 rounded-xl border border-blue-100"><h3 className="text-xs font-black text-blue-700 mb-3 uppercase tracking-widest">Value</h3><p className="text-sm font-medium">{idf.commercial_value}</p></div>
                <div className="col-span-2 p-8 border border-slate-200 rounded-xl bg-white shadow-inner"><h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Technical Implementation</h3><p className="text-sm whitespace-pre-wrap leading-loose text-slate-700">{idf.technical_key}</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">
              <h1 className="text-2xl font-bold mb-10 border-b-2 border-slate-900 pb-2 text-center uppercase tracking-widest">【특허 명세서】</h1>
              <div className="space-y-6">
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0 min-w-[100px]">【명칭】</span><p className="text-indigo-900 font-black">{spec.title}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【해결하려는 과제】</span><p className="text-sm text-slate-700 leading-relaxed pl-4 border-l-2 border-slate-100">{spec.problem}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【과제의 해결수단】</span><p className="text-sm text-slate-700 leading-relaxed pl-4 border-l-2 border-slate-100">{spec.solution}</p></div>
                <div className="mt-12 p-8 bg-red-50/20 border-2 border-red-100 rounded-2xl shadow-inner">
                  <h3 className="font-black text-red-800 mb-6 flex items-center gap-2"><Scroll size={20}/> 【특허청구범위】</h3>
                  {spec.claims.map((c, i) => ( 
                    <div key={i} className="mb-6 last:mb-0">
                      <h4 className="font-black text-xs text-red-600 mb-2 underline decoration-red-200 underline-offset-4 tracking-widest">【청구항 {i+1}】</h4>
                      <p className="text-sm pl-4 leading-8 text-slate-800 border-l-2 border-red-100 font-medium text-justify">{c}</p>
                    </div> 
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-6 border-t border-slate-100"><span className="font-bold text-slate-900">【요약】</span><p className="text-sm text-slate-600 leading-relaxed pl-4 italic">{spec.abstract}</p></div>
              </div>
            </div>
          )}
        </div>
        <div className="h-20 shrink-0"></div>
      </div>
    </div>
  );
}
