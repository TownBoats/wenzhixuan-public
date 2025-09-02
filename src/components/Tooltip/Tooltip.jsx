import React, { useState } from 'react';

const Tooltip = ({ 
  children, 
  content
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10
    });
    setIsVisible(true);
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className="fixed z-50 transform -translate-x-1/2"
          style={{ 
            left: position.x,
            top: position.y
          }}
        >
          <div className="px-2 py-1 text-sm rounded-lg shadow-lg whitespace-nowrap bg-white border border-slate-200 text-slate-600">
            {content}
          </div>
          <div className="w-2 h-2 rotate-45 absolute -top-1 left-1/2 -translate-x-1/2 bg-white border-l border-t border-slate-200" />
        </div>
      )}
    </div>
  );
};

export default Tooltip; 