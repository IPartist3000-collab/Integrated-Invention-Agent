\import React, { useState, useEffect } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight, Scroll, Lock, AlertCircle, FileText } from 'lucide-react';

export default function App() {
  // === 1. 상태 관리: 인증 및 데이터 ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

  const [mode, setMode] = useState('IDF'); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [idf, setIdf] = useState({ title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: '' });
  const [spec, setSpec] = useState({ title: '', technical_field: '', background: '', problem: '', solution: '', effects: '', claims: [], abstract: '' });
  const [messages, setMessages] = useState([{ role: 'bot', content: '✅ 보안 인증 완료. 아이디어를 입력하면 IDF 분석 후 명세서까지 한 번에 설계합니다.' }]);
  const [input, setInput] = useState('');
  const [validModelName, setValidModelName] = useState(null);

  // === 2. 엔진 초기화: 모델 자동 감지 ===
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
      } catch (error) { console.error("엔진 로드 실패:", error); }
    };
    findWorkingModel();
  }, [isAuthenticated]);

  // === 3. 핸들러: 로그인 및 워드 다운로드 ===
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

  const handleDownload = () => {
    if (!spec.title) { alert("명세서를 먼저 생성해주세요."); return; }
    const htmlContent = `<html><head><meta charset='utf-8'><style>body{font-family:serif; line-height:1.6; padding:50px;}</style></head><body><h1>【명세서】</h1><h2>【발명의 명칭】</h2><p>${spec.title}</p><h2>【청구범위】</h2>${spec.claims.map((c, i) => `<p>【청구항 ${i+1}】<br/>${c}</p>`).join('')}</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `특허명세서_${spec.title}.doc`;
    link.click();
  };

  const safeParseJSON = (data) => {
    try {
      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) { return null; }
  };

  // === 4. 핵심 로직: IDF -> SPEC 전주기 자동 설계 ===
  const handleSend = async () => {
    if (!input.trim() || !validModelName) return;

    const userText = input;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    const idfPrompt = `당신은 전문 IP 컨설턴트입니다. 다음 아이디어를 분석하여 IDF JSON을 반환하세요. { "title": "명칭", "problem": "기존 한계", "novelty": "핵심 신규성", "technical_key": "구현 방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    const specInstructions = `당신은 20년 경력의 대한민국 특허청 심사관입니다. 다음 IDF 데이터를 바탕으로 법률적 명세서를 설계하세요. 
    [청구항 제1항 작성 절대 원칙]: 발명의 필수 구성요소를 모두 포함하여 반드시 '하나의 문장'으로 구성하십시오. 
    JSON 응답: { "title": "명칭", "technical_field": "기술분야", "background": "배경기술", "problem": "과제", "solution": "수단", "effects": "효과", "claims": ["항1", "항2"], "abstract": "요약" }`;

    try {
      // Step 1: IDF 생성
      const idfRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${idfPrompt}\n\n입력: "${userText}"` }] }] })
      });
      const idfData = await idfRes.json();
      const idfJson = safeParseJSON(idfData);
      if (!idfJson) throw new Error("분석 구조 오류");
      setIdf(idfJson);
      setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 분석 완료. 자동으로 명세서를 설계합니다...` }]);

      // Step 2: SPEC 자동 설계 (Chaining)
      const specRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${specInstructions}\n\n[대상]: ${JSON.stringify(idfJson)}` }] }] })
      });
      const specData = await specRes.json();
      const specJson = safeParseJSON(specData);
      
      if (specJson) {
        setSpec({ ...specJson, claims: Array.isArray(specJson.claims) ? specJson.claims : [specJson.claims] });
        setMode('SPEC');
        setMessages(prev => [...prev, { role: 'bot', content: `✅ 특허 명세서 설계가 완료되었습니다.` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: `❌ 오류: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // === 5. UI 렌더링: 로그인 화면 ===
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full bg-slate-100 items-center justify-center font-sans p-4">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-100 p-4 rounded-full mb-4"><Lock size={32} className="text-indigo-700" /></div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Invention Agent Pro</h1>
            <p className="text-slate-500 text-sm mt-2">비밀번호를 입력하여 접속하세요.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" 
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${loginError ? 'border-red-500' : 'border-slate-300'}`} autoFocus />
            {loginError && <p className="text-red-500 text-xs flex items-center gap-1 mt-1"><AlertCircle size={14}/> 비밀번호가 일치하지 않습니다.</p>}
            <button type="submit" className="w-full bg-indigo-700 text-white font-bold p-3 rounded-xl hover:bg-indigo-800 transition-all shadow-lg active:scale-95">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  // === 6. UI 렌더링: 메인 화면 ===
  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽 대화창 */}
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
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center pl-2"><Loader2 size={14} className="animate-spin"/> 엔진 분석 중...</div>}
        </div>
        <div className="p-4 border-t bg-white flex gap-2">
          <input className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="아이디어를 입력하세요..." disabled={isGenerating} />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-lg hover:bg-indigo-800 active:scale-95" disabled={isGenerating}><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽 프리뷰 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-8 sticky top-0 z-10 bg-slate-200 py-2 justify-between items-center">
          <div className="flex gap-4 flex-1">
            <button onClick={() => setMode('IDF')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'IDF' ? 'border-emerald-500 bg-white text-emerald-700 shadow-xl scale-[1.01]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 1</span>
              <div className="flex items-center gap-2 font-black text-sm"><Lightbulb size={18}/> 발명 특정 (IDF)</div>
            </button>
            <button onClick={() => setMode('SPEC')} className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${mode === 'SPEC' ? 'border-blue-500 bg-white text-blue-700 shadow-xl scale-[1.01]' : 'bg-slate-50/80 text-slate-400 border-transparent'}`}>
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest italic">Step 2</span>
              <div className="flex items-center gap-2 font-black text-sm"><Zap size={18}/> 권리 보호 (명세서)</div>
            </button>
          </div>
          {mode === 'SPEC' && spec.title && (
            <button onClick={handleDownload} className="ml-4 p-4 bg-blue-700 text-white rounded-2xl shadow-xl hover:bg-blue-800 flex items-center gap-2 font-bold text-sm transition-all active:scale-95">
              <FileText size={18}/> 워드 저장
            </button>
          )}
        </div>

        <div className="bg-white shadow-2xl p-10 lg:p-16 rounded-xl min-h-screen border border-slate-300 mx-auto w-full max-w-4xl break-words relative">
          {mode === 'IDF' ? (
            <div className="space-y-10 animate-in fade-in duration-500">
              <h2 className="text-3xl font-black text-emerald-900 border-b-8 border-emerald-900 pb-3 italic uppercase tracking-tighter">Invention Disclosure Form</h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="col-span-2 p-8 bg-slate-50 rounded-xl border-l-[12px] border-emerald-500 shadow-sm"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Title</h3><p className="text-2xl font-bold text-slate-800 leading-tight">{idf.title || "분석 대기 중"}</p></div>
                <div className="p-8 bg-emerald-50/50 rounded-xl border border-emerald-100"><h3 className="text-xs font-black text-emerald-700 mb-3 uppercase tracking-widest">Core Novelty</h3><p className="text-sm font-medium leading-relaxed">{idf.novelty}</p></div>
                <div className="p-8 bg-blue-50/50 rounded-xl border border-blue-100"><h3 className="text-xs font-black text-blue-700 mb-3 uppercase tracking-widest">Value</h3><p className="text-sm font-medium leading-relaxed">{idf.commercial_value}</p></div>
                <div className="col-span-2 p-8 border border-slate-200 rounded-xl bg-white shadow-inner"><h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Technical Implementation</h3><p className="text-sm whitespace-pre-wrap leading-loose text-slate-700">{idf.technical_key}</p></div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">
              <h1 className="text-2xl font-bold mb-10 border-b-2 border-slate-900 pb-2 text-center uppercase tracking-widest tracking-tighter">【특허 명세서】</h1>
              <div className="space-y-6">
                <div className="flex gap-4"><span className="font-bold text-slate-900 shrink-0 min-w-[100px]">【명칭】</span><p className="text-indigo-900 font-black">{spec.title}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【해결하려는 과제】</span><p className="text-sm text-slate-700 leading-relaxed pl-4 border-l-2 border-slate-100 whitespace-pre-wrap break-words">{spec.problem}</p></div>
                <div className="flex flex-col gap-2"><span className="font-bold text-slate-900">【과제의 해결수단】</span><p className="text-sm text-slate-700 leading-relaxed pl-4 border-l-2 border-slate-100 whitespace-pre-wrap break-words">{spec.solution}</p></div>
                <div className="mt-12 p-8 bg-red-50/20 border-2 border-red-100 rounded-2xl shadow-inner text-justify">
                  <h3 className="font-black text-red-800 mb-6 flex items-center gap-2"><Scroll size={20}/> 【특허청구범위】</h3>
                  {spec.claims.map((c, i) => ( 
                    <div key={i} className="mb-6 last:mb-0">
                      <h4 className="font-black text-xs text-red-600 mb-2 underline decoration-red-200 underline-offset-4 tracking-widest">【청구항 {i+1}】</h4>
                      <p className="text-sm pl-4 leading-8 text-slate-800 border-l-2 border-red-100 font-medium whitespace-pre-wrap break-words">{c}</p>
                    </div> 
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-6 border-t border-slate-100"><span className="font-bold text-slate-900 font-bold">【요약】</span><p className="text-sm text-slate-600 leading-relaxed pl-4 whitespace-pre-wrap italic break-words">{spec.abstract}</p></div>
              </div>
            </div>
          )}
        </div>
        <div className="h-20 shrink-0"></div>
      </div>
    </div>
  );
}
