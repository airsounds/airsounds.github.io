import { windDirName } from './utils'

describe("windDirName", () => {
    const tests = [
        ({ dir: 0, want: 'N' }),
        ({ dir: 11, want: 'N' }),
        ({ dir: 12, want: 'NNE' }),
        ({ dir: 33, want: 'NNE' }),
        ({ dir: 34, want: 'NE' }),
        ({ dir: 45, want: 'NE' }),
        ({ dir: 67.5, want: 'NEE' }),
        ({ dir: 90, want: 'E' }),
        ({ dir: 112.5, want: 'SEE' }),
        ({ dir: 135, want: 'SE' }),
        ({ dir: 157.5, want: 'SSE' }),
        ({ dir: 180, want: 'S' }),
        ({ dir: 202.5, want: 'SSW' }),
        ({ dir: 225, want: 'SW' }),
        ({ dir: 247.5, want: 'SWW' }),
        ({ dir: 270, want: 'W' }),
        ({ dir: 292.5, want: 'NWW' }),
        ({ dir: 315, want: 'NW' }),
        ({ dir: 337.5, want: 'NNW' }),
    ]

    tests.forEach(({ dir, want }) => {
        it(`${dir} => ${want}`, () => {
            expect(windDirName(dir)).toBe(want);
        });
    });
});