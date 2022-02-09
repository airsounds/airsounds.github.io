import React from 'react';
import useD3 from './hooks/useD3';
import * as d3 from 'd3';
import { dateFormatPlotDay, altMax, tempMax, dateTimeURLFormat, hourFormat, plotHours, colors } from './utils';

export default function Timeline({ data, time, setTime }) {
    const ref = useD3(({ svg, rect }) => {
        if (!data) {
            return;
        }

        function select(className) {
            const elem = svg.select(className);
            elem.selectAll('*').remove();
            return elem
        }

        const samples = Object.values(data)
            .flatMap(dayData => Object.entries(dayData.hours)
                .map(([hour, hourData]) => {
                    const t = new Date(dayData.day.t.getTime());
                    t.setHours(parseInt(hour));
                    return {
                        t: t,
                        virtual: hourData.virtual,
                        measured: hourData.measured,
                    }
                }));
        console.log('samples', samples);
        const n = samples.length;
        const days = samples.map(s => dateFormatPlotDay(s.t));
        const hours = samples.map(s => hourFormat(s.t));
        const dayStart = hours.map(h => parseInt(h) === plotHours[0]);
        const dayEnd = hours.map(h => parseInt(h) === plotHours[plotHours.length - 1]);

        const margin = { top: 36, right: 5, bottom: 5, left: 20 };
        const plotArea = {
            x: [margin.left, margin.left + rect.width - margin.right],
            y: [rect.height - margin.bottom, margin.top],
        }
        // Width of each hour in the plot area.
        const hourWidth = (plotArea.x[1] - plotArea.x[0]) / n;
        const dayLabelOffset = 14; // Put the day lables above the hour labels.

        const tScale = d3
            .scaleLinear()
            .domain([0, n])
            .range([
                // Plot the dots with space from the start and the end of the plot area.
                plotArea.x[0] + hourWidth / 2,
                plotArea.x[1] - hourWidth / 2,
            ]);

        const yAltPortion = 0.7;
        const yAlt = [plotArea.y[0] * yAltPortion + plotArea.y[1] * (1 - yAltPortion), plotArea.y[1]];
        const yTemp = [plotArea.y[0], yAlt[0]];

        const altTicks = 1000; // Each tick is 1k feet.
        const tempTicks = 5; // Each tick is 5 degrees.

        function findMaxAlt() {
            function allSampleAltValues(s) {
                return [
                    s.virtual?.TI, s.virtual?.TIM3, s.virtual?.cloudBase,
                    s.measured?.TI, s.measured?.TIM3, s.measured?.cloudBase,
                ]
            }
            const maxAlt = Math.max(...samples.flatMap(s => allSampleAltValues(s).filter(v => v)));
            const maxAltRounded = Math.ceil(maxAlt / altTicks) * altTicks;
            return maxAltRounded
        }
        const altRange = [
            0,
            Math.min(findMaxAlt(), altMax),
        ];

        const altScale = d3
            .scaleLinear()
            .domain(altRange)
            .range(yAlt);

        function findMaxTemp() {
            function allSampleTempValues(s) {
                return [
                    s.virtual?.t0, s.virtual?.trig,
                    s.measured?.t0, s.measured?.trig,
                ]
            }
            const allValues = samples.flatMap(s => allSampleTempValues(s)).filter(v => v);
            const min = Math.floor(Math.min(...allValues) / tempTicks) * tempTicks;
            const max = Math.ceil(Math.max(...allValues) / tempTicks) * tempTicks;
            return [min, max];
        }
        const tempRange = [
            Math.max(findMaxTemp()[0], 0),
            Math.min(findMaxTemp()[1], tempMax),
        ]

        const tempScale = d3
            .scaleLinear()
            .domain(tempRange)
            .range(yTemp);


        svg.select('.hoursAxis').call(g => g
            .attr('transform', `translate(0,${plotArea.y[1]})`)
            .call(d3
                .axisTop(tScale)
                .ticks(n)
                .tickFormat((d, i) => hours[i]))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line').remove())
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'middle')));

        svg.select('.daysAxis').call(g => g
            .attr('transform', `translate(0,${plotArea.y[1] - dayLabelOffset})`)
            .call(d3
                .axisTop(tScale)
                .ticks(n)
                .tickFormat((d, i) => dayStart[i] ? days[i] : ''))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('y1', -dayLabelOffset)
                .attr('y2', plotArea.y[0] - plotArea.y[1] + dayLabelOffset)
                .attr('x1', -hourWidth / 2)
                .attr('x2', -hourWidth / 2)
                .attr('stroke-opacity', (d, i) => !dayStart[i] || i === 0 || i === n ? 0 : 0.2)
            )
            .call(g => g
                .selectAll('text')
                .attr('x', 0)
                .attr('text-anchor', 'end')
            )
        );

        const plotAreaWidth = plotArea.x[1] - plotArea.x[0] - hourWidth
        const xTicksOpacity = 0.2;
        const yTicksTextShift = -8;
        const altTicksN = Math.floor((altRange[1] - altRange[0]) / altTicks);
        const tempTicksN = Math.floor((tempRange[1] - tempRange[0]) / tempTicks);

        svg.select('.altAxis').call(g => g
            .attr('transform', `translate(${plotArea.x[0]},0)`)
            .call(d3
                .axisLeft(altScale)
                .ticks(altTicksN)
                .tickFormat((d, i) => d === altRange[0] ? '' : `${d / altTicks}k`))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke-opacity', xTicksOpacity)
                .attr('x2', plotAreaWidth))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'start')
                .attr('x', yTicksTextShift)));

        svg.select('.tempAxis').call(g => g
            .attr('transform', `translate(${plotArea.x[0]},0)`)
            .call(d3
                .axisLeft(tempScale)
                .ticks(tempTicksN)
                .tickFormat((d, i) => d === tempRange[0] ? '' : `${d}°`))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke-opacity', xTicksOpacity)
                .attr('x2', plotAreaWidth))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'start')
                .attr('x', yTicksTextShift)));

        svg.select('.Ground').datum(samples)
            .attr('fill', colors.ground)
            .attr('stroke-width', 0)
            .attr('opacity', 0.5)
            .attr('d', d3.area()
                .defined(s => s.virtual?.TI && s.virtual?.TIM3)
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.virtual.h0 > 0 ? 0 : s.virtual.h0 - 10))
                .y1(s => altScale(s.virtual.h0)));

        // A path for cliping graphs between days.
        select('.DaysGraphPath')
            .datum(samples.flatMap((s, i) =>
                dayStart[i] ? [{ i, v: rect.height }, { i, v: 0 }]
                    : dayEnd[i] ? [{ i, v: 0 }, { i, v: rect.height }] : []))
            .attr('id', 'DaysGraphPath')
            .append('path')
            .attr('d', d3.area()
                .x(s => tScale(s.i))
                .y0(rect.height)
                .y1(s => s.v)
            );

        svg
            .select('.TIVirt')
            .datum(samples)
            .attr('fill', colors.virtTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.area()
                .defined(s => s.virtual?.TI && s.virtual?.TIM3)
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.virtual.TIM3))
                .y1(s => altScale(s.virtual.TI)));

        svg
            .select('.TIMeasured')
            .datum(samples)
            .attr('fill', colors.measuredTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.area()
                .defined(s => s?.measured?.TI && s?.measured?.TIM3)
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.measured.TIM3))
                .y1(s => altScale(s.measured.TI)));

        svg
            .select('.CloudBaseVirtual')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.cloudBase)
            .attr('stroke-width', 0.5)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.line()
                .defined(s => s.virtual?.cloudBase)
                .x((s, i) => tScale(i))
                .y(s => altScale(s.virtual.cloudBase)));

        svg
            .select('.CloudBaseMeasured')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.cloudBase)
            .attr('stroke-width', 0.5)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('stroke-dasharray', '4,4')
            .attr('d', d3.line()
                .defined(s => s.measured?.cloudBase)
                .x((s, i) => tScale(i))
                .y(s => altScale(s.measured?.cloudBase))
            );

        svg
            .select('.Temp')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 0.5)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.line()
                .defined(s => s.virtual?.t0)
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.virtual.t0))
            );

        select('.BelowTemp')
            .datum(samples)
            .attr('id', 'BelowTemp')
            .append('path')
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.area()
                .defined(s => s.virtual?.t0)
                .x((s, i) => tScale(i))
                .y0(0)
                .y1(s => tempScale(s.virtual.t0))
            );

        select('.AboveTemp')
            .datum(samples)
            .attr('id', 'AboveTemp')
            .append('path')
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.area()
                .defined(s => s.virtual?.t0)
                .x((s, i) => tScale(i))
                .y0(rect.height)
                .y1(s => tempScale(s.virtual.t0))
            );

        svg
            .select('.TrigVirtGood')
            .datum(samples)
            .attr('fill', colors.good)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', 'url(#AboveTemp)')
            .attr('d', d3.area()
                .defined(s => s.virtual?.trig && s.virtual?.t0)
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.virtual.t0))
                .y1(s => tempScale(s.virtual.trig))
            );

        svg
            .select('.TrigMeasuredGood')
            .datum(samples)
            .attr('fill', colors.good)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', 'url(#AboveTemp)')
            .attr('d', d3.area()
                .defined(s => s.measured?.trig && s.measured?.t0)
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.measured.t0))
                .y1(s => tempScale(s.measured.trig))
            );

        svg
            .select('.TrigVirtBad')
            .datum(samples)
            .attr('fill', colors.bad)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', 'url(#BelowTemp)')
            .attr('d', d3.area()
                .defined(s => s.virtual?.trig && s.virtual?.t0)
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.virtual.t0))
                .y1(s => tempScale(s.virtual.trig))
            );

        svg
            .select('.TrigVirt')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 0.5)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('d', d3.line()
                .defined(s => s.virtual?.trig)
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.virtual.trig))
            );

        svg
            .select('.TrigMeasured')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 0.5)
            .attr('clip-path', 'url(#DaysGraphPath)')
            .attr('stroke-dasharray', '4,4')
            .attr('d', d3.line()
                .defined(s => s.measured?.trig)
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.measured.trig))
            );

        // Draw a button for each hour.
        svg.selectAll('.buttons').remove();
        samples.forEach((s, i) => {
            const selected = dateTimeURLFormat(s.t) === dateTimeURLFormat(time);
            const opacity = selected ? 0.2 : 0;
            const button = svg
                .append('rect')
                .attr('class', 'buttons')
                .attr('x', tScale(i) - hourWidth / 2)
                .attr('y', dayLabelOffset + 3)
                .attr('width', hourWidth)
                .attr('height', plotArea.y[0] - plotArea.y[1] + dayLabelOffset + 4)
                .attr('fill', colors.selected)
                .attr('stroke', 'black')
                .attr('stroke-width', 1)
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('opacity', opacity);
            button.on('click', () => setTime(s.t));
            button.on('mouseover', () => button.attr('opacity', selected ? opacity : 0.1));
            button.on('mouseout', () => button.attr('opacity', opacity));
        });
    }, [data, time]);
    return (
        <svg
            ref={ref}
            style={{
                height: '200px',
                width: '100%',
                marginRight: '0px',
                marginLeft: '0px',
            }}
        >
            <g className='hoursAxis' />
            <g className='daysAxis' />
            <g className='altAxis' />
            <g className='tempAxis' />
            <clipPath className='DaysGraphPath' />
            <clipPath className='AboveTemp' />
            <clipPath className='BelowTemp' />
            <path className='Ground' />
            <path className='TIVirt' />
            <path className='TIMeasured' />
            <path className='CloudBaseVirtual' />
            <path className='CloudBaseMeasured' />
            <path className='TrigVirtGood' />
            <path className='TrigVirtBad' />
            <path className='TrigMeasuredGood' />
            <path className='TrigVirt' />
            <path className='TrigMeasured' />
            <path className='Temp' />
        </svg>
    );
}
