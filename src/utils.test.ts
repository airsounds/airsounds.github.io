import { crosswind } from './utils'

describe("crosswind", () => {
    const tests = [
        { windSpeed: undefined, windDir: undefined, runwayDir: undefined, want: undefined },
        { windSpeed: 10, windDir: 45, runwayDir: -45, want: 10 },
        { windSpeed: 10, windDir: 45, runwayDir: 45, want: 0 },
    ]

    tests.forEach(({ windSpeed, windDir, runwayDir, want }) => {
        it(`${windSpeed} ${windDir} ${runwayDir}`, () => {
            expect(crosswind(windSpeed, windDir, runwayDir)).toBe(want);
        });
    });
});