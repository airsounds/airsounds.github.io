export const M = -1000.0 / 3.0;   // ft/C.
export const altTrigger = 4000.0; // ft.
export const xTick = 5; // Delta in Temperature axis.
export const yTick = 500; // Delta in altitude axix.

export const tempMax = 50; // Temperatures range.
export const altMax = 10000; // Altitude range.
export const windMax = 30; // Wind speed range.

export const plotHours = [10, 11, 12, 13, 14, 15, 16];

export function pad(n) {
    return n < 10 ? '0' + n : n;
}

// Formats Date in yyyy-mm-dd.
export function dateFormat(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Formats hours in hh.
export function hourFormat(date) {
    return `${pad(date.getHours())}`;
}

export function dateFormatPlotDay(date) {
    return `${weekdayName.get(date.getDay())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
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
    cloudBase: '#2687DC',
    ground: '#FDB84E',
    selected: '#DFFD4E',
}

export function dateTimeURLFormat(d) {
    if (!d) {
        return null;
    }
    return `${dateFormat(d)}h${pad(d.getHours())}`;
}

export function dateTimeURLParse(s) {
    const [dateStr, hourStr] = s.split('h');
    const [year, month, day] = dateStr.split('-').map(x => parseInt(x));
    return new Date(year, month - 1, day, parseInt(hourStr));
}

// Returns y value for a given x and a point [x0, y0] for slope M.
export function y(x, x0, y0) {
    return (x - x0) * M + y0
}

// Returns x value for a given y and a point [x0, y0] for slope M.
export function x(y, x0, y0) {
    return (y - y0) / M + x0
}

export function max(a, b) {
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

export function min(a, b) {
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

export function limitsText(min, max, units) {
    if (min === 0) {
        if (max === 0) {
            return 'N/A';
        } else {
            return '<' + max + units
        }
    }
    return min + '~' + max + units;
}

// Retruns x value for a given y between points p1=[x1, y1] and p2=[x2, y2].
export function interpolate(p1, p2, y) {
    const m = (p2[1] - p1[1]) / (p2[0] - p1[0])
    return p1[0] - (p1[1] - y) / m
}


export function intersect(x, y, x0, y0, m0) {

    // Require at least 2 elements.
    if (x.length < 2) {
        return null;
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
        return null;
    }

    // Find where a line between p1 and p2 crosses the y=0 line.
    const p1 = [x[i - 1], diff[i - 1]]
    const p2 = [x[i], diff[i]]
    const xi = interpolate(p1, p2, 0)

    // Calculate the linear line value in the intersection location.
    const yi = y0 + m0 * (xi - x0)
    return [xi, yi]
}
