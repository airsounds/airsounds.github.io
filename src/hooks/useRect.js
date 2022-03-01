import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

function rateLimit(fn, ms) {
    let timer
    return () => {
        clearTimeout(timer)
        timer = setTimeout(_ => {
            timer = null
            fn.apply(this, arguments)
        }, ms)
    };
}

export default function useRect(ref) {
    const [rect, setRect] = useState(null);

    const handleResize = useCallback(
        () => {
            if (!ref.current) {
                return;
            }
            const newRect = ref.current.getBoundingClientRect();;
            if (newRect.height === rect?.height && newRect.width === rect?.width) {
                return; // Avoid re-rendering if the size hasn't changed.
            }
            setRect(newRect);
        }, [ref, rect]);

    // Initial resize.
    useLayoutEffect(() => {
        handleResize()
    }, [handleResize]);

    // Run the handleResize on load, and then run it whenever the window is resized.
    // The resizeTimeout is used to prevent the handleResize from being called too often.
    useEffect(() => {
        const handleResizeRatelimited = rateLimit(handleResize, 100);
        window.addEventListener('resize', handleResizeRatelimited);
        return () => window.removeEventListener('resize', handleResizeRatelimited);
    }, [handleResize]);

    return { rect };
}