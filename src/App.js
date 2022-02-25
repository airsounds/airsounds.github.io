import './App.css';
import { useEffect, useState } from 'react';
import { Navbar, Container, NavDropdown, Nav, Image, Modal, Card, Row, Col } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import Timeline from './Timeline';
import Sounding from './Sounding';
import Help from './Help';
import { fetchIndex, fetchData } from './fetcher';
import calc from './calc';
import { dateFormat, dateTimeURLFormat, dateTimeURLParse, dateFormatPlotDay } from './utils';
import { useTranslation } from 'react-i18next';


const defaultLang = 'he';
const defaultPlace = 'megido';
const timelineHeight = '300px';
const timelineMaxWidth = '600px'

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const q = new URLSearchParams(location.search);
  const [place, setPlace] = useState(q.get('place') || defaultPlace);
  const [time, setTime] = useState(initialTime(q.get('time')));
  const [lang] = useState(q.get('lang') || defaultLang);

  const [data, setData] = useState(null);
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const [helpShown, setHelpShown] = useState(false);
  const [soundingShown, setSoundingShown] = useState(false);

  // Fetch data and calculate.
  // The data is fetched for all places, so it is only depenedent on the time.
  useEffect(() => {
    async function fetchAndCalc(time) {
      const index = await fetchIndex(setError)
      const rawData = await fetchData(time, setError);
      console.log('raw', rawData);
      const data = await calc(index, rawData);
      console.log('calculated', data);
      setIndex(index);
      setData(data);
    }
    fetchAndCalc(time);
  }, [time]);

  // Set the chosen lang as the translation language.
  useEffect(() => {
    i18n.changeLanguage(lang);
    const html = document.getElementsByTagName('html')[0]
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
  }, [i18n, lang])

  // Keep query string aligned with viewed data.
  useEffect(() => {
    const parts = []
    if (place) { parts.push(`place=${place}`); }
    if (time) { parts.push(`time=${dateTimeURLFormat(time)}`); }
    if (lang) { parts.push(`lang=${lang}`); }
    if (parts.length > 0) {
      navigate(`/?${parts.join('&')}`, { replace: true });
    }
  }, [time, place, lang, navigate]);

  // Handle errors.
  useEffect(() => {
    if (!error) {
      return;
    }
    console.log('GOT ERROR', error);
  }, [error]);

  const timeClicked = (t) => {
    setTime(t);
    setSoundingShown(true);
  }

  return (
    <>
      <Navbar expand='lg' bg='light'>
        <Container>
          <Navbar.Brand href='#' onClick={() => setHelpShown(true)}>
            <Image src='/logo.png' width='24' height='24' className='d-inline-block' alt='logo' />
            {' '}{t('Airsounds')}
          </Navbar.Brand>
          {
            dateFormat(time) < dateFormat(new Date()) &&
            <Nav.Link href='#' onClick={() => {
              setTime(noonToday());
              setData(null);
            }}>Today</Nav.Link>
          }
          <NavDropdown title={t(place)} id='collasible-nav-dropdown'>
            {
              index?.Locations
                .map(loc => loc.name)
                .filter(name => name !== place)
                .map(name => (
                  <NavDropdown.Item key={name} onClick={() => setPlace(name)}>
                    {t(name)}
                  </NavDropdown.Item>
                ))
            }
          </NavDropdown>
        </Container>
      </Navbar>
      {
        data == null && (
          <div className='App'>
            <header className='App-header'>
              <Image src='/logo.png' className='App-logo' alt='logo' />
            </header>
          </div>
        )
      }
      {
        data != null && (
          <Container>
            <>
              {Object.values(data[place]).map(day => (
                <Row className='justify-content-center'>
                  <Col
                    style={{
                      width: '100%',
                      maxWidth: timelineMaxWidth,
                      marginTop: '16px',
                    }}>
                    <Card className='text-center'>
                      <Card.Header>
                        {dateFormatPlotDay(t, day.day.t)}
                      </Card.Header>
                      <Card.Body style={{
                        height: timelineHeight,
                        paddingLeft: '0px',
                        paddingRight: '0px',
                      }}>
                        <Timeline
                          day={day}
                          time={time}
                          setTime={timeClicked}
                        />
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              ))
              }
            </>
          </Container>
        )
      }
      {
        soundingShown && (
          <Modal
            show={soundingShown}
            fullscreen={true}
            scrollable={false}
            animation={false}
            onClick={() => setSoundingShown(false)}>
            <Modal.Header className='justify-content-center'>
              <Modal.Title>
                {`${t('Chart for')} ${dateTimeURLFormat(time)}`}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Sounding data={data[place]} time={time} setError={setError} />
            </Modal.Body>
          </Modal>
        )
      }
      {
        helpShown && (
          <Modal
            show={helpShown}
            fullscreen={true}
            onClick={() => setHelpShown(false)}>
            <Help />
          </Modal>
        )
      }
    </>
  );
}

function initialTime(queryTime) {
  return queryTime ? dateTimeURLParse(queryTime) : noonToday();
}

function noonToday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}