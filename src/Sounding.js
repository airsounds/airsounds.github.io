import React from 'react';
import useD3 from './hooks/useD3';
import * as d3 from 'd3';
import { altMax, tempMax, windMax, dateFormat, hourFormat, xTick, yTick, y, colors } from './utils';

export default function Sounding({ data, time, setError }) {
    const ref = useD3(({ svg, rect }) => {
        if (!data || !time) {
            return;
        }

        // Manipulate data.
        const dateTimeData = data[dateFormat(time)].hours[hourFormat(time)]
        const virtual = dateTimeData.virtual
        const measured = dateTimeData.measured;

        if (!virtual && !measured) {
            setError('No data', 'for chosen time');
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

        function initParams(p, defaults) {
            if (p === undefined) {
                p = {}
            }
            const keys = Object.keys(defaults)
            for (let i in keys) {
                const key = keys[i];
                if (p[key] === undefined) {
                    p[key] = defaults[key];
                }
            }
            return p;
        }

        function select(className) {
            const elem = svg.select(className);
            elem.selectAll('*').remove();
            return elem
        }

        function drawLine(elem, x, y, params) {
            params = initParams(params, {
                color: 'black',
                width: 1,
                duration: 0,
                dashed: false,
                arrowSize: 0,
                xScale: tempScale,
                yScale: altScale,
            })
            const points = []
            for (let i in x) {
                points.push(({ x: params.xScale(x[i]), y: params.yScale(y[i]) }));
            }

            const line = d3.line()
                .curve(d3.curveLinear)
                .x(d => d.x)
                .y(d => d.y);

            function length(path) {
                return d3.create('svg:path').attr('d', path).node().getTotalLength();
            }

            const l = length(line(points));
            const dash = (params.dashed) ? '10' : `${l},${l}`;

            if (params.arrowSize > 0) {
                const size = params.arrowSize;
                elem
                    .append('marker')
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

            const path = elem.append('path')
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

        function drawPoint(elem, x, y, color) {
            const point = [{ x: tempScale(x), y: altScale(y) }]
            elem.append('g')
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

        function drawText(elem, x, y, text, params) {
            params = initParams(params, {
                xScale: tempScale,
                size: 14,
                color: 'black',
                valign: 'middle', // top/bottom/middle.
                halign: 'middle', // start/middle/end.
            })

            const point = [{ x: params.xScale(x), y: altScale(y) }]
            const label = elem.append('g')
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
                })
                .call(halo);
        }
        function drawPolygon(elem, points, color, width) {
            const d = []
            for (let i in points) {
                d.push([tempScale(points[i][0]), altScale(points[i][1])])
            }
            elem.append('polygon')
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

        select('.clipPlotArea')
            .append('rect')
            .attr('x', tempPlotAreaX[0])
            .attr('y', altPlotAreaY[1])
            .attr('width', tempPlotAreaX[1] - tempPlotAreaX[0])
            .attr('height', altPlotAreaY[0] - altPlotAreaY[1]);


        // Draw diagonal ticks.
        const ticksElem = select('.diagonalTicks');
        for (let x0 = tempRange[1]; x0 > tempRange[0]; x0 -= xTick) {
            drawLine(
                ticksElem,
                [tempRange[0], x0],
                [y(tempRange[0], x0, altRange[0]), altRange[0]],
                { color: '#ebecf0' });
        }
        // Draw ground.
        drawPolygon(
            select('.ground'),
            [
                [tempRange[0], altRange[0]],
                [tempRange[1], altRange[0]],
                [tempRange[1], virtual.h0],
                [tempRange[0], virtual.h0],
            ],
            colors.ground, 1.5)
        drawText(select('.altLabel'), tempRange[1], virtual.h0, `Alt: ${virtual.h0} ft`,
            { valign: 'top', halign: 'start' })

        // Draw temperature graphs.
        if (virtual) {
            drawLine(select('.virtualTemp'), virtual.temp, virtual.alt,
                { color: 'red', width: 2 });
            drawLine(select('.virtaulDew'), virtual.dew, virtual.alt,
                { color: 'blue', width: 2 });
        }
        if (measured) {
            drawLine(select('.measuredTemp'), measured.temp, measured.alt,
                { color: 'red', width: 2, dashed: true });
            drawLine(select('.measuredDew'), measured.dew, measured.alt,
                { color: 'blue', width: 2, dashed: true });
        }

        // Draw wind
        drawLine(select('.virtualWindSpeed'), virtual.windSpeed, virtual.alt,
            { color: '#444444', xScale: windScale })
        const virtualWindElem = select('.virtualWindSpeedLabels')
        for (let i in virtual.windSpeed) {
            const dir = windDirName(virtual.windDir[i])
            drawText(virtualWindElem, virtual.windSpeed[i], virtual.alt[i], virtual.windSpeed[i] + dir,
                { size: 10, xScale: windScale })
        }
        if (measured) {
            const measuredWindElem = select('.measuredWindSpeedLabels')
            drawLine(select('.measuredWindSpeed'), measured.windSpeed, measured.alt,
                { color: '#444444', xScale: windScale, dashed: true })
            for (let i in measured.windSpeed) {
                const dir = windDirName(measured.windDir[i])
                drawText(measuredWindElem, measured.windSpeed[i], measured.alt[i], measured.windSpeed[i] + dir,
                    { size: 10, xScale: windScale, color: '#444444' })
            }
        }

        // Max temperature diagonals.
        drawPolygon(
            select('.maxTempDiagonal'),
            [
                [virtual.t0, virtual.h0],
                [virtual.t0 - 3, virtual.h0],
                [tempRange[0], y(tempRange[0], virtual.t0 - 3, virtual.h0)],
                [tempRange[0], y(tempRange[0], virtual.t0, virtual.h0)],

            ],
            colors.tempDiagonal, 0
        );
        drawPoint(select('.virtualT0'), virtual.t0, virtual.h0, 'red');
        drawText(select('.virtualT0Label'), virtual.t0, virtual.h0, 'T0: ' + virtual.t0 + 'ºC',
            { valign: 'top' })

        if (virtual.trig) {
            const color = (virtual.isTriggered) ? 'green' : 'red';
            drawLine(select('.trigger'), [virtual.t0, virtual.trig], [virtual.h0, virtual.h0],
                { color: color, duration: 2500, arrowSize: 14 })
            drawText(select('.triggerLabel'), virtual.trig, virtual.h0, 'Trigger: ' + virtual.trig.toFixed(1) + 'ºC',
                { valign: 'top' })
        }

        // Thermal indices.
        drawPolygon(
            select('.virtualThermalIndex'),
            [
                [tempRange[0], virtual.TI],
                [tempRange[1], virtual.TI],
                [tempRange[1], virtual.TIM3],
                [tempRange[0], virtual.TIM3]
            ],
            colors.virtTI, 0
        );
        if (virtual.TI !== virtual.h0) {
            drawText(select('.virtualTILabel'), tempRange[1], virtual.TI, 'TI (virt): ' + virtual.TI.toFixed(0) + 'ft',
                { halign: 'start' })
        }
        if (virtual.TIM3 !== virtual.h0) {
            drawText(select('.virtualTIM3Label'), tempRange[1], virtual.TIM3, 'TI-3 (virt): ' + virtual.TIM3.toFixed(0) + 'ft',
                { halign: 'start' })
        }
        if (measured) {
            drawPolygon(
                select('.measuredThermalIndex'),
                [
                    [tempRange[0], measured.TI],
                    [tempRange[1], measured.TI],
                    [tempRange[1], measured.TIM3],
                    [tempRange[0], measured.TIM3]
                ],
                colors.measuredTI, 0
            )
            if (measured.TI !== virtual.h0) {
                drawText(select('measuredTILabel'), tempRange[1], measured.TI, 'TI (measured): ' + measured.TI.toFixed(0) + 'ft',
                    { halign: 'start' })
            }
            if (measured.TIM3 !== virtual.h0) {
                drawText(select('measuredTIM3Label'), tempRange[1], measured.TIM3, 'TI-3 (measured): ' + measured.TIM3.toFixed(0) + 'ft',
                    { halign: 'start' })
            }
        }

        // Draw cloud base.
        if (virtual.cloudBase) {
            const vcloudBaseY = Math.min(virtual.cloudBase, altRange[1]);
            if (virtual.cloudBase <= altRange[1]) {
                drawLine(
                    select('.virtualCloudBase'),
                    tempRange, [vcloudBaseY, vcloudBaseY],
                    { color: colors.cloudBase, duration: 500 })
            }
            drawText(select('.virtCloudBaseLabel'), tempRange[1], vcloudBaseY, 'Cloud base (virt): ' + virtual.cloudBase.toFixed(0) + 'ft',
                { halign: 'start' })
        }

        if (measured?.cloudBase) {
            const mcloudBaseY = Math.min(measured.cloudBase, altRange[1]);
            if (measured.cloudBase <= altRange[1]) {
                drawLine(
                    select('.measuredCloudBase'),
                    tempRange, [mcloudBaseY, mcloudBaseY],
                    { color: colors.cloudBase, duration: 500, dashed: true })
            }
            drawText(select('.measuredCloudBaseLabel'), tempRange[1], mcloudBaseY, 'Cloud base (measured): ' + measured.cloudBase.toFixed(0) + 'ft',
                { halign: 'start' })
        }

        // Draw axes.
        const altTicks = (altRange[1] - altRange[0]) / yTick;
        const tempTicks = (tempRange[1] - tempRange[0]) / xTick;
        const windTicks = 5;

        // Alt axis.
        select('.altAxis').call(g => g
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
                .text('H[ft]')
                .call(halo))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'end')
                .attr('x', -28)));

        // Temp axis.
        select('.tempAxis').call(g => g
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
                .text('T[c]')
                .call(halo)));

        // Wind axis.
        select('.windAxis').call(g => g
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
                .text('Wind [kn]')
                .call(halo)));

        function halo(text) {
            text.select(function () { return this.parentNode.insertBefore(this.cloneNode(true), this); })
                .attr('fill', 'none')
                .attr('stroke', 'white')
                .attr('stroke-width', 4)
                .attr('stroke-linejoin', 'round');
        }
    }, [data, time]);

    return (
        <svg
            ref={ref}
            className='Sounding'
            style={{
                height: '600px',
                width: '100%',
                marginRight: '0px',
                marginLeft: '0px',
            }}
        >
            <clipPath className='clipPlotArea' id='clipPlotArea' />
            <g className='diagonalTicks' />
            <g className='altLabel' />
            <g className='virtualT0Label' />
            <g className='triggerLabel' />
            <g className='tempAxis' />
            <g className='altAxis' />
            <g className='windAxis' />
            <g className='virtualTILabel' />
            <g className='virtualTIM3Label' />
            <g className='measuredTILabel' />
            <g className='measuredTIM3Label' />
            <g className='virtCloudBaseLabel' />
            <g className='measuredCloudBaseLabel' />
            <g className='virtualWindSpeedLabels' />
            <g className='measuredWindSpeedLabels' />


            <g className='virtualTemp' />
            <g className='virtualDue' />
            <g className='measuredTemp' />
            <g className='measuredDew' />
            <g className='virtualWindSpeed' />
            <g className='measuredWindSpeed' />
            <g className='trigger' />
            <g className='virtualCloudBase' />
            <g className='measuredCloudBase' />

            <g className='virtualT0' />

            <g className='ground' />
            <g className='maxTempDiagonal' />
            <g className='virtualThermalIndex' />
            <g className='measuredThermalIndex' />
            <g className='TIVirtual' />
            <g className='TIMeasured' />
            <g className='CloudBase' />
            <g className='Temp' />
        </svg>
    );
}

function windDirName(v) {
    const dirs = [
        'N', 'NNW', 'NW', 'NWW',
        'W', 'SWW', 'SW', 'SSW',
        'S', 'SSE', 'SE', 'SEE',
        'E', 'NEE', 'NE', 'NNE',
    ]
    var part = 360 / dirs.length
    var i = Math.floor((v + part / 2) / part)
    return dirs[i]
}