import React, { useEffect, LegacyRef } from 'react';
import useD3 from './hooks/useD3';
import * as d3 from 'd3';
import * as draw from './draw';
import { altMax, tempMax, windMax, xTick, yTick, y, colors } from './utils';
import { Hour, Errorf } from './data';
import { CalcHourData, HourlyData } from './calc'
import "./App.css"
import useRect from './hooks/useRect';

interface Props {
    data: {
        [key: Hour]: CalcHourData;
    };
    time: Date;
    setError: Errorf;
}

export default function Sounding({ data, time, setError }: Props) {
    const { ref, svg } = useD3();
    const { rect } = useRect(ref);

    useEffect(() => {
        if (!data || !time || !rect || !svg) {
            return;
        }

        svg.selectAll('*').remove();

        // Manipulate data.
        const dateTimeData = data[time.getHours()]
        if (!dateTimeData) {
            return
        }
        const virtual = dateTimeData.virtual
        const measured = dateTimeData.measured;

        const defaultData = virtual || measured;
        if (!defaultData) {
            setError({ name: 'No data', message: 'for chosen time' });
            return;
        }

        const maxAspectRatio = 1.5; // height / width.
        const height = rect.height;
        const width = Math.min(Math.round(height / maxAspectRatio), rect.width)
        const margin = { top: 30, right: 30, bottom: 40, left: 40 };
        if (width < rect.width) {
            margin.left += (rect.width - width) / 2;
        }
        const widthWind = width / 3;

        // Plot area coordinates.
        const altPlotAreaY = [height - margin.bottom - margin.top, margin.top];
        const tempPlotAreaX = [margin.left, margin.left + width - margin.right];
        const windPlotAreaX = [margin.left, margin.left + widthWind];

        const altRange = [0, altMax];
        const tempRange = [0, tempMax];
        const windRange = [0, windMax];

        // Scales.
        const altScale = d3
            .scaleLinear()
            .domain(altRange)
            .nice()
            .range(altPlotAreaY);
        const tempScale = d3
            .scaleLinear()
            .domain(tempRange)
            .nice()
            .range(tempPlotAreaX);
        const windScale = d3
            .scaleLinear()
            .domain(windRange)
            .nice()
            .range(windPlotAreaX);

        interface Params {
            [key: string]: any;
            // color: string;
            // width: number;
            // duration: number;
            // dashed: boolean;
            // arrowSize: number;
            // xScale: (x: number) => number;
            // yScale: (y: number) => number;
        }
        function initParams(p: Params | null, defaults: Params) {
            if (!p) {
                p = {} as Params;
            }
            const keys = Object.keys(defaults)
            for (let i in keys) {
                const key = keys[i];
                if (!p[key]) {
                    p[key] = defaults[key];
                }
            }
            return p;
        }



        function drawLine(svg: d3.Selection<any, any, any, any>, x: number[], y: number[], params: Params) {
            params = initParams(params, {
                color: 'black',
                width: 1,
                duration: 0,
                dashed: false,
                arrowSize: 0,
                xScale: tempScale,
                yScale: altScale,
            })
            const points = new Array<[number, number]>();
            for (let i in x) {
                points.push([params.xScale(x[i]), params.yScale(y[i])]);
            }

            const line = d3.line()
                .curve(d3.curveLinear)
                .x(d => d[0])
                .y(d => d[1]);

            function length(path: any): number {
                return (d3.create('svg:path').attr('d', path).node() as any).getTotalLength();
            }

            const l = length(line(points));
            const dash = (params.dashed) ? '10' : `${l},${l}`;

            if (params.arrowSize > 0) {
                const size = params.arrowSize;
                svg.append('marker')
                    .attr('id', 'arrow')
                    .attr('viewBox', [0, 0, size, size])
                    .attr('refX', size / 2)
                    .attr('refY', size / 2)
                    .attr('markerWidth', size / 2)
                    .attr('markerHeight', size / 2)
                    .attr('orient', 'auto-start-reverse')
                    .append('path')
                    .attr('d', d3.line()([[0, 0], [0, size], [size, size / 2]]))
                    .attr('stroke', params.color)
                    .attr('fill', params.color);
            }

            const path = svg.append('path')
                .datum(points)
                .attr('fill', 'none')
                .attr('stroke', params.color)
                .attr('stroke-width', params.width)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
                .attr('stroke-dasharray', `0,${l}`)
                .attr('d', line)
                .transition()
                .duration(params.duration)
                .ease(d3.easeLinear)
                .attr('stroke-dasharray', dash)
                .attr('clip-path', 'url(#clipPlotArea)');
            if (params.arrowSize > 0) {
                path.attr('marker-end', 'url(#arrow)')
            }
        }

        function drawPoint(svg: d3.Selection<any, any, any, any>, x: number, y: number, color: string) {
            const point = [{ x: tempScale(x), y: altScale(y) }]
            svg.append('g')
                .attr('fill', 'white')
                .attr('stroke', color)
                .attr('stroke-width', 2)
                .selectAll('circle')
                .data(point)
                .join('circle')
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 3);
        }

        function drawText(svg: d3.Selection<any, any, any, any>, x: number, y: number, text: string, params: Params) {
            params = initParams(params, {
                xScale: tempScale,
                size: 10,
                color: 'black',
                valign: 'middle', // top/bottom/middle.
                halign: 'middle', // start/middle/end.
            })

            const point = [{ x: params.xScale(x), y: altScale(y) }]
            const label = svg.append('g')
            label
                .attr('font-family', 'sans-serif')
                .attr('font-size', params.size)
                .attr('font-color', params.color)
                .selectAll('g')
                .data(point)
                .join('g')
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .attr('opacity', 1)
                .append('text')
                .text(text)
                .attr('text-anchor', params.halign)
                .each(function (d) {
                    const t = d3.select(this);
                    switch (params.valign) {
                        case 'top': t.attr('dy', '1.2em'); break;
                        case 'bottom': t.attr('dy', '-0.7em'); break;
                        default: break;
                    }
                });
        }
        function drawPolygon(svg: d3.Selection<any, any, any, any>, points: [number, number][], color: string, width: number) {
            const d = []
            for (let i in points) {
                d.push([tempScale(points[i][0]), altScale(points[i][1])])
            }
            svg.append('polygon')
                .datum(d)
                .attr('points', pts => pts.map(p => p.join(',')).join(' '))
                .attr('fill', color)
                .attr('opacity', 0.3)
                .attr('stroke', color)
                .attr('stroke-width', width)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
        }

        // Start drawing!

        svg.append('clipPath')
            .attr('id', 'clipPlotArea')
            .append('rect')
            .attr('x', tempPlotAreaX[0])
            .attr('y', altPlotAreaY[1])
            .attr('width', tempPlotAreaX[1] - tempPlotAreaX[0])
            .attr('height', altPlotAreaY[0] - altPlotAreaY[1]);


        // Draw diagonal ticks.
        for (let x0 = tempRange[1]; x0 > tempRange[0]; x0 -= xTick) {
            drawLine(
                svg,
                [tempRange[0], x0],
                [y(tempRange[0], x0, altRange[0]), altRange[0]],
                { color: '#ebecf0' });
        }
        // Draw ground.
        drawPolygon(
            svg,
            [
                [tempRange[0], altRange[0]],
                [tempRange[1], altRange[0]],
                [tempRange[1], defaultData.h0],
                [tempRange[0], defaultData.h0],
            ],
            colors.ground, 1.5)
        drawText(svg, tempRange[1], defaultData.h0, `Ground: ${defaultData.h0} ft`,
            { valign: 'top', halign: 'start' })

        function drawSounding(
            svg: d3.Selection<any, any, any, any>,
            name: string,
            data: HourlyData /* virtual or measured */,
            tiColor: string,
            dashed: boolean) {
            // Draw temperature graphs.
            drawLine(svg, data.temp, data.alt,
                { color: 'red', width: 2, dashed: dashed });
            drawLine(svg, data.dew, data.alt,
                { color: 'blue', width: 1, dashed: dashed });

            // Thermal indices.
            drawPolygon(
                svg,
                [
                    [tempRange[0], data.TI],
                    [tempRange[1], data.TI],
                    [tempRange[1], data.TIM3],
                    [tempRange[0], data.TIM3]
                ],
                tiColor, 0
            );
            if (data.TI !== data.h0) {
                drawText(svg, tempRange[1], data.TI, `TI ${name}: ` + data.TI.toFixed(0) + 'ft',
                    { halign: 'start' })
            }
            if (data.TIM3 !== data.h0) {
                drawText(svg, tempRange[1], data.TIM3, `TI-3 ${name}: ` + data.TIM3.toFixed(0) + 'ft',
                    { halign: 'start' })
            }

            // Draw cloud base.
            if (data.CB) {
                const vCBY = Math.min(data.CB, altRange[1]);
                if (data.CB <= altRange[1]) {
                    drawLine(
                        svg, tempRange, [vCBY, vCBY],
                        { color: colors.CB, dashed: dashed })
                }
                drawText(svg, tempRange[1], vCBY, `CB ${name}: ` + data.CB.toFixed(0) + 'ft',
                    { halign: 'start' })
            }

            // Draw wind
            drawLine(svg, data.windSpeed, data.alt,
                { color: '#444444', xScale: windScale, dashed: dashed })
            for (let i in data.windSpeed) {
                const arrowDir = data.windDir[i] + 180; // Make the arrow point from the direction of the wind.
                draw.arrow(
                    svg,
                    `wind-${i}`,
                    windScale(data.windSpeed[i]), altScale(data.alt[i]),
                    arrowDir,
                    10, '#444444')
            }
        }

        if (virtual) {
            drawSounding(svg, '(V)', virtual, colors.virtTI, false);
        }
        if (measured) {
            drawSounding(svg, '(M)', measured, colors.measuredTI, true);
        }

        // Max temperature diagonals.
        drawPolygon(
            svg,
            [
                [defaultData.t0, defaultData.h0],
                [defaultData.t0 - 3, defaultData.h0],
                [tempRange[0], y(tempRange[0], defaultData.t0 - 3, defaultData.h0)],
                [tempRange[0], y(tempRange[0], defaultData.t0, defaultData.h0)],

            ],
            colors.tempDiagonal, 0
        );
        drawPoint(svg, defaultData.t0, defaultData.h0, 'red');
        drawText(svg, defaultData.t0, defaultData.h0, 'T0: ' + defaultData.t0 + 'ºC',
            { valign: 'top' })

        if (defaultData.trig) {
            const color = (defaultData.isTriggered) ? colors.good : colors.bad;
            drawLine(svg, [defaultData.t0, defaultData.trig], [defaultData.h0, defaultData.h0],
                { color: color, duration: 2500, arrowSize: 14 })
            drawText(svg, defaultData.trig, defaultData.h0, 'Trigger: ' + defaultData.trig.toFixed(1) + 'ºC',
                { valign: 'top' })
        }


        // Draw axes.
        const altTicks = (altRange[1] - altRange[0]) / yTick;
        const tempTicks = (tempRange[1] - tempRange[0]) / xTick;
        const windTicks = 5;

        // Alt axis.
        svg.append('g').call(g => g
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(altScale).ticks(altTicks, 's'))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').clone()
                .attr('x2', width - margin.right)
                .attr('stroke-opacity', 0.2))
            // Add axis label.
            .call(g => g.select('.tick:last-of-type text').clone()
                .attr('x', -5)
                .attr('y', -20)
                .attr('text-anchor', 'start')
                .attr('font-weight', 'bold')
                .attr('fill', 'black')
                .text('H[ft]'))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'end')
                .attr('x', -28)));

        // Temp axis.
        svg.append('g').call(g => g
            .attr('transform', `translate(0,${height - margin.bottom - 20})`)
            .call(d3.axisBottom(tempScale).ticks(tempTicks))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').clone()
                .attr('y2', -height)
                .attr('stroke-opacity', 0.2))
            // Add axis label.
            .call(g => g.append('text')
                .attr('x', tempPlotAreaX[1] + 12)
                .attr('y', 15)
                .attr('font-weight', 'bold')
                .attr('text-anchor', 'end')
                .attr('fill', 'black')
                .text('T[c]')));

        // Wind axis.
        svg.append('g').call(g => g
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(windScale).ticks(windTicks))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').clone()
                .attr('y2', -height)
                .attr('stroke-opacity', 0.1))
            // Add axis label.
            .call(g => g.append('text')
                .attr('x', windPlotAreaX[1] + 10)
                .attr('y', 16)
                .attr('font-weight', 'bold')
                .attr('text-anchor', 'end')
                .attr('fill', 'black')
                .text('Wind [kn]')));


    }, [svg, rect, data, time, setError]);

    return (
        <svg ref={ref as LegacyRef<SVGSVGElement>} className='Sounding' >
        </svg>
    );
}