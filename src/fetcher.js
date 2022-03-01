import { dateFormat } from './utils';

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

export async function fetchDay(t, setError) {
    const dateStr = dateFormat(t);
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