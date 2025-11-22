import React, { useState } from 'react';
import { RecordData, RecordType } from '../types';
import { ChevronLeft, ChevronRight, BookOpen, Film, Music, FileText } from 'lucide-react';

interface Props {
  records: RecordData[];
  onSelectRecord: (record: RecordData) => void;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

export const CalendarView: React.FC<Props> = ({ records, onSelectRecord }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group records by day
  const recordsByDay: { [key: number]: RecordData[] } = {};
  records.forEach(r => {
    const d = new Date(r.timestamp);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!recordsByDay[day]) recordsByDay[day] = [];
      recordsByDay[day].push(r);
    }
  });

  const renderTypeDot = (type: RecordType) => {
    switch (type) {
      case RecordType.NOTE: return 'bg-black'; // Simple Black for notes
      default: return 'bg-green-500'; // Alien Green for all media
    }
  };

  const renderIcon = (type: RecordType, className: string) => {
    switch (type) {
      case RecordType.NOTE: return <FileText className={className} />;
      case RecordType.BOOK: return <BookOpen className={className} />;
      case RecordType.MOVIE: return <Film className={className} />;
      case RecordType.MUSIC: return <Music className={className} />;
    }
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  const renderCalendarGrid = () => {
    const cells = [];
    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-24 bg-transparent"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayRecords = recordsByDay[d] || [];
      const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;

      cells.push(
        <div key={d} className={`h-24 rounded-xl p-1 relative overflow-hidden flex flex-col transition-all ${isToday ? 'shadow-neu-pressed-sm' : 'shadow-neu-flat-sm bg-neu-base'}`}>
          <span className={`text-xs font-bold mb-1 ml-1 ${isToday ? 'text-green-600' : 'text-neu-text/60'}`}>{d}</span>
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1.5 px-0.5">
            {dayRecords.map(r => (
              <button 
                key={r.id}
                onClick={() => onSelectRecord(r)}
                className="flex items-center gap-1.5 text-left w-full p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${renderTypeDot(r.type)} shadow-sm`}></div>
                <span className="text-[9px] truncate text-slate-600 font-medium leading-tight">
                   {r.type === RecordType.NOTE ? r.topic : r.mediaMeta?.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  // List view for detailed browsing below calendar
  const currentMonthRecords = records.filter(r => {
     const d = new Date(r.timestamp);
     return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="w-full max-w-md mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 mt-2">
        <button onClick={handlePrevMonth} className="w-10 h-10 rounded-full flex items-center justify-center bg-neu-base shadow-neu-flat-sm active:shadow-neu-pressed-sm text-neu-text transition-all hover:text-green-600">
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <h2 className="text-lg font-bold text-neu-text tracking-wide">
          {year}年 {month + 1}月
        </h2>
        <button onClick={handleNextMonth} className="w-10 h-10 rounded-full flex items-center justify-center bg-neu-base shadow-neu-flat-sm active:shadow-neu-pressed-sm text-neu-text transition-all hover:text-green-600">
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2 mb-8">
        {['日','一','二','三','四','五','六'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-slate-400 mb-2">{day}</div>
        ))}
        {renderCalendarGrid()}
      </div>

      {/* List Summary */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">📅 本月精选</h3>
        {currentMonthRecords.length === 0 ? (
            <p className="text-slate-400 text-sm italic text-center py-6">本月静悄悄的...</p>
        ) : (
            currentMonthRecords.map(r => (
                <div key={r.id} onClick={() => onSelectRecord(r)} className="bg-neu-base rounded-2xl p-4 shadow-neu-flat cursor-pointer active:shadow-neu-pressed transition-all flex items-start gap-4 group">
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-neu-pressed-sm ${
                        r.type === RecordType.NOTE ? 'text-black' : 'text-green-500'
                    }`}>
                        {renderIcon(r.type, "w-5 h-5 opacity-80")}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                             <h4 className="font-bold text-neu-text truncate group-hover:text-green-600 transition-colors">
                                {r.type === RecordType.NOTE ? r.topic : r.mediaMeta?.title}
                             </h4>
                             <span className="text-[10px] text-slate-400 mt-1 font-mono">{formatDateTime(r.timestamp)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{r.content || '(无文字内容)'}</p>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};