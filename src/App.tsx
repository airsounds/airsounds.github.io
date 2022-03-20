import './App.css';
import { useEffect, useState } from 'react';
import { Navbar, Container, NavDropdown, Nav, Image, Modal } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import TimelineBox from './TimelineBox';
import Help from './Help';
import { fetchIndex } from './fetcher';
import { dateFormat, dateTimeURLFormat, dateTimeURLParse } from './utils';
import { useTranslation } from 'react-i18next';
import { IndexData } from './data';


const defaultLang = 'he';
const defaultPlace = 'megido';
const defaultForecastDays = 4;
const headerImgSize = '24px'

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const q = new URLSearchParams(location.search);
  // Foracst location.
  const [place, setPlace] = useState(q.get('place') || defaultPlace);
  // Forecast time.
  const [time, setTime] = useState(initialTime(q.get('time')));
  // Number of days to show.
  const [days] = useState(parseInt(q.get('days') || '0') || defaultForecastDays);
  // UI language.
  const [lang] = useState(q.get('lang') || defaultLang);

  // Dates to plot timeline for.
  const [dates, setDates] = useState<Array<Date>>([]);

  // Loaded index.
  const [index, setIndex] = useState<IndexData | null>(null);

  // Current error.
  const [error, setError] = useState<Error | null>(null);

  // Show help layer.
  const [helpShown, setHelpShown] = useState(false);

  // Keep query string aligned with viewed data.
  useEffect(() => {
    const parts = []
    if (place) { parts.push(`place=${place}`); }
    if (time) { parts.push(`time=${dateTimeURLFormat(time)}`); }
    if (lang) { parts.push(`lang=${lang}`); }
    if (days) { parts.push(`days=${days}`); }
    if (parts.length > 0) {
      navigate(`/?${parts.join('&')}`, { replace: true });
    }
  }, [time, place, lang, navigate, days]);

  // Fetch index.
  useEffect(() => {
    async function setFetchedIndex() {
      setIndex(await fetchIndex(setError));
    }
    setFetchedIndex();
  }, []);

  // Set the chosen lang as the translation language.
  useEffect(() => {
    i18n.changeLanguage(lang);
    const html = document.getElementsByTagName('html')[0]
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
  }, [i18n, lang])

  // Handle errors.
  useEffect(() => {
    if (!error) {
      return;
    }
    console.log('GOT ERROR', error);
  }, [error]);

  useEffect(() => {
    // When showing the forecast, the earliest day can be at most today.
    // Therefore, if `time` is after today, and since it is used for the
    // first forecast day, limit it to at most today.
    const firstDay = new Date(time.getTime());
    if (dateFormat(firstDay) > dateFormat(new Date())) {
      firstDay.setDate(new Date().getDate());
    }
    firstDay.setHours(12, 0, 0, 0);

    setDates(Array.from(Array(days).keys())
      .map(i => {
        const date = new Date(firstDay.getTime());
        date.setDate(date.getDate() + i);
        return date;
      }));
  }, [days, time]);

  return (
    <>
      <Navbar expand='lg' bg='light'>
        <Container>
          <Navbar.Brand href='/'>
            <Image
              src='/logo.png'
              width={headerImgSize}
              height={headerImgSize}
              className='d-inline-block'
              alt='logo'
            />
            {' '}{t('Airsounds')}
          </Navbar.Brand>
          {
            dateFormat(time) < dateFormat(new Date()) && (
              <Nav.Link
                href='#'
                onClick={() => { setTime(noonToday()); }}>
                {t('Today')}
              </Nav.Link>
            )
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
          <Nav.Link
            href='#'
            onClick={() => setHelpShown(true)}>
            {t('Help')}
          </Nav.Link>
          <Nav.Link
            href='https://github.com/airsounds/airsounds.github.io'
            target='_blank'
          >
            <Image
              src='/github.png'
              width={headerImgSize}
              height={headerImgSize}
              className='d-inline-block'
              alt='Github'
            />
          </Nav.Link>
        </Container>
      </Navbar>

      <Container>
        <>
          {
            !index && (
              <div className='App'>
                <header className='App-header'>
                  <Image src='/logo.png' className='App-logo' alt='logo' />
                </header>
              </div>
            )
          }
          {
            index && dates && (
              dates.map(date => (
                <TimelineBox
                  key={dateFormat(date)}
                  place={place}
                  date={date}
                  selectedTime={time}
                  locations={index.Locations}
                  setSelectedTime={setTime}
                  setError={setError}
                />
              ))
            )
          }
        </>
      </Container >
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

function initialTime(queryTime: string | null): Date {
  return queryTime ? dateTimeURLParse(queryTime) : noonToday();
}

function noonToday(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}