import { LegacyRef, useEffect, useState } from 'react';
import "./App.css"
import useD3 from './hooks/useD3';
import useRect from './hooks/useRect';
import * as d3 from 'd3';
import { altMax, tempMax, dateTimeURLFormat, dateFormat, hourFormat, colors } from './utils';
import { Modal, Image, Button } from 'react-bootstrap';
import Sounding from './Sounding';
import { CalcData, CalcHourData } from './calc';
import { useTranslation } from 'react-i18next';
import { LocationData, Errorf } from './data';

type Props = {
    data: CalcData;
    location: LocationData;
    date: Date;
    selectedTime: Date;
    setSelectedTime: (time: Date) => void;
    setError: Errorf;
}

const windColorScale = [
    '#69B34C',
    '#ACB334',
    '#FAB733',
    '#FF8E15',
    '#FF4E11',
    '#FF0D0D',
]

export default function Timeline(props: Props) {
    const { t } = useTranslation();
    const { ref, svg } = useD3();
    const { rect } = useRect(ref);

    const [samples, setSamples] = useState<CalcHourData[] | null>(null);
    const [soundingShown, setSoundingShown] = useState(false);

    useEffect(() => {
        const samples = Object.values(props.data[props.location.name])
            .sort((a, b) => a.t.getTime() - b.t.getTime());
        console.debug(`samples ${dateFormat(props.date)}:`, samples);
        setSamples(samples);
    }, [props]);

    useEffect(() => {
        if (!rect || !samples || !svg || !props.date) {
            return;
        }

        svg.selectAll('*').remove();
        const n = samples.length;
        const hours = samples.map(s => hourFormat(s.t));

        const margin = { top: 24, right: 5, bottom: 5, left: 30 };
        const plotArea = {
            x: [margin.left, margin.left + rect.width - margin.right],
            y: [rect.height - margin.bottom, margin.top],
        }
        // Width of each hour in the plot area.
        const hourWidth = (plotArea.x[1] - plotArea.x[0]) / n;

        const tScale = d3
            .scaleLinear()
            .domain([0, n])
            .range([
                // Plot the dots with space from the start and the end of the plot area.
                plotArea.x[0] + hourWidth / 2,
                plotArea.x[1] - hourWidth / 2,
            ]);

        // Capture graph height.
        // 0 is the top of the screen, 1 is the bottom of the screen.
        // The first element is the bottom of the axis, the second is the top of the axis.
        const interpolateY = (c: number) => plotArea.y[0] * c + plotArea.y[1] * (1 - c);
        const altY = [0.5, 0].map(interpolateY);
        const tempY = [0.8, 0.5].map(interpolateY);
        const windY = [1, 0.8].map(interpolateY);

        function findMaxAlt(samples: CalcHourData[]) {
            function allSampleAltValues(s: CalcHourData): Array<number | undefined> {
                return [
                    s.virtual?.TI,
                    s.virtual?.TIM3,
                    s.virtual?.CB,
                    s.measured?.TI,
                    s.measured?.TIM3,
                    s.measured?.CB,
                ]
            }
            return Math.max(...samples.flatMap(s => allSampleAltValues(s).filter(v => v) as number[]));
        }
        const altRange = [
            0,
            Math.min(findMaxAlt(samples), altMax),
        ];
        const altTicks = 1000; // Each tick is 1k feet.
        altRange[1] = Math.ceil(altRange[1] / altTicks) * altTicks;


        const altScale = d3
            .scaleLinear()
            .domain(altRange)
            .range(altY);

        function findExtremeTemp(samples: CalcHourData[]): [number, number] {
            function allSampleTempValues(s: CalcHourData): Array<number | undefined> {
                return [
                    s.virtual?.t0,
                    s.virtual?.trig,
                    s.measured?.t0,
                    s.measured?.trig,
                ]
            }
            const allValues = samples.flatMap(s => allSampleTempValues(s)).filter(v => v) as number[];
            return [Math.min(...allValues), Math.max(...allValues)];
        }
        const samplesExtremeTemps = findExtremeTemp(samples);
        const tempRange = [
            Math.max(samplesExtremeTemps[0], 0),
            Math.min(samplesExtremeTemps[1], tempMax),
        ]
        const tempTicks = 5; // Each tick is 5 degrees.
        tempRange[0] = Math.floor(tempRange[0] / tempTicks) * tempTicks;
        tempRange[1] = Math.ceil(tempRange[1] / tempTicks) * tempTicks;

        const tempScale = d3
            .scaleLinear()
            .domain(tempRange)
            .range(tempY);

        const windRange = [0, 20];
        const windTicks = 5; // Each tick is 5 knots.

        const windScale = d3
            .scaleLinear()
            .domain(windRange)
            .range(windY);

        const plotAreaWidth = plotArea.x[1] - plotArea.x[0] - hourWidth
        const xTicksOpacity = 0.2;
        const yTicksTextShift = -8;
        const altTicksN = Math.floor((altRange[1] - altRange[0]) / altTicks);
        const tempTicksN = Math.floor((tempRange[1] - tempRange[0]) / tempTicks);
        const windTicksN = Math.floor((windRange[1] - windRange[0]) / windTicks);

        // Hours X axis.
        svg.append('g').call(g => g
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

        // Alt Y axis.
        svg.append('g').call(g => g
            .attr('transform', `translate(${plotArea.x[0]},0)`)
            .call(d3
                .axisLeft(altScale)
                .ticks(altTicksN)
                .tickFormat((d, i) => d === altRange[0] ? '' : `${d.valueOf() / altTicks}k`))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke-opacity', xTicksOpacity)
                .attr('x2', plotAreaWidth))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'start')
                .attr('x', yTicksTextShift)));

        // Temp Y axis.
        svg.append('g').call(g => g
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

        // Wind Y axis.
        svg.append('g').call(g => g
            .attr('transform', `translate(${plotArea.x[0]},0)`)
            .call(d3
                .axisLeft(windScale)
                .ticks(windTicksN)
                .tickFormat((d, i) => `${d}kt`))
            .call(g => g.select('.domain').remove())
            .call(g => g.selectAll('.tick line')
                .attr('stroke-opacity', xTicksOpacity)
                .attr('x2', plotAreaWidth))
            .call(g => g
                .selectAll('text')
                .style('font-size', '8px')
                .attr('text-anchor', 'start')
                .attr('x', yTicksTextShift)));

        // Ground.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.ground)
            .attr('stroke-width', 0)
            .attr('opacity', 0.5)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.h0))
                .x((s, i) => tScale(i))
                .y0(s => altScale((s.virtual?.h0 || 0) > 0 ? 0 : (s.virtual?.h0 || 0) - 10))
                .y1(s => altScale((s.virtual?.h0 || 0))));

        // Virtual TI.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.virtTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.TI) && Boolean(s.virtual?.TIM3))
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.virtual?.TIM3 || 0))
                .y1(s => altScale(s.virtual?.TI || 0)));

        // Measured TI.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.measuredTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.measured?.TI) && Boolean(s.measured?.TIM3))
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.measured?.TIM3 || 0))
                .y1(s => altScale(s.measured?.TI || 0)));

        // Virtual cloud base.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.CB)
            .attr('stroke-width', 0.5)
            .attr('d', d3.line<CalcHourData>()
                .defined(s => Boolean(s.virtual?.CB))
                .x((s, i) => tScale(i))
                .y(s => altScale(s.virtual?.CB || 0)));

        // Measured cloud base.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.CB)
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '4,4')
            .attr('d', d3.line<CalcHourData>()
                .defined(s => Boolean(s.measured?.CB))
                .x((s, i) => tScale(i))
                .y(s => altScale(s.measured?.CB || 0)));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 0.5)
            .attr('d', d3.line<CalcHourData>()
                .defined(s => Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.virtual?.t0 || 0)));

        // Clips for trigger areas. Below and above the temperature line.
        const belowTemp = `BelowTemp${dateFormat(props.date)}`
        const aboveTemp = `AboveTemp${dateFormat(props.date)}`
        svg.append('clipPath')
            .datum(samples)
            .attr('id', belowTemp)
            .append('path')
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y0(0)
                .y1(s => tempScale(s.virtual?.t0 || 0)));

        svg.append('clipPath')
            .datum(samples)
            .attr('id', aboveTemp)
            .append('path')
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y0(rect.height)
                .y1(s => tempScale(s.virtual?.t0 || 0)));

        // "Good" virtual trigger area. Above termpature and below 
        // virtual trigger termperature.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.good)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', `url(#${aboveTemp})`)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.trig) && Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.virtual?.t0 || 0))
                .y1(s => tempScale(s.virtual?.trig || 0)));

        // "Good" measured trigger area. Above termpature and below 
        // measured trigger termperature.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.good)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', `url(#${aboveTemp})`)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.measured?.trig) && Boolean(s.measured?.t0))
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.measured?.t0 || 0))
                .y1(s => tempScale(s.measured?.trig || 0)));

        // "Bad" trigger area. Above trigger termprature and below temperature.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.bad)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('clip-path', `url(#${belowTemp})`)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.trig) && Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y0(s => tempScale(s.virtual?.trig || 0))
                .y1(s => tempScale(s.virtual?.t0 || 0)));

        // Virtual trigger temperature.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 0.5)
            .attr('d', d3.line<CalcHourData>()
                .defined(s => Boolean(s.virtual?.trig))
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.virtual?.trig || 0)));

        // Measured trigger temperature.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '4,4')
            .attr('d', d3.line<CalcHourData>()
                .defined(s => Boolean(s.measured?.trig))
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.measured?.trig || 0)));

        // Wind speed.
        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.windSpeed)
            .attr('stroke-width', 0)
            .attr('opacity', 0.2)
            .attr('d', d3.area<CalcHourData>()
                .defined(s => Boolean(s.virtual?.windSpeed))
                .x((s, i) => tScale(i))
                .y0(windScale(0))
                .y1(s => windScale(s.virtual?.windSpeed[0] || 0))
            );

        // Wind direction and text.
        samples.forEach((s, i) => {
            const dir = s.virtual?.windDir[0];
            const speed = s.virtual?.windSpeed[0];
            const magnitude = Math.min(1, speed === undefined ? 0 : speed / 20)
            const size = 5 + magnitude * 10;
            const color = windColorScale[Math.floor(magnitude * windColorScale.length)];
            const x = tScale(i);
            const y = windY[0] - 24;
            const arrowId = `wind-dir-arrow-${i}`;

            const runwayDir = props.location.runway_dir;

            const crosswind = runwayDir !== undefined && dir !== undefined && speed !== undefined
                ? Math.round(Math.sin((runwayDir - dir) * Math.PI / 180) * speed * 10) / 10
                : undefined;

            // Wind direction arrow.
            if (dir !== undefined) {
                svg.append('marker')
                    .attr('id', arrowId)
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
                    .attr('transform', `rotate(${dir + 180}, ${x}, ${y})`)
                    .attr('fill', 'none')
                    .attr('stroke', color)
                    .attr('stroke-width', 1)
                    .attr('marker-end', `url(#${arrowId})`)
                    .attr('d', d3.line());
            }

            // Wind speed text.
            svg
                .append('text')
                .attr('x', tScale(i))
                .attr('y', windY[0] - 8)
                .attr('font-size', '8px')
                .attr('text-anchor', 'middle')
                .text(speed === undefined ? 'N/A' : `${speed}kt`);

            // Wind direction text.
            svg
                .append('text')
                .attr('x', tScale(i))
                .attr('y', windY[0])
                .attr('font-size', '7px')
                .attr('text-anchor', 'middle')
                .text(dir === undefined ? (speed === undefined ? '' : 'N/A') : `${dir}°`);

            // Wind cross wind
            if (crosswind && crosswind > 10) {
                svg
                    .append('text')
                    .attr('x', tScale(i))
                    .attr('y', windY[0] - 43)
                    .attr('font-size', '6px')
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'red')
                    .text(`Cross`);
                svg
                    .append('text')
                    .attr('x', tScale(i))
                    .attr('y', windY[0] - 35)
                    .attr('font-size', '8px')
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'red')
                    .text(`${crosswind}kt`);
            }
        });

        // Draw a button for each hour.
        samples.forEach((s, i) => {
            const selected = dateTimeURLFormat(s.t) === dateTimeURLFormat(props.selectedTime);
            const opacity = selected ? 0.2 : 0;
            const button = svg
                .append('rect')
                .attr('class', 'buttons')
                .attr('x', tScale(i) - hourWidth / 2 + 2)
                .attr('y', 2)
                .attr('width', hourWidth - 4)
                .attr('height', rect.height - 4)
                .attr('fill', colors.selected)
                .attr('stroke', 'black')
                .attr('stroke-width', 1)
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('opacity', opacity);
            button.on('click', () => {
                props.setSelectedTime(s.t);
                setSoundingShown(true);
            });
            button.on('mouseover', () => button.attr('opacity', selected ? opacity : 0.1));
            button.on('mouseout', () => button.attr('opacity', opacity));
        });
    }, [svg, rect, samples, props]);
    return (
        <>
            <svg ref={ref as LegacyRef<SVGSVGElement>} className="Timeline">
            </svg>
            {
                samples == null && (
                    <Image src='/logo.png' className='App-logo' alt='logo' />
                )
            }
            {
                soundingShown && props.data && (
                    <Modal
                        show={soundingShown}
                        fullscreen={true}
                        scrollable={false}
                        animation={false}
                        onClick={() => setSoundingShown(false)}>
                        <Modal.Header className='justify-content-center'>
                            <Modal.Title>
                                {`${t('Chart for')} ${dateTimeURLFormat(props.date)
                                    } `}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <Sounding
                                data={props.data[props.location.name]}
                                time={props.selectedTime}
                                setError={props.setError}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            <Button>{t('Close')}</Button>
                        </Modal.Footer>
                    </Modal>
                )
            }
        </>
    );
}
