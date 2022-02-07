import React, { useState, useEffect } from 'react';
import * as d3 from 'd3';

export const useD3 = (renderFn, deps) => {
    const ref = React.useRef();
    const [rect, setRect] = useState(null);

    function handleResize() {
        if (!ref.current) {
            return;
        }
        const newRect = ref.current.getBoundingClientRect();
        if (newRect.height === rect?.height && newRect.width === rect?.width) {
            return;
        }
        setRect(newRect);
    }

    // Run the handleResize on load, and then run it whenever the window is resized.
    // The resizeTimeout is used to prevent the handleResize from being called too often.
    useEffect(() => handleResize(), []);
    var resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100);
    });

    deps.push(rect)

    React.useEffect(() => {
        if (rect) {
            renderFn({ svg: d3.select(ref.current), rect: rect });
        }
        return () => { };
    }, deps);
    return ref;
}