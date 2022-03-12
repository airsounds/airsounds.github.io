import { DailyData, IndexData, Errorf } from './data';
import { dateFormat } from './utils';

const prefix = 'https://airsounds.github.io/data';

export async function fetchIndex(setError: Errorf): Promise<IndexData | null> {
    console.debug(`Fetching index...`);
    const indexResp = await fetch(`${prefix}/index.json`);
    if (!indexResp.ok) {
        setError({ name: 'Failed getting index', message: `Response: ${indexResp.status}` });
        return null;
    }
    try {
        return await indexResp.json() as IndexData;
    } catch (e) {
        setError({ name: 'Failed parsing index json', message: `Error: ${e}` });
    }
    return null;
}

export async function fetchDay(t: Date, setError: Errorf): Promise<DailyData | null> {
    const dateStr = dateFormat(t);
    const path = `${prefix}/${dateStr.replaceAll('-', '/')}.json`;
    console.debug(`Fetching day ${path}`);
    const resp = await fetch(path);
    if (!resp.ok) {
        setError({
            name: `Data for day ${dateStr} is not available.`,
            message: `Error fetching ${path}: ${resp.status}`,
        });
        return null;
    }
    try {
        return await resp.json() as DailyData;
    } catch (e) {
        setError({
            name: `Data for day ${dateStr} is not available.`,
            message: `Error fetching ${path}: ${e}`,
        });
        return null;
    }
}