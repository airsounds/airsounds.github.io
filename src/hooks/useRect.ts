import { useState, useEffect, useLayoutEffect, useCallback, MutableRefObject } from 'react';

interface rect {
    height: number;
    width: number;
}

export default function useRect(ref: MutableRefObject<SVGSVGElement | undefined>) {
    const [rect, setRect] = useState<rect | null>(null);

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
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    return { rect };
}