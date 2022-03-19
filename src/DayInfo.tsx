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
        const measureHours = Object.entries(props)
            .map(([h, v]) => v.isMeasureHour ? parseInt(h) : undefined)
            .filter(h => h);
        if (measureHours.length > 0) {
            const measureHour = pad(Math.max(...(measureHours as number[])));
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
        {measureHour && <Card.Subtitle className="mb-2 text-muted">{t('Measured at')}{t(measureHour)}</Card.Subtitle>}
        {!measureHour && <Card.Subtitle className="mb-2 text-muted">{t('No measured data')}</Card.Subtitle>}
    </>
}