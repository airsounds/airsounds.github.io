# airsounds

A website that provides upper-air soundings forecast for Israeli locations.

Check it out on https://airsounds.github.io.

## How it works?

This repository is a github pages that serves a react app.

The app consumes data from another Github pages repo: [airsounds/data](https://github.com/airsounds/data). That repository uses Github
[actions](https://github.com/airsounds/data/actions) to
fetch soundings forecast data from [noaa.gov](https://www.noaa.gov) and temperatures
forecast from [ims.gov.il](https://ims.gov.il).

