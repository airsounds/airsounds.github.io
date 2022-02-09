import { ListGroup, Modal } from 'react-bootstrap';

export default function Help({ show, setShow }) {
    return (
        <Modal
            show={show}
            fullscreen={true}
            onClick={() => setShow(false)}>
            <Modal.Header>
                <Modal.Title>אודות אייר סאונד</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p >
                    באתר זה מוצגים נתוני בלון וירטואלי ונתוני טמפרטורה שנאספים מאתרים שונים.
                </p>
                <p className='card-text rtl'>
                    ניתן לבחור בתפריט העליון את המיקום אליו ניתנת התחזית
                    בחלק העליון של המסך ישנה תחזית לימים הקרובים.
                    בחלק התחתון ישנו פרוט הטכיגרמה עבור השעה שמסומנת בחלק העליון.
                    ניתן ללחץ בחלק העליון על שעה אחרת על מנת להציג את הפירוט עבורה בחלק התחתון.
                </p>
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
                <h5>מושגים</h5>
                <ListGroup dir='ltr'>
                    <ListGroup.Item><b>T<small><b>0</b></small></b>: Grond level temperature.</ListGroup.Item>
                    <ListGroup.Item><b>TI (thermal index)</b>: Maximal theoretical flyable altitude. Based on T<small>0</small>.</ListGroup.Item>
                    <ListGroup.Item><b>TI-3 (thermal index - 3ºC)</b>: probable flyable altitude. Based on T<small>0</small> - 3ºC.</ListGroup.Item>
                    <ListGroup.Item><b>Cloud base</b>: Expected cloud base.</ListGroup.Item>
                    <ListGroup.Item><b>Trigger</b>: The Ground temperature required required for good conditions.</ListGroup.Item>
                </ListGroup>
            </Modal.Body>
        </Modal>
    )
}