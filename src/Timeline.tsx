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
import { Errorf } from './data';

type Props = {
    data: CalcData;
    place: string;
    date: Date;
    selectedTime: Date;
    setSelectedTime: (time: Date) => void;
    setError: Errorf;
}

interface Sample extends CalcHourData {
    t: Date;
}

export default function Timeline(props: Props) {
    const { t } = useTranslation();
    const { ref, svg } = useD3();
    const { rect } = useRect(ref);

    const [samples, setSamples] = useState<Sample[] | null>(null);
    const [soundingShown, setSoundingShown] = useState(false);

    useEffect(() => {
        const samples = Object.entries(props.data[props.place])
            .map(([hour, hourData]) => {
                const t = new Date(props.date.getTime());
                t.setHours(parseInt(hour));
                return {
                    t: t,
                    virtual: hourData.virtual,
                    measured: hourData.measured,
                }
            })
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

        const yAltPortion = 0.7;
        const yAlt = [plotArea.y[0] * yAltPortion + plotArea.y[1] * (1 - yAltPortion), plotArea.y[1]];
        const yTemp = [plotArea.y[0], yAlt[0]];

        const altTicks = 1000; // Each tick is 1k feet.
        const tempTicks = 5; // Each tick is 5 degrees.

        function findMaxAlt(samples: Sample[]) {
            function allSampleAltValues(s: Sample): Array<number | undefined> {
                return [
                    s.virtual?.TI,
                    s.virtual?.TIM3,
                    s.virtual?.CB,
                    s.measured?.TI,
                    s.measured?.TIM3,
                    s.measured?.CB,
                ]
            }
            const maxAlt = Math.max(...samples.flatMap(s => allSampleAltValues(s).filter(v => v) as number[]));
            const maxAltRounded = Math.ceil(maxAlt / altTicks) * altTicks;
            return maxAltRounded
        }
        const altRange = [
            0,
            Math.min(findMaxAlt(samples), altMax),
        ];

        const altScale = d3
            .scaleLinear()
            .domain(altRange)
            .range(yAlt);

        function findExtremeTemp(samples: Sample[]): [number, number] {
            function allSampleTempValues(s: Sample): Array<number | undefined> {
                return [
                    s.virtual?.t0,
                    s.virtual?.trig,
                    s.measured?.t0,
                    s.measured?.trig,
                ]
            }
            const allValues = samples.flatMap(s => allSampleTempValues(s)).filter(v => v) as number[];
            const min = Math.floor(Math.min(...allValues) / tempTicks) * tempTicks;
            const max = Math.ceil(Math.max(...allValues) / tempTicks) * tempTicks;
            return [min, max];
        }
        const samplesExtremeTemps = findExtremeTemp(samples);
        const tempRange = [
            Math.max(samplesExtremeTemps[0], 0),
            Math.min(samplesExtremeTemps[1], tempMax),
        ]

        const tempScale = d3
            .scaleLinear()
            .domain(tempRange)
            .range(yTemp);


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

        const plotAreaWidth = plotArea.x[1] - plotArea.x[0] - hourWidth
        const xTicksOpacity = 0.2;
        const yTicksTextShift = -8;
        const altTicksN = Math.floor((altRange[1] - altRange[0]) / altTicks);
        const tempTicksN = Math.floor((tempRange[1] - tempRange[0]) / tempTicks);

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

        svg.append('path').datum(samples)
            .attr('fill', colors.ground)
            .attr('stroke-width', 0)
            .attr('opacity', 0.5)
            .attr('d', d3.area<Sample>()
                .defined(s => Boolean(s.virtual?.h0))
                .x((s, i) => tScale(i))
                .y0(s => altScale((s.virtual?.h0 || 0) > 0 ? 0 : (s.virtual?.h0 || 0) - 10))
                .y1(s => altScale((s.virtual?.h0 || 0))));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.virtTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('d', d3.area<Sample>()
                .defined(s => Boolean(s.virtual?.TI) && Boolean(s.virtual?.TIM3))
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.virtual?.TIM3 || 0))
                .y1(s => altScale(s.virtual?.TI || 0)));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', colors.measuredTI)
            .attr('stroke-width', 0)
            .attr('opacity', 0.3)
            .attr('d', d3.area<Sample>()
                .defined(s => Boolean(s.measured?.TI) && Boolean(s.measured?.TIM3))
                .x((s, i) => tScale(i))
                .y0(s => altScale(s.measured?.TIM3 || 0))
                .y1(s => altScale(s.measured?.TI || 0)));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.CB)
            .attr('stroke-width', 0.5)
            .attr('d', d3.line<Sample>()
                .defined(s => Boolean(s.virtual?.CB))
                .x((s, i) => tScale(i))
                .y(s => altScale(s.virtual?.CB || 0)));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', colors.CB)
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '4,4')
            .attr('d', d3.line<Sample>()
                .defined(s => Boolean(s.measured?.CB))
                .x((s, i) => tScale(i))
                .y(s => altScale(s.measured?.CB || 0)));

        svg
            .append('path')
            .datum(samples)
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 0.5)
            .attr('d', d3.line<Sample>()
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
            .attr('d', d3.area<Sample>()
                .defined(s => Boolean(s.virtual?.t0))
                .x((s, i) => tScale(i))
                .y0(0)
                .y1(s => tempScale(s.virtual?.t0 || 0)));

        svg.append('clipPath')
            .datum(samples)
            .attr('id', aboveTemp)
            .append('path')
            .attr('d', d3.area<Sample>()
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
            .attr('d', d3.area<Sample>()
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
            .attr('d', d3.area<Sample>()
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
            .attr('d', d3.area<Sample>()
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
            .attr('d', d3.line<Sample>()
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
            .attr('d', d3.line<Sample>()
                .defined(s => Boolean(s.measured?.trig))
                .x((s, i) => tScale(i))
                .y(s => tempScale(s.measured?.trig || 0)));

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
                                {`${t('Chart for')} ${dateTimeURLFormat(props.date)}`}
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <Sounding
                                data={props.data[props.place]}
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
