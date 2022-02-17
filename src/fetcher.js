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

    const days = []
    for (let i = 0; i < forecastDays; i++) {
        days.push(new Date(t.getTime()));
        t.setDate(t.getDate() + 1);
    }

    return await Promise.all(days.map(async t => {
        const text = dateFormat(t);
        return {
            t: t,
            text: text,
            hours: await fetchDay(text, setError),
        };
    }));
}

async function fetchDay(dateStr, setError) {
    const path = `${prefix}/${dateStr.replaceAll('-', '/')}.json`;
    console.debug(`Fetching day ${path}`);
    const resp = await fetch(path);
    if (!resp.ok) {
        setError({
            title: `Data for day ${dateStr} is not available.`,
            message: `Error fetching ${path}: ${resp.status}`,
        });
        return null;
    }
    try {
        return await resp.json();
    } catch (e) {
        setError({
            title: `Data for day ${dateStr} is not available.`,
            message: `Error fetching ${path}: ${e}`
        });
        return null;
    }
}