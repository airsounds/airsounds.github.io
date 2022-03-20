import { useEffect, useState } from "react";
import { Card } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { CalcHourData } from "./calc";
import { Hour } from "./data";
import { pad } from "./utils";

type Props = {
    [key: Hour]: CalcHourData;
}

export default function DayInfo(props: Props) {
    const { t } = useTranslation();

    const [measureHour, setMeasureHour] = useState<string | undefined>(undefined);

    useEffect(() => {
        const measureHours = Object.values(props)
            .map(v => v.measured?.measureHour !== undefined ? parseInt(v.measured?.measureHour) : undefined)
            .filter(h => h !== undefined);
        if (measureHours.length > 0) {
            const measureHour = pad(Math.max(...(measureHours as number[])));
            console.log(measureHour)
            if (measureHour === '12') {
                setMeasureHour('noon');
            } else if (measureHour === '00') {
                setMeasureHour('midnight');
            } else {
                setMeasureHour(measureHour);
            }
        }
    }, [props])

    return <>
        {measureHour !== undefined && <Card.Subtitle className="mb-2 text-muted">{t('Measured at')}{t(measureHour)}</Card.Subtitle>}
        {measureHour === undefined && <Card.Subtitle className="mb-2 text-muted">{t('No measured data')}</Card.Subtitle>}
    </>
}