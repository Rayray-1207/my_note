
import React from 'react';
import { RecordData, RecordType } from '../types';
import { FileText, BookOpen, Film, Music } from 'lucide-react';

interface Props {
  records: RecordData[];
  mode: 'LIST' | 'WATERFALL';
  onSelectRecord: (record: RecordData) => void;
}

export const ListView: React.FC<Props> = ({ records, mode, onSelectRecord }) => {
  
  const renderIcon = (type: RecordType, className: string) => {
    switch (type) {
      case RecordType.NOTE: return <FileText className={className} />;
      case RecordType.BOOK: return <BookOpen className={className} />;
      case RecordType.MOVIE: return <Film className={className} />;
      case RecordType.MUSIC: return <Music className={className} />;
    }
  };

  const formatTimeShort = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const Card: React.FC<{ record: RecordData; isWaterfall?: boolean }> = ({ record, isWaterfall }) => {
    const isMedia = record.type !== RecordType.NOTE;
    const imageSrc = record.mediaMeta?.coverUrl || record.originalImage;
    const title = isMedia ? record.mediaMeta?.title : record.topic;

    return (
      <div 
        onClick={() => onSelectRecord(record)}
        className={`bg-neu-base rounded-2xl p-4 shadow-neu-flat active:shadow-neu-pressed transition-all cursor-pointer group break-inside-avoid mb-4 flex flex-col gap-3 ${isWaterfall ? 'w-full' : 'flex-row items-start'}`}
      >
        {/* Image Section */}
        {imageSrc && (
           <div className={`rounded-xl overflow-hidden shrink-0 bg-slate-100 ${isWaterfall ? 'w-full aspect-auto mb-2' : 'w-20 h-20'}`}>
             <img src={imageSrc} alt="cover" className="w-full h-full object-cover" />
           </div>
        )}
        
        {/* Text Content */}
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2 mb-1">
                <h3 className={`font-bold text-neu-text leading-snug group-hover:text-green-600 transition-colors ${isWaterfall ? 'text-sm' : 'text-base'}`}>
                    {title}
                </h3>
                {!isWaterfall && (
                     <span className="text-[10px] text-slate-400 font-mono shrink-0 mt-1">
                        {formatTimeShort(record.timestamp)}
                     </span>
                )}
            </div>
            
            {isWaterfall && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isMedia ? 'bg-green-500' : 'bg-black'}`}></div>
                    {formatTimeShort(record.timestamp)}
                </div>
            )}

            <p className={`text-xs text-slate-500 leading-relaxed ${isWaterfall ? 'line-clamp-4' : 'line-clamp-2'}`}>
                {record.content || (imageSrc ? '[图片记录]' : '[无内容]')}
            </p>
            
            {!isWaterfall && record.keywords.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                    {record.keywords.slice(0, 3).map(k => (
                        <span key={k} className="px-2 py-1 rounded-md bg-slate-100 text-[10px] text-slate-500">#{k}</span>
                    ))}
                </div>
            )}
        </div>

        {/* Icon Badge for List View if no image */}
        {!isWaterfall && !imageSrc && (
             <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-neu-pressed-sm ${
                isMedia ? 'text-green-500' : 'text-slate-700'
             }`}>
                {renderIcon(record.type, "w-5 h-5 opacity-80")}
            </div>
        )}
      </div>
    );
  };

  if (mode === 'LIST') {
    return (
      <div className="px-4 py-4 flex flex-col gap-1">
        {records.map(r => <Card key={r.id} record={r} />)}
        {records.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">暂无记录</div>}
      </div>
    );
  }

  // Waterfall / Masonry Layout (Simple 2-column split)
  const leftColumn = records.filter((_, i) => i % 2 === 0);
  const rightColumn = records.filter((_, i) => i % 2 !== 0);

  return (
    <div className="px-4 py-4 flex gap-4 items-start">
        <div className="flex-1 flex flex-col w-0"> {/* w-0 helps flex children handle content properly */}
            {leftColumn.map(r => <Card key={r.id} record={r} isWaterfall={true} />)}
        </div>
        <div className="flex-1 flex flex-col w-0">
            {rightColumn.map(r => <Card key={r.id} record={r} isWaterfall={true} />)}
        </div>
        {records.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">暂无记录</div>}
    </div>
  );
};
