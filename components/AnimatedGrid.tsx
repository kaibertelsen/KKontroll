import React, { useState, useLayoutEffect, useEffect, useRef } from 'react';

interface AnimatedGridProps {
  children: React.ReactNode[];
  className?: string;
}

const AnimatedGrid: React.FC<AnimatedGridProps> = ({ children, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boundingBoxes, setBoundingBoxes] = useState<{ [key: string]: DOMRect }>({});
  const [prevChildren, setPrevChildren] = useState<React.ReactNode[]>(children);

  useLayoutEffect(() => {
    // 1. Calculate new positions after render
    const newBoundingBoxes: { [key: string]: DOMRect } = {};
    if (containerRef.current) {
      Array.from(containerRef.current.children).forEach((child) => {
        const element = child as HTMLElement;
        const key = element.dataset.key;
        if (key) {
          newBoundingBoxes[key] = element.getBoundingClientRect();
        }
      });
    }

    // 2. Animate from old position to new position
    if (containerRef.current) {
      Array.from(containerRef.current.children).forEach((child) => {
        const element = child as HTMLElement;
        const key = element.dataset.key;

        if (key && boundingBoxes[key] && newBoundingBoxes[key]) {
          const prevBox = boundingBoxes[key];
          const newBox = newBoundingBoxes[key];

          const changeX = prevBox.left - newBox.left;
          const changeY = prevBox.top - newBox.top;

          if (changeX !== 0 || changeY !== 0) {
            // Invert
            element.style.transform = `translate(${changeX}px, ${changeY}px)`;
            element.style.transition = 'transform 0s';

            // Play
            requestAnimationFrame(() => {
              element.style.transform = '';
              element.style.transition = 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)'; // Easy-in-out
            });
          }
        }
      });
    }

    // Update state for next render
    setBoundingBoxes(newBoundingBoxes);
  }, [children]); // Run when children (order/content) changes

  // Keep track of children to detect changes
  useEffect(() => {
      setPrevChildren(children);
  }, [children]);

  return (
    <div ref={containerRef} className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // @ts-ignore - We know key exists on these elements
          return React.cloneElement(child, { 'data-key': child.key } as any);
        }
        return child;
      })}
    </div>
  );
};

export default AnimatedGrid;