"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface CustomScrollbarProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string | number;
  height?: string | number;
}

export function CustomScrollbar({
  children,
  className = "",
  maxHeight,
  height,
}: CustomScrollbarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [scrollStartY, setScrollStartY] = useState(0);
  const [showThumb, setShowThumb] = useState(false);

  // Update thumb size and position
  const updateThumb = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const { clientHeight, scrollHeight, scrollTop } = scrollEl;

    // Only show scrollbar if content is actually scrollable
    if (scrollHeight <= clientHeight) {
      setThumbHeight(0);
      setShowThumb(false);
      return;
    }

    const trackHeight = clientHeight - 8;
    const newThumbHeight = Math.max(
      (trackHeight / scrollHeight) * trackHeight,
      24 // Minimum thumb height
    );
    const scrollableHeight = scrollHeight - clientHeight;
    const thumbScrollableHeight = trackHeight - newThumbHeight;
    const newThumbTop = (scrollTop / scrollableHeight) * thumbScrollableHeight;

    setThumbHeight(newThumbHeight);
    setThumbTop(newThumbTop);
    setShowThumb(true);
  }, []);

  // Handle scroll events
  const handleScroll = () => {
    updateThumb();
  };

  // Re-run update on element size change
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    updateThumb();

    // Use ResizeObserver to detect resize of content inside
    const observer = new ResizeObserver(() => {
      updateThumb();
    });

    observer.observe(scrollEl);
    if (scrollEl.firstElementChild) {
      observer.observe(scrollEl.firstElementChild);
    }

    return () => {
      observer.disconnect();
    };
  }, [updateThumb, children]);

  // Handle drag of the scroll thumb
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragStartY(e.clientY);
    if (scrollRef.current) {
      setScrollStartY(scrollRef.current.scrollTop);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;

      const scrollEl = scrollRef.current;
      const { clientHeight, scrollHeight } = scrollEl;
      
      const deltaY = e.clientY - dragStartY;
      const scrollableHeight = scrollHeight - clientHeight;
      const trackHeight = clientHeight - 8;
      const thumbScrollableHeight = trackHeight - thumbHeight;

      // Calculate how much we should scroll
      const scrollDelta = (deltaY / thumbScrollableHeight) * scrollableHeight;
      scrollEl.scrollTop = scrollStartY + scrollDelta;
    },
    [isDragging, dragStartY, scrollStartY, thumbHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none"; // Disable text selection during drag
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`custom-scrollbar-container ${className}`}
      style={{
        position: "relative",
        overflow: "hidden",
        height: height ?? "100%",
        maxHeight: maxHeight ?? "none",
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <div
        ref={scrollRef}
        className="custom-scrollbar-viewport"
        onScroll={handleScroll}
        style={{
          width: "100%",
          height: "100%",
          overflowY: "scroll",
          overflowX: "hidden",
          scrollbarWidth: "none", // Firefox
          msOverflowStyle: "none", // IE 10+
          paddingRight: "8px", // Space for custom scrollbar
        }}
      >
        {children}
      </div>

      {showThumb && (
        <div
          className="custom-scrollbar-track"
          style={{
            position: "absolute",
            top: "4px",
            right: "1px",
            bottom: "4px",
            width: "5px",
            pointerEvents: "auto",
            zIndex: 10,
          }}
        >
          <div
            ref={thumbRef}
            className="custom-scrollbar-thumb"
            onMouseDown={handleThumbMouseDown}
            style={{
              position: "absolute",
              top: `${thumbTop}px`,
              right: 0,
              width: "5px",
              height: `${thumbHeight}px`,
              cursor: "pointer",
              transition: isDragging ? "none" : "top 0.1s ease, height 0.1s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
