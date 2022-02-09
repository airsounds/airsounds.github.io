import './App.css';
import { useEffect, useState } from 'react';
import { Navbar, Container, NavDropdown, Nav, Image } from 'react-bootstrap';
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
  const [time, setTime] = useState(initialTime(q));

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [helpShown, setHelpShown] = useState(false);

  // Fetch data and calculate on start.
  useEffect(() => fetchAndCalc(time), [time]);

  async function fetchAndCalc(time) {
    const index = await fetchIndex(setError)
    const rawData = await fetchData(time, setError);
    console.log('raw', rawData);
    const data = await calc(index, rawData);
    console.log('calculated', data);
    setData(data);

    // Scroll timeline all the way to the left.
    document.getElementById('timeline-container').scrollBy({
      left: -window.innerWidth,
      smooth: true,
    })
  }

  // Keep query string aligned with viewed data.
  useEffect(() => {
    const parts = []
    if (place) { parts.push(`place=${place}`); }
    if (time) { parts.push(`time=${dateTimeURLFormat(time)}`); }
    if (parts.length > 0) {
      navigate(`?${parts.join('&')}`);
    }
  }, [time, place, navigate]);

  // Handle errors.
  useEffect(() => {
    if (!error) {
      return;
    }
    console.log('GOT ERROR', error);
  }, [error]);

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
              <img src='/logo.png' className='App-logo' alt='logo' />
            </header>
          </div>
        )
      }
      {
        data != null && (
          <>
            <Container id='timeline-container' fluid className='TimelineContainer'>
              <Timeline data={data[place]} time={time} setTime={setTime} />
            </Container>
            <Sounding data={data[place]} time={time} setError={setError} />
          </>
        )
      }
      {
        helpShown && <Help show={helpShown} setShow={setHelpShown} />
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

function initialTime(q) {
  const queryTime = q.get('time');
  return queryTime ? dateTimeURLParse(queryTime) : noonToday();
}

function noonToday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}