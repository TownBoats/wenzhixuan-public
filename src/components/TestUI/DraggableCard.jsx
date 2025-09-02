// DraggableCard.jsx

import React, { useState, useRef, useEffect } from "react";

const DraggableCard = () => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    // 如果不想限制拖拽区域，可以注释掉这一行判断
    // if (e.target.closest('.card-content') || e.target.closest('.collapse-button')) return;

    e.preventDefault(); // 避免文本选中
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // 清理
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 300,
        background: "#fafafa",
        border: "1px solid #ccc",
        borderRadius: 8,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      {/* 标题栏(当作拖拽把手) */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #ddd",
          background: "#eee",
        }}
        onMouseDown={handleMouseDown}
      >
        标题栏 - 抓住这里拖拽
      </div>

      {/* 内容区 */}
      <div style={{ padding: 12 }}>
        卡片内容...
      </div>
    </div>
  );
};

export default DraggableCard;