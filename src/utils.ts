export const M = -1000.0 / 3.0;   // ft/C.
export const altTrigger = 4000.0; // ft.
export const xTick = 5; // Delta in Temperature axis.
export const yTick = 500; // Delta in altitude axix.

export const tempMax = 50; // Temperatures range.
export const altMax = 10000; // Altitude range.
export const windMax = 30; // Wind speed range.

export function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

// Formats Date in yyyy-mm-dd.
export function dateFormat(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Formats hours in hh.
export function hourFormat(date: Date): string {
    return `${pad(date.getHours())}`;
}

export function dateFormatPlotDay(t: any, date: Date): string {
    return `${t(weekdayName.get(date.getDay()))} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

const weekdayName = new Map([
    [0, 'Sun'],
    [1, 'Mon'],
    [2, 'Tue'],
    [3, 'Wed'],
    [4, 'Thu'],
    [5, 'Fri'],
    [6, 'Sat'],
]);

export const colors = {
    virtTI: '#4BC9FF',
    measuredTI: '#58CF3F',
    tempDiagonal: '#FD6B6B',
    bad: '#BF1818',
    good: '#21BF18',
    CB: '#2687DC',
    ground: '#FDB84E',
    selected: '#DFFD4E',
    windSpeed: '#0C73B2',
}

export function dateTimeURLFormat(d: Date | null): string {
    if (!d) {
        return '';
    }
    return `${dateFormat(d)}h${pad(d.getHours())}`;
}

export function dateTimeURLParse(s: string): Date {
    const [dateStr, hourStr] = s.split('h');
    const [year, month, day] = dateStr.split('-').map(x => parseInt(x));
    return new Date(year, month - 1, day, parseInt(hourStr));
}

// Returns y value for a given x and a point [x0, y0] for slope M.
export function y(x: number, x0: number, y0: number): number {
    return (x - x0) * M + y0
}

// Returns x value for a given y and a point [x0, y0] for slope M.
export function x(y: number, x0: number, y0: number): number {
    return (y - y0) / M + x0
}

export function max(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined && b === undefined) {
        return 0;
    }
    if (a === undefined) {
        return b;
    }
    if (b === undefined) {
        return a;
    }
    return (a > b) ? a : b;
}

export function min(a: number | undefined, b: number | undefined): number | undefined {
    if (a === undefined && b === undefined) {
        return 0;
    }
    if (a === undefined) {
        return b;
    }
    if (b === undefined) {
        return a;
    }
    return (a < b) ? a : b;
}

// Retruns x value for a given y between points p1=[x1, y1] and p2=[x2, y2].
export function interpolate(p1: Array<number>, p2: Array<number>, y: number): number {
    const m = (p2[1] - p1[1]) / (p2[0] - p1[0])
    return p1[0] - (p1[1] - y) / m
}


export function intersect(x: Array<number>, y: Array<number>, x0: number, y0: number, m0: number): [number, number] | undefined {

    // Require at least 2 elements.
    if (x.length < 2) {
        return undefined;
    }

    x0 = 1.0 * x0;
    y0 = 1.0 * y0;
    m0 = 1.0 * m0;

    // Calculate the diff vector.
    const diff = []
    for (let i in x) {
        diff.push(x0 + ((y[i] - y0) / m0) - x[i]);
    }

    // Find where diff vector changes from positive to negative value.
    var i = 1
    while (true) {
        if ((diff[i - 1] >= 0 && diff[i] < 0) || i >= diff.length) {
            break;
        }
        i++;
    }

    // No intersection.
    if (i < 1 || i >= diff.length) {
        return undefined;
    }

    // Find where a line between p1 and p2 crosses the y=0 line.
    const p1 = [x[i - 1], diff[i - 1]]
    const p2 = [x[i], diff[i]]
    const xi = interpolate(p1, p2, 0)

    // Calculate the linear line value in the intersection location.
    const yi = y0 + m0 * (xi - x0)
    return [xi, yi]
}

export function crosswind(windSpeed: number | undefined, windDir: number | undefined, runwayDir: number | undefined): number | undefined {
    if (runwayDir === undefined || windDir === undefined || windSpeed === undefined) {
        return undefined;
    }
    const crosswind = Math.sin((runwayDir - windDir) * Math.PI / 180) * windSpeed
    return Math.abs(Math.round(crosswind * 10) / 10);
}
