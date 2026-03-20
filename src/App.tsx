import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, FileText, CheckCircle, AlertCircle, Scroll, Loader2, Paperclip, Image as ImageIcon, Trash2, Lock, RotateCcw, Copy, Check, Edit3, Sparkles } from 'lucide-react';

export default function App() {
  // === 인증 관련 상태 ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);
  const CORRECT_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

  // === 앱 상태 관리 ===
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'AI 명세서작성기가 활성화되었습니다. 아이디어를 입력하거나 도면을 추가하여 완벽한 명세서를 설계해 보세요.' }
  ]);
  const [input, setInput] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState("checking");
  const [validModelName, setValidModelName] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [drawings, setDrawings] = useState([]); 
  const fileInputRef = useRef(null);
  const drawingInputRef = useRef(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // === 뷰 모드 및 보고서 편집 상태 ===
  const [viewMode, setViewMode] = useState('spec'); 
  const [disclosureDraft, setDisclosureDraft] = useState('');

  // 명세서 상태
  const [spec, setSpec] = useState({ 
    title: '', technical_field: '', background: '', prior_art_patent: '', 
    prior_art_non_patent: '', problem: '', solution: '', effects: '', 
    brief_drawings: '', detailed_description: '', reference_numerals: '', claims: [], abstract: '', drawing_prompts: [],
    invention_disclosure: '' 
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // === API 모델 확인 ===
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkAndFindModel = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || !apiKey.startsWith("AIza")) {
        setApiKeyStatus("fail");
        return;
      }
      setApiKeyStatus("success");
      try {
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listResponse.json();
        const generateModels = listData.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
        let targetModel = generateModels.find(m => m.name.includes("flash")) || generateModels[0];
        if (targetModel) setValidModelName(targetModel.name);
      } catch (error) { console.error(error); }
    };
    checkAndFindModel();
  }, [isAuthenticated]);

  // === 유틸리티 함수 ===
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

  const cleanText = (data) => {
    if (!data) return "";
    if (typeof data === 'string') return data;
    if (typeof data === 'object') return data.text || data.content || JSON.stringify(data);
    return String(data);
  };

  const cleanClaim = (data) => {
    const text = cleanText(data);
    return text.replace(/^청구항\s*\d+\.?\s*|^\d+\.\s*/, '').trim();
  };

  const handleCopyPrompt = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ inline_data: { data: reader.result.split(',')[1], mime_type: file.type } });
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setAttachedFile(file);
  };

  const handleDrawingUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setDrawings(prev => [...prev, { id: Date.now(), src: event.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    }
  };

  const removeDrawing = (id) => setDrawings(prev => prev.filter(d => d.id !== id));

  const handleDownload = () => {
    if (!spec.title) { alert("먼저 명세서를 생성해 주세요."); return; }
    const defaultName = cleanText(spec.title).replace(/[^가-힣a-zA-Z0-9]/g, '_').substring(0, 20) || "특허명세서";
    const customFileName = prompt("저장할 파일 이름:", defaultName);
    if (customFileName === null) return;
    const finalFileName = (customFileName.trim() || defaultName) + ".doc";

    const title = cleanText(spec.title);
    const techField = cleanText(spec.technical_field);
    const background = cleanText(spec.background);
    const patRef = cleanText(spec.prior_art_patent) || "(내용 없음)";
    const nonPatRef = cleanText(spec.prior_art_non_patent) || "(내용 없음)";
    const problem = cleanText(spec.problem);
    const solution = cleanText(spec.solution);
    const effects = cleanText(spec.effects);
    const briefDrawings = cleanText(spec.brief_drawings);
    const detailedDesc = cleanText(spec.detailed_description);
    const refNumerals = cleanText(spec.reference_numerals);
    const abstractText = cleanText(spec.abstract);

    let claimsHtml = Array.isArray(spec.claims) ? spec.claims.map((c, i) => `<p style='font-weight:bold;'>【청구항 ${i+1}】</p><div class="indent" style='margin-left:30pt; margin-bottom:15pt;'>${cleanText(c)}</div>`).join('') : "";

    let drawingsHtml = drawings.length > 0 ? drawings.map((d, i) => `<p style='text-align:center; font-weight:bold; margin-top:30pt;'>【도 ${i+1}】</p><div style="text-align:center; margin:15pt 0;"><img src="${d.src}" width="450" style="border:0.5pt solid #cccccc;"/></div>`).join('') : "";
    if (drawingsHtml) drawingsHtml = `<br clear='all' style='page-break-before:always'/><p style='font-size:14pt; font-weight:bold; border-bottom:1pt solid black;'>【도면】</p>${drawingsHtml}`;

    const htmlParts = [
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>",
      "<head><meta charset='utf-8'><style>body { font-family:'Batang','Serif'; font-size:11pt; line-height:1.8; text-align:justify; } .indent { margin-left:30pt; margin-bottom:15pt; } h1 { font-size:16pt; text-align:center; border-bottom:2pt solid black; padding-bottom:5pt; margin-bottom:30pt; } h2 { font-size:12pt; font-weight:bold; margin-top:25pt; border-left:4pt solid #333333; padding-left:10pt; } h3 { font-size:11pt; font-weight:bold; margin-top:15pt; margin-bottom:5pt; }</style></head>",
      "<body><h1>【명세서】</h1><h2>【발명(고안)의 설명】</h2><h3>【발명(고안)의 명칭】</h3><div class='indent' style='color:#000088; font-weight:bold;'>"+title+"</div><h3>【기술분야】</h3><div class='indent'>"+techField+"</div><h3>【발명(고안)의 배경이 되는 기술】</h3><div class='indent'>"+background+"</div><h3>【선행기술문헌】</h3><div class='indent' style='white-space:pre-wrap;'>【특허문헌】<br/>"+patRef+"<br/><br/>【비특허문헌】<br/>"+nonPatRef+"</div><h2>【발명(고안)의 내용】</h2><h3>【해결하려는 과제】</h3><div class='indent'>"+problem+"</div><h3>【과제의 해결 수단】</h3><div class='indent'>"+solution+"</div><h3>【발명(고안)의 효과】</h3><div class='indent'>"+effects+"</div><h3>【도면의 간단한 설명】</h3><div class='indent' style='white-space:pre-line;'>"+briefDrawings+"</div><h3>【발명(고안)을 실시하기 위한 구체적인 내용】</h3><div class='indent' style='white-space:pre-wrap;'>"+detailedDesc+"</div><h3>【부호의 설명】</h3><div class='indent' style='white-space:pre-wrap;'>"+refNumerals+"</div><br clear='all' style='page-break-before:always'/><h2 style='border-left:4pt solid #CC0000;'>【청구범위】</h2><div style='background-color:#F9F9F9; padding:15pt; border:1pt solid #DDDDDD;'>"+claimsHtml+"</div><br clear='all' style='page-break-before:always'/><h1>【요약서】</h1><h3>【요약】</h3><div class='indent' style='white-space:pre-wrap;'>"+abstractText+"</div>"+drawingsHtml+"</body></html>"
    ];

    const blob = new Blob(['\ufeff', htmlParts.join('\n')], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url; downloadLink.download = finalFileName;
    document.body.appendChild(downloadLink); downloadLink.click();
    document.body.removeChild(downloadLink); URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (window.confirm("초기화하시겠습니까?")) {
      setSpec({ title: '', technical_field: '', background: '', prior_art_patent: '', prior_art_non_patent: '', problem: '', solution: '', effects: '', brief_drawings: '', detailed_description: '', reference_numerals: '', claims: [], abstract: '', drawing_prompts: [], invention_disclosure: '' });
      setDisclosureDraft(''); setViewMode('spec'); setDrawings([]); setAttachedFile(null); setInput('');
      setMessages([{ role: 'bot', content: '✨ 초기화되었습니다.' }]);
    }
  };

  // === 메인 생성 및 정제 로직 (오류 해결 지점) ===
  const handleSend = async (customPrompt = null) => {
    const isRefinement = customPrompt !== null;
    if (!isRefinement && !input.trim() && !attachedFile) return;

    const userText = isRefinement ? customPrompt : input;
    if (!isRefinement) {
        setMessages(prev => [...prev, { role: 'user', content: userText }]);
        setInput('');
    }
    setIsGenerating(true);

    const isModification = spec.title !== ""; 

    // 기존의 명세서 작성 원칙 (절대 수정 금지 구역)
    const instructions = `
      당신은 20년 경력의 대한민국 특허청 심사관입니다.

      [청구범위 작성 절대 원칙 - 위반 시 해고]:
      1. **독립항의 원칙**: 제1항은 발명의 필수 구성요소(예: 흡입부+챔버+램프+배출부)를 **모두 포함하여 하나의 문장**으로 구성해야 합니다. 절대 각 부품을 별도의 청구항(1항, 2항...)으로 쪼개지 마십시오.
      2. **결합 관계 명시**: 각 구성요소는 서로 유기적으로 연결되어야 하며, 문장 끝은 "...를 포함하는 공기 살균 장치."로 끝나야 합니다.
      3. **종속항의 원칙**: 제2항부터는 "제1항에 있어서, ..."로 시작하여 부가적인 특징(예: 램프 종류, 필터 유무)을 한정해야 합니다.
      4. **방법 발명**: 방법 발명인 경우 "단계"들을 하나의 청구항 안에 (a), (b), (c)로 포함시키십시오.

      [선행문헌 검색 및 작성 원칙 - 매우 중요]:
      1. 검색 도구 및 범위: 반드시 'google_search' 기능을 사용하여 한국(KR), 미국(US), 유럽(EP), 일본(JP), 중국(CN)의 실제 문헌을 검색하세요.
      2. 수량 제한: 특허 및 실용신안 문헌은 합계 **최대 4건**을 절대 넘기지 마세요. 가급적 2건 이상을 기재하세요.
      3. 명칭의 정확성 (매우 중요): 문헌 번호의 접미사를 확인하여 다음 용어를 엄격히 일치시키세요.
       - KR...A: 공개특허공보 / KR...B1: 등록특허공보
       - KR...U: 공개실용신안공보 / KR...Y1: **등록실용신안공보** (절대 '공개'로 기재 금지)
       - US...A1: 미국 공개특허 / US...B2: 미국 등록특허
      4. 비특허문헌 필터링: 학계의 주요 논문인 경우에만 기재하고, 일반 뉴스, 블로그, 개인 포스트 등 전문성이 낮은 자료는 제외하세요. 논문명, 연도, 권, 호, 페이지도 함께 표시하세요. (적합한 논문이 없으면 공란) 
      5. 출력 포맷: 전체 응답은 반드시 지정된 JSON 형식을 유지하세요.
      6. 검색된 실제 문헌의 명칭(공개특허공보, 등록특허공보, 공개실용신안공보, 등록실용신안공보) 및 번호, 발명의 명칭, 핵심 내용을 기반으로 'prior_art_patent'와 'prior_art_non_patent' 항목을 사실에 근거하여 작성하세요.
      7. 최종 확인 단계: 'prior_art_patent'를 작성할 때, 기재된 공보 명칭(공개/등록)이 번호의 접미사(A, B, Y)와 일치하는지 한 번 더 확인 프로세스를 거친 후 JSON을 생성하세요.

      [추가 명세서 작성 원칙 - 부호의 설명 및 요약서]:
      - 'reference_numerals' 필드에는 '발명(고안)을 실시하기 위한 구체적인 내용'에서 사용된 주요 도면 부호들을 정리하여 기재하세요.
      - 'abstract' 필드에는 본 발명이 해결하고자 하는 과제와 해결 수단의 핵심을 300자 내외로 명확하게 요약하여 작성하세요.

      [발명보고서(Invention Disclosure) 작성 지침]:
      - 'invention_disclosure' 필드에는 연구자와 발명자가 명확히 이해할 수 있도록 마크다운 형식으로 작성하세요. 
      - JSON의 안정성을 위해 텍스트 내 줄바꿈은 반드시 \\n으로 처리하고, 큰따옴표는 반드시 \\"로 이스케이프하세요.

      [명세서 본문 용어 기재 원칙 - 도면 종류에 따른 엄격한 구분]:
      명세서 본문 및 '부호의 설명'을 작성할 때, 구성요소의 성격에 따라 표기법을 철저히 구분하세요.
      1. **일반 구조물 및 부품 (사시도, 단면도 등)**: 도면에 숫자 부호만 들어가므로, 영문을 절대 병기하지 말고 "한글명칭(도면부호)" 형식으로만 깔끔하게 기재하세요. (작성 예시: "본체(100)의 상단에는...", "흡입구(110)를 통해...")
      2. **순서도 및 블록 다이어그램 (방법 발명 단계, 시스템 제어 블록 등)**: 도면에 영문 텍스트가 삽입될 수밖에 없으므로, 해당 구성요소나 단계를 설명할 때만 예외적으로 "한글명칭(영문명칭, 도면부호/단계부호)" 형식으로 영문을 병기하세요. (작성 예시: "데이터 수신 단계(Data Receiving Step, S110)에서는...", "제어부(Control Unit, 300)는...")

      [도면 생성 프롬프트 작성 지침]:
      - 'drawing_prompts' 필드에는 각 도면에 대응하는 이미지 생성 AI용 영문 프롬프트를 배열로 작성하세요.

      [출력 포맷]:
      반드시 아래 JSON 구조로만 응답하세요.
      { "summary": "...", "drawing_prompts": ["..."], "title": "...", "technical_field": "...", "background": "...", "prior_art_patent": "...", "prior_art_non_patent": "...", "problem": "...", "solution": "...", "effects": "...", "brief_drawings": "...", "detailed_description": "...", "reference_numerals": "...", "claims": ["..."], "abstract": "...", "invention_disclosure": "..." }
    `;

    let promptText = "";
    if (isRefinement) {
        promptText = `${instructions}\n [정제 요청]: 연구자가 발명보고서를 다음과 같이 수정했습니다: "${userText}". 이 기술적 수정을 반영하여 명세서 전체를 다시 완성하세요.`;
    } else if (isModification) {
      promptText = `${instructions}\n [현재 데이터]: ${JSON.stringify(spec)}\n [수정 요청]: "${userText}"\n 위 원칙에 맞춰 수정하고 요약해주세요.`;
    } else {
      promptText = `${instructions}\n [분석 대상]: "${userText}"\n 위 원칙에 맞춰 명세서와 보고서를 작성하세요.`;
    }

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      let contents = [{ parts: [{ text: promptText }] }];
      if (attachedFile) contents[0].parts.push(await fileToGenerativePart(attachedFile));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${validModelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents, tools: [{ google_search: {} }] })
      });

      const data = await response.json();
      let rawText = data.candidates[0].content.parts[0].text;
      
      // 🛠️ JSON 파싱 오류 해결을 위한 정밀 추출 로직
      const jsonStart = rawText.indexOf('{');
      const jsonEnd = rawText.lastIndexOf('}') + 1;
      const jsonString = rawText.substring(jsonStart, jsonEnd);

      try {
        const aiResponse = JSON.parse(jsonString);
        const processedClaims = Array.isArray(aiResponse.claims) ? aiResponse.claims.map(c => cleanClaim(c)) : [cleanClaim(aiResponse.claims)];

        const newSpec = {
          title: cleanText(aiResponse.title),
          technical_field: cleanText(aiResponse.technical_field),
          background: cleanText(aiResponse.background),
          prior_art_patent: cleanText(aiResponse.prior_art_patent),
          prior_art_non_patent: cleanText(aiResponse.prior_art_non_patent),
          problem: cleanText(aiResponse.problem),
          solution: cleanText(aiResponse.solution),
          effects: cleanText(aiResponse.effects),
          brief_drawings: cleanText(aiResponse.brief_drawings),
          detailed_description: cleanText(aiResponse.detailed_description),
          reference_numerals: cleanText(aiResponse.reference_numerals), 
          claims: processedClaims,
          abstract: cleanText(aiResponse.abstract), 
          drawing_prompts: Array.isArray(aiResponse.drawing_prompts) ? aiResponse.drawing_prompts : [],
          invention_disclosure: cleanText(aiResponse.invention_disclosure)
        };

        setSpec(newSpec);
        setDisclosureDraft(newSpec.invention_disclosure);
        setMessages(prev => [...prev, { role: 'bot', content: isRefinement ? "✨ 수정 내용이 명세서에 반영되었습니다." : `✅ 작성이 완료되었습니다.` }]);
        if (isRefinement) setViewMode('spec');
      } catch (e) {
        throw new Error("JSON 파싱에 실패했습니다. 내용을 조금 더 짧게 입력하시거나 다시 시도해 주세요.");
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: `⚠️ 오류: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
      setAttachedFile(null);
    }
  };

  // === UI 영역 (기존 스타일 유지) ===
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full bg-slate-100 items-center justify-center font-sans p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
          <div className="flex flex-col items-center mb-8"><div className="bg-indigo-100 p-4 rounded-full mb-4"><Lock size={32} className="text-indigo-700" /></div><h1 className="text-2xl font-bold">MAM-i Builder Pro</h1></div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="비밀번호" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 !bg-white !text-slate-900" autoFocus />
            <button type="submit" className="w-full bg-indigo-700 text-white font-bold p-3 rounded-xl">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-slate-100 font-sans overflow-hidden">
      {/* 왼쪽 채팅창 */}
      <div className="w-full lg:w-[40%] h-[40%] lg:h-full flex flex-col border-r border-slate-300 bg-white">
        <div className="p-4 border-b bg-indigo-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2"><Bot size={24}/> <h1 className="text-xl font-bold">MAM-i Builder Pro</h1></div>
          <span className="text-[10px] bg-indigo-800 px-2 py-1 rounded-full font-bold uppercase">{validModelName ? "System Ready" : "Loading"}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-slate-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{msg.content}</div>
            </div>
          ))}
          {isGenerating && <div className="flex justify-start"><div className="bg-white border p-3 rounded-2xl flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="animate-spin" size={16}/> 작업 중...</div></div>}
        </div>
        <div className="p-3 lg:p-6 border-t bg-white flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600"><Paperclip size={20}/></button>
          <button onClick={() => drawingInputRef.current?.click()} className="p-2 text-slate-400 hover:text-green-600"><ImageIcon size={20}/></button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <input type="file" ref={drawingInputRef} onChange={handleDrawingUpload} className="hidden" accept="image/*" />
          <input className="flex-1 p-3 text-sm border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 !bg-white !text-slate-900" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="아이디어 입력..." disabled={isGenerating} />
          <button onClick={() => handleSend()} className="p-3 bg-indigo-700 text-white rounded-xl" disabled={isGenerating}><Send size={18}/></button>
        </div>
      </div>

      {/* 오른쪽 미리보기 */}
      <div className="w-full lg:w-[60%] h-[60%] lg:h-full overflow-y-auto bg-slate-200 flex flex-col items-center">
        <div className="w-full flex justify-between items-center p-4 lg:p-6 shrink-0">
           <div className="flex bg-white p-1 rounded-xl border border-slate-300 shadow-sm">
             <button onClick={() => setViewMode('spec')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'spec' ? 'bg-indigo-700 text-white' : 'text-slate-500'}`}><Scroll size={14}/> 명세서 보기</button>
             <button onClick={() => setViewMode('disclosure')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'disclosure' ? 'bg-indigo-700 text-white' : 'text-slate-500'}`}><Edit3 size={14}/> 발명보고서 편집</button>
           </div>
           <div className="flex gap-2">
             <button onClick={handleReset} className="px-3 py-2 bg-slate-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"><RotateCcw size={14}/> 새로 작성</button>
             {viewMode === 'disclosure' ? (
                <button onClick={() => handleSend(disclosureDraft)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 animate-pulse"><Sparkles size={16}/> [수정 내용 반영하기]</button>
             ) : (
                <button onClick={handleDownload} className="px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-2"><FileText size={16}/> 워드 저장</button>
             )}
           </div>
        </div>

        <div className="w-full bg-white shadow-xl border border-slate-300 p-6 lg:p-16 min-h-screen mb-10 text-slate-900 text-justify leading-relaxed">
          {viewMode === 'spec' ? (
            <>
              <h1 className="text-xl font-bold mb-8 border-b-2 border-black pb-1 text-center">【명세서】</h1>
              <div className="space-y-6">
                <section>
                  <h2 className="font-bold mb-2">【발명(고안)의 설명】</h2>
                  <div className="mb-3"><h3 className="font-bold pl-2">【발명(고안)의 명칭】</h3><p className="pl-6 text-indigo-800 font-bold">{cleanText(spec.title)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【기술분야】</h3><p className="pl-6">{cleanText(spec.technical_field)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【발명(고안)의 배경이 되는 기술】</h3><p className="pl-6">{cleanText(spec.background)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【선행기술문헌】</h3><p className="pl-6 whitespace-pre-wrap">【특허문헌】<br/>{cleanText(spec.prior_art_patent)}</p><p className="pl-6 whitespace-pre-wrap">【비특허문헌】<br/>{cleanText(spec.prior_art_non_patent)}</p></div>
                  <h2 className="font-bold mb-2 mt-8">【발명(고안)의 내용】</h2>
                  <div className="mb-3"><h3 className="font-bold pl-2">【해결하려는 과제】</h3><p className="pl-6">{cleanText(spec.problem)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【과제의 해결 수단】</h3><p className="pl-6">{cleanText(spec.solution)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【발명(고안)의 효과】</h3><p className="pl-6">{cleanText(spec.effects)}</p></div>
                  {spec.drawing_prompts && spec.drawing_prompts.length > 0 && (
                    <div className="mb-8 p-6 bg-slate-50 border border-slate-300 rounded-xl">
                      <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-900"><ImageIcon size={18}/> AI 도면 생성용 영문 프롬프트</h3>
                      <div className="space-y-4">
                        {spec.drawing_prompts.map((p, idx) => (
                          <div key={idx} className="bg-white p-4 border rounded-lg flex justify-between gap-4">
                            <div className="flex-1"><h4 className="font-bold text-xs mb-2">【도 {idx + 1}】</h4><p className="text-[12px] text-slate-600 bg-slate-100 p-2 rounded">{cleanText(p)}</p></div>
                            <button onClick={() => handleCopyPrompt(cleanText(p), idx)} className="mt-7 p-2 bg-slate-100 rounded-lg">{copiedIdx === idx ? <Check size={16} color="green"/> : <Copy size={16}/>}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mb-3"><h3 className="font-bold pl-2">【도면의 간단한 설명】</h3><p className="pl-6 whitespace-pre-line">{cleanText(spec.brief_drawings)}</p></div>
                  <div className="mb-3"><h3 className="font-bold pl-2">【발명(고안)을 실시하기 위한 구체적인 내용】</h3><p className="pl-6 whitespace-pre-wrap">{cleanText(spec.detailed_description)}</p></div>
                  <div className="mb-3 mt-6"><h3 className="font-bold pl-2">【부호의 설명】</h3><p className="pl-6 whitespace-pre-wrap">{cleanText(spec.reference_numerals)}</p></div>
                </section>
                <section className="mt-8 border-t border-slate-200 pt-8">
                  <h2 className="font-bold mb-4">【청구범위】</h2>
                  <div className="bg-red-50/20 border border-red-100 p-6 rounded-lg min-h-[150px]">
                    {spec.claims.length > 0 ? spec.claims.map((c, idx) => (<div key={idx} className="mb-6"><h3 className="font-bold mb-2 text-red-800">【청구항 {idx + 1}】</h3><p className="pl-4 font-medium">{cleanText(c)}</p></div>)) : <div className="text-center text-slate-400 italic py-10">내용 없음</div>}
                  </div>
                </section>
                <section className="mt-8 border-t border-slate-200 pt-8">
                  <h2 className="font-bold mb-4">【요약서】</h2>
                  <div className="mb-3"><h3 className="font-bold pl-2">【요약】</h3><p className="pl-6 whitespace-pre-wrap">{cleanText(spec.abstract)}</p></div>
                </section>
                {drawings.length > 0 && (
                  <section className="mt-12 border-t-4 border-black pt-10">
                    <h2 className="text-center text-xl font-bold mb-10">【도 면】</h2>
                    <div className="flex flex-col items-center gap-12">
                      {drawings.map((d, index) => (
                        <div key={d.id} className="flex flex-col items-center w-full group relative">
                          <h3 className="font-bold mb-4 text-lg">【도 {index + 1}】</h3>
                          <img src={d.src} className="max-w-full border border-slate-300" />
                          <button onClick={() => removeDrawing(d.id)} className="absolute top-10 right-4 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          ) : (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-8 border-b-2 border-indigo-700 pb-3"><Edit3 className="text-indigo-700" size={28}/><h1 className="text-2xl font-bold">연구자용 발명보고서</h1></div>
              <textarea className="w-full h-[800px] p-8 border-2 border-slate-200 rounded-2xl outline-none font-sans text-base leading-relaxed bg-slate-50 shadow-inner resize-none focus:border-indigo-500 transition-all" value={disclosureDraft} onChange={(e) => setDisclosureDraft(e.target.value)} placeholder="기술 내용을 자유롭게 수정하세요." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
