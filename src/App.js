import './App.css';
import { useEffect, useState } from 'react';
import { Navbar, Container, NavDropdown, Nav, Image, Modal } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import Timeline from './Timeline';
import Sounding from './Sounding';
import Help from './Help';
import { fetchIndex, fetchData } from './fetcher';
import calc from './calc';
import { dateFormat, dateTimeURLFormat, dateTimeURLParse } from './utils';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const q = new URLSearchParams(location.search);
  const [place, setPlace] = useState(q.get('place') || defaultPlace);
  const [time, setTime] = useState(initialTime(q.get('time')));

  const [data, setData] = useState(null);
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
      setData(data);
    }
    fetchAndCalc(time);
  }, [time]);

  // Keep query string aligned with viewed data.
  useEffect(() => {
    const parts = []
    if (place) { parts.push(`place=${place}`); }
    if (time) { parts.push(`time=${dateTimeURLFormat(time)}`); }
    if (parts.length > 0) {
      navigate(`/?${parts.join('&')}`, { replace: true });
    }
  }, [time, place, navigate]);

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
            {' '}Airsounds
          </Navbar.Brand>
          {
            dateFormat(time) < dateFormat(new Date()) &&
            <Nav.Link href='#' onClick={() => {
              setTime(noonToday());
              setData(null);
            }}>Today</Nav.Link>
          }
          <NavDropdown title={placeNameTranslate.get(place)} id='collasible-nav-dropdown'>
            {
              Array.from(placeNameTranslate.entries())
                .filter(([en]) => en !== place)
                .map(([en, he]) => (
                  <NavDropdown.Item key={en} onClick={() => setPlace(en)}>
                    {he}
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
                <Timeline
                  key={day.day.text}
                  day={day}
                  time={time}
                  setTime={timeClicked}
                />
              ))}
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
            <Modal.Header>
              <Modal.Title>
                {`Sounding for ${dateTimeURLFormat(time)}`}
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


const defaultPlace = 'megido';
const placeNameTranslate = new Map([
  ['megido', 'מגידו'],
  ['sde-teiman', 'שדה תימן'],
  ['zefat', 'צפת'],
  ['bet-shaan', 'בית שאן']
]);

function initialTime(queryTime) {
  return queryTime ? dateTimeURLParse(queryTime) : noonToday();
}

function noonToday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}