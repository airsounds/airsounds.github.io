import { Image, ListGroup, Modal, Button } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

export default function Help() {
    const { t } = useTranslation();
    return (
        <>
            <Modal.Header>
                <Modal.Title>אודות אייר סאונד</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p >
                    באתר זה מוצגים נתוני טכיגרמה משולבים מבלון שנשלח על ידי הרשות המטאורולוגית
                    (מאתר אוניוורסיטת וויומינג{' '}
                    <a target="_blank" href="https://weather.uwyo.edu/upperair/sounding.html">UWYO</a>
                    ),
                    נתוני בלון "וירטואלי" (תחזית GFS) שמחושבים על ידי אתר{' '}
                    <a target="_blank" href="https://rucsoundings.noaa.gov/">NOAA</a>
                    {' '}ונתוני תחזית טמפרטורה מאתר הרשות המטאורולוגית.
                </p>
                <p className='card-text rtl'>
                    בכותרת האתר ניתן לבחור את המיקום אליו מתבקש החיזוי.
                </p>
                <p className='card-text rtl'>
                    בחלק התחתון מופיעים ארבעה גרפים עבור ארבעה ימי תחזית.
                </p>
                <Image src="/timeline-legend.png" width="100%" style={{ maxWidth: '500px' }} />
                <p className='card-text rtl'>
                    הגרף האדום מתאר את מפל הטמפרטורה היבש.
                    הגרף הכחול מתאר את מפל האוויר הרווי.
                    קו מלא מתאר תחזית בלון וירטואלי.
                    קו מקווקו מתאר בלון מדידה.
                    שטח כחול הוא הגובה הצפוי המירבי לפי הבלון הוירטואלי.
                    השטח הירוק הוא גובה צפוי מירבי לפי בלון מדידה.
                    השטח האדום מתאר את מפל הטמפרטורה מהטמפרטורה המקסימלית החזויה לאותה שעה בגובה המדידה, ועד טמפרטורה הנמוכה ב 3 מעלות ממנה.
                    השטח החום מתאר את הקרקע.
                </p>
                <p className='card-text rtl'>
                    בלחיצה על אזור בגרף, תוצר טכיגרמה מפורטת עבור אותה שעה באותו יום.
                </p>
                <Image src="/sounding-legend.png" width="100%" style={{ maxWidth: '600px' }} />
                <h5>מושגים</h5>
                <ListGroup dir='ltr'>
                    <ListGroup.Item><b>T<small><b>0</b></small></b>: Grond level temperature.</ListGroup.Item>
                    <ListGroup.Item><b>TI (thermal index)</b>: Maximal theoretical flyable altitude. Based on T<small>0</small>.</ListGroup.Item>
                    <ListGroup.Item><b>TI-3 (thermal index - 3ºC)</b>: probable flyable altitude. Based on T<small>0</small> - 3ºC.</ListGroup.Item>
                    <ListGroup.Item><b>Cloud base</b>: Expected cloud base.</ListGroup.Item>
                    <ListGroup.Item><b>Trigger</b>: The Ground temperature required required for good conditions.</ListGroup.Item>
                </ListGroup>
            </Modal.Body>
            <Modal.Footer>
                <Button>{t('Close')}</Button>
            </Modal.Footer>
        </>
    )
}