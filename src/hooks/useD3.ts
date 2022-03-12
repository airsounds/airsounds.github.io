import { useState, useRef, useLayoutEffect } from 'react';
import * as d3 from 'd3';

export default function useD3() {
    const ref = useRef<SVGSVGElement>();
    const [svg, setSvg] = useState<d3.Selection<any, any, any, any> | null>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            setSvg(d3.select(ref.current));
        }
    }, [ref]);

    return { ref, svg };
}