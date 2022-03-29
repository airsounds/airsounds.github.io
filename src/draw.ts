import * as d3 from 'd3';

export function arrow(svg: d3.Selection<any, any, any, any>, id: string, x: number, y: number, dir: number, size: number, color: string) {
    svg.append('marker')
        .attr('id', id)
        .attr('viewBox', [0, 0, size, size])
        .attr('refX', size / 2)
        .attr('refY', size / 2)
        .attr('markerWidth', size / 2)
        .attr('markerHeight', size / 2)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', d3.line()([[0, 0], [0, size], [size, size / 2]]))
        .attr('stroke', color)
        .attr('fill', color);

    svg
        .append('path')
        .datum([
            [x, y + size / 2],
            [x, y - size / 2],
        ])
        .attr('transform', `rotate(${dir}, ${x}, ${y})`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1)
        .attr('marker-end', `url(#${id})`)
        .attr('d', d3.line());
}