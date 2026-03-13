import React, { useState } from 'react';
import { Send, Bot, Loader2, Lightbulb, Zap, ChevronRight } from 'lucide-react';

export default function App() {
  // === 1. 상태 관리 ===
  const [mode, setMode] = useState('IDF'); // 'IDF' 또는 'SPEC'
  const [isGenerating, setIsGenerating] = useState(false);
  
  // IDF 데이터 (발명 특정)
  const [idf, setIdf] = useState({
    title: '', problem: '', novelty: '', technical_key: '', effects: '', commercial_value: '', summary: ''
  });

  // 명세서 데이터 (권리 보호)
  const [spec, setSpec] = useState({ 
    title: '', problem: '', solution: '', claims: []
  });

  const [messages, setMessages] = useState([
    { role: 'bot', content: '지능형 발명 에이전트입니다. 222nm 살균 장치와 같은 혁신적인 아이디어를 입력해 주세요.' }
  ]);
  const [input, setInput] = useState('');

  // === 2. 핵심 로직: handleSend (수정본) ===
  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsGenerating(true);

    // 프롬프트 설정
    const idfPrompt = `당신은 전문 IP 컨설턴트입니다. 다음 기술 아이디어를 분석하여 반드시 JSON 형식으로만 응답하세요: { "title": "명칭", "problem": "기존한계", "novelty": "핵심신규성", "technical_key": "구현방법", "effects": "효과", "commercial_value": "상업성", "summary": "요약" }`;
    
    const specInstructions = `당신은 20년 경력의 특허청 심사관입니다. 다음 IDF를 바탕으로 법률적 명세서를 작성하세요. 반드시 JSON 형식으로 응답하세요: { "title": "명칭", "problem": "과제", "solution": "해결수단", "claims": ["청구항1", "청구항2"] }`;

    const promptText = (mode === 'IDF') 
      ? `${idfPrompt}\n\n입력 내용: "${userText}"` 
      : `${specInstructions}\n\n대상 데이터: "${JSON.stringify(idf)}"`;

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      // 모델명을 직접 지정하여 불확실성 제거
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }] 
        })
      });

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0]) {
        throw new Error("API 응답 오류. API 키와 Vercel 설정을 확인하세요.");
      }

      const rawText = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON 형식을 찾을 수 없습니다.");
      
      const aiResponse = JSON.parse(jsonMatch[0]);

      if (mode === 'IDF') {
        setIdf(aiResponse);
        setMessages(prev => [...prev, { role: 'bot', content: `✅ IDF 분석 완료: ${aiResponse.title}` }]);
      } else {
        setSpec({ 
          ...aiResponse, 
          claims: Array.isArray(aiResponse.claims) ? aiResponse.claims : [aiResponse.claims] 
        });
        setMessages(prev => [...prev, { role: 'bot', content: `✅ 명세서 설계가 완료되었습니다.` }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'bot', content: `❌ 오류: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // IDF -> SPEC 연동 엔진
  const linkIdfToSpec = () => {
    setMode('SPEC');
    setInput(`${idf.title}에 대한 전문 특허 명세서를 설계해줘.`);
  };

  // === 3. UI 레이아웃 ===
  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽: 대화창 */}
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
          {isGenerating && <div className="flex gap-2 text-slate-400 text-xs items-center"><Loader2 size={14} className="animate-spin"/> 엔진 가동 중...</div>}
        </div>

        <div className="p-4 border-t bg-white flex gap-2">
          <input 
            className="flex-1 p-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
            placeholder="아이디어를 입력하세요..." 
          />
          <button onClick={handleSend} className="p-2 bg-indigo-700 text-white rounded-xl shadow-md"><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽: 문서 프리뷰 */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-200">
        <div className="flex gap-4 mb-6 sticky top-0 z-10">
          <button className={`flex-1
