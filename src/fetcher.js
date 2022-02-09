import { dateFormat } from './utils';
const forecastDays = 4;

const prefix = 'https://airsounds.github.io/data';

export async function fetchIndex(setError) {
    console.debug(`Fetching index...`);
    const indexResp = await fetch(`${prefix}/index.json`);
    if (!indexResp.ok) {
        setError({ title: 'Failed getting index', message: `Response: ${indexResp.status}` });
        return;
    }
    try {
        return await indexResp.json();
    } catch (e) {
        setError({ title: 'Failed parsing index json', message: `Error: ${e}` });
    }
}

export async function fetchData(t, setError) {
    // Iterate over time slots. Start from today's morning.
    t = new Date(t.getTime());
    if (dateFormat(t) > dateFormat(new Date())) {
        t = new Date();
    }
    t.setHours(0);
    t.setMinutes(0);
    t.setSeconds(0);
    t.setMilliseconds(0);

    const days = []
    for (let dayI = 0; dayI < forecastDays; dayI++) {
        days.push({
            t: new Date(t.getTime()),
            text: dateFormat(t),
        })
        t.setDate(t.getDate() + 1);
    }

    return await Promise.all(days.map(async day => {
        day.hours = await fetchDay(day, setError);
        return day
    }));
}

async function fetchDay(day, setError) {
    const path = `${prefix}/${day.text.replaceAll('-', '/')}.json`;
    console.debug(`Fetching day ${path}`);
    const resp = await fetch(path);
    if (!resp.ok) {
        setError({
            title: `Data for day ${day.text} is not available.`,
            message: `Error fetching ${path}: ${resp.status}`,
        });
        return null;
    }
    try {
        return await resp.json();
    } catch (e) {
        setError({
            title: `Data for day ${day.text} is not available.`,
            message: `Error fetching ${path}: ${e}`
        });
        return null;
    }
}