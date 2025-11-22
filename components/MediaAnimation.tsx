import React, { useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export const MediaAnimation: React.FC<Props> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate random stars/confetti
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    delay: Math.random() * 0.5 + 's',
    color: ['#60A5FA', '#F87171', '#FACC15', '#4ADE80'][Math.floor(Math.random() * 4)]
  }));

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-neu-base/50 backdrop-blur-[2px]">
      {/* Fireworks/Stars Container */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map(p => (
           <div 
             key={p.id}
             className="absolute w-2 h-2 rounded-full animate-ping opacity-75 shadow-sm"
             style={{
               left: p.left,
               top: p.top,
               backgroundColor: p.color,
               animationDuration: '1s',
               animationDelay: p.delay
             }}
           />
        ))}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
         <div className="text-6xl animate-bounce-soft drop-shadow-lg filter">✨</div>
      </div>
    </div>
  );
};