import { useState, useRef, useLayoutEffect } from 'react';
import * as d3 from 'd3';

export default function useD3() {
    const ref = useRef();
    const [svg, setSvg] = useState(null);

    useLayoutEffect(() => {
        setSvg(d3.select(ref.current));
    }, [ref]);

    return { ref, svg };
}