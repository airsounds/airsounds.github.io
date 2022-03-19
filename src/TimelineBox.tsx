import { useEffect, useState } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import calc, { CalcData } from './calc';
import { Errorf, LocationData } from './data';
import { fetchDay } from './fetcher';
import Timeline from './Timeline';
import { dateFormat, dateFormatPlotDay } from './utils';
import DayInfo from './DayInfo';

const timelineHeight = '300px';
const timelineMaxWidth = '600px';

type Props = {
    place: string;
    date: Date;
    selectedTime: Date;
    locations: LocationData[];
    setSelectedTime: (time: Date) => void;
    setError: Errorf;
}

export default function TimelineBox(props: Props) {
    const { t } = useTranslation();

    const [data, setData] = useState<CalcData | null>(null);

    // Fetch data and calculate.
    // The data is fetched for all places, so it is only depenedent on the time.
    useEffect(() => {
        async function getDataAndCalc() {
            const rawData = await fetchDay(props.date, props.setError)
            console.debug(`raw ${dateFormat(props.date)}:`, rawData);
            if (!rawData) {
                return;
            }
            const data = await calc(props.date, props.locations, rawData);
            console.debug(`calculated ${dateFormat(props.date)}:`, data);
            setData(data);
        }
        getDataAndCalc();
    }, [props]);

    return (
        <Row className='justify-content-center' >
            <Col
                style={{
                    width: '100%',
                    maxWidth: timelineMaxWidth,
                    marginTop: '16px',
                }}>
                <Card className='text-center'>
                    <Card.Header>
                        {dateFormatPlotDay(t, props.date)}
                        {data &&
                            <DayInfo {...data[props.place]} />
                        }
                    </Card.Header>
                    <Card.Body style={{
                        height: timelineHeight,
                        paddingLeft: '0px',
                        paddingRight: '0px',
                    }}>
                        {data &&
                            <Timeline
                                data={data}
                                place={props.place}
                                date={props.date}
                                selectedTime={props.selectedTime}
                                setSelectedTime={props.setSelectedTime}
                                setError={props.setError}
                            />
                        }
                    </Card.Body>
                </Card>
            </Col>
        </Row>
    )
}