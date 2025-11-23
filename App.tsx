
import React, { useState, useRef, useEffect } from 'react';
import { analyzeInput, generateChatReply } from './services/geminiService';
import { RecordData, RecordType, ChatMessage } from './types';
import { CalendarView } from './components/CalendarView';
import { ListView } from './components/ListView';
import { 
  PenLine, Mic, Camera, X, Loader2, 
  Menu, Search, CalendarDays, LayoutGrid, 
  Tag, Check, ArrowLeft, Sparkles, Lightbulb, Clock,
  Save, Home as HomeIcon, Dice5, Send, List, Plus
} from 'lucide-react';

// --- HELPERS ---
const loadRecords = (): RecordData[] => {
  try {
    const saved = localStorage.getItem('muse_records');
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
};

const saveRecordsToStorage = (records: RecordData[]) => {
  localStorage.setItem('muse_records', JSON.stringify(records));
};

const formatDividerTime = (ts: number) => {
    const d = new Date(ts);
    return `${(d.getMonth() + 1)}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getLocalISOString = (ts: number) => {
    const d = new Date(ts);
    const offset = d.getTimezoneOffset() * 60000; // offset in milliseconds
    return (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
};

// --- APP COMPONENT ---
export default function App() {
  // View State
  const [view, setView] = useState<'HOME' | 'LIST' | 'SEARCH' | 'EDIT_RECORD'>('HOME');
  const [homeMode, setHomeMode] = useState<'CALENDAR' | 'WATERFALL' | 'LIST'>('CALENDAR');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [records, setRecords] = useState<RecordData[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<RecordData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editing State
  const [editingRecord, setEditingRecord] = useState<Partial<RecordData> | null>(null);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Voice State
  const [inputText, setInputText] = useState('');
  const inputTextRef = useRef(''); 
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  
  // Inline Voice State
  const [isInlineListening, setIsInlineListening] = useState(false);
  const inlineTargetRef = useRef<'EDIT_CONTENT' | 'CHAT_INPUT' | null>(null);
  
  // Visuals
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const loaded = loadRecords();
    setRecords(loaded);
    setFilteredRecords(loaded);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredRecords(records);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredRecords(records.filter(r => 
        r.content.toLowerCase().includes(lowerQ) ||
        r.topic.toLowerCase().includes(lowerQ) ||
        r.keywords.some(k => k.toLowerCase().includes(lowerQ)) ||
        r.mediaMeta?.title.toLowerCase().includes(lowerQ)
      ));
    }
  }, [searchQuery, records]);

  // Scroll chat to bottom
  useEffect(() => {
    if (view === 'EDIT_RECORD' && chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, view]);

  // --- ACTIONS ---

  const handleAnalyze = async (text: string, imageBase64?: string, isReAnalysis = false) => {
    if (!text && !imageBase64) return;
    setIsProcessing(true);
    try {
      const result = await analyzeInput(text, imageBase64);
      
      const initialKeywords: string[] = [];
      if (result.detectedType === 'BOOK') initialKeywords.push('书籍');
      if (result.detectedType === 'MOVIE') initialKeywords.push('电影');
      if (result.detectedType === 'MUSIC') initialKeywords.push('音乐');

      if (isReAnalysis && editingRecord) {
        setEditingRecord({
            ...editingRecord,
            topic: result.isMedia ? (result.mediaMeta?.title || result.noteData.topic) : result.noteData.topic,
            content: result.noteData.content, 
            category: result.noteData.category,
            keywords: [...(editingRecord.keywords || []), ...initialKeywords] 
        });
        setSuggestedKeywords(result.noteData.keywords);
      } else {
        const isImageInit = !!imageBase64 && !text;
        const title = result.isMedia ? (result.mediaMeta?.title || result.noteData.topic) : result.noteData.topic;

        const newRecordDraft: Partial<RecordData> = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            type: result.isMedia ? (result.detectedType as RecordType) : RecordType.NOTE,
            content: isImageInit ? "" : result.noteData.content, 
            topic: title,
            keywords: initialKeywords,
            category: result.noteData.category,
            mediaMeta: result.isMedia ? {
                title: title,
                creator: result.mediaMeta?.creator || "未知创作者",
                genre: result.mediaMeta?.genre || "", 
                coverUrl: imageBase64 || "",         
                year: result.mediaMeta?.region || "" 
            } : undefined,
            originalImage: !result.isMedia ? (imageBase64 || undefined) : undefined,
            chatHistory: []
        };

        setSuggestedKeywords(result.noteData.keywords);
        setEditingRecord(newRecordDraft);
        setChatMessages([]);
        setView('EDIT_RECORD');
      }
    } catch (e) {
      alert("Xyla 分析遇到了一点小问题，请重试 >_<");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePenClick = () => {
      setEditingRecord({
          id: Date.now().toString(),
          timestamp: Date.now(),
          type: RecordType.NOTE,
          content: '',
          topic: '',
          keywords: [],
          category: '生活',
          chatHistory: []
      });
      setChatMessages([]); 
      setSuggestedKeywords([]);
      setView('EDIT_RECORD');
  };

  const saveCurrentRecord = () => {
    if (!editingRecord) return;
    
    const finalRecord: RecordData = {
        ...editingRecord,
        id: editingRecord.id || Date.now().toString(),
        timestamp: editingRecord.timestamp || Date.now(),
        type: editingRecord.type || RecordType.NOTE,
        content: editingRecord.content || "",
        topic: editingRecord.topic || (editingRecord.content ? editingRecord.content.slice(0, 12) : "无标题"),
        keywords: editingRecord.keywords || [],
        category: editingRecord.category || "生活",
        chatHistory: chatMessages
    } as RecordData;
  
    const existingIndex = records.findIndex(r => r.id === finalRecord.id);
    let newRecords;
    if (existingIndex >= 0) {
        newRecords = [...records];
        newRecords[existingIndex] = finalRecord;
    } else {
        newRecords = [...records, finalRecord];
    }
  
    setRecords(newRecords);
    saveRecordsToStorage(newRecords);
    
    setEditingRecord(null);
    setInputText('');
    inputTextRef.current = '';
    setView('HOME');
  };

  const handleFeelingLucky = () => {
      if (records.length === 0) {
          alert("还没有记录哦，快去记一笔吧！");
          return;
      }
      const randomRecord = records[Math.floor(Math.random() * records.length)];
      setEditingRecord(randomRecord);
      setChatMessages(randomRecord.chatHistory || []);
      setSuggestedKeywords([]);
      setView('EDIT_RECORD');
      setIsSidebarOpen(false);
  };

  const triggerXylaAnalysis = async () => {
      const hasContent = editingRecord?.content?.trim();
      const hasImage = editingRecord?.originalImage || editingRecord?.mediaMeta?.coverUrl;
      
      if (!hasContent && !hasImage) {
          setChatMessages(prev => [...prev, { role: 'model', text: "这好像是一张空白的纸...你想写点什么，或者画点什么吗？🎨", timestamp: Date.now() }]);
          return;
      }

      setIsChatLoading(true);
      
      let context = editingRecord?.content || "";
      if (!context && hasImage) {
          context = "[用户上传了一张图片，但没有写文字]";
      }

      const reply = await generateChatReply(
          context,
          [],
          "请对这段内容（如果是图片请基于图片）做一个简短有趣的点评，并询问我是否想深入探讨。"
      );
      setChatMessages(prev => [...prev, { role: 'model', text: reply ?? "...", timestamp: Date.now() }]);
      setIsChatLoading(false);
  };

  const handleChatSend = async () => {
      if (!chatInput.trim() || isChatLoading) return;
      
      const userMsg = chatInput;
      setChatInput('');
      const newHistory = [...chatMessages, { role: 'user' as const, text: userMsg, timestamp: Date.now() }];
      setChatMessages(newHistory);
      setIsChatLoading(true);

      const reply = await generateChatReply(
          editingRecord?.content || (editingRecord?.originalImage ? "[图片内容]" : ""),
          newHistory,
          userMsg
      );

      setChatMessages([...newHistory, { role: 'model', text: reply ?? '...', timestamp: Date.now() }]);
      setIsChatLoading(false);
  };

  // --- VOICE LOGIC ---
  
  const startVoiceRecognition = (
      onResult: (text: string) => void, 
      onEnd: () => void,
      continuous = false
  ) => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("当前浏览器不支持语音输入");
        return null;
    }
    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        
        if (final) {
             inputTextRef.current += final;
        }
        onResult(inputTextRef.current + interim);
    };
    
    recognition.onerror = (e: any) => { 
        console.error("Voice Error", e); 
    };
    recognition.onend = onEnd;
    
    try { recognition.start(); } catch(e) { console.error(e); }
    return recognition;
  };

  // Main Press-to-Talk Logic
  const startListening = () => {
    if (isListeningRef.current) return;
    
    setInputText('');
    inputTextRef.current = '';
    setIsListening(true);
    isListeningRef.current = true;

    recognitionRef.current = startVoiceRecognition(
        (text) => {
            setInputText(text);
        },
        () => {
            // handled manually
        },
        true 
    );
  };

  const stopListeningAndProcess = () => {
    if (!isListeningRef.current) return;
    
    setIsListening(false);
    isListeningRef.current = false;
    
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }

    // Wait briefly for final results then process
    setTimeout(() => {
        const text = inputTextRef.current || inputText; 
        
        if (!text.trim()) {
            return; 
        }

        setEditingRecord({
            id: Date.now().toString(),
            timestamp: Date.now(),
            type: RecordType.NOTE,
            content: text,
            topic: text.slice(0, 10) + (text.length > 10 ? "..." : ""),
            keywords: [],
            category: '生活',
            chatHistory: []
        });
        setChatMessages([]);
        setSuggestedKeywords([]);
        setView('EDIT_RECORD');
        setInputText('');
        // DISABLED AUTO-ANALYSIS: User must click button to analyze
        // handleAnalyze(text, undefined, false); 
    }, 200);
  };

  const toggleInlineVoice = (target: 'EDIT_CONTENT' | 'CHAT_INPUT') => {
      if (isInlineListening) {
          recognitionRef.current?.stop();
          setIsInlineListening(false);
          inlineTargetRef.current = null;
      } else {
          inlineTargetRef.current = target;
          setIsInlineListening(true);
          
          recognitionRef.current = startVoiceRecognition(
              (text) => {
                  if (target === 'EDIT_CONTENT') {
                      setEditingRecord(prev => prev ? ({ ...prev, content: (prev.content || '') + text }) : null);
                  } else if (target === 'CHAT_INPUT') {
                      setChatInput(prev => prev + text);
                  }
              },
              () => {
                  setIsInlineListening(false);
                  inlineTargetRef.current = null;
              },
              true
          );
      }
  };

  // --- EDITING HELPERS ---
  const toggleKeyword = (kw: string) => {
    if (!editingRecord) return;
    const current = editingRecord.keywords || [];
    if (current.includes(kw)) {
      setEditingRecord({ ...editingRecord, keywords: current.filter(k => k !== kw) });
    } else {
      if (current.length >= 5) {
          alert("最多只能添加 5 个关键词哦");
          return;
      }
      setEditingRecord({ ...editingRecord, keywords: [...current, kw] });
    }
  };
  
  const handleAddKeyword = () => {
      if (keywordInput.trim() && editingRecord) {
          const newKw = keywordInput.trim();
          const currentKw = editingRecord.keywords || [];
          
          if (currentKw.length >= 5 && !currentKw.includes(newKw)) {
              alert("最多只能添加 5 个关键词哦");
              return;
          }

          if (!currentKw.includes(newKw)) {
              setEditingRecord({ ...editingRecord, keywords: [...currentKw, newKw] });
          }
          setKeywordInput('');
      }
  };

  // --- UI RENDERERS ---

  const NeuButton = ({ onClick, icon: Icon, active, className = "", size="md" }: any) => {
      const sizeClass = size === "lg" ? "w-14 h-14" : "w-10 h-10";
      return (
          <button 
            onClick={onClick}
            className={`${sizeClass} rounded-full flex items-center justify-center text-neu-text transition-all duration-200 ${active ? 'shadow-neu-pressed text-green-600' : 'shadow-neu-flat hover:text-green-600 active:shadow-neu-pressed'} ${className}`}
          >
              <Icon size={size === "lg" ? 24 : 20} strokeWidth={1.5} />
          </button>
      );
  };

  // Reusable component for the specific Home Buttons
  const HomeActionButton = ({ onClick, icon: Icon, bgClass, textClass, isBreathing, neonColor, ...props }: any) => (
    // Reduced padding from p-4 to p-2 to shrink recessed area
    <div className="rounded-full p-2 bg-neu-base shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08),inset_-6px_-6px_12px_rgba(255,255,255,1)] flex items-center justify-center relative">
       <button 
          onClick={onClick}
          className={`
            w-20 h-20 rounded-full
            flex items-center justify-center
            transition-all duration-300
            ${bgClass} ${textClass}
            ${isBreathing ? 'animate-pulse-glow' : ''}
            active:scale-95
            shadow-lg
            select-none touch-none
          `}
          style={{
             // Ensure neon glow is tighter
             boxShadow: isBreathing ? undefined : `0 0 10px ${neonColor}`,
             WebkitTapHighlightColor: 'transparent'
          }}
          {...props}
        >
          <Icon size={32} strokeWidth={2} />
        </button>
    </div>
  );

  const renderTopBar = () => (
    <div className={`pt-12 pb-4 px-6 bg-neu-base sticky top-0 z-30 flex flex-col shadow-sm/10 transition-opacity duration-300 ${isListening ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between h-12">
            <NeuButton onClick={() => setIsSidebarOpen(true)} icon={Menu} active={isSidebarOpen} />
            <button 
                onClick={() => setView('HOME')}
                className="w-12 h-12 rounded-full bg-neu-base shadow-neu-flat flex items-center justify-center active:shadow-neu-pressed transition-all transform hover:scale-105 text-green-500"
            >
                <HomeIcon size={20} strokeWidth={2} className="text-green-600" />
            </button>
            <NeuButton 
                onClick={() => { setSearchQuery(''); setView('SEARCH'); }} 
                icon={Search} 
                active={view === 'SEARCH'} 
            />
       </div>
    </div>
  );

  const renderSidebar = () => (
    <>
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-neu-base/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      <div className={`fixed top-0 left-0 h-full w-3/4 max-w-xs bg-neu-base z-50 shadow-neu-flat transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 pt-12 flex flex-col h-full">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-bold text-neu-text">菜单</h2>
              <NeuButton onClick={() => setIsSidebarOpen(false)} icon={X} size="sm"/>
           </div>
           
           <div className="mb-8">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">显示模式</h3>
               <div className="flex flex-col gap-4 pl-2">
                  <button onClick={() => { setHomeMode('CALENDAR'); setView('LIST'); setIsSidebarOpen(false); }} className="flex items-center gap-3 text-neu-text hover:text-green-600 transition-colors">
                      <CalendarDays size={18} /> 日历视图
                  </button>
                  <button onClick={() => { setHomeMode('WATERFALL'); setView('LIST'); setIsSidebarOpen(false); }} className="flex items-center gap-3 text-neu-text hover:text-green-600 transition-colors">
                      <LayoutGrid size={18} /> 瀑布流视图
                  </button>
                  <button onClick={() => { setHomeMode('LIST'); setView('LIST'); setIsSidebarOpen(false); }} className="flex items-center gap-3 text-neu-text hover:text-green-600 transition-colors">
                      <List size={18} /> 列表视图
                  </button>
               </div>
           </div>
           
           <div className="flex-1 overflow-y-auto no-scrollbar">
                 <div className="mt-auto pt-10">
                    <p className="text-xs text-slate-300 text-center">共 {records.length} 条记忆</p>
                 </div>
           </div>
        </div>
      </div>
    </>
  );

  const renderHome = () => (
      <div className="flex-1 flex flex-col relative items-center justify-center pb-20">
          {/* Main Buttons Area */}
          <div className="flex flex-col gap-10 items-center z-10 animate-fade-in">
              <HomeActionButton 
                  onClick={handlePenClick} 
                  icon={PenLine} 
                  bgClass="bg-black"
                  textClass="text-white"
                  neonColor="rgba(34, 197, 94, 0.4)"
              />
              
              <HomeActionButton 
                  // Mouse Events
                  onMouseDown={(e: React.SyntheticEvent) => { e.preventDefault(); startListening(); }}
                  onMouseUp={(e: React.SyntheticEvent) => { e.preventDefault(); stopListeningAndProcess(); }}
                  onMouseLeave={(e: React.SyntheticEvent) => { if(isListeningRef.current) stopListeningAndProcess(); }}
                  // Touch Events
                  onTouchStart={(e: React.SyntheticEvent) => { e.preventDefault(); startListening(); }}
                  onTouchEnd={(e: React.SyntheticEvent) => { e.preventDefault(); stopListeningAndProcess(); }}
                  onContextMenu={(e: React.SyntheticEvent) => e.preventDefault()}
                  
                  icon={Mic} 
                  bgClass="bg-green-500"
                  textClass="text-black"
                  isBreathing={true}
                  neonColor="rgba(34, 197, 94, 0.6)"
              />
              
              <HomeActionButton 
                  onClick={() => fileInputRef.current?.click()} 
                  icon={Camera} 
                  bgClass="bg-black"
                  textClass="text-white"
                  neonColor="rgba(34, 197, 94, 0.4)"
              />
          </div>
          <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    const r = new FileReader();
                    r.onload = () => {
                        const base64 = r.result as string;
                        setEditingRecord({
                            id: Date.now().toString(),
                            timestamp: Date.now(),
                            type: RecordType.NOTE,
                            content: '', 
                            topic: '图片笔记',
                            keywords: [],
                            category: '生活',
                            originalImage: base64,
                            chatHistory: []
                        });
                        setChatMessages([]);
                        setSuggestedKeywords([]);
                        setView('EDIT_RECORD');
                    };
                    r.readAsDataURL(file);
                }
            }}/>
      </div>
  );

  const renderBottomBar = () => (
      <div className={`absolute bottom-0 left-0 right-0 bg-neu-base pb-8 pt-4 z-20 border-t border-slate-50 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] transition-opacity duration-300 ${isListening ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="h-px bg-transparent w-3/4 mx-auto mb-2"></div>
          <div className="flex justify-between items-center px-8 max-w-sm mx-auto h-10">
               <NeuButton 
                  onClick={() => { setHomeMode('CALENDAR'); setView('LIST'); }} 
                  icon={CalendarDays} 
                  active={homeMode === 'CALENDAR' && view === 'LIST'}
               />
               <NeuButton 
                  onClick={() => { setHomeMode('WATERFALL'); setView('LIST'); }} 
                  icon={LayoutGrid} 
                  active={homeMode === 'WATERFALL' && view === 'LIST'}
               />
               <NeuButton 
                  onClick={() => { setHomeMode('LIST'); setView('LIST'); }} 
                  icon={List} 
                  active={homeMode === 'LIST' && view === 'LIST'}
               />
               <NeuButton 
                  onClick={handleFeelingLucky} 
                  icon={Dice5} 
               />
          </div>
      </div>
  );

  const renderListeningOverlay = () => {
    if (!isListening) return null;

    // Fixed absolute positioning relative to app container
    // Removed bottom spacer to ensure flex centering matches renderHome perfectly
    return (
        <div className="absolute inset-0 z-[60] bg-neu-base/95 backdrop-blur-md flex flex-col pointer-events-none">
             {/* Dummy Top Bar Spacer (Matches renderTopBar height) */}
             <div className="pt-12 pb-4 px-6 flex flex-col opacity-0">
                <div className="h-12"></div>
             </div>

             {/* Middle Section (Matches renderHome) */}
             <div className="flex-1 flex flex-col relative items-center justify-center pb-20">
                
                {/* Text positioned absolutely to avoid affecting flow */}
                <div className="absolute top-[15%] w-full text-center px-6">
                      <div className="text-2xl font-bold text-green-600 animate-pulse">聆听中...</div>
                </div>

                <div className="flex flex-col gap-10 items-center">
                    {/* Ghost Top Button */}
                    <div className="p-2 rounded-full opacity-0">
                         <div className="w-20 h-20" />
                    </div>

                    {/* The Active Recording Button Clone */}
                    <div className="rounded-full p-2 bg-neu-base shadow-[inset_6px_6px_12px_rgba(0,0,0,0.08),inset_-6px_-6px_12px_rgba(255,255,255,1)] flex items-center justify-center relative">
                         <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center animate-pulse-glow">
                             <Mic size={32} strokeWidth={2} className="text-black" />
                         </div>
                    </div>

                    {/* Ghost Bottom Button */}
                    <div className="p-2 rounded-full opacity-0">
                         <div className="w-20 h-20" />
                    </div>
                </div>

                <div className="absolute bottom-[15%] w-full px-8 text-center">
                      <p className="text-xl text-neu-text font-medium leading-relaxed break-words min-h-[3rem]">
                          {inputText || "..."}
                      </p>
                      <p className="text-xs text-slate-400 mt-6">松开结束录音</p>
                </div>
             </div>
        </div>
    );
  };

  const renderEditRecord = () => {
    if (!editingRecord) return null;
    const isMedia = editingRecord.type !== RecordType.NOTE;
    
    const currentKw = editingRecord.keywords || [];
    const suggestionKw = suggestedKeywords.filter(k => !currentKw.includes(k));
    
    const allHistoryKw = new Set<string>();
    records.forEach(r => r.keywords.forEach(k => allHistoryKw.add(k)));
    
    const historyKw = Array.from(allHistoryKw).filter(k => {
        if (currentKw.includes(k) || suggestionKw.includes(k)) return false;
        const textToSearch = `${editingRecord.topic || ''} ${editingRecord.content || ''}`.toLowerCase();
        return textToSearch.includes(k.toLowerCase());
    }).slice(0, 8);

    return (
      <div className="fixed inset-0 bg-neu-base flex flex-col z-50 overflow-hidden animate-fade-in">
         {/* Header */}
         <div className="pt-12 px-6 pb-2 flex justify-between items-center bg-neu-base sticky top-0 z-20">
            <NeuButton onClick={() => saveCurrentRecord()} icon={ArrowLeft} />
            <div className="w-10"></div>
            <button onClick={saveCurrentRecord} className="w-10 h-10 bg-neu-base rounded-full text-neu-text shadow-neu-flat active:shadow-neu-pressed flex items-center justify-center transition-all hover:text-green-600">
               <Check size={20}/>
            </button>
         </div>

         <div className="flex-1 overflow-y-auto no-scrollbar pt-4">
            <div className="px-6 pb-6">
                {(editingRecord.mediaMeta?.coverUrl || editingRecord.originalImage) && (
                   <div className="w-full aspect-square rounded-3xl overflow-hidden mb-8 p-2 bg-neu-base shadow-neu-flat relative group">
                      <img 
                        src={editingRecord.mediaMeta?.coverUrl || editingRecord.originalImage} 
                        className="w-full h-full object-contain rounded-2xl"
                        alt="Cover" 
                      />
                      <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             handleAnalyze("请详细描述这张图片的内容并总结", editingRecord.originalImage || editingRecord.mediaMeta?.coverUrl, true);
                          }}
                          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-neu-base/90 backdrop-blur shadow-neu-flat active:shadow-neu-pressed flex items-center justify-center text-yellow-500 z-10 border border-yellow-100 hover:scale-105 transition-transform"
                      >
                          <Lightbulb size={20} strokeWidth={2} />
                      </button>
                   </div>
                )}

                <div className="mb-8 relative">
                    <input 
                        className="w-full text-2xl font-bold text-neu-text placeholder-slate-300 bg-neu-base shadow-neu-pressed-sm rounded-2xl px-5 py-4 focus:outline-none focus:text-green-600 transition-colors"
                        value={isMedia ? editingRecord.mediaMeta?.title : editingRecord.topic}
                        onChange={e => isMedia ? setEditingRecord({...editingRecord, mediaMeta: {...editingRecord.mediaMeta!, title: e.target.value}}) : setEditingRecord({...editingRecord, topic: e.target.value})}
                        placeholder={isMedia ? "作品标题" : "灵感标题"}
                    />
                </div>

                <div className="relative mb-6 group">
                    <textarea 
                        className="w-full min-h-[160px] text-base text-neu-text leading-loose bg-neu-base shadow-neu-pressed rounded-2xl p-5 focus:outline-none resize-none pb-12 placeholder-slate-300"
                        value={editingRecord.content || ''}
                        onChange={e => setEditingRecord({ ...editingRecord, content: e.target.value })}
                        placeholder="写点什么..."
                        autoFocus={!editingRecord.content && !editingRecord.originalImage}
                    />
                    
                    <button 
                        onClick={() => toggleInlineVoice('EDIT_CONTENT')}
                        className={`absolute bottom-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInlineListening && inlineTargetRef.current === 'EDIT_CONTENT' ? 'bg-green-500 text-black animate-pulse shadow-lg' : 'bg-neu-base shadow-neu-flat text-slate-400 active:shadow-neu-pressed'}`}
                    >
                        <Mic size={16} />
                    </button>

                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                        {/* Sparkle button: Now solely responsible for triggering analysis */}
                        <button 
                            onClick={() => handleAnalyze(editingRecord.content || '', editingRecord.originalImage || editingRecord.mediaMeta?.coverUrl, true)}
                            className="w-8 h-8 bg-neu-base text-neu-text rounded-full shadow-neu-flat active:shadow-neu-pressed flex items-center justify-center transition-all opacity-90 hover:text-green-600 hover:opacity-100"
                        >
                            <Sparkles size={16} />
                        </button>
                        
                        <button
                             onClick={triggerXylaAnalysis}
                             className="w-8 h-8 rounded-full bg-green-500 text-black flex items-center justify-center shadow-md transition-all active:scale-95 border border-green-400"
                         >
                             👽
                         </button>
                    </div>
                </div>

                <div className="mb-8 flex items-center justify-start gap-2 px-2">
                    <Clock size={14} className="text-slate-400" />
                    <div className="bg-neu-base shadow-neu-pressed-sm rounded-lg px-3 py-1.5">
                        <input 
                            type="datetime-local"
                            className="bg-transparent text-xs font-mono text-slate-500 focus:outline-none"
                            value={getLocalISOString(editingRecord.timestamp || Date.now())}
                            onChange={(e) => {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                    setEditingRecord({...editingRecord, timestamp: date.getTime()});
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="mb-10 border-b border-slate-100 pb-10">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 pl-1">
                      <Tag size={14}/> 关键词
                   </h4>
                   <div className="flex flex-wrap gap-3 mb-4">
                      {currentKw.map(kw => (
                         <button key={kw} onClick={() => toggleKeyword(kw)} className="px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-black shadow-neu-flat hover:bg-green-600 active:shadow-neu-pressed transition-all">
                            {kw}
                         </button>
                      ))}
                      {suggestionKw.map(kw => (
                         <button key={kw} onClick={() => toggleKeyword(kw)} className="px-4 py-2 rounded-full text-sm font-medium bg-neu-base text-slate-400 shadow-neu-flat active:shadow-neu-pressed transition-all hover:text-green-600">
                            {kw}
                         </button>
                      ))}
                      {historyKw.map(kw => (
                         <button key={kw} onClick={() => toggleKeyword(kw)} className="px-4 py-2 rounded-full text-sm font-medium bg-neu-base text-neu-text border border-black shadow-neu-flat active:shadow-neu-pressed transition-all hover:bg-slate-100">
                            {kw}
                         </button>
                      ))}
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="flex-1 h-10 bg-neu-base shadow-neu-pressed-sm rounded-full px-4 flex items-center">
                           <input 
                              className="bg-transparent border-none focus:outline-none text-xs w-full text-neu-text placeholder-slate-300"
                              placeholder="添加自定义关键词..."
                              value={keywordInput}
                              onChange={e => setKeywordInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                           />
                       </div>
                       <button onClick={handleAddKeyword} className="w-10 h-10 rounded-full bg-neu-base shadow-neu-flat text-green-600 flex items-center justify-center active:shadow-neu-pressed transition-all">
                           <Plus size={18} />
                       </button>
                   </div>
                </div>
            
                <div className="mt-4">
                     <div className="flex items-center gap-2 mb-6 px-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">与 Xyla 探讨</h4>
                     </div>

                     <div className="space-y-6 pb-24">
                         {chatMessages.map((msg, i) => {
                             const prevMsg = chatMessages[i - 1];
                             const showDivider = !prevMsg || (msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000);

                             return (
                                <React.Fragment key={i}>
                                    {showDivider && (
                                        <div className="flex items-center gap-4 py-4">
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                            <span className="text-[10px] text-slate-300 font-medium">{formatDividerTime(msg.timestamp)}</span>
                                            <div className="h-px flex-1 bg-slate-100"></div>
                                        </div>
                                    )}
                                     <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                         <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                             {msg.role === 'model' && (
                                                 <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-black text-lg shadow-neu-flat shrink-0 border-2 border-white">
                                                     👽
                                                 </div>
                                             )}
                                             <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-neu-flat font-medium ${
                                                 msg.role === 'user' 
                                                 ? 'bg-black text-green-400 rounded-tr-none' 
                                                 : 'bg-green-500 text-black rounded-tl-none'
                                             }`}>
                                                 {msg.text}
                                             </div>
                                         </div>
                                     </div>
                                </React.Fragment>
                             );
                         })}
                         {isChatLoading && (
                             <div className="flex justify-start">
                                 <div className="flex gap-3">
                                     <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-black text-lg shadow-neu-flat shrink-0 animate-bounce">
                                         👽
                                     </div>
                                     <div className="p-4 rounded-2xl bg-neu-base rounded-tl-none shadow-neu-flat flex items-center gap-1">
                                         <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></span>
                                         <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce delay-100"></span>
                                         <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce delay-200"></span>
                                     </div>
                                 </div>
                             </div>
                         )}
                         <div ref={chatEndRef} />
                     </div>
                 </div>
            </div>
         </div>

         <div className="p-4 bg-neu-base shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-50 absolute bottom-0 left-0 right-0">
             <div className="flex items-center gap-2 bg-neu-base shadow-neu-pressed rounded-full px-2 py-2">
                 <input 
                     className="flex-1 bg-transparent border-none focus:outline-none px-4 text-sm text-neu-text placeholder-slate-400"
                     placeholder="问问 Xyla..."
                     value={chatInput}
                     onChange={e => setChatInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                 />
                 <button 
                    onClick={() => toggleInlineVoice('CHAT_INPUT')}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 ${isInlineListening && inlineTargetRef.current === 'CHAT_INPUT' ? 'bg-green-500 text-black animate-pulse' : 'bg-neu-base text-slate-400 hover:text-green-600'}`}
                 >
                     <Mic size={18} />
                 </button>
                 <button 
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="w-10 h-10 rounded-full bg-black text-green-400 flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 hover:bg-slate-900"
                 >
                     <Send size={18} />
                 </button>
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen max-w-md mx-auto bg-neu-base relative overflow-hidden flex flex-col shadow-2xl sm:rounded-3xl sm:my-10 sm:border sm:border-slate-100">
      {renderSidebar()}
      {/* Listening Overlay is always mounted but hidden by checks/opacity inside */}
      {renderListeningOverlay()} 
      
      {view === 'HOME' && (
        <>
          {renderTopBar()}
          {renderHome()}
          {renderBottomBar()}
        </>
      )}
      {view === 'LIST' && (
        <>
          {renderTopBar()}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24 animate-fade-in">
             {homeMode === 'CALENDAR' ? (
                <CalendarView 
                    records={filteredRecords} 
                    onSelectRecord={(r) => { 
                        setEditingRecord(r); 
                        setChatMessages(r.chatHistory || []);
                        setSuggestedKeywords([]); 
                        setView('EDIT_RECORD'); 
                    }} 
                />
             ) : (
                <ListView 
                    records={filteredRecords} 
                    mode={homeMode as 'LIST' | 'WATERFALL'} 
                    onSelectRecord={(r) => { 
                        setEditingRecord(r); 
                        setChatMessages(r.chatHistory || []);
                        setSuggestedKeywords([]); 
                        setView('EDIT_RECORD'); 
                    }}
                />
             )}
          </div>
          {renderBottomBar()}
        </>
      )}

      {view === 'SEARCH' && (
         <>
             {renderTopBar()}
             <div className="flex-1 overflow-y-auto px-6 py-4">
                 <input 
                    autoFocus
                    className="w-full bg-gray-100 rounded-xl px-4 py-3 mb-6 focus:outline-none"
                    placeholder="搜索记忆..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                 />
                 <ListView 
                    records={filteredRecords} 
                    mode="LIST"
                    onSelectRecord={(r) => {
                        setEditingRecord(r);
                        setChatMessages(r.chatHistory || []);
                        setSuggestedKeywords([]);
                        setView('EDIT_RECORD');
                    }}
                 />
             </div>
             {renderBottomBar()}
         </>
      )}

      {view === 'EDIT_RECORD' && renderEditRecord()}

    </div>
  );
}
